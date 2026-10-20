# Aura 🌟

**English** | [简体中文](./README.zh-CN.md)

An AI workbench for long-term projects: workspaces sit at the center, and AI conversations are distilled into notes, conclusions, and other reusable project assets.

> Ask a question → discuss options → reach a conclusion → save it as a note → pick up where you left off next time

## ✨ Features

- 🗂 **Project workspaces** - Workspaces are project containers (goal / description / status) that organize conversations and notes
- 🤖 **Multi-provider models** - Users configure their own models: OpenAI-compatible APIs (incl. Ollama) / Anthropic / Google, per-user config
- 🛠 **Agent tool calling** - Conversations automatically search notes, read note details, and save notes
- 📝 **Conversations to notes** - Save a full reply or a selected fragment as a note in one click, with source chat back-linking
- 🔐 **RBAC permission system** - Role / menu / button-level permission codes, with an admin console (users / roles / menus)
- 🔒 **Private by default** - Data stays in your local MySQL, and models can run fully locally

## 🛠 Tech Stack

| Layer    | Technology                                                      |
| -------- | --------------------------------------------------------------- |
| Backend  | Express.js + MySQL (mysql2) + Redis (ioredis)                   |
| AI       | Vercel AI SDK (OpenAI-compatible / Anthropic / Google, streaming) |
| Frontend | React 19 + React Router 7 + Ant Design 5 + Tailwind CSS 4       |
| State    | Zustand                                                         |
| Auth     | JWT + RBAC + Redis rate limiting                                |
| Testing  | Vitest + Supertest                                              |

## 📦 Project Structure

```
aura/
├── interface/            # Frontend (React Router 7)
│   └── src/
│       ├── pages/        # chat / note / setting / admin / workspace / login
│       ├── components/   # shell layout, route guard, workspace modal, etc.
│       ├── api/          # API requests
│       ├── http/         # axios wrapper
│       └── store/        # Zustand state management
├── server/               # Backend (Express.js)
│   ├── endpoints/        # API endpoints (chat / note / workspace / model-config / role / user / menu)
│   ├── models/           # Data models
│   ├── middlewares/      # auth / rbac / rate-limit
│   ├── tool/             # Agent tools (search_notes / get_note_detail / save_note)
│   ├── sql/              # init.sql and migrations
│   ├── scripts/          # Test service bootstrap scripts, etc.
│   └── test/             # Vitest integration tests
├── shared/               # Constants and utils used by the backend
├── design/prototype/     # UI prototypes (scheme B, 17 screens, readable HTML)
├── docs/                 # Product roadmap and system architecture
├── .agents/notes/        # Decision records (why, and what was rejected)
├── scripts/              # Documentation gates (links, decision-record format)
└── AGENTS.md             # Standing rules for agents and maintainers
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- [pnpm](https://pnpm.io/)
- MySQL 8.0+
- Redis

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd aura

# Install dependencies
pnpm install

# Initialize the database (creates the aura schema and all tables)
mysql -u root -p < server/sql/init.sql

# Configure environment variables (the repo ships a default .env;
# put local overrides in .env.local, which is not committed)
cp server/.env server/.env.local
# Edit .env.local with DB_HOST / DB_USER / DB_PASSWORD / REDIS_* / JWT_SECRET
```

### Start the dev environment

```bash
# Backend (port 3000)
pnpm dev:server

# Frontend (port 5173)
pnpm dev:ui
```

Open http://localhost:5173 and register.

### Configure a model

After signing in, add a model config under **Settings → My Models** (per-user, visible only to you):

- **OpenAI-compatible API**: set `baseUrl` + model name; for Ollama use `http://localhost:11434/v1`
- **Anthropic / Google**: just fill in the API key

## 🧪 Testing

The test suite resets a dedicated `aura_test` database and FLUSHDBs the test Redis — isolated services are mandatory. See [server/test/README.md](./server/test/README.md) for details.

```powershell
# Windows: one-shot bootstrap of isolated MySQL (13306) and Redis (16379), plus .env.test.local
.\server\scripts\start-test-services.ps1

# From the repo root: run the full suite
pnpm test:server
```

---

## 📅 Roadmap

See [docs/product-roadmap.md](./docs/product-roadmap.md) for the full plan.

### Done ✅

| Feature            | Notes                                                            |
| ------------------ | ---------------------------------------------------------------- |
| Multi-model access | Per-user model config via Vercel AI SDK (OpenAI-compatible / Anthropic / Google) |
| RBAC               | Roles, menus, button-level permission codes                      |
| Admin console      | User management, role assignment, menu permission config         |
| Agent tool calling | search_notes / get_note_detail / save_note                       |
| Chat to notes      | Message-level save, text-fragment save, source back-linking      |
| Workspace projects | Project goal / description / status, project grid view           |
| UI design alignment| Scheme B fully landed (17 prototype screens)                     |

### Next up 📋

| Feature            | Description                                                     |
| ------------------ | --------------------------------------------------------------- |
| Project memory     | Answers automatically reference workspace history, notes, and project goals |
| Session summaries  | Structured distillation: topics / conclusions / open questions / TODOs |
| TODO extraction    | Identify TODOs from conversations, with confirm and complete     |
| Knowledge back-links| Show cited sources on answers, jumping to the referenced notes or messages |
| Deployment & demo  | One-command Docker setup, demo data, and a demo script          |

---

## 📄 License

[MIT License](./LICENSE)
