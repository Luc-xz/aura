import express from 'express'
import sql from '../sql/index.js'
import Note from '../models/note.js'
import { asyncHandler } from '../utils/asyncHandler.js'

const router = express.Router()

function noteEndpoints(apiRouter) {
  apiRouter.use('/note', router)

  router.get('/page', asyncHandler(async (req, res) => {
    const { page, pageSize, orderBy, orderDir, ...rest } = req.query
    const data = await Note.findAll({
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
    const { title, content } = req.body
    const data = await Note.create({ title, content })
    res.status(200).json({
      data,
      code: 1,
      message: 'success'
    })
  }))

  router.put('/:id', asyncHandler(async (req, res) => {
    const { id } = req.params
    const { title, content } = req.body
    const data = await Note.update(id, { title, content })
    res.status(200).json({
      data,
      code: 1,
      message: 'success'
    })
  }))

  router.delete('/:id', asyncHandler(async (req, res) => {
    const { id } = req.params
    const data = await Note.delete(id)
    res.status(200).json({
      data,
      code: 1,
      message: 'success'
    })
  }))
}

export default noteEndpoints