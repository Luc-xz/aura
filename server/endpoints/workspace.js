import express from 'express'

const router = express.Router()

function workspaceEndpoints(apiRouter) {
  apiRouter.use('/workspace', router)

  router.get('/', (req, res) => {
    res.send('Hello World')
  })

  router.get('/:param', (req, res) => {
    res.send(`Hello World ${req.params.param}`)
  })
}

export default workspaceEndpoints
