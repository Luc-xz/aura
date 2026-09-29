import { App, Button, Card, Divider, Dropdown, Flex, Space, Modal, Form, Input, Tag } from 'antd'
import { Bubble, Attachments, Sender } from '@ant-design/x'
import {
  PlusOutlined,
  CaretLeftFilled,
  CaretRightFilled,
  SwapOutlined,
  SettingOutlined,
  UserOutlined,
  MehOutlined,
  SyncOutlined,
  CopyOutlined,
  BookOutlined,
  FileDoneOutlined,
  CloudUploadOutlined,
  LinkOutlined,
  AppstoreOutlined,
  CheckOutlined,
} from '@ant-design/icons'
import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { getWorkspaceList, createWorkspace, updateWorkspace } from '@/api/workspace'
import { getChatListByWorkspaceId, chatToWorkspace, streamChatToWorkspace } from '@/api/chat'
import { getNotePage, createNote } from '@/api/note'
import { getModelConfigList } from '@/api/setting'
import { useWorkspaceStore } from '@/store'
import { createSSEParser } from '@/utils/sse'
import { getPreferences } from '@/utils/preferences'
import WorkspaceModal, { toWorkspacePayload } from '@/components/workspace-modal'
import ProjectContext from '@/components/project-context'
import StatusPill, { statusDotClass } from '@/components/status-pill'

const fetchWorkspaceList = async () => {
  const [err, res] = await getWorkspaceList()
  console.log('[API]::[fetchWorkspaceList]::', res, err)
  if (res) {
    let list = res.data || []
    return list
  }
  return []
}

const fetchModelList = async () => {
  const [err, res] = await getModelConfigList()
  if (res) {
    let list = res.data || []
    return list
  }
  return []
}

export async function clientLoader({ request }) {
  // F1.2：?workspaceId= 指定进入的项目，优先级高于 store 兜底
  const workspaceId = new URL(request.url).searchParams.get('workspaceId')
  return [await fetchWorkspaceList(), await fetchModelList(), workspaceId]
}

