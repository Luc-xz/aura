# Aura 🌟

一个基于本地大模型的智能笔记应用，让 AI 成为你的私人知识助手。

## ✨ 特性

- 📝 **智能笔记** - 创建、编辑和管理个人笔记
- 🤖 **AI 对话** - 基于 Ollama 本地大模型的智能对话
- 🔒 **数据私有** - 所有数据存储在本地，保护隐私
- 🚀 **工作区管理** - 多工作区支持，按项目组织对话

## 🛠 技术栈

| 层级   | 技术                        |
| ------ | --------------------------- |
| 后端   | Express.js + MySQL          |
| 前端   | React Router 7 + TypeScript |
| 大模型 | Ollama (本地运行)           |
| 认证   | JWT                         |

## 📦 项目结构

```
aura/
├── interface/          # 前端 (React Router 7)
│   ├── src/
│   │   ├── api/        # API 请求
│   │   ├── pages/      # 页面组件
│   │   └── store/      # 状态管理
│   └── package.json
├── server/             # 后端 (Express.js)
│   ├── endpoints/      # API 端点
│   ├── models/         # 数据模型
│   ├── middlewares/    # 中间件
│   ├── sql/            # 数据库脚本
│   └── package.json
└── package.json        # Monorepo 配置
```

## 🚀 快速开始

### 前置要求

- Node.js 18+
- pnpm
- MySQL 8.0+
- [Ollama](https://ollama.ai/) (本地大模型运行环境)

### 安装

```bash
# 克隆项目
git clone https://github.com/your-username/aura.git
cd aura

# 安装依赖
pnpm install

# 初始化数据库
mysql -u root -p < server/sql/init.sql

# 配置环境变量
cp server/.env.example server/.env.local
# 编辑 .env.local 填入数据库配置

# 下载 Ollama 模型
ollama pull deepseek-r1:7b
```

### 启动开发环境

```bash
# 启动后端 (端口 3000)
pnpm dev:server

# 启动前端 (端口 5173)
pnpm dev:ui
```

访问 http://localhost:5173 开始使用。

---

## 📅 开发路线图

### Phase 1：核心能力建设 🚧

| 功能           | 描述                                                       | 状态      |
| -------------- | ---------------------------------------------------------- | --------- |
| 大模型调用改造 | 用户自行配置模型，支持多种提供商 (Ollama/OpenAI/Anthropic) | 📋 计划中 |
| RBAC 权限系统  | 基于角色的访问控制                                         | 📋 计划中 |

### Phase 2：核心功能实现 📋

| 功能         | 描述                             | 状态      |
| ------------ | -------------------------------- | --------- |
| MCP 笔记检索 | 对话时自动检索相关笔记作为上下文 | 📋 计划中 |
| 用户信息页面 | 个人资料查看和编辑               | 📋 计划中 |

### Phase 3：管理功能 📋

| 功能       | 描述                         | 状态      |
| ---------- | ---------------------------- | --------- |
| 管理员后台 | 用户管理、权限分配、统计看板 | 📋 计划中 |
| 操作日志   | 用户行为记录和审计           | 📋 计划中 |

---

## 📄 许可证

[MIT License](./LICENSE)
