import { useEffect, useMemo, useState } from 'react'
import { App, Drawer, Form, Input } from 'antd'
import { list as listRoles, create as createRole, update as updateRole, remove as removeRole, getMenus, assignMenus } from '@/api/role'
import { tree as menuTree } from '@/api/menu'
import { AuthButton, usePermission } from '@/components/permission'
import { Pill } from '@/components/ui'

interface RoleRow { id: number; name: string; code: string; description: string; isSystem: number }
interface MenuNode { id: number; name: string; permission: string | null; type: string; children?: MenuNode[] }

// 页面级权限声明：AdminGuard 通过 useMatches 读取（见开发文档 B2）
export const handle = { permission: 'role:list' }

const collectIds = (nodes: MenuNode[], set = new Set<number>()): Set<number> => {
  nodes.forEach((n) => {
    set.add(n.id)
    n.children?.length && collectIds(n.children, set)
  })
  return set
}

const collectParentIds = (nodes: MenuNode[], set = new Set<number>()): Set<number> => {
  nodes.forEach((n) => {
    if (n.children?.length) {
      set.add(n.id)
      collectParentIds(n.children, set)
    }
  })
  return set
}

interface FlatRow {
  node: MenuNode
  depth: number
}

const flattenMenus = (nodes: MenuNode[], depth = 0, out: FlatRow[] = []): FlatRow[] => {
  nodes.forEach((n) => {
    out.push({ node: n, depth })
    n.children?.length && flattenMenus(n.children, depth + 1, out)
  })
  return out
}

