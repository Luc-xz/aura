/**
 * Run both gates. `pnpm run test` is the single entry: it resolves Markdown
 * links and validates the Agent Note tree and format. Both gates run
 * concurrently and report their own failures.
 */

import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const GATES: readonly { label: string; script: string }[] = [
  { label: 'markdown links', script: 'verify-md-links' },
  { label: 'agent notes', script: 'verify-agent-notes' },
]

interface GateResult {
  label: string
  passed: boolean
  tail: string[]
}

function runGate(label: string, script: string): Promise<GateResult> {
  return new Promise((resolveGate) => {
    // One static command string per gate (repo-owned script name, no external input);
    // shell:true resolves pnpm.cmd on Windows without an args-array deprecation.
    const child = spawn(`pnpm run ${script}`, { shell: true, stdio: ['ignore', 'pipe', 'pipe'] })
    const tail: string[] = []
    const collect = (chunk: Buffer): void => {
      for (const line of chunk.toString('utf8').split('\n')) {
        if (line.trim() !== '') tail.push(line)
        if (tail.length > 12) tail.shift()
      }
    }
    child.stdout?.on('data', collect)
    child.stderr?.on('data', collect)
    child.on('error', (error) => resolveGate({ label, passed: false, tail: [String(error)] }))
    child.on('close', code => resolveGate({ label, passed: code === 0, tail }))
  })
}

async function main(): Promise<number> {
  const results = await Promise.all(GATES.map(g => runGate(g.label, g.script)))
  for (const result of results) {
    console.log(`  ${result.passed ? 'PASS' : 'FAIL'}  ${result.label}`)
  }
  const failed = results.filter(r => !r.passed)
  for (const result of failed) {
    console.error(`\n${result.label} failed:`)
    for (const line of result.tail) console.error(`  ${line}`)
  }
  console.log(`run-gates: ${results.length - failed.length}/${results.length} gate(s) passed.`)
  return failed.length === 0 ? 0 : 1
}

const invokedPath = process.argv[1]
const isMain = invokedPath !== undefined && import.meta.url === pathToFileURL(resolve(invokedPath)).href
if (isMain) {
  process.exit(await main())
}
