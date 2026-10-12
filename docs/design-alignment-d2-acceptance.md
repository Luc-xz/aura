# 设计稿对齐 D2 验收记录

> 日期：2026-10-12
> 阶段：D2 方案 A 入口层（01/02 登录注册、03/04 工作台主区、05/05b 项目弹窗）
> 结论：**通过**（G-D2：六屏 1440×900 并排比对通过；构建/lint 绿；F2 已验收功能回归不回退）

## 交付内容

| 屏 | 落点 | 结果 | 说明 |
| --- | --- | --- | --- |
| 01/02 登录注册 | `pages/login/index.tsx` | 通过 | 520px 深色品牌分栏（165° 渐变、logo、headline、mini 预览、caption）+ 405px 认证卡；双态品牌文案与预览排布随 `?type=` 切换；表单校验与 clientAction 原样保留 |
| 03/04 工作台 | `pages/workspace/index.tsx` | 通过 | 84px 统计卡（左色条、归零灰）、30px 筛选胶囊（带计数、选中墨底）、340px 项目卡（状态点/目标/描述/元信息/操作行、归档变体）、虚线空态卡 + 手提箱图形；搜索/排序保留为 30px 紧凑控件 |
| 05/05b 弹窗 | `components/workspace-modal/index.tsx` | 通过 | 560px / 28px 内边距 / sh-pop 阴影 / 遮罩 `rgba(22,32,42,.45)` / top 100px；字段 38px、textarea 76px、状态+模型双列；编辑态左下「删除项目」、底部右对齐取消/保存 |
| 表单密度 | `assets/styles/index.css` | 通过 | 新增 `.aura-form`（label 12px 上置、输入 38px、项间距由容器 gap 提供）与 `.aura-compact`（30px 筛选行控件）两个 antd 上下文；antd 必填星号与冒号在登录/注册/弹窗表单关闭（`requiredMark={false}` `colon={false}`） |
| 侧栏微调 | `shell/use-project-sidebar.ts` · `shell/project-sidebar.tsx` | 通过 | 未进入过推进页时首项默认选中（原型 03 语义，纯视觉不导航）；侧栏空态文案对齐原型（居中 / placeholder 色 / 20px 内边距） |
| ui 原语 | `components/ui/empty-state.tsx` | 通过 | `EmptyState` 增加 `icon` 插槽 |

## 验证

| 项 | 结果 |
| --- | --- |
| `pnpm --filter aura-interface build` | 通过（12.5s） |
| `pnpm --filter aura-interface lint` | 通过 |
| 并排截图比对 | 六对成对图存档于 `docs/design-alignment/screenshots/d2/`（`NN-impl.png` / `NN-proto.png` / `NN-pair.png`），视觉复核 + DOM 实测双重核对 |
| DOM 实测（登录） | 品牌区 520×900、认证卡 405、输入 38px、按钮 38px、标签无星号无冒号——与原型 CSS 同源数值一致 |
| DOM 实测（工作台） | rail 72 / sidebar 260 / main 1108 / 项目卡 340×219 / 筛选胶囊 30 高，wrap 正常（重载三次稳定） |
| F2 功能回归冒烟 | 编辑弹窗保存（toast「项目已更新」+ 标题更新）✓；归档流转（toast + 状态 + 计数刷新）✓；搜索过滤（关键词→单卡）✓；删除二次确认（标题/取消）✓；新登录流程走通（登 录 → /workspace）✓ |
| console | 无报错 |

## 比对方法说明

- 原型 HTML 画布 1440×900 带自适应缩放，截图时垫高视口至 1440×932 强制 scale=1 并取消居中，保证与实现页同尺度比对。
- 视觉模型反馈中与 DOM 实测矛盾的项目（如「认证卡 340–360px」「创建/创造」措辞）以 DOM 与原型源码为准，判定为误读；首轮发现的星号/冒号问题为真实缺陷，已修复后复验。

## 已知偏差登记（数据/环境类，非缺陷）

| 项 | 说明 |
| --- | --- |
| 统计卡「本周有推进」为 0 | 验收账号无会话记录；有推进的项目按语义着蓝（`t-primary`），归零灰 |
| 首卡为归档项 | 六项目同一时间戳创建，`updated_at DESC` 下顺序由 id 决定；真实数据不会出现 |
| 原型 05 首字段呈聚焦态 | 原型静态示意 focus ring 规范，实现为真实交互态，非差异 |
| 工作台主区排序/搜索控件 | 原型主区仅有筛选胶囊；F2 已验收的搜索/排序功能保留，以 30px 紧凑密度置于筛选行右侧 |
| 登录注册卡内黄色标注条 | 原型 `.annotation` 为设计说明（「实现为 /login 同页双态切换」），不渲染 |

## 验收数据清理

比对使用临时账号 `d2accept`（super_admin，6 项目 + 1 模型配置）与 `d2empty`（空态），完成后已从库中删除，恢复至验收前状态（user 2 / workspace 4 / model_config 1）。用户现有数据未受影响。
