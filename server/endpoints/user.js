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
}

export default workspaceEndpoints
