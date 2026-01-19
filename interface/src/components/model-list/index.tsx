import { useState, useEffect } from 'react'
import { App, Space, Card, Switch, Drawer, Form, Input, InputNumber, Button } from 'antd'
import { SettingOutlined } from '@ant-design/icons'
import { getModelConfigGroup, createModelConfig, updateModelConfig } from '@/api/setting'

export function ModelConfigPanel({ data = null, open, setOpen, refresh }) {
  const [form] = Form.useForm()
  const { message } = App.useApp()

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

  useEffect(() => {
    if (data) {
      form.setFieldsValue(data)
    } else {
      form.resetFields()
    }
  }, [data])

  return (
    <Drawer
      title={data ? '编辑配置' : '新增配置'}
      size="large"
      closable
      open={open}
      onClose={() => setOpen(false)}
      extra={
        <Space>
          <Button
            onClick={handleSubmit}
            type="primary">
            提交
          </Button>
        </Space>
      }>
      <Form
        name="modelConfig"
        form={form}
        initialValues={{ remember: true }}
        labelAlign="right"
        labelCol={{ span: 3 }}
        wrapperCol={{ span: 21 }}>
        <Form.Item
          label="Provider"
          name="providerType"
          rules={[{ required: true, message: '请输入' }]}>
          <Input />
        </Form.Item>
        <Form.Item
          label="模型名称"
          name="modelName"
          rules={[{ required: true, message: '请输入' }]}>
          <Input />
        </Form.Item>
        <Form.Item
          label="Base URL"
          name="baseUrl"
          rules={[{ required: true, message: '请输入' }]}>
          <Input />
        </Form.Item>
        <Form.Item
          label="API key"
          name="apiKey"
          rules={[{ required: true, message: '请输入' }]}>
          <Input />
        </Form.Item>
        <Form.Item
          label="温度"
          name="temperature"
          rules={[{ required: true, message: '请输入' }]}>
          <InputNumber
            min={0}
            max={1}
            defaultValue={0.7}
            style={{ width: '100%' }}
          />
        </Form.Item>
        <Form.Item
          label="启用"
          name="isActive"
          valuePropName="checked">
          <Switch />
        </Form.Item>
      </Form>
    </Drawer>
  )
}

export default function ModelList({ editable = false, selectHander = () => {} }) {
  const [modelConfigList, setModelConfigList] = useState({})
  const [open, setOpen] = useState(false)
  const [data, setData] = useState(null)

  const handleConfig = (item: any) => {
    setData(item)
    setOpen(true)
  }

  const handleSwitch = async (checked: boolean, item: any) => {
    const payload = { isActive: Number(checked) }
    const [err, res] = await updateModelConfig(item.id, payload)
    if (res) {
      fetchModelConfigGroup()
    }
  }

  const modelConfigGroup = Object.entries(modelConfigList).map(([provider, list]) => {
    if (!list.length) return null
    const modelList = list.map((item) => {
      return (
        <Card
          style={{ width: 200 }}
          onClick={selectHander}
          actions={
            editable
              ? [
                  <SettingOutlined
                    key="setting"
                    onClick={() => handleConfig(item)}
                  />,
                  <Switch
                    size="small"
                    value={item.isActive}
                    onChange={(checked) => handleSwitch(checked, item)}
                  />,
                ]
              : null
          }>
          <Card.Meta title={item.modelName} />
        </Card>
      )
    })
    return (
      <>
        <h3 className="my-4 text-xl font-bold">{provider} </h3>
        <Space
          size={[8, 16]}
          wrap>
          {modelList}
        </Space>
      </>
    )
  })

  const fetchModelConfigGroup = async () => {
    const [err, res] = await getModelConfigGroup()
    console.log('[API]::[fetchModelConfigGroup]::', res, err)
    if (res) {
      setModelConfigList(res.data || {})
    }
  }

  useEffect(() => {
    fetchModelConfigGroup()
  }, [])

  return (
    <>
      {modelConfigGroup}
      <ModelConfigPanel
        data={data}
        open={open}
        setOpen={setOpen}
        refresh={fetchModelConfigGroup}
      />
    </>
  )
}
