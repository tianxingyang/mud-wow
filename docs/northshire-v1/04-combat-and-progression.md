# 北郡 v1：战斗与成长规格

> 状态：当前实现基线
> 适用范围：北郡 1–5 级垂直切片
> 不在范围：完整 1.12 数值、天赋、武器熟练度、耐久、PvP、五人队与副本

## 1. 固定结论

- 可玩职业只有战士和法师；完成对应等级训练后，各自在 5 级时恰好有 5 个当前可用、能体现职业节奏的动作，I／II 级替换技能作为不同发布记录保存。
- 战斗使用服务端事件时间线连续运行，不采用玩家轮流行动。
- 普通动作由该角色当前生效的个人战术自动选择；玩家命令只覆盖下一次合法动作。战术构筑与关键决策帧的规则所有者是 [05-tactics-and-decisions.md](./05-tactics-and-decisions.md)。
- 每 5 秒输出一次决策摘要；关键意图、0 HP、逃离和战斗结束立即输出。
- 一场遭遇结束后停止，不自动攻击刷新敌人或相邻敌人。
- 同房间最多两名玩家加入同一遭遇；奖励与恢复规则见
  [06-multiplayer-and-recovery.md](./06-multiplayer-and-recovery.md)。

### 1.1 已冻结的补充边界

以下六项均为北郡 v1 的最终实现口径；通用战斗设计中的后续机制不得覆盖：

1. 不加入区别于 `flee` 的战斗内 `retreat`；
2. 不实现法师战斗内五秒回蓝；
3. 玩家施法读条不因受到伤害而延迟；
4. `afk_profile` 使用内置固定配置，玩家不可编辑；`active_profile` 以职业模板初始化为个人战术，只允许 [05 §3–§4](./05-tactics-and-decisions.md) 定义的脱战受限编辑（行开关、排序、枚举阈值），不提供任何脚本或自由条件表达式；
5. 断线切换到 `afk_profile` 时，取消已经 `queued` 但尚未 `started` 的手动覆盖；已经 `started` 的动作继续结算；
6. 魔法水从使用后第 1 秒到第 10 秒，每秒恢复 6 法力，共 10 个 tick。

具体错误码、取消状态、同刻顺序和验收断言由后文章节、05 与 06 继续细化；这些细化不得改变上述结果。

## 2. 数值单位与取整

| 项目 | 单位与规则 |
|---|---|
| 时间 | 战斗内调度使用整数毫秒与服务端单调时钟 `dueAt`；跨进程持久化的终态与刷新时间使用可信服务端 wall clock，见 [06 §4](./06-multiplayer-and-recovery.md) |
| 比率 | 万分比整数，`10_000 = 100%` |
| 生命、法力、怒气、护甲、伤害、经验 | 非负整数 |
| 金钱 | 铜币整数；`100 铜 = 1 银`，北郡 v1 不需要金币单位 |
| 随机 | 服务端带种子的均匀整数随机；区间两端均包含 |
| 取整 | 每一步除法立即向下取整；最终伤害命中后至少为 1 |
| 阈值 | 用 `current * 100 <= maximum * thresholdPercent` 比较，避免显示取整影响规则 |

公共函数：

```text
clamp(minimum, maximum, value) = min(maximum, max(minimum, value))
```

同一初始状态、随机种子、内容版本、权威时钟和命令序列必须产生完全相同的结构化战斗结果。

## 3. 角色基础数值

设当前等级为 `L`，且 `1 <= L <= 5`。

| 数值 | 战士 | 法师 |
|---|---:|---:|
| 最大生命 | `90 + 24 * (L - 1)` | `65 + 17 * (L - 1)` |
| 最大怒气 | 100 | 0 |
| 最大法力 | 0 | `100 + 30 * (L - 1)` |
| 基础攻击强度 | `14 + 4 * (L - 1)` | `7 + 2 * (L - 1)` |
| 基础法术强度 | 0 | 0；只由装备增加 |
| 护甲 | 装备护甲之和 | 装备护甲之和 |

升级时增加最大值，并给当前生命与法力增加同样的差值；不会额外补满。怒气上限不变。

新角色以最大生命进入世界；法师以最大法力、战士以 0 怒气开始，铜币为 0，且没有临时 aura、仇恨或战斗目标。

脱离遭遇 5 秒后，每 2 秒恢复最大生命的 2% 和最大法力的 4%，至少恢复 1；战士每 2 秒失去 5 点怒气。移动、受伤或开始遭遇会重新计算这 5 秒等待。

只要角色仍是受本场控制的 active participant，就不进行任何被动生命或法力恢复；这同时覆盖在线 `active_profile`、断线 `afk_profile` 以及最后敌人已不可攻击但最终事务尚未提交的 `resolving` 窗口。法师无论距离上次消耗法力多久都不会触发战斗内五秒回蓝。升级产生的当前法力正向差值属于成长结算，不是被动回蓝。

上述回复只改 live `CharacterState`；其落库时点、崩溃恢复语义与延迟事务的合并规则见 [../multiplayer-consistency.md §9](../multiplayer-consistency.md)，安全离线的触发边界见 [06 §6.2](./06-multiplayer-and-recovery.md)。

## 4. 命中、伤害与资源

### 4.1 命中与暴击

```text
levelDelta = attackerLevel - targetLevel
physicalHitBp = clamp(8_000, 9_900, 9_500 + 300 * levelDelta)
spellHitBp    = clamp(8_500, 9_900, 9_600 + 300 * levelDelta)
criticalBp    = 500
```

- 命中检定先于暴击检定；未命中造成 0 伤害，也不施加附带状态。
- 普通直接伤害可暴击，暴击原始伤害为 `floor(rawDamage * 150 / 100)`。
- 持续伤害、环境伤害和治疗在北郡 v1 不暴击。
- 不实现闪避、招架、格挡、擦过、抗性分段或法术批处理。

### 4.2 物理伤害

```text
weaponRoll = randomInt(weaponMin, weaponMax)
attackPowerBonus = floor(attackPower * weaponSpeedMs / 14_000)
rawDamage = weaponRoll + attackPowerBonus + abilityBonus
armorMitigationBp = min(
  6_000,
  floor(targetArmor * 10_000 / (targetArmor + 400 + 85 * attackerLevel))
)
finalDamage = max(1, floor(rawDamage * (10_000 - armorMitigationBp) / 10_000))
```

