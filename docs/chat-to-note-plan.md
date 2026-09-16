# 对话转笔记开发计划（新手向）

> 目标：落地 [product-roadmap.md](./product-roadmap.md) 任务 1.2——把 AI 回复沉淀为笔记，并建立 note ↔ chat 的来源关联。这是 M2 里程碑「让聊天真正沉淀为项目资产」的第一步，也是北极星闭环 `提出问题 -> 讨论方案 -> 形成结论 -> 保存为笔记` 里缺失的后半段。
> 前置要求：读过 [mcp-note-retrieval-plan.md](./mcp-note-retrieval-plan.md)（本计划沿用它的工具工厂、SSE 信封协议、mock 模型测试套路，不再重复讲解 Tool Calling 基础），`pnpm test:server` 全绿。

---

## 0. 这份计划怎么用

### 0.1 总览

| 阶段 | 功能点 | 学到的核心模式 | 难度 | 预计耗时 |
|---|---|---|---|---|
| 0 | 地基修缮：chat 消息组装 bug（当前消息重复 + 历史倒序） | 用 mock 模型断言「喂给模型的东西」 | ★★ | 半天 |
| 1 | note 表加 `workspace_id` / `source_chat_id` + 端点放行与归属校验 | schema 迁移、body 外键的信任边界 | ★★ | 半天~1 天 |
| 2 | 前端：assistant 气泡「保存为笔记」（完整回答 / 选中片段） | Modal 预填表单、SSE 事件扩展 | ★★ | 1 天 |
| 3 | AI 侧：`save_note` 工具 + `note-saved` 事件 | 第一个「写」工具：闭包写入 + 双保险校验 | ★★★ | 1 天 |
| 4 | 可选进阶：摘要版保存 / 来源回跳 / 项目笔记聚合 | — | 不排期 |

每个阶段独立提交一个 git commit（参照现有提交风格：`feat(server)` / `feat(interface)` / `chore(sql)` / `test(server)`），出问题可以单独回滚。

### 0.2 两条保存路径，一份计划

「对话转笔记」有两种触发方式，本计划都做，但分开阶段：

| | 阶段 2：用户手动保存 | 阶段 3：AI 主动保存 |
|---|---|---|
| 触发 | 用户点气泡下的按钮 | 模型判断「值得沉淀」时调 `save_note` 工具 |
| 入口 | 前端 → `POST /api/note` | 工具 execute → `Note.create`（进程内） |
| 谁校验归属 | note 端点（body 外键校验） | user 闭包 + 服务端注入的 workspaceId |
| 典型场景 | 「这条回答有用，存下来」 | 「把刚才的结论记成笔记」 |

两条路径最终写进同一张 note 表、带同样的来源字段，验收标准（roadmap 任务 1.2）对两者一致：**一段有价值的回复能在 2 步以内保存为笔记，保存后的笔记能追溯来源。**

### 0.3 贯穿全程的三条纪律

1. **写入工具和检索工具一样没有中间件保护**。`save_note` 的 `execute` 是被 AI SDK 在进程内直接调用的，express 的 `requireOwnership` 管不到它。`Note.create` 的 `user` 必须来自闭包（同 `search_notes`），`workspaceId` / `sourceChatId` 必须由服务端代码注入——**模型给的参数里永远不包含归属信息**。
2. **标题是 `VARCHAR(50)`，模型不懂 SQL 列宽**。模型生成的标题超长会让 INSERT 直接报错，工具没接住就是 500。防线要双保险：zod `max(50)` 拦一道，`execute` 里截断兜底。
3. **保存是「创建」，不是「覆盖」**。`save_note` 只做 INSERT，不提供按 id 更新已有笔记的能力——写工具的爆炸半径要一开始就圈死，误保存一条垃圾笔记可以删，误改一条已有笔记是数据事故。

### 0.4 开工前的现状清点

已就绪的条件：

| 条件 | 现状 |
|---|---|
| note 表 | `sql/init.sql:207`，有 `keywords JSON` 写入口（create/update 均支持） |
| 工具工厂 | `server/tool/index.js` 的 `buildNoteTools(user, hooks)`，两个读工具跑通 |
| SSE 信封 | `text` / `status` / `references` / `done` / `error` 五类事件，前端 `utils/sse.ts` 有增量解析器 |
| 笔记 API | `POST /api/note` 支持 title/content/description/keywords，前端 `createNote` 封装现成 |
| 前端气泡 | `pages/chat/index.tsx:229` footer 已有 references Tag 的渲染范式（点击跳 `/note/edit/:id`） |

**动工前发现的 3 个现有问题**：

