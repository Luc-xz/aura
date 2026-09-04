# Redis 接入开发计划（新手向）

> 目标：通过 4 个真实有用的功能点学会 Redis 最核心的使用模式。
> 原则：**Redis 只是加速器，不是系统依赖**——它挂掉时系统必须和没有它时跑得一样好。
> 前置要求：会跑 `pnpm dev:server`、会用项目里的 `.http` 文件或 curl 调接口。

---

## 0. 这份计划怎么用

### 0.1 总览

| 阶段 | 功能点 | 学到的 Redis 模式 | 难度 | 预计耗时 |
|---|---|---|---|---|
| 0 | 环境准备 + 连接封装 | 连接、命令、降级 | ★ | 半天 |
| 1 | 模型列表缓存 | String 读写、TTL、cache-aside | ★ | 半天 |
| 2 | RBAC 权限缓存 | **缓存失效**（核心课题） | ★★★ | 1~2 天 |
| 3 | 登出 + JWT 黑名单 | 带 TTL 的黑名单、补齐缺失功能 | ★★ | 1 天 |
| 4 | AI 对话限流 | INCR 原子计数、429 | ★★ | 1 天 |

每个阶段独立提交一个 git commit，出问题可以单独回滚，不影响其他阶段。

### 0.2 贯穿全程的四条纪律

1. **所有 Redis 读都降级**：读失败当"缓存未命中"处理，回源 MySQL。
2. **所有 Redis 写都降级**：写失败只打日志，不影响业务主流程。
3. **key 必须有 `aura:` 前缀**，并且遵循命名规范（见 0.5）。
4. **每写一个缓存，就必须回答"它什么时候失效"**（阶段 2 会深挖这条）。

---

## 阶段 0：环境准备与连接封装

### 0.1 先理解 Redis 是什么

一句话：**一个跑在内存里的键值数据库**。

- MySQL 把数据存在磁盘上、按表和列组织；Redis 把数据存在内存里、只有 `key → value` 这一种结构。
- 因为内存在磁盘前面，读写快 2~4 个数量级，所以它常被当作"缓存"用：把慢的查询结果放一份在 Redis 里，下次先查它。
- 它是**单线程**处理命令的，所以每条命令天然"原子"（阶段 4 会用到这个特性）。
- 内存比磁盘贵，所以 Redis 里的数据通常都带**过期时间（TTL, Time To Live）**，到期自动删除——这就是它适合做缓存、验证码、黑名单的原因。

### 0.2 用 Docker 启动本地 Redis

Windows 上最省事的起法（需要已装 Docker Desktop）：

```bash
docker run -d --name aura-redis -p 6379:6379 redis:7-alpine
```

逐段解释：
- `-d`：后台运行。
- `--name aura-redis`：起个名字，方便以后 `docker stop/start aura-redis`。
- `-p 6379:6379`：把容器内的 6379 端口（Redis 默认端口）映射到本机 6379。
- `redis:7-alpine`：Redis 7 的精简镜像。

日常操作：

```bash
docker start aura-redis    # 开机后重新启动
docker stop aura-redis     # 停掉（阶段 2 的降级演练会用到）
docker logs aura-redis     # 看日志
```

### 0.3 redis-cli 初体验

先进交互式客户端：

```bash
docker exec -it aura-redis redis-cli
```

依次执行，感受一下（`#` 后面是解释，不用输）：

```
PING                     # 服务器回 PONG，连接正常
SET hello world          # 存一个 key，value 是 "world"
GET hello                # 读出来 → "world"
SETEX session:1 60 abc   # 存 "abc"，60 秒后自动删除
TTL session:1            # 查剩余存活秒数 → 60（倒数中）
DEL hello                # 删除 key
KEYS *                   # 列出所有 key（只在学习时用！生产禁用，原因见阶段 2）
```

对新手最重要的一个认知：**Redis 里只能存字符串**（准确说是字节串）。所以存数组/对象要先 `JSON.stringify`，读出来要 `JSON.parse`。整个项目会反复用到这一对操作。

### 0.4 安装 ioredis

Node 生态里两个主流客户端：`redis`（官方）和 `ioredis`（社区）。选 **ioredis**：API 更直观、断线自动重连、报错信息友好。

```bash
pnpm --filter aura-server add ioredis
```

### 0.5 编写 `server/utils/redis.js`（本计划最重要的一个文件）

先定 **key 命名规范**，后面所有阶段都遵守：

```
aura:{模块}:{标识}[:{字段}]
例如：
  aura:models:all                  模型列表全量数据
  aura:rbac:user:1:roles           用户 1 的角色列表
  aura:rbac:user:1:perms           用户 1 的权限列表
  aura:jwt:blacklist:{jti}         被登出的 token
  aura:limit:chat:user:1           用户 1 的对话计数器
```

