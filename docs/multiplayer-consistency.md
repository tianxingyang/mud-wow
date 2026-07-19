# 多人交互与一致性设计

> 状态：通用一致性基线；北郡 v1 特例由 v1 设计包冻结<br>
> 适用范围：TypeScript 模块化单体权威服务端、单进程部署、少量玩家共享世界  
> 目标：在不引入分布式系统复杂度的前提下，保证战斗、拾取及后续交易／组队结果可解释、不可重复执行，并能从断线和进程故障中恢复。

北郡 v1 的全部玩法语义以[北郡 v1 可执行设计包](northshire-v1/README.md)为唯一权威，其中双人 CombatSession、完整个人击杀经验、个人掉落与恢复规则由[多人与恢复规格](northshire-v1/06-multiplayer-and-recovery.md)负责。本文只提供通用工程机制；竞争拾取、交易、正式组队、跨 CombatSession 治疗与战斗合并均为后续阶段，不能被 v1 隐式继承。

## 1. 核心结论

“单体”只表示服务端以一个进程和一个部署单元运行，不表示单机或单玩家。所有玩家连接同一个权威服务端，共享同一份世界状态；玩家客户端只提交操作意图，不能直接写入角色、房间、战斗或物品状态。

系统采用三条一致性原则：

1. **作用域内单写者：**同一房间、野外区域或副本实例中的命令进入同一串行队列；后续交易、队伍也分别使用自己的聚合队列。
2. **持久变更原子提交：**金币、物品、任务进度，以及后续队伍成员等跨表修改必须在一个数据库事务内完成，提交后才向客户端确认成功。
3. **命令可安全重试：**每个会改变状态的命令都带幂等键。断线、超时或“已提交但响应丢失”时，客户端重发不会造成重复拾取、扣款或奖励。

一致性只在必要的作用域内建立，不设计全服全局总顺序。例如，同一副本内的战斗事件有确定顺序，但两个互不相关的副本不需要比较谁先发生。

## 2. 权威边界

服务端负责：

- 判断玩家当前是否可以执行命令；
- 计算移动、命中、伤害、仇恨、掉落和任务进度；
- 决定同一作用域内事件的先后顺序；
- 维护物品唯一归属、金币余额，以及后续启用的队伍关系；
- 生成客户端可展示的状态快照与事件。

客户端负责：

- 收集玩家输入并提交命令；
- 展示服务端快照和事件；
- 在响应超时后以同一个 `commandId` 重试；
- 发现事件序号缺口时请求补发或完整同步。

客户端发来的角色 ID、伤害值、物品所有权、位置和时间戳都不能作为裁决依据。角色身份来自已认证会话，命令载荷只包含意图所需的目标和选项。

## 3. 连接与会话

连接、登录会话和角色是三个不同概念：

| 标识 | 生命周期 | 用途 |
|---|---|---|
| `connectionId` | 一次网络连接 | 收发消息、统计连接状态 |
| `sessionId` | 一次认证会话，可跨重连 | 鉴权、命令序号、恢复连接 |
| `accountId` | 持久存在 | 认证主体及角色创建等账号级操作 |
| `characterId` | 持久存在 | 游戏状态与权限主体 |
| `controlEpoch` | 角色控制权的一次绑定代次 | 阻止旧连接已排队命令在新连接接管后执行 |

基本规则：

- 建立连接后先认证，再绑定角色；业务命令不得自行声明执行者。
- 一个角色同一时刻只允许一个活动控制连接。新连接成功接管或控制权被显式撤销时，服务端递增 `controlEpoch`，旧连接立即失去控制权。
- 命令入队时由服务端附上当前 `controlEpoch`，开始执行前必须再次比对；代次已变化则以稳定错误码取消，不能进入领域逻辑。
- 网络断开只解除连接绑定，不立即删除角色或终止其所在实例。
- 恢复连接时，客户端提交恢复凭据；MVP 以服务端完整快照恢复为基线，不要求保留并补发离线期间的完整事件流。
- 恢复凭据必须短期有效、可撤销，并通过安全随机数生成；不能只依赖可猜测的角色 ID。

每个命令类型必须在协议注册表中固定声明执行者作用域，服务端在鉴权后派生稳定的 `actorId`：

- 角色创建等尚未绑定角色的账号级命令使用 `account:{accountId}`；
- 移动、战斗、任务、资产等角色级命令使用 `character:{characterId}`；
- `actorId` 绝不使用会随重连变化的 `sessionId`／`connectionId`，也不接受客户端载荷声明。相同 `commandId` 只有在同一 actor 命名空间内才表示同一次命令。