1. **当前消息被发给模型两遍，且历史是倒序的** —— `server/endpoints/chat.js:94` 用 `[...rows, { ...当前消息 }]` 组装 messages，但 `rows` 是在 `Chat.create` **之后**查询的（`chat.js:72` 先落库、`chat.js:79` 再取最新 20 条 desc），当前消息已经在 `rows[0]` 里了；同时 `rows` 取完没有 reverse，喂给模型的是「最新→最旧」。这正是 mcp 计划阶段 0 约定要避免的形态，现有 mock 测试只断言响应不断言输入，所以没抓到。**阶段 0 处理**。
2. **`done` 事件不带落库消息 id** —— 流式结束后前端拿不到刚生成的 assistant 消息在 chat 表里的行 id，「来源消息 id」就无从记录。**阶段 2 处理**。
3. **气泡 footer 的复制/重新生成按钮没有 onClick** —— `pages/chat/index.tsx:239-244` 两个按钮是纯摆设。**阶段 2 顺手接上复制**。

---

## 阶段 0：地基修缮（先把「喂给模型的输入」修对、测住）

### 0.1 为什么它排第一

接下来的所有功能——手动保存、AI 保存、再往后的会话总结——都建立在「模型看到干净的历史消息」之上。现在历史是倒序 + 重复的，模型每次都在被错误的上下文喂着回答；不修，后面每个阶段的「真实模型验证」都会变得不可解释。

### 0.2 修复

```js
// server/endpoints/chat.js —— POST /:workspaceId 处理器内

// 捕获 insertId：这是本轮「用户消息」的 chat 行 id，
// 阶段 3 的 save_note 会把它作为笔记的 sourceChatId（来源消息）
const sourceChatId = await Chat.create({
  workspaceId,
  modelId: modelConfig.id,
  content,
  proposer: 'user'
})

const { rows } = await Chat.findByWorkspaceId(workspaceId, { /* 分页排序参数不变：desc 取最新 20 条 */ })

// rows 是 desc（最新在前）且已包含刚插入的当前消息：
// reverse 回时间正序，并且不再手动 append
const messages = rows.reverse().map(item => ({
  role: item.proposer,
  content: item.content,
}))
```

对比现状的两个变化：补上 `reverse()`；**删掉** `[...rows, { workspaceId, content, proposer: 'user' }]` 里手动追加的那条。

### 0.3 测试：断言「模型收到了什么」

现有 mock 只断言「模型回了什么」。`MockLanguageModelV3` 的 `doGenerate` 也可以传**函数**，函数入参里就有本次请求的完整 prompt——把它捕获下来，就能断言输入：

```js
// server/test/chat-prompt.test.js（新建）
import { vi, beforeAll, describe, expect, it } from 'vitest'
import { MockLanguageModelV3 } from 'ai/test'

// 捕获每次调用时喂给模型的消息列表（v6 里字段名是 prompt）
const captured = vi.hoisted(() => ({ prompts: [] }))

vi.mock('../utils/model-factory.js', () => ({
  createModelInstance: () =>
    new MockLanguageModelV3({
      doGenerate: async (options) => {
        captured.prompts.push(options.prompt)
        return {
          finishReason: 'stop',
          usage: { inputTokens: 10, outputTokens: 10 },
          content: [{ type: 'text', text: 'mocked reply' }],
        }
      },
    }),
}))

import { getRequest, registerAndLogin, authHeader } from './helpers.js'

let request
beforeAll(async () => { request = await getRequest() })

describe('喂给模型的消息组装', () => {
  it('当前消息只出现一次，且整体时间正序', async () => {
    const user = await registerAndLogin()
    // ...建 model-config + workspace（套路同 chat-tools.test.js 的 setupChatWorkspace）
    // 第一轮：发 'first-question'
    // 第二轮：发 'second-question'

    const prompt = captured.prompts.at(-1)          // 最后一次调用 = 第二轮
    const contents = prompt.map((m) => m.content)

    // 当前消息不重复（旧 bug：rows 里一份 + 手动 append 一份）
    expect(contents.filter((c) => c === 'second-question').length).toBe(1)
    // 时间正序（旧 bug：desc 直接喂，最新在前）
    expect(contents.indexOf('first-question')).toBeLessThan(contents.indexOf('second-question'))
  })
})
```

两个知识点：

- **测输入比测输出更能防回归**。这个用例红一次，就再也不会有人「顺手」把 append 加回去。
- `options.prompt` 是 AI SDK v6 `doGenerate` 入参里的消息数组（对应 `generateText` 的 `messages`），和 mcp 计划附录 A 里的 `input` 字段改名是同一次版本变更的产物。

### 0.4 验收清单

- [ ] 新用例先红后绿（改代码前跑一次确认它能抓到现状 bug）
- [ ] `pnpm test:server` 全绿；手动对话一轮，回复正常
- [ ] git commit：`fix(server): chat 消息组装——去重当前消息、历史恢复时间正序`

