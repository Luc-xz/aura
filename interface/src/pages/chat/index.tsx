import { Button, Card, Divider, Flex, Space, Modal, Form, Input, Dropdown, message } from 'antd'
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
  CloudUploadOutlined,
  LinkOutlined,
} from '@ant-design/icons'
import { useState, useEffect, useRef } from 'react'
import { getWorkspaceList, createWorkspace, updateWorkspace, deleteWorkspace } from '@/api/workspace'
import { getChatListByWorkspaceId, chatToWorkspace } from '@/api/chat'

function HistoryPanel({ workspace, setWorkspace }) {
  const [history, setHistory] = useState([])
  const [historyVisible, setHistoryVisible] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [form] = Form.useForm()
  const historyRef = useRef(null)

  const dropdown = (
    <Dropdown
      menu={{
        items: [
          {
            key: 'edit',
            label: '编辑对话',
          },
          {
            key: 'delete',
            label: '删除对话',
          },
        ],
        onClick: ({ key }) => {
          if (key === 'edit') {
            form.setFieldsValue({
              id: workspace.id,
              title: workspace.title,
              model: workspace.model,
            })
            setIsModalOpen(true)
            return
          }
          if (key === 'delete') {
            Modal.confirm({
              title: '确定删除对话吗？',
              onOk: async () => {
                const [err, res] = await deleteWorkspace(workspace.id)
                if (res) {
                  message.success('操作成功')
                  fetchWorkspaceList()
                }
              },
            })
            return
          }
        },
      }}
      placement="bottomLeft">
      <div className="ml-2 relative bottom-1 text-xl text-right cursor-pointer">...</div>
    </Dropdown>
  )

  const HistoryCardList = history.map((item) => (
    <div
      key={item.id}
      onClick={() => setWorkspace(item)}
      className={`p-3 w-full space-x-2 cursor-pointer rounded hover:bg-blue-100 ${
        item.id === (workspace && workspace.id) ? 'card-active' : 'card-inactive'
      }`}>
      <div className="flex items-center w-full">
        <div className="flex flex-col justify-between flex-1 overflow-hidden">
          <div className="truncate">{item.title}</div>
          <div className="truncate text-sm text-gray-500">{item.model}</div>
        </div>
        {item.id === (workspace && workspace.id) && dropdown}
      </div>
    </div>
  ))

  const handleEditWorkspace = async () => {
    await form.validateFields()
    let flag = form.getFieldValue('id') ? 'update' : 'create'
    let api = flag === 'update' ? updateWorkspace : createWorkspace
    const [err, res] = await api(form.getFieldsValue(true))
    if (res) {
      message.success('操作成功')
      setIsModalOpen(false)
      form.resetFields()
      setWorkspace(res.data)
      fetchWorkspaceList()
    } else {
      message.error('操作失败：' + err.message)
    }
  }

  const fetchWorkspaceList = async () => {
    const [err, res] = await getWorkspaceList()
    console.log('getWorkspaceList', res, err)
    if (res) {
      let history = res.data || []
      setHistory(history)
    }
  }

  useEffect(() => {
    fetchWorkspaceList()
  }, [])

  useEffect(() => {
    let chat = history.find((item) => item.id === workspace?.id) || history[0]
    setWorkspace(chat)
  }, [history])

  return (
    <div className="relative bg-moon border-r border-ashen flex-0">
      <div className={`overflow-hidden h-full transition-all duration-300 ${historyVisible ? 'w-55' : 'w-0'}`}>
        <div className="overflow-hidden p-4 w-55 h-full">
          <div className="title-ter mb-8">历史对话</div>
          <Button
            onClick={() => setIsModalOpen(true)}
            className="w-full mb-2"
            color="default"
            variant="outlined"
            icon={<PlusOutlined />}>
            新建对话
          </Button>
          <div
            ref={historyRef}
            className="overflow-y-auto h-[calc(100%-92px)]">
            {HistoryCardList}
          </div>
        </div>
      </div>
      <div
        className="absolute top-[50%] right-[-32px] w-5 h-11 flex items-center justify-center bg-moon color-primary text-sm hover:text-base border border-ashen rounded text-gray-500 cursor-pointer"
        onClick={() => setHistoryVisible(!historyVisible)}>
        {historyVisible ? <CaretLeftFilled /> : <CaretRightFilled />}
      </div>
      <Modal
        title={`${form.getFieldValue('id') ? '编辑' : '新建'}对话`}
        closable={true}
        open={isModalOpen}
        onOk={handleEditWorkspace}
        onCancel={() => setIsModalOpen(false)}>
        <Form form={form}>
          <Form.Item
            name="title"
            label="对话名称"
            rules={[{ required: true, message: '请输入对话名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item
            name="model"
            label="对话模型"
            rules={[{ required: true, message: '请输入对话模型' }]}>
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

function ChatPanel({ workspace }) {
  const [conversation, setConversation] = useState<any[]>([])
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth',
      })
    }
  }, [conversation])

  const chatBubbleList = workspace
    ? conversation?.map?.((item, index) => (
        <Bubble
          placement={item.proposer === 'user' ? 'end' : 'start'}
          content={<div className="whitespace-pre-wrap">{item.content}</div>}
          typing={item.proposer !== 'user' && !item.id ? true : false}
          avatar={{ icon: item.proposer === 'user' ? <UserOutlined /> : <MehOutlined /> }}
          variant={item.proposer === 'user' ? 'filled' : 'shadow'}
          key={index}
          footer={
            item.proposer === 'user' ? null : (
              <Space>
                <Button
                  color="default"
                  variant="text"
                  size="small"
                  icon={<SyncOutlined />}
                />
                <Button
                  color="default"
                  variant="text"
                  size="small"
                  icon={<CopyOutlined />}
                />
              </Space>
            )
          }
        />
      ))
    : null

  const handleSend = async () => {
    if (!workspace || prompt.trim() === '') {
      return false
    }
    let content = prompt.trim()
    setPrompt('')
    setLoading(true)
    const newConversation = [...conversation, { proposer: 'user', content }]
    setConversation(newConversation)
    const [err, res] = await chatToWorkspace(workspace.id, { content, stream: false })
    if (res) {
      setConversation([...newConversation, { proposer: 'assistant', content: res.data }])
    }
    setLoading(false)
  }

  const fetchConversation = async () => {
    if (!workspace) {
      return false
    }
    const [err, res] = await getChatListByWorkspaceId(workspace.id)
    if (res) {
      setConversation(res.data || [])
    }
  }

  useEffect(() => {
    fetchConversation()
  }, [workspace])

  return (
    <div className="flex flex-4 flex-col">
      {/* Header */}
      <div className="relative flex-none basis-18 flex items-center justify-center shadow-sm">
        <Card
          className="relative z-1 flex-1 mx-10 my-1 max-w-210 h-14"
          size="small">
          <div className="flex items-center px-2 w-full h-8">
            <span className="flex-1 text-md font-bold">{workspace?.model || ''}</span>
            <div className="text-gray cursor-pointer">
              <SwapOutlined />
            </div>
            <Divider type="vertical" />
            <div className="text-gray cursor-pointer">
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
        <div className="mx-auto my-4 w-210">
          <Flex
            gap="middle"
            vertical>
            {chatBubbleList}
          </Flex>
        </div>
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
            onSubmit={handleSend}
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
    </div>
  )
}

export default function Page({}) {
  const [workspace, setWorkspace] = useState(null)

  return (
    <div className="flex w-full h-full">
      <HistoryPanel
        workspace={workspace}
        setWorkspace={setWorkspace}
      />
      <ChatPanel workspace={workspace} />
    </div>
  )
}
