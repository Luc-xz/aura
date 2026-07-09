import express from 'express'
import sql from '../sql/index.js'
import Workspace from '../models/workspace.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { authMiddleware } from '../middlewares/auth.js'
import Validator from '../../shared/utils/validator.js'
import { BadRequest, NotFound } from '../utils/appError.js'

const router = express.Router()

function workspaceEndpoints(apiRouter) {
  apiRouter.use('/workspace', asyncHandler(authMiddleware), router)

  router.get('/list', asyncHandler(async (req, res) => {
    const { page, pageSize, orderBy, orderDir, ...rest } = req.query
    const data = await Workspace.findWithDetails({
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

  router.post('/', asyncHandler(async (req, res) => {
    const { title, modelId } = req.body
    if (!title) {
      throw BadRequest('title is required')
    }
    if (!Validator.isLength(title, 1, 255)) {
      throw BadRequest('title must be 1-255 characters')
    }
    if (modelId && !Validator.isPositiveInt(modelId)) {
      throw BadRequest('modelId must be a positive integer')
    }

    const id = await Workspace.create(req.user, { title, modelId })
    const data = await Workspace.findById(id)
    res.status(200).json({
      data,
      code: 1,
      message: 'success'
    })
  }))

  router.put('/:id', asyncHandler(async (req, res) => {
    const { id } = req.params
    const { title, modelId } = req.body

    if (!title && !modelId) {
      throw BadRequest('at least one field (title, modelId) is required')
    }
    if (title && !Validator.isLength(title, 1, 255)) {
      throw BadRequest('title must be 1-255 characters')
    }
    if (modelId && !Validator.isPositiveInt(modelId)) {
      throw BadRequest('modelId must be a positive integer')
    }

    const existing = await Workspace.findById(id)
    if (!existing) {
      throw NotFound('workspace not found')
    }

    const data = await Workspace.update(id, { title, modelId })
    res.status(200).json({
      data,
      code: 1,
      message: 'success'
    })
  }))

  router.delete('/:id', asyncHandler(async (req, res) => {
    const { id } = req.params
    const existing = await Workspace.findById(id)
    if (!existing) {
      throw NotFound('workspace not found')
    }
    const data = await Workspace.delete(id)
    res.status(200).json({
      data,
      code: 1,
      message: 'success'
    })
  }))
}

export default workspaceEndpoints