为什么这样设计：
- Redis 所有 key 在同一个扁平空间里，没有"库表"概念；冒号分层只是社区约定，但各种 GUI 工具会按冒号显示成树，方便人看。
- `aura:` 前缀防止将来这个 Redis 被多个项目共用时互相踩踏，也方便一键清理。

然后写文件（参照 `sql/index.js` 的风格——集中管理连接，全项目共用一个实例）：

```js
// server/utils/redis.js
import Redis from 'ioredis'
import { logger } from './logger.js'

// REDIS_ENABLED=false 时所有缓存函数直接放行（测试环境用它彻底隔离 Redis）
const enabled = process.env.REDIS_ENABLED !== 'false'

// lazyConnect: 创建实例时不立即连接，等真正发第一条命令才连
// maxRetriesPerRequest: 1 —— 一条命令最多重试 1 次就报错。
//   不设的话，Redis 挂掉时命令会在离线队列里无限等待，请求会卡死而不是降级
const redis = enabled
  ? new Redis({
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: Number(process.env.REDIS_PORT || 6379),
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      retryStrategy: (times) => Math.min(times * 200, 2000) // 断线后自动重连，间隔递增，最长 2 秒
    })
  : null

// 不挂 error 监听的话，连接报错会变成未捕获异常直接把进程打崩 —— 这是 Node 的规则
redis?.on('error', (err) => {
  logger.warn(`[redis] connection error: ${err.message}`)
})

/**
 * 读缓存。任何失败都返回 null（= 未命中），调用方回源数据库即可。
 * 记住约定：value 统一存 JSON 字符串。
 */
export async function cacheGet(key) {
  if (!redis) return null
  try {
    const raw = await redis.get(key)
    return raw === null ? null : JSON.parse(raw)
  } catch (err) {
    logger.warn(`[redis] GET ${key} failed: ${err.message}`)
    return null
  }
}

/**
 * 写缓存，带过期时间（秒）。失败只打日志 —— 缓存写不进去不影响正确性，只影响下次的速度。
 */
export async function cacheSet(key, value, ttlSeconds) {
  if (!redis) return
  try {
    await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds)
  } catch (err) {
    logger.warn(`[redis] SET ${key} failed: ${err.message}`)
  }
}

/** 删缓存（缓存失效用，阶段 2 的主角）。 */
export async function cacheDel(...keys) {
  if (!redis || keys.length === 0) return
  try {
    await redis.del(...keys)
  } catch (err) {
    logger.warn(`[redis] DEL ${keys.join(',')} failed: ${err.message}`)
  }
}

export default redis
```

逐个讲解设计决策：

- **为什么所有函数都 try/catch？** 这就是"降级"的落点。`cacheGet` 失败返回 `null`，调用方的代码路径和"缓存里没有"完全一样——自动回源 MySQL；`cacheSet`/`cacheDel` 失败只是少了一次加速或晚几秒生效（有 TTL 兜底），业务照样正确。**有了这层封装，Redis 从"依赖"降级成了"可选组件"**，这是本计划所有安全感的来源。
- **为什么 `maxRetriesPerRequest: 1`？** ioredis 默认会把 Redis 挂掉期间的命令排队等待重连，请求会一直挂着。我们要的是"快速失败、马上降级"，所以限制重试次数。
- **为什么 `raw === null` 判断而不是 falsy？** `redis.get` 对不存在的 key 返回 `null`；而空字符串 `''`、空数组 `'[]'` 都是合法的缓存值。用 `if (!raw)` 会把空数组误判成未命中（阶段 2 存的角色列表可能就是 `[]`）。
- **一个已知边界**：如果某天要缓存的对象本身可能是 `null`，`JSON.parse('null')` 得到 `null` 会被误判为未命中。我们的场景里 value 全是数组/对象，不受影响，但要知道这个坑存在。

### 0.6 在 `index.js` 里触发首次连接

```js
// server/index.js 里，app.listen 之后加：
import redis from './utils/redis.js'
redis?.connect().catch(() => {}) // 只触发连接，失败不阻塞启动（错误由 error 监听记日志）
```

（`connect()` 因为设了 `lazyConnect: true` 才需要手动调。不加这行也能跑通——第一条命令会触发连接——但启动时就连上、启动时就发现 Redis 没开，排错更直观。）

### 0.7 让测试与 Redis 彻底无关

打开 `server/test/setup.js`，在 `process.env.NODE_ENV = 'test'` 后面加一行：

