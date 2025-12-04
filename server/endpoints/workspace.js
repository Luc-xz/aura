import express from 'express'
import sql from '../sql/index.js'
import Workspace from '../models/workspace.js'
import { asyncHandler } from '../utils/asyncHandler.js'

const router = express.Router()

function workspaceEndpoints(apiRouter) {
  apiRouter.use('/workspace', router)

  router.get('/list', asyncHandler(async (req, res) => {
    const { page, pageSize, orderBy, orderDir, ...rest } = req.query
    const data = await Workspace.findAll({
      filters: {
        ...rest,
        createdAt: rest?.createdAt?.split(',') || null,
        updatedAt: rest?.updatedAt?.split(',') || null,
      },
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

  router.post('/', asyncHandler(async (req, res) => {
    const { title, model } = req.body
    // TODO: verify model
    const id = await Workspace.create({ title, model })
    const data = await Workspace.findById(id)
    res.status(200).json({
      data,
      code: 1,
      message: 'success'
    })
  }))

  router.put('/:id', asyncHandler(async (req, res) => {
    const { id } = req.params
    const { title, model } = req.body
    // TODO: verify model
    const data = await Workspace.update(id, { title, model })
    res.status(200).json({
      data,
      code: 1,
      message: 'success'
    })
  }))

  router.delete('/:id', asyncHandler(async (req, res) => {
    const { id } = req.params
    const data = await Workspace.delete(id)
    res.status(200).json({
      data,
      code: 1,
      message: 'success'
    })
  }))
}

export default workspaceEndpoints
