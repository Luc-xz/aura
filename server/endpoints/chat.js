import express from 'express'
import Chat from '../models/chat.js'
import ModelConfig from '../models/model-config.js'
import Workspace from '../models/workspace.js'
import UserSettings from '../models/user-settings.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import rateLimit from '../middlewares/rate-limit.js'
import { authMiddleware } from '../middlewares/auth.js'
import { requireOwnership } from '../middlewares/rbac.js'
import { createModelInstance } from '../utils/model-factory.js'
import { generateText, streamText, stepCountIs } from 'ai'
import Validator from '../../shared/utils/validator.js'
import { BadRequest, NotFound } from '../utils/appError.js'
import { buildNoteTools, NOTE_TOOLS_SYSTEM_PROMPT } from '../tool/index.js'

const TOOL_MAX_STEPS = 5

const router = express.Router()

function chatEndpoints(apiRouter) {
  apiRouter.use('/chat', asyncHandler(authMiddleware), router)

  router.get('/list/:workspaceId', asyncHandler(requireOwnership({ resource: 'chat_workspace', idFrom: 'params.workspaceId' })), asyncHandler(async (req, res) => {
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

  router.post('/:workspaceId',
    rateLimit({ prefix: 'chat', windowSeconds: 3600, max: 30 }),
    asyncHandler(requireOwnership({ resource: 'chat_workspace', idFrom: 'params.workspaceId' })),
    asyncHandler(async (req, res) => {
      const { workspaceId } = req.params
      const { content, stream = true, think = true } = req.body

      if (!content) {
        throw BadRequest('content is required')
      }
      if (!Validator.isNonEmptyString(content)) {
        throw BadRequest('content cannot be empty')
      }

      const workspace = await Workspace.findById(workspaceId)
      let modelConfig = null
      if (workspace.modelId) {
        modelConfig = await ModelConfig.findById(workspace.modelId)
      } else {
        // B4：项目未挂模型时回退用户默认模型（use_default_model 语义）；默认配置已被删除视为未配置
        const settings = await UserSettings.findByUserId(req.user.id)
        if (settings.defaultModelId) {
          modelConfig = await ModelConfig.findById(settings.defaultModelId)
        }
        if (!modelConfig) {
          throw BadRequest('当前账号未配置默认模型，请先在偏好设置中选择，或为项目挂载模型')
        }
      }
      if (!modelConfig) {
        throw NotFound('model config not found')
      }

      const sourceChatId = await Chat.create({
        workspaceId,
        modelId: modelConfig.id,
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
            orderBy: 'id',
            orderDir: 'desc'
          }
        })

      const messages = rows.reverse().map(item => {
        return {
          role: item.proposer,
          content: item.content
        }
      })

      const model = createModelInstance(modelConfig)
      // B7：项目目标与背景拼进 system prompt（笔记工具提示词在前，未设置时不加段落）
      const projectContext = []
      if (workspace.goal) projectContext.push(`项目目标：${workspace.goal}`)
      if (workspace.description) projectContext.push(`项目背景：${workspace.description}`)
      const systemPrompt = projectContext.length
        ? `${NOTE_TOOLS_SYSTEM_PROMPT}\n\n# 项目上下文\n${projectContext.join('\n')}`
        : NOTE_TOOLS_SYSTEM_PROMPT
      const sendEvent = (payload) => res.write(`data: ${JSON.stringify(payload)}\n\n`)

      const references = []
      const savedNotes = []
      const tools = buildNoteTools(req.user, {
        workspaceId: Number(workspaceId),
        sourceChatId,
        onNoteFound: (ref) => {
          if (!references.some((r) => r.id === ref.id)) {
            references.push(ref)
          }
        },
        onNoteSaved: (note) => {
          if (!savedNotes.some((n) => n.id === note.id)) savedNotes.push(note)
          if (stream) sendEvent({ type: 'note-saved', note })
        }
      })

      if (!stream) {
        const result = await generateText({
          model,
          messages,
          system: systemPrompt,
          tools,
          stopWhen: stepCountIs(TOOL_MAX_STEPS),
        });
        const chatId = await Chat.create({ workspaceId, content: result.text, proposer: 'assistant' })
        res.status(200).json({
          data: {
            content: result.text,
            references,
            savedNotes,
            chatId
          },
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
        messages,
        system: systemPrompt,
        tools,
        stopWhen: stepCountIs(TOOL_MAX_STEPS),
      });
      let full = ''

      try {
        for await (const part of result.fullStream) {
          if (part.type === 'text-delta') {
            full += part.text
            sendEvent({ type: 'text', value: part.text })
          } else if (part.type === 'tool-call') {
            if (part.toolName === 'search_notes') sendEvent({ type: 'status', value: '正在检索笔记…' })
            if (part.toolName === 'get_note_detail') sendEvent({ type: 'status', value: '正在读取笔记…' })
            if (part.toolName === 'save_note') sendEvent({ type: 'status', value: '正在保存笔记…' })
          }
        }
        const chatId = await Chat.create({ workspaceId, content: full, proposer: 'assistant' })
        sendEvent({ type: 'references', notes: references })
        sendEvent({ type: 'done', chatId })
      } catch (err) {
        sendEvent({ type: 'error', message: err.message })
      } finally {
        res.end()
      }
    }))
}

export default chatEndpoints
