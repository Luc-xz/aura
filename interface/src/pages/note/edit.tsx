import { Layout, Form, Input, Button, App } from 'antd'
import { getNoteById, createNote, updateNote } from '@/api/note'
import { useEffect } from 'react'
import { useSubmit } from 'react-router'

const getNoteDetail = async (id: string) => {
  const [err, res] = await getNoteById(id)
  if (res) {
    return res.data
  }
  return null
}

const submitNote = async (payload) => {
  const api = payload.id ? updateNote : createNote
  const [err, res] = await api(payload)
  if (res) {
    return res.data
  }
  return null
}

export async function clientLoader({ params }) {
  if (!params.id) return null
  return await getNoteDetail(params.id)
}

export async function clientAction({ request }) {
  const formData = await request.formData()
  const payload = Object.fromEntries(formData)
  return await submitNote(payload)
}

export default function Page({ loaderData, actionData }) {
  const { message } = App.useApp()
  const [form] = Form.useForm()
  const submit = useSubmit()

  const handleSubmit = (values) => {
    submit(values, { method: 'post' })
  }

  useEffect(() => {
    loaderData ? form.setFieldsValue(loaderData) : form.resetFields()
  }, [loaderData])

  useEffect(() => {
    if (actionData) {
      message.success('提交成功')
    }
  }, [actionData])

  return (
    <Layout.Content
      style={{
        padding: '48px 64px',
        margin: '0 auto',
        width: '100%',
        maxWidth: '1200px',
        height: '100%',
        overflow: 'auto',
      }}>
      <Form
        form={form}
        onFinish={handleSubmit}>
        <Form.Item
          name="id"
          hidden>
          <Input />
        </Form.Item>
        <Form.Item
          label="标题"
          name="title"
          rules={[{ required: true }]}
          labelCol={{ span: 1 }}
          wrapperCol={{ span: 23 }}>
          <Input
            allowClear
            placeholder="请输入"
          />
        </Form.Item>
        <Form.Item
          label="描述"
          name="description"
          labelCol={{ span: 1 }}
          wrapperCol={{ span: 23 }}>
          <Input.TextArea
            placeholder="请输入"
            rows={3}
            maxLength={100}
          />
        </Form.Item>
        <Form.Item
          label="内容"
          name="content"
          rules={[{ required: true }]}
          labelCol={{ span: 1 }}
          wrapperCol={{ span: 23 }}>
          <Input.TextArea
            placeholder="请输入"
            autoSize={{ minRows: 20 }}
          />
        </Form.Item>
        <div className="w-full flex justify-end">
          <Button
            type="primary"
            htmlType="submit">
            提交
          </Button>
        </div>
      </Form>
    </Layout.Content>
  )
}
