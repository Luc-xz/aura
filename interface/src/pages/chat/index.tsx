import { Button, Card, Divider, Flex, Space } from 'antd'
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
import { useState, useEffect } from 'react'

function HistoryPanel({ activeChat, setActiveChat }) {
  const [history, setHistory] = useState([
    {
      id: 1,
      title: '对话1',
      model: 'gpt-3.5-turbo',
      createdAt: '2021-01-01 12:00:00',
      updatedAt: '2021-01-01 12:00:00',
      data: [
        {
          proposer: 'user',
          content: '你好，我是小明，很高兴认识你',
          time: '2021-01-01 12:00:00',
        },
        {
          proposer: 'bot',
          content: '你好，小明，很高兴认识你',
          time: '2021-01-01 12:00:00',
        },
      ],
    },
    {
      id: 2,
      title: '对话2',
      model: 'gpt-3.5-turbo',
      createdAt: '2021-01-01 12:00:00',
      updatedAt: '2021-01-01 12:00:00',
      data: [
        {
          proposer: 'user',
          content: '你好，我是小明，很高兴认识你',
          time: '2021-01-01 12:00:00',
        },
        {
          proposer: 'bot',
          content: '你好，小明，很高兴认识你',
          time: '2021-01-01 12:00:00',
        },
      ],
    },
  ])
  const [historyVisible, setHistoryVisible] = useState(true)

  const HistoryCardList = history.map((item) => (
    <div
      key={item.id}
      onClick={() => setActiveChat(item)}
      className={`p-3 w-full space-x-2  cursor-pointer ${item.id === (activeChat && activeChat.id) ? 'card-active' : 'card-inactive'}`}>
      <div className="flex items-center">
        <div className="flex flex-col justify-between">
          <div>{item.title}</div>
          <div className="text-sm text-gray-500">{item.model}</div>
        </div>
        {item.id === (activeChat && activeChat.id) && <div className="relative bottom-1 flex-1 text-xl text-right cursor-pointer">...</div>}
      </div>
    </div>
  ))

  useEffect(() => {
    setActiveChat(history[0])
  }, [])

  return (
    <div className="relative bg-moon border-r border-border flex-0">
      <div className={`overflow-hidden transition-all duration-300 ${historyVisible ? 'w-55' : 'w-0'}`}>
        <div className="p-4 w-55">
          <div className="title-ter mb-8">历史对话</div>
          <Button
            className="w-full mb-2"
            color="default"
            variant="outlined"
            icon={<PlusOutlined />}>
            新建对话
          </Button>
          {HistoryCardList}
        </div>
      </div>
      <div
        className="absolute top-[50%] right-[-32px] w-5 h-11 flex items-center justify-center bg-moon color-primary text-sm hover:text-base border border-border rounded text-gray-500 cursor-pointer"
        onClick={() => setHistoryVisible(!historyVisible)}>
        {historyVisible ? <CaretLeftFilled /> : <CaretRightFilled />}
      </div>
    </div>
  )
}

function ChatPanel({ activeChat }) {
  const [model, setModel] = useState({
    name: 'DeepSeek-R1',
  })

  const chatBubbleList = activeChat
    ? activeChat.data.map((item) => (
        <Bubble
          placement={item.proposer === 'user' ? 'end' : 'start'}
          content={item.content}
          avatar={{ icon: item.proposer === 'user' ? <UserOutlined /> : <MehOutlined /> }}
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

  return (
    <div className="flex flex-4 flex-col">
      {/* Header */}
      <div className="relative flex-none basis-18 flex items-center justify-center shadow-sm">
        <Card
          className="relative z-1 flex-1 mx-10 my-1 max-w-210 h-14"
          size="small">
          <div className="flex items-center px-2 w-full h-8">
            <span className="flex-1 text-md font-bold">{model.name}</span>
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
      <div className="flex-1">
        <div className="mx-auto my-4 w-210 overflow-y-auto">
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
  const [activeChat, setActiveChat] = useState(null)

  return (
    <div className="flex w-full h-full">
      <HistoryPanel
        activeChat={activeChat}
        setActiveChat={setActiveChat}
      />
      <ChatPanel activeChat={activeChat} />
    </div>
  )
}
