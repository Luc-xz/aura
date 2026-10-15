import { searchNotesTool } from './tools/search-notes.js'
import { getNoteDetailTool } from './tools/get-note-detail.js'
import { saveNoteTool } from './tools/save-note.js'

export function buildNoteTools(user, options = {}) {
  const { workspaceId, sourceChatId, onNoteFound, onNoteSaved } = options
  return {
    search_notes: searchNotesTool(user, onNoteFound),
    get_note_detail: getNoteDetailTool(user, onNoteFound),
    save_note: saveNoteTool(user, { workspaceId, sourceChatId, onNoteSaved }),
  }
}

export { NOTE_TOOLS_SYSTEM_PROMPT } from './prompts.js'