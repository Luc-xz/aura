# 设计稿对齐 D0 验收记录

> 日期：2026-10-11
> 阶段：D0 设计基座
> 结论：**通过**（按 G-D0 定义：前端 build 与 lint 均为绿色）

## 交付内容

| 项 | 结果 | 说明 |
| --- | --- | --- |
| 设计令牌 | 通过 | `interface/src/assets/styles/index.css` 以 Tailwind `@theme` 映射主色阶、语义色、中性色、圆角与阴影；`aura.css` 保留原型 CSS 变量体系 |
| 样式基座 | 通过 | 从 `design/prototype/_src/app.css` 移植到 `interface/src/assets/styles/aura.css`，剔除原型画布、缩放提示与设计标注规则 |
| antd 主题 | 通过 | `interface/src/root.tsx` 接入 `ConfigProvider`，落地主色、状态色、画布色、边框、34px 控件高、13px 正文与 Inter 字体栈 |
| Inter 字体 | 通过 | 新增 `@fontsource-variable/inter` 并在样式入口离线打包，不依赖 CDN |
| UI 原语 | 通过 | 新增 `Pill`、`StatCard`、`FilterPill`、`EmptyState`、`SkeletonCard` |
| 全局状态皮肤 | 通过 | 主按钮增加渐变、内高光与投影；输入、选择器、日期选择器增加 3px focus ring 与错误 focus ring |
| 旧令牌清理 | 通过 | 移除 `#1890ff`、`moon`、`ashen` 引用，改为新色板中的 `surface` / `line` / `line-strong` |

## 验证

| 命令 | 结果 |
| --- | --- |
| `pnpm --filter aura-interface build` | 通过：Vite 完成 3185 个模块转换，Inter 字体与主题 CSS 均进入产物 |
| `pnpm --filter aura-interface lint` | 通过 |
| 构建产物抽查 | 通过：`root-*.css` 包含 `Inter Variable`、`#2266d1`、`stat-card`、`pill` 与 focus ring 规则 |
| 旧值扫描 | 通过：`interface/src` 与构建产物中无 `#1890ff`、`bg-moon`、`border-ashen` |

## 记录与后续

- lint 首次暴露 `vite.config.js` 使用 Node 全局变量但 ESLint 仅声明 browser globals；已在 `interface/eslint.config.js` 为该文件补充 `globals.node` 后通过。
- D0 是全局基座，不做逐屏截图比对；逐屏并排截图从 D2 开始按执行计划存档。
- 下一步进入 D1：拆全局 Sider，落地方案 A Rail 与方案 B Leftbar，并完成路由、守卫、RBAC 可见性迁移。