暴击倍数在护甲减伤前应用。

### 4.3 法术与持续伤害

```text
rawSpellDamage = baseDamage + floor(spellPower * coefficientBp / 10_000)
finalSpellDamage = max(1, rawSpellDamage)
```

北郡 v1 的伤害法术忽略护甲，不实现抗性。持续伤害一旦成功施加，后续每跳不再做命中检定，并忽略护甲。

### 4.4 战士怒气

```text
rageFromDamageDealt = max(1, floor(finalDamageDealt / 2))
rageFromDamageTaken = max(1, floor(finalDamageTaken / 3))
newRage = min(100, oldRage + gainedRage)
```

- 未命中不产生怒气。
- 多个同刻伤害按事件顺序分别结算。
- 动作使用 `queued -> started -> resolved | cancelled | replaced` 生命周期。进入 `queued` 只表示已排队，不扣资源、不启动公共冷却；即将进入 `started` 时必须在 WorldInstance 队列中重新校验角色、目标、资源和控制权，校验成功后才原子扣费并启动对应冷却。
- `queued` 动作被手动覆盖替换，或开始前校验失败时，分别进入 `replaced` 或 `cancelled`，均不扣费。动作一旦进入 `started`，后来因目标死亡等原因取消时不退款。

## 5. 职业动作

### 5.1 公共规则

- 公共冷却为 1,500 毫秒；普通武器挥击不触发公共冷却。
- 一名角色同一时间最多有一个读条、一个接近/逃离过程和一个“下一次挥击”覆盖。
- 通用 `approach` 在 v1 冻结为 5,000 毫秒，完成后建立接战；近战动作面对未接战目标时不会自动瞬移命中。
- 北郡 v1 不注册 `combat.retreat`，只提供 `approach` 与退出遭遇的 `flee`；客户端提交 `combat.retreat` 时按通用协议返回 `ProtocolErrorResult(UNKNOWN_COMMAND_TYPE)`，不改变接战或遭遇状态。
- 手动覆盖只替换下一次尚未开始的自动选择，不取消已经开始的读条或已到期事件。
- 玩家受到直接或持续伤害时，不改变其已开始施法的 `resolvesAt`，也不增加施法延迟；0 HP、明确控制或能力规则声明的打断仍可取消读条。Defias Thug 的包扎受直接伤害打断属于敌人专属规则，不反向引入玩家受击延迟。
- 技能等级不足、资源不足、目标非法或状态不允许时返回稳定错误码，持久战术随后选择下一条合法规则。
- 技能冷却与自我增益（战斗怒吼、霜甲术）只保存在应用进程内存：同一进程内跨遭遇与断线重连保持，安全离线后再次进入世界或进程重启后清除；重连快照按内存现状展示，不写入数据库。
- 每名角色加入 `CombatSession` 时，还要在内存中捕获 `TransientCombatCheckpoint`。捕获发生在持久开始检查点和 participant 创建成功之后、任何首个动作扣费／启动冷却／施加效果之前；字段只包括加入前自我 aura 的 `(auraId, sourceAbilityId, expiresAt)`，以及 ability 专属冷却的 `(abilityId, readyAt)`。它明确不包括公共冷却、挥击／读条／接近／逃离计时、正在执行动作、目标 debuff 或持续伤害。该检查点不持久化，也不改变正常胜利、`flee`、`recover` 或重连时“按当前剩余时间继续”的规则；仅供同进程内的 `reward_abort`／`escape_abort` 恢复使用。恢复时以当前时刻求值：已自然到期的旧效果不复活，本次 attempt 新建的效果删除，被本次 attempt 刷新的旧效果回到原到期时间，绝不把持续时间或 ability 冷却倒回更长。

所有由连接提交的命令与手动覆盖在 `queued` 时记录该连接的 `controlEpoch`；执行前除上述合法性外还要复核该 epoch。连接已被新连接接管时，旧 epoch 的动作以 `CONTROL_EPOCH_STALE` 取消且不扣费，不能在接管后迟到执行。由服务端 profile 新选择的自动动作不冒充连接命令，也不携带客户端 epoch，但仍须在开始前复核参与者控制状态与当前 profile。被动断线切换到 `afk_profile` 时，所有已经 `queued` 但尚未 `started` 的手动覆盖立即进入 `cancelled(reason = DISCONNECT_PROFILE_SWITCH)`，不扣资源、不启动冷却并释放覆盖槽；随后由 `afk_profile` 重新选择动作。已经 `started` 的动作不因断线取消，保持原 `resolvesAt` 与既有命中、失效和不退款规则；角色与目标持续合法时必须在原时刻恰好结算一次。

### 5.2 战士

| abilityId | 等级 | 动作 | replacesAbilityId | 规则 |
|---|---:|---|---|---|
| `ability_warrior_auto_attack` | 1 | 普通攻击 | — | 每个武器速度触发一次物理攻击；战士进入接战后持续自动挥击 |
| `ability_warrior_heroic_strike_r1` | 1 | 英勇打击 I | — | 15 怒气；覆盖下一次普通挥击，`abilityBonus = 4` |
| `ability_warrior_battle_shout_r1` | 2 | 战斗怒吼 | — | 10 怒气；瞬发并触发公共冷却；120 秒内攻击强度 `+7`，不可叠加 |
| `ability_warrior_charge_r1` | 3 | 冲锋 | — | 仅同房间、未接战且目标尚未死亡时使用；1,000 毫秒后建立接战并获得 10 怒气；15 秒冷却 |
| `ability_warrior_rend_r1` | 4 | 撕裂 | — | 10 怒气；要求已接战；施加 3 跳流血，每 3 秒造成 `2 + L` 伤害 |
| `ability_warrior_heroic_strike_r2` | 5 | 英勇打击 II | `ability_warrior_heroic_strike_r1` | 15 怒气；`abilityBonus = 7` |

### 5.3 法师

