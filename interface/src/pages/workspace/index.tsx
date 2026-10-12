import { App, Input, Select } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { createWorkspace, deleteWorkspace, getWorkspaceList, getWorkspaceStats, updateWorkspace } from '@/api/workspace'
import type { WorkspaceItem, WorkspaceListParams, WorkspaceStats } from '@/api/workspace'
import { getModelConfigList } from '@/api/setting'
import WorkspaceModal, { toWorkspacePayload } from '@/components/workspace-modal'
import type { WorkspaceFormValues } from '@/components/workspace-modal'
import { WORKSPACE_STATUS } from '@/components/status-pill'
import { EmptyState, FilterPill, SkeletonCard, StatCard } from '@/components/ui'
import { CREATE_WORKSPACE_EVENT, dispatchWorkspaceChanged } from '@/components/shell/workspace-events'
import { formatRelative } from '@/utils/time'

const fetchWorkspaceList = async (params?: WorkspaceListParams) => {
  const [err, res] = await getWorkspaceList(params)
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

const SORT_OPTIONS = [
  { value: 'updated_at', label: '最近更新' },
  { value: 'created_at', label: '最近创建' },
  { value: 'title', label: '名称' },
]

// 状态 → 卡片状态行文案与配色（原型 project-card__status：同色圆点 + 文字）
const STATUS_TEXT: Record<number, { label: string; cls: string }> = {
  0: { label: '进行中', cls: 't-success' },
  1: { label: '暂停', cls: 't-warning' },
  2: { label: '已归档', cls: 't-muted' },
}

const PlusIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 14 14"
    fill="none"
    stroke="#fff"
    strokeWidth="1.6"
    strokeLinecap="round">
    <path d="M7 1.5v11M1.5 7h11" />
  </svg>
)

// 原型 04 空态手提箱图形
const EmptyProjectsIcon = () => (
  <svg
    width="56"
    height="56"
    viewBox="0 0 56 56"
    fill="none"
    stroke="#b9c4ce"
    strokeWidth="1.6">
    <rect
      x="8"
      y="15"
      width="40"
      height="30"
      rx="4"
    />
    <path
      d="M8 23h40M19 15v-3.5A2.5 2.5 0 0 1 21.5 9h13a2.5 2.5 0 0 1 2.5 2.5V15"
      strokeLinecap="round"
    />
  </svg>
)

