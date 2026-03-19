# 🎮 宝可梦学习乐园

基于 Next.js 16 + TypeScript + SQLite 的亲子学习激励平台。孩子通过完成学习任务获得宝可梦养成资源，在战斗中答题强化攻击，培养学习兴趣和策略思维。

## 核心功能

### 📚 任务系统
- 家长创建/审核学习任务，支持自定义任务模板
- 孩子提交任务，获得经验/道具奖励
- 多学科支持（语文/数学/英语/科学/其他）

### 🐾 宝可梦养成
- 喂食系统（食物/水晶/星星糖）提升属性
- 进化系统（等级+碎片满足条件后进化）
- 65种宝可梦，10种属性，29种技能

### ⚔️ 战斗系统
- 6大区域，逐步解锁，Boss/精英挑战
- 属性克制关系（火克草、水克火等）
- 捕获系统（4种精灵球，不同捕获率）
- 商店购买精灵球

### 📝 答题知识系统（战斗内）
- **每回合答题**: 战斗中每回合弹出一道知识题（3-6年级，数学/语文/英语/科学）
- **伤害加成**: 答对+快速=1.5x伤害，答对+较慢=1.2x伤害
- **连击系统**: 连续答对叠加额外伤害（2连+10%，5连+35%，10连+50%）
- **难度分级**: 按区域自动调整（区域1-2→3-4年级/难度1，区域3-4→3-6年级/难度2，区域5-6→5-6年级/难度3）
- **题库内容**: 80+题，含奥数思维、阅读理解、古诗词、成语、英语等
- **战后统计**: 结果界面显示答题数/正确率/最高连击

### ⚡ 战术系统（战斗内）
- 每3回合可选择一次战术：
  - 🗡️ **全力进攻**: 伤害+50%，防御-30%
  - 🛡️ **防御反击**: 防御+50%，伤害-20%
  - 🔄 **蓄力**: 本回合不攻击，下回合伤害×2
  - 💊 **恢复**: 回复25%HP，本回合不攻击

### 🎯 属性弱点提示
- 战斗界面显示野生宝可梦弱点类型（彩色标签）
- 帮助孩子理解属性克制关系，做出策略选择

### 🏠 其他功能
- 小屋装饰系统
- 图鉴收集（65种宝可梦）
- 成就徽章系统
- 学习统计/荣誉榜
- 每日/周末规划

## 技术栈

- **前端**: Next.js 16 (App Router) + TypeScript + Tailwind CSS + Framer Motion
- **后端**: Next.js API Routes + better-sqlite3
- **认证**: Cookie-based session
- **动画**: Framer Motion

## 快速开始

```bash
npm install
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)

## 测试

```bash
# 切换测试场景
npx tsx scripts/test-scenarios.ts <场景名>

# 可用场景: fresh, tasks, pokemon-care, evolution, battle-early, battle-mid, battle-endgame, house, achievements, full

# 运行战斗系统模拟测试
npx tsx scripts/battle-simulation-test.ts

# 登录信息
# 家长: 测试家长 / 123456
# 孩子: 测试宝贝 / 123456
```

详见 `docs/test-manual.md` 和 `docs/test-report.md`。

## 项目结构

```
app/
  api/              # API 路由
    battle/         # 战斗系统 API（遭遇/行动/队伍/商店）
    quiz/           # 答题系统 API（获取题目/提交答案）
    templates/      # 任务模板 API
    tasks/          # 任务 CRUD
    ...
  child/            # 孩子端页面
    battle/         # 战斗页面（地图/战斗/答题/战术/结果）
    ...
  parent/           # 家长端页面
    templates/      # 模板管理页面
    ...
lib/
  battle-logic.ts   # 战斗引擎（伤害/属性/答题/战术/捕获）
  db.ts             # 数据库 schema + 种子数据
  auth.ts           # 认证
  game-logic.ts     # 养成逻辑
scripts/
  test-scenarios.ts           # 测试场景切换
  battle-simulation-test.ts   # 战斗系统自动化测试
docs/
  test-manual.md    # 完整测试操作手册
  test-report.md    # 测试报告
```
