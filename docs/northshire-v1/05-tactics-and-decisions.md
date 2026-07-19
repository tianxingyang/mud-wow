# 北郡 v1：战术构筑与关键决策规格

> 状态：当前实现基线
> 适用范围：北郡 1–5 级垂直切片
> 本文件是"个人战术编辑"与"关键决策帧"两项规则的唯一所有者；战斗数值、动作生命周期与 AI 仍以 [04-combat-and-progression.md](./04-combat-and-progression.md) 为准。
> 变更记录：本文件重新打开并替换 04 §1.1 旧第 4 条（"active_profile／afk_profile 均内置不可编辑"）；受影响验收用例已在 07 同步改写，不遗留 `BLOCKED`。

## 1. 固定结论

1. 玩家的核心策略表达是**战前构筑**，不是战斗中输入：普通遭遇在构筑好的个人战术下应零输入完成。
2. `active_profile` 从职业模板初始化为**个人战术**（`TacticsLoadout`），玩家可脱战做受限编辑；`afk_profile` 保持内置固定，玩家不可编辑，断线接管语义不变。
3. 受限编辑只有三类操作：**行开关、行排序、枚举阈值**。不提供新建条件、自由数值、循环或任何脚本表达式。
4. 战斗中的实时交互收敛为两种：低频的**关键决策帧**（每场 0–3 次、5 秒窗口、超时走默认），以及作为高级可选功能保留的一次性手动覆盖。
5. 关键决策帧是**纯呈现层**：每个选项映射到一条既有合法命令，选择即提交该命令；不新增战斗引擎状态，不新增协议命令类型。
6. v1 只实现一种触发器：`reinforcement_joined`（援军加入）。更多触发器、可配置默认反应（`combat.setReaction`）与可解锁条件词表属于后续阶段。

## 2. 个人战术数据模型

| 项目 | 规则 |
|---|---|
| 标识 | 每角色一份 `TacticsLoadout`，键为 `characterId`；模板身份沿用 `(class, profileKind = active, content_version)` |
| 配置版本 | `tacticsRevision` 非负整数，初始 0（等于模板默认）；每次产生实际配置变化的编辑事务 `+1`。它只标识行开关、顺序和阈值版本，不单独标识训练迁移后的 ability ID |
| 持久化 | PostgreSQL 持久保存，属于角色永久字段；与技能冷却等进程内存状态不同，进程重启后完整恢复 |
| 内容版本迁移 | 部署新 `content_version` 时，个人战术的开关、顺序和阈值重置为新模板默认，新版本下 `tacticsRevision = 0`；active／afk 动作按该角色当前已训练等级重新解析，已替换等级不得复活，并向玩家输出一次说明。v1 不做旧配置逐行迁移 |
| ability 替换迁移 | 学习 II 级技能时按 04 §5.3 原子迁移该角色个人战术对应行的 ability ID，并刷新该角色固定 `afk_profile` 的已解析动作引用；不改变行开关、顺序与阈值，不递增 `tacticsRevision`，也不修改全局模板或其他角色 |
| 战斗内快照 | 角色加入 `CombatSession` 时锁定当时的 `content_version`、`tacticsRevision`、完整 active 配置行及 active／afk 已解析动作引用；编辑仅限脱战，因此一场战斗内战术恒定。[06 §7.1](./06-multiplayer-and-recovery.md) 的开始检查点持久保存这些规范化行，不能只凭 `tacticsRevision` 推断 R1／R2 |

## 3. 可编辑范围

### 3.1 行类型

| 行类型 | 开关 | 排序 | 阈值 | 说明 |
|---|---|---|---|---|
| 安全行（`flee`） | 不可禁用 | 固定第 1 位 | 可调（枚举） | 保证 afk／脱手时的保命底线 |
| 结构行（`approach`） | 不可禁用 | 可排序 | 无 | 保证角色始终能进入接战 |
| 回退行（普通攻击／法杖攻击） | 不可禁用 | 固定末位 | 无 | 保证永远有合法基础动作，不空转 |
| 普通行（其余技能行） | 可禁用 | 可排序 | 按 3.2 表 | 构筑主体 |

禁用的行保留在列表中并标记为关闭，求值时跳过；行号按当前显示顺序 `1..N` 连续编号。排序只允许把普通行或结构行移动到 `[2, N-1]` 区间内。

### 3.2 行清单与阈值枚举

行内条件、动作与 afk 差异沿用 04 §6.2／§6.3 的表（该两表自本文件生效起定义为**个人战术的模板初始值**）。每行至多暴露一个可调阈值：

