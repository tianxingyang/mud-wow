# 北郡 v1：多人一致性与恢复规格

> 状态：当前实现基线
> 适用范围：同一北郡世界中两名真人共同参战、个人进度与个人掉落、断线/重连和进程崩溃恢复
> 不在范围：正式组队系统、五人队、交易、需求/贪婪、副本实例、跨进程世界与 PvP

## 1. 世界与权威边界

- 北郡 v1 只有一个 `WorldInstance`；房间、敌人实例和战斗事件对在线玩家共享。
- `WorldInstance` 的执行队列是所有共享世界与战斗状态的唯一写入者；`CombatSession` 只拥有自身的事件集合，不另建可并行写世界状态的队列。
- 每个 `CombatSession` 最多有两名玩家参与者。第三名玩家可以旁观，但攻击该遭遇时收到 `COMBAT_PLAYER_CAPACITY_REACHED`。
- 不要求先组队或邀请。第二名玩家在同房间对同一活动敌人提交合法攻击时加入原 `CombatSession`，不会创建敌人的私有副本。
- 服务端统一裁决成员、事件顺序、敌人生命、经验、任务计数、个人掉落和恢复。客户端只提交意图。
- 每名角色的任务、知识、背包、装备、金币、经验和已领取奖励独立持久化。

## 2. 参与者与奖励资格

### 2.1 加入

角色同时满足以下条件才能加入：

1. 与目标敌人在同一房间；
2. 存活且不在另一场遭遇中；
3. 首次开战时目标是 `idle` 的出生实例，或中途加入时目标属于仍为 `active` 的遭遇；
4. 中途加入时本 session 累计登记的 `CombatParticipant` 少于两名；
5. `attack`、伤害法术或控制动作在当前状态合法；
6. 角色没有来自其他 `CombatSession` 的保留资格或未决冻结奖励锁。

排队命令尚未加入战斗。该命令即将进入 `started` 时，WorldInstance 先重新校验上述条件：目标为 `idle` 时分配新的 session/attempt，目标已在 `active` 遭遇时加入原 session；随后写入开始检查点、创建 `CombatParticipant` 并固定记录 `joinedAt` 与 `joinSeq`，紧接着在任何动作成本或效果产生前捕获 04 §5.1 的内存 `TransientCombatCheckpoint`，再按动作规则扣费并开始动作。任一步失败都不创建半成品参与者、不扣费。加入时把本场当时所有存活的 `EnemyParticipantId` 写入该角色的 `eligibleEnemyIds`；仅进入房间、查看敌人、旁观事件或只有 `queued` 命令不算加入。

`AttemptId` 与 `CombatSessionId` 一一对应且都不可复用。玩家名额按本场累计登记的 `CombatParticipant` 计算：`defeated`、已执行 `recover` 后只保留资格记录、或已成功 `flee` 的参与者都不释放名额，成功 `flee` 的角色在同一 attempt 内也不能重新加入。因此一个 `CombatSession` 终生最多登记两名玩家；旧 session 的战斗控制停止、且 lifecycle 已关闭或进入不可重开的 `reward_pending` 后，重置敌人的下一次攻击创建全新的 session/attempt。

内容规则后来把新敌人加入本场时，只为当时仍存活且未成功逃离的玩家参与者追加该 `EnemyParticipantId`；断线但仍由 `afk_profile` 控制的存活角色也会追加。已经 `defeated` 或已经成功 `flee` 的角色不取得后来加入敌人的资格。

### 2.2 击败奖励资格

北郡 v1 不增加伤害占比或反挂机门槛。敌人第一次到达 0 HP 时立即冻结该敌人的不可变 `eligibleRecipients`；快照同时记录每人的 `adjustedXp`、固定掉落随机键，以及当时匹配该敌人且尚未到上限的 `objectiveEligibility[] = (questRunId, objectiveId, objectiveKind)`。重试、前序奖励导致的升级或之后新接任务都不能事后重算这些字段。成员同时满足以下条件即写入快照：

- 已按 2.1 节加入该 `CombatSession`，且目标 `EnemyParticipantId` 已写入自己的 `eligibleEnemyIds`；
- 在目标到达 0 HP 前没有成功 `flee`；
- 该角色在当前 `(SpawnInstanceId, RewardEpoch)` 的奖励尚未提交。

