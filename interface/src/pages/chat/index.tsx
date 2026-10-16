import { App, Dropdown, Form, Input, Modal } from 'antd'
import { Bubble } from '@ant-design/x'
import { CheckOutlined } from '@ant-design/icons'
import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router'
import { getWorkspaceList, updateWorkspace, deleteWorkspace } from '@/api/workspace'
import { getChatListByWorkspaceId, chatToWorkspace, streamChatToWorkspace } from '@/api/chat'
import { getNotePage, createNote } from '@/api/note'
import { getModelConfigList } from '@/api/setting'
import { useWorkspaceStore } from '@/store'
import { createSSEParser } from '@/utils/sse'
import { getPreferences } from '@/utils/preferences'
import { Pill } from '@/components/ui'
import WorkspaceModal from '@/components/workspace-modal'
import ProjectContext from '@/components/project-context'
import { SettingIcon } from '@/components/shell/icons'
import { dispatchWorkspaceChanged } from '@/components/shell/workspace-events'

const fetchWorkspaceList = async () => {
  const [err, res] = await getWorkspaceList()
  if (res) {
    return res.data || []
  }
  return []
}

const fetchModelList = async () => {
  const [err, res] = await getModelConfigList()
  if (res) {
    return res.data || []
  }
  return []
}

export async function clientLoader({ request }) {
  // F1.2：?workspaceId= 指定进入的项目，优先级高于 store 兜底
  const workspaceId = new URL(request.url).searchParams.get('workspaceId')
  return [await fetchWorkspaceList(), await fetchModelList(), workspaceId]
}

// 原型 06：AI 面板内 11px 文字动作行（复制 / 存为笔记 / 重新生成）
const CheckSmIcon = () => (
  <svg
    width="11"
    height="11"
    viewBox="0 0 14 14"
    fill="none"
    stroke="#2f7d5c"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round">
    <path d="M2.5 7.5l3 3 6-6" />
  </svg>
)

const CheckCurrentIcon = () => (
  <svg
    width="11"
    height="11"
    viewBox="0 0 14 14"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round">
    <path d="M2.5 7.5l3 3 6-6" />
  </svg>
)

// 原型 07：空会话气泡图形
const ChatEmptyIcon = () => (
  <svg
    width="56"
    height="56"
    viewBox="0 0 56 56"
    fill="none"
    stroke="#b9c4ce"
    strokeWidth="1.6">
    <path
      d="M10 14h36v24H24l-10 8V38h-4z"
      strokeLinejoin="round"
    />
    <path
      d="M20 24h16M20 30h10"
      strokeLinecap="round"
    />
  </svg>
)

// 原型 06：composer 发送箭头
const SendIcon = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 18 18"
    fill="none"
    stroke="#fff"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round">
    <path d="M3 9h11M9.5 4.5 14 9l-4.5 4.5" />
  </svg>
)