断线不会把状态裁决权交给客户端，断线角色也不能继续提交新操作。产品规则已经确定：服务进程仍运行时，角色使用 afk_profile 继续当前 CombatSession；战斗结束后停止并进入安全退出，不自动加入下一场战斗。战斗中断线接管是北郡 v1 的完成硬条件（见切片契约 §7.4 与 [07 §11.1](northshire-v1/07-acceptance-and-playtest.md) 的 P0 硬门槛）；实现顺序上它依赖持久战术先行落地，但不得从首切片范围中移除。宽限时间等参数不写入通信协议。

运行时 afk 状态区分 manual 与 disconnect。恢复连接时自动清除 disconnect 并恢复 active_profile；manual 必须由玩家显式解除。北郡 v1 只实现 disconnect 来源，manual 留给后续阶段。

`controlEpoch` 只裁决连接接管与显式撤权。北郡 v1 已在 [04 §5.1](northshire-v1/04-combat-and-progression.md) 冻结被动断线边界；该边界中的覆盖取消不得实现为一次连接接管或 `controlEpoch` 变化。

## 4. 命令与事件协议

协议不绑定具体 Web 框架或传输库。北郡 v1 使用 HTTP + WebSocket；相同消息结构也可用于测试或未来其他传输适配器。

### 4.1 命令 envelope

```ts
type CommandEnvelope<T> = {
  protocolVersion: 1;
  commandId: string;       // 客户端生成的唯一幂等键
  clientSeq: number;       // 当前会话内单调递增，用于发现乱序或缺口
  type: string;            // 例如 combat.cast、loot.claim
  scopeHint?: string;      // 仅用于路由提示，服务端必须重新验证
  payload: T;
};

// 示例：执行者来自认证会话，不在 payload 中传入
{
  protocolVersion: 1,
  commandId: "01J...",
  clientSeq: 42,
  type: "combat.cast",
  payload: { abilityId: "ability_mage_fireball_r1", targetId: "mob-17" }
}
```

在查询命令注册表之前先做 envelope 解析、`protocolVersion`、已知 `type` 与该类型 payload Schema 校验。未知类型没有 actor／主结果 scope，因此这类预路由失败不伪造普通 `CommandResult`：

```ts
type ProtocolErrorResult = {
  commandId?: string; // 只有成功解析时回显
  status: "protocol_error";
  code: "MALFORMED_ENVELOPE" | "UNSUPPORTED_PROTOCOL_VERSION" | "UNKNOWN_COMMAND_TYPE" | "INVALID_PAYLOAD" | "COMMAND_ID_REUSE_CONFLICT";
  retryable: false;
};
```

`ProtocolErrorResult` 没有 `firstResult`／`delivery`，也不进入领域逻辑或控制权校验。前四个错误发生在查询幂等记录之前，不检查 `clientSeq`、不创建持久幂等记录，也不占用该 `commandId`；客户端修正请求时必须使用新 envelope，重复同一无效输入得到同一稳定错误码。

`COMMAND_ID_REUSE_CONFLICT` 只用于已通过预路由校验、已派生 actor，且 `(actorId, commandId)` 已被另一份有效类型或规范化载荷占用的请求。它同样 `retryable = false` 且不带原命令的 `firstResult`／`delivery`，不得返回或泄漏原领域结果，也不得创建、替换或修改既有幂等记录。客户端若要表达新的业务意图必须换新 `commandId`；只有重发与首次记录完全相同的原始 envelope 才能取回首次普通 `CommandResult`。

命令注册表除命令类型外，还必须固定声明第 3 节的 actor 作用域，并引用 Application public use-case descriptor 中唯一的 `resolveScopes` 与 `primaryResultScope` resolver；Ingress 不能再维护第二份 scope 规则。无事件拒绝也使用该主结果作用域；需要多个串行键或事务范围的命令仍只能选择一个主结果作用域，其他作用域的变化通过各自事件与快照表达。`scopeHint` 不能决定主结果作用域。

服务端必须先以认证绑定取得 `actorId` 并查询 `(actorId, commandId)`，再决定是否检查 `clientSeq`：

1. 若幂等记录已存在或首次处理仍在执行，同一命令类型与规范化载荷返回或等待首次结果；
2. 同一键但类型或载荷不同，返回 `ProtocolErrorResult(code = COMMAND_ID_REUSE_CONFLICT, retryable = false)`；既有首次记录保持不变；
3. 只有全新的 `commandId` 才校验 `clientSeq` 是否过旧、重复或明显乱序，并继续控制权与领域校验。

因此，网络重试必须复用原始完整 envelope，包括原 `commandId`、`clientSeq`、命令类型与载荷；命中幂等记录后不能再以旧 `clientSeq` 拒绝它。如果玩家真的再次施放技能，则生成新的 `commandId` 与新的 `clientSeq`。

