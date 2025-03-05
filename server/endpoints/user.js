import express from 'express'
import sql from '../sql/index.js'

const router = express.Router()

function workspaceEndpoints(apiRouter) {
  apiRouter.use('/user', router)

  router.get('/', async (req, res) => {
    try {
      const [data] = await sql.query('SELECT * FROM user')
      res.status(200).json(data)
    } catch (e) {
      res.status(500).json({
        message: 'get user error',
        error: e.message
      })
    }
  })

  router.post('/create', async (req, res) => {
    const { name, email = null, password = null } = req.body

    try {
      const [data] = await sql.execute(
        'INSERT INTO user (name, email, password) VALUES (?, ?, ?)',
        [name, email, password]
      )
      res.status(200).json(data)
    } catch (e) {
      res.status(500).json({
        message: 'create user error',
        error: e.message
      })
    }
  })

  router.post('/update', async (req, res) => {
    const { id, name, email, password } = req.body

    try {
      const [data] = await sql.execute(
        'UPDATE user SET name = ?, email = ?, password = ? WHERE id = ?',
        [name, email, password, id]
      )
      res.status(200).json(data)
    } catch (e) {
      res.status(500).json({
        message: 'update user error',
        error: e.message
      })
    }
  })

  router.post('/delete', async (req, res) => {
    const { id } = req.body

    try {
      const [data] = await sql.execute('DELETE FROM user WHERE id = ?', [id])
      res.status(200).json(data)
    } catch (e) {
      res.status(500).json({
        message: 'delete user error',
        error: e.message
      })
    }
  })
}

export default workspaceEndpoints
