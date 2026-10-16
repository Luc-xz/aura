import { Pagination } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { getNotePage } from '@/api/note'
import { getWorkspaceList } from '@/api/workspace'
import { ProjectSearch } from '@/components/shell/project-sidebar'
import { useLeftbarNav } from '@/components/shell/leftbar-nav'
import { EmptyState } from '@/components/ui'
import { formatRelative } from '@/utils/time'

const PAGE_SIZE = 10

const fetch = async (payload = { page: 1, pageSize: PAGE_SIZE }) => {
  const [err, res] = await getNotePage(payload)
  return res?.data || null
}

export async function clientLoader() {
  const [data, wsTuple, statsData] = await Promise.all([
    fetch(),
    getWorkspaceList(),
    fetch({ page: 1, pageSize: 100, orderBy: 'created_at', orderDir: 'DESC' }),
  ])
  return {
    list: data?.rows || [],
    total: data?.total || 0,
    workspaces: wsTuple?.[1]?.data || [],
    // 汇总样本：常用标签 / 本月新增 / 关联项目（数据量级下一次性取全量近似）
    sample: statsData?.rows || [],
  }
}

export default function Page({ loaderData }) {
  const navigate = useNavigate()
  const { setNav } = useLeftbarNav()

  const [list, setList] = useState(loaderData.list)
  const [total, setTotal] = useState(loaderData.total)
  const [workspaces, setWorkspaces] = useState(loaderData.workspaces)
  const [sample] = useState(loaderData.sample)
  const [filterKey, setFilterKey] = useState<'all' | 'recent'>('all')
  const [workspaceId, setWorkspaceId] = useState<number | undefined>(undefined)
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)

  const orderBy = filterKey === 'recent' ? 'updated_at' : 'created_at'

  const load = async (opts?: { page?: number; keyword?: string; workspaceId?: number; filterKey?: 'all' | 'recent' }) => {
    const next = {
      page: opts?.page ?? page,
      pageSize: PAGE_SIZE,
      orderBy: opts?.filterKey === 'recent' || (!opts?.filterKey && filterKey === 'recent') ? 'updated_at' : 'created_at',
      orderDir: 'DESC' as const,
      workspaceId: opts?.workspaceId ?? workspaceId,
      keyword: opts?.keyword ?? keyword,
    }
    setLoading(true)
    const data = await fetch(next)
    setList(data?.rows || [])
    setTotal(data?.total || 0)
    setPage(next.page)
    setLoading(false)
  }

  // 汇总派生：常用标签 / 统计 / 最近编辑
  const tagCounts = useMemo(() => {
    const map = new Map<string, number>()
    sample.forEach((note) => (note.keywords || []).forEach((k: string) => map.set(k, (map.get(k) || 0) + 1)))
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k]) => k)
  }, [sample])

  const monthStart = useMemo(() => {
    const d = new Date()
    d.setDate(1)
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  const stats = useMemo(
    () => ({
      total: loaderData.total || sample.length,
      monthNew: sample.filter((note) => new Date(note.createdAt) >= monthStart).length,
      projects: new Set(sample.filter((note) => note.workspaceId).map((note) => note.workspaceId)).size,
      recentWeek: sample.filter((note) => new Date(note.updatedAt).getTime() > Date.now() - 7 * 86400_000).length,
    }),
    [sample, loaderData.total, monthStart]
  )

  const recentNotes = useMemo(
    () =>
      [...sample]
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, 2),
    [sample]
  )

  // 左栏（原型 08）：竖排模块导航 + 筛选 + 所属项目，经插槽注入外壳
  const navNode = useMemo(
    () => (
      <>
        <div className="divider" />
        <div className="group-title">筛选</div>
        <nav className="setnav">
          <button
            type="button"
            className={`setnav__item ${filterKey === 'all' && workspaceId === undefined ? 'is-active' : ''}`}
            onClick={() => {
              setFilterKey('all')
              setWorkspaceId(undefined)
              setPage(1)
              load({ page: 1, filterKey: 'all', workspaceId: undefined })
            }}>
            全部笔记
            <span className="t-xs t-placeholder ml-auto">{stats.total}</span>
          </button>
          <button
            type="button"
            className={`setnav__item ${filterKey === 'recent' && workspaceId === undefined ? 'is-active' : ''}`}
            onClick={() => {
              setFilterKey('recent')
              setWorkspaceId(undefined)
              setPage(1)
              load({ page: 1, filterKey: 'recent', workspaceId: undefined })
            }}>
            最近编辑
            <span className="t-xs t-placeholder ml-auto">{stats.recentWeek}</span>
          </button>
        </nav>
        <div className="group-title">所属项目</div>
        <nav className="modnav">
          {workspaces.map((ws) => (
            <button
              key={ws.id}
              type="button"
              className={`modnav__item ${workspaceId === ws.id ? 'is-active' : ''}`}
              onClick={() => {
                setWorkspaceId(workspaceId === ws.id ? undefined : ws.id)
                setPage(1)
                load({ page: 1, workspaceId: workspaceId === ws.id ? undefined : ws.id })
              }}>
              {ws.title}
            </button>
          ))}
        </nav>
      </>
    ),
    [filterKey, workspaceId, workspaces, stats.total, stats.recentWeek]
  )

  useEffect(() => {
    setNav({ node: navNode })
    return () => setNav(null)
  }, [navNode])

  // 常用标签点击筛选：复用关键词搜索（后端 title/description/keywords LIKE）
  const handleTagSearch = (kw: string) => {
    setKeyword(kw)
    load({ page: 1, keyword: kw })
  }

  const workspaceTitle = (id?: number) => workspaces.find((ws) => ws.id === id)?.title

  // 新建笔记：进编辑器新建态，用户保存时才落库（服务端不允许空 content 预建空行）
  const handleCreate = () => navigate('/note/edit')

  return (
    <div className="flex h-full w-full min-w-0">
      <div className="col-mid h-full bg-canvas">
        {/* 页头（原型 08 mid-head） */}
        <header className="mid-head">
          <div className="page-head__text">
            <span className="mid-head__title">笔记库</span>
            <span className="mid-head__sub">项目推进中沉淀的结论与资料</span>
          </div>
          <div className="mid-head__right">
            <div className="w-50">
              <ProjectSearch
                keyword={keyword}
                onChange={(value) => {
                  setKeyword(value)
                  load({ page: 1, keyword: value })
                }}
              />
            </div>
            <button
              type="button"
              className="btn btn--primary btn--sm"
              onClick={handleCreate}>
              <PlusOutlined />
              新建笔记
            </button>
          </div>
        </header>

        {/* 笔记列表（原型 08 note-item） */}
        <div className="mid-body overflow-y-auto">
          {loading ? (
            [1, 2].map((key) => (
              <div
                key={key}
                className="skeleton-card"
                style={{ height: 92 }}>
                <div
                  className="skeleton"
                  style={{ width: '38%' }}
                />
                <div className="skeleton" />
                <div
                  className="skeleton"
                  style={{ width: '55%' }}
                />
              </div>
            ))
          ) : list.length ? (
            list.map((note) => (
              <article
                key={note.id}
                className="note-item">
                <button
                  type="button"
                  className="note-item__main"
                  onClick={() => navigate(`/note/edit/${note.id}`)}>
                  <span className="note-item__title">{note.title || '未命名笔记'}</span>
                  <span className="note-item__excerpt">{note.description || note.content?.slice(0, 80) || '（暂无摘要）'}</span>
                </button>
                <div className="note-item__meta">
                  {(note.keywords || []).slice(0, 4).map((kw: string) => (
                    <button
                      type="button"
                      key={kw}
                      className="tag tag-btn"
                      onClick={(e) => {
                        handleTagSearch(kw)
                      }}>
                      {kw}
                    </button>
                  ))}
                  <span className="ml-auto">
                    {formatRelative(note.updatedAt)}
                    {note.workspaceTitle || workspaceTitle(note.workspaceId) ? ` · ${note.workspaceTitle || workspaceTitle(note.workspaceId)}` : ''}
                  </span>
                </div>
              </article>
            ))
          ) : (
            <EmptyState
              title={keyword ? `没有匹配「${keyword}」的笔记` : '还没有笔记'}
              description={keyword ? '换个关键词或清除搜索看看' : '在推进页把关键结论存为笔记，或点右上角新建一条'}
            />
          )}
          {total > PAGE_SIZE ? (
            <div className="flex justify-end pt-1">
              <Pagination
                size="small"
                current={page}
                pageSize={PAGE_SIZE}
                total={total}
                onChange={(nextPage) => load({ page: nextPage })}
              />
            </div>
          ) : null}
        </div>
      </div>

      {/* 右栏（原型 08 col-right--sm：标签与统计 + 最近编辑） */}
      <aside className="col-right col-right--sm">
        <span className="t-h3">标签与统计</span>
        <div className="side-card side-card--plain">
          <span className="side-card__title">常用标签</span>
          <div className="flex flex-wrap gap-1.5">
            {tagCounts.length ? (
              tagCounts.map((tag) => (
                <button
                  type="button"
                  key={tag}
                  className="tag tag-btn"
                  onClick={() => handleTagSearch(tag)}>
                  {tag}
                </button>
              ))
            ) : (
              <span className="t-xs t-placeholder">暂无标签</span>
            )}
          </div>
        </div>
        <div className="side-card side-card--plain">
          <span className="side-card__title">统计</span>
          <div className="flex gap-3 text-center">
            <div className="flex-1">
              <div className="t-h2 t-primary">{stats.total}</div>
              <div className="t-xs t-muted">全部笔记</div>
            </div>
            <div className="flex-1">
              <div className="t-h2 t-success">{stats.monthNew}</div>
              <div className="t-xs t-muted">本月新增</div>
            </div>
            <div className="flex-1">
              <div className="t-h2">{stats.projects}</div>
              <div className="t-xs t-muted">关联项目</div>
            </div>
          </div>
        </div>
        <div className="side-card side-card--plain">
          <span className="side-card__title">最近编辑</span>
          {recentNotes.length ? (
            recentNotes.map((note, index) => (
              <button
                type="button"
                key={note.id}
                className={`session-item ${index === 0 ? 'session-item--active' : ''}`}
                onClick={() => navigate(`/note/edit/${note.id}`)}>
                <span className="session-item__title">{note.title || '未命名笔记'}</span>
                <span className="session-item__meta">{formatRelative(note.updatedAt)}</span>
              </button>
            ))
          ) : (
            <span className="t-xs t-placeholder">暂无记录</span>
          )}
        </div>
      </aside>
    </div>
  )
}
