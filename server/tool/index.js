import { searchNotesTool } from './tools/search-notes.js'
import { getNoteDetailTool } from './tools/get-note-detail.js'

export function buildNoteTools(user, hooks = {}) {
  return {
    search_notes: searchNotesTool(user, hooks),
    get_note_detail: getNoteDetailTool(user, hooks),
  }
}

export { NOTE_TOOLS_SYSTEM_PROMPT } from './prompts.js'