| ruleId | 职业 | 对应 04 行 | 可调阈值 | 文字输入枚举（%） |
|---|---|---|---|---|
| `rule_warrior_flee` | 战士 | 6.2 行 1 | 逃跑生命阈值 | 10／15／20／25／30／35 |
| `rule_warrior_charge` | 战士 | 6.2 行 2 | — | — |
| `rule_warrior_approach` | 战士 | 6.2 行 3 | — | — |
| `rule_warrior_battle_shout` | 战士 | 6.2 行 4 | 怒气下限 | 10／20／30 |
| `rule_warrior_rend` | 战士 | 6.2 行 5 | 目标生命下限 | 30／40／50／60 |
| `rule_warrior_heroic_strike` | 战士 | 6.2 行 6 | 怒气下限 | 30／40／50／60 |
| `rule_warrior_auto_attack` | 战士 | 6.2 行 7 | — | — |
| `rule_mage_flee` | 法师 | 6.3 行 1 | 逃跑生命阈值 | 10／15／20／25／30／35 |
| `rule_mage_frost_armor` | 法师 | 6.3 行 2 | — | — |
| `rule_mage_frostbolt_kite` | 法师 | 6.3 行 3 | — | — |
| `rule_mage_fireball` | 法师 | 6.3 行 4 | 施法后保留最大法力比例 | 0／10／20／30 |
| `rule_mage_approach` | 法师 | 6.3 行 5 | — | — |
| `rule_mage_staff_attack` | 法师 | 6.3 行 6 | — | — |

各行默认值取 [04 §6.2／§6.3](./04-combat-and-progression.md) 对应行的 `active_profile` 阈值，`tactics.view` 按该值返回模板默认。

阈值在结构化协议与存储中使用万分比整数（04 §2）：`allowedThresholdBp = allowedPercent * 100`。例如 `rule_mage_fireball` 的结构化枚举精确为 `{ 0, 1_000, 2_000, 3_000 }`；原始 `thresholdBp = 10` 表示 0.1%，不在枚举内，不能被解释成 10%。文字命令接受上表百分数，并在别名展开时先乘 100；因此 `tactics set rule_mage_fireball 10` 生成 `thresholdBp = 1_000`。火球使用角色当前最大法力并以交叉乘法比较：`manaAfterCost * 10_000 >= maxMana * thresholdBp`；默认 1,000 表示保留最大法力的 10%，不是固定保留 10 点，也不会因先取整而让不足阈值的法力通过。`rule_warrior_rend` 的怒气条件、`rule_warrior_battle_shout` 的目标生命条件等未列出的行内条件为固定值，v1 不可调。afk 表整体不可编辑，其阈值差异保持 04 原文。

## 4. `tactics` 命令族

### 4.1 命令与载荷

注册两个结构化类型：

- `tactics.view`：只读，任何状态（含战斗中、死亡）可用；返回 `contentVersion`、配置版本 `tacticsRevision` 和 `rows[]`。每行至少包含稳定 `ruleId`、当前 `displayIndex`、本地化 `label`、开关、当前 `thresholdBp`、`allowedThresholdBps[]`、可用编辑操作及模板默认值；客户端可另显示换算后的百分数，但不需要从显示文本反推内部身份。
- `tactics.update`：载荷按 `op` 使用判别联合，不使用一组全部可空的字段：

```ts
type TacticsUpdatePayload =
  | { op: "enable" | "disable"; ruleId: string }
  | { op: "move"; ruleId: string; position: number }
  | { op: "set_threshold"; ruleId: string; thresholdBp: number }
  | { op: "reset" };
```

协议 Schema 还必须把 `position` 和 `thresholdBp` 约束为整数；`position = 2.5`、`thresholdBp = 1000.5`、`NaN`、无穷值或字符串等非整数表示均在进入领域层前返回 `ProtocolErrorResult(INVALID_PAYLOAD)`。整数阈值不属于 3.2 枚举集时，才在领域层返回 `TACTICS_INVALID_THRESHOLD`。

文字别名：`tactics`（查看）、`tactics on|off <rule>`、`tactics move <rule> <位置>`、`tactics set <rule> <百分数>`、`tactics reset`。其中 `<rule>` 只接受 `tactics.view` 返回的稳定 `ruleId`；`displayIndex` 和本地化标签只用于显示，不作为命令选择器。`set` 在展开时按 §3.2 把百分数乘 100 写入 `thresholdBp`；别名只构造结构化命令，命令层不直接修改战术。

### 4.2 校验与错误码

协议层先按上述判别联合校验字段；缺少必需字段、携带当前 `op` 不允许的额外字段或类型错误时返回 `ProtocolErrorResult(INVALID_PAYLOAD)`，不进入领域逻辑。通过协议层后，`tactics.update` 在角色串行上下文中按适用顺序校验，全部通过后原子提交：

| 顺序 | 适用 `op` | 校验 | 失败错误码 |
|---:|---|---|---|
| 1 | 全部 | 角色不受任何 `CombatSession` 控制（含 `resolving` 窗口）且不处于死亡状态 | `TACTICS_EDIT_NOT_ALLOWED` |
| 2 | `enable`／`disable`／`move`／`set_threshold` | `ruleId` 属于本职业当前战术 | `TACTICS_RULE_NOT_FOUND` |
| 3 | `enable`／`disable`／`move`／`set_threshold` | 操作对该行合法（固定行不可禁用／移动，无阈值行不可设置阈值） | `TACTICS_RULE_FIXED` |
| 4 | `move` | 目标位置在 `[2, N-1]` 且不越过安全行／回退行 | `TACTICS_INVALID_POSITION` |
| 5 | `set_threshold` | `thresholdBp` 属于 3.2 百分数枚举乘 100 后的万分比集合 | `TACTICS_INVALID_THRESHOLD` |

