import { tool } from 'ai'
import { z } from 'zod'
import Note from '../../models/note.js'

const TITLE_MAX = 50
const DESCRIPTION_MAX = 255

export function saveNoteTool(user, { workspaceId, sourceChatId, onNoteSaved } = {}) {
  return tool({
    description:
      '把当前对话中产生的结论、方案或重要信息保存为一条笔记。' +
      '仅当用户明确要求保存（如"记下来""存成笔记"），或本轮讨论得出了值得长期保留的明确结论时才调用；' +
      '一次回复最多保存一条，保存后在回复中告知用户笔记标题。',
    inputSchema: z.object({
      title: z.string().min(1).max(TITLE_MAX).describe('笔记标题，不超过 50 字，概括核心结论'),
      content: z.string().min(1).describe('笔记正文，整理为适合日后阅读的独立内容，不要夹带对话语气'),
      description: z.string().max(DESCRIPTION_MAX).optional().describe('一句话摘要，可选'),
    }),
    execute: async ({ title, content, description }) => {
      try {
        const safeTitle = title.slice(0, TITLE_MAX)
        const safeDescription = description == null ? description : String(description).slice(0, DESCRIPTION_MAX)
        const id = await Note.create(user, {
          title: safeTitle,
          content,
          description: safeDescription,
          workspaceId,
          sourceChatId,
        })
        onNoteSaved?.({ id, title: safeTitle })
        return { saved: true, id, title: safeTitle }
      } catch (err) {
        return { saved: false, error: 'save_failed' }
      }
    }
  })
}
