import bcrypt from 'bcryptjs'

const salt = bcrypt.genSaltSync(10)

export const hashPassword = async (password) => {
  return await bcrypt.hash(password, salt)
}

export const comparePassword = async (password, hash) => {
  return await bcrypt.compare(password, hash)
}