存活、因断线仍由 `afk_profile` 控制的存活角色，以及在同一 attempt 中由存活队友继续作战时已经 `defeated` 或随后执行 `recover` 的角色，均可写入已登记敌人的冻结快照。0 HP 与 `recover` 本身不删除同一 attempt 的既有资格；若没有存活队友，旧 session 的战斗控制当场停止，所有尚未冻结的资格随之清除，lifecycle 按是否存在冻结奖励直接关闭或进入 `reward_pending`。主动 `flee` 也只取消仍存活敌人的未冻结资格；敌人已经到达 0 HP 后，逃离不能改写其 `eligibleRecipients`。

角色离开某场战斗控制后，只要仍保留该场尚未冻结的既有资格，或任何旧 session 的 `eligibleRecipients` 中还有属于该角色的未决冻结 `RewardEpoch`，就持有角色级 combat reward lock。`recover` 与 `flee` 后的旧 `CombatParticipant` 只保留为资格记录，不再控制旧战斗；角色可以观察、移动、交谈和整理物品，但开启或加入任意其他 `CombatSession` 都收到 `COMBAT_REWARD_PENDING`。该锁不阻止仍为原 session active participant 的角色继续原战斗。旧战斗后来加入的敌人不会追加给已离开控制的记录；已登记敌人的奖励提交后照常进入角色账户、任务物品栏或 `PersonalLoot`。失败停止时清除所有未冻结资格；每个冻结代次在奖励成功或显式中止事务提交时从 `unresolvedRewardEpochs` 移除，最后一个保留资格／未决代次清除后才释放角色级锁。attempt 有冻结奖励时保持 `reward_pending`，全部进入终态后关闭；不得只因角色移动到另一房间或旧 session 仍有队友而提前释放锁。

## 3. 经验、任务与个人掉落

### 3.1 经验

先按 04 文档中的敌人基础经验和每名玩家自己的等级差计算 `adjustedXp`，再按该敌人死亡时的合格人数分配：

| 合格玩家数 | 每人获得 |
|---:|---:|
| 1 | `adjustedXp` 的 100% |
| 2 | `adjustedXp` 的 100% |

共同参战不分摊敌人经验，避免双人基准路线因固定任务包而无法在出口前达到 5 级。任务经验同样不分摊，每名完成任务的角色获得完整固定任务经验。

### 3.2 共享任务击杀

敌人击败事务对每名冻结快照中的玩家分别检查：

1. 0 HP 快照中是否已经存在匹配的 `(questRunId, objectiveId, objectiveKind)`；
2. 当前权威任务状态是否仍是同一个 `questRunId`，且仍为 `active`；
3. 当前计数是否尚未达到上限；
4. 本次 `(SpawnInstanceId, RewardEpoch, characterId, questRunId, objectiveId)` 是否尚未计数。

全部成立则击杀目标计数 `+1`。收集任务物则在同一事务中直接写入独立任务物品栏并同步推进收集目标；二者统一以 `(SpawnInstanceId, RewardEpoch, characterId, questRunId, objectiveId)` 去重。0 HP 时没有对应活动目标、或在提交前已经放弃并重接为新 `questRunId` 的玩家，仍可获得冻结的战斗经验和普通个人掉落，但不获得旧击败的任务目标或任务物品；之后再接任务不会追溯此前击败。

两名玩家的前置与知识状态互不传播；共同击败不等于共享接取、共享交付或共享后续解锁。

### 3.3 个人掉落

- 铜币与物品按合格角色分别生成；不生成可被其他玩家抢走的公共掉落槽。
- 随机键至少包含 `(content_version, SpawnInstanceId, RewardEpoch, characterId, lootTableId)`，测试可固定种子。
- 铜币在击败事务中直接记入角色账户。
- 非任务物品写入持久化 `PersonalLoot`，只有所有者能看见、领取或放弃；北郡 v1 不使用需求/贪婪。
- `PersonalLoot` 状态机为 `pending -> claimed | declined`。`claimed` 与 `declined` 都是终态：领取时原子检查背包，放弃不要求背包空间；相同命令重试返回首次结果，进入任一终态后不能再切换到另一终态。北郡 v1 不自动过期、不自动领取。
- 背包已满时不丢弃物品：领取失败不改变 `pending`，该状态跨断线保留，直到所有者成功领取或显式放弃。
- 任务物只有在 0 HP 快照已冻结对应 `questRunId` 的目标资格、且提交时同一进行期仍为 `active` 时才生成。两名都满足时，各自在击败事务中直接获得一份，写入 03 定义的独立任务物品栏并同步推进目标；任务物不创建 `PersonalLoot`，不可 `decline`，也不受普通背包容量影响。已拥有唯一任务物或已完成对应目标时不再生成重复任务物。

