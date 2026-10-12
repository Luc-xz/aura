import { useEffect, useState } from 'react'
import { App, Drawer, Form, Input, Popconfirm, Select } from 'antd'
import { findById, page as pageUser, remove as removeUser, update as updateUser, assignRoles } from '@/api/user'
import { list as listRoles } from '@/api/role'
import { AuthButton } from '@/components/permission'

interface UserRow { id: number; name: string; email: string; createdAt: string }
interface RoleRow { id: number; name: string; code: string; isSystem: number }

// 页面级权限声明：AdminGuard 通过 useMatches 读取（见开发文档 B2）
export const handle = { permission: 'user:list' }

// 原型 12：标题 + 筛选 + 表格 + 分页骨架；行操作 编辑（含改密）/ 分配角色 / 删除
export default function Page() {
  const { message } = App.useApp()
  const [list, setList] = useState<UserRow[]>([])
  const [total, setTotal] = useState(0)
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(1)
  const [editOpen, setEditOpen] = useState(false)
  const [assignOpen, setAssignOpen] = useState(false)
  const [current, setCurrent] = useState<UserRow | null>(null)
  const [roles, setRoles] = useState<RoleRow[]>([])
  const [form] = Form.useForm()
  const [roleForm] = Form.useForm()
  const [loading, setLoading] = useState(false)

  const PAGE_SIZE = 10

  const fetchList = async (opts?: { page?: number; keyword?: string }) => {
    const next = { page: opts?.page ?? page, pageSize: PAGE_SIZE, keyword: (opts?.keyword ?? keyword) || undefined }
    setLoading(true)
    const [err, res] = await pageUser(next)
    if (res) {
      setList(res.data.rows)
      setTotal(res.data.total)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchList()
  }, [])

  const openEdit = (record: UserRow) => {
    setCurrent(record)
    form.setFieldsValue({ name: record.name, email: record.email, password: undefined })
    setEditOpen(true)
  }

  const submitEdit = async () => {
    const values = await form.validateFields()
    if (!values.password) delete values.password // 留空不改密码
    const [err, res] = await updateUser(current!.id, values)
    if (res) {
      message.success('更新成功')
      setEditOpen(false)
      fetchList()
    }
  }

  const openAssign = async (record: UserRow) => {
    setCurrent(record)
    if (roles.length === 0) {
      const [err2, res2] = await listRoles()
      if (res2) setRoles(res2.data)
    }
    const [err, res] = await findById(record.id)
    if (res) {
      roleForm.setFieldsValue({ roleIds: res.data.roleIds })
    }
    setAssignOpen(true)
  }

  const submitAssign = async () => {
    const { roleIds } = await roleForm.validateFields()
    const [err, res] = await assignRoles(current!.id, roleIds)
    if (res) {
      message.success('分配成功')
      setAssignOpen(false)
    }
  }

  const handleDelete = async (record: UserRow) => {
    const [err, res] = await removeUser(record.id)
    if (res) {
      message.success('删除成功')
      fetchList()
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="h-full overflow-y-auto bg-canvas">
      <main className="main">
        <div className="page-head">
          <div className="page-head__text">
            <span className="t-title">用户管理</span>
            <span className="t-body t-muted">管理系统成员、所属角色与账号状态</span>
          </div>
        </div>

        {/* 筛选行：搜索（角色/状态筛选无后端支撑，见 D4 登记项） */}
        <div className="filters items-center">
          <label className="search"
            style={{ width: 240, height: 34, background: 'var(--surface)' }}>
            <svg
              width="13"
              height="13"
              viewBox="0 0 14 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4">
              <circle cx="6" cy="6" r="4.2" />
              <path
                d="M9.2 9.2 12.5 12.5"
                strokeLinecap="round"
              />
            </svg>
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setPage(1)
                  fetchList({ page: 1, keyword })
                }
              }}
              placeholder="搜索用户名或邮箱"
              className="min-w-0 flex-1 border-0 bg-transparent text-xs text-ink outline-none placeholder:text-placeholder"
            />
          </label>
        </div>

        {/* 用户表格 */}
        <div className="table">
          <div className="table__head">
            <span style={{ width: 250 }}>用户</span>
            <span className="cell-grow">创建时间</span>
            <span style={{ width: 180 }}>操作</span>
          </div>
          {loading ? (
            [1, 2, 3].map((key) => (
              <div
                className="table__row"
                key={key}>
                <div
                  className="skeleton"
                  style={{ width: 180 }}
                />
                <div
                  className="skeleton cell-grow"
                  style={{ width: 120 }}
                />
                <div
                  className="skeleton"
                  style={{ width: 120 }}
                />
              </div>
            ))
          ) : list.length ? (
            list.map((record) => (
              <div
                className="table__row"
                key={record.id}>
                <div className="cell-user">
                  <div className="cell-avatar">{record.name.charAt(0).toUpperCase()}</div>
                  <div className="flex flex-col">
                    <span className="w-semi">{record.name}</span>
                    <span className="t-xs t-placeholder">{record.email}</span>
                  </div>
                </div>
                <span className="cell-grow t-muted num">{record.createdAt?.slice(0, 16)}</span>
                <span
                  className="flex gap-3"
                  style={{ width: 180 }}>
                  <AuthButton permission="user:update">
                    <span
                      className="cell-link"
                      onClick={() => openEdit(record)}>
                      编辑
                    </span>
                  </AuthButton>
                  <AuthButton permission="user:assign_role">
                    <span
                      className="cell-link t-muted"
                      onClick={() => openAssign(record)}>
                      分配角色
                    </span>
                  </AuthButton>
                  <AuthButton permission="user:delete">
                    <Popconfirm
                      title="确定删除该用户？"
                      okText="删除"
                      cancelText="取消"
                      onConfirm={() => handleDelete(record)}>
                      <span className="cell-danger">删除</span>
                    </Popconfirm>
                  </AuthButton>
                </span>
              </div>
            ))
          ) : (
            <div className="table__row t-muted">{keyword ? `没有匹配「${keyword}」的用户` : '暂无用户'}</div>
          )}
        </div>

        {/* 分页 */}
        {total > PAGE_SIZE ? (
          <div className="pager">
            <span className="num">
              共 {total} 条 · 第 {page}/{totalPages} 页
            </span>
            <div className="pager__pages">
              <span
                className={`pager__btn ${page <= 1 ? 't-placeholder' : 'cursor-pointer'}`}
                onClick={() => {
                  if (page <= 1) return
                  setPage(page - 1)
                  fetchList({ page: page - 1 })
                }}>
                ‹
              </span>
              <span className="pager__btn pager__btn--active">{page}</span>
              <span
                className={`pager__btn ${page >= totalPages ? 't-placeholder' : 'cursor-pointer'}`}
                onClick={() => {
                  if (page >= totalPages) return
                  setPage(page + 1)
                  fetchList({ page: page + 1 })
                }}>
                ›
              </span>
            </div>
          </div>
        ) : null}
      </main>

      <Drawer
        title={`编辑用户 · ${current?.name ?? ''}`}
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
            label="用户名"
            rules={[{ required: true, message: '请输入用户名' }]}>
            <Input />
          </Form.Item>
          <Form.Item
            name="email"
            label="邮箱"
            rules={[{ required: true, type: 'email', message: '请输入正确邮箱' }]}>
            <Input />
          </Form.Item>
          <Form.Item
            name="password"
            label="重置密码"
            extra="至少 8 位，含字母、数字和 -_；留空表示不修改">
            <Input.Password />
          </Form.Item>
          <button
            type="button"
            className="btn btn--primary"
            onClick={submitEdit}>
            提交
          </button>
        </Form>
      </Drawer>

      <Drawer
        title={`分配角色 · ${current?.name ?? ''}`}
        width={480}
        open={assignOpen}
        onClose={() => setAssignOpen(false)}>
        <Form
          form={roleForm}
          className="aura-form flex flex-col gap-3"
          requiredMark={false}
          colon={false}
          layout="vertical">
          <Form.Item
            name="roleIds"
            label="角色（提交后全量替换）"
            rules={[{ required: true, message: '至少选择一个角色' }]}>
            <Select
              mode="multiple"
              optionLabelProp="label">
              {roles.map((r) => (
                <Select.Option
                  key={r.id}
                  value={r.id}
                  label={r.name}>
                  {r.name}（{r.code}）
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <button
            type="button"
            className="btn btn--primary"
            onClick={submitAssign}>
            提交
          </button>
        </Form>
      </Drawer>
    </div>
  )
}
