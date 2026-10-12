import { useEffect, useMemo, useState } from 'react'
import { App, Drawer, Form, Input, InputNumber, Popconfirm, Select, Switch, TreeSelect } from 'antd'
import { tree as menuTree, create as createMenu, update as updateMenu, remove as removeMenu } from '@/api/menu'
import { AuthButton } from '@/components/permission'

interface MenuRow {
  id: number
  parentId: number | null
  name: string
  code: string
  permission: string | null
  path: string | null
  icon: string | null
  sortOrder: number
  type: 'directory' | 'menu' | 'button'
  visible: number
  children?: MenuRow[]
}

const TYPE_LABEL: Record<string, string> = { directory: '目录', menu: '菜单', button: '按钮' }

// 页面级权限声明：AdminGuard 通过 useMatches 读取（见开发文档 B2）
export const handle = { permission: 'menu:list' }

interface FlatMenuRow {
  row: MenuRow
  depth: number
}

// 树 → 扁平行（带深度与父引用，渲染缩进与折叠）
const flattenTree = (nodes: MenuRow[], depth = 0, parentIds: number[] = [], out: FlatMenuRow[] = []): FlatMenuRow[] => {
  nodes.forEach((n) => {
    out.push({ row: n, depth })
    n.children?.length && flattenTree(n.children, depth + 1, [...parentIds, n.id], out)
  })
  return out
}

const collectIds = (nodes: MenuRow[], set = new Set<number>()): Set<number> => {
  nodes.forEach((n) => {
    set.add(n.id)
    n.children?.length && collectIds(n.children, set)
  })
  return set
}

