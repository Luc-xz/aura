import express from 'express'
import sql from '../sql/index.js'
import User from '../models/user.js'
import { asyncHandler } from '../utils/asyncHandler.js'

const router = express.Router()

function userEndpoints(apiRouter) {
  apiRouter.use('/user', router)

  router.get('/list', asyncHandler(async (req, res) => {
    const { page, pageSize, orderBy, orderDir, ...rest } = req.query
    const data = await User.findAll({
      filters: rest,
      pagination: null,
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

  router.get('/page', asyncHandler(async (req, res) => {
    const { page, pageSize, orderBy, orderDir, ...rest } = req.query
    const data = await User.findAll({
      filters: {
        ...rest,
        createdAt: rest?.createdAt?.split(',') || null,
        updatedAt: rest?.updatedAt?.split(',') || null,
      },
      pagination: {
        page,
        pageSize
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

  router.post('/', asyncHandler(async (req, res) => {
    const { name, email = null, password = null } = req.body
    const data = await User.create({ name, email, password })
    res.status(200).json({
      data,
      code: 1,
      message: 'success',
    })
  }))

  router.put('/:id', asyncHandler(async (req, res) => {
    const { id } = req.params
    const { name, email, password } = req.body

    const data = await User.update(id, { name, email, password })
    res.status(200).json({
      data,
      code: 1,
      message: 'success',
    })
  }))

  router.delete('/:id', asyncHandler(async (req, res) => {
    const { id } = req.params

    const data = await User.delete(id)
    res.status(200).json({
      data,
      code: 1,
      message: 'success',
    })
  }))
}

export default userEndpoints
