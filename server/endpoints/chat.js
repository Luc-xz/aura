import express from 'express'
import sql from '../sql/index.js'

const router = express.Router()

function chatEndpoints(apiRouter) {
  apiRouter.use('/chat', router)

  router.post('/', async (req, res) => {
    const { prompt, stream = true } = req.body
    const response = await fetch('http://localhost:11434/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'deepseek-r1:7b',
        messages: [{ role: 'user', content: prompt }],
        stream,
      })
    })
    if (!stream) {
      const data = await response.json()
      console.log('data', data)
      res.status(200).json({
        message: 'chat success',
        data: data.message
      })
      return
    }

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')

    const reader = response.body.getReader()
    const decoder = new TextDecoder()

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const chunk = decoder.decode(value, { stream: true })
      for (const line of chunk.split('\n')) {
        if (!line.trim()) continue
        try {
          const obj = JSON.parse(line)
          const piece = (obj?.message?.thinking ?? obj?.message?.content ?? '')
          if (piece) res.write(`data: ${piece}\n\n`)
          if (obj?.done) res.write(`event: done\ndata: [DONE]\n\n`)
        } catch (err) {
          console.log('err', err)
        }
      }
    }
    res.end()
  })
}

export default chatEndpoints