领取与放弃是独立幂等事务。角色无法通过猜测掉落 ID 读取、领取或放弃另一名角色的 `PersonalLoot`。

## 4. 敌人实例、尝试与刷新

每个出生点使用以下身份：

```text
SpawnPointId    内容中的固定出生点
SpawnInstanceId 本次实际出生的敌人实例
RewardEpoch     本实例可发放奖励的代次
AttemptId       与一个 CombatSession 一一对应的本次战斗尝试
```

- 一个 `SpawnInstanceId` 同一时刻只能属于一个 `CombatSession`。
- `SpawnInstance.currentCombatSessionId` 是同进程运行时唯一归属字段；认领、迟到重置和中止收尾都必须在 WorldInstance 串行队列中比较该字段。旧 session 只能修改仍由自己持有的实例，不能凭旧 `EnemyParticipant` 引用修改已经脱离或被新 session 认领的实例。进程启动恢复是例外：旧内存 owner 不存在，必须在接受任何 ingress 前直接按持久 attempt／SpawnLifecycle 分类恢复，不对不存在的 `currentCombatSessionId` 做相等比较。
- 第二名玩家攻击它时加入现有战斗；不能同时形成两份生命或两次奖励。
- 玩家方全部逃离或被击败时，本次 session 的战斗时间线以失败停止并清除存活敌人的未冻结资格；没有冻结奖励时 lifecycle 直接关闭，有未决冻结奖励时进入不可控制、不可重开的 `reward_pending`，全部进入终态后再关闭。3 秒后，对每个存活敌人执行条件重置：仅当 `currentCombatSessionId` 仍等于旧 session 时，才回满生命、清除威胁／临时状态／阶段触发、清空归属并把旧 `EnemyParticipant` 终结为 `reset_detached`，底层实例返回 `idle`。`SpawnInstanceId` 与仍为 `active` 的 `RewardEpoch` 不变，下一次攻击创建新 session/attempt；旧奖励等待不阻塞该实例被新 session 认领（重置细节以 04 §9 为准）。
- 每个出生实例持久化 `SpawnLifecycleRecord(SpawnPointId, SpawnInstanceId, RewardEpoch, state, terminalAt, respawnEligibleAt)`。`state` 为 `active | defeated | abandoned_no_reward`；后两者是不可重新打开的终态，`active` 记录的两个终态时间字段为空。
- 敌人击败事务把当前 `RewardEpoch` 关闭为 `defeated`。Young Wolf 的逃离计时完成后先进入不可攻击的 `escape_committing`，再用无奖励事务关闭为 `abandoned_no_reward`；两种终态都以可信 wall clock 写入 `terminalAt`，并按 02 的该出生点刷新时长计算、持久化 `respawnEligibleAt`。若该终态关闭整场，最终事务同时保存仍为 active 的角色生命／资源、把 participant 置为 `closed`、关闭 attempt 并清空其 `unresolvedRewardEpochs`。战斗内 `dueAt` 的单调时钟不得用作跨进程刷新依据。
- Young Wolf 的无奖励终态事务提交前不得广播最终逃离或把该出生点重新开放；提交失败时实例保持不可攻击的终态提交中状态并用相同键重试，避免“客户端已见逃离、重启后旧代次又出现”。该事务使用 §8 相同的 3 次总提交预算；预算耗尽时进入 `escape_abort`，停止整场战斗时间线但不广播逃离或终局，session 保持锁定。幂等中止事务必须原子完成：按 §7 重基准写回每名仍受本场控制的 active 角色、把这些 participant 置为 `closed`、清空所有被丢弃代次的 `unresolvedRewardEpochs`／角色 reward lock、关闭 attempt 为 `escape_abort`，并保留已经提交的敌人结果。提交成功后，才在 WorldInstance 队列按 04 §5.1 的 `TransientCombatCheckpoint` 恢复自我 aura／ability 专属冷却、丢弃旧战斗投影，并把 `currentCombatSessionId` 仍等于旧 session 的非终态敌人以原 `SpawnInstanceId`／仍为 `active` 的原 `RewardEpoch` 回满、清除归属、标记旧 participant 为 `reset_detached`，底层实例返回 `idle`；已经脱离或被新 session 认领的实例不受旧中止影响。最后恰好广播一次“中止失败”摘要，不能伪装成敌人成功逃离；数据库仍不可用时不得提前解锁、广播或在内存中假装中止成功。
- 刷新时长以 [02-world-and-content.md](./02-world-and-content.md) 为唯一来源，本文件不复制秒数。只有 wall clock 达到 `respawnEligibleAt` 才能创建新的 `SpawnInstanceId` 与 `RewardEpoch`；同一旧代次永远不能再次生成经验、任务计数、铜币或物品。
- 应用启动时先读取 `SpawnLifecycleRecord`：终态实例在刷新到期前保持缺席，到期后按幂等刷新键生成新实例；进程重启不能提前刷新、复用旧 ID 或重新开放旧奖励代次。
- 刷新敌人不会因为玩家静止在房间中而主动开战。