// 原型 13：角色卡片 + 权限矩阵面板（菜单/按钮树勾选）；系统内置角色只读锁定
export default function Page() {
  const { message } = App.useApp()
  const { isSuperAdmin } = usePermission()
  const [list, setList] = useState<RoleRow[]>([])
  const [editOpen, setEditOpen] = useState(false)
  const [current, setCurrent] = useState<RoleRow | null>(null)
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)

  // 权限面板状态：选中角色 + 菜单树 + 勾选集合（叶子与全选父节点）
  const [permRole, setPermRole] = useState<RoleRow | null>(null)
  const [menuData, setMenuData] = useState<MenuNode[]>([])
  const [checkedIds, setCheckedIds] = useState<Set<number>>(new Set())

  const fetchList = async () => {
    setLoading(true)
    const [err, res] = await listRoles()
    if (res) setList(res.data)
    setLoading(false)
  }

  useEffect(() => {
    fetchList()
  }, [])

  const openCreate = () => {
    setCurrent(null)
    form.resetFields()
    setEditOpen(true)
  }

  const openEdit = (record: RoleRow) => {
    setCurrent(record)
    form.setFieldsValue({ name: record.name, description: record.description })
    setEditOpen(true)
  }

  const submitEdit = async () => {
    const values = await form.validateFields()
    const [err, res] = current ? await updateRole(current.id, values) : await createRole(values)
    if (res) {
      message.success('操作成功')
      setEditOpen(false)
      fetchList()
    }
  }

  const flatRows = useMemo(() => flattenMenus(menuData), [menuData])
  const allCount = useMemo(() => flatRows.length, [flatRows])
  const checkedCount = useMemo(
    () => flatRows.filter((row) => isRowChecked(row.node, checkedIds)).length,
    [flatRows, checkedIds]
  )

  // 打开某角色的权限面板：加载菜单树 + 该角色已选（父节点 id 由勾选推导回显，不入库集合）
  const openPerm = async (record: RoleRow) => {
    setPermRole(record)
    const [err1, res1] = await menuTree()
    if (res1) setMenuData(res1.data)
    const [err2, res2] = await getMenus(record.id)
    if (res2) {
      const parentIds = collectParentIds(res1?.data ?? [])
      setCheckedIds(new Set((res2.data as number[]).filter((id) => !parentIds.has(id))))
    }
  }

  // 行勾选态：叶子看集合；父节点 = 全部子孙勾选
  function isRowChecked(node: MenuNode, set: Set<number>) {
    if (node.children?.length) {
      return collectIds(node.children).size > 0 && [...collectIds(node.children)].every((id) => set.has(id))
    }
    return set.has(node.id)
  }

  // 级联勾选：父 → 全部子孙；叶子 → 自身（父节点回显态由推导得出，提交时合并）
  const toggleRow = (node: MenuNode, checked: boolean) => {
    setCheckedIds((prev) => {
      const next = new Set(prev)
      const ids = collectIds([node])
      if (checked) {
        ids.forEach((id) => next.add(id))
      } else {
        ids.forEach((id) => next.delete(id))
      }
      return next
    })
  }

  const submitPerm = async () => {
    if (!permRole) return
    // 提交 = 勾选叶子 + 推导为全选的父节点（目录需入库才能在菜单树挂载）
    const submitIds = flatRows.filter((row) => isRowChecked(row.node, checkedIds)).map((row) => row.node.id)
    const [err, res] = await assignMenus(permRole.id, submitIds)
    if (res) {
      message.success('权限已更新')
    }
  }

  const handleDelete = async (record: RoleRow) => {
    const [err, res] = await removeRole(record.id)
    if (res) {
      message.success('删除成功')
      fetchList()
      if (permRole?.id === record.id) setPermRole(null)
    }
  }

  return (
    <div className="h-full overflow-y-auto bg-canvas">
      <main className="main">
        <div className="page-head">
          <div className="page-head__text">
            <span className="t-title">角色管理</span>
            <span className="t-body t-muted">定义角色并分配菜单 / 按钮级权限</span>
          </div>
          <AuthButton permission="role:create">
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
              新增角色
            </button>
          </AuthButton>
        </div>

        {/* 角色卡片（原型 13：256px 卡组；系统内置锁标） */}
        {loading ? (
          <div className="flex gap-4">
            {[1, 2, 3].map((key) => (
              <div
                key={key}
                className="skeleton-card"
                style={{ width: 256, height: 148 }}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-wrap gap-4">
            {list.map((record) => {
              const selected = permRole?.id === record.id
              return (
                <div
                  key={record.id}
                  className={`role-card flex flex-col gap-2 ${selected ? 'role-card--active' : ''}`}
                  onClick={() => openPerm(record)}>
                  <div className="row-between">
                    <span className="t-h3">{record.name}</span>
                    {record.isSystem === 1 ? (
                      <span className="badge-lock">
                        <svg
                          width="10"
                          height="10"
                          viewBox="0 0 14 14"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.4">
                          <rect
                            x="3"
                            y="6"
                            width="8"
                            height="6"
                            rx="1.5"
                          />
                          <path d="M4.6 6V4.6a2.4 2.4 0 0 1 4.8 0V6" />
                        </svg>
                        系统内置 · 只读
                      </span>
                    ) : (
                      <span
                        className="badge-lock"
                        style={{ borderStyle: 'dashed' }}>
                        自定义
                      </span>
                    )}
                  </div>
                  <span className="t-sm t-muted">{record.description || '—'}</span>
                  <div className="mt-auto flex items-center justify-between">
                    <span className="t-sm t-placeholder">{record.code}</span>
                    {selected ? (
                      <Pill
                        tone="info"
                        size="sm">
                        配置中
                      </Pill>
                    ) : (
                      <span className="t-xs t-primary">点击配置权限</span>
                    )}
                  </div>
                  <div
                    className="flex gap-3"
                    onClick={(e) => e.stopPropagation()}>
                    <AuthButton permission="role:update">
                      <span
                        className={`cell-link ${record.isSystem === 1 ? 't-placeholder' : ''}`}
                        onClick={() => record.isSystem !== 1 && openEdit(record)}>
                        编辑
                      </span>
                    </AuthButton>
                    <AuthButton permission="role:delete">
                      <span
                        className={`cell-danger ${record.isSystem === 1 ? 't-placeholder' : ''}`}
                        onClick={() => record.isSystem !== 1 && handleDelete(record)}>
                        删除
                      </span>
                    </AuthButton>
                  </div>
                </div>
              )
            })}

            {/* 网格内新建入口（原型 13 虚线卡） */}
            <AuthButton permission="role:create">
              <div
                className="role-card role-card--create"
                onClick={openCreate}>
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 18 18"
                  fill="none"
                  stroke="#2266d1"
                  strokeWidth="1.6"
                  strokeLinecap="round">
                  <path d="M9 2v14M2 9h14" />
                </svg>
                <span className="t-body t-primary w-medium">新建自定义角色</span>
              </div>
            </AuthButton>
          </div>
        )}

        {/* 权限配置面板（原型 13 perm-panel：树行 + 勾选框 + 权限码） */}
        {permRole ? (
          <div className="perm-panel">
            <div className="perm-panel__head">
              <div className="flex items-center gap-2">
                <span className="t-h3">{permRole.name} · 权限配置</span>
                {permRole.isSystem === 1 ? (
                  <span className="badge-lock">
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 14 14"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.4">
                      <rect
                        x="3"
                        y="6"
                        width="8"
                        height="6"
                        rx="1.5"
                      />
                      <path d="M4.6 6V4.6a2.4 2.4 0 0 1 4.8 0V6" />
                    </svg>
                    系统内置 · {isSuperAdmin ? '仅超级管理员可改' : '只读'}
                  </span>
                ) : null}
                <span className="t-sm t-muted">
                  已选 {checkedCount}/{allCount} 项
                </span>
              </div>
              <AuthButton permission="role:assign_permission">
                <button
                  type="button"
                  className="btn btn--primary btn--sm"
                  disabled={permRole.isSystem === 1 && !isSuperAdmin}
                  onClick={submitPerm}>
                  保存权限
                </button>
              </AuthButton>
            </div>
            <div className="perm-panel__body">
              {flatRows.map(({ node, depth }) => {
                const checked = isRowChecked(node, checkedIds)
                const isButton = node.type === 'button'
                const isChild = depth > 0
                return (
                  <div
                    key={node.id}
                    className={`tree-row ${isChild ? (isButton ? 'tree-row--btn' : 'tree-row--child') : ''} ${permRole.isSystem === 1 && !isSuperAdmin ? 'tree-row--disabled' : ''}`}
                    onClick={() => !(permRole.isSystem === 1 && !isSuperAdmin) && toggleRow(node, !checked)}>
                    <span className={`tree-check ${checked ? 'tree-check--on' : 'tree-check--off'}`}></span>
                    <span className={isButton ? 't-sm' : ''}>{node.name}</span>
                    {node.permission ? <span className="perm-code">{node.permission}</span> : null}
                  </div>
                )
              })}
            </div>
          </div>
        ) : null}
      </main>

      <Drawer
        title={current ? `编辑角色 · ${current.name}` : '新增角色'}
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
            name="name"
            label="名称"
            rules={[{ required: true, message: '请输入名称' }]}>
            <Input />
          </Form.Item>
          {!current && (
            <Form.Item
              name="code"
              label="标识"
              rules={[{ required: true, pattern: /^[a-z][a-z0-9_]{1,63}$/, message: '小写字母开头，仅小写字母/数字/下划线' }]}
              extra="创建后不可修改">
              <Input />
            </Form.Item>
          )}
          <Form.Item
            name="description"
            label="描述">
            <Input.TextArea
              rows={3}
              maxLength={255}
            />
          </Form.Item>
          <button
            type="button"
            className="btn btn--primary"
            onClick={submitEdit}>
            提交
          </button>
        </Form>
      </Drawer>
    </div>
  )
}
