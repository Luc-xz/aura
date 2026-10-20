/**
 * Central configuration for the documentation gates. Adapt these values when
 * the repository layout changes; no scanning scope lives inside a gate
 * implementation.
 */

import { resolve } from 'node:path'

/** Repository-root path shared by both gates. */
export const repoRoot: string = resolve(import.meta.dirname, '..')

/** Markdown sources checked for broken relative links (repo-relative globs). */
export const markdownPatterns: readonly string[] = [
  'README.md',
  'README.zh-CN.md',
  'AGENTS.md',
  'CLAUDE.md',
  'docs/**/*.md',
  'design/**/*.md',
  'server/**/*.md',
  '.agents/notes/**/*.md',
]

/** Path prefixes excluded from scans. */
export const excludedPrefixes: readonly string[] = [
  'node_modules/',
  'dist/',
  'logs/',
]

/** Agent Note root, absolute and repo-relative. */
export const agentNoteRoot: string = resolve(repoRoot, '.agents/notes')
export const notesRootRelative = '.agents/notes'

/** The closed class set under each lifecycle folder. Extend this to add a class. */
export const agentNoteClasses: readonly string[] = [
  'feature',
  'bug-fix',
  'simplification',
  'architecture',
  'process',
  'testing',
]
