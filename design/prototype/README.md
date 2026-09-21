# Aura 工作台改版 · 原型交付

UI 原型已按**两种形态**落盘：可读的 HTML 原型（主）+ 静态 PNG（视觉参照）。
设计源文件：Ardot `Aura 工作台改版原型` — https://ardot.tencent.com/file/723970175272232

配套文档：`docs/frontend-workspace-redesign-dev-doc.md`（改造方案）、`docs/aura-ui-redesign-options.html`（A/B 草图）。

---

## 一、交付形态

| 形态 | 位置 | 适合谁用 |
|---|---|---|
| **可读 HTML 原型** | `design/prototype/html/*.html` | **模型与开发**：文本形态，结构、class、样式值都能直接读取，双击即开 |
| 静态图 PNG | `design/prototype/*.png` | 人：快速浏览整体视觉，作为还原度基准 |
| 设计 Token | `design/prototype/tokens.css` · `tokens.json` | 代码接入：直接引入或映射到 Tailwind theme |

> PNG 是位图，模型只能「看」不能「读」——拿不到精确的尺寸、间距、色值与图层关系。
> 因此 HTML 原型是后续开发的主入口，PNG 退居视觉参照。

---

## 二、HTML 原型说明

### 目录结构

```
design/prototype/html/
├── index.html               # 入口页（自动生成，按方案分组索引）
├── 00-cover.html            # 17 个自包含屏（CSS 内联，无外部依赖）
├── 01-login-A.html
├── ...
├── 15-states-feedback.html
├── build.mjs                # 生成脚本
├── check.mjs                # 自检脚本（标签配对 / 样式类覆盖 / 占位符残留）
└── _src/                    # 源文件（改这里，不要改生成结果）
    ├── app.css              # 设计系统样式基座
    ├── partials/            # 可复用外壳：rail-a / sidebar-projects / leftbar-b / setnav-b
    └── pages/               # 每屏主体片段
```

### 工作方式

- 每个 `.html` 都是**自包含单文件**：样式内联、图标为内联 SVG、无 CDN 与构建依赖，双击即可在浏览器打开。
- 画布锁定 **1440×900**，打开时按窗口**等比缩放**，与设计稿观感一致。
- 修改流程：改 `_src/` 下的样式或片段 → 在 `html/` 目录运行 `node build.mjs` → 重新生成全部屏。
- 自检：`node check.mjs`（会报告标签不配对、用到但未定义的 class、残留占位符）。

### 为什么这样组织

17 屏大量复用同一套外壳（方案 A 的 Rail 与项目侧栏、方案 B 的左栏与设置导航），
所以把外壳抽成 partial、样式抽成单一 `app.css`，改一处即可全量生效；
对外仍然输出自包含单文件，保证模型读取时无需跨文件跳转。

---

## 三、方案边界

| 方案 | 定位 | 覆盖界面 | 结构特征 |
|---|---|---|---|
| **A** | 系统**入口与门户** | 01 登录、02 注册、03 项目工作台、04 空状态、05/05b 项目弹窗 | 深色模块导航 Rail（72px）+ 项目侧栏（260px）+ 概览主区；强调「先选项目再进入」 |
| **B** | 系统**主体验** | 06 推进页、07 空会话、08 笔记库、09 笔记编辑、10 设置、11 模型配置、12–14 系统管理 | 三栏沉浸式：左项目列表 / 中内容推进 / 右上下文沉淀 |
| 全局 | 所有界面共用 | 15 状态与反馈 | 状态色、空状态、骨架屏、Toast、校验、二次确认 |

**衔接方式**：用户从 A 方案的入口（登录 → 工作台）选定项目后，进入 B 方案的三栏工作区；
B 方案左栏沿用 A 的项目列表与状态胶囊，保证「选项目」这一动作在两个方案里位置与语义一致。
A 的深色 Rail 只在入口层出现，进入 B 后降级为左栏顶部的轻量模块切换，避免两套导航并存。

---

## 四、屏幕清单与代码映射

改动类型：**新增** = 现无此页面需新建；**重构** = 结构/布局重写；**改造** = 沿用现有结构，替换视觉与信息密度。

