import express from 'express'
import sql from '../sql/index.js'

const router = express.Router()

function workspaceEndpoints(apiRouter) {
  apiRouter.use('/workspace', router)

  router.get('/', async (req, res) => {
    try {
      const [data] = await sql.query('SELECT * FROM workspace')
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
      const [data] = await sql.query('SELECT * FROM workspace WHERE id = ?', [req.params.id])
      const [chat] = await sql.query('SELECT * FROM chat WHERE workspace_id = ?', [req.params.id])
      res.status(200).json({
        message: 'get workspace success',
        data: {
          ...data,
          chatList: chat || []
        },
      })
    } catch (err) {
      res.status(500).json({
        message: 'get workspace error',
        error: err.message
      })
    }
  })

  router.post('/', async (req, res) => {
    try {
      const { title, model } = req.body
      const [data] = await sql.execute('INSERT INTO workspace (title, model) VALUES (?, ?)', [title, model])
      const [detail] = await sql.query('SELECT * FROM workspace WHERE id = ?', [data.insertId])
      res.status(200).json({
        message: 'create workspace success',
        data: detail[0] || {}
      })
    } catch (err) {
      res.status(500).json({
        message: 'create workspace error',
        error: err.message
      })
    }
  })

  router.put('/:id', async (req, res) => {
    try {
      const { id } = req.params
      const { title, model } = req.body
      const [data] = await sql.execute('UPDATE workspace SET title = ?, model = ? WHERE id = ?', [title, model, id])
      res.status(200).json({
        message: 'update workspace success',
      })
    } catch (err) {
      res.status(500).json({
        message: 'update workspace error',
        error: err.message
      })
    }
  })

  router.delete('/:id', async (req, res) => {
    try {
      const { id } = req.params
      await sql.execute('DELETE FROM workspace WHERE id = ?', [id])
      res.status(200).json({
        message: 'delete workspace success',
      })
    } catch (err) {
      res.status(500).json({
        message: 'delete workspace error',
        error: err.message
      })
    }
  })
}

export default workspaceEndpoints
