# MUD-WoW

一个以 Vanilla 1.12 为资料基线、从普通人类冒险者视角重走暴风王国早期危机的文字 RPG。

项目当前处于设计与技术验证阶段。首个目标不是复刻完整 World of Warcraft，而是完成北郡 1–5 级垂直切片，验证纯文字探索、任务、连续自动战斗与低频决策、成长和多人共享状态是否成立。

## 当前阶段

- 首个交付目标是北郡 1–5 级垂直切片。
- 服务端采用 Node.js + TypeScript 模块化单体，使用 PostgreSQL 持久化，并通过 HTTP + WebSocket 服务多个玩家。
- 北郡 v1 的玩法和验收规则已经冻结，具体实现只以 [北郡 v1 设计包](docs/northshire-v1/README.md) 为准。
- 工程实现处于 M0 工程与设计基线阶段：backlog #1–#5 已落地，包含 workspace、基础 CI、PostgreSQL 与内容门禁、Protocol／Content Schema、确定性 Kernel，以及可执行的模块导入边界；下一项是 command registry、actor scope、Idempotency Store 和 scope runtime，详见[开发计划当前进度](docs/development-plan.md#11-当前进度)。
- 研究资料和通用设计提供背景与后续方向，不会被北郡 v1 隐式继承，详见 [00 §3.1](docs/northshire-v1/00-slice-contract.md)。

## 本地工程运行

本地应用进程直接运行在 Node.js 中，Docker Compose 只提供 PostgreSQL：

```powershell
Copy-Item .env.example .env
docker compose up -d --wait postgres
npm run db:migrate
npm run start:server
```

服务默认监听 `http://127.0.0.1:3000`：

- `GET /health/live` 只判断应用进程能否响应；
- `GET /health/ready` 检查 PostgreSQL 连接、当前 migration 兼容性，以及内容 manifest 的加载与 Schema 校验，任一门禁未通过时返回 `503`。

当前 [`content/northshire-v1/manifest.json`](content/northshire-v1/manifest.json) 只是 M0 的内容 Schema 与加载门禁脚手架，`records` 仍为空；它不代表真实北郡内容已经转录，也不代表 `NS-CONTENT-01` 已通过。

`npm run db:migrate` 可重复执行；没有待执行 migration 时不会重复修改数据库。开发结束后使用 `docker compose down` 停止本地 PostgreSQL，命名卷会保留数据。

## 文档入口

- [文档总览](docs/README.md)：文档分类、权威边界和推荐阅读顺序。
- [北郡 v1 设计包](docs/northshire-v1/README.md)：当前切片的完整实现与验收基线。
- [产品范围](docs/product-scope.md)：产品定义、当前范围与非目标。
- [产品路线图](docs/product-roadmap.md)：从北郡切片到迪菲亚闭环、政治续篇和条件式横向扩展的四版本候选路线；当前仅 V1 冻结。
- [系统架构](docs/architecture.md)：服务端组件、模块和部署边界。
- [北郡 V1 开发计划](docs/development-plan.md)：代码模块、依赖关系、开发里程碑、并行方式和验收门禁。

## 下一里程碑

完成北郡垂直切片：

1. 最小 Web 文字终端支持角色创建、命令反馈、快照和重连；
2. 11 个房间、10 条任务与 6 类敌人形成从修道院到南路的完整可玩路线；
3. 战士和法师能在无需额外刷怪的基准路径中达到 5 级，完成装备与训练闭环；
4. 两名玩家可以参与同一场战斗，获得一致事件、完整个人经验和个人掉落；
5. 死亡、战斗中断线、重连和进程重启都有幂等、可解释的恢复结果；
6. 接取 `Report to Goldshire` 后可在南路幂等首次写入 `sliceCompleteAt`，界面由此派生 `slice_complete`，且完成后仍可返回北郡。

总体产品范围以 [产品范围](docs/product-scope.md) 为准；北郡 v1 的具体实现规则和验收口径以 [北郡 v1 可执行设计包](docs/northshire-v1/README.md) 为准。

## 发布边界

本项目当前用于私人研究与原型验证；版权、素材与发行边界以[产品范围 §9 版权与发布边界](docs/product-scope.md#9-版权与发布边界)为准。
