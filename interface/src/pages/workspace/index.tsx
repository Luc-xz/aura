import { App, Button, Card, Divider, Empty, Segmented, Space, Spin, Tag } from 'antd'
import { PlusOutlined, RightOutlined } from '@ant-design/icons'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { createWorkspace, deleteWorkspace, getWorkspaceList, getWorkspaceStats, updateWorkspace } from '@/api/workspace'
import type { WorkspaceItem, WorkspaceStats } from '@/api/workspace'
import { getModelConfigList } from '@/api/setting'
import WorkspaceModal, { toWorkspacePayload } from '@/components/workspace-modal'
import type { WorkspaceFormValues } from '@/components/workspace-modal'
import StatusPill, { WORKSPACE_STATUS } from '@/components/status-pill'
import { formatRelative } from '@/utils/time'

const fetchWorkspaceList = async (status?: number) => {
  const [err, res] = await getWorkspaceList(status === undefined ? undefined : { status: status as 0 | 1 | 2 })
  return res?.data || []
}

const fetchWorkspaceStats = async () => {
  const [err, res] = await getWorkspaceStats()
  return res?.data || null
}

const fetchModelList = async () => {
  const [err, res] = await getModelConfigList({})
  return res?.data || []
}

export async function clientLoader() {
  return [await fetchWorkspaceList(), await fetchWorkspaceStats(), await fetchModelList()]
}

export default function Page({ loaderData }) {
  const navigate = useNavigate()
  const { message, modal } = App.useApp()

  const [list, setList] = useState<WorkspaceItem[]>(loaderData[0])
  const [stats, setStats] = useState<WorkspaceStats | null>(loaderData[1])
  const [modelList] = useState(loaderData[2])
  const [filter, setFilter] = useState<string>('全部')
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<WorkspaceItem | null>(null)
  const [confirmLoading, setConfirmLoading] = useState(false)

  const refresh = async (label = filter) => {
    const status = WORKSPACE_STATUS.find((s) => s.label === label)?.value
    setLoading(true)
    const [nextList, nextStats] = await Promise.all([fetchWorkspaceList(status), fetchWorkspaceStats()])
    setList(nextList)
    setStats(nextStats)
    setLoading(false)
  }

  const openCreate = () => {
    setEditing(null)
    setModalOpen(true)
  }

  const openEdit = (item: WorkspaceItem) => {
    setEditing(item)
    setModalOpen(true)
  }

  const enterChat = (item: WorkspaceItem) => {
    navigate(`/chat?workspaceId=${item.id}`)
  }

  const handleModalOk = async (values: WorkspaceFormValues, mode: 'create' | 'update') => {
    if (mode === 'update' && !editing) return
    setConfirmLoading(true)
    const payload = toWorkspacePayload(values, mode)
    const [err, res] = mode === 'update' ? await updateWorkspace({ ...payload, id: editing!.id }) : await createWorkspace(payload)
    setConfirmLoading(false)
    if (res) {
      message.success(mode === 'update' ? '项目已更新' : '项目已创建')
      setModalOpen(false)
      refresh()
    }
  }

  const handleDelete = () => {
    if (!editing) return
    modal.confirm({
      title: `确定删除「${editing.title}」？`,
      content: '删除后项目下的会话与笔记将一并移除，不可恢复。',
      okText: '删除',
      okButtonProps: { danger: true },
      onOk: async () => {
        const [err, res] = await deleteWorkspace(editing.id)
        if (res) {
          message.success('项目已删除')
          setModalOpen(false)
          refresh()
        }
      },
    })
  }

  const statsItems = [
    { key: 'active', label: '进行中', value: stats?.active ?? 0 },
    { key: 'paused', label: '暂停', value: stats?.paused ?? 0 },
    { key: 'archived', label: '已归档', value: stats?.archived ?? 0 },
    { key: 'advancedThisWeek', label: '本周推进', value: stats?.advancedThisWeek ?? 0 },
  ]

  return (
    <div className="h-full overflow-y-auto bg-white">
      <div className="mx-auto max-w-250 p-8">
        {/* 页头 */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="title-pri mb-1">项目工作台</div>
            <div className="text-sm text-gray-500">Aura 是用于长期项目推进的 AI 工作台，从选择一个项目开始。</div>
          </div>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={openCreate}>
            新建项目
          </Button>
        </div>

        {/* 统计卡 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 my-6">
          {statsItems.map((item) => (
            <Card
              key={item.key}
              size="small">
              <div className="text-2xl font-bold">{item.value}</div>
              <div className="text-sm text-gray-500">{item.label}</div>
            </Card>
          ))}
        </div>

        {/* 状态筛选胶囊 */}
        <div className="mb-4">
          <Segmented
            options={['全部', ...WORKSPACE_STATUS.map((s) => s.label)]}
            value={filter}
            onChange={(value) => {
              setFilter(value as string)
              refresh(value as string)
            }}
          />
        </div>

        {/* 项目卡片列表 */}
        {loading ? (
          <div className="flex justify-center py-16">
            <Spin />
          </div>
        ) : list.length ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {list.map((item) => (
              <Card
                key={item.id}
                hoverable
                styles={{ body: { padding: 16 } }}
                onClick={() => enterChat(item)}>
                <div className="flex items-start justify-between gap-2">
                  <div
                    className="text-base font-bold truncate"
                    title={item.title}>
                    {item.title}
                  </div>
                  <StatusPill status={item.status} />
                </div>
                <div className="mt-2 text-sm text-gray-700 truncate">
                  {item.goal ? `目标：${item.goal}` : <span className="text-gray-400">未设置目标</span>}
                </div>
                <div className="mt-1 text-sm text-gray-500 line-clamp-2 min-h-10">
                  {item.description || '暂无背景描述'}
                </div>
                <Divider className="my-3" />
                <div className="flex items-center justify-between text-xs text-gray-500">
                  {item.modelName ? (
                    <Tag
                      color="blue"
                      bordered={false}
                      className="m-0">
                      {item.modelName}
                    </Tag>
                  ) : (
                    <span>未挂载模型</span>
                  )}
                  <span>{formatRelative(item.updatedAt)}</span>
                </div>
                <div
                  className="mt-3 flex justify-end gap-2"
                  onClick={(e) => e.stopPropagation()}>
                  <Button
                    size="small"
                    onClick={() => openEdit(item)}>
                    编辑
                  </Button>
                  <Button
                    size="small"
                    type="primary"
                    icon={<RightOutlined />}
                    onClick={() => enterChat(item)}>
                    继续推进
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="flex justify-center py-16">
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={filter === '全部' ? '还没有项目，创建第一个项目开始推进' : '该状态下暂无项目'}>
              {filter === '全部' ? (
                <Space>
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={openCreate}>
                    新建项目
                  </Button>
                </Space>
              ) : null}
            </Empty>
          </div>
        )}
      </div>

      <WorkspaceModal
        open={modalOpen}
        modelList={modelList}
        editing={editing}
        confirmLoading={confirmLoading}
        onOk={handleModalOk}
        onCancel={() => setModalOpen(false)}
        onDelete={handleDelete}
      />
    </div>
  )
}
