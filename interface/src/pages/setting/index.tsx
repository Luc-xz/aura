import { App, Button, Form, Input, Select } from 'antd'
import { useEffect, useState } from 'react'
import { update } from '@/api/user'
import { getModelConfigList } from '@/api/setting'
import { getUserSettings, updateUserSettings } from '@/api/user-settings'
import type { UserSettings } from '@/api/user-settings'
import { useUserStore } from '@/store'
import { getPreferences, setPreferences } from '@/utils/preferences'
import { SwitchCtl } from '@/components/ui'
import { UserIcon } from '@/components/shell/icons'

export async function clientLoader() {
  const [modelErr, modelRes] = await getModelConfigList({})
  const [settingsErr, settingsRes] = await getUserSettings()
  return {
    modelList: modelRes?.data || [],
    settings: settingsRes?.data || null,
  }
}

// 偏好行：标题 + 说明 + 右侧控件，行间细分隔线（原型 10 spec-card）
function PrefRow({ title, desc, extra, children }: { title: string; desc?: React.ReactNode; extra?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div
      className="row-between"
      style={{ padding: '4px 0' }}>
      <div className="flex flex-col gap-0.5">
        <span className="t-body">{title}</span>
        {desc ? <span className="t-sm t-muted">{desc}</span> : null}
      </div>
      {extra}
      {children}
    </div>
  )
}

const Hairline = () => <div style={{ height: 1, background: 'var(--line)' }} />

export default function Page({ loaderData }) {
  const { message } = App.useApp()
  const user = useUserStore((state) => state.user)
  const setUser = useUserStore((state) => state.setUser)

  const [accountForm] = Form.useForm()
  const [editingAccount, setEditingAccount] = useState(false)
  const [accountSaving, setAccountSaving] = useState(false)
  const [defaultModelId, setDefaultModelId] = useState<number | null | undefined>(undefined)
  const [prefs, setPrefs] = useState(getPreferences())

  // 服务端默认模型回填（无存量行时 defaultModelId 为 null → 清空选择）
  useEffect(() => {
    setDefaultModelId(loaderData.settings?.defaultModelId ?? undefined)
  }, [loaderData.settings])

  const openAccountEdit = () => {
    accountForm.setFieldsValue({ name: user?.name, email: user?.email })
    setEditingAccount(true)
  }

  const handleAccountSave = async (values) => {
    setAccountSaving(true)
    const [err, res] = await update(user!.id, values)
    setAccountSaving(false)
    if (res) {
      message.success('账户信息已更新')
      setUser({ ...user!, ...values })
      setEditingAccount(false)
    }
  }

  const handleDefaultModel = async (value?: number) => {
    const next = value ?? null
    const [err, res] = await updateUserSettings({ defaultModelId: next })
    if (res) {
      setDefaultModelId(value)
      message.success('默认模型已保存')
    }
  }

  const handlePrefChange = (key: 'stream' | 'compact', value: boolean) => {
    const next = setPreferences({ [key]: value })
    setPrefs(next)
    message.success(key === 'stream' ? (value ? '已开启流式输出' : '已关闭流式输出') : value ? '已开启紧凑模式' : '已关闭紧凑模式')
  }

  return (
    <div className="h-full overflow-y-auto bg-canvas">
      <main className="main">
        <div className="page-head">
          <div className="page-head__text">
            <span className="t-title">设置</span>
            <span className="t-body t-muted">管理账户信息与工作台偏好</span>
          </div>
        </div>

        {/* 账户信息（原型 10：头像行 + 修改资料） */}
        <div className="spec-card">
          <span className="spec-card__title">账户信息</span>
          <div className="row-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-white">
                <UserIcon size={20} />
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="t-body w-semi">{user?.name}</span>
                <span className="t-sm t-muted">{user?.email}</span>
              </div>
            </div>
            {!editingAccount ? (
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={openAccountEdit}>
                修改资料
              </button>
            ) : null}
          </div>
          {editingAccount ? (
            <Form
              form={accountForm}
              className="aura-form flex flex-col gap-3"
              onFinish={handleAccountSave}>
              <Form.Item
                name="name"
                label="用户名"
                rules={[
                  { required: true, message: '请输入用户名' },
                  { pattern: /^[a-zA-Z0-9_-]{4,16}$/, message: '用户名只能包含字母、数字、下划线和减号，且长度在4-16之间' },
                ]}>
                <Input
                  maxLength={16}
                  style={{ maxWidth: 320 }}
                />
              </Form.Item>
              <Form.Item
                name="email"
                label="邮箱"
                rules={[
                  { required: true, message: '请输入邮箱' },
                  { type: 'email', message: '请输入正确的邮箱' },
                ]}>
                <Input
                  maxLength={255}
                  style={{ maxWidth: 320 }}
                />
              </Form.Item>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="btn btn--primary btn--sm"
                  disabled={accountSaving}>
                  保存
                </button>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={() => setEditingAccount(false)}>
                  取消
                </button>
              </div>
            </Form>
          ) : null}
        </div>

        {/* 偏好设置（原型 10 spec-card 行组） */}
        <div className="spec-card">
          <span className="spec-card__title">偏好设置</span>

          <PrefRow
            title="流式输出"
            desc="开启后回答将逐字输出；关闭则等待完整回复">
            <SwitchCtl
              checked={prefs.stream}
              onChange={(value) => handlePrefChange('stream', value)}
            />
          </PrefRow>

          <Hairline />

          <PrefRow
            title="新会话默认模型"
            desc={
              <span className="flex items-center gap-1.5">
                新建项目未指定模型时使用
                <span className="t-xs t-placeholder">可在单个项目中临时切换</span>
              </span>
            }>
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="未设置"
              value={defaultModelId}
              options={loaderData.modelList.map((item) => ({ value: item.id, label: item.modelName }))}
              onChange={handleDefaultModel}
              style={{ width: 160 }}
            />
          </PrefRow>

          <Hairline />

          <PrefRow
            title="界面密度 · 紧凑模式"
            desc="紧凑模式会收窄会话气泡间距，一屏展示更多内容">
            <SwitchCtl
              checked={prefs.compact}
              onChange={(value) => handlePrefChange('compact', value)}
            />
          </PrefRow>
        </div>
      </main>
    </div>
  )
}
