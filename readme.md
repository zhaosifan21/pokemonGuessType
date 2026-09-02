# 宝可梦猜属性

一个基于 Vue 3 + Vite 的网页小游戏。玩家通过属性攻击观察伤害倍率，并在有限的攻击次数和猜测次数内，猜出系统随机生成的单属性或双属性防御组合。

项目采用移动端竖屏优先的布局，同时兼容 PC 浏览器，后续可以继续扩展为 Web App。

## 功能概览

- 访问 `/` 会自动跳转到 `/home`，未知路径也会回退到首页。
- 每局从 18 个单属性和 153 个双属性中等概率随机生成一个隐藏防御组合，共 171 种组合。
- 玩家可以选择属性进行攻击，查看伤害倍率并保留完整攻击记录。
- 玩家可以选择 1～2 个属性提交最终猜测，并保留猜测记录。
- 同一局中不能重复使用相同的攻击属性，也不能重复提交相同的猜测组合；双属性顺序不影响重复判定。
- 支持配置攻击次数和猜测次数，默认分别为 6 次和 3 次。
- 攻击次数用完后只会限制继续攻击，玩家仍可继续猜测；猜测正确、猜测次数用完、放弃游戏时才会结束本局。
- 支持“常规模式”“宝可梦冠军模式”和“直接显示倍率”三种攻击结果显示模式。
- 可选查看当前攻击和猜测记录下仍然合理的属性组合。
- 支持退出游戏、放弃游戏和结束后重新开始。
- 属性标签统一使用图标、属性背景色和中文名称展示。

## 技术栈

- Vue 3：Composition API 与 `<script setup>`。
- Vite：开发服务器和生产构建工具。
- Vue Router：页面路由和懒加载页面组件。
- Pinia：游戏局内状态管理。
- Vant：开源移动端优先 UI 组件库，提供按钮、单选、弹窗、步进器等基础交互组件。
- Less：全局变量、页面样式和响应式样式组织。
- PostCSS、`postcss-px2rem`、`px2rem-loader`：屏幕适配。
- ESLint、Prettier：代码检查和格式化。
- `dayjs`：日期时间工具依赖，供后续功能扩展使用。

## 快速开始

```bash
# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev

# 构建生产版本
pnpm build

# 预览生产构建结果
pnpm preview

# 执行 ESLint 检查
pnpm lint

# 格式化项目文件
pnpm format

# 检查格式但不修改文件
pnpm format:check
```

## 项目结构

```text
pokemon-game/
├─ public/                         # 当前未使用，可放置无需打包处理的静态资源
├─ src/
│  ├─ assets/
│  │  ├─ images/types.webp         # 18 种属性图标精灵图
│  │  └─ json/
│  │     ├─ types.json             # 属性名称、中文名、颜色和图标索引
│  │     └─ type-effectiveness.json # 非 1 倍的属性相克规则
│  ├─ components/
│  │  ├─ TypeBadge.vue             # 图标、背景色和文字组成的属性标签
│  │  └─ TypeIcon.vue               # 从精灵图定位属性图标
│  ├─ layouts/
│  │  └─ AppLayout.vue              # 应用级布局和内容容器
│  ├─ pages/
│  │  └─ HomePage.vue               # 游戏首页及完整游戏界面
│  ├─ router/
│  │  └─ index.js                   # 路由配置
│  ├─ stores/
│  │  └─ useGameStore.js             # 游戏配置、局内状态和操作
│  ├─ styles/
│  │  ├─ variables.less             # Less 共享变量
│  │  ├─ index.less                 # 全局基础样式和通用间距类
│  │  └─ game.less                  # 游戏页面专用样式
│  ├─ utils/
│  │  ├─ attackResultDisplay.js     # 攻击结果文案转换
│  │  ├─ rem.js                     # rem 根字号初始化
│  │  ├─ typeCombinations.js        # 属性组合生成、规范化和随机抽取
│  │  ├─ typeEffectiveness.js       # 属性倍率快速查询
│  │  └─ typePossibilities.js       # 根据记录筛选可能组合
│  ├─ App.vue                       # 应用根组件
│  └─ main.js                       # 应用入口、插件和全局样式初始化
├─ eslint.config.js                 # ESLint 配置
├─ postcss.config.js                # px 转 rem 配置
├─ prettier.config.js               # Prettier 配置
├─ vite.config.js                   # Vite 配置
├─ package.json                     # 项目依赖和命令
└─ pnpm-lock.yaml                   # 依赖锁定文件
```

