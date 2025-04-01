import sql from '../sql/index.js'

export function getOffset(query) {
  const page = parseInt(query.page) || 1
  const limit = parseInt(query.limit) || 10
  const offset = (page - 1) * limit
  return {
    limit,
    offset,
    page,
  }
}

export async function getTotal(table) {
  const [[{total}]] = await sql.query(`SELECT COUNT(*) as total FROM ${table}`)
  return total
}