北郡 v1 不做个人位面、任务专属敌人副本或多频道分流。命名敌人暂时不存在时，`look` 应显示其活动痕迹，并给出“可能稍后再次出现”的明确提示。

## 5. 不同任务状态的可见性

### 5.1 共享内容

所有同房间玩家看到相同的：

- 房间结构与出口；
- 在线玩家进入、离开和断线后的存在变化；
- 共享敌人的出现、生命档位、公开意图、击败与刷新；
- 对所有人都成立的天气和静态环境事实。

### 5.2 角色私有内容

以下内容按查看者的角色状态生成：

- NPC 是否有可接、进行中或可交付任务；
- NPC 的任务对话、目标提示和知识揭示；
- 任务日志、计数、奖励预览与完成结果；
- 个人掉落和个人可交互任务物；
- 由该角色知识标记改变的非结构化房间描述。

一名玩家接取或交付任务时，其他人最多看到“该玩家与 NPC 交谈”的通用动作，不广播任务标题、剧情揭示或奖励。另一名玩家完成任务不会改变你的前置或 NPC 对话。

北郡 v1 不允许角色私有状态改变房间出口。若任务需要调查同一静态物体，每名有对应任务的角色都可独立调查一次，并以 `(characterId, objectiveId, objectId)` 去重。

## 6. 退出、断线与重连

### 6.1 持久化时点

以下操作只有在数据库事务成功后才向客户端报告成功：

- 创建角色、训练、装备变化、物品领取，以及消耗品使用与库存扣减；
- 每一次成功移动后的新房间；
- 任务接取、目标计数、交付、奖励和知识标记；
- 经验、等级、金币和个人掉落生成；
- 0 HP 的死亡状态，以及之后的简化恢复位置与资源。

因此，非战斗退出后恢复到最后一次成功移动的精确房间，不使用周期性位置近似。

魔法水成功使用的库存扣减与命令幂等结果在同一耐久事务中确定，提交后才报告成功；10 个恢复 tick 仅在提交后创建于 live 调度器。若提交后、调度或响应前进程退出，物品仍已消耗，重试返回首次成功结果，但不得补建或重复建立 timer；当前法力按最后 durable snapshot 恢复。

### 6.2 非战斗断线

- 网络断开后立即禁止该连接提交命令。
- 角色保留 30 秒重连宽限；期间显示为断线，不能自动移动、攻击、交谈或拾取。
- 30 秒内重连则替换旧连接并发送完整快照；宽限结束仍未连接则从在线房间成员中移除，持久位置不变，并把当前生命与职业资源作为最终值提交一次。
- 主动退出与非战斗网络断开没有经验、金币或物品成本。

角色持有旧战斗 `COMBAT_REWARD_PENDING` 时同样适用安全离线卸载；装载／卸载与并发排序规则见 [../multiplayer-consistency.md §9](../multiplayer-consistency.md)。

若安全离线时仍有魔法水恢复 timer，事务先持久化此前已经结算的当前法力，再取消所有未到期 tick；timer 不跨卸载恢复，水不返还。30 秒重连宽限期间 live 实例尚未卸载，tick 则按 04 的时间表继续。

### 6.3 战斗中断线

- 角色留在当前 `CombatSession`，立即从 `active_profile` 切换为 `afk_profile`。
- 它可以完成当前遭遇、受到伤害、逃离或到达 0 HP；不会暂停其他玩家或敌人。
- 当前遭遇结束后停止，不领取尚未领取的物品，不自动攻击下一名敌人。
- 若角色存活，保存当前房间与结算后的生命/资源，然后进入安全离线；若到达 0 HP，则保持死亡状态，重连后必须由玩家执行 `recover`。
- 战斗中主动关闭页面或执行退出与网络断开使用同一规则，不能借退出回滚不利结果。

被动断线的覆盖取消边界见 [04 §5.1](./04-combat-and-progression.md)；本节只补充它与 `controlEpoch` 的关系：该取消边界独立于之后是否发生新连接接管，`controlEpoch` 仍只负责阻止旧连接命令迟到执行。