```js
process.env.REDIS_ENABLED = 'false'
```

讲解：现有测试（vitest + aura_test 库）只应该测 MySQL 逻辑。加这行后 `utils/redis.js` 里 `redis` 为 `null`，所有缓存函数直接放行，鉴权/接口测试的行为和接入前完全一致。**每完成一个阶段都跑一次 `pnpm test:server`，全绿才提交**——这同时验证了"降级路径没有破坏原逻辑"。

### 0.8 阶段验收清单

- [ ] `docker exec -it aura-redis redis-cli` 里 `PING` 返回 PONG
- [ ] `pnpm dev:server` 启动无报错
- [ ] `docker stop aura-redis` 后接口依然全部正常（日志里出现 `[redis]` 警告，属预期）
- [ ] `pnpm test:server` 全绿

---

## 阶段 1：模型列表缓存（String + TTL）

### 1.1 现状与问题

`server/endpoints/models.js` 现在的逻辑：

- 模块级变量 `data` / `providerList` 存着 models.dev 的全量数据；
- `fetchData()` 拉取远端并更新这两个变量；
- `CronJob` 每天零点自动刷一次；
- 两个 GET 端点读内存变量，为空时现场拉一次。

问题：**进程重启，缓存就没了**（数据回到内存变量初始值，首个请求要现场等 models.dev 响应）。单实例下这不致命，但它是最理想的练手场景：数据只读、TTL 以天计、错了顶多慢一点，怎么改都不会出安全事故。

### 1.2 概念讲解：cache-aside（旁路缓存）模式

```
请求 → 查 Redis ──命中──→ 直接返回
              └─未命中──→ 查数据源 → 写回 Redis（带 TTL）→ 返回
```

这是使用率最高的缓存模式，要点：
- **读**：先缓存后数据源，未命中要"写回"，让下一次命中。
- **写回必须带 TTL**：即使忘了主动删缓存，它也会自动过期。TTL 是缓存的"安全网"。
- Redis 只存字符串，所以写回前 `JSON.stringify`（已封装在 `cacheSet` 里）。

### 1.3 改造步骤

**第 1 步：`fetchData` 拉到数据后写缓存。**

```js
const fetchData = async () => {
  const res = await fetch('https://models.dev/api.json')
  data = await res.json()
  providerList = Object.keys(data || {})
  // 新增：全量数据写入 Redis，7 天过期（每天 cron 会刷新，7 天是"漏刷也不至于失效"的冗余）
  await cacheSet('aura:models:all', data, 7 * 24 * 3600)
}
```

讲解：保留内存变量 `data`/`providerList`——它们降级为"Redis 挂掉时的本地兜底"，双保险。

**第 2 步：新增统一的取数函数。**

```js
const MODELS_KEY = 'aura:models:all'

const getModelsData = async () => {
  const cached = await cacheGet(MODELS_KEY)
  if (cached) return cached          // 命中：不再碰内存变量和远端
  await fetchData()                  // 未命中：拉远端（内部会写回缓存）
  return data                        // 返回内存兜底值
}
```

**第 3 步：两个端点改读 `getModelsData()`。**

- `GET /provider-list`：`const models = await getModelsData()`，然后 `Object.keys(models)`。
- `GET /:provider/model-list`：同样取 `models` 后 `Object.keys(models[provider]?.models || {})`。

cron 不用动——它每天调 `fetchData`，天然会刷新缓存。

### 1.4 动手验证

```bash
# 1. 重启 server，调一次 /api/models/provider-list
# 2. 进 redis-cli 查看：
KEYS aura:*                # 能看到 aura:models:all
TTL aura:models:all        # ≈ 604800（7 天）
STRLEN aura:models:all     # 一大坨 JSON 的长度
# 3. 杀掉 server 重启，再调一次接口 —— 响应立刻返回（缓存跨进程存活了，这就是和内存变量的本质区别）
```

### 1.5 验收清单

- [ ] 重启 server 后首个模型接口响应明显快于改造前
- [ ] `redis-cli` 能看到 key 且 TTL 正常倒数
- [ ] `docker stop aura-redis` 后接口仍正常（走内存兜底）
- [ ] `pnpm test:server` 全绿

---

## 阶段 2：RBAC 权限缓存（核心课题：缓存失效）

> 这是四个阶段里最值得花时间的一步。写缓存谁都会，**让缓存和数据源保持一致**才是缓存真正的难点。

### 2.1 现状与问题

`server/middlewares/rbac.js` 的 `loadAuthContext`：每个带鉴权的请求都要查 `Rbac.getUserRoles` + `Rbac.getUserPermissions`（后者内部还会再查一次角色）——**每个请求 2~3 条 SQL**。个人项目流量下无所谓，但权限数据"读极多、写极少"，是教科书级的缓存对象。

