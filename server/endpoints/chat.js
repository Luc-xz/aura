import express from 'express'
import sql from '../sql/index.js'
import Chat from '../models/chat.js'
import ModelConfig from '../models/model-config.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { authMiddleware } from '../middlewares/auth.js'
import providers from '../adapters/index.js'

const router = express.Router()

function chatEndpoints(apiRouter) {
  apiRouter.use('/chat', asyncHandler(authMiddleware), router)

  router.get('/list/:workspaceId', asyncHandler(async (req, res) => {
    const { page, pageSize, orderBy, orderDir, ...rest } = req.query
    const data = await Chat.findByWorkspaceId(
      req.params.workspaceId,
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
      code: 1,
      message: 'success'
    })
  }))

  router.post('/:workspaceId', asyncHandler(async (req, res) => {
    const { workspaceId } = req.params
    let { modelId, content, stream = true, think = true } = req.body

    if (!modelId) {
      const workspace = await Workspace.findById(workspaceId)
      if (!workspace) {
        throw new Error("Workspace not found");
      }
      modelId = workspace.modelId
    }

    const modelConfig = await ModelConfig.findById(modelId)
    if (!modelConfig) {
      throw new Error("Model not found");
    }

    const Provider = providers[modelConfig.providerType]
    if (!Provider) {
      throw new Error("Invalid provider type");
    }

    await Chat.create({
      workspaceId,
      modelId,
      content,
      proposer: 'user'
    })

    const provider = new Provider(modelConfig)

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

    const response = await provider.chat(messages, { stream, think })

    await Chat.create({ workspaceId, modelId, content: response, proposer: 'assistant' })

    res.status(200).json({
      data: chat,
      code: 1,
      message: 'success'
    })

  }))
}

export default chatEndpoints
