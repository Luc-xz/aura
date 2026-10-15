import { tool } from 'ai'
import { z } from 'zod'
import Note from '../../models/note.js'

const MAX_CHARS = 4000

export function getNoteDetailTool(user, onNoteFound) {
  return tool({
    description:
      '按笔记 id 获取笔记全文。仅当 search_notes 返回的摘要不足以回答问题时才调用，不要对同一个 id 重复调用。',
    inputSchema: z.object({
      noteId: z.number().int().describe('笔记 id，来自 search_notes 返回的列表'),
    }),
    execute: async ({ noteId }) => {
      try {
        const note = await Note.findByIdAndUser(noteId, user)
        if (!note) {
          return { found: false }
        }
        onNoteFound?.({ id: note.id, title: note.title })
        return {
          found: true,
          id: note.id,
          title: note.title,
          content:
            note.content.length > MAX_CHARS
              ? note.content.slice(0, MAX_CHARS) + '\n…（内容过长已截断）'
              : note.content,
        }
      } catch (err) {
        return { found: false, error: 'fetch_failed' }
      }
    },
  })
}