# Vanilla 人类联盟 1–31：任务链与区域路线核对表

> 本文件是《原始〈魔兽世界〉人类联盟线：文字 MUD 调研与 MVP 蓝图》的数据录入附录。只记录 1.12/Classic 旧世界任务关系，避免混入大灾变重做任务。

## 1. 等级带与实际节奏

| 区域 | 原版等级带 | 实际作用 |
|---|---:|---|
| 北郡山谷 | 1–5 | 人类出生子区域 |
| 艾尔文森林 | 1–10，部分任务到约 12 | 矿洞、鱼人、农场、豺狼人、早期迪菲亚 |
| 暴风城 | 非战斗升级区 | 训练、商业、跨区任务和政治故事枢纽 |
| 西部荒野 | 10–20 | 迪菲亚主线所在地 |
| 死亡矿井 | 资料标为约 15–23，通常 18–22 完成 | 西部荒野故事高潮 |
| 赤脊山 | 15–25 | 黑石兽人、豺狼人和湖畔镇边防故事 |
| 暮色森林 | 18–30 | 多组恐怖故事；若干经典终章达到 31–35 |

较准确的自然节奏：

```text
1–5      北郡
5–10/11  艾尔文森林
10–18    西部荒野，并穿插暴风城
15–25    赤脊山与西部荒野交叉推进
18–22    死亡矿井，完成第一条大故事
20–30    暮色森林，并回头处理赤脊后半段
22–31    未寄出的信、暴风城监狱、莱斯科瓦事件
```

原版玩家通常还会去洛克莫丹、黑海岸等地区补经验。文字版如果只保留暴风王国南部，需要明确提高任务经验、压缩等级，或增加标为 `adapted/new` 的任务。

## 2. 北郡旧版任务树

不要使用大灾变后的 `Beating Them Back!`、`Extinguishing Hope`、`Ending the Invasion!` 等兽人入侵任务。

主干：

```text
A Threat Within #783
→ Kobold Camp Cleanup #7
→ Investigate Echo Ridge #15
→ Skirmish at Echo Ridge #21
→ Report to Goldshire #54
```

支线：

```text
Eagan Peltskinner #5261
→ Wolves Across the Border #33
```

```text
Brotherhood of Thieves #18
├→ Bounty on Garrick Padfoot #6
└→ Milly Osworth #3903
    → Milly's Harvest #3904
    → Grape Manifest #3905
```

