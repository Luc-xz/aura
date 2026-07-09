import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { getRequest, registerAndLogin, authHeader, cleanTable } from './helpers.js'
import db from '../sql/index.js'

let request

beforeAll(async () => {
  request = await getRequest()
})

beforeEach(async () => {
  await cleanTable('user_role')
  await cleanTable('role')
  await cleanTable('user')

  // 重新插入默认内置角色
  await db.query(`
    INSERT INTO role (id, name, code, description, is_system) VALUES 
    (1, 'super_admin', 'super_admin', 'Super administrator', 1),
    (2, 'admin', 'admin', 'Administrator', 1),
    (3, 'member', 'member', 'Basic role', 1)
  `)
})

describe('GET /api/role/list', () => {
  it('未认证请求应返回 401', async () => {
    const res = await request.get('/api/role/list')
    expect(res.status).toBe(401)
  })

  it('认证请求应返回系统角色列表', async () => {
    const { token } = await registerAndLogin()
    const res = await request.get('/api/role/list').set(authHeader(token))
    expect(res.status).toBe(200)
    expect(res.body.code).toBe(200)
    expect(res.body.data).toBeInstanceOf(Array)
    expect(res.body.data.length).toBe(3)
    const codes = res.body.data.map(r => r.code)
    expect(codes).toContain('super_admin')
    expect(codes).toContain('admin')
    expect(codes).toContain('member')
  })
})

describe('GET /api/role/page', () => {
  it('未认证请求应返回 401', async () => {
    const res = await request.get('/api/role/page')
    expect(res.status).toBe(401)
  })

  it('认证请求应返回分页角色列表', async () => {
    const { token } = await registerAndLogin()
    const res = await request
      .get('/api/role/page')
      .query({ page: 1, pageSize: 2 })
      .set(authHeader(token))

    expect(res.status).toBe(200)
    expect(res.body.code).toBe(200)
    expect(res.body.data.rows).toBeInstanceOf(Array)
    expect(res.body.data.rows.length).toBe(2)
    expect(res.body.data.total).toBe(3)
  })
})

describe('GET /api/role/:id', () => {
  it('应成功获取指定角色详情', async () => {
    const { token } = await registerAndLogin()
    const res = await request.get('/api/role/1').set(authHeader(token))
    expect(res.status).toBe(200)
    expect(res.body.code).toBe(200)
    expect(res.body.data.code).toBe('super_admin')
  })

  it('不存在的角色应报错', async () => {
    const { token } = await registerAndLogin()
    const res = await request.get('/api/role/999').set(authHeader(token))
    expect(res.status).toBe(404)
  })
})

describe('POST /api/role', () => {
  it('应成功创建新角色', async () => {
    const { token } = await registerAndLogin()
    const res = await request
      .post('/api/role')
      .set(authHeader(token))
      .send({
        name: '自定义角色',
        code: 'custom_role',
        description: '这是一段描述'
      })

    expect(res.status).toBe(200)
    expect(res.body.code).toBe(200)
    expect(res.body.data.code).toBe('custom_role')
    expect(res.body.data.name).toBe('自定义角色')
  })

  it('缺失必填字段应报错', async () => {
    const { token } = await registerAndLogin()
    const res = await request
      .post('/api/role')
      .set(authHeader(token))
      .send({
        name: '缺少code的角色'
      })

    expect(res.status).toBe(400)
  })

  it('创建重复code的角色应报错', async () => {
    const { token } = await registerAndLogin()
    await request
      .post('/api/role')
      .set(authHeader(token))
      .send({
        name: '角色A',
        code: 'duplicate_code'
      })

    const res = await request
      .post('/api/role')
      .set(authHeader(token))
      .send({
        name: '角色B',
        code: 'duplicate_code'
      })

    expect(res.status).toBe(409)
  })
})

describe('PUT /api/role/:id', () => {
  let token, customRoleId

  beforeEach(async () => {
    const auth = await registerAndLogin()
    token = auth.token
    const res = await request
      .post('/api/role')
      .set(authHeader(token))
      .send({
        name: '原角色名',
        code: 'custom_role_to_edit',
        description: '原描述'
      })
    customRoleId = res.body.data.id
  })

  it('应成功更新自定义角色名称和描述', async () => {
    const res = await request
      .put(`/api/role/${customRoleId}`)
      .set(authHeader(token))
      .send({
        name: '新角色名',
        description: '新描述'
      })

    expect(res.status).toBe(200)
    expect(res.body.code).toBe(200)
    expect(res.body.data.name).toBe('新角色名')
    expect(res.body.data.description).toBe('新描述')
  })

  it('更新不存在的角色应报错', async () => {
    const res = await request
      .put('/api/role/999')
      .set(authHeader(token))
      .send({
        name: '随便改改'
      })

    expect(res.status).toBe(404)
  })
})

describe('DELETE /api/role/:id', () => {
  let token, customRoleId

  beforeEach(async () => {
    const auth = await registerAndLogin()
    token = auth.token
    const res = await request
      .post('/api/role')
      .set(authHeader(token))
      .send({
        name: '待删除角色',
        code: 'custom_role_to_delete'
      })
    customRoleId = res.body.data.id
  })

  it('应成功删除自定义角色', async () => {
    const res = await request
      .delete(`/api/role/${customRoleId}`)
      .set(authHeader(token))

    expect(res.status).toBe(200)
    expect(res.body.code).toBe(200)
    expect(res.body.data).toBe(true)

    // 确保列表中查不到了
    const listRes = await request.get('/api/role/list').set(authHeader(token))
    const found = listRes.body.data.find(r => r.id === customRoleId)
    expect(found).toBeUndefined()
  })

  it('删除系统角色应报错', async () => {
    const res = await request
      .delete('/api/role/1') // super_admin 是系统内置角色
      .set(authHeader(token))

    expect(res.status).toBe(400)
  })

  it('删除不存在的角色应报错', async () => {
    const res = await request
      .delete('/api/role/999')
      .set(authHeader(token))

    expect(res.status).toBe(404)
  })
})
