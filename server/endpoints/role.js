import express from 'express'
import Role from '../models/role.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { authMiddleware } from '../middlewares/auth.js'

const router = express.Router()

function roleEndpoints(apiRouter) {
  apiRouter.use('/role', asyncHandler(authMiddleware), router)

  // 1. 获取非分页角色列表
  router.get('/list', asyncHandler(async (req, res) => {
    const { orderBy, orderDir, ...rest } = req.query
    const data = await Role.findAll({
      filters: rest,
      sort: {
        orderBy,
        orderDir
      }
    })
    res.status(200).json({
      data,
      code: 1,
      message: 'success'
    })
  }))

  // 2. 获取分页角色列表
  router.get('/page', asyncHandler(async (req, res) => {
    const { page, pageSize, orderBy, orderDir, ...rest } = req.query
    const data = await Role.findAll({
      filters: {
        ...rest,
        createdAt: rest?.createdAt?.split(',') || null,
        updatedAt: rest?.updatedAt?.split(',') || null,
      },
      pagination: {
        page: parseInt(page) || 1,
        pageSize: parseInt(pageSize) || 10
      },
      sort: {
        orderBy,
        orderDir
      }
    })
    res.status(200).json({
      data,
      code: 1,
      message: 'success'
    })
  }))

  // 3. 获取角色详情
  router.get('/:id', asyncHandler(async (req, res) => {
    const { id } = req.params
    const data = await Role.findById(id)
    if (!data) {
      throw new Error('role not found')
    }
    res.status(200).json({
      data,
      code: 1,
      message: 'success'
    })
  }))

  // 4. 创建角色
  router.post('/', asyncHandler(async (req, res) => {
    const { name, code, description } = req.body
    if (!name || !code) {
      throw new Error('name and code are required')
    }
    
    // 检查 code 是否已存在
    const existing = await Role.findByCode(code)
    if (existing) {
      throw new Error('role code already exists')
    }

    const id = await Role.create({ name, code, description })
    const data = await Role.findById(id)
    res.status(200).json({
      data,
      code: 1,
      message: 'success'
    })
  }))

  // 5. 更新角色
  router.put('/:id', asyncHandler(async (req, res) => {
    const { id } = req.params
    const { name, description } = req.body
    
    // 检查是否存在
    const existing = await Role.findById(id)
    if (!existing) {
      throw new Error('role not found')
    }

    await Role.update(id, { name, description })
    const data = await Role.findById(id)
    res.status(200).json({
      data,
      code: 1,
      message: 'success'
    })
  }))

  // 6. 删除角色
  router.delete('/:id', asyncHandler(async (req, res) => {
    const { id } = req.params
    
    // 检查是否存在
    const existing = await Role.findById(id)
    if (!existing) {
      throw new Error('role not found')
    }
    if (existing.isSystem) {
      throw new Error('system role cannot be deleted')
    }

    const data = await Role.delete(id)
    res.status(200).json({
      data,
      code: 1,
      message: 'success'
    })
  }))
}

export default roleEndpoints