| abilityId | 等级 | 动作 | replacesAbilityId | 规则 |
|---|---:|---|---|---|
| `ability_mage_staff_attack` | 1 | 法杖攻击 | — | 使用武器速度结算一次物理攻击；只在战术选择该动作时继续挥击 |
| `ability_mage_fireball_r1` | 1 | 火球术 I | — | 18 法力，2,500 毫秒读条，基础伤害 12，法术强度系数 100% |
| `ability_mage_frost_armor_r1` | 2 | 霜甲术 | — | 12 法力，瞬发并触发公共冷却；持续 600 秒，护甲 `+10`；近战命中施法者时攻击者获得 4 秒 `chilled` |
| `ability_mage_conjure_water_r1` | 3 | 造水术 | — | 10 法力，脱战读条 3,000 毫秒；成功时生成 1 份 `item_minor_magic_water`，背包中最多保留 2 份；每份在脱战时于 10 秒内恢复 60 法力，移动或进入战斗取消 |
| `ability_mage_frostbolt_r1` | 4 | 寒冰箭 | — | 16 法力，2,000 毫秒读条，基础伤害 10，系数 100%；命中施加 4 秒 `chilled` |
| `ability_mage_fireball_r2` | 5 | 火球术 II | `ability_mage_fireball_r1` | 24 法力，2,500 毫秒读条，基础伤害 18，系数 100% |

上述两表恰好定义 12 个发布级 ability 记录；通用 `approach`、`flee`、`recover` 是命令／动作机制，不计入该集合。角色创建时原子学会本职业两个 1 级 ID；训练、命令 envelope、战术规则和事件都引用 `abilityId`，不得引用本地化名称或表格序号。训练带 `replacesAbilityId` 的等级时，同一角色事务保留旧 ID 供历史事件读取、把旧等级标记为 `replaced`、迁移该角色个人 `TacticsLoadout` 对应行的动作 ID，并刷新该角色固定 `afk_profile` 的已解析动作引用；迁移保留个人行开关、顺序、阈值和 `tacticsRevision`；与全局内容模板及其他角色的边界见 [05 §2](./05-tactics-and-decisions.md)。旧等级不得再进入新的 `queued` 动作。

`chilled` 不建立精确距离：目标正在接近时，只把当前接近完成时间延后 1,000 毫秒一次；目标已经接战时，其下一次普通挥击额外延后 500 毫秒。重复施加只刷新持续时间，不重复延后同一个事件。

`item_minor_magic_water` 依次校验“战斗状态 → 是否已有恢复 timer → 是否满法力”，因此重叠条件固定优先返回 `COMBAT_ACTION_NOT_ALLOWED`、`RECOVERY_ALREADY_ACTIVE`、`RESOURCE_ALREADY_FULL` 中最先命中的一项；三种拒绝都不消耗物品。其余物品所有权与职业校验通过后，原子持久化消耗 1 份；数据库提交成功并回到 WorldInstance 队列时才以当前单调时钟记 `usedAt`，再调度 10 个进程内恢复事件：`dueAt = usedAt + n * 1,000ms`，其中 `n = 1..10`。数据库延迟不会造成提交后补跑已经过去的 tick。

每个 tick 令 `mana = min(maxMana, mana + 6)`，因此没有使用瞬间的第 0 跳。接近上限时每跳独立截断，未实际恢复的溢出量立即丢弃，之后再次消耗法力也不能补领。只有成功移动或成功进入战斗才取消尚未处理的 tick；失败命令不取消。与 tick 同一毫秒到达的成功移动或开战命令遵循 §8，已到期 tick 先结算。

相同 `commandId` 的重试只返回首次使用结果，不再消耗物品或建立第二组 tick。非战斗断线的 30 秒宽限不属于取消条件，live 实例保留期间 tick 继续并出现在同进程重连快照中；主动退出或宽限结束的安全离线事务先持久化已经结算的当前法力，再取消所有剩余 tick 并卸载 live 实例，不返还水。物品消耗属于已提交永久事务，进程崩溃后仍然保持；恢复 timer 不持久化，尚未提交到 durable snapshot 的 tick 法力增量及所有剩余 tick 均丢失，重启后重试首次成功命令也不得重建 timer。

## 6. 持久战术与输出

### 6.1 规则求值

每当角色可选择新动作时，按表从上到下检查；执行第一条条件成立且动作合法的规则。若动作在真正开始前失效，则继续检查下一条，不空转一个公共冷却。

手动覆盖优先于表中规则，但仍必须合法。`active_profile` 用于在线状态，`afk_profile` 用于断线接管（北郡 v1 没有手动暂离）。

§6.2／§6.3 的 active 表是个人战术（`TacticsLoadout`）的模板初始值；afk 表保持内置固定。v1 注册 `tactics.view` 与 `tactics.update`，只允许 [05 §3–§4](./05-tactics-and-decisions.md) 定义的脱战受限编辑（行开关、排序、枚举阈值），不提供任意条件或脚本。模板身份仍由 `(class, profileKind = active | afk, content_version)` 唯一确定，并与 02 的统一包级 `content_version` 同步，不再创建独立 profile 版本真相，也不增加 02 的顶层发布记录数量；个人战术配置以 `characterId` 加 `tacticsRevision` 版本化持久保存。运行时只有 05 的个人编辑事务可以改变行开关、顺序或阈值；学习替换等级只按 §5.3 迁移该角色动作引用而不改变配置版本，部署新内容版本则按 05 §2 重置个人配置并更换全局模板。

安全出口判定：当前房间存在至少一个未被内容规则阻挡、且目标房间危险等级不高于当前房间的出口（危险等级见 02 房间表）时，战术中的 `flee` 条件成立。自动逃离选择危险等级最低的合法出口，同级时按北、东、南、西顺序取第一个；NS11 的南侧切片触发器不是移动出口，不参与判定。该判定是 v1 调参规则，不是不可变语义。

### 6.2 战士默认战术

