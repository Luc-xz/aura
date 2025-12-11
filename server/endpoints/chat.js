import express from 'express'
import sql from '../sql/index.js'
import Chat from '../models/chat.js'
import { asyncHandler } from '../utils/asyncHandler.js'

const router = express.Router()

function chatEndpoints(apiRouter) {
  apiRouter.use('/chat', router)

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

  router.post('/:workspaceId', asyncHandler(async (req, res) => {
    const { workspaceId } = req.params
    const { content, stream = true, think = true } = req.body
    await Chat.create({ workspaceId, content, proposer: 'user' })
    const response = await fetch('http://localhost:11434/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'deepseek-r1:7b',
        messages: [{ role: 'user', content }],
        stream,
        think,
      })
    })
    if (!stream) {
      const data = await response.json()
      await Chat.create({ workspaceId, content: data.message?.content, proposer: 'assistant' })
      res.status(200).json({
        data: data.message?.content,
        code: 1,
        message: 'success'
      })
      return
    }

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let data = ''
    let thinking = true
    let thinkingStartedMarkerSent = false

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const chunk = decoder.decode(value, { stream: true })
      for (const line of chunk.split('\n')) {
        if (!line.trim()) continue
        const obj = JSON.parse(line)
        const thinkPiece = obj?.message?.thinking || ''
        const piece = obj?.message?.content || ''

        if (thinking && !thinkPiece && piece) {
          thinking = false
          if (thinkingStartedMarkerSent) {
            res.write('[THINKING_END]\n')
          }
        }

        if (thinking && thinkPiece) {
          if (!thinkingStartedMarkerSent) {
            res.write('[THINKING_START]\n')
            thinkingStartedMarkerSent = true
          }
          data += thinkPiece
          res.write(thinkPiece)
        } else if (!thinking && piece) {
          data += piece
          res.write(piece)
        }

        if (obj?.done) {
          if (thinking && thinkingStartedMarkerSent) {
            res.write('[THINKING_END]')
          }
          await Chat.create({ workspaceId, content: data, proposer: 'assistant' })
          res.end()
        }
      }
    }
  }))
}

export default chatEndpoints
