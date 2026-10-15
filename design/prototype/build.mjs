/**
 * 原型 HTML 生成器
 *
 * 输入：_src/app.css（设计系统）+ _src/partials/*.html（可复用外壳）+ _src/pages/*.html（每屏主体）
 * 输出：../*.html —— 每屏一个自包含文件（CSS 内联、无外部依赖、双击可开）
 *
 * 用法：node build.mjs
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
const srcDir = join(root, '_src')
const pagesDir = join(srcDir, 'pages')
const outDir = root // 生成的屏与入口页同目录（html/）

const css = readFileSync(join(srcDir, 'app.css'), 'utf8')

/** 展开 <!-- @include name.html --> */
function expandIncludes(html) {
  return html.replace(/<!--\s*@include\s+([\w.-]+)\s*-->/g, (_m, name) => {
    const p = join(srcDir, 'partials', name)
    if (!existsSync(p)) throw new Error(`partial not found: ${name}`)
    return readFileSync(p, 'utf8').trimEnd()
  })
}

/** 解析片段头部的 <!--# key: value --> 指令 */
function parseMeta(html) {
  const meta = { title: '', bodyAttrs: '', desc: '' }
  const body = html.replace(/<!--#\s*(\w+)\s*:\s*([\s\S]*?)\s*-->/g, (_m, key, value) => {
    if (key === 'title') meta.title = value
    else if (key === 'body') meta.bodyAttrs = value
    else if (key === 'desc') meta.desc = value
    return ''
  })
  return { meta, body: body.trim() }
}

const FIT_SCRIPT = `
<script>
  // 画布固定 1440×900，按窗口等比缩放，保持与设计稿一致的观感
  function fit() {
    var el = document.querySelector('.screen')
    var stage = document.querySelector('.stage')
    if (!el || !stage) return
    var s = Math.min((window.innerWidth - 32) / 1440, (window.innerHeight - 32) / 900)
    el.style.transform = 'scale(' + s + ')'
    stage.style.width = 1440 * s + 'px'
    stage.style.height = 900 * s + 'px'
  }
  window.addEventListener('resize', fit)
  fit()
</script>`

function render(file) {
  const raw = readFileSync(join(pagesDir, file), 'utf8')
  const { meta, body } = parseMeta(raw)
  const content = expandIncludes(body)

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${meta.title} · Aura 工作台改版原型</title>
<!-- 由 _src/pages/${file} 生成，请勿直接编辑；改源文件后运行 node build.mjs -->
<style>
${css.trimEnd()}
</style>
</head>
<body ${meta.bodyAttrs}>
<div class="stage">
${content}
</div>
${FIT_SCRIPT}
</body>
</html>
`
}

const files = readdirSync(pagesDir).filter((f) => f.endsWith('.html')).sort()
if (!files.length) {
  console.error('no page fragments found in ' + pagesDir)
  process.exit(1)
}

const entries = []
for (const file of files) {
  const raw = readFileSync(join(pagesDir, file), 'utf8')
  const { meta } = parseMeta(raw)
  entries.push({ file, title: meta.title, desc: meta.desc })
  writeFileSync(join(outDir, file), render(file), 'utf8')
  console.log('✓ ' + file)
}

/** HTML 版入口页 */
function renderIndex(list) {
  const group = (item) =>
    item.file.includes('-A.html') ? 'A' : item.file.includes('-B.html') ? 'B' : 'G'
  const LABEL = { A: '方案 A · 系统入口', B: '方案 B · 主体验', G: '全局与索引' }
  const sections = ['A', 'B', 'G']
    .map((k) => {
      const rows = list
        .filter((i) => group(i) === k)
        .map(
          (i) => `      <a class="row" href="${i.file}">
        <span class="row__title">${i.title}</span>
        <span class="row__desc">${i.desc}</span>
        <span class="row__file">${i.file}</span>
      </a>`
        )
        .join('\n')
      return `    <section class="group">
      <h2>${LABEL[k]}</h2>
${rows}
    </section>`
    })
    .join('\n')

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Aura 工作台改版 · HTML 原型</title>
<!-- 由 build.mjs 自动生成 -->
<style>
  :root { --primary:#2266d1; --ink:#16202a; --muted:#6b7785; --line:#dce3ea; --canvas:#f5f7f9; }
  * { box-sizing: border-box; }
  body { margin:0; padding:48px 32px 72px; background:var(--canvas); color:var(--ink);
    font:14px/1.6 Inter,-apple-system,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif; }
  .wrap { max-width:1080px; margin:0 auto; }
  h1 { margin:0 0 8px; font-size:26px; font-weight:700; letter-spacing:-.01em; }
  .sub { margin:0 0 8px; color:var(--muted); font-size:13px; }
  code { background:#eef2f5; padding:1px 5px; border-radius:4px; font-size:12px; }
  .group { margin-top:36px; }
  h2 { margin:0 0 12px; font-size:12px; font-weight:600; color:var(--muted); letter-spacing:.04em; text-transform:uppercase; }
  .row { display:flex; align-items:center; gap:14px; padding:14px 18px; margin-bottom:8px;
    background:#fff; border:1px solid var(--line); border-radius:10px; text-decoration:none; color:inherit; }
  .row:hover { border-color:#9cc0ee; background:#fbfdff; }
  .row__title { font-weight:600; flex:0 0 300px; }
  .row__desc { color:var(--muted); font-size:13px; flex:1 1 auto; }
  .row__file { color:#a3aeb8; font-size:12px; font-family:ui-monospace,Menlo,Consolas,monospace; }
</style>
</head>
<body>
<div class="wrap">
  <h1>Aura 工作台改版 · HTML 原型</h1>
  <p class="sub">
    每屏一个自包含 HTML（内联样式、无外部依赖），双击即可在浏览器查看。
    文本形态便于模型与开发直接读取结构与样式值，替代此前的 PNG 截图。
  </p>
  <p class="sub">
    设计视觉源文件为 Ardot 画布（ardot.tencent.com/file/723970175272232），可随时重新导出；
    此目录由 <code>build.mjs</code> 从 <code>_src/</code> 下的样式与片段生成，改动请改源文件后重新构建。
  </p>
${sections}
</div>
</body>
</html>
`
}

writeFileSync(join(root, 'index.html'), renderIndex(entries), 'utf8')
console.log('✓ index.html（入口页）')
console.log(`\n生成完成：${files.length} 个屏 + 1 个入口页 → ${outDir}`)