| 顺序 | `active_profile` 条件 | 动作 | `afk_profile` 差异 |
|---:|---|---|---|
| 1 | 生命 `<= 20%` 且存在安全出口 | `flee` | 阈值改为 `<= 35%` |
| 2 | 未接战且冲锋可用 | `ability_warrior_charge_r1`（冲锋） | 相同 |
| 3 | 未接战且目标存活 | `approach` | 相同 |
| 4 | 战斗怒吼缺失、怒气 `>= 10`、目标生命 `> 30%` | `ability_warrior_battle_shout_r1`（战斗怒吼） | 要求怒气 `>= 20` |
| 5 | 目标无撕裂、目标生命 `> 40%`、怒气 `>= 10` | `ability_warrior_rend_r1`（撕裂） | 目标生命 `> 50%` 且怒气 `>= 25` |
| 6 | 怒气 `>= 30` 且未覆盖下一次挥击 | 当前已训练的 `ability_warrior_heroic_strike_r1` 或 `ability_warrior_heroic_strike_r2` | 阈值改为 `>= 50` |
| 7 | 已接战且目标存活 | `ability_warrior_auto_attack`（普通攻击） | 相同 |

### 6.3 法师默认战术

| 顺序 | `active_profile` 条件 | 动作 | `afk_profile` 差异 |
|---:|---|---|---|
| 1 | 生命 `<= 20%` 且存在安全出口 | `flee` | 阈值改为 `<= 35%` |
| 2 | 霜甲术缺失且法力足够 | `ability_mage_frost_armor_r1`（霜甲术） | 相同 |
| 3 | 目标正在接近、未被减速且法力 `>= 16` | `ability_mage_frostbolt_r1`（寒冰箭） | 相同 |
| 4 | 法力足够施放当前火球术，并能在施法后保留最大法力 10% | 当前已训练的 `ability_mage_fireball_r1` 或 `ability_mage_fireball_r2` | 阈值改为保留最大法力 25% |
| 5 | 法力不足以施放伤害法术、尚未接战且目标存活 | `approach` | 相同 |
| 6 | 已接战且目标存活 | `ability_mage_staff_attack`（法杖攻击） | 相同 |

默认战术不自动使用药水、食物、普通掉落物或长冷却。造出的水也只在玩家显式使用，或以后为战术开启单独的“允许普通恢复品”权限后使用。

### 6.4 五秒决策摘要

遭遇从 `startedAt` 起每 5,000 毫秒产生一帧。摘要至少回答：

1. 当前目标、生命档位和正在公开的意图；
2. 自己的生命、职业资源、控制和接战状态；
3. 过去 5 秒最重要的伤害、目标改变、未命中与资源变化；
4. 默认战术下一步，以及可以覆盖的常用动作；
5. 每名存活敌人的当前威胁档位（稳固／逼近／危险／已转移，与战斗规范 §6.4 一致），用于解释双人战斗中的目标选择与切换。

普通挥击不逐条发送。敌人开始高伤读条、玩家到达 0 HP、逃离成功或遭遇结束时立即发送事件，不等待下一帧。

## 7. 敌人数值与 AI

### 7.1 普通模板

设敌人等级为 `L`：

```text
maxHp = 40 + 18 * L
armor = 15 + 8 * L
meleeMin = 2 + 2 * L
meleeMax = 4 + 2 * L
meleeSpeedMs = 2_800
baseXp = 20 + 10 * L
```

Garrick 的命名目标模板使用：生命 `100%`、护甲 `100%`、直接伤害 `85%`、经验 `200%`，每项分别向下取整。该调参保留高一级命名目标和守卫协同风险，同时允许玩家先清除守卫后单人完成。

敌人普通攻击使用同一物理命中、暴击和玩家护甲减伤规则，但不计算攻击强度：`rawEnemyDamage = randomInt(meleeMin, meleeMax)`。Garrick 命名模板的直接伤害倍率在暴击和护甲减伤前作用于该原始伤害；Laborer 重击等技能倍率随后作用，且每一步立即向下取整。

### 7.2 威胁与目标

- 造成 1 点最终伤害产生 1 点威胁。
- 首次主动攻击敌人的角色额外获得 10 威胁。
- 北郡 v1 没有玩家治疗技能；不实现治疗威胁。
- 敌人选择最高威胁的存活、未逃离参与者；同威胁时依次按更早加入遭遇、较小 `characterId` 选择。
- 当前目标无效时立即重选；不跨房间追击。

### 7.3 多敌人与玩家目标

- 首次合法攻击只把被选中的敌人加入 `CombatSession`；同房间其他空闲敌人不会自动成组加入。
- 只有内容明确声明的呼救、援助或伏击能把另一名空闲敌人加入现有 `CombatSession`。已经属于其他战斗或已经死亡的敌人不能加入。
- 每名玩家保存一个 `currentTargetId`。战斗中再次提交 `attack <target>`，只可把下一次尚未开始的动作切换到本场已经加入的存活敌人；不得借此拉入无关空闲敌人。
- 当前目标仍合法时持续使用；目标死亡或离开后，自动选择本场存活敌人中 `joinedAt` 最早者，同刻再按较小 `SpawnInstanceId`。没有存活敌人时停止选择动作。
- 每名敌人第一次到达 0 HP 时，立即按该时刻的资格冻结不可变 `eligibleRecipients`，并以该次 0 HP 事件的 `eventSeq` 排入串行奖励队列；后续逃离或恢复不改写该快照。每个 `(SpawnInstanceId, RewardEpoch)` 独立原子结算，本场仍有其他存活敌人时战斗继续。
- 在玩家方仍有战斗控制的正常成功／敌人合法逃离路径中，已加入敌人的内容终态只有 `defeated`（奖励事务已提交）或 `abandoned_no_reward`（合法逃离且无奖励）。只有所有已加入敌人都进入这些终态、所有 `resolving` 事务均已提交后，才关闭整场并广播最终摘要；玩家方失败或奖励中止路径可以把旧 participant 终结为 `reset_detached`，不属于内容击败／逃离终态。最终摘要逐敌列出结果，不能把“某一只已结算”等同于整场胜利。

### 7.4 敌人 AI

