import { Form, Input, Select, App } from 'antd'
import { getNoteById, getNotePage, createNote, updateNote } from '@/api/note'
import { getWorkspaceList } from '@/api/workspace'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useSubmit, useNavigate } from 'react-router'
import { useLeftbarNav } from '@/components/shell/leftbar-nav'
import { ProjectSearch } from '@/components/shell/project-sidebar'
import { formatDateTime, formatRelative } from '@/utils/time'

const getNoteDetail = async (id: string) => {
  const [err, res] = await getNoteById(id)
  return res?.data || null
}

const submitNote = async (payload) => {
  const api = payload.id ? updateNote : createNote
  const [err, res] = await api(payload)
  return res?.data
}

const fetchNoteList = async () => {
  const [err, res] = await getNotePage({ page: 1, pageSize: 30, orderBy: 'updated_at', orderDir: 'DESC' })
  return res?.data?.rows || []
}

export async function clientLoader({ params }) {
  const [raw, list, wsTuple] = await Promise.all([
    params.id ? getNoteDetail(params.id) : Promise.resolve(null),
    fetchNoteList(),
    getWorkspaceList(),
  ])
  // 详情接口返回 snake_case（与列表接口不一致，零后端改动约束下前端归一化）
  const detail = raw
    ? {
        ...raw,
        workspaceId: raw.workspaceId ?? raw.workspace_id,
        createdAt: raw.createdAt ?? raw.created_at,
        updatedAt: raw.updatedAt ?? raw.updated_at,
      }
    : null
  return { detail, list, workspaces: wsTuple?.[1]?.data || [] }
}

export async function clientAction({ request }) {
  const formData = await request.formData()
  const payload: Record<string, unknown> = Object.fromEntries(formData)
  // Select 未选/清空时序列化为 '' 或 'undefined'，剔除避免服务端按空项目校验报错
  if (!payload.workspaceId || payload.workspaceId === 'undefined') {
    delete payload.workspaceId
  } else {
    payload.workspaceId = Number(payload.workspaceId)
  }
  return await submitNote(payload)
}

