import { App, Button, Card, Divider, Form, Input, Select, Switch } from 'antd'
import { useEffect, useState } from 'react'
import { update } from '@/api/user'
import { getModelConfigList } from '@/api/setting'
import { getUserSettings, updateUserSettings } from '@/api/user-settings'
import type { UserSettings } from '@/api/user-settings'
import { useUserStore } from '@/store'
import { getPreferences, setPreferences } from '@/utils/preferences'

export async function clientLoader() {
  const [modelErr, modelRes] = await getModelConfigList({})
  const [settingsErr, settingsRes] = await getUserSettings()
  return {
    modelList: modelRes?.data || [],
    settings: settingsRes?.data || null,
  }
}

export default function Page({ loaderData }) {
  const { message } = App.useApp()
  const user = useUserStore((state) => state.user)
  const setUser = useUserStore((state) => state.setUser)

  const [accountForm] = Form.useForm()
  const [modelForm] = Form.useForm()
  const [accountSaving, setAccountSaving] = useState(false)
  const [modelSaving, setModelSaving] = useState(false)
  const [prefs, setPrefs] = useState(getPreferences())

  // 服务端默认模型回填（无存量行时 defaultModelId 为 null → 清空选择）
  useEffect(() => {
    modelForm.setFieldsValue({ defaultModelId: loaderData.settings?.defaultModelId ?? undefined })
  }, [loaderData.settings])

  const handleAccountSave = async (values) => {
    setAccountSaving(true)
    const [err, res] = await update(user!.id, values)
    setAccountSaving(false)
    if (res) {
      message.success('账户信息已更新')
      setUser({ ...user!, ...values })
    }
  }

  const handleModelSave = async (values) => {
    setModelSaving(true)
    const [err, res] = await updateUserSettings({ defaultModelId: values.defaultModelId ?? null })
    setModelSaving(false)
    if (res) {
      message.success('默认模型已保存')
    }
  }

  const handlePrefChange = (key: 'stream' | 'compact', value: boolean) => {
    const next = setPreferences({ [key]: value })
    setPrefs(next)
    message.success(key === 'stream' ? (value ? '已开启流式输出' : '已关闭流式输出') : value ? '已开启紧凑模式' : '已关闭紧凑模式')
  }

  return (
    <div className="h-full overflow-y-auto bg-white">
      <div className="mx-auto max-w-180 p-8 space-y-6">
        <div className="title-pri">账户设置</div>

        {/* 账户信息卡：本人修改（PUT /user/:id） */}
        <Card title="账户信息">
          <Form
            form={accountForm}
            layout="vertical"
            className="max-w-90"
            initialValues={{ name: user?.name, email: user?.email }}
            onFinish={handleAccountSave}>
            <Form.Item
              name="name"
              label="用户名"
              rules={[
                { required: true, message: '请输入用户名' },
                { pattern: /^[a-zA-Z0-9_-]{4,16}$/, message: '用户名只能包含字母、数字、下划线和减号，且长度在4-16之间' },
              ]}>
              <Input maxLength={16} />
            </Form.Item>
            <Form.Item
              name="email"
              label="邮箱"
              rules={[
                { required: true, message: '请输入邮箱' },
                { type: 'email', message: '请输入正确的邮箱' },
              ]}>
              <Input maxLength={255} />
            </Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={accountSaving}
              disabled={accountSaving}>
              保存
            </Button>
          </Form>
        </Card>

        {/* 偏好设置：默认模型接 B3 设置接口；流式/紧凑为本地偏好 */}
        <Card title="偏好设置">
          <Form
            form={modelForm}
            layout="vertical"
            className="max-w-90"
            onFinish={handleModelSave}>
            <Form.Item
              name="defaultModelId"
              label="默认模型"
              tooltip="新建项目未指定模型时使用">
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                placeholder="未设置"
                options={loaderData.modelList.map((item) => ({ value: item.id, label: item.modelName }))}
              />
            </Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={modelSaving}
              disabled={modelSaving}>
              保存
            </Button>
          </Form>
          <Divider className="my-6" />
          <div className="max-w-90 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm">流式输出</div>
                <div className="text-xs text-gray-500">开启后回答将逐字输出；关闭则等待完整回复</div>
              </div>
              <Switch
                checked={prefs.stream}
                onChange={(value) => handlePrefChange('stream', value)}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm">紧凑模式</div>
                <div className="text-xs text-gray-500">收窄会话气泡间距，一屏展示更多内容</div>
              </div>
              <Switch
                checked={prefs.compact}
                onChange={(value) => handlePrefChange('compact', value)}
              />
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
