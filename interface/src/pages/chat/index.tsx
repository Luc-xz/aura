import { Button } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { useState } from 'react'
import './index.css'

function ChatHistory() {
  const [history, setHistory] = useState([
    {
      id: 1,
      title: '对话1',
      model: 'gpt-3.5-turbo',
      createdAt: '2021-01-01 12:00:00',
      updatedAt: '2021-01-01 12:00:00',
      data: [
        {
          proposer: 'bot',
          content: '你好，我是小明，很高兴认识你',
          time: '2021-01-01 12:00:00',
        },
        {
          proposer: 'user',
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
          proposer: 'bot',
          content: '你好，我是小明，很高兴认识你',
          time: '2021-01-01 12:00:00',
        },
        {
          proposer: 'user',
          content: '你好，小明，很高兴认识你',
          time: '2021-01-01 12:00:00',
        },
      ],
    },
  ])
  const [activeChat, setActiveChat] = useState(history[0])

  const HistoryCardList = history.map((item) => (
    <div
      key={item.id}
      onClick={() => setActiveChat(item)}
      className={`p-3 w-full space-x-2  cursor-pointer ${item.id === activeChat.id ? 'card-active' : 'card-inactive'}`}>
      <div className="flex items-center">
        <div className="flex flex-col justify-between">
          <div>{item.title}</div>
          <div className="text-sm text-gray-500">{item.model}</div>
        </div>
        {item.id === activeChat.id && <div className="relative bottom-1 flex-1 text-xl text-right cursor-pointer">...</div>}
      </div>
    </div>
  ))

  return (
    <div className="flex-1 bg-moon p-4 border-r border-border">
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
  )
}

function Chat() {
  return <div className="flex-4">Chat</div>
}

export default function Page({}) {
  return (
    <div className="flex w-full h-full">
      <ChatHistory />
      <Chat />
    </div>
  )
}