通过预路由并取得 actor／主结果 scope 后，`clientSeq` 或执行前第二次 `controlEpoch` 校验产生的稳定取消属于普通 `CommandResult(status = rejected)`：它在 Scope Executor 执行权内通过 Application 的拒绝收口路径持久化首次结果，但不进入领域逻辑。这样同一旧命令再次重试只返回原拒绝，不会在新的控制代次下重新执行。只有第 4.1 节定义的预路由失败使用无 `firstResult` 的 `ProtocolErrorResult`。

通用战斗命令词汇可区分 combat.start、combat.overrideAction、combat.setReaction、tactics.update、combat.retreat、combat.flee 和 presence.setAfk。北郡 v1 注册 `tactics.view`／`tactics.update`（仅脱战、只支持 [v1 05](./northshire-v1/05-tactics-and-decisions.md) 的受限操作集），明确不注册 `combat.retreat`、`combat.setReaction` 或手动 AFK；未注册类型按预路由协议返回 `UNKNOWN_COMMAND_TYPE`。combat.cast 若保留，其语义是把技能放入下一合法动作覆盖槽，而不是立即结算伤害。

新的覆盖命令应返回被它替换的待执行 commandId。重试旧 commandId 只能返回原结果，不能把已被替换或消费的动作重新放回覆盖槽。

### 4.2 命令结果

```ts
type CommandResult = {
  commandId: string;
  status: "accepted" | "rejected";
  code?: string;           // 稳定机器码，例如 TARGET_GONE
  firstResult: {
    scope: string;
    scopeEpoch: string;    // 首次处理时的运行代次
    serverSeq: number;     // 首次处理后的事件位置
  };
  delivery: {
    historical: boolean;
    snapshotRequired: boolean;
  };
  revision?: number;       // 交易、队伍等聚合的版本
};
```

拒绝属于正常业务结果，例如目标已死亡、背包已满或交易版本过期。客户端根据稳定错误码刷新界面，不能依赖错误文字解析逻辑。

`firstResult.scope` 固定为命令注册表解析出的首次 `primaryResultScope`，`firstResult.scopeEpoch` 是该作用域当时的代次，`firstResult.serverSeq` 是首次裁决完成后该作用域的游标；即使拒绝没有产生事件，仍记录未递增的裁决后游标。持久幂等记录保存规范化原命令、领域结果及不可改写的 `firstResult`。

Scope Executor 在持有全部所需执行权时创建对外不可见的 cursor reservation。Application 形成领域 decision 和 pending events 后，只通过传入的 `ExecutionLease` 为每个受影响 scope 暂存连续事件序号，并以主结果 scope 的裁决后游标取得不可变 `firstResult`，再把它与业务变化写入同一 Unit of Work。commit 后 Executor 才安装全部 reservation 并交给 Scope Stream 发布；rollback 或唯一冲突会全部丢弃，不推进可见 cursor、也不留下序号缺口。若主结果 scope 没有事件，无事件拒绝等结果使用该 scope 当前未递增游标。已经持久化的 `firstResult.serverSeq` 永不在提交后或重放时重新计算。

`delivery` 在每次送达时由 Scope Stream 根据当前 scope epoch、存在性和客户端可见基线构造。首次结果所在作用域仍处于同一 epoch 时，`historical = false`、`snapshotRequired = false`。若该作用域已重建、消失或不再是客户端当前可见基线，仍返回原 `status`／`code`／`firstResult`，但设置 `historical = true`、`snapshotRequired = true`。幂等 replay 只跳过 Scope Executor 排队和领域逻辑，不能由 Ingress 绕过这条只读 delivery 路径。客户端只能把它当作“旧命令已经有结果”的历史确认，必须请求或使用携带 `scopeCursors[]` 的当前完整快照；不得应用旧结果对应的增量，也不得把旧 `serverSeq` 设为任何当前作用域的基线。

战斗覆盖动作使用 `queued → started → resolved | cancelled | replaced` 生命周期。命令返回 accepted 只表示意图已经进入或替换权威覆盖槽，不表示技能已经命中；queued 阶段不扣资源或触发冷却。动作开始时重新校验并扣除成本，之后目标失效等规则结果不退还已经支付的成本。动作真正执行、失效或被替换时，通过后续结构化事件通知客户端。

### 4.3 服务端事件

```ts
type ServerEvent<T> = {
  scope: string;           // 例如 instance:westfall-3 或 trade:abc
  scopeEpoch: string;      // scope 重建或进程重启时改变
  serverSeq: number;       // 在 scope 内严格递增
  causedBy?: string;       // 触发它的 commandId；计时器事件可省略
  type: string;
  payload: T;
};

type ScopeCursor = {
  scope: string;
  scopeEpoch: string;
  serverSeq: number;
};
```

