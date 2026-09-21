import express from 'express'
import sql from '../sql/index.js'
import Note from '../models/note.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { authMiddleware } from '../middlewares/auth.js'
import { requireOwnership } from '../middlewares/rbac.js'
import Validator from '../../shared/utils/validator.js'
import { BadRequest, NotFound } from '../utils/appError.js'

const router = express.Router()

function validateKeywords(keywords) {
  if (keywords === undefined) return
  if (!Array.isArray(keywords) || keywords.length > 10 || keywords.some((k) => !Validator.isNonEmptyString(k))) {
    throw BadRequest('keywords must be an array of non-empty strings with no more than 10 items')
  }
}

async function assertLinkOwnership(user, { workspaceId, sourceChatId }) {
  if (workspaceId !== undefined && workspaceId !== null) {
    const [rows] = await sql.query('SELECT user_id FROM workspace WHERE id = ?', [workspaceId])
    if (!rows.length || rows[0].user_id !== user.id) {
      throw BadRequest('workspace not found')
    }
  }
  if (sourceChatId !== undefined && sourceChatId !== null) {
    const [rows] = await sql.query(`
      SELECT w.user_id FROM chat c JOIN workspace w ON c.workspace_id = w.id WHERE c.id = ?
    `, [sourceChatId])
    if (!rows.length || rows[0].user_id !== user.id) {
      throw BadRequest('source chat not found')
    }
  }
}

function noteEndpoints(apiRouter) {
  apiRouter.use('/note', asyncHandler(authMiddleware), router)

  router.get('/page', asyncHandler(async (req, res) => {
    const { page, pageSize, orderBy, orderDir, ...rest } = req.query
    const data = await Note.findAll({
      user: req.user,
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
      code: 200,
      message: 'success'
    })
  }))

  router.get('/:id', asyncHandler(requireOwnership({ resource: 'note' })), asyncHandler(async (req, res) => {
    const { id } = req.params
    const data = await Note.findById(id)
    if (!data) {
      throw NotFound('note not found')
    }
    res.status(200).json({
      data,
      code: 200,
      message: 'success'
    })
  }))

  router.post('/', asyncHandler(async (req, res) => {
    const { title, content, description, keywords, workspaceId, sourceChatId } = req.body
    if (!title) {
      throw BadRequest('title is required')
    }
    if (!Validator.isLength(title, 1, 50)) {
      throw BadRequest('title must be 1-50 characters')
    }
    if (!content) {
      throw BadRequest('content is required')
    }
    if (description && !Validator.isLength(description, 0, 255)) {
      throw BadRequest('description must be no more than 255 characters')
    }
    validateKeywords(keywords)
    await assertLinkOwnership(req.user, { workspaceId, sourceChatId })

    const data = await Note.create(req.user, { title, content, description, keywords, workspaceId, sourceChatId })
    res.status(200).json({
      data,
      code: 200,
      message: 'success'
    })
  }))

  router.put('/:id', asyncHandler(requireOwnership({ resource: 'note' })), asyncHandler(async (req, res) => {
    const { id } = req.params
    const { title, content, description, keywords, workspaceId, sourceChatId } = req.body

    if (!title && !content && description === undefined && keywords === undefined && workspaceId === undefined && sourceChatId === undefined) {
      throw BadRequest('at least one field (title, content, description, keywords, workspaceId, sourceChatId) is required')
    }
    if (title && !Validator.isLength(title, 1, 50)) {
      throw BadRequest('title must be 1-50 characters')
    }
    if (description && !Validator.isLength(description, 0, 255)) {
      throw BadRequest('description must be no more than 255 characters')
    }
    validateKeywords(keywords)
    await assertLinkOwnership(req.user, { workspaceId, sourceChatId })

    const existing = await Note.findById(id)
    if (!existing) {
      throw NotFound('note not found')
    }

    const data = await Note.update(id, { title, content, description, keywords, workspaceId, sourceChatId })
    res.status(200).json({
      data,
      code: 200,
      message: 'success'
    })
  }))

  router.delete('/:id', asyncHandler(requireOwnership({ resource: 'note' })), asyncHandler(async (req, res) => {
    const { id } = req.params
    const existing = await Note.findById(id)
    if (!existing) {
      throw NotFound('note not found')
    }
    const data = await Note.delete(id)
    res.status(200).json({
      data,
      code: 200,
      message: 'success'
    })
  }))
}

export default noteEndpoints
