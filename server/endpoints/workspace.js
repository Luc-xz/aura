import express from 'express'
import sql from '../sql/index.js'

const router = express.Router()

function workspaceEndpoints(apiRouter) {
  apiRouter.use('/workspace', router)

  router.get('/', (req, res) => {
    try {
      const data = await sql.query('SELECT * FROM workspace')
      res.status(200).json({
        message: 'get workspace success',
        data
      })
    } catch (err) {
      res.status(500).json({
        message: 'get workspace error',
        error: err.message
      })
    }
  })

  router.get('/:id', async (req, res) => {
    try {
      const data = await sql.query('SELECT * FROM workspace WHERE id = ?', [req.params.id])
      const chat = await sql.query('SELECT * FROM chat WHERE workspace_id = ?', [req.params.id])
      res.status(200).json({
        message: 'get workspace success',
        data: {
          ...data,
          chatList: chat
        },
      })
    } catch (err) {
      res.status(500).json({
        message: 'get workspace error',
        error: err.message
      })
    }
  })
}

export default workspaceEndpoints
