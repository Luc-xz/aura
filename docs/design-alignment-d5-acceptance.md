# 设计稿对齐 D5 验收记录（收口）

> 日期：2026-10-12
> 阶段：D5 状态规范收口（原型 15 全局落地 + 17 屏全量回归）
> 结论：**通过**——D0–D5 全部完成，[设计稿对齐执行计划](./design-alignment-execution-plan.md)整体收口。

## 交付内容

| 规范项（原型 15） | 落地方式 | 结果 |
| --- | --- | --- |
| 状态胶囊（项目 3 态 + 会话 3 态） | D0 `ui/Pill` 原语，各屏已用 | 通过（前序阶段） |
| Toast 浅底同色描边（40px / 圆角 8） | `index.css` 全局规则 + `:has(icon)` 分色（antd message 弹层挂 body，须全局且加权选择器） | 通过：实测 success `#E8F3EE` 底 / `#C4E0D4` 描边 / 40px 高 / 8px 圆角 |
| 二次确认弹窗 | ConfigProvider Modal token（10px 圆角 / sh-pop 阴影 / 28px 内边距）+ 确认按钮 32px；danger 实测 `#C0392B` | 通过 |
| 按钮三态 | primary 渐变（D0）/ ghost / `btn:disabled`（skeleton 底 + disabled 字，本轮）/ antd loading spinner | 通过 |
| 输入框状态 | focus ring / error ring（D0）+ `colorBgContainerDisabled #F1F3F5`（本轮） | 通过 |
| 空状态 / 骨架 | `ui/EmptyState`（虚线卡）/ `ui/SkeletonCard`（#E6EBF0） | 通过（前序阶段） |
| 表单校验 | error ring + 12px 错误文案（D0/D2） | 通过 |

## 本轮修复

- **antd 弹层样式作用域失配（存量盲区）**：message / modal-confirm 挂载在 `body` 下而非 `.aura-theme` 容器内，此前 D0 的作用域前缀规则对弹层永不生效；改为全局规则并对 antd `:where()` 注入样式加权（`.ant-message .ant-message-notice …`）。
- `.btn` 禁用态、Modal token（圆角/阴影/内边距）补齐。

## 全量回归（11 路由）

| 路由 | 结果 |
| --- | --- |
| /login、/login?type=register | 渲染 ✓ 无报错 |
| /workspace（含空态与数据态） | ✓ |
| /chat?workspaceId=（会话态 + 空态引导） | ✓ |
| /note、/note/edit/:id | ✓ |
| /setting、/setting/model-config | ✓ |
| /admin/users、/admin/roles、/admin/menus | ✓ |

- 全程 console 无业务报错（仅存量 React 19 兼容提示与 antd 表单告警）。
- 交互链路回归：项目归档/恢复流转 toast ✓、推进页「项目设置 → 删除项目 → 二次确认 → 删除成功 → toast」端到端 ✓（在归档项目上实测）。
- 状态证据截图存档 `docs/design-alignment/screenshots/d5/`（toast-success / confirm-delete）。

## 验收数据清理

临时账号 `d5accept`（super_admin，2 项目 + 1 模型 + 1 笔记 + 2 条对话）已删除，库核对恢复原状（user 2 / workspace 4 / note 6 / chat 59 / model_config 1）。

## 计划整体收口

D0 设计基座 → D1 双外壳 → D2 方案 A 入口（01–05b）→ D3 方案 B 主体验（06–09）→ D4 设置与管理（10–14）→ D5 全局状态规范（15）全部完成；累计 17 屏逐屏并排比对（存档 `screenshots/d2–d5`）、六份验收文档、五个阶段提交。已知不对齐项集中登记于执行计划 §6（多为多会话/富文本/审计等待远期功能与无后端支撑控件），与 F2 遗留边界一致。