`reset` 只经过第 1 项领域校验，随后把个人战术的行开关、顺序和阈值原子恢复为当前内容版本的模板默认；每行动作仍按该角色当前已训练等级解析，已经迁移到 II 级的 ability ID 不得回退。它不要求也不接受 `ruleId`、`position` 或 `thresholdBp`；只有默认配置确实改变时才递增一次 `tacticsRevision`，已经处于默认配置时返回 `changed = false`。

- 所有拒绝都不改变战术、不递增 `tacticsRevision`。
- 结果与目标状态已一致的合法请求（如 enable 已开启的行）返回成功且 `changed = false`，不递增 `tacticsRevision`。
- 相同 `commandId` 重试按通用幂等规则返回首次结果，不重复提交。
- 编辑生效于提交之后的下一次动作选择；由于编辑仅限脱战，实际生效点是下一场战斗。

## 5. 关键决策帧

### 5.1 触发与时序

- v1 唯一触发器 `reinforcement_joined`：内容规则使一名额外敌人加入进行中的 `CombatSession`——即 Kobold Worker 呼救成功，或 Garrick Padfoot 在 50% 生命时把一名原本空闲的 Thug 加入本场——向每名仍受本场控制的在线玩家立即推送一帧（不等 5 秒摘要，与 04 §6.4 的关键事件即时输出一致）。若 Thug 已在本场，则按 [04 §7.4](./04-combat-and-progression.md) 立即强制集火，该路径不生成 `reinforcement_joined`，也不显示决策菜单。
- 每个实际生效的加入事件对每名仍受本场控制的在线玩家恰好产生一帧；失败或未发生加入时不产生帧，同一加入事件不得重复生成帧。帧包含：触发描述、编号选项（≤4 个）、`expiresAt = announcedAt + 5,000ms` 倒计时与明示的默认项。
- 超时或断线不提交任何命令，当前战术继续（默认项恒为"无命令"语义）；断线接管由 `afk_profile` 照常处理，与本帧无关。

### 5.2 选项即命令映射

选项不是新协议：客户端在窗口内接受 `1..4` 数字快捷输入，展开为选项映射的既有命令，经正常 ingress、幂等与 `controlEpoch` 规则提交。服务器不校验"窗口"——映射命令本就是随时合法的普通命令；窗口只是呈现层倒计时。

Kobold Worker 呼救帧的固定选项：

| 编号 | 标签 | 映射命令 | 备注 |
|---:|---|---|---|
| 1 | 集火援军 | `attack <新加入敌人>` | 按 04 §7.3 切换本场目标 |
| 2 | 保持目标 | 无命令 | **默认**；当前战术继续 |
| 3 | 撤退 | `flee <最安全出口>` | 复用 04 §6.1 安全出口判定；无安全出口时不显示该项 |

Garrick Padfoot 只有把空闲 Thug 实际加入本场时才产生增援帧，固定选项为：

| 编号 | 标签 | 映射命令 | 备注 |
|---:|---|---|---|
| 1 | 集火新加入的暴徒 | `attack <新加入 Thug>` | 切换当前目标，按 04 §7.3 结算 |
| 2 | 保持当前目标 | 无命令 | **默认**；当前战术继续 |
| 3 | 撤退 | `flee <最安全出口>` | 无安全出口时不显示该项 |

若 Thug 在 Garrick 到达 50% 生命前已经属于本场，则走 [04 §7.4](./04-combat-and-progression.md) 的强制集火路径：玩家仍可使用既有手动覆盖或 `flee`，但不会出现本表菜单。

### 5.3 与手动覆盖的关系

一次性手动覆盖（04 §5.1）全部保留，作为高级可选功能：帮助与新手引导以战术构筑和决策帧为主线呈现，不再把逐动作覆盖作为普通战斗的预期玩法。覆盖槽语义与断线取消（`cancelled(reason = DISCONNECT_PROFILE_SWITCH)`）以 [04 §5.1](./04-combat-and-progression.md) 为准，同刻顺序以 [04 §8](./04-combat-and-progression.md) 为准，本文件不修改。

## 6. 后续阶段钩子（非规范）

以下方向不属于 v1 范围，仅约束命名不冲突：

- 训练师／任务奖励解锁新条件行与新槽位（如"目标读条时 → 打断"），使构筑成为与装备平行的成长线；
- 精英与 Boss 的更多决策触发器，以及 `combat.setReaction` 预配置默认反应；
- 按敌人类型保存多套个人战术并自动切换；
- 战术配置的分享与导入。

## 7. 验收标准

战术编辑与关键决策帧的验收用例、量化门槛与边界样本见 [07 §5.5／§6](./07-acceptance-and-playtest.md)。
