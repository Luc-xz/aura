import React, { useState, useEffect } from 'react'
import { App, Drawer, Form, Input, Popconfirm, Select } from 'antd'
import { getProviderList, getModelList, getModelConfigList, createModelConfig, updateModelConfig, deleteModelConfig } from '@/api/setting'
import { getUserSettings, updateUserSettings } from '@/api/user-settings'
import { Pill, SwitchCtl } from '@/components/ui'

const NATIVE_PROVIDERS = ['openai', 'anthropic', 'google']

// 原型 11：cell-avatar 供应商底色
const PROVIDER_TONE: Record<string, { bg: string; color: string }> = {
  openai: { bg: 'var(--primary-bg)', color: 'var(--primary)' },
  anthropic: { bg: '#f3eefe', color: '#7a5af8' },
  google: { bg: '#e8f3ee', color: '#2f7d5c' },
}

const maskKey = (key?: string | null) => (key ? `••••${key.slice(-4)}` : '未配置')

export function ModelConfigPanel({ data = null, open, setOpen, refresh }) {
  const [form] = Form.useForm()
  const { message } = App.useApp()
  const [providerList, setProviderList] = useState([])
  const [modelList, setModelList] = useState([])
  const [custom, setCustom] = useState(false)

  const fetchProviderList = async () => {
    const [err, res] = await getProviderList()
    if (res) {
      setProviderList(res.data || [])
    }
  }

  const fetchModelList = async (provider: string) => {
    const [err, res] = await getModelList(provider)
    if (res) {
      setModelList(res.data || [])
    }
  }

  const handleSubmit = async () => {
    await form.validateFields()
    const values = form.getFieldsValue()
    values.isActive = values.isActive ? 1 : 0
    const payload = data ? [data.id, values] : [values]
    const api = data ? updateModelConfig : createModelConfig
    const [err, res] = await api(...payload)
    if (res) {
      message.success('操作成功')
      setOpen(false)
      refresh()
    }
  }

  const handleProviderChange = (value: string) => {
    if (value) {
      fetchModelList(value)
    } else {
      setModelList([])
      form.setFieldValue('modelName', '')
    }
  }

  useEffect(() => {
    fetchProviderList()
    if (data) {
      form.setFieldsValue(data)
      data.provider && fetchModelList(data.provider)
    } else {
      form.resetFields()
      setModelList([])
    }
  }, [data])

  return (
    <Drawer
      title={data ? '编辑模型' : '新增模型'}
      width={480}
      open={open}
      onClose={() => setOpen(false)}
      styles={{ body: { paddingTop: 24 } }}>
      <Form
        name="modelConfig"
        form={form}
        className="aura-form flex flex-col gap-3"
        requiredMark={false}
        colon={false}
        layout="vertical">
        <Form.Item label="自定义供应商">
          <SwitchCtl
            checked={custom}
            onChange={(checked) => setCustom(checked)}
          />
        </Form.Item>
        <Form.Item
          label="Provider"
          name="provider"
          rules={[{ required: true, message: '请选择' }]}>
          {custom ? (
            <Input />
          ) : (
            <Select
              onChange={handleProviderChange}
              showSearch
              options={[...new Set([...providerList, 'openai-compatible'])].map((item) => {
                return { value: item, label: item }
              })}
            />
          )}
        </Form.Item>
        <Form.Item
          label="模型名称"
          name="modelName"
          rules={[{ required: true, message: '请选择' }]}>
          {custom || modelList.length === 0 ? (
            <Input />
          ) : (
            <Select
              showSearch
              options={modelList.map((item) => {
                return { value: item, label: item }
              })}
            />
          )}
        </Form.Item>
        <Form.Item
          label="Base URL"
          name="baseUrl"
          dependencies={['provider']}
          rules={[
            ({ getFieldValue }) => ({
              validator(_, value) {
                const provider = getFieldValue('provider')
                if (provider && !NATIVE_PROVIDERS.includes(provider) && !value) {
                  return Promise.reject(new Error('该 Provider 需要填写 Base URL'))
                }
                return Promise.resolve()
              },
            }),
          ]}>
          <Input />
        </Form.Item>
        <Form.Item
          label="API Key"
          name="apiKey">
          <Input />
        </Form.Item>
        <Form.Item
          label="启用"
          name="isActive"
          valuePropName="checked">
          <SwitchCtl />
        </Form.Item>
        <button
          type="button"
          className="btn btn--primary"
          onClick={handleSubmit}>
          提交
        </button>
      </Form>
    </Drawer>
  )
}