### 6.4 重连快照

每次新连接接管角色时递增该在线控制绑定的 `controlEpoch`；由连接提交的命令与手动覆盖动作捕获提交时 epoch，并在真正执行前复核。旧连接的 epoch 不匹配时返回 `CONTROL_EPOCH_STALE` 且不产生状态变化，从而阻止接管前排队的旧连接命令迟到执行。服务端根据当前 profile 新选择的自动动作不携带客户端 epoch，但开始前仍须验证参与者仍受该 session 控制且 profile 未改变。

`scopeEpoch` 的生成、`(scopeEpoch, scope, serverSeq)` 去重身份与 `scopeCursors` 的处理，必须采用通用协议，见 [../multiplayer-consistency.md §4.3](../multiplayer-consistency.md)。

形成重连快照时必须采用通用协议的交接屏障：在相关 scope 读屏障内绑定新连接订阅并先把完整快照放入该连接唯一 FIFO 发送队列，才释放屏障；之后的可见增量只能排在快照之后，绑定或入队失败则整次交接作废并重连。

重发命令若命中旧 epoch 的持久幂等结果，服务端仍返回首次领域结果，但按通用协议标记 `historical/snapshotRequired`。客户端只能把它视为历史确认并使用当前完整快照，不能应用旧结果对应的事件或把旧 `serverSeq` 作为新基线。

重连成功后旧连接立即失去控制权。完整快照至少包含：

- 角色等级、经验、生命、法力/怒气、装备和背包；
- 金币、已学习／已训练动作、`sliceCompleteAt` 与派生的 `slice_complete`；
- 存活／死亡状态、持久化死亡原因、独立任务物品栏；
- 精确房间、当前可见玩家、敌人与刷新状态；
- 任务步骤、知识标记和未领取个人掉落；
- 当前自我增益、剩余战斗效果与技能冷却的展示状态（来自进程内存，见 04 §5.1）；
- 若遭遇仍在运行：`CombatSessionId`、参与者、当前目标、公开意图、最近摘要，以及当前生效的模板标识 `(class, profileKind, content_version)` 与个人战术 `tacticsRevision`（见 [05](./05-tactics-and-decisions.md)；编辑仅限脱战，战斗内战术恒定）；afk_profile 玩家不可编辑；
- 若遭遇已经结束：最终摘要、奖励结果或死亡恢复结果。
- 当前 `controlEpoch` 与全部可见 `scopeCursors[]`；每个 scope 各自携带 `scopeEpoch` 和 `serverSeq` 基线。

快照以唯一逻辑 `CharacterState` 为底：角色在线时读取 character／WorldInstance 串行上下文中的 live 实例，而不是把 PostgreSQL durable snapshot 当作另一份当前余额。非战斗回复和魔法水 tick 已经发生但尚未落库时，同进程快照与重连必须显示 live 值；只有进程崩溃恢复才回到最近 durable snapshot。角色仍为 active combat participant 时，当前生命／职业资源和战斗瞬态字段只从所属 session 的唯一运行时投影覆盖；不得读取数据库中的旧生命／资源，也不得从另一场战斗或第二份参与者快照拼装。角色退出战斗控制后不再使用该投影，读取已经按明确事务边界合并后的 live `CharacterState`。live `CharacterState` 与 durable snapshot 的通用边界、runtime projection 的合并时机见 [../multiplayer-consistency.md §9](../multiplayer-consistency.md)。

因断线设置的 AFK 状态在重连时自动解除并恢复 `active_profile`；北郡 v1 没有手动 AFK，`afk` 状态只有 `disconnect` 一种来源。

## 7. 进程崩溃与战斗检查点

### 7.1 开始检查点

创建遭遇前必须在事务中为每名初始参与者保存不可变 `CombatStartCheckpoint`：

```text
checkpointId
combatSessionId
attemptId
characterId
roomId
level
hp
manaOrRage
maxHp
maxManaOrRage
activeProfileVersion
afkProfileVersion
tacticsRevision
activeTacticsRows[]
afkResolvedActionRefs[]
createdAt
```

