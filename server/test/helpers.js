/**
 * 测试辅助函数
 */
import supertest from 'supertest'

let _app = null

/**
 * 获取 app 实例（懒加载）
 */
export async function getApp() {
  if (!_app) {
    const { default: app } = await import('../app.js')
    _app = app
  }
  return _app
}

/**
 * 获取 supertest request 实例
 */
export async function getRequest() {
  const app = await getApp()
  return supertest(app)
}

/**
 * 注册测试用户并返回 token
 * @param {object} [userData] - 可选的用户数据覆盖
 * @returns {Promise<{token: string, name: string, email: string}>}
 */
export async function registerAndLogin(userData = {}) {
  const request = await getRequest()

  const ts = Date.now().toString().slice(-6)
  const defaultUser = {
    name: userData.name || `tuser_${ts}`,
    email: userData.email || `test_${ts}@test.com`,
    password: userData.password || 'Test_123456'
  }

  // 注册
  const registerRes = await request
    .post('/api/user/register')
    .send(defaultUser)

  if (registerRes.body.code !== 1) {
    throw new Error(`Register failed: ${registerRes.body.message}`)
  }

  // 登录获取 token
  const loginRes = await request
    .post('/api/user/login')
    .send({
      email: defaultUser.email,
      password: defaultUser.password
    })

  if (loginRes.body.code !== 1) {
    throw new Error(`Login failed: ${loginRes.body.message}`)
  }

  return {
    token: loginRes.body.data.token,
    name: loginRes.body.data.name,
    email: loginRes.body.data.email,
  }
}

/**
 * 获取带认证头的 request helper
 * @param {string} token - JWT token
 */
export function authHeader(token) {
  return { Authorization: `Bearer ${token}` }
}

/**
 * 清空指定表
 * @param {string} tableName
 */
export async function cleanTable(tableName) {
  const { default: pool } = await import('../sql/index.js')
  await pool.execute('SET FOREIGN_KEY_CHECKS = 0')
  await pool.execute(`TRUNCATE TABLE ${tableName}`)
  await pool.execute('SET FOREIGN_KEY_CHECKS = 1')
}
