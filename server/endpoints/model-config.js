import express from 'express'
import sql from '../sql/index.js'
import ModelConfig from '../models/model-config.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { authMiddleware } from '../middlewares/auth.js'

const router = express.Router()

function modelConfigEndpoints(apiRouter) {
  apiRouter.use('/model-config', asyncHandler(authMiddleware), router)

  router.get('/list', asyncHandler(async (req, res) => {
    const { orderBy, orderDir, ...rest } = req.query
    const data = await ModelConfig.findAll({
      user: req.user,
      filters: {
        ...rest,
        createdAt: rest?.createdAt?.split(',') || null,
        updatedAt: rest?.updatedAt?.split(',') || null,
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

  router.get('/group', asyncHandler(async (req, res) => {
    const { orderBy, orderDir } = req.query
    const data = await ModelConfig.findAll({
      user: req.user,
      sort: {
        orderBy,
        orderDir
      }
    })
    const groupedData = data.reduce((acc, item) => {
      const key = item.provider
      if (!acc[key]) {
        acc[key] = []
      }
      acc[key].push(item)
      return acc
    }, {})

    res.status(200).json({
      data: groupedData,
      code: 1,
      message: 'success'
    })
  }))

  router.get('/:id', asyncHandler(async (req, res) => {
    const { id } = req.params
    const data = await ModelConfig.findById(id)
    res.status(200).json({
      data,
      code: 1,
      message: 'success'
    })
  }))

  router.post('/', asyncHandler(async (req, res) => {
    const { provider, baseUrl, apiKey, modelName, temperature, maxTokens, isActive } = req.body
    const data = await ModelConfig.create(req.user, { provider, baseUrl, apiKey, modelName, temperature, maxTokens, isActive })
    res.status(200).json({
      data,
      code: 1,
      message: 'success'
    })
  }))

  router.put('/:id', asyncHandler(async (req, res) => {
    const { id } = req.params
    const { provider, baseUrl, apiKey, modelName, temperature, maxTokens, isActive } = req.body
    const data = await ModelConfig.update(id, { provider, baseUrl, apiKey, modelName, temperature, maxTokens, isActive })
    res.status(200).json({
      data,
      code: 1,
      message: 'success'
    })
  }))

  router.delete('/:id', asyncHandler(async (req, res) => {
    const { id } = req.params
    const data = await ModelConfig.delete(id)
    res.status(200).json({
      data,
      code: 1,
      message: 'success'
    })
  }))
}

export default modelConfigEndpoints