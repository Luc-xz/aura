/**
 * User API 接口测试
 * 覆盖：注册、登录、列表、分页、更新、删除、认证
 */
import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { getRequest, registerAndLogin, authHeader, cleanTable } from './helpers.js'

let request

beforeAll(async () => {
  request = await getRequest()
})

beforeEach(async () => {
  await cleanTable('user_role')
  await cleanTable('user')
})

describe('POST /api/user/register', () => {
  it('应成功注册用户', async () => {
    const res = await request
      .post('/api/user/register')
      .send({
        name: 'test_register',
        email: 'register@test.com',
        password: 'Test_123456'
      })

    expect(res.status).toBe(200)
    expect(res.body.code).toBe(1)
    expect(res.body.message).toBe('success')
  })

  it('缺少必填字段应报错', async () => {
    const res = await request
      .post('/api/user/register')
      .send({ name: 'test' })

    expect(res.status).toBe(200)
    expect(res.body.code).not.toBe(1)
  })

  it('无效邮箱格式应报错', async () => {
    const res = await request
      .post('/api/user/register')
      .send({
        name: 'test_invalid_email',
        email: 'not-an-email',
        password: 'Test_123456'
      })

    expect(res.status).toBe(200)
    expect(res.body.code).not.toBe(1)
  })

  it('弱密码应报错', async () => {
    const res = await request
      .post('/api/user/register')
      .send({
        name: 'test_weak_pwd',
        email: 'weak@test.com',
        password: '123'
      })

    expect(res.status).toBe(200)
    expect(res.body.code).not.toBe(1)
  })

  it('重复注册同名用户应报错', async () => {
    await request
      .post('/api/user/register')
      .send({
        name: 'duplicate_user',
        email: 'dup1@test.com',
        password: 'Test_123456'
      })

    const res = await request
      .post('/api/user/register')
      .send({
        name: 'duplicate_user',
        email: 'dup2@test.com',
        password: 'Test_123456'
      })

    expect(res.status).toBe(200)
    expect(res.body.code).not.toBe(1)
  })

  it('新注册用户默认角色只有member', async () => {
    const { token, id } = await registerAndLogin()

    const res = await request
      .get(`/api/user/${id}`)
      .set(authHeader(token))

    expect(res.status).toBe(200)
    expect(res.body.code).toBe(1)
    expect(res.body.data.roles.length).toBe(1)
    expect(res.body.data.roles[0].code).toBe('member')
  })
})

describe('POST /api/user/login', () => {
  beforeEach(async () => {
    // 注册一个用户供登录测试使用
    await request
      .post('/api/user/register')
      .send({
        name: 'login_user',
        email: 'login@test.com',
        password: 'Test_123456'
      })
  })

  it('应成功登录并返回 token', async () => {
    const res = await request
      .post('/api/user/login')
      .send({
        email: 'login@test.com',
        password: 'Test_123456'
      })

    expect(res.status).toBe(200)
    expect(res.body.code).toBe(1)
    expect(res.body.data).toHaveProperty('token')
    expect(res.body.data.name).toBe('login_user')
    expect(res.body.data.email).toBe('login@test.com')
  })

  it('错误密码应报错', async () => {
    const res = await request
      .post('/api/user/login')
      .send({
        email: 'login@test.com',
        password: 'WrongPassword@123'
      })

    expect(res.status).toBe(200)
    expect(res.body.code).not.toBe(1)
  })

  it('不存在的用户应报错', async () => {
    const res = await request
      .post('/api/user/login')
      .send({
        email: 'nonexist@test.com',
        password: 'Test_123456'
      })

    expect(res.status).toBe(200)
    expect(res.body.code).not.toBe(1)
  })

  it('缺少字段应报错', async () => {
    const res = await request
      .post('/api/user/login')
      .send({ email: 'login@test.com' })

    expect(res.status).toBe(200)
    expect(res.body.code).not.toBe(1)
  })
})

describe('GET /api/user/list', () => {
  it('未认证请求应返回 401', async () => {
    const res = await request.get('/api/user/list')
    expect(res.status).toBe(401)
  })

  it('认证后应返回用户列表', async () => {
    const { token } = await registerAndLogin()

    const res = await request
      .get('/api/user/list')
      .set(authHeader(token))

    expect(res.status).toBe(200)
    expect(res.body.code).toBe(1)
    expect(Array.isArray(res.body.data)).toBe(true)
    expect(res.body.data.length).toBeGreaterThanOrEqual(1)
  })
})

describe('GET /api/user/page', () => {
  it('应支持分页查询', async () => {
    const { token } = await registerAndLogin()

    const res = await request
      .get('/api/user/page')
      .query({ page: 1, pageSize: 10 })
      .set(authHeader(token))

    expect(res.status).toBe(200)
    expect(res.body.code).toBe(1)
    expect(res.body.data).toBeDefined()
  })

  it('应支持关键词搜索', async () => {
    const { token, name } = await registerAndLogin()

    const res = await request
      .get('/api/user/page')
      .query({ page: 1, pageSize: 10, keyword: name })
      .set(authHeader(token))

    expect(res.status).toBe(200)
    expect(res.body.code).toBe(1)
  })
})

describe('PUT /api/user/:id', () => {
  it('应成功更新用户信息', async () => {
    const { token } = await registerAndLogin()

    // 先获取用户列表拿到 id
    const listRes = await request
      .get('/api/user/list')
      .set(authHeader(token))

    const userId = listRes.body.data[0].id

    const res = await request
      .put(`/api/user/${userId}`)
      .set(authHeader(token))
      .send({
        name: 'updated_name',
        email: 'updated@test.com'
      })

    expect(res.status).toBe(200)
    expect(res.body.code).toBe(1)
  })
})

describe('DELETE /api/user/:id', () => {
  it('应成功删除用户', async () => {
    // 注册一个额外用户用于删除
    const { token } = await registerAndLogin()

    await request
      .post('/api/user/register')
      .send({
        name: 'to_delete',
        email: 'delete@test.com',
        password: 'Test_123456'
      })

    // 获取列表找到 to_delete 用户
    const listRes = await request
      .get('/api/user/list')
      .set(authHeader(token))

    const targetUser = listRes.body.data.find(u => u.name === 'to_delete')

    const res = await request
      .delete(`/api/user/${targetUser.id}`)
      .set(authHeader(token))

    expect(res.status).toBe(200)
    expect(res.body.code).toBe(1)
  })
})
