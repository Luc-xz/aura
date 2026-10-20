# Aura 🌟

[English](./README.md) | **简体中文**

一个面向长期项目推进的 AI 工作台：以「项目工作区」为核心，把 AI 对话沉淀为笔记、结论等可复用的项目资产。

> 提出问题 → 讨论方案 → 形成结论 → 保存为笔记 → 下次继续推进

## ✨ 特性

- 🗂 **项目工作区** - workspace 项目化（目标 / 描述 / 状态），按项目组织对话与笔记
- 🤖 **多模型接入** - 用户自配模型：OpenAI 兼容接口（含 Ollama）/ Anthropic / Google，每用户独立配置
- 🛠 **Agent 工具调用** - 对话中自动检索笔记、查看笔记详情、保存笔记
- 📝 **对话沉淀为笔记** - 整条回复或划选片段一键存为笔记，笔记可回溯来源对话
- 🔐 **RBAC 权限系统** - 角色 / 菜单 / 按钮级权限码，配套管理后台（用户 / 角色 / 菜单）
- 🔒 **数据私有** - 数据存储在本地 MySQL，模型可完全本地运行

## 🛠 技术栈

| 层级   | 技术                                                         |
| ------ | ------------------------------------------------------------ |
| 后端   | Express.js + MySQL (mysql2) + Redis (ioredis)                |
| AI     | Vercel AI SDK（OpenAI 兼容 / Anthropic / Google，流式输出）  |
| 前端   | React 19 + React Router 7 + Ant Design 5 + Tailwind CSS 4    |
| 状态   | Zustand                                                      |
| 认证   | JWT + RBAC + Redis 限流                                      |
| 测试   | Vitest + Supertest                                           |

## 📦 项目结构

```
aura/
├── interface/            # 前端 (React Router 7)
│   └── src/
│       ├── pages/        # chat / note / setting / admin / workspace / login
│       ├── components/   # shell 布局、路由守卫、工作区弹窗等
│       ├── api/          # API 请求
│       ├── http/         # axios 封装
│       └── store/        # Zustand 状态管理
├── server/               # 后端 (Express.js)
│   ├── endpoints/        # API 端点（chat / note / workspace / model-config / role / user / menu）
│   ├── models/           # 数据模型
│   ├── middlewares/      # auth / rbac / rate-limit
│   ├── tool/             # Agent 工具（search_notes / get_note_detail / save_note）
│   ├── sql/              # init.sql 与 migrations
│   ├── scripts/          # 测试服务启动脚本等
│   └── test/             # Vitest 集成测试
├── shared/               # 后端使用的共享常量与工具
├── design/prototype/     # UI 原型（方案 B，17 屏，可读 HTML）
├── docs/                 # 产品路线图与系统架构
├── .agents/notes/        # 决策记录（为什么这样定、否掉了什么）
├── scripts/              # 文档校验 gate（链接、决策记录格式）
└── AGENTS.md             # agent 与维护者的常驻规则
```

## 🚀 快速开始

### 前置要求

- Node.js 18+
- [pnpm](https://pnpm.io/)
- MySQL 8.0+
- Redis

### 安装

```bash
# 克隆项目
git clone <your-repo-url>
cd aura

# 安装依赖
pnpm install

# 初始化数据库（创建 aura 库与全部表）
mysql -u root -p < server/sql/init.sql

# 配置环境变量（仓库已带默认 .env；本地覆盖写入 .env.local，不会被提交）
cp server/.env server/.env.local
# 编辑 .env.local，填入 DB_HOST / DB_USER / DB_PASSWORD / REDIS_* / JWT_SECRET
```

### 启动开发环境

```bash
# 启动后端 (端口 3000)
pnpm dev:server

# 启动前端 (端口 5173)
pnpm dev:ui
```

访问 http://localhost:5173 注册并登录。

### 配置模型

登录后在 **设置 → 我的模型** 中添加模型配置（每人独立、仅本人可见）：

- **OpenAI 兼容接口**：填 `baseUrl` + 模型名，Ollama 可填 `http://localhost:11434/v1`
- **Anthropic / Google**：直填 API Key

## 🧪 测试

测试会重置独立的 `aura_test` 库并 FLUSHDB 测试 Redis，必须使用隔离服务，详见 [server/test/README.md](./server/test/README.md)。

```powershell
# Windows 本机：一键拉起隔离的 MySQL (13306) 与 Redis (16379)，并生成 .env.test.local
.\server\scripts\start-test-services.ps1

# 仓库根目录：全量测试
pnpm test:server
```

---

## 📅 开发路线图

详细规划见 [docs/product-roadmap.md](./docs/product-roadmap.md)。

### 已完成 ✅

| 功能             | 说明                                                           |
| ---------------- | -------------------------------------------------------------- |
| 多模型接入       | 用户自配模型，Vercel AI SDK 对接 OpenAI 兼容 / Anthropic / Google |
| RBAC 权限系统    | 角色、菜单、按钮级权限码                                       |
| 管理员后台       | 用户管理、角色分配、菜单权限配置                               |
| Agent 工具调用   | search_notes / get_note_detail / save_note                     |
| 对话转笔记       | 消息级保存、划选保存、来源回链                                 |
| 工作区项目化     | 项目目标 / 描述 / 状态，项目网格视图                           |
| UI 设计对齐      | 方案 B 全量落地（17 屏原型）                                   |

### 下一步 📋

| 功能           | 描述                                           |
| -------------- | ---------------------------------------------- |
| 项目记忆注入   | 回答时自动参考工作区历史对话、笔记与项目目标   |
| 会话总结       | 讨论主题 / 结论 / 未解决问题 / 待办结构化沉淀  |
| 待办提取       | 从对话中识别 TODO，支持确认与完成              |
| 知识回链       | 回答展示引用来源，可跳转对应笔记或消息         |
| 部署与演示     | Docker 一键启动、演示数据与演示脚本            |

---

## 📄 许可证

[MIT License](./LICENSE)