| 敌人 | 从高到低的动作优先级 |
|---|---|
| Young Wolf | 无接战目标时接近 5,000 毫秒，接战后普通攻击；生命首次降到 20% 时开始逃离（规则见 §9.5） |
| Kobold Vermin | 无接战目标时接近 5,000 毫秒，接战后普通攻击，无额外动作 |
| Kobold Worker | 同普通近战；生命首次降到 30% 时呼救一次，使同房间最低 `SpawnInstanceId` 的空闲 Kobold 加入当前遭遇；没有空闲目标则只输出失败呼救 |
| Kobold Laborer | 同普通近战；每 8 秒可开始一次 2,000 毫秒公开重击，伤害为普通攻击的 150% |
| Defias Thug | 同普通近战；生命首次降到 40% 时读条 2,000 毫秒包扎，完成后恢复最大生命 20%；读条期间受到直接伤害会中断 |
| Garrick Padfoot | 使用 Garrick 命名模板；同普通近战；生命首次降到 50% 时选择同房间最低 `SpawnInstanceId` 的存活 Thug：空闲则加入本场；已在本场时，复制 Garrick 在触发瞬间的合法当前目标并强制该 Thug 集火 8 秒，期间忽略威胁排序；复制目标一旦死亡、逃离或不再合法，强制集火立即结束并按正常威胁重选；Thug 属于其他战斗时跳过，没有合法 Thug 则不生成援军 |

AI 仅在玩家主动攻击、进入明确标注的伏击或触发任务事件时开战。敌人刷新不会攻击静止玩家。AI 每次动作完成后重新按优先级选择，不提前读取玩家下一条命令。

Laborer 重击与 Thug 包扎属于普通怪辨识机制，由默认战术自动处理，不是战斗规范中受“不少于 5 秒”约束的必答关键机制；2,000 毫秒公开窗口是 v1 冻结参数。

Kobold Worker 呼救成功，或 Garrick 在 50% 生命时把原本空闲的 Thug 实际加入本场时，向仍受本场控制的在线玩家立即推送 [05 §5](./05-tactics-and-decisions.md) 定义的 `reinforcement_joined` 关键决策帧；该帧是既有命令之上的呈现层，不改变本节的 AI、威胁与目标规则。若 Thug 已经属于本场，系统在同一触发事件中立即把**该 Thug** 的强制目标设为 Garrick 在触发瞬间的合法当前目标，并广播一次目标改变提示；该效果立即生效，不设置响应窗口，不生成 `reinforcement_joined`，也不显示决策菜单。

## 8. 同刻事件顺序

调度键为 `(dueAt, priority, eventSeq)`，从小到大处理。`eventSeq` 是 WorldInstance 内单调递增整数。

| `priority` | 事件 |
|---:|---|
| 10 | 状态、控制与增益到期，以及断线 `DISCONNECT_PROFILE_SWITCH` 转换 |
| 20 | 已开始动作与定时恢复的结算：读条、挥击、接近、逃离、持续伤害、脱战恢复、魔法水 tick |
| 30 | 敌人 AI 与玩家持久战术选择下一动作 |
| 40 | 五秒决策摘要 |
| 50 | `ingressAt` 与该时刻相同的客户端命令，按 `ingressSeq` |

处理每一个 priority 10 或 20 事件后，立刻执行资源约束、0 HP、动作取消和遭遇结束检查；这些检查不是可被其他同刻事件越过的排队事件。同一 `dueAt` 的断线转换会先于仍处于 `queued` 的 profile 选择、动作开始或客户端命令，因此该覆盖先取消；只有已经用更早调度键进入 `started` 的动作才按原时间线继续。已经到期的攻击会先于同一毫秒到达的逃离或覆盖命令结算；客户端时间戳不能改变顺序。

## 9. 逃离、0 HP 与遭遇生命周期

### 9.1 状态

`AttemptId` 与 `CombatSessionId` 一一对应：一次尝试只属于一个不可复用的 `CombatSession`，同一场后来加入的所有敌人共享该 `AttemptId`。玩家方全部失去战斗控制后，旧 session 的战斗时间线立即停止；没有冻结奖励时 lifecycle 直接关闭，有冻结奖励时先进入不可控制、不可重开的 `reward_pending`，全部结算进入终态后再关闭。重置后的下一次攻击创建全新的 session/attempt，不能只换 `AttemptId` 后继续复用旧 session。

```text
CombatSession runtime:
  active -> resolving -> ended(success | enemy_escaped)
  active -> reward_pending -> ended(failed)
  active -> ended(failed, no pending reward)
  active | resolving | reward_pending -> ended(reward_abort | escape_abort)

CombatAttemptLifecycle:
  active -> reward_pending -> closed
  active -> closed

EnemyParticipant: active -> resolving -> defeated
                  active -> escape_committing -> abandoned_no_reward
                  active/resolving/escape_committing -> reset_detached
```

- `idle`：敌人可被攻击，没有活动时间线。
- `active`：`CombatSession` 至少还有一名受本场控制的存活玩家和一名仍可被攻击的敌人；同场另一个敌人可以处于 `resolving` 或 `escape_committing`。
- `resolving`：没有仍可攻击的敌人，但至少一个击败奖励或无奖励逃离终态事务仍在串行提交；不再接受改变本场结果的战斗命令。仍为 active 的玩家 participant 在最终事务或 abort 事务提交、转为 `closed` 前继续受本场控制，因此 `equip` 等非战斗状态变更仍被拒绝。存在冻结奖励时，持久化 attempt lifecycle 为 `reward_pending`；只有 `escape_committing` 且没有冻结奖励时，attempt 可保持 `active` 直至终态或 `escape_abort` 原子关闭。
- `reward_pending`：玩家方已经失去战斗控制，但旧冻结奖励仍在提交；session 不可重开，attempt lifecycle 同名。它与仍有 active participant 的 `resolving` 不混用。
- `ended`：关闭事务已经提交并生成一次最终摘要所需的持久结果，session/attempt 不可重新打开。最终摘要只能在该事务提交后广播且恰好一次；`reward_abort`／`escape_abort` 的摘要必须明确是中止失败，不能把 `escape_abort` 表述为敌人成功逃离。
- `escape_committing`：Young Wolf 的 2,000 毫秒逃离已经完成、但 `abandoned_no_reward` 事务尚未提交；该敌人不可攻击、不可重新选为目标，也不算内容终态。若它是最后一个可攻击敌人，session 进入上述 `resolving`，玩家 participant 仍为 active 直到成功终态或 `escape_abort`。
- `reset_detached`：旧 `EnemyParticipant` 的终态。同进程的迟到重置／中止回调只有在底层 `SpawnInstance.currentCombatSessionId` 仍等于旧 session 时，才能清除其威胁和临时状态、回满生命、清空归属并把出生实例的战斗状态改回 `idle`；`SpawnLifecycleRecord.state` 仍为 `active`，`SpawnInstanceId`／`RewardEpoch` 不变。进程重启时该运行时 owner 已不存在，不应用此 equality guard，而按 [06 §7.2](./06-multiplayer-and-recovery.md) 在接受任何 ingress 前从持久 lifecycle 恢复并直接作废旧 participant。该实例随后可被新 session 认领，旧 participant 永远不能重新激活。

