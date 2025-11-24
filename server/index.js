import express from 'express'
import bodyParser from 'body-parser'
import sql from './sql/index.js'

import { loggerMiddleware, errorLoggerMiddleware } from './utils/logger.js'
import userEndpoints from './endpoints/user.js'
import workspaceEndpoints from './endpoints/workspace.js'
import chatEndpoints from './endpoints/chat.js'
import noteEndpoints from './endpoints/note.js'

const app = express()
const apiRouter = express.Router()

app.use(bodyParser.json())
app.use(loggerMiddleware)
app.use('/api', apiRouter)
userEndpoints(apiRouter)
workspaceEndpoints(apiRouter)
chatEndpoints(apiRouter)
noteEndpoints(apiRouter)

// Handle 404 - Catch all unmatched routes
app.use((req, res, next) => {
  const error = new Error('Not Found')
  error.status = 404
  next(error)
})

// Global Error Handler
app.use(errorLoggerMiddleware)
app.use((err, req, res, next) => {
  // Handle Body Parser JSON syntax errors
  if (err instanceof SyntaxError && err.type === 'entity.parse.failed') {
    return res.status(400).json({
      code: 400,
      message: 'invalid request body'
    })
  }

  const statusCode = err.status || 500
  const message = err.message || 'internal server error'

  res.status(statusCode).json({
    code: statusCode,
    message: message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  })
})

app.listen(3000, () => {
  console.log('Server is running on port 3000')
})
