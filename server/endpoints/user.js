import express from 'express'
import sql from '../sql/index.js'

const router = express.Router()

function workspaceEndpoints(apiRouter) {
  apiRouter.use('/user', router)

  router.get('/', async (req, res) => {
    try {
      const [data] = await sql.query(`select * from user`)
      res.status(200).send(data)
    } catch (e) {
      console.error('[get user error]:', e)
      res.status(500).send('get user error:', e)
    }
  })

  router.post('/create', (req, res) => {
    res.send(`Hello World ${req.params.param}`)
  })
}

export default workspaceEndpoints