客户端按 `(scopeEpoch, scope, serverSeq)` 去重并应用事件。`serverSeq` 只在同一 `(scopeEpoch, scope)` 内严格递增；服务进程重启或作用域重新创建时，该作用域必须产生新 epoch。完整快照不使用单数全局游标，而是携带当前全部可见作用域的 `scopeCursors[]`；客户端逐 scope 比较，发现某项 epoch 改变时只丢弃该作用域旧增量基线并从快照继续。发现同一 epoch 内的序号缺口时暂停该作用域的增量应用并请求同步。事件的发送顺序不能改变数据库提交结果；持久操作必须先提交，再广播。

## 5. 串行执行模型

### 5.1 序列化键

命令路由器根据服务端当前状态计算序列化键，将同一键的命令按进入服务端队列的顺序执行：

| 操作 | 主要序列化键 |
|---|---|
| 移动、房间交互、战斗、拾取 | `instance:{instanceId}` |
| `[later]` 队伍邀请、加入、退出、队长变更 | `party:{partyId}` |
| `[later]` 交易修改、确认、提交 | `trade:{tradeId}` |
| 不依赖所在实例的角色操作 | `character:{characterId}` |

一个 `instance` 是一段由同一执行上下文管理的共享世界，可以是野外区域、房间组或副本；不要求每个文字房间都创建线程。副本内的玩家、敌人、施法、仇恨、掉落和计时器都归同一实例队列管理，因此不会出现两个线程同时修改同一场战斗。

### 5.2 跨作用域操作

应优先设计聚合边界，让一次命令只有一个主要序列化键。确实需要同时修改多个作用域时，在单进程内按稳定字典序取得相关执行权，并在一个数据库事务中完成修改；完成或失败后立即释放，不在持有期间调用 AI 或外部服务。

例如角色跨实例移动，需要同时协调源实例、目标实例和角色位置：

1. 验证源实例仍拥有该角色；
2. 在目标实例预留进入资格；
3. 原子更新持久位置，并在内存中完成所有权交接；
4. 提交后分别向源、目标实例广播离开与进入事件。

首版只有一个进程，因此不需要两阶段提交、分布式锁或跨节点租约。只要所有状态写入都经过统一命令路由器，进程内的稳定加锁顺序即可避免死锁。

### 5.3 事件排序

- 外部命令进入服务端时记录单调时钟 `ingressAt` 和递增的 `ingressSeq`；客户端时间戳不参与胜负裁决。
- 处理 `ingressAt = T` 的外部命令前，实例必须先结算所有 `dueAt <= T` 的内部事件。若 `dueAt == ingressAt`，内部事件优先，因此截止时刻才到达的打断视为过晚。
- 同一 `dueAt` 的内部事件按 `(dueAt, priority, eventSeq)` 稳定排序；同一 `ingressAt` 的外部命令按 `ingressSeq` 稳定排序。
- 同一网络连接内的帧顺序可用于正常传输，但正确性不能依赖连接永不重建。
- 计时器回调只能唤醒实例队列，不能直接修改战斗对象；即使回调晚到，也必须按原 `dueAt` 与上述规则结算，不能按回调抵达时间改写先后。
- 不同作用域之间不提供全局顺序；需要组合展示时，客户端只能把时间视为展示信息。

## 6. 数据库事务与约束

串行队列防止进程内的并发写冲突，数据库事务和唯一约束防止重试、程序错误以及未来扩展造成重复结果。两者缺一不可。

必须事务化的操作包括：

- 物品或金币在角色、商人之间转移；后续启用邮件、交易时同样适用；
- 掉落领取及其进入背包；
- 任务奖励、经验和任务状态变更；
- 敌人进入已击败状态、终结其 `RewardEpoch`、写入可信墙钟 `respawnEligibleAt` 与奖励记录，以及发放经验、任务进度、掉落并推进独立战斗 lifecycle；不可变的 `CombatStartCheckpoint` 不得在奖励事务中更新；
- `[later]` 队伍成员加入、退出和队长变更；
- 角色死亡时的持久惩罚与位置更新。

推荐由数据模型直接表达的不变量：

- 每个物品实例同一时刻只有一个所有者或容器位置；
- 同一个掉落槽位只能成功领取一次；
- `[later]` 角色在同一时刻最多属于一个普通队伍；
- 金币余额不能小于零；
- `[later]` 一笔交易只能从待处理状态进入一次已完成状态；
- `(SpawnInstanceId, RewardEpoch, characterId, rewardKind, rewardSlot)` 在奖励记录中唯一；任务目标另以 `(SpawnInstanceId, RewardEpoch, characterId, questRunId, objectiveId)` 去重；
- 已终结的 `RewardEpoch` 永远不能再次产生奖励；
- `(actorId, commandId)` 在幂等记录中唯一。

持久操作的标准顺序是：读取并验证当前版本 → 在事务内写入全部结果和幂等记录 → 提交 → 更新或确认内存投影 → 返回结果并广播。若提交失败，不能广播成功事件。

