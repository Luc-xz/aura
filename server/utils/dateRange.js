import { BadRequest } from './appError.js'

const NAIVE_DATE = /^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?)?$/

export function normalizeDateBound(value) {
  if (NAIVE_DATE.test(value)) return value.replace('T', ' ')
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) throw BadRequest('invalid date range')
  return date
}

export function parseDateRange(value) {
  if (value === undefined || value === null || value === '') return null
  if (typeof value !== 'string') throw BadRequest('invalid date range')
  const bounds = value.split(',').map((bound) => bound.trim())
  if (bounds.length !== 2 || bounds.some((bound) => !bound)) throw BadRequest('invalid date range')
  return bounds.map(normalizeDateBound)
}

export function pickDateFilters(query) {
  return {
    ...query,
    createdAt: parseDateRange(query.createdAt),
    updatedAt: parseDateRange(query.updatedAt),
  }
}