---

## 阶段 1：数据层——note 与 workspace / chat 的来源关联

### 1.1 概念：为什么是两个可空列

roadmap 任务 1.2 要「记录来源消息 id、来源 workspace id」，任务 2.3 要「note 增加 workspaceId、支持按项目筛选」。一次迁移把两件事都铺好：

| 列 | 语义 | 谁写入 |
|---|---|---|
| `workspace_id` | **项目归属**：这条笔记属于哪个项目（对应任务 2.3） | 手动保存 / AI 保存 / 以后从项目页直接建笔记 |
| `source_chat_id` | **来源追溯**：这条笔记沉淀自哪条消息（对应任务 1.2） | 手动保存时 = assistant 消息 id；AI 保存时 = 触发本轮的用户消息 id |

两列都可空：存量笔记没有来源，手工新建的笔记可以不属于任何项目。**可空外键 + 显式归属校验**是这个项目现有的风格（`init.sql` 全库没有 FOREIGN KEY 约束，归属一律在代码层校验），迁移保持一致，不引入新范式。

### 1.2 SQL 迁移

新建 `server/sql/migrations/20260916_note_source_linkage.sql`（命名对齐目录内现有文件）：

```sql
-- Migration: Add source linkage to note table
-- Date: 2026-09-16
-- Description:
--   1. Add workspace_id: 项目归属（roadmap 任务 2.3 提前落列）
--   2. Add source_chat_id: 来源消息追溯（roadmap 任务 1.2）

ALTER TABLE note
    ADD COLUMN workspace_id INT DEFAULT NULL AFTER user_id,
    ADD COLUMN source_chat_id INT DEFAULT NULL AFTER workspace_id;

-- 手动/AI 保存的笔记都带 workspace_id，「项目下的笔记」列表按它查
CREATE INDEX idx_note_user_workspace ON note (user_id, workspace_id);
```

同步修改 `server/sql/init.sql` 的 note 表定义（新环境走 init，存量库走 migration，两条路都要通）：

```sql
CREATE TABLE IF NOT EXISTS note (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    workspace_id INT DEFAULT NULL,          -- 新增
    source_chat_id INT DEFAULT NULL,        -- 新增
    title VARCHAR(50) NOT NULL,
    keywords JSON DEFAULT NULL,
    description VARCHAR(255) DEFAULT NULL,
    cover VARCHAR(255) DEFAULT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

> 注意：测试库是每个 `beforeAll` 重新执行 init.sql 建表的（`test/setup.js:57`），所以 init.sql 改完测试库自动生效；**本地开发库要手动跑一次 migration**。

### 1.3 Model 层放行

`server/models/note.js` 三处小改：

```js
// create：签名和 INSERT 加两列
static async create(user, { title, content, description, keywords, workspaceId, sourceChatId } = {}) {
  if (!user?.id) throw new Error('userId is required')
  const baseSql = `INSERT INTO note
    (user_id, workspace_id, source_chat_id, title, content, description, keywords)
    VALUES (?, ?, ?, ?, ?, ?, ?)`
  const [result] = await db.query(baseSql, [
    user.id, workspaceId ?? null, sourceChatId ?? null,
    title, content, description, keywords ? JSON.stringify(keywords) : null,
  ])
  return result.insertId
}

// update：白名单加两列（项目归属允许事后调整）
if (['title', 'content', 'description', 'keywords', 'workspaceId', 'sourceChatId'].includes(key) && payload[key] !== undefined) {
  const value = key === 'keywords' ? JSON.stringify(payload[key]) : payload[key]
  // ...
}

// findAll：支持按项目筛选（任务 2.3 的查询基础）
if (filters.workspaceId) {
  baseSql += ' AND workspace_id = ?'
  params.push(filters.workspaceId)
}
```

`filterFields` 不用动——`formatResponse` 会把 `workspace_id` 转成 `workspaceId` 回传前端。

### 1.4 端点：body 外键的归属校验（信任边界的关键一课）

`requireOwnership` 校验的是**路由参数**里的资源 id（`params.id`），而 `workspaceId` / `sourceChatId` 来自 **request body**——中间件模式套不上，得在处理器里显式校验。核心原则和 mcp 计划纪律 1 同源：**前端传的任何 id 都只是「声称」，归属必须查库验证**。

在 `server/endpoints/note.js` 加一个小 helper 并在 POST/PUT 里调用：

```js
import sql from '../sql/index.js'

