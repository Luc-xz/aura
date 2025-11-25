import db from '../sql/index.js'

const DEFAULT_PAGE = 1
const DEFAULT_PAGE_SIZE = 10
const MAX_PAGE_SIZE = 100

export async function getOffsetPage(baseSql, params, options) {
  const page = Number(options.page) || DEFAULT_PAGE
  const pageSize = Math.min(Number(options.pageSize) || DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE)
  const offset = (page - 1) * pageSize

  // order
  const allowedSortFields = options.allowedSortFields || ['createdAt', 'updatedAt']
  let orderClause = ''
  if (options.orderBy) {
    if (!allowedSortFields.includes(options.orderBy)) {
      throw new Error(`Invalid sort field: ${options.orderBy}`)
    }

    orderClause = `ORDER BY ${options.orderBy}`

    if (options.orderDir) {
      const dir = options.orderDir.toUpperCase() === 'ASC' ? 'ASC' : 'DESC'
      orderClause += ` ${dir}`
    }
  }

  // limit
  const limitClause = `LIMIT ? OFFSET ?`
  const limitParams = [pageSize, offset]

  // query
  const sql = `${baseSql} ${orderClause} ${limitClause}`
  const [rows] = await db.query(sql, [...params, ...limitParams])

  // total
  let total = null
  const countSql = baseSql.replace(/^SELECT.*?FROM/i, 'SELECT COUNT(*) as total FROM')
  const [data] = await db.query(countSql, params)
  total = data?.[0]?.total || 0

  return {
    rows,
    total,
    totalPage: Math.ceil(total / pageSize),
    page,
    pageSize,
    offset,
  }
}