## 7. 典型交互

### 7.1 战斗

1. `combat.cast` 被路由到角色当前所在实例。
2. 命令先进入覆盖槽；动作从 queued 进入 started 时，实例队列依次重新验证控制代次、存活、目标可达性、接战条件、资源、冷却和控制状态，并在此时扣除成本。
3. 服务端计算结果并更新内存中的施法、生命、仇恨和冷却。
4. 若本次动作没有使敌人到达 0 HP，实例可以递增 `serverSeq` 并广播已裁决的普通非终态战斗事件。
5. 若本次动作使敌人第一次到达 0 HP，内存态只进入 `resolving`、冻结资格并排入逐敌结算队列；此时不得广播 `defeated`、奖励或 RewardEpoch 终态成功事件。
6. 结算事务将 `SpawnInstanceId` 标记为已击败、终结当前 `RewardEpoch`、写入可信墙钟 `respawnEligibleAt` 与唯一奖励记录，并在角色锁内读取当前 `CharacterState` 后只合并经验、任务、掉落和升级增量；不得用旧战斗投影覆盖之后提交的位置、装备、背包、生命或职业资源。事务同时更新独立战斗 lifecycle，不可变的开始检查点保持原值。只有提交成功后，才递增相应序号并广播公开击败事件及各角色私有奖励事件。

两个玩家同时攻击残血敌人时，以实例队列的处理顺序裁决。后处理的攻击若目标已经进入 `resolving` 或 `defeated`，会得到稳定拒绝结果，不会再次生成经验或掉落。

### 7.2 拾取

1. `loot.claim` 进入掉落所在实例队列。
2. 验证角色有拾取资格、掉落仍存在且背包可容纳。
3. 在同一事务中条件更新“未领取”掉落槽位、创建或转移物品，并写入幂等结果。
4. 提交后移除内存掉落；PersonalLoot 结果只通知所属角色，后续共享掉落才向有资格的可见玩家广播公开状态。

北郡 v1 的 PersonalLoot 只允许所属角色领取，不存在玩家间竞争；断线／AFK 不会自动领取、放弃或改变 pending 状态，同一角色重复领取仍由唯一约束与幂等结果保护。若后续启用竞争拾取，只有第一个事务能将共享槽位从“未领取”改为“已领取”，另一方收到 `LOOT_ALREADY_CLAIMED`。若获胜方因响应丢失而重试，服务端返回首次结果，不再创建物品。

### 7.3 `[later]` 交易

交易是独立聚合，包含参与者、双方报价、确认状态和 `revision`：

- 任一方增删物品或金币都会增加 `revision`，并清除双方确认；
- 确认命令必须携带自己看到的 `revision`，版本过期则拒绝；
- 双方在相同版本确认后才可提交；
- 提交事务重新验证物品所有权、金币余额、背包容量和交易状态，然后原子转移全部资产并标记完成；
- 提交成功后才向双方广播完成，交易不能部分成功。

交易过程中不需要锁住玩家背包很长时间。最终提交以数据库中的当前所有权为准；验证失败时交易保持未完成或转为取消。

### 7.4 `[later]` 组队

邀请创建一次性邀请记录；接受邀请进入目标队伍的串行队列。事务中重新检查邀请有效性、队伍容量、申请者当前队伍和版本，并依靠唯一约束保证一个角色不会同时加入两个队伍。

队长转让、踢出和退出也通过队伍队列处理。队伍变化提交后，各成员所在实例只接收结果通知，不分别修改队伍真相，从而避免多个房间各持有一份可写队伍状态。

## 8. 幂等与重试

所有会改变持久状态的命令必须保存处理结果。推荐以 `(actorId, commandId)` 查询幂等记录：

- 首次处理：执行业务事务，并在同一事务内保存成功或确定性拒绝结果；
- 重复处理中：同一键仍在执行时，等待首次处理结束；
- 已处理：返回原结果，不再次进入领域逻辑；
- 同一键但命令类型或载荷不同：拒绝为协议错误，避免错误复用幂等键。

北郡 v1 的“重复处理中”等待只使用当前进程内的 promise／future 合并并发首次请求，不在业务事务外持久化可被误认为完成结果的占位。Ingress 可以先查询已经提交的记录；lookup miss 后，Application 必须在业务 Unit of Work 内再次依靠 `(actorId, commandId)` 唯一约束，并把领域变化与 ExecutionLease 已分配的首次结果原子写入。事务回滚时清除进程内等待项并丢弃 cursor reservation，不留下持久首次结果或序号缺口；唯一冲突时同样丢弃 reservation，再读取已经提交的首次结果。只有 commit 成功后，Scope Executor 才能安装 reservation，Scope Stream 才能发布永久成功；replay delivery 仍按第 4.2 节使用当前 scope 状态重算。