### 2.2 概念讲解：缓存一致性

难点一句话：**数据库变了，缓存还是旧的，怎么办？** 对权限数据这尤其严重——把别人的角色撤了，他的缓存里还有旧权限，这就是安全漏洞。

标准答案是一套组合拳：

1. **主动失效（保证正确）**：每个会改数据的写入口，写完数据库后立刻 `DEL` 对应缓存 key。下次读取未命中，回源重建。
2. **TTL 兜底（保证下限）**：就算漏了某个写入口没加 DEL，缓存最多活 5 分钟，错误数据的影响被时间封顶。

为什么权限缓存 TTL 选 5 分钟（而不是模型的 7 天）：数据越"敏感"，TTL 越短——模型列表错一天无所谓，权限错 5 分钟都是事故。

### 2.3 key 设计

```
aura:rbac:user:{id}:roles    → ["admin","editor"]   TTL 300 秒
aura:rbac:user:{id}:perms    → ["note:create",...]  TTL 300 秒
```

两个 key 而不是一个 `aura:rbac:user:{id}` 整包？这里其实一个整包 key 更好维护（一次读、一次失效）。两种都可行，**建议用整包**：

```
aura:rbac:user:{id}    → { "roles": [...], "perms": [...] }   TTL 300 秒
```

理由：读一次、写一次、失效一次，操作数最少；且 roles 和 perms 天然来自同一次上下文加载，不会出现"roles 新 perms 旧"的半新半旧状态。

### 2.4 改造步骤：读路径

**第 1 步：新建 `server/utils/rbac-cache.js`。**

```js
import Rbac from '../models/rbac.js'
import { cacheGet, cacheSet, cacheDel } from './redis.js'
import { logger } from './logger.js'

const keyOf = (userId) => `aura:rbac:user:${userId}`
const TTL = 300 // 5 分钟：权限数据的错误存活上限

/** 读：缓存命中直接返回，未命中回源 MySQL 并写回缓存 */
async function getAuthContext(userId) {
  const cached = await cacheGet(keyOf(userId))
  if (cached) {
    logger.info(`[rbac-cache] hit user:${userId}`)
    return cached
  }
  // 回源：一次并行取两个结果（原来是串行 2~3 条 SQL）
  const [roles, perms] = await Promise.all([
    Rbac.getUserRoles(userId),
    Rbac.getUserPermissions(userId),
  ])
  const ctx = { roles, perms }
  await cacheSet(keyOf(userId), ctx, TTL)
  logger.info(`[rbac-cache] miss user:${userId}`)
  return ctx
}

/** 写：指定用户的缓存立刻失效（分配/撤销角色后调用） */
async function invalidateUser(userId) {
  await cacheDel(keyOf(userId))
}

/** 写：全量失效（角色/菜单权限定义变化后调用，见 2.5 的解释） */
async function invalidateAll() {
  // 用 SCAN 分批找 key 再删，而不是 KEYS —— KEYS 会一次性遍历全库，
  // Redis 单线程，key 多时会卡住所有业务请求；SCAN 分批游标遍历，不阻塞
  // （本地下 KEYS 也没事，但从第一天就养成正确习惯）
  const { scanDel } = await import('./redis-scan.js')
  await scanDel('aura:rbac:user:*')
}

export { getAuthContext, invalidateUser, invalidateAll }
```

（`scanDel` 的实现在下面第 3 步。）

**第 2 步：`middlewares/rbac.js` 的 `loadAuthContext` 改用它。**

```js
export const loadAuthContext = async (req, res, next) => {
  const userId = req.user?.id
  if (!userId) throw Unauthorized('no user session found')
  req.auth = await getAuthContext(userId)
  next()
}
```

顺带 `isSuperAdmin(userId)` 也可以改成读 `getAuthContext(userId).roles`，免费享受缓存。

**第 3 步：`server/utils/redis-scan.js` —— SCAN 批量删除。**

```js
import redis from './redis.js'

/** 用 SCAN 游标分批匹配 key 并删除，避免 KEYS 阻塞 */
export async function scanDel(pattern) {
  if (!redis) return
  let cursor = '0'
  do {
    const [next, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100)
    cursor = next
    if (keys.length) await redis.del(...keys)
  } while (cursor !== '0')
}
```

讲解 SCAN：它每次只扫一小批（`COUNT`），返回一个游标，你拿着游标继续扫，直到游标回到 `'0'`。期间 Redis 还能正常服务其他请求。代价是"扫的时候 key 可能正好变了"这类小概率不一致——对删缓存这种场景无所谓。