两个 `*ProfileVersion` 字段都必须精确等于该次 Attempt 使用的统一包级 `content_version`，只为重启／审计保留全局模板来源；它们不是可由玩家修改或独立递增的 profile 版本。`tacticsRevision` 记录该角色加入时锁定的个人 active **配置版本**，但训练迁移 ability ID 不递增它，因此不能单独充当实际动作集身份。`activeTacticsRows[]` 按本场求值顺序规范化保存 `{ ruleId, enabled, thresholdBp?, actionRef }`，`afkResolvedActionRefs[]` 按该内容版本的固定 afk 行序保存 `actionRef`；`actionRef` 必须是通用动作键或精确 `abilityId`。这两份不可变审计副本使相同配置版本下的 R1／R2 可区分，不是新的可写角色真相。上述字段都不参与 §7.1 的生命、资源或位置重基准计算，也不得在奖励事务中回写。

第二名玩家中途加入时单独保存其加入瞬间检查点。检查点写入失败则拒绝加入，战斗动作不能开始。

另行持久化、只前进不回写检查点数值的生命周期记录：

```text
CombatAttemptLifecycle
  combatSessionId
  attemptId
  state             active | reward_pending | closed
  closeReason       success | failed | enemy_escaped | process_restart | reward_abort | escape_abort | null
  closedAt
  updatedAt

CombatParticipantLifecycle
  combatSessionId
  characterId
  controlState      active | defeated | recovered | fled | closed
  unresolvedRewardEpochs
  updatedAt
```

`CombatStartCheckpoint` 永不“推进”为中途血量；正常结束、失败重置、死亡、逃离、恢复与奖励等待都只更新生命周期。战斗控制停止时，无冻结奖励的 attempt 直接进入 `closed` 并清理对应 `COMBAT_REWARD_PENDING`；有未决冻结奖励的 attempt 进入 `reward_pending`，不能重开，在对应事务全部进入终态并清理 pending 后才进入 `closed`。

`CombatParticipantLifecycle` 的转换固定为：0 HP 时 `active -> defeated`；幂等恢复时 `defeated -> recovered`；成功逃离事务原子写入目的房间与完成瞬间运行时生命／资源后，才执行 `active -> fled` 并丢弃投影，既有未决 reward lock 不受此转换清除。仍为 active 的参与者只在正常 `success`／`enemy_escaped` 最终事务、`process_restart` 恢复事务或 `reward_abort`／`escape_abort` 中止事务内转为 `closed`；同一事务必须保存其规则要求的最终房间和生命／资源，并清空该 attempt 的 `unresolvedRewardEpochs`。`defeated`、`recovered`、`fled`、`closed` 都是需要保留的历史处置状态，其中只有 `defeated` 还能经玩家命令转为 `recovered`；不为统一外观把其余状态互相改写。因此最终敌人已经 0 HP、或最后 Young Wolf 处于 `escape_committing` 但终态事务未提交的 `resolving` 窗口中，存活 participant 仍为 active、仍受本场控制。

若同一 attempt 中已经提交的较早敌人奖励使 active 角色升级，恢复不能抹掉该永久收益。v1 没有战斗内换装或其他永久最大值来源，因此活动角色的重基准恢复值固定为：

```text
restoredHp = min(currentMaxHp, checkpoint.hp + max(0, currentMaxHp - checkpoint.maxHp))
restoredMana = min(currentMaxMana, checkpoint.manaOrRage + max(0, currentMaxMana - checkpoint.maxManaOrRage))
restoredRage = checkpoint.manaOrRage
```

也就是说，检查点的房间和战斗前损耗仍是回滚基线，但已经提交的升级最大值／当前值增量必须重放；不得把等级、最大值保留却把对应 current-value 增量静默撤销。

背包、装备、经验、任务、金币和个人掉落本身已经独立持久化，不从战斗检查点回滚。

加入战斗时还按 04 §5.1 捕获不持久化的 `TransientCombatCheckpoint`。同进程发生 `reward_abort`／`escape_abort` 时，active 角色的持久生命／资源在中止事务中按上述公式恢复；提交后以当前时刻恢复该内存快照：只保留尚未自然到期的加入前自我 aura 与 ability 专属冷却，删除本 attempt 新建效果，把本 attempt 对旧效果的刷新还原到原绝对到期时间。进程崩溃时该内存快照与所有此类效果一起丢失，不参与 §7.2 的恢复。

### 7.2 崩溃恢复

应用重启时根据持久化生命周期分类恢复，不恢复逐毫秒战斗时间线：

