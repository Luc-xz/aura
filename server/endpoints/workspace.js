import express from 'express'
import Workspace from '../models/workspace.js'
import ModelConfig from '../models/model-config.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { authMiddleware } from '../middlewares/auth.js'
import { requireOwnership } from '../middlewares/rbac.js'
import Validator from '../../shared/utils/validator.js'
import { BadRequest, NotFound, Forbidden } from '../utils/appError.js'

const router = express.Router()

router.param('id', (req, res, next, id) => {
  if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id))) {
    return next(BadRequest('id must be a positive safe integer'))
  }
  next()
})

function listOptions(query) {
  const filters = {}
  if (query.status !== undefined) {
    if (typeof query.status !== 'string' || !/^[012]$/.test(query.status)) {
      throw BadRequest('status must be one of 0, 1, 2')
    }
    filters.status = Number(query.status)
  }
  if (query.title !== undefined) {
    if (typeof query.title !== 'string' || query.title.length > 255) throw BadRequest('invalid title filter')
    filters.title = query.title
  }
  for (const field of ['createdAt', 'updatedAt']) {
    if (query[field] === undefined) continue
    if (typeof query[field] !== 'string') throw BadRequest('invalid date range')
    const range = query[field].split(',')
    if (range.length !== 2 || range.some(value => !value.trim() || !Number.isFinite(Date.parse(value)))) {
      throw BadRequest('invalid date range')
    }
    filters[field] = range
  }
  const orderBy = query.orderBy ?? 'updated_at'
  const orderDir = typeof query.orderDir === 'string' ? query.orderDir.toUpperCase() : query.orderDir ?? 'DESC'
  if (!['title', 'created_at', 'updated_at'].includes(orderBy) || !['ASC', 'DESC'].includes(orderDir)) {
    throw BadRequest('invalid workspace sort')
  }
  return { filters, sort: { orderBy, orderDir } }
}

// Presence, not truthiness: status=0 and empty/null text are intentional updates.
function projectPayload(body, creating = false) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw BadRequest('body must be an object')
  const payload = {}
  if (creating || body.title !== undefined) {
    if (!Validator.isLength(body.title, 1, 255) || !body.title.trim()) {
      throw BadRequest('title must be 1-255 non-blank characters')
    }
    payload.title = body.title
  }
  for (const [field, max] of [['goal', 255], ['description', 2000]]) {
    if (body[field] === undefined) continue
    if (body[field] !== null && !Validator.isLength(body[field], 0, max)) {
      throw BadRequest(field + ' must be a string of at most ' + max + ' characters, or null')
    }
    payload[field] = body[field] === '' ? null : body[field]
  }
  if (body.status !== undefined) {
    if (!Number.isInteger(body.status) || ![0, 1, 2].includes(body.status)) {
      throw BadRequest('status must be one of 0, 1, 2')
    }
    payload.status = body.status
  }
  if (body.modelId !== undefined) {
    if (body.modelId !== null && !Validator.isPositiveInt(body.modelId)) {
      throw BadRequest('modelId must be a positive integer or null')
    }
    payload.modelId = body.modelId === null ? null : Number(body.modelId)
  }
  if (!creating && !Object.keys(payload).length) {
    throw BadRequest('at least one field (title, goal, description, status, modelId) is required')
  }
  return payload
}

function workspaceEndpoints(apiRouter) {
  apiRouter.use('/workspace', asyncHandler(authMiddleware), router)

  router.get('/list', asyncHandler(async (req, res) => {
    const data = await Workspace.findWithDetails({ user: req.user, ...listOptions(req.query) })
    res.status(200).json({
      data,
      code: 200,
      message: 'success'
    })
  }))

  // Static routes must precede /:id.
  router.get('/stats', asyncHandler(async (req, res) => {
    res.status(200).json({ data: await Workspace.stats(req.user), code: 200, message: 'success' })
  }))

  router.get('/:id', asyncHandler(requireOwnership({ resource: 'workspace' })), asyncHandler(async (req, res) => {
    const data = await Workspace.findById(req.params.id)
    if (!data) throw NotFound('workspace not found')
    res.status(200).json({ data, code: 200, message: 'success' })
  }))

  router.post('/', asyncHandler(async (req, res) => {
    const payload = projectPayload(req.body, true)
    const { modelId } = payload

    // 挂载校验：配置必须属于创建者
    if (modelId) {
      const modelConfig = await ModelConfig.findById(modelId)
      if (!modelConfig) {
        throw NotFound('model config not found')
      }
      if (modelConfig.userId !== req.user.id) {
        throw Forbidden('model config does not belong to you')
      }
    }

    const id = await Workspace.create(req.user, payload)
    const data = await Workspace.findById(id)
    res.status(200).json({
      data,
      code: 200,
      message: 'success'
    })
  }))

  router.put('/:id', asyncHandler(requireOwnership({ resource: 'workspace' })), asyncHandler(async (req, res) => {
    const { id } = req.params
    const payload = projectPayload(req.body)
    const { modelId } = payload

    const existing = await Workspace.findById(id)
    if (!existing) {
      throw NotFound('workspace not found')
    }

    // modelId 挂载校验：配置必须属于工作区属主（唯一校验点，chat 只读工作区挂载的配置）
    // 校验对象是属主而非操作者，防止 super_admin 代管时把自己的配置挂进他人工作区
    if (modelId) {
      const modelConfig = await ModelConfig.findById(modelId)
      if (!modelConfig) {
        throw NotFound('model config not found')
      }
      if (modelConfig.userId !== existing.userId) {
        throw Forbidden('model config does not belong to the workspace owner')
      }
    }

    const data = await Workspace.update(id, payload)
    res.status(200).json({
      data,
      code: 200,
      message: 'success'
    })
  }))

  router.delete('/:id', asyncHandler(requireOwnership({ resource: 'workspace' })), asyncHandler(async (req, res) => {
    const { id } = req.params
    const existing = await Workspace.findById(id)
    if (!existing) {
      throw NotFound('workspace not found')
    }
    const data = await Workspace.delete(id)
    res.status(200).json({
      data,
      code: 200,
      message: 'success'
    })
  }))
}

export default workspaceEndpoints