### 2.5 改造步骤：写路径（本阶段的灵魂）

**排查看不见的坑的方法**：找出所有会改动这三张表的端点——`user_role`（谁有什么角色）、`role_menu`（角色有什么权限）、`menu`（权限码定义）。已经帮你找齐了：

| 写入口 | 位置 | 影响谁的缓存 | 失效动作 |
|---|---|---|---|
| `PUT /user/:id/roles` 分配角色 | `endpoints/user.js:225` | 该用户 | `invalidateUser(id)` |
| `DELETE /user/:id` 删用户 | `endpoints/user.js:205` | 该用户（卫生起见） | `invalidateUser(id)` |
| `PUT /role/:id` 改角色 | `endpoints/role.js:103` | 所有挂该角色的用户 | `invalidateAll()` |
| `DELETE /role/:id` 删角色 | `endpoints/role.js:136` | 同上 | `invalidateAll()` |
| `PUT /role/:id/menus` 改角色权限 | `endpoints/role.js:174` | 同上 | `invalidateAll()` |
| `PUT /menu/:id`、`DELETE /menu/:id` 改菜单 | `endpoints/menu.js:81,125` | 全体（权限码定义变了） | `invalidateAll()` |

为什么角色级变更用"全量清空"而不是精确删除：要精确删就得先查出"哪些用户挂了这个角色"再逐个删，多一次查询且容易漏；而这种管理操作一天发生不了几次，直接把 `aura:rbac:user:*` 清光的成本可以忽略。**缓存的失效策略里，"简单粗暴但不会错"经常优于"精确但容易漏"**。更优雅的版本号方案（改一次全局版本、key 带版本号）留作以后的进阶阅读。

写法都一样，在 `await Rbac.xxx(...)` 数据库写成功**之后**加一行：

```js
// endpoints/user.js 的 PUT /:id/roles 处理器里：
await Rbac.assignRolesToUser(id, roleIds)
await invalidateUser(id)   // ← 加这一行
```

注意顺序：**先写库、后删缓存**。反过来会出现"删了缓存、库还没写完、别的请求把旧数据又载入缓存"的窗口。

### 2.6 动手验证

1. **看命中**：登录一个测试号，连调两次 `/api/user/profile`，日志应显示第一次 `miss`、第二次 `hit`；`redis-cli` 里能看到 `aura:rbac:user:{id}`，`TTL` 在 300 以内倒数。
2. **看失效生效**：用超管给测试号分配新角色 → **不重启、不等待**，立即用测试号调需要新权限的接口 → 应该直接放行（说明 `invalidateUser` 精确命中）。
3. **看 TTL 兜底**（故意制造一个 bug 来理解它）：临时注释掉 `PUT /user/:id/roles` 里的 `invalidateUser`，撤销某用户角色，发现他 5 分钟内还保留旧权限 → 这就是"漏加失效"的后果，TTL 把损害封了顶。看完记得把代码改回来。
4. **看降级**：`docker stop aura-redis`，所有接口正常，日志刷 `[redis]` 警告；`docker start aura-redis` 后自动恢复。

### 2.7 验收清单

- [ ] 同一用户连续请求，第二次起日志显示 cache hit，MySQL 不再查角色表（可用日志确认）
- [ ] 分配/撤销角色后立即生效（无需等 TTL）
- [ ] 停 Redis 系统正常
- [ ] `pnpm test:server` 全绿
- [ ] git commit

### 2.8 本阶段常见坑

- 漏掉某个写入口的失效（2.5 的表格就是自查清单）；
- 先删缓存后写库（顺序反了，见上文）；
- 缓存了 `[]` 之后以为没缓存——`'[]'` 是合法值不是 miss（阶段 0 讲过 `raw === null` 的判断就是为这个）；
- TTL 图省事设得很长——权限数据不可以。

---

## 阶段 3：登出 + JWT 黑名单

### 3.1 现状与问题：为什么 JWT"登不出"

`middlewares/auth.js` 只做 `jwt.verify`——验签名、验过期，**全程不查任何存储**。这是 JWT 的设计哲学：token 自带全部信息，服务端无状态。

代价：token 发出去就收不回了。就算前端删掉本地存储，那串字符在 3 天过期前依然有效，拿它直接 curl 仍能通过鉴权。前端侧边栏的退出按钮（`interface/src/components/layout/index.tsx:86` 的 `handleLogout`）目前只是 `clearUser()` 清本地状态+跳登录页，**服务端根本不知道这次登出**。

要让"登出"在服务端也成立，必须让服务端开始记一点状态——这正是 Redis 的经典用武之地。