核对资料：[Elwynn Forest (Classic) quests](https://warcraft.wiki.gg/wiki/Elwynn_Forest_(Classic)_quests)、[Classic human storyline](https://warcraft.wiki.gg/wiki/Classic_human_storyline)。

事实边界：

- 狼任务只是地方野兽威胁，不会发现“有人控制狼群”；
- 北郡是狗头人侵入回音山矿洞、迪菲亚占据葡萄园；
- 没有“失踪农民被地下组织抓走”的情节；
- 没有黑铁矮人活动。

## 3. 艾尔文森林任务簇

### 3.1 矿洞调查

```text
The Fargodeep Mine #62
→ The Jasperlode Mine #76
```

### 3.2 失踪卫兵与鱼人

```text
A Fishy Peril #40
→ Further Concerns #35
→ Find the Lost Guards #37
→ Discover Rolf's Fate #45
→ Report to Thomas #71
→ Deliver Thomas' Report #39
   ├→ Bounty on Murlocs #46
   └→ Cloth and Leather Armor #59
```

### 3.3 农场生活故事

```text
Young Lovers #106
→ Speak with Gramma #111
→ Note to William #107
→ Collecting Kelp #112
→ The Escape #114
```

```text
Lost Necklace #85
→ Pie for Billy #86
→ Back to Billy #84
→ Goldtooth #87
```

### 3.4 迪菲亚与豺狼人

- `Red Linen Goods`（83）：独立任务，建立艾尔文已有迪菲亚活动；
- `The Collector`（123）→ `Manhunt`（147）：从收金日程追查 Morgan the Collector；
- `Westbrook Garrison Needs Help!`（239）→ `Riverpaw Gnoll Bounty`（11）；
- `Wanted: "Hogger"`（176）：独立精英悬赏；原任务没有证明霍格受迪菲亚指挥；
- `Report to Gryan Stoutmantle`（109）：前往西部荒野的常见引导。

霍格任务资料：[Wanted: “Hogger”](https://www.wowhead.com/classic/quest=176/wanted-hogger)。任务物是 `Huge Gnoll Claw`，不是虚构的“霍格断牙”。

## 4. 暴风城的枢纽作用

暴风城不是一张连续刷怪的升级地图，而是反复返回的叙事中心：

- `Kobold Candles`（60）→ `Shipment to Stormwind`（61）较早把角色带进城市；
- 迪菲亚调查中途要拜访旧城区军情七处的马迪亚斯·肖尔；
- 死亡矿井支线来自矮人区等不同城区；
- 范克里夫死后，`The Unsent Letter` 把故事提升到监狱和贵族政治。

MUD 首发只需实现与这条线有关的城区、训练师和服务 NPC；无需一次性填满整座城市。

## 5. 西部荒野与迪菲亚

### 5.1 地方生活

代表任务：

- `The Forgotten Heirloom`（64）；
- `The Killing Fields`（9）；
- `Goretusk Liver Pie`（22）；
- `Poor Old Blanchy`（151）。

这些任务负责表现荒废农田、食物和普通居民，不应被改写成阴谋线索。

### 5.2 人民军

```text
The People's Militia #12
→ The People's Militia #13
→ The People's Militia #14
```

人民军链表现玩家在本地民兵中的地位提升，但不是死亡矿井最终任务的前置。

### 5.3 迪菲亚七段调查链

```text
#65  格里安·斯托曼 → 湖畔镇的威利
#132 威利 → 格里安，带回情报
#135 格里安 → 暴风城马迪亚斯·肖尔
#141 肖尔 → 格里安，送回石匠工会报告
#142 截杀西部荒野的迪菲亚信使
#155 护送迪菲亚叛徒穿过月溪镇，找到入口
#166 进入死亡矿井，击杀埃德温·范克里夫
```

完整关系：[Defias Brotherhood quest chain](https://warcraft.wiki.gg/wiki/Defias_Brotherhood_quest_chain)、[最终任务 #166](https://www.wowhead.com/classic/quest=166/the-defias-brotherhood)。

事实边界：

- 威利在赤脊山只是跨区情报节点，不代表赤脊山主线属于迪菲亚；
- 前几步逐步确认石匠工会、范克里夫和藏身处，不应提前剧透；
- 第 155 步找到入口后开放 `Red Silk Bandanas`（214）；
- 死亡矿井没有门钥匙或副本准入，不做任务也能进入，但拿不到最终击杀任务；
- 迪菲亚的历史冤屈解释其形成，不等于叙事认可其绑架、谋杀和攻击行为。

## 6. 死亡矿井核对表

> 本节记录原版路线与内容事实；Boss 的文字化战斗规则见 [Vanilla WoW 文字 MUD：战斗系统设计规范](../combat-system.md)。

### 6.1 入口

- 位置：西部荒野西南月溪镇；
- 先进入非实例矿道，穿过迪菲亚和亡灵区域，再到副本传送门；
- 非实例区包含工头希斯耐特等任务目标；
- 五人副本，无准入任务。

资料：[Deadmines (Classic)](https://warcraft.wiki.gg/wiki/Deadmines_(Classic))。

### 6.2 Boss 顺序

```text
Rhahk'Zor
→ Miner Johnson（稀有，可不出现）
→ Sneed's Shredder → Sneed
→ Gilnid
→ 使用 Defias Gunpowder 炸开港口门
→ Mr. Smite
→ Captain Greenskin
→ Edwin VanCleef
→ Cookie（可选）
```

### 6.3 一次副本可处理的任务

| 任务 | ID | 位置／前置 |
|---|---:|---|
| Collecting Memories | 168 | 暴风城接取；目标在非实例亡灵矿道 |
| Oh Brother... | 167 | 暴风城接取；目标是非实例区工头希斯耐特 |
| Underground Assault | 2040 | 暴风城接取；`Speak with Shoni`（2041）只是可选引导 |
| Red Silk Bandanas | 214 | 迪菲亚主链第六步后开放 |
| The Defias Brotherhood | 166 | 必须完成前六步；击杀范克里夫 |
| The Unsent Letter | 373 | 范克里夫掉落信件触发；不要求已做迪菲亚主链 |
| The Test of Righteousness | 1654 等 | 圣骑士职业链 |

任务总览：[The Deadmines Dungeon Quests](https://www.wowhead.com/classic/guide/classic-wow-the-deadmines-dungeon-quests)。

## 7. 死亡矿井后的莱斯科瓦事件

```text
The Unsent Letter #373
→ Bazil Thredd #389
→ The Stockade Riots #391
→ The Curious Visitor #392
→ Shadow of the Past #393
→ Look to an Old Friend #350
→ Infiltrating the Castle #2745
→ Items of Some Consequence #2746
→ The Attack! #434
→ The Head of the Beast #394
→ Brotherhood's End #395
→ An Audience with the King #396
```

整链标注约 22–31；虽然信件更早就能接，但会被约 29 级的暴风城监狱任务自然卡住。最终奖励 [Seal of Wrynn](https://www.wowhead.com/classic/item=2933/seal-of-wrynn)。链条资料：[Lescovar Incident quest chain](https://warcraft.wiki.gg/wiki/Lescovar_Incident_quest_chain)。

Vanilla 版本的 `An Audience with the King` 实际由卡特拉娜·普瑞斯托接待，因为瓦里安仍然失踪；不要用后期版本中回归的瓦里安替换她。

## 8. 赤脊山：并行边疆故事

核心威胁是石堡的黑石兽人、豺狼人、鱼人、野兽和湖畔镇物资危机，不是“黑龙渗透人类王国”的低级主线。

```text
Blackrock Menace #20
→ Tharil'zun #19
```

```text
The Price of Shoes #118
→ Return to Verner #119
   ├→ Underbelly Scales #122
   └→ A Baying of Gnolls #124
       → Howling in the Hills #126
```

```text
Messenger to Stormwind #120 → #121
→ Messenger to Westfall #143 → #144
→ Messenger to Darkshire #145 → #146
```

最后一条通信链把三地串联起来，但串联的是“每个地区都因自己的危机无法支援湖畔镇”，不是同一个幕后敌人。资料：[Redridge Mountains quests](https://warcraft.wiki.gg/wiki/Redridge_Mountains_quests)。

维琳德·星歌属于月神镰刀／狼人历史，不是赤脊山 NPC。原对话把她放在赤脊山是人物归属错误。

## 9. 暮色森林：并行恐怖短篇

### 9.1 守夜人

```text
The Night Watch #56
→ The Night Watch #57
→ The Night Watch #58
```

### 9.2 亚伯克隆比／藏尸者

```text
The Hermit #165（可选引导）
→ Supplies from Darkshire #148
→ Ghost Hair Thread #149
→ Return the Comb #154
→ Deliver the Thread #157
→ Zombie Juice #158
→ Gather Rot Blossoms #156
→ Juice Delivery #159
→ Ghoulish Effigy #133
→ Ogre Thieves #134
→ Note to the Mayor #160
→ Translate Abercrombie's Note #251
→ Wait for Sirra to Finish #401
→ Translation to Ello #252
→ Bride of the Embalmer #253
```

这条链让玩家发现自己一直在替亚伯克隆比准备材料，并引出缝合怪／藏尸者危机，适合做动态世界事件。

### 9.3 斯塔文传说

```text
66 → 67 → 68 → 69 → 70 → 72 → 74
→ 75 → 78 → 79 → 80 → 97 → 98
```

它往返夜色镇、月溪镇、东谷伐木场和暴风城，通过档案和书信还原旧案。跨越西部荒野不代表它与迪菲亚有关。

首尾任务：[The Legend of Stalvan #66](https://www.wowhead.com/classic/quest=66/the-legend-of-stalvan)、[The Legend of Stalvan #98](https://www.wowhead.com/classic/quest=98/the-legend-of-stalvan)。

### 9.4 摩拉迪姆

```text
The Weathered Grave #225
→ Morgan Ladimore #227
→ Mor'Ladim #228
→ The Daughter Who Lived #229
→ A Daughter's Love #231
```

这条线角色性很强，但原版终章约为 35 级，严格 30 级 MVP 无法原样收尾。

### 9.5 狼人与摩本特·费尔

- `Worgen in the Woods`：173 → 221 → 222 → 223；
- 摩本特·费尔是一条跨区长链，终章 `Morbent Fel`（55）约为 32 级组队任务。

完整区域任务表：[Duskwood quests](https://warcraft.wiki.gg/wiki/Duskwood_quests)。

暮色森林常标 18–30，但多个标志性故事在 31–35 才收尾。严格封顶 30 级时，应把这些终章留到扩展，或明确标注为经过等级压缩的改编。

## 10. 适合作为内容验收的检查项

每录入一条任务链，检查：

1. 页面是否明确属于 Classic／旧世界，而非大灾变后的同名任务；
2. ID、前置、接取人、交付人和目标位置是否一致；
3. 玩家在当前知识状态下是否会被 NPC 提前剧透；
4. 跨地图只代表地理往返，还是确有剧情因果；
5. 等级封顶是否允许原样完成终章；
6. 改写文本是否保留事实但没有复制整段官方原文；
7. 新增内容是否标记为 `adapted` 或 `new`；
8. 任务完成后是否更新 NPC 对话、地区状态或后续入口。

第一版的验收终点建议固定为：

```text
A Threat Within
→ 艾尔文地方任务簇
→ Report to Gryan Stoutmantle
→ The Defias Brotherhood 七段链
→ Edwin VanCleef
→ 掉落 The Unsent Letter，作为下一阶段悬念
```

这是目前资料上最忠实、工作量也最可控的人类联盟文字 MUD 闭环。
