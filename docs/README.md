# MUD-WoW 文档总览

> 状态：仓库文档索引  
> 作用：说明文档职责、权威边界和推荐阅读顺序

根目录的 `README.md` 只负责项目介绍与入口导航。本目录保存产品、设计、工程和研究资料；北郡 v1 的当前实现规则集中在 `northshire-v1/`，避免同一规则在多个层级重复定义。

## 1. 文档地图

| 分类 | 文档 | 职责 |
|---|---|---|
| 当前切片 | [北郡 v1 设计包](./northshire-v1/README.md) | 北郡 1–5 的玩法、内容、多人恢复和验收规则；是当前实现的唯一玩法权威 |
| 产品 | [产品范围](./product-scope.md)、[产品路线图](./product-roadmap.md) | 产品定位、设计原则、阶段范围、版本顺序和晋级门槛；不拥有具体战斗数值或恢复时序 |
| 工程 | [系统架构](./architecture.md)、[多人一致性](./multiplayer-consistency.md) | 服务端结构、协议、排序、事务与持久化边界；v1 只使用设计包显式导入的通用机制 |
| 开发执行 | [北郡 V1 开发计划](./development-plan.md) | 代码边界、模块依赖、纵向里程碑、并行方式、CI 与工程门禁 |
| 技术决策 | [ADR-0001](./adr/0001-typescript-modular-monolith.md) | TypeScript 模块化单体决策、替代方案和重新评估条件 |
| 通用设计 | [战斗系统设计](./combat-system.md) | 北郡之后的低注意力战斗方向；不向 v1 自动补充规则 |
| 研究 | [调研与 MVP 蓝图](./research/vanilla-wow-text-mud-research.md)、[人类路线参考](./research/vanilla-wow-human-route-reference.md) | Vanilla 事实、内容路线和设计背景；属于非规范输入资料 |

## 2. 权威边界

不同文档各自拥有不同类型的决定，不使用一条跨领域的简单优先级覆盖所有内容：

1. 北郡 v1 的玩家行为、数值、内容和验收结果以 `northshire-v1/` 为准。
2. 通用设计与 v1 之间的导入和继承口径以 [00 §3.1](./northshire-v1/00-slice-contract.md) 为准。
3. 产品范围决定“为什么做、做到哪里”，不重复具体玩法规则。
4. 产品路线图整理候选版本顺序和晋级门槛，不把候选版本中的内容估算升级为冻结实现规则。
5. 架构和 ADR 决定“系统如何组织”，不反向创造玩法。
6. 研究资料提供事实依据和候选方向，不是实现契约。

## 3. 推荐阅读顺序

首次了解项目：

1. [项目 README](../README.md)
2. [产品范围](./product-scope.md)
3. [产品路线图](./product-roadmap.md)
4. [北郡 v1 设计包](./northshire-v1/README.md)

准备实现或评审：

1. [系统架构](./architecture.md)
2. [多人一致性](./multiplayer-consistency.md)
3. 按 `00` 到 `07` 阅读 [北郡 v1 设计包](./northshire-v1/README.md)
4. [北郡 V1 开发计划](./development-plan.md)

核对世界观和原版内容时，再进入 `research/`；设计北郡之后的职业、Boss 或副本战斗时，再阅读通用战斗系统设计。

## 4. 维护规则

- 同一决定只由一份文档拥有正文，其他位置使用摘要和链接。
- 修改北郡上游规则时，同时检查其下游规格和 `07-acceptance-and-playtest.md`。
- 验收文档只证明规则，不补写默认玩法。
- 研究结论进入实现前，必须先由产品范围或对应 v1 规则所有者显式采用。
- 新增同类文档前，先判断是否应补充现有规则所有者，避免形成第二份真相。