// body 里的外键 id 不可信：逐一查库验证归属，不属于当前用户直接 400
async function assertLinkOwnership(user, { workspaceId, sourceChatId }) {
  if (workspaceId !== undefined && workspaceId !== null) {
    const [rows] = await sql.query('SELECT user_id FROM workspace WHERE id = ?', [workspaceId])
    if (!rows.length || rows[0].user_id !== user.id) {
      throw BadRequest('workspace not found')
    }
  }
  if (sourceChatId !== undefined && sourceChatId !== null) {
    // chat 没有 user_id，归属看它挂的 workspace（同 rbac.js RESOURCE_SQL 的 chat 条目）
    const [rows] = await sql.query(`
      SELECT w.user_id FROM chat c JOIN workspace w ON c.workspace_id = w.id WHERE c.id = ?
    `, [sourceChatId])
    if (!rows.length || rows[0].user_id !== user.id) {
      throw BadRequest('source chat not found')
    }
  }
}
```

然后在 POST / 和 PUT /:id 里：解构出 `workspaceId, sourceChatId`，调用 `assertLinkOwnership(req.user, { workspaceId, sourceChatId })`，透传给 Model。

> 返回 400 还是 403？这里选 400（BadRequest，"not found" 语义）——对调用方来说，一个不属于自己的 id 和一个不存在的 id 没有区别，**不应该用 403 泄露「它存在但不是你的」**。这是越权防护的常见取舍：404/400 不泄露存在性。

### 1.5 测试

扩展 `server/test/note.test.js`（或新建 `note-source.test.js`）：

```js
describe('note 来源关联与归属校验', () => {
  it('保存时携带 workspaceId / sourceChatId，回显正确', async () => {
    // 建模型+workspace，POST /api/chat/:wsId 发一条消息（stream:false, mock 模型），
    // 从 GET /api/chat/list/:wsId 拿到 assistant 消息 id
    // POST /api/note { title, content, workspaceId, sourceChatId }
    // 断言 res.body.data 的 workspaceId / sourceChatId 回显一致
  })

  it('传他人的 workspaceId 被拒绝', async () => {
    // alice 建 workspace；bob 登录后 POST /api/note 带上 alice 的 workspaceId
    // 断言 400，且 GET /api/note/page 里没有新笔记
  })

  it('传他人的 sourceChatId 被拒绝', async () => {
    // 同上套路，换成 alice 的 chat 行 id；断言 400
  })

  it('按 workspaceId 过滤笔记列表', async () => {
    // 两条笔记：一条带 wsId，一条不带；GET /api/note/page?workspaceId=xx
    // 断言只返回第一条（注意 findAll 的 filters 从 req.query 展开，workspaceId 已自动进入 rest）
  })
})
```

### 1.6 验收清单

- [ ] 本地开发库跑过 migration，`DESC note` 看到两列
- [ ] 三个越权/回显用例通过
- [ ] 存量笔记（workspace_id 为 NULL）的列表、编辑、检索不受影响
- [ ] `pnpm test:server` 全绿；git commit：`chore(sql) + feat(server): note 来源关联字段与归属校验`

---

## 阶段 2：前端「保存为笔记」（完整回答 / 选中片段）

### 2.1 概念：「2 步以内」怎么设计

验收标准是「一段有价值的回复能在 2 步以内保存为笔记」。设计：**第 1 步**点气泡下的「存为笔记」按钮，**第 2 步**在预填好的 Modal 里点确认。预填规则：

- **标题**：取回复第一行、去 Markdown 符号、截 50 字（DB 列宽）；
- **内容**：默认整条回复；**如果用户在气泡里选中了一段文本**（`window.getSelection()` 的范围落在这个气泡内），预填选中片段——这就是 roadmap 说的「选中片段」能力，纯前端实现，零后端成本；
- **描述**：留空可编辑。

「自动摘要版」需要调一次模型做摘要，留到阶段 4 / 会话总结计划复用，本期不做。

### 2.2 后端小改：`done` 事件带上 chatId

流式结束后 `Chat.create` 落库 assistant 消息（`chat.js:156`），把返回的 insertId 随 `done` 事件带出去，前端就有了「刚流完这条消息」的行 id：

```js
// server/endpoints/chat.js 流式分支
const chatId = await Chat.create({ workspaceId, content: full, proposer: 'assistant' })
sendEvent({ type: 'references', notes: references })
sendEvent({ type: 'done', chatId })          // 事件载荷扩展，老前端忽略新字段也不受影响
```

非流式分支同理，响应升级为 `{ content, references, chatId }`。

前端 `utils/sse.ts` 的类型同步加字段：

```ts
| { type: 'done'; chatId?: number }
```

`handleStreamChat` 的 feed 回调里补一行：`if (evt.type === 'done' && evt.chatId) last.id = evt.chatId`。历史消息本来就有 id（`GET /chat/list` 返回行 id），至此**每条 assistant 气泡都有来源 id**。

### 2.3 前端：按钮、选中片段、Modal

`pages/chat/index.tsx` 的 `ChatPanel` 内：

```tsx
// 新增 state：保存弹窗
const [saveTarget, setSaveTarget] = useState<{ content: string; chatId?: number } | null>(null)
const [saveForm] = Form.useForm()

