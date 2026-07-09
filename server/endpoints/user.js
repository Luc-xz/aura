import express from 'express'
import sql from '../sql/index.js'
import User from '../models/user.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import Validator from '../../shared/utils/validator.js'
import { AppError, BadRequest, NotFound, Conflict } from '../utils/appError.js'
import { comparePassword } from '../utils/bcrypt.js'
import jwt from 'jsonwebtoken'
import { authMiddleware } from '../middlewares/auth.js'

const router = express.Router()

function userEndpoints(apiRouter) {
  apiRouter.use('/user', router)

  router.get('/list', asyncHandler(authMiddleware), asyncHandler(async (req, res) => {
    const { page, pageSize, orderBy, orderDir, ...rest } = req.query
    const data = await User.findAll({
      filters: rest,
      sort: {
        orderBy,
        orderDir
      }
    })
    res.status(200).json({
      data,
      code: 200,
      message: 'success'
    })
  }))

  router.get('/page', asyncHandler(authMiddleware), asyncHandler(async (req, res) => {
    const { page, pageSize, orderBy, orderDir, ...rest } = req.query
    const data = await User.findAll({
      filters: {
        ...rest,
        createdAt: rest?.createdAt?.split(',') || null,
        updatedAt: rest?.updatedAt?.split(',') || null,
      },
      pagination: {
        page,
        pageSize
      },
      sort: {
        orderBy,
        orderDir
      }
    })
    res.status(200).json({
      data,
      code: 200,
      message: 'success'
    })
  }))

  router.get('/:id', asyncHandler(authMiddleware), asyncHandler(async (req, res) => {
    const { id } = req.params
    const data = await User.findById(id)
    if (!data) {
      throw NotFound('user not found')
    }
    res.status(200).json({
      data,
      code: 200,
      message: 'success'
    })
  }))

  router.post('/register', asyncHandler(async (req, res) => {
    const { name, email, password } = req.body
    if (!name || !email || !password) {
      throw BadRequest('name, email and password are required')
    }
    if (!Validator.isValidName(name)) {
      throw BadRequest('name must be 4-16 characters (letters, digits, _ or -)')
    }
    if (!Validator.isEmail(email)) {
      throw BadRequest('invalid email format')
    }
    if (!Validator.isStrongPassword(password)) {
      throw BadRequest('password must be at least 8 characters with letters, digits and special chars (-_)')
    }
    const existing = await User.findByEmail(email)
    if (existing) {
      throw Conflict('email already registered')
    }
    const existingName = await User.findByName(name)
    if (existingName) {
      throw Conflict('name already registered')
    }
    const data = await User.create({ name, email, password })
    res.status(200).json({
      data,
      code: 200,
      message: 'success',
    })
  }))

  router.post('/login', asyncHandler(async (req, res) => {
    const { email, password } = req.body
    if (!email || !password) {
      throw BadRequest('email and password are required')
    }
    if (!Validator.isEmail(email)) {
      throw BadRequest('invalid email format')
    }
    const data = await User.findByEmail(email)
    if (!data) {
      throw NotFound('user not found')
    }
    const isMatch = await comparePassword(password, data.password)
    if (!isMatch) {
      throw BadRequest('password is incorrect')
    }
    const { id, name } = data
    const token = jwt.sign({ id, name, email }, process.env.JWT_SECRET, {
      algorithm: 'HS256',
      expiresIn: '3 days'
    })

    res.status(200).json({
      data: {
        id,
        name,
        email,
        token
      },
      code: 200,
      message: 'success',
    })
  }))

  router.put('/:id', asyncHandler(authMiddleware), asyncHandler(async (req, res) => {
    const { id } = req.params
    const { name, email, password } = req.body

    // 至少传一个字段
    if (!name && !email && !password) {
      throw BadRequest('at least one field (name, email, password) is required')
    }
    if (name && !Validator.isValidName(name)) {
      throw BadRequest('name must be 4-16 characters (letters, digits, _ or -)')
    }
    if (email && !Validator.isEmail(email)) {
      throw BadRequest('invalid email format')
    }
    if (password && !Validator.isStrongPassword(password)) {
      throw BadRequest('password must be at least 8 characters with letters, digits and special chars (-_)')
    }

    const existing = await User.findById(id)
    if (!existing) {
      throw NotFound('user not found')
    }
    if (email && email !== existing.email) {
      const emailTaken = await User.findByEmail(email)
      if (emailTaken) {
        throw Conflict('email already in use')
      }
    }

    const data = await User.update(id, { name, email, password })
    res.status(200).json({
      data,
      code: 200,
      message: 'success',
    })
  }))

  router.delete('/:id', asyncHandler(authMiddleware), asyncHandler(async (req, res) => {
    const { id } = req.params
    const existing = await User.findById(id)
    if (!existing) {
      throw NotFound('user not found')
    }
    const data = await User.delete(id)
    res.status(200).json({
      data,
      code: 200,
      message: 'success'
    })
  }))
}

export default userEndpoints