多敌人战斗中，任一敌人到达 0 HP 就把该 `EnemyParticipant` 标记为 `resolving` 并冻结奖励快照；`CombatSession` 在仍有可攻击敌人时保持 `active`。奖励队列按 `zeroHpEventSeq`、同刻再按较小 `SpawnInstanceId` 串行提交；提交后该敌人标记为 `defeated`。没有仍可攻击的敌人时 session 进入 `resolving`，直到所有敌人均为终态且所有奖励或无奖励逃离事务均已完成才进入 `ended`。

### 9.2 `flee`

- `flee <exit>` 要求当前房间存在该出口且没有内容规则阻挡。
- 命令开始一个 2,000 毫秒逃离过程，并取消尚未开始的默认动作；受到伤害不取消逃离，0 HP 或控制会取消。
- 2,000 毫秒完成时，在同一事务原子写入目标相邻房间、完成瞬间的运行时生命／法力或怒气，并把 participant 从 `active` 置为 `fled`；提交后才丢弃该角色的战斗投影、广播成功并退出遭遇，敌人不会追出房间。事务失败时不移动、不丢弃投影、不进入 `fled`，动作以稳定持久化错误结束，角色仍在原房间受本场控制，可重新发起新的 `flee`。
- 两人遭遇中一人逃离不会停止另一人的战斗。
- 成功逃离只取消该角色对仍存活敌人的未冻结资格；已经到达 0 HP 的敌人使用冻结的 `eligibleRecipients`，不会因之后逃离而改写结果。
- 若角色逃离时已有属于自己的冻结奖励尚未进入终态，该角色在旧奖励完成或中止事务提交前不能开启或加入其他 `CombatSession`，稳定返回 `COMBAT_REWARD_PENDING`；这不阻止仍留在原 session 的 active 队友继续作战。
- 所有仍受本场控制的参与者都逃离或到达 0 HP 后，旧 session 的战斗时间线立即停止，并清除所有未冻结资格及其 `COMBAT_REWARD_PENDING`。没有冻结奖励时，session/attempt lifecycle 直接以 `failed` 关闭；已经有冻结奖励时，lifecycle 进入 `reward_pending`，不能继续控制或重新打开，相关 pending 只保留到这些事务进入终态，随后再以 `failed` 关闭。存活敌人等待 3,000 毫秒后，仅在 `SpawnInstance.currentCombatSessionId` 仍等于旧 session 时执行 `reset_detached` 并回到 `idle`；下一次攻击创建新 session/attempt。若该实例已经脱离旧 session 或被新 session 认领，旧收尾不得再修改它。

### 9.3 0 HP 与简化恢复

- 生命降到 0 时立即标记 `defeated`，取消读条、挥击、接近和逃离，不再成为合法目标。
- 被击败者退出战斗控制，可观看摘要，但不能在同一场遭遇中复活或重新加入；另一名存活参与者可以继续战斗。
- 死亡状态只允许查看、摘要、重连和幂等 `recover`。系统不会自动恢复。
- `recover` 成功后将角色移到北郡修道院庭院，生命与职业资源恢复满值，并清除上一场战斗的 aura、仇恨和临时目标；战斗怒吼、霜甲术等自我增益不属于战斗 aura，不因 `recover` 清除。
- `recover` 失败时保持死亡状态并可重试；重复提交返回首次结果，不产生第二次状态变化。
- 北郡 v1 不跑尸、不扣经验、不掉装备、不扣金币，也不实现耐久损失。
- 代价是退出旧战斗控制并被移回庭院；未完成的动作、读条和覆盖命令全部取消，战斗中已经提交消耗的物品不会返还。只有同一 `AttemptId` 中仍有存活队友继续战斗时，死亡前已经登记的存活敌人资格才暂时保留；全灭立即停止旧战斗控制并清除未冻结资格，lifecycle 按有无未决冻结奖励进入 `reward_pending` 或直接关闭。敌人已到 0 HP 时冻结的奖励快照不受随后死亡或 `recover` 影响，详见 [06 §2.2](./06-multiplayer-and-recovery.md)。

### 9.4 结束

- 在非玩家方失败路径中，最后一名存活敌人到达 0 HP 后进入 `resolving`；只有本场每个敌人都进入终态且全部冻结奖励事务成功，session 才进入 `ended` 并广播最终结果。
- 玩家方全部逃离或被击败时，旧 session 的战斗控制以失败停止；仍存活敌人不产生新的击败奖励并按上述归属条件进入 `reset_detached`。没有冻结奖励时 lifecycle 直接关闭，有未决冻结奖励时先进入 `reward_pending`、全部进入终态后再关闭。本场此前已经提交或已经在 0 HP 时冻结的敌人奖励照常完成且不回滚，只有存活敌人的未冻结资格被清除。
- 结束时取消未来挥击、读条、持续伤害与 AI 决策，输出一份最终摘要。
- 角色随后进入脱战恢复或等待；系统不会自动寻找下一名敌人。

### 9.5 敌人逃离