// 原型 14：树形表格（目录/菜单/按钮 + 权限码 + 标识 + 可见态）
export default function Page() {
  const { message } = App.useApp()
  const [list, setList] = useState<MenuRow[]>([])
  const [editOpen, setEditOpen] = useState(false)
  const [current, setCurrent] = useState<MenuRow | null>(null)
  const [form] = Form.useForm()
  const [keyword, setKeyword] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(false)

  const fetchList = async () => {
    setLoading(true)
    const [err, res] = await menuTree()
    if (res) setList(res.data)
    setLoading(false)
  }

  useEffect(() => {
    fetchList()
  }, [])

  const allFlat = useMemo(() => flattenTree(list), [list])

  // 折叠：隐藏被折叠节点的全部子孙
  const hiddenByCollapse = useMemo(() => {
    const hidden = new Set<number>()
    allFlat.forEach(({ row }) => {
      if (collapsed.has(row.id) && row.children?.length) {
        collectIds(row.children).forEach((id) => hidden.add(id))
      }
    })
    return hidden
  }, [allFlat, collapsed])

  // 筛选：关键词（名称/标识/权限码）或类型；命中节点的祖先保留
  const visibleRows = useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    const match = (row: MenuRow) => {
      const byKw =
        !kw || row.name.toLowerCase().includes(kw) || row.code.toLowerCase().includes(kw) || (row.permission || '').toLowerCase().includes(kw)
      const byType = typeFilter === 'all' || row.type === typeFilter
      return byKw && byType
    }
    // 先标记命中，再把命中节点的祖先链并入
    const keep = new Set<number>()
    const parentOf = new Map<number, number>()
    const walk = (nodes: MenuRow[], parentId: number | null) => {
      nodes.forEach((n) => {
        if (parentId != null) parentOf.set(n.id, parentId)
        if (match(n)) {
          keep.add(n.id)
          let p = parentOf.get(n.id)
          while (p != null) {
            keep.add(p)
            p = parentOf.get(p)
          }
        }
        n.children?.length && walk(n.children, n.id)
      })
    }
    walk(list, null)
    return allFlat.filter(({ row }) => keep.size === 0 || keep.has(row.id) ? !hiddenByCollapse.has(row.id) : false)
  }, [allFlat, list, keyword, typeFilter, hiddenByCollapse])

  // 父节点选择数据：排除 button 与自身（防自引用）
  const toParentOptions = (menus: MenuRow[]): any[] =>
    menus
      .filter((m) => m.type !== 'button' && m.id !== current?.id)
      .map((m) => ({
        value: m.id,
        title: m.name,
        children: m.children?.length ? toParentOptions(m.children) : undefined,
      }))

  const openCreate = () => {
    setCurrent(null)
    form.resetFields()
    form.setFieldsValue({ type: 'menu', visible: true, sortOrder: 0 })
    setEditOpen(true)
  }

  const openEdit = (record: MenuRow) => {
    setCurrent(record)
    form.setFieldsValue({ ...record, parentId: record.parentId ?? undefined, visible: record.visible === 1 })
    setEditOpen(true)
  }

  const submit = async () => {
    const values = await form.validateFields()
    const payload = { ...values, visible: values.visible ? 1 : 0, parentId: values.parentId ?? null }
    const [err, res] = current ? await updateMenu(current.id, payload) : await createMenu(payload)
    if (res) {
      message.success('操作成功')
      setEditOpen(false)
      fetchList()
    }
  }

  const handleDelete = async (record: MenuRow) => {
    const [err, res] = await removeMenu(record.id)
    if (res) {
      message.success('删除成功')
      fetchList()
    }
  }

  const allExpanded = collapsed.size === 0

  return (
    <div className="h-full overflow-y-auto bg-canvas">
      <main className="main">
        <div className="page-head">
          <div className="page-head__text">
            <span className="t-title">菜单管理</span>
            <span className="t-body t-muted">维护导航结构、权限码与可见性——各角色看到的左侧导航即由此驱动</span>
          </div>
          <AuthButton permission="menu:create">
            <button
              type="button"
              className="btn btn--primary"
              onClick={openCreate}>
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
              新增菜单
            </button>
          </AuthButton>
        </div>

        {/* 筛选行 + 展开全部 */}
        <div className="filters items-center">
          <label
            className="search"
            style={{ width: 240, height: 34, background: 'var(--surface)' }}>
            <svg
              width="13"
              height="13"
              viewBox="0 0 14 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4">
              <circle
                cx="6"
                cy="6"
                r="4.2"
              />
              <path
                d="M9.2 9.2 12.5 12.5"
                strokeLinecap="round"
              />
            </svg>
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="搜索菜单名称、标识或权限码"
              className="min-w-0 flex-1 border-0 bg-transparent text-xs text-ink outline-none placeholder:text-placeholder"
            />
          </label>
          <Select
            value={typeFilter}
            onChange={setTypeFilter}
            style={{ width: 110, height: 34 }}
            options={[
              { value: 'all', label: '全部类型' },
              { value: 'directory', label: '目录' },
              { value: 'menu', label: '菜单' },
              { value: 'button', label: '按钮' },
            ]}
          />
          <span
            className="t-primary w-medium ml-auto cursor-pointer"
            onClick={() => setCollapsed(allExpanded ? new Set(allFlat.filter(({ row }) => row.children?.length).map(({ row }) => row.id)) : new Set())}>
            {allExpanded ? '收起全部' : '展开全部'}
          </span>
        </div>

        {/* 树形表格（原型 14 compact 44px 行） */}
        <div className="table">
          <div
            className="table__head"
            style={{ height: 40 }}>
            <span style={{ width: 290 }}>菜单名称</span>
            <span style={{ width: 70 }}>类型</span>
            <span style={{ width: 170 }}>权限码</span>
            <span style={{ width: 130 }}>标识</span>
            <span className="cell-grow">路由路径</span>
            <span style={{ width: 70 }}>可见</span>
            <span style={{ width: 110 }}>操作</span>
          </div>
          {loading ? (
            [1, 2, 3, 4].map((key) => (
              <div
                className="table__row table__row--compact"
                key={key}>
                <div
                  className="skeleton"
                  style={{ width: 140 }}
                />
                <div
                  className="skeleton"
                  style={{ width: 50 }}
                />
                <div
                  className="skeleton"
                  style={{ width: 90 }}
                />
                <div
                  className="skeleton"
                  style={{ width: 70 }}
                />
                <div className="skeleton cell-grow" />
                <div
                  className="skeleton"
                  style={{ width: 40 }}
                />
                <div
                  className="skeleton"
                  style={{ width: 70 }}
                />
              </div>
            ))
          ) : visibleRows.length ? (
            visibleRows.map(({ row, depth }) => {
              const hasChildren = !!row.children?.length
              const isCollapsed = collapsed.has(row.id)
              return (
                <div
                  className="table__row table__row--compact"
                  key={row.id}>
                  <span
                    className="flex items-center gap-1"
                    style={{ width: 290, paddingLeft: depth * 22 }}>
                    {hasChildren ? (
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 14 14"
                        fill="none"
                        stroke="var(--placeholder)"
                        strokeWidth="1.4"
                        strokeLinecap="round"
                        className={`mr-1 cursor-pointer transition-transform ${isCollapsed ? '' : 'rotate-90'}`}
                        onClick={() =>
                          setCollapsed((prev) => {
                            const next = new Set(prev)
                            next.has(row.id) ? next.delete(row.id) : next.add(row.id)
                            return next
                          })
                        }>
                        <path d="M5 3.5 9 7l-4 3.5" />
                      </svg>
                    ) : (
                      <span className="w-3" />
                    )}
                    <span className={depth === 0 ? 'w-semi' : depth === 1 ? '' : 't-muted'}>{row.name}</span>
                  </span>
                  <span
                    className="t-muted"
                    style={{ width: 70 }}>
                    {TYPE_LABEL[row.type] ?? row.type}
                  </span>
                  <span style={{ width: 170 }}>{row.permission || '—'}</span>
                  <span style={{ width: 130 }}>
                    <span className="perm-code">{row.code}</span>
                  </span>
                  <span className="cell-grow t-muted">{row.path || '—'}</span>
                  <span
                    className={`w-medium ${row.visible === 1 ? 't-success' : 't-placeholder'}`}
                    style={{ width: 70 }}>
                    {row.visible === 1 ? '显示' : '隐藏'}
                  </span>
                  <span
                    className="flex gap-2.5"
                    style={{ width: 110 }}>
                    <AuthButton permission="menu:update">
                      <span
                        className="cell-link"
                        onClick={() => openEdit(row)}>
                        编辑
                      </span>
                    </AuthButton>
                    <AuthButton permission="menu:delete">
                      <Popconfirm
                        title="确定删除该菜单？"
                        okText="删除"
                        cancelText="取消"
                        disabled={!!row.children?.length}
                        onConfirm={() => handleDelete(row)}>
                        <span className={`cell-link ${row.children?.length ? 't-placeholder' : 't-muted'}`}>删除</span>
                      </Popconfirm>
                    </AuthButton>
                  </span>
                </div>
              )
            })
          ) : (
            <div className="table__row table__row--compact t-muted">没有匹配的菜单项</div>
          )}
        </div>
      </main>

      <Drawer
        title={current ? `编辑菜单 · ${current.name}` : '新增菜单'}
        width={480}
        open={editOpen}
        onClose={() => setEditOpen(false)}>
        <Form
          form={form}
          className="aura-form flex flex-col gap-3"
          requiredMark={false}
          colon={false}
          layout="vertical">
          <Form.Item
            name="parentId"
            label="上级菜单">
            <TreeSelect
              treeData={toParentOptions(list)}
              allowClear
              treeDefaultExpandAll
            />
          </Form.Item>
          <Form.Item
            name="name"
            label="名称"
            rules={[{ required: true, message: '请输入名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item
            name="code"
            label="标识"
            rules={[{ required: true, pattern: /^[a-z][a-z0-9_]{1,63}$/, message: '小写字母开头，仅小写字母/数字/下划线' }]}>
            <Input />
          </Form.Item>
          <Form.Item
            name="permission"
            label="权限码"
            extra="如 user:create；目录类型留空"
            rules={[{ pattern: /^[a-z][a-z0-9_]*(?::[a-z][a-z0-9_]*)+$/, message: '冒号分隔，如 user:create' }]}>
            <Input />
          </Form.Item>
          <Form.Item
            name="path"
            label="前端路由"
            extra="仅菜单类型需要，如 /admin/users">
            <Input />
          </Form.Item>
          <Form.Item
            name="icon"
            label="图标标识"
            extra="对应前端 ICON_MAP 的键名，可留空">
            <Input />
          </Form.Item>
          <Form.Item
            name="type"
            label="类型"
            rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'directory', label: '目录' },
                { value: 'menu', label: '菜单' },
                { value: 'button', label: '按钮' },
              ]}
            />
          </Form.Item>
          <Form.Item
            name="sortOrder"
            label="排序"
            extra="数值越小越靠前">
            <InputNumber min={0} />
          </Form.Item>
          <Form.Item
            name="visible"
            label="是否可见"
            valuePropName="checked">
            <Switch />
          </Form.Item>
          <button
            type="button"
            className="btn btn--primary"
            onClick={submit}>
            提交
          </button>
        </Form>
      </Drawer>
    </div>
  )
}
