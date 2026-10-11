# 设计稿对齐 D1 验收记录

> 日期：2026-10-11
> 阶段：D1 外壳重构
> 结论：**前端代码验收通过**；后端联跑时的完整 console 走查待本地服务启动后复核

## 交付内容

| 项 | 结果 | 说明 |
| --- | --- | --- |
| 全局 Sider 退役 | 通过 | 删除 `interface/src/components/layout/index.tsx`，路由不再挂载旧 antd Sider |
| 认证与身份逻辑迁移 | 通过 | 新增 `useAuthShell`：未登录跳登录页、静默刷新 profile、退出登录清理 store |
| 方案 A 外壳 | 通过 | `/workspace` 挂载 72px 深色 Rail + 260px 项目侧栏；含新建、搜索、选中态与骨架态 |
| 方案 B 外壳 | 通过 | `/chat`、`/note/*`、`/setting/*`、`/admin/*` 挂载 280px Leftbar；工作 / 笔记 / 设置三态导航 |
| 项目列表联动 | 通过 | 外壳项目列表写入既有 workspace store；工作台增删改后通过事件刷新侧栏 |
| RBAC 可见性 | 通过 | Rail / modnav / setnav 均按角色、菜单、权限码过滤；member 不显示系统管理 |
| 登录独立外壳 | 通过 | `/login` 不套工作台壳；`/` 仍客户端重定向 `/workspace` |

## 验证

| 命令 / 场景 | 结果 |
| --- | --- |
| `pnpm --filter aura-interface build` | 通过：3199 个模块转换成功 |
| `pnpm --filter aura-interface lint` | 通过 |
| `pnpm exec react-router typegen` | 通过：生成的新 route types 只包含 Rail A / Leftbar B 外壳 |
| Headless Chrome `/workspace` | 通过：`.rail` 与 `.sidebar` 均渲染，无前端 JS 异常 |
| Headless Chrome `/chat`、`/setting` | 通过：`.col-left` 渲染，工作 / 设置导航结构正确，无前端 JS 异常 |
| member 角色冒烟 | 通过：设置页仅显示账户设置 / 我的模型，不显示系统管理分组 |

## 环境说明与已知过渡项

- 冒烟时未启动后端，`/api/*` 请求返回代理错误；这些是环境噪音，未观察到 React 渲染异常。
- `/chat` 页面仍保留 F1 的局部项目面板，D3 会按原型移除并由 Leftbar B 承担唯一项目列表，本阶段不提前重写会话主体。
- `tsc --noEmit` 仍暴露项目既有类型问题；新增 `components/shell/*` 未出现在错误列表中。
