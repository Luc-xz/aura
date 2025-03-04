import express from 'express'
import sql from './sql/index.js'

import { loggerMiddleware } from './utils/logger.js'
import userEndpoints from './endpoints/user.js'
import workspaceEndpoints from './endpoints/workspace.js'

const app = express()
const apiRouter = express.Router()

app.use(loggerMiddleware)
app.use('/api', apiRouter)
userEndpoints(apiRouter)
workspaceEndpoints(apiRouter)


app.listen(3000, () => {
  console.log('Server is running on port 3000')
})