function ProjectPanel({ list, modelList, initialId }) {
  const { message } = App.useApp()
  const navigate = useNavigate()
  const [, setSearchParams] = useSearchParams()

  const workspace = useWorkspaceStore((state) => state.workspace)
  const setWorkspace = useWorkspaceStore((state) => state.setWorkspace)

  const [workspaceList, setWorkspaceList] = useState(list)
  const [panelVisible, setPanelVisible] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [confirmLoading, setConfirmLoading] = useState(false)
  // URL 参数只在首轮选中消费一次，之后的切换由用户点击或 store 持久化决定
  const initialIdRef = useRef(initialId)
  // 首帧对账（渲染期）：持久化的项目已被删/不在列表时先置空，避免 ChatPanel 带脏 id 发起 404；
  // 对账完成后不再介入，保证“新建项目后立即选中”不被误清
  const reconciledRef = useRef(false)
  if (!reconciledRef.current) {
    if (workspace && !workspaceList.some((item) => item.id === workspace.id)) {
      setWorkspace(null)
    } else {
      reconciledRef.current = true
    }
  }

  // 选中优先级：URL 参数 > store 已持久化选择 > 兜底首个
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

  const selectWorkspace = (item) => {
    setWorkspace(item)
    // 清掉 URL 参数，避免后续列表刷新时旧参数反选
    setSearchParams({}, { replace: true })
  }

  const handleCreate = async (values) => {
    setConfirmLoading(true)
    const [err, res] = await createWorkspace(toWorkspacePayload(values, 'create'))
    setConfirmLoading(false)
    if (res) {
      message.success('项目已创建')
      setModalOpen(false)
      setWorkspace(res.data)
      setWorkspaceList(await fetchWorkspaceList())
    }
  }

  const ProjectCardList = workspaceList.map((item) => (
    <div
      key={item.id}
      onClick={() => selectWorkspace(item)}
      className={`p-3 mb-1 w-full cursor-pointer rounded hover:bg-blue-100 ${
        item.id === workspace?.id ? 'card-active' : 'card-inactive'
      }`}>
      <div className="flex items-center gap-2 w-full">
        <span className={`flex-none w-2 h-2 rounded-full ${statusDotClass(item.status)}`} />
        <div className="truncate">{item.title}</div>
      </div>
      <div className="truncate text-sm text-gray-500 pl-4">{item.modelName || '默认模型'}</div>
    </div>
  ))

  return (
    <div className="relative bg-moon border-r border-ashen flex-0">
      <div className={`overflow-hidden h-full transition-all duration-300 ${panelVisible ? 'w-55' : 'w-0'}`}>
        <div className="overflow-hidden p-4 w-55 h-full">
          <div className="flex items-center justify-between mb-4">
            <span className="title-ter">项目</span>
            <Button
              type="text"
              size="small"
              icon={<AppstoreOutlined />}
              title="返回工作台"
              onClick={() => navigate('/workspace')}
            />
          </div>
          <Button
            onClick={() => setModalOpen(true)}
            className="w-full mb-2"
            color="default"
            variant="outlined"
            icon={<PlusOutlined />}>
            新建项目
          </Button>
          <div className="overflow-y-auto h-[calc(100%-88px)]">
            {workspaceList.length ? ProjectCardList : <div className="p-2 text-sm text-gray-400">暂无项目，点击上方按钮创建</div>}
          </div>
        </div>
      </div>
      <div
        className="absolute top-[50%] right-[-32px] w-5 h-11 flex items-center justify-center bg-moon color-primary text-sm hover:text-base border border-ashen rounded text-gray-500 cursor-pointer"
        onClick={() => setPanelVisible(!panelVisible)}>
        {panelVisible ? <CaretLeftFilled /> : <CaretRightFilled />}
      </div>
      <WorkspaceModal
        open={modalOpen}
        modelList={modelList}
        confirmLoading={confirmLoading}
        onOk={handleCreate}
        onCancel={() => setModalOpen(false)}
      />
    </div>
  )
}

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

  // P0 空态引导提示词：静态配置，后续可按项目 goal 生成
  const SUGGESTED_PROMPTS = [
    '帮我梳理这个项目的当前进展',
    '基于项目目标，列出下一步行动清单',
    '总结一下已经讨论过的要点',
  ]

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

  // 会话级存为笔记：拼接当前会话为内容（P2 右栏入口经 Page 桥接触发）
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
    ? conversation?.map?.((item, index) => (
        <Bubble
          placement={item.proposer === 'user' ? 'end' : 'start'}
          content={
            <div className="whitespace-pre-wrap">
              {/* 工具调用期间正文还没来，用 status 占位（正在检索笔记…）；正文到了就只显示正文 */}
              {item.proposer !== 'user' && item.status && !item.content ? <span className="text-sm text-gray-400">{item.status}</span> : item.content}
            </div>
          }
          typing={item.proposer !== 'user' && !item.id ? true : false}
          avatar={{ icon: item.proposer === 'user' ? <UserOutlined /> : <MehOutlined /> }}
          variant={item.proposer === 'user' ? 'filled' : 'shadow'}
          key={index}
          footer={
            item.proposer === 'user' ? null : (
              <Space
                direction="vertical"
                size={4}>
              <Space>
                {index === conversation.length - 1 && item.proposer !== 'user' && !loading ? (
                  <Button
                    color="default"
                    variant="text"
                    size="small"
                    icon={<SyncOutlined />}
                    title="重新生成"
                    onClick={() => handleRegenerate(index)}
                  />
                ) : null}
                <Button
                  color="default"
                  variant="text"
                  size="small"
                  icon={<CopyOutlined />}
                  onClick={() => handleCopy(item.content)}
                />
                  {item.id ? (
                    <Button
                      color="default"
                      variant="text"
                      size="small"
                      icon={<BookOutlined />}
                      onClick={(e) => openSave(e, item)}
                    />
                  ) : null}
                </Space>
                {item.references?.length ? (
                  <Space
                    wrap
                    size={4}>
                    {item.references.map((ref) => (
                      <Tag
                        key={ref.id}
                        icon={<LinkOutlined />}
                        color="blue"
                        className="cursor-pointer"
                        onClick={() => toNote(ref.id)}>
                        {ref.title}
                      </Tag>
                    ))}
                  </Space>
                ) : null}
                {item.savedNotes?.length ? (
                  <Space
                    wrap
                    size={4}>
                    {item.savedNotes.map((n) => (
                      <Tag
                        key={n.id}
                        icon={<FileDoneOutlined />}
                        color="green"
                        className="cursor-pointer"
                        onClick={() => toNote(n.id)}>
                        已保存：{n.title}
                      </Tag>
                    ))}
                  </Space>
                ) : null}
              </Space>
            )
          }
        />
      ))
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
          if (evt.type === 'error') last.content += `\n[出错了] ${evt.message}`
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
      console.log('[API]::[chatToWorkspace]::', res, err)
      if (res) {
        // 非流式响应同样是 { content, references } 信封
        setConversation([...newConversation, { proposer: 'assistant', content: res.data.content, references: res.data.references || [] }])
      } else {
        setStreamStatus('interrupted')
      }
    }
    setLoading(false)
  }

  const handleSubmit = () => {
    const content = prompt.trim()
    if (!content) return
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

  const fetchConversation = async () => {
    if (!workspace?.id) {
      setConversation([])
      setHistoryLoaded(true)
      return false
    }
    const [err, res] = await getChatListByWorkspaceId(workspace.id)
    console.log('[API]::[getChatListByWorkspaceId]::', res, err)
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
    <div className="flex flex-4 flex-col">
      {/* Header */}
      <div className="relative flex-none basis-18 flex items-center justify-center shadow-sm">
        <Card
          className="relative z-1 flex-1 mx-10 my-1 max-w-210 h-14"
          size="small">
          <div className="flex items-center px-2 w-full gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-md font-bold truncate">{workspace?.title || '未选择项目'}</span>
                {workspace ? <StatusPill status={workspace.status} /> : null}
              </div>
              <div className="text-xs text-gray-500 truncate">
                {workspace ? workspace.goal || '未设置项目目标' : '从左侧选择或新建一个项目'}
              </div>
            </div>
            {workspace?.modelName ? (
              <Tag
                bordered={false}
                className="m-0">
                {workspace.modelName}
              </Tag>
            ) : null}
            {streamStatus === 'streaming' ? (
              <Tag
                color="processing"
                bordered={false}
                className="m-0"
                icon={<SyncOutlined spin />}>
                生成中
              </Tag>
            ) : null}
            {streamStatus === 'interrupted' ? (
              <Tag
                color="warning"
                bordered={false}
                className="m-0">
                已中断
              </Tag>
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
              <div
                className="text-gray cursor-pointer"
                title="切换模型">
                <SwapOutlined />
              </div>
            </Dropdown>
            <Divider type="vertical" />
            <div
              className="text-gray cursor-pointer"
              title="模型配置"
              onClick={() => navigate('/setting/model-config')}>
              <SettingOutlined />
            </div>
          </div>
        </Card>
        <img
          className="absolute top-0 left-0 z-0 w-full h-full"
          src="src/assets/images/chat-header-bg.jpg"></img>
      </div>
      {/* Record */}
      <div
        className="flex-1 overflow-y-auto"
        ref={scrollRef}>
        {workspace && historyLoaded && !conversation?.length && !loading ? (
          <div className="h-full flex flex-col items-center justify-center px-8 text-center">
            <div className="text-xl font-bold mb-2">开始推进「{workspace.title}」</div>
            <div className="text-sm text-gray-500 mb-2">从下面的话题开始，或直接输入你的问题</div>
            {workspace.goal || workspace.description ? (
              <div className="text-xs text-blue-500 mb-6">已注入项目目标与背景，助手了解你的项目上下文</div>
            ) : (
              <div className="text-xs text-gray-400 mb-6">设置项目目标与背景后，将自动注入对话上下文</div>
            )}
            <Space
              wrap
              size="middle"
              className="justify-center max-w-160">
              {SUGGESTED_PROMPTS.map((text) => (
                <Tag
                  key={text}
                  color="blue"
                  className="cursor-pointer !px-3 !py-1 !text-sm"
                  onClick={() => setPrompt(text)}>
                  {text}
                </Tag>
              ))}
            </Space>
          </div>
        ) : (
          <div className="mx-auto my-4 w-210 chat-record">
            <Flex
              gap="middle"
              vertical>
              {chatBubbleList}
            </Flex>
          </div>
        )}
      </div>
      {/* Prompt */}
      <div className="flex-none basis-13 flex items-center justify-center mb-10">
        <div className="w-210">
          <Sender
            value={prompt}
            loading={loading}
            onChange={(v) => {
              setPrompt(v)
            }}
            onSubmit={handleSubmit}
            prefix={
              <Attachments
                beforeUpload={() => false}
                onChange={({ file }) => {}}
                placeholder={{
                  icon: <CloudUploadOutlined />,
                  title: 'Drag & Drop files here',
                  description: 'Support file type: image, video, audio, document, etc.',
                }}>
                <Button
                  type="text"
                  icon={<LinkOutlined />}
                />
              </Attachments>
            }
          />
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

export default function Page({ loaderData, actionData, params, matches }) {
  const workspace = useWorkspaceStore((state) => state.workspace)
  // 右栏关联笔记由页面层持有：会话级保存成功后可主动刷新（P2 沉淀联动）
  const [notes, setNotes] = useState<any[]>([])
  const [sessionNoteOpen, setSessionNoteOpen] = useState(false)

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

  return (
    <div className="flex w-full h-full">
      <ProjectPanel
        list={loaderData[0]}
        modelList={loaderData[1]}
        initialId={loaderData[2]}
      />
      <ChatPanel
        workspace={workspace}
        modelList={loaderData[1]}
        sessionNoteOpen={sessionNoteOpen}
        onSessionNoteClose={() => setSessionNoteOpen(false)}
        onSessionNoteSaved={refreshNotes}
      />
      <ProjectContext
        workspace={workspace}
        notes={notes}
        onSaveSessionNote={() => setSessionNoteOpen(true)}
      />
    </div>
  )
}