// 从一段回复文本里起个默认标题：第一行、去掉常见 Markdown 记号、截 50
const deriveTitle = (text: string) => {
  const firstLine = text.split('\n').find((l) => l.trim()) ?? '对话笔记'
  return firstLine.replace(/^#+\s*|^[-*]\s*|^>\s*/g, '').slice(0, 50)
}

// 判断当前选区是否落在某个气泡 DOM 里
const getSelectionInside = (bubbleEl: HTMLElement) => {
  const sel = window.getSelection()
  if (!sel || sel.isCollapsed) return ''
  const range = sel.getRangeAt(0)
  return bubbleEl.contains(range.commonAncestorContainer) ? sel.toString() : ''
}
```

Bubble footer 的按钮组（现有一对摆设按钮旁边）加一个「存为笔记」：

```tsx
<Button
  color="default" variant="text" size="small"
  icon={<BookOutlined />}
  onClick={(e) => {
    const bubbleEl = (e.currentTarget as HTMLElement).closest('.ant-bubble-content') // 以实际 DOM 结构为准
    const selected = bubbleEl ? getSelectionInside(bubbleEl) : ''
    setSaveTarget({ content: selected || item.content, chatId: item.id })
    saveForm.setFieldsValue({ title: deriveTitle(selected || item.content) })
  }}
/>
{/* 顺手把复制按钮接上 */}
<Button color="default" variant="text" size="small" icon={<CopyOutlined />}
  onClick={() => {
    navigator.clipboard.writeText(item.content)
    message.success('已复制')
  }}
/>
```

保存 Modal（渲染在 ChatPanel 里，`open={!!saveTarget}`）：

```tsx
<Modal title="保存为笔记" open={!!saveTarget} onCancel={() => setSaveTarget(null)}
  onOk={async () => {
    await saveForm.validateFields()
    const values = saveForm.getFieldsValue()
    const [err, res] = await createNote({
      ...values,
      workspaceId: workspace.id,
      sourceChatId: saveTarget.chatId,   // 没有就 undefined，后端存 NULL
    })
    if (res) {
      message.success('已保存为笔记')
      setSaveTarget(null)
      saveForm.resetFields()
    } else {
      message.error('保存失败：' + err.message)
    }
  }}>
  <Form form={saveForm}>
    <Form.Item name="title" label="标题" rules={[{ required: true }, { max: 50, message: '不超过 50 字' }]}>
      <Input />
    </Form.Item>
    <Form.Item name="description" label="描述">
      <Input.TextArea rows={2} maxLength={255} />
    </Form.Item>
    <Form.Item name="content" label="内容" rules={[{ required: true }]} initialValue={saveTarget?.content}>
      <Input.TextArea autoSize={{ minRows: 10 }} />
    </Form.Item>
  </Form>
</Modal>
```

细节：

- **流式进行中的气泡不显示保存按钮**：`item.id` 还不存在（done 事件没到）时隐藏，避免存出 `sourceChatId: undefined` 的笔记。
- 需要从 antd 引入 `Form`、`Input`（该文件已有），icons 引入 `BookOutlined`；`App.useApp()` 里再解构一个 `message`。
- `createNote` 从 `@/api/note` 引入（现成）。

### 2.4 验证与验收

1. 对话一轮，等流结束：气泡下出现「存为笔记」按钮；
2. 直接点击 → Modal 预填标题（首行）+ 完整回复 → 确认 → toast「已保存为笔记」；
3. 在回复里选中一段文字再点按钮 → Modal 内容预填**选中片段**；
4. 打开笔记列表/编辑页，确认新笔记存在；DB 里 `workspace_id` / `source_chat_id` 正确（`SELECT id, title, workspace_id, source_chat_id FROM note ORDER BY id DESC LIMIT 1`）;
5. 刷新页面后对**历史消息**重复上述操作（验证 item.id 来自列表接口的路径）。

- [ ] 以上全部通过
- [ ] `pnpm test:server` 全绿（本阶段后端只改了事件载荷，现有测试不应受影响）
- [ ] git commit：`feat(interface): 对话气泡保存为笔记 + done 事件携带消息 id`

---

## 阶段 3：`save_note` 工具（AI 主动沉淀，本计划的核心）

### 3.1 概念：第一个「写」工具，风险模型变了

`search_notes` / `get_note_detail` 是读工具，最坏结果是「多查了几次库」。`save_note` 是**写工具**，新的风险和对应的防线：

| 风险 | 防线 |
|---|---|
| 模型把笔记写进别人的库 | `Note.create(user, ...)` 的 user 来自闭包（同读工具） |
| 模型指定别人的 workspaceId / sourceChatId | 工具参数里**根本没有**这两个字段，由服务端注入 |
| 生成的标题超过 50 字，INSERT 报错 → 500 | zod `max(50)` + execute 里 `slice(0, 50)` 双保险 |
| 模型每轮都热情保存，笔记库被垃圾填满 | system prompt 明确约束触发条件 +「一次回复最多一条」 |
| 工具异常炸掉整个 generateText | try/catch 转结构化返回值（同读工具） |

### 3.2 扩展工具工厂签名

`buildNoteTools` 的第二参数从「纯 hooks」扩展为「上下文 + 回调」，**向后兼容**（现有调用只传 hooks，不受影响）：

```js
// server/tool/index.js
import { searchNotesTool } from './tools/search-notes.js'
import { getNoteDetailTool } from './tools/get-note-detail.js'
import { saveNoteTool } from './tools/save-note.js'

/**
 * @param {object} user              当前请求用户（闭包归属的唯一来源）
 * @param {object} [options]
 * @param {number} [options.workspaceId]   笔记归属的项目（服务端注入，模型不可指定）
 * @param {number} [options.sourceChatId]  来源消息 id（本轮用户消息的 chat 行 id）
 * @param {Function} [options.onNoteFound]   读工具命中回调（收集 references）
 * @param {Function} [options.onNoteSaved]   写工具成功回调（收集 savedNotes）
 */
export function buildNoteTools(user, options = {}) {
  const { workspaceId, sourceChatId, onNoteFound, onNoteSaved } = options
  return {
    search_notes: searchNotesTool(user, { onNoteFound }),
    get_note_detail: getNoteDetailTool(user, { onNoteFound }),
    save_note: saveNoteTool(user, { workspaceId, sourceChatId, onNoteSaved }),
  }
}
```

### 3.3 新建 `server/tool/tools/save-note.js`

注意：参数 schema 的字段名是 **`inputSchema`**（ai@6 的命名，`66a7e06` 那次 fix 就是把 `parameters` 改成它，别照抄旧文档）：

```js
import { tool } from 'ai'
import { z } from 'zod'
import Note from '../../models/note.js'

const TITLE_MAX = 50

export function saveNoteTool(user, { workspaceId, sourceChatId, onNoteSaved } = {}) {
  return tool({
    description:
      '把当前对话中产生的结论、方案或重要信息保存为一条笔记。' +
      '仅当用户明确要求保存（如"记下来""存成笔记"），或本轮讨论得出了值得长期保留的明确结论时才调用；' +
      '一次回复最多保存一条，保存后在回复中告知用户笔记标题。',
    inputSchema: z.object({
      title: z.string().min(1).max(TITLE_MAX).describe('笔记标题，不超过 50 字，概括核心结论'),
      content: z.string().min(1).describe('笔记正文，整理为适合日后阅读的独立内容，不要夹带对话语气'),
      description: z.string().max(255).optional().describe('一句话摘要，可选'),
    }),
    execute: async ({ title, content, description }) => {
      try {
        const id = await Note.create(user, {
          // 双保险的第二道：即使 zod 放行了超长标题（或未来 schema 被改坏），也截断兜底
          title: title.slice(0, TITLE_MAX),
          content,
          description,
          workspaceId,      // 服务端注入，模型无法指定
          sourceChatId,
        })
        onNoteSaved?.({ id, title: title.slice(0, TITLE_MAX) })
        return { saved: true, id, title }
      } catch (err) {
        return { saved: false, error: 'save_failed' }
      }
    },
  })
}
```

工具 description 里「不要夹带对话语气」这句值得留意：存下来的笔记是要脱离对话独立阅读的（还会被 `search_notes` 检索、被下一轮对话引用），description 是写给模型的提示词，这种措辞比任何代码都影响沉淀质量。

### 3.4 更新 system prompt

`server/tool/prompts.js` 在现有四条规则后追加：

```
5. 用户明确要求记录、保存，或本轮讨论形成了值得保留的结论时，调用 save_note 保存为笔记
   （标题自拟、不超过 50 字，正文整理成独立可读的内容），并在回复里告知已保存的标题；
6. 不要在用户没有要求、也没有明确结论的情况下主动保存笔记，宁可少存不要滥存。
```

### 3.5 chat.js 接入

```js
// 构建工具时注入上下文（阶段 0 已经捕获了 sourceChatId = 本轮用户消息 id）
const savedNotes = []
const tools = buildNoteTools(req.user, {
  workspaceId: Number(workspaceId),
  sourceChatId,
  onNoteFound: (ref) => { /* 现有 references 收集逻辑不变 */ },
  onNoteSaved: (note) => {
    if (!savedNotes.some((n) => n.id === note.id)) savedNotes.push(note)
  },
})
```

流式分支两处小改：

```js
} else if (part.type === 'tool-call') {
  if (part.toolName === 'search_notes') sendEvent({ type: 'status', value: '正在检索笔记…' })
  if (part.toolName === 'get_note_detail') sendEvent({ type: 'status', value: '正在读取笔记…' })
  if (part.toolName === 'save_note') sendEvent({ type: 'status', value: '正在保存笔记…' })   // 新增
}
// onNoteSaved 触发时机在工具 execute 内部（fullStream 的 tool-result 分片之前），
// 直接在回调里 sendEvent 即可：
onNoteSaved: (note) => sendEvent({ type: 'note-saved', note })
```

非流式分支响应升级：`data: { content: result.text, references, savedNotes, chatId }`。

### 3.6 前端：`note-saved` 事件

`utils/sse.ts` 类型加一行：

```ts
| { type: 'note-saved'; note: { id: number; title: string } }
```

`handleStreamChat` 的 feed 回调：

```ts
if (evt.type === 'note-saved') last.savedNotes = [...(last.savedNotes || []), evt.note]
```

气泡 footer 里 references Tag 旁边渲染保存结果（绿色、图标区分）：

```tsx
{item.savedNotes?.length ? (
  <Space wrap size={4}>
    {item.savedNotes.map((n) => (
      <Tag key={n.id} icon={<FileDoneOutlined />} color="green" className="cursor-pointer"
        onClick={() => navigate(`/note/edit/${n.id}`)}>
        已保存：{n.title}
      </Tag>
    ))}
  </Space>
) : null}
```

### 3.7 测试

扩展 `server/test/chat-tools.test.js`（mock 套路完全复用，`mockState` 加一个 `'save'` 模式）：

```js
// mockState.mode === 'save' 时的 doGenerate 序列：
// 第一次返回 tool-call：{ toolName: 'save_note', input: JSON.stringify({ title: '缓存结论', content: '...' }) }
// 第二次返回文本
const saveThenText = mockValues(
  {
    finishReason: 'tool-calls',
    usage: { inputTokens: 10, outputTokens: 5 },
    content: [{
      type: 'tool-call', toolCallId: 'call-save-1', toolName: 'save_note',
      input: JSON.stringify({ title: '缓存结论', content: 'cache-aside 适合读多写少场景' }),
    }],
  },
  textStop,
)
```

三组断言：

1. **HTTP 全链路**：`POST /api/chat` 后，`GET /api/note/page` 能查到这条笔记，且 `workspaceId` / `sourceChatId`（= 本轮用户消息 id）正确；`res.body.data.savedNotes` 含 `{ id, title }`；chat 表落了 assistant 消息。
2. **超长标题不 500**：mock 让模型返回 80 字标题 → 响应 200，笔记标题被截为 50 字（zod max 拦截时 SDK 会把 invalid-args 作为工具错误回传模型、不会抛出；execute 的 slice 是第二道保险——两层防线各测一次最好，至少测「整体不崩 + 最终落库 ≤ 50 字」）。
3. **工具直测**：`buildNoteTools({ id: aliceId }, { workspaceId: 1 }).save_note.execute({...})` 创建的笔记 `user_id` 是 alice——写路径的归属由闭包保证，与他人无关。

再加一条**行为回归**（防模型滥存的 prompt 约束没法单测，但读写互不干扰可以测）：`mode === 'plain'` 的现有用例断言 `savedNotes` 为空数组。

### 3.8 动手验证（真实模型）

1. 对话里讨论出一个结论后说「把这个结论记成笔记」→ 回复中途出现「正在保存笔记…」状态，结尾气泡下出现绿色「已保存：xxx」Tag；
2. 点 Tag 跳 `/note/edit/:id`，内容完整、语气独立；
3. 问一个普通问题（不提保存）→ 正常回答，无绿色 Tag，`GET /api/note/page` 无新增；
4. 让模型检索旧笔记再保存新结论（读 + 写组合）→ references 和 savedNotes 同时出现，`TOOL_MAX_STEPS = 5` 内完成。

### 3.9 验收清单

- [ ] 三组 mock 测试通过；越权/超长标题用例通过
- [ ] 真实模型：显式要求能保存、不要求不保存、读写组合正常
- [ ] `pnpm test:server` 全绿；git commit：`feat(server): save_note 工具——AI 对话沉淀为笔记`

### 3.10 本阶段常见坑

- 参数 schema 写成 `parameters`（v4 时代的名字）→ 工具注册失败或模型拿不到参数描述，`66a7e06` 修过一次，别再踩；
- `workspaceId` 从 `req.params` 取出来是**字符串**，MySQL 数字列比较虽宽松，但 `onNoteSaved` 回传和测试断言会翻车——注入前 `Number()` 一下；
- 在工具 execute 里 `throw` 让「保存失败」冒泡 → 整个对话 500；失败要转成 `{ saved: false }` 让模型自己向用户解释；
- system prompt 只写「可以保存」不写「什么时候不要保存」→ 模型每轮都存，笔记库迅速垃圾化。

---

## 阶段 4：可选进阶（不排期，记录方向）

### 4.1 自动摘要版保存

Modal 里加「保存摘要版」选项：后端新增 `POST /api/chat/:workspaceId/summarize`（用挂载的模型把选中回复压成摘要笔记）——它同时就是 roadmap 任务 1.3「会话总结」的雏形，建议届时合并成一份计划做。

### 4.2 来源回跳

笔记编辑页展示「来自对话」徽标，点击跳回 `/chat` 并选中对应 workspace（需要 workspace store 联动 + `source_chat_id` 反查 workspace）。完成后「知识可回链」就是双向的了。

### 4.3 项目笔记聚合视图

`Note.findAll` 的 `filters.workspaceId` 已就绪，workspace 详情页/首页视图（roadmap 任务 1.5）直接消费：展示「该项目下的所有笔记」。

### 4.4 检索缓存失效

mcp 计划阶段 4.1 的版本号失效方案仍未做；`save_note` 落地后写入口又多一个，届时一并 INCR `aura:mcp:ver:user:{id}`。

---

## 附录 A：两条保存路径的差异速查

| | 手动保存（阶段 2） | AI 保存（阶段 3） |
|---|---|---|
| 字段来源 | 前端 Modal（用户可编辑） | 模型生成（title/content/description） |
| workspaceId | 前端传当前 workspace，端点校验归属 | 服务端从路由参数注入 |
| sourceChatId | assistant 消息 id（done 事件/列表接口） | 本轮用户消息 id（`Chat.create` 返回值） |
| 长度校验 | Form rules（max 50/255）+ 端点 Validator | zod max + execute slice 双保险 |
| 失败表现 | toast「保存失败」 | `{ saved: false }` → 模型在回复里告知用户 |

## 附录 B：安全清单（评审时逐条打勾）

- [ ] `save_note` 的 `Note.create` user 来自闭包，全项目搜索确认工具路径没有裸调用 `Note.create(body.xxx)`
- [ ] 工具参数 schema 不含 workspaceId / sourceChatId / userId，归属信息只能服务端注入
- [ ] note POST/PUT 的 body 外键（workspaceId / sourceChatId）逐一查库校验归属，他人资源返回 400
- [ ] 标题 50 / 描述 255 的长度约束：zod、execute 截断、端点 Validator、DB 列宽四层对齐
- [ ] `save_note` 只 INSERT 不 UPDATE/DELETE，无法覆盖已有笔记
- [ ] 工具执行异常转为 `{ saved: false }` 返回值，不向模型透出 SQL 细节
- [ ] 写工具与读工具共享同一 `TOOL_MAX_STEPS` 预算，仍在 `rateLimit`（30 次/小时）的请求预算内

## 附录 C：文件变更一览

```diff
server/
├── endpoints/chat.js            # 阶段 0 修消息组装；阶段 2 done 带 chatId；阶段 3 注入上下文 + note-saved 事件
├── endpoints/note.js            # 阶段 1 body 外键归属校验 + 字段放行
├── models/note.js               # 阶段 1 create/update/findAll 支持新列
├── tool/index.js                # 阶段 3 buildNoteTools options 扩展
├── tool/prompts.js              # 阶段 3 追加保存规则 5/6
+ ├── tool/tools/save-note.js    # 阶段 3 写工具
├── sql/init.sql                 # 阶段 1 note 表加列
+ └── sql/migrations/20260916_note_source_linkage.sql
server/test/
+ ├── chat-prompt.test.js        # 阶段 0 输入断言
+ └── note-source.test.js        # 阶段 1 归属校验（或并入 note.test.js）
└── chat-tools.test.js           # 阶段 3 save 模式扩展
interface/src/
├── utils/sse.ts                 # done.chatId、note-saved 事件类型
└── pages/chat/index.tsx         # 保存按钮/Modal、复制、savedNotes Tag
```

## 附录 D：四个阶段各自的「一句话收获」

- 阶段 0：mock 不止能断言输出——把「喂给模型的输入」也纳入测试射程，回归才防得住。
- 阶段 1：中间件守路由参数，body 里的外键没人守——归属校验的位置跟着「不可信输入的入口」走。
- 阶段 2：最好的保存体验是「预填到只剩确认」——来源 id 要在协议里（done 事件）提前埋好。
- 阶段 3：写工具 = 读工具的归属纪律 + 圈死爆炸半径（只创建、限长度、控频率）。