// 从纯文本内容提取大纲：## 标题整行；「1. 标签：…」编号行取冒号前的短标签
const deriveOutline = (content?: string | null) => {
  if (!content) return []
  return content
    .split('\n')
    .map((line) => line.trim())
    .map((line) => {
      if (/^#{1,6}\s+\S/.test(line)) return line.replace(/^#{1,6}\s+/, '')
      const numbered = line.match(/^\d+[、.．]\s*([^：:]{1,20})[：:]/)
      return numbered ? numbered[1] : null
    })
    .filter(Boolean)
    .slice(0, 6)
}

export default function Page({ loaderData, actionData }) {
  const { message } = App.useApp()
  const [form] = Form.useForm()
  const submit = useSubmit()
  const navigate = useNavigate()
  const { setNav } = useLeftbarNav()

  const [noteList] = useState(loaderData.list)
  const [listKeyword, setListKeyword] = useState('')
  const [savedAt, setSavedAt] = useState<string | null>(loaderData.detail?.updatedAt ?? null)
  const contentValue = Form.useWatch('content', form)
  // 富文本为远期：格式条仅视觉占位（登记不对齐项），保存走表单提交
  const formatBarRef = useRef<HTMLDivElement>(null)

  const handleSubmit = (values) => {
    const payload = { ...values }
    if (!payload.id) delete payload.id
    submit(payload, { method: 'post' })
  }

  useEffect(() => {
    loaderData.detail ? form.setFieldsValue(loaderData.detail) : form.resetFields()
    setSavedAt(loaderData.detail?.updatedAt ?? null)
  }, [loaderData.detail])

  useEffect(() => {
    if (actionData) {
      message.success('已保存')
      setSavedAt(new Date().toISOString())
    }
  }, [actionData])

  const currentId = loaderData.detail?.id

  const filteredList = useMemo(() => {
    const query = listKeyword.trim().toLowerCase()
    if (!query) return noteList
    return noteList.filter((note) => (note.title || '').toLowerCase().includes(query))
  }, [noteList, listKeyword])

  // 左栏（原型 09 窄栏 260px）：笔记搜索 + 笔记列表，替换外壳默认项目列表
  const navNode = useMemo(
    () => (
      <>
        <ProjectSearch
          keyword={listKeyword}
          onChange={setListKeyword}
        />
        <div className="project-list flex-1 overflow-y-auto gap-1.5">
          {filteredList.length ? (
            filteredList.map((note) => (
              <button
                type="button"
                key={note.id}
                className={`session-item ${note.id === currentId ? 'session-item--active' : ''}`}
                onClick={() => navigate(`/note/edit/${note.id}`)}>
                <span className="session-item__title">{note.title || '未命名笔记'}</span>
                <span className="session-item__meta">{formatRelative(note.updatedAt)}</span>
              </button>
            ))
          ) : (
            <div className="px-2.5 py-5 text-center text-xs text-placeholder">没有匹配的笔记</div>
          )}
        </div>
      </>
    ),
    [filteredList, currentId, listKeyword]
  )

  useEffect(() => {
    setNav({ node: navNode, narrow: true })
    return () => setNav(null)
  }, [navNode])

  const outline = useMemo(() => deriveOutline(contentValue), [contentValue])
  const keywords: string[] = loaderData.detail?.keywords || []

  return (
    <Form
      form={form}
      className="flex h-full w-full min-w-0"
      onFinish={handleSubmit}
      onFinishFailed={(err) => message.error(err.errorFields?.[0]?.errors?.[0] || '请检查表单')}>
      <div className="col-mid h-full">
        {/* 格式条（原型 09 format-bar）：富文本远期，仅视觉占位 */}
        <div
          className="format-bar"
          ref={formatBarRef}>
          <span
            className="w-semi"
            style={{ color: 'var(--ink)' }}>
            H1
          </span>
          <span className="w-semi">H2</span>
          <span className="w-semi">B</span>
          <span>
            <em>I</em>
          </span>
          <span style={{ textDecoration: 'underline' }}>U</span>
          <span>• 列表</span>
          <span>1. 编号</span>
          <span>❝ 引用</span>
          <span>代码</span>
          <span className="t-xs t-placeholder ml-auto">{savedAt ? `保存于 ${formatRelative(savedAt)}` : '尚未保存'}</span>
        </div>

        {/* 编辑器（原型 09 editor：28px 标题 + 14px/26 正文，宽留白） */}
        <div className="editor flex-1 overflow-y-auto">
          <Form.Item
            name="id"
            hidden>
            <Input />
          </Form.Item>
          <Form.Item
            name="title"
            noStyle
            rules={[{ required: true, message: '请输入标题' }]}>
            <input
              className="editor-title-input"
              placeholder="未命名笔记"
              maxLength={255}
            />
          </Form.Item>
          <Form.Item
            name="content"
            noStyle
            rules={[{ required: true, message: '请输入内容' }]}>
            <textarea
              className="editor-textarea"
              placeholder="从项目推进中沉淀的内容会出现在这里…"
            />
          </Form.Item>
        </div>
      </div>

      {/* 右栏（原型 09 col-right--sm：属性 / 标签 / 大纲 / 保存） */}
      <aside className="col-right col-right--sm">
        <span className="t-h3">属性</span>
        <div className="side-card side-card--plain aura-form">
          <div className="flex items-center justify-between gap-2">
            <span className="t-sm t-muted flex-none">所属项目</span>
            <Form.Item
              name="workspaceId"
              noStyle>
              <Select
                size="small"
                allowClear
                placeholder="未关联"
                style={{ width: 130 }}
                options={loaderData.workspaces.map((ws) => ({ value: ws.id, label: ws.title }))}
              />
            </Form.Item>
          </div>
          <div className="divider" />
          <div className="flex items-center justify-between gap-2">
            <span className="t-sm t-muted flex-none">描述</span>
            <Form.Item
              name="description"
              noStyle>
              <Input
                size="small"
                maxLength={255}
                placeholder="用于列表摘要"
                className="flex-1"
              />
            </Form.Item>
          </div>
          <div className="divider" />
          <div className="flex items-center justify-between">
            <span className="t-sm t-muted">创建时间</span>
            <span className="t-sm">{loaderData.detail ? formatDateTime(loaderData.detail.createdAt) : '—'}</span>
          </div>
        </div>
        <div className="side-card side-card--plain">
          <span className="side-card__title">标签</span>
          <div className="flex flex-wrap gap-1.5">
            {keywords.length ? keywords.map((kw) => <span
              key={kw}
              className="tag">
              {kw}
            </span>) : <span className="t-xs t-placeholder">暂无标签</span>}
          </div>
        </div>
        <div className="side-card side-card--plain">
          <span className="side-card__title">大纲</span>
          {outline.length ? (
            outline.map((line, index) => (
              <div
                key={index}
                className={`session-item ${index === 0 ? 'session-item--active' : ''}`}>
                <span className="session-item__title">{line}</span>
              </div>
            ))
          ) : (
            <span className="t-xs t-placeholder">正文中的标题行会出现在这里</span>
          )}
        </div>
        <div className="side-foot">
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => navigate('/note')}>
            返回列表
          </button>
          <button
            type="button"
            className="btn btn--primary btn--sm"
            onClick={() => form.submit()}>
            保存
          </button>
        </div>
      </aside>
    </Form>
  )
}
