import express from 'express'
import sql from '../sql/index.js'
import Chat from '../models/chat.js'
import ModelConfig from '../models/model-config.js'
import Workspace from '../models/workspace.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { authMiddleware } from '../middlewares/auth.js'
import { createModelInstance } from '../utils/model-factory.js'
import { generateText, streamText } from 'ai'
import Validator from '../../shared/utils/validator.js'
import { BadRequest, NotFound } from '../utils/appError.js'

const router = express.Router()

function chatEndpoints(apiRouter) {
  apiRouter.use('/chat', asyncHandler(authMiddleware), router)

  router.get('/list/:workspaceId', asyncHandler(async (req, res) => {
    const { workspaceId } = req.params
    const { page, pageSize, orderBy, orderDir, ...rest } = req.query
    const data = await Chat.findByWorkspaceId(
      workspaceId,
      {
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
      code: 200,
      message: 'success'
    })
  }))

  router.post('/:workspaceId', asyncHandler(async (req, res) => {
    const { workspaceId } = req.params
    let { modelId, content, stream = true, think = true } = req.body

    if (!content) {
      throw BadRequest('content is required')
    }
    if (!Validator.isNonEmptyString(content)) {
      throw BadRequest('content cannot be empty')
    }
    if (modelId && !Validator.isPositiveInt(modelId)) {
      throw BadRequest('modelId must be a positive integer')
    }

    if (!modelId) {
      const workspace = await Workspace.findById(workspaceId)
      if (!workspace) {
        throw NotFound('workspace not found')
      }
      modelId = workspace.modelId
    }

    if (!modelId) {
      throw BadRequest('no model configured for this workspace, please specify modelId')
    }

    const modelConfig = await ModelConfig.findById(modelId)
    if (!modelConfig) {
      throw NotFound('model config not found')
    }

    await Chat.create({
      workspaceId,
      modelId,
      content,
      proposer: 'user'
    })

    const { rows } = await Chat.findByWorkspaceId(
      workspaceId,
      {
        filters: {
        },
        pagination: {
          page: 1,
          pageSize: 20
        },
        sort: {
          orderBy: 'created_at',
          orderDir: 'asc'
        }
      })

    const messages = [...rows, { workspaceId, content, proposer: 'user' }].map(item => {
      return {
        role: item.proposer,
        content: item.content
      }
    })

    const model = createModelInstance(modelConfig)

    if (!stream) {
      const result = await generateContent({
        model,
        prompt: messages,
      });
      await Chat.create({ workspaceId, content: result.text, proposer: 'assistant' })
      res.status(200).json({
        data: result.text,
        code: 200,
        message: 'success'
      })
      return
    }

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')

    const result = streamText({
      model,
      prompt: messages,
    });
    let data = ''
    for await (const textPart of result.textStream) {
      data += textPart
      res.write(textPart)
    }
    await Chat.create({ workspaceId, content: data, proposer: 'assistant' })
    res.end()
  }))
}

export default chatEndpoints