### 3.2 概念讲解：黑名单模式

思路：登出时，把 token 的唯一编号记进 Redis；每次鉴权多查一眼"这个编号在不在黑名单里"。

两个关键设计：

1. **存 `jti` 而不是整个 token**。JWT 标准头里有个可选声明 `jti`（JWT ID），登录签发时填一个随机 UUID。黑名单 key 是 `aura:jwt:blacklist:{jti}`，只存个 `1`。好处：key 短；同一用户多设备登录会有多个 token、多个 jti，登出哪个设备只死哪个设备（另外的设备不受影响）——这是符合直觉的产品语义。
2. **TTL = token 剩余存活时间**。token 本身 3 天后自然过期、永远失效，黑名单记录陪它活同样长就够了。登出时读出 token 的 `exp`（过期时间戳），`剩余秒数 = exp - now`，拿它当 TTL。**过期数据自动清理，黑名单永远不会无限膨胀**——这是"TTL 巧用"的最佳教学案例。

### 3.3 改造步骤

**第 1 步：签发时加 `jti`**（`endpoints/user.js:149`）：

```js
import { randomUUID } from 'node:crypto'

const token = jwt.sign({ id, name, email }, process.env.JWT_SECRET, {
  algorithm: 'HS256',
  expiresIn: '3 days',
  jwtid: randomUUID(), // ← 新增：每个 token 一个唯一编号
})
```

**第 2 步：新增 `POST /user/logout`**（放在 `endpoints/user.js`，挂在已有 `withAuthContext` 链上）：

```js
router.post('/logout', ...withAuthContext, asyncHandler(async (req, res) => {
  // authMiddleware 已经验过签名，这里只做解码拿 payload（jwt.decode 不需要密钥）
  const token = req.headers.authorization?.split(' ')[1]
  const payload = jwt.decode(token)
  const remaining = Math.ceil(payload.exp - Date.now() / 1000) // 剩余秒数
  if (payload.jti && remaining > 0) {
    // 黑名单只陪 token 活到它自然过期的那一刻
    await cacheSet(`aura:jwt:blacklist:${payload.jti}`, 1, remaining)
  }
  res.status(200).json({ code: 200, message: 'success' })
}))
```

**第 3 步：`middlewares/auth.js` 验签后查黑名单**：

```js
jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
  if (err) { /* 原有 401 逻辑不变 */ }

  const blacklisted = await cacheGet(`aura:jwt:blacklist:${decoded.jti}`)
  if (blacklisted) {
    return res.status(401).json({ code: 401, message: 'token invalidated' })
  }

  req.user = decoded
  next()
})
```

（注意：加了 `await` 后回调要改成 `async`。`cacheGet` 失败返回 `null` = 视为不在黑名单 = 放行，降级逻辑自动生效。）

**第 4 步：前端退出按钮调用登出接口**（`interface/src/components/layout/index.tsx:86`）：

```ts
const handleLogout = async () => {
  try {
    await userApi.logout() // 必须先带着 token 调（清了本地状态就没有 Authorization 头了）
  } catch {
    // 服务端调不通也要完成本地登出，不能把用户困在页面里
  }
  clearUser()
  navigate('/login', { replace: true })
}
```

`src/api/user/` 下补一个 `logout` 方法即可。**顺序很关键**：请求拦截器从用户 store 里取 token 拼 `Authorization` 头（见 `src/http/request.ts:13`），所以必须"先调接口、后清状态"。

### 3.4 动手验证

用 `test/user.http` 或 curl：

1. 登录拿 token → 调 `/api/user/profile` → 200；
2. 调 `POST /api/user/logout` → 200；`redis-cli` 里 `KEYS aura:jwt:blacklist:*` 能看到记录，`TTL` 约 259200（3 天）；
3. **用同一个 token** 再调 `/api/user/profile` → 401 `token invalidated`；
4. 重新登录拿新 token → 200（新 jti 不在黑名单）；
5. 浏览器点退出 → 老手动复制出的 token 同样已失效。

### 3.5 验收清单

- [ ] 登出后的 token 调任何受保护接口返回 401
- [ ] 重新登录不受影响（黑名单按 jti 精确打击）
- [ ] 黑名单 key 的 TTL ≈ token 剩余寿命，过期自动消失
- [ ] `docker stop aura-redis` 时登出接口不报错（只是黑名单暂时记不上）
- [ ] `pnpm test:server` 全绿；git commit

### 3.6 安全权衡（必读）