// 我的模型（原型 11）：默认模型提示条 + 表格；编辑经抽屉表单
export default function ModelList({ editable = false, selectHander = () => {} }) {
  const { message } = App.useApp()
  const [rows, setRows] = useState<any[]>([])
  const [defaultModelId, setDefaultModelId] = useState<number | null | undefined>(undefined)
  const [open, setOpen] = useState(false)
  const [data, setData] = useState(null)

  const fetchRows = async () => {
    const [err, res] = await getModelConfigList({})
    if (res) {
      setRows(res.data || [])
    }
  }

  const fetchDefault = async () => {
    const [err, res] = await getUserSettings()
    setDefaultModelId(res?.data?.defaultModelId ?? undefined)
  }

  useEffect(() => {
    fetchRows()
    fetchDefault()
  }, [])

  const handleConfig = (item: any) => {
    setData(item)
    setOpen(true)
  }

  const handleDelete = async (id: string) => {
    const [err, res] = await deleteModelConfig(id)
    if (res) {
      message.success('模型已删除')
      fetchRows()
    }
  }

  const handleSwitch = async (item: any) => {
    const [err, res] = await updateModelConfig(item.id, { isActive: item.isActive ? 0 : 1 })
    if (res) {
      fetchRows()
    }
  }

  const handleDefaultChange = async (value?: number) => {
    const [err, res] = await updateUserSettings({ defaultModelId: value ?? null })
    if (res) {
      setDefaultModelId(value)
      message.success('默认模型已更新')
    }
  }

  const defaultName = rows.find((item) => item.id === defaultModelId)?.modelName
  const activeOptions = rows.filter((item) => item.isActive).map((item) => ({ value: item.id, label: item.modelName }))

  return (
    <div className="h-full overflow-y-auto bg-canvas">
      <main className="main">
        <div className="page-head">
          <div className="page-head__text">
            <span className="t-title">我的模型</span>
            <span className="t-body t-muted">管理你自己的模型接入与 API Key——每用户独立，仅本人可见</span>
          </div>
          {editable ? (
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => handleConfig(null)}>
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
              新增模型
            </button>
          ) : null}
        </div>

        {/* 默认模型提示条（原型 11 primary-bg 卡） */}
        <div
          className="spec-card"
          style={{ background: 'var(--primary-bg)', borderColor: 'var(--primary-line)' }}>
          <div className="row-between">
            <div className="flex flex-col gap-1">
              <span className="t-body w-semi">当前默认模型：{defaultName || '未设置'}</span>
              <span
                className="t-sm"
                style={{ color: '#3d6ba8' }}>
                新建项目未指定模型时将默认使用该模型，可在项目内临时切换
              </span>
            </div>
            <Select
              value={defaultModelId}
              placeholder="选择默认模型"
              options={activeOptions}
              onChange={handleDefaultChange}
              style={{ width: 160 }}
            />
          </div>
        </div>

        {/* 模型表格（原型 11：cell-user 头像列 + 状态胶囊 + 行内操作） */}
        <div className="table">
          <div className="table__head">
            <span style={{ width: 260 }}>模型</span>
            <span style={{ width: 160 }}>供应商</span>
            <span style={{ width: 110 }}>状态</span>
            <span className="cell-grow">API Key</span>
            <span style={{ width: 170 }}>操作</span>
          </div>
          {rows.length ? (
            rows.map((item) => {
              const tone = PROVIDER_TONE[item.provider] ?? { bg: 'var(--neutral-bg)', color: 'var(--muted)' }
              return (
                <div
                  className="table__row"
                  key={item.id}
                  onClick={selectHander}>
                  <div className="cell-user">
                    <div
                      className="cell-avatar"
                      style={{ background: tone.bg, color: tone.color }}>
                      {item.modelName.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex flex-col">
                      <span className={`w-semi ${item.isActive ? '' : 't-muted'}`}>{item.modelName}</span>
                      {item.baseUrl ? <span className="t-xs t-placeholder">{item.baseUrl}</span> : null}
                    </div>
                  </div>
                  <span
                    className="t-muted"
                    style={{ width: 160 }}>
                    {item.provider}
                  </span>
                  <span style={{ width: 110 }}>
                    <Pill
                      tone={item.isActive ? 'active' : 'archived'}
                      size="sm">
                      {item.isActive ? '已启用' : '已停用'}
                    </Pill>
                  </span>
                  <span className="cell-grow t-muted num">{maskKey(item.apiKey)}</span>
                  {editable ? (
                    <span
                      className="flex gap-3"
                      style={{ width: 170 }}>
                      <span
                        className="cell-link"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleConfig(item)
                        }}>
                        编辑
                      </span>
                      <span
                        className="cell-link t-muted"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleSwitch(item)
                        }}>
                        {item.isActive ? '停用' : '启用'}
                      </span>
                      <Popconfirm
                        title="删除该模型配置？"
                        okText="删除"
                        cancelText="取消"
                        onConfirm={(e) => {
                          e?.stopPropagation()
                          handleDelete(item.id)
                        }}>
                        <span
                          className="cell-danger"
                          onClick={(e) => e.stopPropagation()}>
                          删除
                        </span>
                      </Popconfirm>
                    </span>
                  ) : (
                    <span style={{ width: 170 }} />
                  )}
                </div>
              )
            })
          ) : (
            <div className="table__row t-muted">还没有模型配置，点击右上角新增</div>
          )}
        </div>
      </main>
      <ModelConfigPanel
        data={data}
        open={open}
        setOpen={setOpen}
        refresh={fetchRows}
      />
    </div>
  )
}