- 北郡 v1 只有 Young Wolf 会逃离：生命首次降到 20% 时开始 2,000 毫秒逃离过程，期间仍可被攻击并正常结算伤害，到达 0 HP 则按击败处理并取消逃离。
- v1 玩家没有可阻止敌人逃离的手段，逃离过程不可被打断。
- 2,000 毫秒逃离完成后，敌人先进入不可攻击的 `escape_committing`。该 `SpawnInstance` 只有在无奖励终态事务提交成功时才进入 `abandoned_no_reward`、退出遭遇并从世界移除：事务把当前 `RewardEpoch` 终结为无奖励，不产生经验、任务计数或掉落，并以可信 wall clock 持久化 `respawnEligibleAt = terminalAt + 02 中该出生点的刷新时长`。刷新生成新的 `SpawnInstanceId` 与 `RewardEpoch`；进程重启不得复用或重新开放已作废代次。提交失败与有界中止规则见 [06 §4](./06-multiplayer-and-recovery.md)、[§8](./06-multiplayer-and-recovery.md)。
- 若逃离者是本场最后一名可攻击敌人，遭遇停止继续产生攻击、伤害和动作时间线，但存活玩家 participant 仍为 active、仍受本场 session 控制，快照继续从战斗投影读取当前生命／资源。此前已提交的其他敌人奖励不回滚；只有该无奖励终态与仍在 `resolving` 的冻结奖励全部提交，或 `escape_abort` 原子关闭后，才把 active participant 置为 `closed`、丢弃投影，并以对应结果关闭整场和输出最终摘要。

## 10. 1–5 级成长与经济

### 10.1 等级阈值

`xpTotal` 是累计经验；达到 5 级后在本切片封顶为 4,800，不再获得经验。

| 等级 | 累计经验 | 相比上一级 |
|---:|---:|---:|
| 1 | 0 | — |
| 2 | 400 | 400 |
| 3 | 1,300 | 900 |
| 4 | 2,700 | 1,400 |
| 5 | 4,800 | 2,100 |

普通敌人的基础经验见第 7 节。按每名玩家自己的等级应用：

| `enemyLevel - playerLevel` | 经验倍率 |
|---:|---:|
| `>= 2` | 120% |
| `1` | 110% |
| `0` | 100% |
| `-1` | 75% |
| `-2` | 50% |
| `<= -3` | 20% |

最终经验向下取整。两人共同击败时的分配见 [06 §3.1](./06-multiplayer-and-recovery.md)。

任务经验以 [03-quest-state-pack.md](./03-quest-state-pack.md) 为唯一来源：九条可交付任务固定合计 2,850 XP，`Report to Goldshire` 在切片内不交付、不发奖励。完成这些任务要求的击杀必须提供达到 4,800 XP 所需的其余经验，不额外发放地标发现经验，也不要求为升级而击杀任务目标之外的刷新怪。若不同合法任务顺序令未封顶总经验超过 4,800，超出部分由 5 级上限截断；若基准路线无法到达 5 级，只调整 04 的敌人基础经验，不改写 03 已冻结的任务奖励。

### 10.2 金钱与训练

| 解锁等级 | 每职业训练费用 | 内容 |
|---:|---:|---|
| 1 | 0 铜 | 初始两个动作免费 |
| 2 | 5 铜 | 第三个动作 |
| 3 | 10 铜 | 第四个动作 |
| 4 | 15 铜 | 第五个动作 |
| 5 | 20 铜 | 主要伤害技能 II |

训练事务必须使用第 5 节的稳定 `abilityId`。每个职业的 2–5 级各恰好有一个对应付费 ID；相同训练命令重试只产生一条学习记录，已经学会、等级不足、职业不符或前一等级关系不满足时均不扣款。

当前掉落表的自动化验证口径为：完成任务必需击杀，包含 #6 基准路线先击败的一名 NS10 守卫，并领取、卖出全部灰色杂物。在该口径下，敌人铜币与灰物期望约 82 铜，加上 03 固定的 62 铜任务奖励构成总收入；训练总计 50 铜，基准加固手套 12 铜，法师可选腰带另 12 铜。总收入与结余的量化门槛见 [07 §5.3](./07-acceptance-and-playtest.md)。自动化报告必须显式记录上述口径，不能把未领取或未出售灰物的路线与该分布混算；本包不假设尚未定义的恢复商品支出。

- 购买、出售和训练均使用整数铜币，事务失败不扣款。
- 训练只能在对应职业训练师处进行；升级不自动学会付费动作。
- 关键任务奖励不得要求玩家先购买装备才能完成下一条主干。

### 10.3 基准装备

| 阶段 | 战士 | 法师 |
|---|---|---|
| 1 级出生 | 旧短剑 `6–9 / 2,500ms`；三件出生护甲合计 60 | 旧法杖 `4–7 / 3,000ms`；三件出生护甲合计 25 |
| 5 级验收 | 民兵之刃 `10–14 / 2,500ms`；穿戴最终任务装备与加固手套后装备护甲 100 | 民兵法杖 `6–9 / 3,000ms`、最大法力 `+20`；穿戴最终任务装备与加固手套后装备护甲 48 |

北郡只需要灰、白、绿品质。这里的 5 级验收线对应 [07 §7.1](./07-acceptance-and-playtest.md) 完成九条切片内任务的单人黄金路径，不是只跑狗头人主干；基准通关不能依赖随机绿装，本包冻结的任务奖励与商人必须共同提供确定性的白装／绿装组合。

表中的 100／48 只计算持久装备护甲。法师维持霜甲术时战斗有效护甲为 58；自动化报告必须同时记录装备护甲和 aura 后有效护甲，不能混用。

### 10.4 确定性物品表

以下是北郡 v1 实现所需的最小物品数据；未列出的 Vanilla 属性不进入切片。