function ChatPanel({ workspace, modelList, sessionNoteOpen, onSessionNoteClose, onSessionNoteSaved }) {
  const [conversation, setConversation] = useState<any[]>([])
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [historyLoaded, setHistoryLoaded] = useState(false)
  // 会话状态胶囊：流式中 / 已中断（SSE 未收到 done 或出错）
  const [streamStatus, setStreamStatus] = useState<'idle' | 'streaming' | 'interrupted'>('idle')
  const streamDoneRef = useRef(true)
  const [saveTarget, setSaveTarget] = useState(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const [saveForm] = Form.useForm()
  const { message } = App.useApp()
  const setWorkspace = useWorkspaceStore((state) => state.setWorkspace)

  // P0 空态引导提示词：对齐原型 07 静态文案，后续可按项目 goal 生成
  const SUGGESTED_PROMPTS = ['梳理官网信息架构', '生成主导航文案', '复盘上次对话结论']

  const deriveTitle = (text: string) => {
    const firstLine = text.split('\n').find((l) => l.trim()) ?? '对话笔记'
    return firstLine.replace(/^#+\s*|^[-*]\s*|^>\s*/g, '').slice(0, 50)
  }

  const getSelectionInside = (bubbleEl: HTMLElement) => {
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed) return ''
    const range = sel.getRangeAt(0)
    return bubbleEl.contains(range.commonAncestorContainer) ? sel.toString() : ''
  }

  const openSave = (e, item) => {
    const bubbleEl = (e.currentTarget as HTMLElement).closest('.ant-bubble')?.querySelector('.ant-bubble-content')
    const selected = bubbleEl ? getSelectionInside(bubbleEl as HTMLElement) : ''
    const content = selected || item.content
    setSaveTarget({ content, chatId: item.id })
    saveForm.setFieldsValue({ title: deriveTitle(content), content })
  }

  const handleSave = async () => {
    await saveForm.validateFields()
    const values = saveForm.getFieldsValue()
    const [err, res] = await createNote({
      ...values,
      workspaceId: workspace.id,
      sourceChatId: saveTarget.chatId,
    })
    if (res) {
      message.success('已保存为笔记')
      setSaveTarget(null)
      saveForm.resetFields()
      onSessionNoteClose?.()
      onSessionNoteSaved?.()
    } else {
      message.error('保存失败：' + err.message)
    }
  }

  const handleCopy = (content) => {
    navigator.clipboard.writeText(content)
    message.success('已复制')
  }

  const toNote = (id) => navigate(`/note/edit/${id}`)

  // 会话级存为笔记：拼接当前会话为内容（右栏 side-foot 入口经 Page 桥接触发）
  useEffect(() => {
    if (!sessionNoteOpen) return
    const content = conversation
      .filter((item) => item.content)
      .map((item) => `${item.proposer === 'user' ? '我' : '助手'}：${item.content}`)
      .join('\n\n')
    if (!content) {
      message.warning('当前会话没有可保存的内容')
      onSessionNoteClose?.()
      return
    }
    setSaveTarget({ content, chatId: null })
    saveForm.setFieldsValue({ title: deriveTitle(content), content })
  }, [sessionNoteOpen])

  const chatBubbleList = workspace
    ? conversation?.map?.((item, index) => {
        // AI 面板：工具状态 + 正文 + 动作行 + 引用来源 + 保存回执（原型 06 msg__panel）
        const assistantPanel = (
          <div className="msg__panel">
            {item.status && !item.content ? (
              <span className="tool-status">
                <CheckSmIcon />
                {item.status}
              </span>
            ) : null}
            <div className="msg__text whitespace-pre-wrap">{item.content}</div>
            <div className="msg__actions">
              <button
                type="button"
                className="msg-action"
                onClick={() => handleCopy(item.content)}>
                复制
              </button>
              {item.id ? (
                <button
                  type="button"
                  className="msg-action"
                  onClick={(e) => openSave(e, item)}>
                  存为笔记
                </button>
              ) : null}
              {index === conversation.length - 1 && !loading ? (
                <button
                  type="button"
                  className="msg-action"
                  onClick={() => handleRegenerate(index)}>
                  重新生成
                </button>
              ) : null}
            </div>
            {item.references?.length ? (
              <div className="ref-row">
                <span className="t-xs t-placeholder">引用来源：</span>
                {item.references.map((ref) => (
                  <button
                    type="button"
                    key={ref.id}
                    className="ref-tag"
                    onClick={() => toNote(ref.id)}>
                    📄 {ref.title}
                  </button>
                ))}
              </div>
            ) : null}
            {item.savedNotes?.length ? (
              <div className="flex flex-col items-start gap-1.5">
                {item.savedNotes.map((n) => (
                  <button
                    type="button"
                    key={n.id}
                    className="save-receipt"
                    onClick={() => toNote(n.id)}>
                    <CheckCurrentIcon />
                    已保存：{n.title} · 查看笔记
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        )
        return (
          <Bubble
            placement={item.proposer === 'user' ? 'end' : 'start'}
            content={item.proposer === 'user' ? <div className="whitespace-pre-wrap">{item.content}</div> : assistantPanel}
            typing={item.proposer !== 'user' && !item.id ? true : false}
            key={index}
          />
        )
      })
    : null

  // 统一发送：流式与否由本地偏好决定；base 供重新生成基于截断后的历史重建会话
  const send = async (content: string, base = conversation) => {
    if (!workspace || !content) {
      return false
    }
    setLoading(true)
    const newConversation = [...base, { proposer: 'user', content }]
    if (getPreferences().stream) {
      setStreamStatus('streaming')
      streamDoneRef.current = false
      setConversation([...newConversation, { proposer: 'assistant', content: '', references: [] }])
      const feed = createSSEParser((evt) => {
        setConversation((prev) => {
          const last = { ...prev[prev.length - 1] }
          const rest = prev.slice(0, -1)
          if (evt.type === 'text') last.content += evt.value
          if (evt.type === 'status') last.status = evt.value
          if (evt.type === 'references') last.references = evt.notes
          if (evt.type === 'error') last.content += `\n${evt.statusCode != null ? `${evt.statusCode}: ` : ''}${evt.message}`
          if (evt.type === 'done' && evt.chatId) last.id = evt.chatId
          if (evt.type === 'note-saved') last.savedNotes = [...(last.savedNotes || []), evt.note]
          return [...rest, last]
        })
        if (evt.type === 'done') {
          streamDoneRef.current = true
          setStreamStatus('idle')
        }
        if (evt.type === 'error') {
          setStreamStatus('interrupted')
        }
      })

      await streamChatToWorkspace(workspace.id, content, (e: any) => {
        feed(e.event.target.responseText)
      })
      // 流结束仍未收到 done 视为中断（连接被掐断 / 出错未恢复）
      if (!streamDoneRef.current) {
        setStreamStatus('interrupted')
      }
    } else {
      setConversation(newConversation)
      const [err, res] = await chatToWorkspace(workspace.id, content)
      if (res) {
        // 非流式响应同样是 { content, references } 信封
        setConversation([...newConversation, { proposer: 'assistant', content: res.data.content, references: res.data.references || [] }])
      } else {
        const status = err?.response?.status ?? err?.code
        setConversation([...newConversation, { proposer: 'assistant', content: `${status != null ? `${status}: ` : ''}${err.message}` }])
        setStreamStatus('interrupted')
      }
    }
    setLoading(false)
  }

  const handleSubmit = () => {
    const content = prompt.trim()
    if (!content || loading) return
    setPrompt('')
    send(content)
  }

  // 消息级重新生成：截断到目标 assistant 前的 user 消息，重发同一段内容
  const handleRegenerate = (index: number) => {
    if (loading) return
    const userMsg = conversation[index - 1]
    if (!userMsg || userMsg.proposer !== 'user') return
    send(userMsg.content, conversation.slice(0, index - 1))
  }

  // 模型快捷切换：更新项目挂载；PUT 只回布尔，成功后在本地合并模型字段刷新展示
  const handleModelSwitch = async (modelId: number) => {
    if (!workspace || modelId === workspace.modelId) return
    const target = modelList.find((item) => item.id === modelId)
    const [err, res] = await updateWorkspace({ id: workspace.id, modelId })
    if (res) {
      message.success('模型已切换')
      setWorkspace({ ...workspace, modelId, modelName: target?.modelName ?? null })
    }
  }

  // 会话列表请求代际：URL 参数切换项目时丢弃乱序返回的过期响应
  const fetchSeqRef = useRef(0)

  const fetchConversation = async () => {
    const seq = ++fetchSeqRef.current
    if (!workspace?.id) {
      setConversation([])
      setHistoryLoaded(true)
      return false
    }
    const [err, res] = await getChatListByWorkspaceId(workspace.id)
    if (seq !== fetchSeqRef.current) return
    if (res) {
      setConversation(res.data || [])
      setHistoryLoaded(true)
    }
  }

  useEffect(() => {
    fetchConversation()
  }, [workspace])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth',
      })
    }
  }, [conversation])

  return (
    <div className="col-mid h-full">
      {/* 项目头（原型 06 mid-head：60px，标题 + 目标 + 模型 chip + 会话状态） */}
      <header className="mid-head">
        <div className="page-head__text">
          <span className="mid-head__title">{workspace?.title || '未选择项目'}</span>
          <span className="mid-head__sub">{workspace ? (workspace.goal ? `目标：${workspace.goal}` : '未设置项目目标') : '从左侧选择一个项目'}</span>
        </div>
        <div className="mid-head__right">
          {streamStatus === 'streaming' ? (
            <Pill
              tone="stream"
              size="sm">
              生成中
            </Pill>
          ) : null}
          {streamStatus === 'interrupted' ? (
            <Pill
              tone="aborted"
              size="sm">
              已中断
            </Pill>
          ) : null}
          <Dropdown
            menu={{
              items: modelList.map((item) => ({
                key: item.id,
                label: item.modelName,
                icon: item.id === workspace?.modelId ? <CheckOutlined /> : null,
              })),
              onClick: ({ key }) => handleModelSwitch(Number(key)),
            }}
            placement="bottomRight"
            disabled={!workspace}>
            <button
              type="button"
              className="model-chip"
              title="切换模型"
              disabled={!workspace}>
              ✦ {workspace?.modelName || '默认模型'}
            </button>
          </Dropdown>
          <button
            type="button"
            className="mt-[-2px] flex h-4 w-4 items-center justify-center text-muted hover:text-primary"
            title="模型配置"
            onClick={() => navigate('/setting/model-config')}>
            <SettingIcon />
          </button>
        </div>
      </header>

      {/* 消息流 / 空会话引导（原型 07） */}
      <div
        className="mid-body"
        ref={scrollRef}>
        {workspace && historyLoaded && !conversation?.length && !loading ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="flex w-120 flex-col items-center gap-3">
              <ChatEmptyIcon />
              <span className="t-h3">开始推进「{workspace.title}」</span>
              <span className="t-body t-muted">说清你要解决的问题，模型会结合项目目标与已沉淀的结论给出建议。</span>
              {workspace.goal || workspace.description ? (
                <span className="t-xs t-success">已注入项目目标与背景，助手了解你的项目上下文</span>
              ) : (
                <span className="t-xs t-placeholder">设置项目目标与背景后，将自动注入对话上下文</span>
              )}
              <div className="mt-1.5 flex flex-wrap justify-center gap-2">
                {SUGGESTED_PROMPTS.map((text) => (
                  <button
                    key={text}
                    type="button"
                    className="tag tag-btn"
                    style={{ height: 28, padding: '0 12px' }}
                    onClick={() => setPrompt(text)}>
                    {text}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="chat-record mx-auto flex w-full max-w-210 flex-col gap-4">{chatBubbleList}</div>
        )}
      </div>

      {/* 输入区（原型 06 composer：白卡 + Enter 提示 + 30px 渐变发送钮） */}
      <div className="mid-foot">
        <div className="composer">
          <textarea
            className="composer-input"
            rows={2}
            placeholder="就这个项目继续提问"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault()
                handleSubmit()
              }
            }}
          />
          <div className="composer__tools">
            <span>Enter 发送</span>
            <button
              type="button"
              className="composer__send"
              disabled={loading}
              title={loading ? '生成中…' : '发送'}
              onClick={handleSubmit}>
              <SendIcon />
            </button>
          </div>
        </div>
      </div>

      <Modal
        title="保存为笔记"
        open={!!saveTarget}
        forceRender
        okText="确定"
        cancelText="取消"
        onCancel={() => {
          setSaveTarget(null)
          saveForm.resetFields()
          onSessionNoteClose?.()
        }}
        onOk={handleSave}>
        <Form form={saveForm}>
          <Form.Item
            name="title"
            label="标题"
            rules={[{ required: true }, { max: 50, message: '不超过 50 字' }]}>
            <Input />
          </Form.Item>
          <Form.Item
            name="description"
            label="描述"
            rules={[{ max: 255, message: '不超过 255 字' }]}>
            <Input.TextArea
              rows={2}
              maxLength={255}
            />
          </Form.Item>
          <Form.Item
            name="content"
            label="内容"
            rules={[{ required: true }]}
            initialValue={saveTarget?.content}>
            <Input.TextArea autoSize={{ minRows: 10 }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default function Page({ loaderData }) {
  const workspace = useWorkspaceStore((state) => state.workspace)
  const setWorkspace = useWorkspaceStore((state) => state.setWorkspace)
  const { message, modal } = App.useApp()
  // 右栏关联笔记由页面层持有：会话级保存成功后可主动刷新（P2 沉淀联动）
  const [notes, setNotes] = useState<any[]>([])
  const [sessionNoteOpen, setSessionNoteOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsSaving, setSettingsSaving] = useState(false)
  const navigate = useNavigate()

  const workspaceList = loaderData[0]
  const modelList = loaderData[1]
  // URL 参数只在首轮选中消费一次，之后的切换由用户点击或 store 持久化决定
  const initialIdRef = useRef(loaderData[2])
  // 首帧对账：持久化的项目已被删/不在列表时先置空；对账完成后不再介入
  const reconciledRef = useRef(false)
  if (!reconciledRef.current) {
    if (workspace && !workspaceList.some((item) => item.id === workspace.id)) {
      setWorkspace(null)
    } else {
      reconciledRef.current = true
    }
  }

  // 选中优先级：URL 参数 > store 已持久化选择 > 兜底首个（左栏列表点击经 store 生效）
  useEffect(() => {
    if (!workspaceList?.length) {
      if (workspace) setWorkspace(null)
      return
    }
    let next = null
    if (initialIdRef.current) {
      next = workspaceList.find((item) => String(item.id) === initialIdRef.current) || null
      initialIdRef.current = null
    }
    if (!next && workspace?.id) {
      next = workspaceList.find((item) => item.id === workspace.id) || null
    }
    if (!next) next = workspaceList[0]
    if (next?.id !== workspace?.id) setWorkspace(next)
  }, [workspaceList])

  const refreshNotes = async () => {
    if (!workspace?.id) {
      setNotes([])
      return
    }
    const [err, res] = await getNotePage({
      page: 1,
      pageSize: 5,
      workspaceId: workspace.id,
      orderBy: 'updated_at',
      orderDir: 'DESC',
    })
    setNotes(res?.data?.rows || [])
  }

  useEffect(() => {
    refreshNotes()
  }, [workspace?.id])

  // 右栏「项目设置」：编辑弹窗保存后合并回 store 并联动侧栏
  const handleSettingsOk = async (values) => {
    if (!workspace) return
    setSettingsSaving(true)
    const [err, res] = await updateWorkspace({ ...values, id: workspace.id })
    setSettingsSaving(false)
    if (res) {
      message.success('项目已更新')
      setSettingsOpen(false)
      setWorkspace({ ...workspace, ...values })
      dispatchWorkspaceChanged()
    }
  }

  // 编辑弹窗删除入口（原型 05b）：删除约束由后端 409 兜底（仅归档可删）
  const handleSettingsDelete = () => {
    if (!workspace) return
    modal.confirm({
      title: `确定删除「${workspace.title}」？`,
      content: '删除后项目下的会话与笔记将一并移除，不可恢复。',
      okText: '确认删除',
      okButtonProps: { danger: true },
      onOk: async () => {
        const [err, res] = await deleteWorkspace(workspace.id)
        if (res) {
          message.success('项目已删除')
          setSettingsOpen(false)
          setWorkspace(null)
          dispatchWorkspaceChanged()
          navigate('/workspace')
        } else {
          message.error(err?.message || '删除失败')
        }
      },
    })
  }

  return (
    <div className="flex h-full w-full min-w-0">
      <ChatPanel
        workspace={workspace}
        modelList={modelList}
        sessionNoteOpen={sessionNoteOpen}
        onSessionNoteClose={() => setSessionNoteOpen(false)}
        onSessionNoteSaved={refreshNotes}
      />
      <ProjectContext
        workspace={workspace}
        notes={notes}
        onSaveSessionNote={() => setSessionNoteOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
      />
      <WorkspaceModal
        open={settingsOpen}
        modelList={modelList}
        editing={workspace}
        confirmLoading={settingsSaving}
        onOk={handleSettingsOk}
        onCancel={() => setSettingsOpen(false)}
        onDelete={handleSettingsDelete}
      />
    </div>
  )
}