1. 清除施法、挥击、威胁、接战、临时状态、进程内自我 aura／ability 专属冷却及未结算意图；
2. 只有 `controlState = active`、崩溃时仍受该 session 控制的参与者，才把房间恢复到开始检查点，并按 §7.1 的重基准公式恢复生命和法力／怒气；
3. `controlState = defeated` 的参与者保持已持久化死亡状态，重启不得自动复活，重连后仍须幂等 `recover`；
4. `controlState = recovered | fled | closed` 的参与者保持当前权威角色状态，绝不回写检查点中的旧位置、生命、资源、装备或其他字段；
5. 对未提交的冻结奖励和仍存活敌人的未冻结资格，不补造结果；关闭旧资格、清除相应 `COMBAT_REWARD_PENDING`，并把未关闭的 attempt 记为 `closed/process_restart`；
6. 尚未提交终态的敌人保留原来仍为 `active` 的 `SpawnInstanceId/RewardEpoch`，回满生命并返回 `idle`；旧运行时 `EnemyParticipant` 直接作废，在恢复日志中归类为 `reset_detached`，不要求比较已经不存在的 runtime owner。启动时不预建 `AttemptId`，下一次合法攻击才创建新 session/attempt。已提交终态的实例按持久化 `respawnEligibleAt` 保持缺席或刷新；
7. 已提交的敌人击败、经验、任务计数、任务物品、金币、个人掉落与终态 `RewardEpoch` 保持不变；
8. 已提交消耗的物品不返还；未提交的内存结果不补造；
9. 玩家首次重连时按自身分类看到固定摘要：活动者说明已按已提交升级重基准回到开始检查点，死亡者说明仍待恢复，已恢复或已逃离者说明其已提交状态保持不变。

步骤 2、5 以及把所有仍为 active 的 participant 置为 `closed`，必须在每个 attempt 的同一恢复事务中提交；提交前不接受玩家命令。这样进程不能留下“attempt 已关闭但角色尚未重基准”或仍为 active 的孤儿 participant。只有本场全部敌人都已是持久化终态、所有冻结奖励事务均已提交时，遭遇才视为正常结束；单个非最终敌人已提交只保留该敌人的结果，其余未完成部分仍按上述分类恢复。若最后一笔事务已提交但成功响应尚未发送，重连快照直接显示首次提交结果。

### 7.3 玩家承担的成本

| 情况 | 玩家成本 |
|---|---|
| 非战斗断线/重连 | 无；恢复最后一次成功移动与提交状态 |
| 战斗断线但进程仍在 | 战斗继续，可能消耗资源、失败或死亡；不能回滚 |
| 0 HP | 保持死亡直到执行 `recover`；成功后满生命/资源回修道院庭院；无经验/金币/装备损失 |
| 进程在战斗中崩溃 | 未完成尝试的时间与已提交消耗品；活动参与者的位置回开始检查点，生命／资源按已提交升级重基准恢复，已完成 `recover` 的奖励等待者保持庭院恢复状态 |
| `reward_abort`／`escape_abort` | 已提交的敌人结果和消耗品不回滚；active 角色按重基准检查点恢复生命／资源，并按加入时瞬态检查点恢复仍未到期的旧自我 aura／ability 专属冷却；失败 attempt 内新建或延长的效果不保留 |
| 奖励提交后响应丢失 | 无额外成本；重连或重试返回首次提交结果 |

## 8. 奖励事务与幂等

单个 `EnemyParticipant` 第一次到达 0 HP 后进入自己的 `resolving`，并冻结 `eligibleRecipients` 与 `zeroHpEventSeq`。同场多个敌人严格按 `(zeroHpEventSeq, SpawnInstanceId)` 排成串行结算队列；每个 `(SpawnInstanceId, RewardEpoch)` 分别用一个数据库事务完成：

1. 条件把 `(SpawnInstanceId, RewardEpoch)` 从 `active` 关闭为 `defeated`，并在同一事务写入 `terminalAt` 与按 02 计算的 `respawnEligibleAt`；
2. 写入敌人击败记录；
3. 为每名合格角色写入唯一经验记录；
4. 为有对应目标的角色写入唯一击杀计数，或把任务物直接写入任务物品栏并同步推进收集目标；
5. 生成并持久化每名角色的铜币与非任务 `PersonalLoot(pending)`；
6. 写入必要摘要索引与 attempt 生命周期；在正常清空敌人的路径中，只有本场所有敌人均为终态时才在同一最终事务关闭整个 session、把仍为 active 的 participant 置为 `closed`、保存其最终生命／资源并清空该 attempt 的 `unresolvedRewardEpochs`。玩家方失败路径另按 04 §9 关闭并重置存活敌人。

