import express from 'express'
import sql from '../sql/index.js'

const router = express.Router()

function noteEndpoints(apiRouter) {
  apiRouter.use('/note', router)

  router.get('/', async (req, res) => {
    try {
      const [data] = await sql.query('SELECT * FROM note')
      res.status(200).json({
        message: 'get note success',
        data,
      })
    } catch (err) {
      res.status(500).json({
        message: 'get note error',
        error: err.message
      })
    }
  })

  router.post('/', async (req, res) => {
    try {
      const { title, content, keywords } = req.body
      const [data] = await sql.query('INSERT INTO note (title, content, keywords) VALUES (?, ?, ?)', [title, content, JSON.stringify(keywords)])
      res.status(200).json({
        message: 'create note success',
        data,
      })
    } catch (err) {
      res.status(500).json({
        message: 'create note error',
        error: err.message
      })
    }
  })

  router.put('/:id', async (req, res) => {
    try {
      const { id } = req.params
      const { title, content, keywords } = req.body
      const [data] = await sql.query('UPDATE note SET title = ?, content = ?, keywords = ? WHERE id = ?', [title, content, JSON.stringify(keywords), id])
      res.status(200).json({
        message: 'update note success',
        data,
      })
    } catch (err) {
      res.status(500).json({
        message: 'update note error',
        error: err.message
      })
    }
  })

  router.delete('/:id', async (req, res) => {
    try {
      const { id } = req.params
      const [data] = await sql.query('DELETE FROM note WHERE id = ?', [id])
      res.status(200).json({
        message: 'delete note success',
        data,
      })
    } catch (err) {
      res.status(500).json({
        message: 'delete note error',
        error: err.message
      })
    }
  })
}

export default noteEndpoints