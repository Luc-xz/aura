import { tool } from 'ai'
import { z } from 'zod'
import Note from '../../models/note.js'

export function searchNotesTool(user, hooks = {}) {
  const { onNoteFound } = hooks
  return tool({
    description:
      '在当前用户的笔记库中按关键词检索笔记，返回匹配的笔记摘要列表（标题、描述、关键词、更新时间）。' +
      '当用户的问题可能与其已有笔记、历史结论、之前记录的知识相关时，先调用本工具检索。',
    inputSchema: z.object({
      query: z.string().min(1).describe('检索关键词，建议 1~4 个词，优先用笔记标题里的词'),
      limit: z.number().int().min(1).max(10).optional().describe('返回条数，默认 5'),
    }),
    execute: async ({ query, limit = 5 }) => {
      try {
        const notes = await Note.findByKeywords(user, query, { limit })
        notes.forEach((n) => onNoteFound?.({ id: n.id, title: n.title }))
        return { query, count: notes.length, notes }
      } catch (err) {
        return { query, count: 0, notes: [], error: 'search_failed' }
      }
    },
  })
}