停 Redis 期间，黑名单读不到（已登出的 token 会"复活"至多 3 天）、也写不进去。我们选择**可用性优先**（放行）而不是拒绝所有人，和"Redis 只是加速器"的总原则一致。代价要想清楚：这是四个功能里唯一涉及安全语义的，如果将来 Aura 上生产、对安全要求变高，这里的降级策略要重新评估（fail-closed，或换成短期 token + refresh 机制）。

---

## 阶段 4：AI 对话接口限流

### 4.1 现状与问题

`endpoints/chat.js` 的 `POST /:workspaceId` 每调一次就消耗一次真实模型调用（花钱），目前无任何频率限制。被脚本刷接口 = 直接烧钱。限流也是 Redis 官方宣传页排前二的的使用场景（另一个就是缓存）。

### 4.2 概念讲解：固定窗口计数

算法：`key = aura:limit:chat:user:{id}`，每请求 `INCR` 一次；计数从 0 变 1（窗口第一条）时给 key 设 `EXPIRE` 窗口时长；超过上限就返回 429。

要理解的三件事：

1. **`INCR` 是原子的**。两个请求同时 INCR 同一个 key，Redis 单线程逐条执行，结果一定是 1 和 2，不会丢计数。这就是"用 Redis 做计数器不用加锁"的底气（对比：Node 里两个 async 同时读改写一个内存变量是会丢的）。
2. **INCR 和 EXPIRE 是两条命令，中间有缝隙**：如果 INCR 之后进程崩了、EXPIRE 没执行，这个 key 就**永不过期**，用户会被永久限流。修补办法是自愈检查：每次发现 key 的 `TTL` 是 `-1`（永生）就补一个 EXPIRE。生产级方案是用 Lua 脚本把两条命令打包成原子操作，留作进阶。
3. **429 是标准状态码**（Too Many Requests），配合 `Retry-After` 头告诉客户端还有几秒能重试，这是 HTTP 协议里定义好的语义。

这个算法叫"固定窗口"，它有个已知瑕疵：窗口边界两侧可以短暂打出 2 倍流量（第 59 秒 20 次 + 第 61 秒 20 次）。学习阶段完全够用；滑动窗口是它的进阶版，以后有兴趣再研究。

### 4.3 改造步骤

**第 1 步：新建限流中间件 `server/middlewares/rate-limit.js`**（仿照 `requirePermission` 的工厂函数写法——项目里已有这个模式）：

```js
import redis from '../utils/redis.js'
import { logger } from '../utils/logger.js'

/**
 * 固定窗口限流。必须挂在 authMiddleware 之后（要用 req.user.id）。
 * @param {object} opts
 * @param {string} opts.prefix   计数 key 的业务前缀，如 'chat'
 * @param {number} opts.windowSeconds 窗口长度（秒）
 * @param {number} opts.max      窗口内最大次数
 */
const rateLimit = ({ prefix, windowSeconds, max }) => {
  return async (req, res, next) => {
    if (!redis) return next() // 测试环境/显式关闭时直接放行

    const key = `aura:limit:${prefix}:user:${req.user.id}`
    try {
      const count = await redis.incr(key)
      if (count === 1) {
        await redis.expire(key, windowSeconds) // 窗口第一条：设定闹钟
      } else if (await redis.ttl(key) === -1) {
        await redis.expire(key, windowSeconds) // 自愈：补上丢失的过期时间
      }
      if (count > max) {
        const retryAfter = await redis.ttl(key)
        res.set('Retry-After', String(Math.max(retryAfter, 1)))
        return res.status(429).json({
          code: 429,
          message: `rate limit exceeded, retry after ${retryAfter}s`,
        })
      }
      next()
    } catch (err) {
      // Redis 挂了：放行并告警。权衡——限流是花钱保护，短暂失效可接受；
      // 若更担心钱包，改成 return next(new TooManyRequests(...)) 也只是一行的事
      logger.warn(`[rate-limit] redis unavailable, request allowed: ${err.message}`)
      next()
    }
  }
}

export default rateLimit
```

**第 2 步：挂到对话端点**（`endpoints/chat.js:42`）：

```js
router.post('/:workspaceId',
  rateLimit({ prefix: 'chat', windowSeconds: 3600, max: 30 }),
  asyncHandler(requireOwnership({ resource: 'chat_workspace', idFrom: 'params.workspaceId' })),
  asyncHandler(async (req, res) => { /* 原逻辑不动 */ })
)
```

讲解挂载顺序：限流放在最前面，能在查库鉴权之前就把超额请求挡掉（越早拒绝越省钱省力）。阈值 30 次/小时先拍脑袋定一个，跑一阵子再调。

