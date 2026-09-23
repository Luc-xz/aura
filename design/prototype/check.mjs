/**
 * 生成结果自检：
 *  1) class 是否都在 app.css 中有定义（防止样式缺失）
 *  2) 块级标签是否配对（div/section/aside/main/header/footer/article/form/blockquote）
 *  3) 是否残留 include / 指令占位符
 *
 * 用法：node check.mjs
 */
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
const outDir = root

const css = readFileSync(join(root, '_src', 'app.css'), 'utf8')
const defined = new Set([...css.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map((m) => m[1]))

const BLOCKS = ['div', 'section', 'aside', 'main', 'header', 'footer', 'article', 'form', 'blockquote', 'nav']
// 入口页由脚本内联生成、使用独立样式，不参与本套样式校验
const files = readdirSync(outDir)
  .filter((f) => f.endsWith('.html') && f !== 'index.html')
  .sort()

let problems = 0

for (const f of files) {
  const html = readFileSync(join(outDir, f), 'utf8')
  const body = html.slice(html.indexOf('<body'))
  const msgs = []

  // 1) 未定义的 class
  const used = new Set()
  for (const m of body.matchAll(/class="([^"]+)"/g)) {
    m[1].split(/\s+/).filter(Boolean).forEach((c) => used.add(c))
  }
  const missing = [...used].filter((c) => !defined.has(c))
  if (missing.length) msgs.push(`  未定义样式类: ${missing.join(', ')}`)

  // 2) 标签配对
  for (const tag of BLOCKS) {
    const open = (body.match(new RegExp(`<${tag}[\\s>]`, 'g')) || []).length
    const close = (body.match(new RegExp(`</${tag}>`, 'g')) || []).length
    if (open !== close) msgs.push(`  <${tag}> 不配对: 开 ${open} / 闭 ${close}`)
  }

  // 3) 残留占位符
  if (/@include|<!--#/.test(body)) msgs.push('  残留 include 或指令占位符')

  if (msgs.length) {
    problems++
    console.log(`✗ ${f}`)
    msgs.forEach((m) => console.log(m))
  } else {
    console.log(`✓ ${f}`)
  }
}

console.log(`\n检查完成：${files.length} 个文件，${problems} 个存在问题`)