这项查询发生在新命令的 `clientSeq` 检查之前。重试必须带回原始完整 envelope；只要类型与规范化载荷一致，服务端返回首次结果，不因旧 `clientSeq` 再次拒绝。

持久记录中的 `actorId` 使用第 3 节的稳定账号／角色命名空间，因此重连不会改变去重键。相同 `commandId` 在不同 actor 命名空间中互不碰撞；命令类型不能在首次处理后改变其 actor 作用域。

短暂且无持久副作用的命令可只在会话生命周期内缓存去重结果；拾取、购买、奖励，以及后续交易完成等经济与进度操作必须持久去重。幂等记录可以按业务保留期归档，但在客户端可能重试的窗口内不能删除。

数据库的条件更新和唯一约束仍是最终防线，不能因为已有命令去重就省略。

## 9. 内存状态与持久状态边界

| 状态 | 首版存放 | 崩溃后的语义 |
|---|---|---|
| 账号、角色基础属性、装备、背包、金币 | 数据库 | 完整恢复 |
| 任务状态、经验、已领取奖励 | 数据库 | 完整恢复，不重复奖励 |
| Spawn lifecycle、终结的 RewardEpoch 与 `respawnEligibleAt` | 数据库 | 按可信墙钟决定何时刷新，不因重启提前开放 |
| `[later]` 队伍成员与队长 | 数据库 | 完整恢复；短期邀请可失效 |
| 物品归属 | 数据库 | 完整恢复、原子一致 |
| `[later]` 已完成交易 | 数据库 | 完整恢复、原子一致 |
| 角色位置或安全检查点 | 数据库；北郡 v1 冻结为每次成功移动后提交（见 [06 §6.1](northshire-v1/06-multiplayer-and-recovery.md)），周期检查点留给后续阶段评估 | 恢复到最后提交的位置 |
| 连接、在线状态、房间订阅 | 内存 | 重连时重建 |
| 当前施法、仇恨、短冷却、临时增益 | 内存 | 不承诺逐帧恢复 |
| 活跃战斗和短期 NPC 状态 | 内存 | 按战斗 lifecycle 分类恢复并重置遭遇；不逐事件恢复 |
| 服务端维护的全局 profile 模板解析结果、每角色个人战术配置（`tacticsRevision`）及该角色固定 afk 已解析动作引用、不可变 `CombatStartCheckpoint`、独立战斗 lifecycle 与最近未读摘要 | 数据库 | 全局模板身份使用 `(class, profileKind, content_version)`，只随内容包版本变化；[05](northshire-v1/05-tactics-and-decisions.md) 定义的编辑只改 active 个人战术配置并在实际变化时递增 `tacticsRevision`。开始检查点另存规范化 active 配置行与 afk 已解析动作引用以标识实际 R1／R2，奖励事务只能推进 lifecycle，不能覆盖开始检查点；语义与迁移规则见 [northshire-v1/05 §2](northshire-v1/05-tactics-and-decisions.md) |
| 静态房间、NPC、技能、内置 profile 规则和任务定义 | 版本化内容／应用配置 | 使用同一个包级 `content_version` 重新加载，不另建 profile 版本真相 |

`CharacterState` 是角色永久字段的唯一逻辑权威。角色在线时，character／WorldInstance 串行上下文只维护一个 live 实例；PostgreSQL 保存的 durable snapshot 只是最近成功提交的恢复点，不是第二份可独立写入的角色余额。脱战回复与魔法水 tick 先更新 live 实例，同进程重连直接读取该值；安全离线或其他明确提交边界再落库，进程崩溃才按 durable snapshot 恢复。

安全离线先在角色串行上下文中把 live 实例最终值提交为 durable snapshot，之后即使仍有旧战斗的冻结奖励待结算也允许卸载。延迟事务取得同一角色执行权后：若 live 实例存在就直接使用；若不存在，就在锁定该角色耐久行后从最新 durable snapshot 唯一装载一个临时实例，合并并提交结果，角色仍离线时再卸载。与重连并发时二者必须由同一执行权排序，任一时刻不能出现两份 live 实例，也不能让重连漏掉已经先提交的结果。

active 战斗期间，只允许该角色所属 CombatSession 的唯一 runtime projection 临时覆盖当前生命／职业资源与战斗瞬态字段；服务端以 live `CharacterState` 为底，仅用该投影形成有效视图。投影不能复制经验、任务或资产，也不能整体反写角色；退出战斗控制时只在死亡、逃离、恢复、最终结算或中止等明确事务边界按字段同时合并 live 实例与 durable snapshot。任何延迟事务都必须先取得角色执行权并以 live 当前值为基线，不能用数据库旧值覆盖尚未落库的脱战回复。