第 5 节的每个 ability 记录，以及本文件涉及的每个 item 记录（确定性装备、消耗品、灰物和任务物）都必须遵守 [02 §8.1 的通用来源字段契约](./02-world-and-content.md#81-通用来源字段契约)，至少携带 `source_version = vanilla_1_12`、`source_urls`、`canonical_status`、`adaptation_notes` 与 `content_version`。`canonical_status` 只能为 `original | adapted | new`；只要记录混合了 v1 调整后的数值或行为，整条记录就标为 `adapted` 并逐项说明，不得把原版名称当成整条记录仍为 `original` 的依据。

| ID | 来源／价格 | 职业 | 槽位 | v1 属性 |
|---|---|---|---|---|
| `item_worn_shortsword` | 战士出生并装备 | 战士 | 主手 | 物理伤害 `6–9`，速度 `2,500ms` |
| `item_recruit_tunic` | 战士出生并装备 | 战士 | 胸 | 护甲 36 |
| `item_recruit_trousers` | 战士出生并装备 | 战士 | 腿 | 护甲 20 |
| `item_recruit_boots` | 战士出生并装备 | 战士 | 脚 | 护甲 4 |
| `item_worn_staff` | 法师出生并装备 | 法师 | 双手 | 物理伤害 `4–7`，速度 `3,000ms` |
| `item_apprentice_robe` | 法师出生并装备 | 法师 | 胸 | 护甲 16 |
| `item_apprentice_trousers` | 法师出生并装备 | 法师 | 腿 | 护甲 7 |
| `item_apprentice_shoes` | 法师出生并装备 | 法师 | 脚 | 护甲 2 |
| `item_outfitter_boots` | #21 固定奖励 | 通用 | 脚 | 护甲 8 |
| `item_militia_blade` | #18 战士固定奖励 | 战士 | 主手 | 物理伤害 `10–14`，速度 `2,500ms` |
| `item_militia_staff` | #18 法师固定奖励 | 法师 | 双手 | 物理伤害 `6–9`，速度 `3,000ms`，最大法力 `+20` |
| `item_layered_tunic` | #6 战士固定奖励 | 战士 | 胸 | 护甲 55 |
| `item_ensign_cloak` | #6 法师固定奖励 | 法师 | 背 | 护甲 8 |
| `item_wine_stained_cloak` | #3905 固定奖励 | 通用 | 背 | 护甲 9 |
| `item_reinforced_gloves` | NS02 Brother Danil，12 铜 | 通用 | 手 | 护甲 8 |
| `item_plain_cloth_sash` | NS02 Brother Danil，12 铜 | 法师 | 腰 | 最大法力 `+10` |
| `item_minor_magic_water` | 法师造水术；不可出售 | 法师 | 消耗品 | 仅脱战使用；10 秒内恢复 60 法力，移动或进入战斗取消剩余恢复 |

出生与商店装备显示为白色品质，任务装备显示为绿色品质，10.6 节杂物显示为灰色品质；品质只影响显示和筛选，不进入战斗公式。

同一槽位只能装备一件物品。装备事务必须先校验职业、槽位和所有权，再原子替换；最大生命或法力变化时，当前值最多提高同样的正向差值，但卸下物品不会把当前值降到 1 以下。角色 `controlState = active` 且仍受某个 `CombatSession` 控制时——包括最后敌人 0 HP 后的 `resolving` 窗口——`equip` 必须以 `COMBAT_ACTION_NOT_ALLOWED` 拒绝且不改变任何状态；`fled`／`recovered` 的奖励等待者已退出战斗控制，可以整理和装备物品，延迟奖励不得覆盖其变化。

### 10.5 背包与商人

- 普通背包固定 12 格；出生装备直接处于装备位，角色初始普通背包为空。任务物品使用 03 的独立任务物品栏。
- 装备每件占 1 格且不可堆叠；灰色杂物同 ID 每格最多 20；`item_minor_magic_water` 全背包合计最多 2 份（与 5.3 一致，单格即可容纳），达到上限时造水动作在读条前失败且不扣法力。
- `use item_minor_magic_water` 必须在脱战状态按 §5.3 的校验与精确时间表原子移除 1 份并开始恢复。恢复 tick 的取消、不返还与崩溃恢复口径以 §5.3 为准。
- 已装备物品不占普通背包格。替换装备时，被换下物品必须能进入现有空格或可用堆叠，否则整个装备事务拒绝。
- 北郡 v1 没有丢弃或销毁命令；被替换下的出生装备与任务装备既不可出售也不可丢弃，保留在普通背包中。黄金路径每职业最多产生 3 个此类占用格，加上杂物与魔法水堆叠，12 格容量不会造成领取或装备软锁。
- `pending` 的 `PersonalLoot` 不占背包格；领取时才原子检查空格或堆叠上限，`declined` 后不可再领取。
- Brother Danil 的两件装备没有世界共享库存，但每个角色各限购一件；角色已拥有或已装备同 ID 时 `buy` 返回 `ITEM_ALREADY_OWNED`。
- `buy`、`sell` 和训练分别使用独立幂等事务。北郡 v1 只允许把下表灰色杂物卖给 Brother Danil；出生装备、任务奖励、任务物品和商店装备不可出售，避免进度软锁和买卖套利。

### 10.6 普通个人掉落表

每名合格玩家独立执行下表；概率使用万分比，铜币直接入账，灰色杂物进入个人掉落。v1 的 `lootTableId` 固定等于该行敌人模板记录的 `id`，不另建一个可自行命名的掉落表 ID；内容版本变化由 02 冻结的统一包级 `content_version` 区分。

| mobTemplateId／敌人 | 铜币 | 灰色杂物 |
|---|---|---|
| `mob_young_wolf` / Young Wolf | 30%：`1–2` 铜 | 20%：`item_ruined_pelt`，售价 2 铜 |
| `mob_kobold_vermin` / Kobold Vermin | 35%：`1–2` 铜 | 25%：`item_dull_candle`，售价 2 铜 |
| `mob_kobold_worker` / Kobold Worker | 40%：`1–3` 铜 | 30%：`item_wax_clump`，售价 2 铜 |
| `mob_kobold_laborer` / Kobold Laborer | 45%：`2–3` 铜 | 30%：`item_chipped_pick`，售价 3 铜 |
| `mob_defias_thug` / Defias Thug | 45%：`2–3` 铜 | 30%：`item_worn_sash`，售价 3 铜 |
| `mob_garrick_padfoot` / Garrick Padfoot | 100%：`6–8` 铜 | 不随机掉装备；装备成长来自任务奖励 |

任务物品不占用普通掉落概率，也不进入 `PersonalLoot`：#18 的同一 `questRunId` 在敌人 0 HP 时已冻结对应目标资格、且提交时该任务进行期仍为 `active` 时，Defias Thug 击败事务把一个 `item_red_burlap_bandana` 直接写入该角色的独立任务物品栏并推进对应收集目标，直到目标达到 12；#6 的 Garrick Head 同理。二者均使用 `(SpawnInstanceId, RewardEpoch, characterId, questRunId, objectiveId)` 去重，不能放弃领取，普通背包已满也不影响。随机装备不进入北郡基准路径。

## 11. 验收标准

本节规则的验收用例与量化门槛见 [07 §5.1／§5.3／§5.5／§7](./07-acceptance-and-playtest.md)。