## 游戏流程

### 1. 开始前配置

首页在未开始状态下提供攻击次数、猜测次数、攻击结果显示模式和“允许查看合理的属性组合”配置。点击开始后，当前配置会锁定，并由 Pinia 初始化一局游戏。

### 2. 随机生成目标

`typeCombinations.js` 根据 `types.json` 生成全部合法组合：

- 18 个单属性组合；
- 153 个不重复双属性组合；
- 双属性顺序无关，例如 `Water + Grass` 与 `Grass + Water` 会规范化为同一个组合。

目标组合只在客户端隐藏，在胜利、失败或放弃游戏后揭示。由于这是静态客户端应用，隐藏答案不适合作为安全秘密。

### 3. 属性攻击

玩家从 18 种属性中选择一个攻击属性，点击确认后调用 `useGameStore.attack()`。系统会通过 `getTypeMultiplier()` 计算攻击属性对目标单/双属性的最终倍率，并记录攻击属性、倍率和显示模式。

防御方支持 1～2 个属性，多个防御属性的倍率相乘；底层工具也预留了多个攻击属性相乘的能力。

### 4. 提交猜测

玩家可以选择 1～2 个不同属性提交猜测。组合会经过统一规范化后比较，因此双属性顺序不同仍然视为同一个答案。猜测错误会增加猜测次数，猜测正确则立即获胜。

### 5. 可能组合查询

`getPossibleTypeCombinations()` 会根据攻击记录和错误猜测记录过滤仍然可能的属性组合，并按单属性在前、双属性在后的顺序返回。

常规模式只提供“效果绝佳”“效果不好”等区间文案，因此会将 2 倍与 4 倍、0.5 倍与 0.25 倍视为同一类结果；另外两种模式提供完整倍率信息，筛选结果更精确。

## 核心模块

### `useGameStore`

Pinia Setup Store，主要包含：

- 配置：`attackLimit`、`guessLimit`、`attackResultDisplayMode`、`allowPossibleCombinations`。
- 局内状态：攻击次数、猜测次数、攻击记录、猜测记录、隐藏答案、游戏状态和结束原因。
- 操作：`initGame()`、`attack()`、`submitGuess()`、`abandonGame()`、`exitGame()`。

### `typeEffectiveness.js`

将静态属性相克 JSON 预处理为 `Map`，提供大小写不敏感的快速查询：

- `getTypeMultiplier(attackerNames, defenderNames)`：查询单属性或多属性攻击/防御组合的最终倍率。
- `getAttackMatchups(attackerName)`：从攻击方视角获取克制、抵抗、无效和正常属性。
- `getDefenseMatchups(defenderName)`：从防御方视角获取弱点、抵抗、免疫和正常属性。

### `typeCombinations.js`

负责属性组合规范化、组合键生成、组合相等判断和随机组合抽取，统一处理双属性顺序问题。

### `TypeIcon.vue` 与 `TypeBadge.vue`

`TypeIcon` 根据属性对象中的 `icon.index` 从 `types.webp` 精灵图定位图标。`TypeBadge` 在此基础上组合属性图标、背景色和固定宽度文字区域，用于猜测记录、答案、选择结果和可能组合等场景。

## 样式与屏幕适配

- `src/styles/index.less` 负责全局重置、基础布局和通用 `margin` / `padding` 间距类。
- `src/styles/game.less` 负责游戏配置、属性网格、记录卡片、弹窗和操作区域等页面专用样式。
- `src/styles/variables.less` 统一维护颜色、圆角、阴影和断点等 Less 变量。
- 属性选择区域使用响应式 Grid，移动端优先采用两列布局，较宽的 PC 屏幕会增加内容宽度和排列空间。
- `viewport-fit=cover`、安全区间距和触控友好按钮尺寸为后续 Web App 使用预留基础。
- PostCSS 默认按 `1rem = 16px` 处理 px 转换，`src/utils/rem.js` 负责初始化根字号。

## 后续扩展

当前项目暂未加入 PWA Manifest、Service Worker 和安装能力。如果后续确定 Web App 发布方案，可以在现有移动端布局基础上补充 PWA 插件和离线缓存策略。

游戏答案在客户端随机生成并保存在前端状态中，仅适合练习和小范围非盈利使用；如果未来需要防作弊或服务端判定，需要将随机目标和校验逻辑迁移到服务端。