首版不为每次战斗 tick 写数据库。金币、物品、经验、任务完成等结果必须在形成最终玩家收益前持久化；纯表现事件和未结算战斗状态允许在进程崩溃时丢失。这个取舍应在玩家规则中明确，不能让客户端把 `accepted` 的瞬时战斗事件误解为已经持久保存。

AI 生成文字不属于权威状态。北郡 v1 运行路径关闭生成式 AI；后续若启用，领域结果仍先由规则引擎确定，AI 仅根据结构化结果生成描述，超时或失败时使用固定文本，不阻塞事务和实例队列。

## 10. 断线、重连与同步

重连流程：

1. 客户端使用恢复凭据建立新连接，服务端验证会话与角色绑定。
2. 服务端递增 `controlEpoch` 并使旧连接失效，防止双端同时控制；旧代次已排队但尚未执行的命令不能生效。
3. 客户端报告未确认命令；可以附带已知 `scopeCursors[]`，用于诊断各作用域的事件缺口。
4. MVP 发送带当前全部可见 `scopeCursors[]` 的完整快照。客户端逐 scope 清除 epoch 已改变的旧增量基线；短期事件补发只能作为以后经过验证的优化，不能成为恢复正确性的前提。
5. 客户端重发未确认命令时沿用原始完整 envelope（包括原 `commandId` 与 `clientSeq`），服务端返回原结果或继续首次处理；若返回结果标记 `historical/snapshotRequired`，客户端只确认旧命令已裁决，并以当前完整快照为准。

快照必须至少包含角色状态、当前位置、当前实例可见状态、战斗摘要和 `scopeCursors[] = { scope, scopeEpoch, serverSeq }[]`；后续启用队伍／交易时再附相应游标。数组对当前可见 scope 一项且仅一项，并按 `scope` 字符串升序输出；客户端收到完整快照后删除本地仍存在但数组已不包含的旧 scope 基线。

形成完整快照时，协调器先确定相关 character／instance 等 scope，按稳定 scope 字符串顺序取得各执行队列的短读屏障，并在同一个数据库一致性快照内一次捕获状态和对应 cursor；读取期间若位置或可见 scope 集合改变，则释放并重试，不能拼接多个时刻。这样角色位置、房间成员关系、战斗投影和每项 `serverSeq` 表示同一个一致切面，cursor 既不能领先于快照状态，也不能遗漏已经反映在快照中的事件。

快照切面捕获后，仍在这些读屏障内把新连接绑定到该精确 scope 集合，并先将完整快照放入该连接唯一的 FIFO 发送队列，随后才释放屏障。释放后产生的任何可见事件必须经已生效订阅排在快照之后；旧连接事件不得进入新连接队列。若绑定或入队失败，则同时放弃该订阅与快照并让客户端重新连接，不能先释放屏障再补订阅，也不能让增量先于快照送达或落入交接空窗。

客户端不能把本地未确认预测写回服务端。首版可以对输入做即时回显，但角色移动、伤害、拾取和资产变化均以服务端事件或快照为准。

## 11. 故障恢复

需要覆盖三种关键故障窗口：

| 故障时机 | 恢复行为 |
|---|---|
| 事务提交前进程退出 | 数据库回滚；客户端用原始完整 envelope 重试 |
| 事务已提交、响应或广播前退出 | 重试命中幂等结果；快照以已提交的击败状态、已终结 `RewardEpoch` 和奖励记录为准 |
| 仅内存战斗状态更新后退出 | 按不可变 `CombatStartCheckpoint` 与独立 lifecycle 分类恢复，重置或重建遭遇，不补造经济结果；对应版本必须保留此前已提交的永久成长及其 current-value 增量 |

服务启动时：

- 先执行兼容的数据库迁移并加载版本化内容；
- 为每个重建的事件作用域生成新的 `scopeEpoch`，不得沿用进程退出前的内存 `serverSeq` 基线；
- 恢复角色、资产和任务等 v1 持久状态；后续再恢复队伍等聚合；
- 按已提交的 `SpawnInstanceId`、终结的 `RewardEpoch` 和可信墙钟 `respawnEligibleAt` 重建遭遇；奖励轮次不得重新开放，刷新也不得因重启提前；
- `[later]` 将未完成交易按明确状态机恢复或取消，绝不能猜测为已完成；
- 清理过期会话和无主临时记录；后续启用邀请后也清理过期邀请；
- 建立实例后才接受玩家命令。

优雅停机时先停止接收新命令，排空有界队列，提交已经裁决的持久变更与战斗 lifecycle，再关闭连接；不得为了停机而推进不可变的战斗开始检查点。超过停机期限时仍以数据库事务结果为准。

## 12. 验证要求

### 12.1 北郡 v1 必须通过