**第 3 步（可选）：顺手给登录接口也挂一个**，防密码暴力破解——`POST /user/login` 没有 user.id，限流 key 换成 `ip:{req.ip}`，窗口 10 分钟 max 10 次。练手价值：同一个中间件复用到不同维度。

**第 4 步：前端处理 429**。查看 `interface/src/http/handler.ts` 的统一错误处理，加一条分支：遇到 429 时用 message 提示"调用太频繁，请 X 分钟后再试"，而不是报一坨红色错误。

### 4.4 动手验证

1. 把 `max` 临时改成 3，用 `.http` 文件连调 4 次 `POST /api/chat/{workspaceId}`；
2. 第 4 次返回 429，响应头里有 `Retry-After`；
3. `redis-cli`：`GET aura:limit:chat:user:{id}` = 4，`TTL` 在窗口内倒数；
4. 等 TTL 归零（或 `DEL` 掉这个 key），又能正常调用；
5. `docker stop aura-redis` 期间调用不受影响（放行 + 日志告警）。

### 4.5 验收清单

- [ ] 超限返回 429 + Retry-After，前端有友好提示
- [ ] 计数 key 有 TTL（自愈逻辑生效：手动 `PERSIST aura:limit:chat:user:1` 后再请求一次，TTL 恢复）
- [ ] 不同用户互不影响（key 按 userId 隔离）
- [ ] 停 Redis 不影响对话功能
- [ ] `pnpm test:server` 全绿；git commit

---

## 附录 A：redis-cli 速查

| 命令 | 作用 | 备注 |
|---|---|---|
| `SET k v` / `GET k` | 读写字符串 | 不存在返回 `nil` |
| `SET k v EX 60` | 写入 + 60 秒过期 | 等价 `SETEX k 60 v` |
| `TTL k` | 剩余秒数 | `-1` 永生、`-2` 不存在 |
| `DEL k1 k2` | 删除 | 也用于主动失效 |
| `EXISTS k` | 是否存在 | 黑名单验证用 |
| `INCR k` | 原子 +1 | 不存在则从 0 开始 |
| `EXPIRE k 60` | 给已有 key 设过期 | 限流窗口用 |
| `PERSIST k` | 移除过期时间 | 验证自愈用 |
| `KEYS pattern` | 按模式找 key | **只许学习时用** |
| `SCAN 0 MATCH p COUNT 100` | 游标分批找 key | 生产替代 KEYS |
| `STRLEN k` | value 字节数 | 感受 JSON 大小 |
| `DBSIZE` | key 总数 | 体检用 |
| `FLUSHDB` | 清空整库 | 危险，仅本地练习 |

## 附录 B：ioredis 与 redis-cli 对照

| redis-cli | ioredis（`utils/redis.js` 已封装） |
|---|---|
| `GET k` | `redis.get(k)` → `cacheGet(k)` |
| `SET k v EX n` | `redis.set(k, v, 'EX', n)` → `cacheSet(k, v, n)` |
| `DEL k` | `redis.del(k)` → `cacheDel(k)` |
| `INCR k` | `redis.incr(k)` |
| `EXPIRE k n` / `TTL k` | `redis.expire(k, n)` / `redis.ttl(k)` |
| `SCAN ...` | `redis.scan(cursor, 'MATCH', p, 'COUNT', n)` → `scanDel(p)` |

封装层（`cacheGet/cacheSet/cacheDel`）自动做 JSON 序列化和降级；直接用 `redis.xxx` 的场合（阶段 4 的 incr/expire/ttl 需要原始返回值）则要自己 try/catch。

## 附录 C：完成后全项目的 Redis key 一览

| key | 值 | TTL | 失效方式 |
|---|---|---|---|
| `aura:models:all` | models.dev 全量 JSON | 7 天 | cron 每日刷新覆盖 |
| `aura:rbac:user:{id}` | `{roles, perms}` | 5 分钟 | 写入口主动 DEL + TTL 兜底 |
| `aura:jwt:blacklist:{jti}` | `1` | token 剩余寿命 | 自然过期 |
| `aura:limit:chat:user:{id}` | 计数 | 1 小时 | 自然过期 |

## 附录 D：四个阶段各自的"一句话收获"

- 阶段 1：缓存 = "先问内存里的 Redis，没有再问数据库，拿到记得放回去，并且设好保质期"。
- 阶段 2：**缓存失效是缓存唯一真正的难题**——主动 DEL 保证正确，TTL 封顶损害，二者缺一不可。
- 阶段 3：无状态方案的软肋（收不回的 token）用"最小的状态"（一个带 TTL 的黑名单）来补。
- 阶段 4：Redis 单线程 = 命令天然原子，`INCR` 是分布式计数器的积木。
