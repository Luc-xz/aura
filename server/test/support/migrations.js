import fs from 'node:fs'

export function readMigrationStatements(filePath, database) {
  const source = fs.readFileSync(filePath, 'utf8')
  const statements = source.split(';').map((statement) => statement.trim()).filter(Boolean)
  let retargeted = 0
  const parsed = statements.map((statement) => statement.replace(/^(\s*USE\s+)`[^`]+`/im, (match, prefix) => {
    retargeted += 1
    return `${prefix}\`${database}\``
  }))
  if (retargeted !== 1) {
    throw new Error(`expected exactly one USE statement in ${filePath}, found ${retargeted}`)
  }
  return parsed
}