export default function Page({ loaderData }) {
  const navigate = useNavigate()
  const { message, modal } = App.useApp()

  const [list, setList] = useState<WorkspaceItem[]>(loaderData[0])
  const [stats, setStats] = useState<WorkspaceStats | null>(loaderData[1])
  const [modelList] = useState(loaderData[2])
  const [filter, setFilter] = useState<string>('全部')
  const [searchInput, setSearchInput] = useState('')
  const [keyword, setKeyword] = useState('')
  const [sortKey, setSortKey] = useState('updated_at')
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<WorkspaceItem | null>(null)
  const [confirmLoading, setConfirmLoading] = useState(false)

  useEffect(() => {
    const openCreateModal = () => {
      setEditing(null)
      setModalOpen(true)
    }
    window.addEventListener(CREATE_WORKSPACE_EVENT, openCreateModal)
    return () => window.removeEventListener(CREATE_WORKSPACE_EVENT, openCreateModal)
  }, [])

  const refresh = async (opts?: { label?: string; title?: string; sort?: string }) => {
    const label = opts?.label ?? filter
    const status = WORKSPACE_STATUS.find((s) => s.label === label)?.value
    const sort = opts?.sort ?? sortKey
    const title = opts?.title ?? keyword
    const params: WorkspaceListParams = { orderBy: sort, orderDir: sort === 'title' ? 'ASC' : 'DESC' }
    if (status !== undefined) params.status = status
    if (title) params.title = title
    setLoading(true)
    const [nextList, nextStats] = await Promise.all([fetchWorkspaceList(params), fetchWorkspaceStats()])
    setList(nextList)
    setStats(nextStats)
    setLoading(false)
    dispatchWorkspaceChanged()
  }

  // 搜索防抖：停止输入 400ms 后刷新列表（挂载时 keyword 与输入一致则跳过）
  useEffect(() => {
    if (searchInput === keyword) return
    const timer = setTimeout(() => {
      setKeyword(searchInput)
      refresh({ title: searchInput })
    }, 400)
    return () => clearTimeout(timer)
  }, [searchInput])

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
    if (editing) confirmDelete(editing)
  }

  // 状态流转：卡片内联归档/恢复；暂停⇄恢复经编辑弹窗的「当前状态」（原型 05b）
  const changeStatus = async (item: WorkspaceItem, status: number) => {
    const [err, res] = await updateWorkspace({ id: item.id, status })
    if (res) {
      message.success(status === 0 ? '已恢复推进' : status === 1 ? '已暂停' : '已归档')
      refresh()
    }
  }

  const confirmDelete = (item: WorkspaceItem) => {
    modal.confirm({
      title: `确定删除「${item.title}」？`,
      content: '删除后项目下的会话与笔记将一并移除，不可恢复。',
      okText: '删除',
      okButtonProps: { danger: true },
      onOk: async () => {
        const [err, res] = await deleteWorkspace(item.id)
        if (res) {
          message.success('项目已删除')
          setModalOpen(false)
          refresh()
        }
      },
    })
  }

  const activeCount = stats?.active ?? 0
  const pausedCount = stats?.paused ?? 0
  const archivedCount = stats?.archived ?? 0
  const weekCount = stats?.advancedThisWeek ?? 0
  const totalCount = activeCount + pausedCount + archivedCount
  const countOf = (value: number) => ({ 0: activeCount, 1: pausedCount, 2: archivedCount })[value] ?? 0

  // 统计卡取值配色：有值用语义色，归零态统一灰（原型 04）
  const statsItems = [
    { key: 'active', label: '进行中', value: activeCount, tone: activeCount > 0 ? 'active' : 'archived' },
    { key: 'paused', label: '暂停', value: pausedCount, tone: pausedCount > 0 ? 'paused' : 'archived' },
    { key: 'archived', label: '已归档', value: archivedCount, tone: 'archived' },
    { key: 'week', label: '本周有推进', value: weekCount, tone: weekCount > 0 ? 'stream' : 'archived' },
  ] as const

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto">
      {/* 页头（原型 04：零项目时不渲染页头新建按钮，仅空态卡内保留） */}
      <div className="page-head">
        <div className="page-head__text">
          <span className="t-title">项目工作台</span>
          <span className="t-body t-muted">Aura 是面向长期项目推进的 AI 工作台 · 选一个项目继续推进，或新建一个项目</span>
        </div>
        {totalCount > 0 ? (
          <button
            type="button"
            className="btn btn--primary"
            onClick={openCreate}>
            <PlusIcon />
            新建项目
          </button>
        ) : null}
      </div>

      {/* 统计卡 */}
      <div className="stats">
        {statsItems.map((item) => (
          <StatCard
            key={item.key}
            label={item.label}
            value={item.value}
            tone={item.tone}
          />
        ))}
      </div>

      {/* 筛选胶囊 + 排序 + 搜索 */}
      <div className="aura-compact flex items-center gap-2">
        <div className="filters">
          <FilterPill
            active={filter === '全部'}
            onClick={() => {
              setFilter('全部')
              refresh({ label: '全部' })
            }}>
            全部 {totalCount}
          </FilterPill>
          {WORKSPACE_STATUS.map((status) => (
            <FilterPill
              key={status.value}
              active={filter === status.label}
              onClick={() => {
                setFilter(status.label)
                refresh({ label: status.label })
              }}>
              {status.label} {countOf(status.value)}
            </FilterPill>
          ))}
        </div>
        <div className="flex-1" />
        <Select
          options={SORT_OPTIONS}
          value={sortKey}
          onChange={(value) => {
            setSortKey(value)
            refresh({ sort: value })
          }}
          style={{ width: 104 }}
        />
        <Input
          allowClear
          prefix={<SearchOutlined style={{ fontSize: 12, color: 'var(--placeholder)' }} />}
          placeholder="搜索项目名称"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          style={{ width: 150 }}
        />
      </div>

      {/* 项目卡片列表（加载态为骨架卡） */}
      {loading ? (
        <div className="card-grid">
          {[1, 2, 3, 4, 5, 6].map((key) => (
            <SkeletonCard
              key={key}
              rows={4}
              className="w-[340px]"
            />
          ))}
        </div>
      ) : list.length ? (
        <div className="card-grid">
          {list.map((item) => {
            const status = STATUS_TEXT[item.status] ?? STATUS_TEXT[2]
            return (
              <article
                key={item.id}
                className={`project-card ${item.status === 2 ? 'project-card--archived' : ''}`}
                onClick={() => enterChat(item)}>
                <span className={`project-card__status ${status.cls}`}>{status.label}</span>
                <span
                  className="project-card__title"
                  title={item.title}>
                  {item.title}
                </span>
                <span className="project-card__goal">
                  {item.goal ? `目标：${item.goal}` : <span className="t-placeholder">未设置目标</span>}
                </span>
                <span className="project-card__desc">{item.description || '暂无背景描述'}</span>
                <span className="project-card__meta">
                  {[item.modelName || '未挂载模型', formatRelative(item.updatedAt), `${item.chatCount} 条对话`].join(' · ')}
                </span>
                <div
                  className="project-card__actions"
                  onClick={(e) => e.stopPropagation()}>
                  {item.status !== 2 ? (
                    <>
                      <span
                        className="t-primary w-semi"
                        onClick={() => enterChat(item)}>
                        继续推进
                      </span>
                      <span
                        className="t-muted"
                        onClick={() => openEdit(item)}>
                        编辑
                      </span>
                      <span
                        className="t-muted"
                        onClick={() => changeStatus(item, 2)}>
                        归档
                      </span>
                    </>
                  ) : (
                    <>
                      <span
                        className="t-primary w-semi"
                        onClick={() => enterChat(item)}>
                        查看
                      </span>
                      <span
                        className="t-muted"
                        onClick={() => changeStatus(item, 0)}>
                        恢复为进行中
                      </span>
                      <span
                        className="t-danger"
                        onClick={() => confirmDelete(item)}>
                        删除
                      </span>
                    </>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      ) : (
        <EmptyState
          icon={<EmptyProjectsIcon />}
          title={keyword ? `没有匹配「${keyword}」的项目` : filter === '全部' ? '还没有项目' : '该状态下暂无项目'}
          description={
            !keyword && filter === '全部' ? '创建第一个项目，设定目标与背景，开始推进与沉淀' : '切换筛选条件或清除搜索看看'
          }
          action={
            !keyword && filter === '全部' ? (
              <button
                type="button"
                className="btn btn--primary"
                onClick={openCreate}>
                <PlusIcon />
                新建项目
              </button>
            ) : null
          }
        />
      )}

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
