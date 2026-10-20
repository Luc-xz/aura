/**
 * Enforce the Agent Note tree and file format in one pass: lifecycle/class
 * folders, dated filenames, header lines, lifecycle sections, and the
 * alternatives section. Rules live in `.agents/notes/README.md`; the closed
 * class set lives in `governance-config.ts`.
 */

import { globSync, readdirSync, readFileSync } from 'node:fs'
import { resolve, sep } from 'node:path'
import { agentNoteClasses, agentNoteRoot, notesRootRelative } from './governance-config.ts'

const LIFECYCLES = ['proposed', 'implemented', 'rejected'] as const

/** Non-note Markdown allowed directly at a lifecycle root. */
const ROOT_ALLOWLIST = new Set(['AGENTS.md', 'CLAUDE.md'])

/** Status-line grammar per lifecycle folder. */
const STATUS: Record<string, RegExp> = {
  proposed: /^Status: proposed$/,
  implemented: /^Status: implemented$/,
  rejected: /^Status: rejected — .+$/,
}

/** Required `##` headings per lifecycle, beyond the universal `## Problem` opener. */
const REQUIRED: Record<string, string[]> = {
  proposed: ['## Proposal', '## Acceptance criteria', '## Risks'],
  implemented: ['## Decision', '## Consequences'],
  rejected: ['## Proposal'],
}

/** Headings banned in `implemented/`: proposal-era spec-speak. */
const BANNED_IMPLEMENTED = /^## (?:Proposal\b|Plan\b|Migration plan\b|Acceptance criteria\b)/i

const errors: string[] = []
let checked = 0

for (const entry of readdirSync(agentNoteRoot, { withFileTypes: true })) {
  if (entry.name === 'INDEX.md') {
    errors.push('structure: INDEX.md — centralized indexes are forbidden; browse the lifecycle tree or search')
  } else if (entry.isDirectory() && !(LIFECYCLES as readonly string[]).includes(entry.name)) {
    errors.push(`structure: ${entry.name}/ — unknown lifecycle folder (allowed: ${LIFECYCLES.join(', ')})`)
  }
}

for (const lifecycle of LIFECYCLES) {
  const matches = globSync(`${lifecycle}/**/*.md`, { cwd: agentNoteRoot })
    .map(path => path.split(sep).join('/'))
    .sort()
  for (const rel of matches) {
    const segs = rel.split('/')
    if (segs.length === 2 && ROOT_ALLOWLIST.has(segs[1] ?? '')) continue
    if (rel.endsWith('.zh.md')) continue
    const cls = segs[1]
    const base = segs[2]
    if (segs.length !== 3 || cls === undefined || base === undefined) {
      errors.push(`structure: ${rel} — expected {lifecycle}/{class}/file.md (got depth ${segs.length})`)
      continue
    }
    if (!(agentNoteClasses as readonly string[]).includes(cls)) {
      errors.push(`structure: ${rel} — unknown class folder "${cls}" (allowed: ${agentNoteClasses.join(', ')})`)
      continue
    }
    if (!/^\d{4}-\d{2}-\d{2}-.+\.md$/.test(base)) {
      errors.push(`structure: ${rel} — filename must be yyyy-mm-dd-topic.md`)
      continue
    }
    checked += 1
    checkFormat(rel, lifecycle)
  }
}

function checkFormat(rel: string, lifecycle: string): void {
  const fail = (msg: string): void => {
    errors.push(`format: ${rel} — ${msg}`)
  }
  // Split on CRLF as well as LF: the repository's Windows working tree is
  // checked out with core.autocrlf=true, and a trailing \r would otherwise
  // make every header line miss its grammar.
  const lines = readFileSync(resolve(agentNoteRoot, rel), 'utf8').split(/\r?\n/)
  // Format tokens inside fenced examples are not document structure.
  let inFence = false
  const prose = lines.filter((line) => {
    if (line.startsWith('```')) {
      inFence = !inFence
      return false
    }
    return !inFence
  })

  if (!/^# Agent Note: \S/.test(lines[0] ?? '')) fail('line 1 must be `# Agent Note: <title>`')
  if (lines[1] !== '') fail('line 2 must be blank')
  const status = STATUS[lifecycle]
  if (status !== undefined && !status.test(lines[2] ?? '')) {
    fail(`line 3 must match the ${lifecycle} status grammar (${String(status)})`)
  }
  if (lines[3] !== '') fail('line 4 must be blank')
  const extraStatus = prose.filter(line => line.startsWith('Status:') && line !== lines[2])
  if (extraStatus.length > 0 || prose.filter(line => line === lines[2]).length > 1) {
    fail('the line-3 `Status:` line must be the only one in the file')
  }

  const h2s = prose.filter(line => line.startsWith('## ')).map(line => line.trimEnd())
  if (h2s[0] !== '## Problem') fail(`the first section must be \`## Problem\` (got ${JSON.stringify(h2s[0] ?? '<none>')})`)
  for (const required of REQUIRED[lifecycle] ?? []) {
    if (!h2s.includes(required)) fail(`missing the required \`${required}\` section`)
  }
  if (lifecycle === 'implemented') {
    for (const heading of h2s.filter(h => BANNED_IMPLEMENTED.test(h))) {
      fail(`\`${heading}\` is a proposal-era heading; an implemented note states what is (fold it into Decision/Consequences)`)
    }
  }
  if (!h2s.includes('## Alternatives considered')) {
    fail('missing `## Alternatives considered` — record what the decision beat')
  }
}

if (errors.length === 0) {
  console.log(`verify-agent-notes: ${checked} note(s) checked in ${notesRootRelative}; structure and format conform.`)
  process.exit(0)
}

console.error('verify-agent-notes: violations found:')
for (const error of errors) console.error(`  ${error}`)
process.exit(1)