| HTML | PNG | 界面 | 方案 | 目标路由 | 现有代码 | 改动 |
|---|---|---|---|---|---|---|
| `00-cover.html` | `00-cover.png` | 封面与索引 | — | — | — | 索引 |
| `01-login-A.html` | `01-login-A.png` | 登录 | A | `/login` | `interface/src/pages/login/index.tsx` | 改造 |
| `02-register-A.html` | `02-register-A.png` | 注册 | A | `/login`（切换态） | `interface/src/pages/login/index.tsx` | 改造 |
| `03-workspace-A.html` | `03-workspace-A.png` | 项目工作台 | A | `/`（现重定向 `/chat`） | `interface/src/pages/index.tsx` | **新增** |
| `04-workspace-empty-A.html` | `04-workspace-empty-A.png` | 工作台空状态 | A | `/` | 同上 | **新增** |
| `05-new-project-A.html` | `05-new-project-A.png` | 新建项目弹窗 | A | `/` | 同上 | **新增** |
| `05b-edit-project-modal-A.html` | `05b-new-project-modal-A.png` | 编辑项目弹窗 | A | `/` | 同上 | **新增** |
| `06-project-advance-B.html` | `06-project-advance-B.png` | 项目推进页 | B | `/chat` | `interface/src/pages/chat/index.tsx` | 重构 |
| `07-chat-empty-B.html` | `07-chat-empty-B.png` | 推进页空会话 | B | `/chat` | 同上 | 重构 |
| `08-note-library-B.html` | `08-note-library-B.png` | 笔记库 | B | `/note` | `interface/src/pages/note/index.tsx` | 重构 |
| `09-note-editor-B.html` | `09-note-editor-B.png` | 笔记编辑 | B | `/note/edit/:id?` | `interface/src/pages/note/edit.tsx` | 重构 |
| `10-settings-B.html` | `10-settings-B.png` | 设置首页 | B | `/setting` | `interface/src/pages/setting/index.tsx` | 改造 |
| `11-model-config-B.html` | `11-model-config-B.png` | 模型配置 | B | `/setting/model-config` | `interface/src/pages/setting/model-config.tsx` | 改造 |
| `12-admin-users-B.html` | `12-admin-users-B.png` | 用户管理 | B | `/admin/users` | `interface/src/pages/admin/users/index.tsx` | 改造 |
| `13-admin-roles-B.html` | `13-admin-roles-B.png` | 角色管理（权限矩阵） | B | `/admin/roles` | `interface/src/pages/admin/roles/index.tsx` | 改造 |
| `14-admin-menus-B.html` | `14-admin-menus-B.png` | 菜单管理（树形表格） | B | `/admin/menus` | `interface/src/pages/admin/menus/index.tsx` | 改造 |
| `15-states-feedback.html` | `15-states-feedback.png` | 状态与反馈规范 | 全局 | — | 建议新建 `components/ui/*` | **新增** |

> **05b 与 PNG 的差异**：PNG 里 05b 是「新建项目弹窗态」（底图+遮罩+弹窗的合成），
> HTML 版在此基础上把 05b 做成了**编辑项目弹窗**（字段预填、含删除入口），
> 与 05 的新建空表单形成一对，便于开发直接对照两种状态。

> 当前 `pages/index.tsx` 仅做 `redirect('/chat')`，改版后需承载真正的项目工作台，这是本次改动量最大的一块。

---

## 五、各屏关键实现点

### 方案 A（入口）
- **01/02 登录注册**：左右分栏，左 520px 深色品牌区（`#18222D`）+ 右侧浅色认证区；认证卡 405px 宽，输入框高 38px、圆角 8px。
- **03 工作台**：72px 深色 Rail + 260px 项目侧栏（搜索 + 6 个项目项，首项选中态为浅蓝底 + 蓝边框）+ 主区（标题、4 个 84px 高统计卡、状态筛选、340px 宽项目卡三列）。
- **04 空状态**：统计归零，主区替换为居中空状态卡 + 主按钮。
- **05/05b 弹窗**：560px 宽、内边距 28px、底部按钮右对齐；遮罩 `rgba(22,32,42,.45)`。

### 方案 B（主体验）
- **06 推进页**：左 280 / 中自适应 / 右 320。左栏 = 品牌行（含「自主体验」标签）+ **横排**模块导航 + 项目列表 + 用户栏；中栏 = 项目头 + 消息流 + 输入区；右栏 = 项目卡 + 会话分组 + 米色「已沉淀结论」卡 + 底栏按钮。
- **07 空会话**：中栏居中引导 + 三个起点建议；右栏「还没有沉淀结论」占位。
- **08 笔记库**：左 280（品牌 + 竖排导航 + 筛选 + 所属项目）/ 中列表面板 / 右 300（标签 + 统计 + 最近编辑）。
- **09 笔记编辑**：左 260 笔记列表 / 中格式条 + 编辑器 / 右 300（属性 + 标签 + 大纲）。
- **10/11 设置**：左 280 设置导航（设置 / 系统管理两个分组），右主区；11 为模型表格 + 默认模型提示条。
- **12–14 系统管理**：统一「标题 + 筛选栏 + 表格 + 分页」骨架；13 额外含权限矩阵，14 为树形表格（子项缩进，含显示/隐藏态）。

### 全局（15）
状态胶囊（项目 3 态 + 会话 3 态）、按钮三态、输入框三态（默认/聚焦/禁用）、空状态、骨架屏、加载中按钮、Toast（成功/错误）、表单校验、二次确认。

---

## 六、设计 Token

- `tokens.css` — CSS 变量，可直接引入或在 Tailwind theme 中引用
- `tokens.json` — 结构化 token，含状态色语义（项目/会话状态对应文案与配色）
- `html/_src/app.css` — HTML 原型实际使用的样式基座，数值与上面两份一致

核心色：主色 `#2266D1`、进行中 `#2F7D5C`、已暂停 `#AD6D18`、已归档 `#6B7785`、失败 `#C0392B`、深色 Rail `#18222D`、画布 `#F5F7F9`、描边 `#DCE3EA`、主文字 `#16202A`。

---

## 七、建议实施顺序

1. **基础层**：落地 `tokens.css`，抽 `components/ui`（Button / Input / Badge / Modal / Toast / Skeleton），按 `15-states-feedback` 对齐。
2. **入口层（A）**：登录注册 → 项目工作台 → 新建/编辑项目弹窗（含 03 新增页面与 project 数据模型）。
3. **主体验（B）**：推进页三栏 → 空会话 → 笔记库/编辑。
4. **设置与管理**：设置首页 → 模型配置 → 用户/角色/菜单管理（三屏同构，可复用同一套列表页组件）。

---

## 八、在线预览

- **HTML 原型入口**：`design/prototype/html/index.html`（推荐，可点击进入每一屏）
- PNG 画廊：`design/prototype/index.html`