- 同一购买或个人掉落领取命令重复发送，资产只变化一次；PersonalLoot 不能被其他角色领取；
- 两个攻击和一个计时器同刻进入战斗队列，重复运行得到相同作用域顺序；
- 模拟计时器回调延迟：内部事件按 `(dueAt, priority, eventSeq)` 排序，`dueAt` 更早的技能仍先于随后进入的打断结算；两者时刻相等时内部事件优先；
- 同一 `(actorId, commandId)` 携带原始 envelope 重试时，即使 `clientSeq` 已落后也返回首次结果；复用该键但改变类型或载荷时返回协议错误；
- 角色创建命令跨重连仍命中 `account:{accountId}` 的首次结果，角色命令跨重连仍命中 `character:{characterId}` 的首次结果；相同 `commandId` 位于不同 actor 命名空间时互不碰撞；
- 首次结果属于旧 `scopeEpoch` 时，重试返回不可改写的原领域结果并标记 `historical/snapshotRequired`；客户端不应用旧增量、不沿用旧 `serverSeq`，而以当前完整快照恢复；
- 接受、无事件拒绝和跨作用域命令均按注册表产生唯一 `primaryResultScope`，`firstResult.serverSeq` 固定为首次裁决完成后的该 scope 游标；
- 新覆盖命令替换旧覆盖后，旧 commandId 重试不会重新排队；
- 断线角色按 afk_profile 完成当前战斗，重连得到继续演算后的权威状态和摘要；
- 同一 WorldInstance 内两场 CombatSession 互不污染；北郡 v1 的跨战斗攻击、治疗或增益被稳定拒绝，不发生合并；
- 在“数据库已提交、响应未发送”位置模拟崩溃，重试返回原结果；
- 在敌人奖励事务已提交、广播未发送时模拟崩溃；重启后同一 `(SpawnInstanceId, RewardEpoch)` 不会再次发放任何奖励；
- 重连替换旧连接后，旧连接及其旧 `controlEpoch` 下已排队但尚未执行的命令不能继续控制角色；
- 服务进程重启后使用新 `scopeEpoch`；客户端收到完整快照后能清除旧序号基线并继续应用新事件；
- 同一快照同时携带 character 与 instance 等至少两个 `scopeCursors[]` 时，每项 epoch／序号独立恢复，不会把一个 scope 的基线套到另一个 scope；
- 增量事件出现缺口时，客户端能退回完整快照并继续运行。

### 12.2 `[later]` 后续系统再启用

- 两个玩家同时领取同一共享掉落，最终只有一个物品实例；
- 同一交易提交命令重复发送，资产只变化一次；
- 双方确认后任一方修改报价，旧确认不能完成交易；
- 角色同时接受两个队伍邀请，最终最多属于一个队伍；
- 明确启用跨 CombatSession 治疗与合并后，相关遭遇按后续规则确定性合并。

测试应使用可控时钟和带种子的随机源，使战斗顺序与结果可以重放。这里的“可重放”用于测试领域状态转换，不等同于首版采用完整事件溯源架构。

## 13. 负载与扩展边界

单进程模块化单体适合首版，前提是持续观察：

- 事件循环延迟和命令处理延迟；
- 各实例队列长度、最老命令等待时间；
- 单个热点实例每秒处理量；
- 数据库事务耗时、锁等待和连接池占用；
- 活跃连接数、广播扇出量和内存占用；
- 检查点、启动恢复和优雅停机耗时。

只有上述监控出现可重复的实际瓶颈后才拆分。典型信号是：单个进程已持续占满 CPU、热点世界实例队列无法及时排空、数据库而非领域逻辑成为瓶颈，或发布与故障隔离要求必须让多个进程独立运行。完整判据见 [ADR-0001 重新评估触发条件](adr/0001-typescript-modular-monolith.md#重新评估触发条件)。

演进时优先保持现有边界：实例仍是单写者，交易和队伍仍是独立聚合，协议仍使用命令 ID、作用域序号和版本。这样未来可以把不同实例分配给不同进程，而不需要改变游戏规则语义。

## 14. 首版明确不做

- 不拆微服务，不为模块间调用引入网络协议；
- 不做多进程共享同一活跃实例；
- 不使用 Redis 分布式锁、跨节点租约或领导者选举；
- 不引入 Kafka 等消息平台充当游戏内命令总线；
- 不做全服事件全局总排序；
- 不做分布式事务、两阶段提交或 Saga 编排；
- 不做完整事件溯源和无限事件日志；
- 不做跨进程实例迁移、自动分片或无缝热升级；
- 不为假设中的性能问题提前引入 Rust 服务；
- 不让 AI、客户端或后台任务绕过权威命令入口直接改库。

首版的正确性来自清晰的状态所有权、短事务、数据库约束和幂等命令，而不是来自更多基础设施。