事务按较小 `characterId` 顺序取得角色锁，并同时取得对应 character／WorldInstance 串行执行权；在执行权内读取当前逻辑 `CharacterState`：live 实例已存在就直接使用，不存在则从该事务已锁定的最新 durable snapshot 唯一装载，绝不能并行创建第二份。随后合并经验、任务进度、任务物品、铜币、`PersonalLoot` 和由升级产生的最大值／当前值增量。对于不再 active 的 recipient，同一事务还必须把合并后的当前生命／资源及其他变更写入 durable snapshot；角色仍离线时提交后可再次卸载。它绝不能从数据库旧快照覆盖现有 live 中尚未落库的脱战回复或魔法水恢复，也不得用加入战斗时或 0 HP 时的参与者快照覆盖当前房间、装备或背包；尤其不能覆盖已经 `recover` 后的庭院状态或结算等待期间的装备变化。`defeated`、`recovered`、`fled` 与 `closed` recipient 不读取旧 combat runtime，而是在当前逻辑 `CharacterState` 上应用升级：存活者的当前生命／法力增加本次正向最大值差并封顶；`defeated` 的生命保持 0，但法力仍增加本次 `levelUpManaDelta` 并封顶；怒气保持当前值，其他状态字段不变。

对非最终敌人，若奖励使仍在战斗的 active participant 升级，事务提交后必须在同一 WorldInstance 队列继续处理下一事件前，把本次等级、最大值和当前值增量同步到运行时投影。只有关闭 session 时仍为 active 的 recipient，最终敌人事务才以奖励应用前一刻的战斗运行时值为基线，并在同一提交中写入：

```text
persistedHp   = min(newMaxHp, runtimeHpBeforeReward + levelUpHpDelta)
persistedMana = min(newMaxMana, runtimeManaBeforeReward + levelUpManaDelta)
persistedRage = runtimeRageBeforeReward
```

其中 `levelUpHpDelta`／`levelUpManaDelta` 只包含本次奖励造成的正向升级差值。该事务同时把 active participant 置为 `closed`；提交后不得再用旧运行时值覆盖升级结果，也不得先写入旧 `CharacterState` 再补一次非原子的升级。非最终、最终 active 和最终 non-active 三条路径都必须使数据库和运行时只呈现各自规则下的同一个升级后结果。

唯一键至少覆盖：

```text
(SpawnInstanceId, RewardEpoch, characterId, rewardKind, rewardSlot)
(SpawnInstanceId, RewardEpoch, characterId, questRunId, objectiveId)
(actorId, commandId)
```

- 事务提交前失败：该敌人的整笔奖励事务回滚，不广播其击败或奖励；对应 `EnemyParticipant` 保持 `resolving`，并以同一冻结快照、随机结果和幂等键重试。默认总提交预算为 3 次；队列中后续敌人不得越过失败目标提交。若本场仍有其他存活敌人，战斗时间线可以继续，但新产生的结算只追加在队尾。
- 提交预算耗尽后停止整个战斗时间线并进入 `reward_abort`。幂等中止事务必须原子按 §7.1 重基准写回仍受本场控制的 active 角色、把这些 participant 置为 `closed`、关闭 attempt 为 `reward_abort`、丢弃未提交冻结奖励，并清理全部对应未冻结资格、`unresolvedRewardEpochs` 与角色 reward lock；`defeated` 保持死亡，`recovered`、`fled`、已关闭角色及已经提交的敌人奖励均不回滚。该事务提交前 session 与仍归它所有的实例保持锁定，第三方不能提前认领，也不得广播终局。提交成功后才恢复 `TransientCombatCheckpoint` 的内存 aura／ability 专属冷却、丢弃旧战斗投影，并对存活或未提交终态敌人逐个比较 `currentCombatSessionId`：仍等于旧 session 的以原 `SpawnInstanceId/RewardEpoch` 重置为底层 `idle` 并把旧 participant 标记为 `reset_detached`；已经脱离、归属为空或被新 session 认领的实例一律忽略。最后恰好广播一次中止摘要；响应丢失后的重试返回首次结果，不重复摘要或领域写入。
- 事务已提交但响应前崩溃：重试命中原结果，不能再次计算随机掉落或再次加任务计数。
- 广播只能发生在提交之后。客户端看到的临时伤害不代表已经获得永久奖励。
- 对已经 `resolving`、`escape_committing`、`defeated` 或 `abandoned_no_reward` 的敌人继续攻击，返回稳定拒绝，不产生新代次。

## 9. 验收标准

本文件规则的验收断言与边界用例见 [07 §5／§6](./07-acceptance-and-playtest.md)。
