import express from 'express'
import bodyParser from 'body-parser'
import sql from './sql/index.js'

import { loggerMiddleware } from './utils/logger.js'
import userEndpoints from './endpoints/user.js'
import workspaceEndpoints from './endpoints/workspace.js'
import chatEndpoints from './endpoints/chat.js'

const app = express()
const apiRouter = express.Router()

app.use(bodyParser.json())
app.use(loggerMiddleware)
app.use('/api', apiRouter)
userEndpoints(apiRouter)
workspaceEndpoints(apiRouter)
chatEndpoints(apiRouter)

app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.type === 'entity.parse.failed') {
    return res.status(400).json({ 
      success: false, 
      message: 'invalid request body'
    })
  }
  next()
})

app.all('(.*)', (req, res, next) => {
  res.status(404)
})

app.listen(3000, () => {
  console.log('Server is running on port 3000')
})
