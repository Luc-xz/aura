import { Button, Form, Input, Modal, Select } from 'antd'
import { DeleteOutlined } from '@ant-design/icons'
import { useEffect } from 'react'
import { WORKSPACE_STATUS } from '@/components/status-pill'
import type { WorkspaceItem, WorkspacePayload } from '@/api/workspace'

export interface WorkspaceFormValues {
  title: string
  goal?: string
  description?: string
  status?: number
  modelId?: number | null
}

interface WorkspaceModalProps {
  open: boolean
  modelList: Array<{ id: number; modelName: string }>
  /** 传入项目行进入编辑态（回填），null 为新建 */
  editing?: WorkspaceItem | null
  confirmLoading?: boolean
  onOk: (values: WorkspaceFormValues, mode: 'create' | 'update') => void | Promise<unknown>
  onCancel: () => void
  /** 编辑态左下删除入口；删除约束（仅归档可删）由后端 409 兜底 */
  onDelete?: () => void
}

// 表单值 → 请求体：新建时空 modelId 不传（走 B4 用户默认模型回退）；编辑时清空传 null 解除挂载
export const toWorkspacePayload = (values: WorkspaceFormValues, mode: 'create' | 'update'): WorkspacePayload => {
  const { title, goal = '', description = '', status, modelId } = values
  if (mode === 'create') {
    return { title, goal, description, status: status ?? 0, ...(modelId ? { modelId } : {}) }
  }
  return { title, goal, description, status, modelId: modelId ?? null }
}

export default function WorkspaceModal({ open, modelList, editing = null, confirmLoading = false, onOk, onCancel, onDelete }: WorkspaceModalProps) {
  const [form] = Form.useForm()

  useEffect(() => {
    if (!open) return
    if (editing) {
      form.setFieldsValue({
        title: editing.title,
        goal: editing.goal ?? '',
        description: editing.description ?? '',
        status: editing.status,
        modelId: editing.modelId ?? undefined,
      })
    } else {
      form.resetFields()
    }
  }, [open, editing])

  const handleOk = async () => {
    const values = await form.validateFields()
    await onOk(values, editing ? 'update' : 'create')
  }

  return (
    <Modal
      title={editing ? '编辑项目' : '新建项目'}
      open={open}
      confirmLoading={confirmLoading}
      onOk={handleOk}
      onCancel={onCancel}
      maskClosable={false}
      footer={
        <>
          {editing && onDelete ? (
            <Button
              danger
              type="text"
              icon={<DeleteOutlined />}
              onClick={onDelete}
              className="float-left">
              删除项目
            </Button>
          ) : null}
          <Button onClick={onCancel}>取消</Button>
          <Button
            type="primary"
            loading={confirmLoading}
            onClick={handleOk}>
            确定
          </Button>
        </>
      }>
      <Form
        form={form}
        layout="vertical"
        initialValues={{ status: 0 }}>
        <Form.Item
          name="title"
          label="项目名称"
          rules={[
            { required: true, message: '请输入项目名称' },
            { max: 255, message: '不超过 255 字' },
          ]}>
          <Input
            maxLength={255}
            placeholder="例如：个人知识库重构"
          />
        </Form.Item>
        <Form.Item
          name="goal"
          label="项目目标"
          rules={[{ max: 255, message: '不超过 255 字' }]}>
          <Input
            maxLength={255}
            placeholder="这个项目要达成什么（选填）"
          />
        </Form.Item>
        <Form.Item
          name="description"
          label="背景描述"
          rules={[{ max: 2000, message: '不超过 2000 字' }]}>
          <Input.TextArea
            rows={3}
            maxLength={2000}
            placeholder="补充项目背景、约束、参考资料（选填）"
          />
        </Form.Item>
        <Form.Item
          name="status"
          label="状态">
          <Select options={WORKSPACE_STATUS} />
        </Form.Item>
        <Form.Item
          name="modelId"
          label="模型"
          tooltip="留空时使用账户默认模型">
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder="留空使用默认模型"
            options={modelList.map((item) => ({ value: item.id, label: item.modelName }))}
          />
        </Form.Item>
      </Form>
    </Modal>
  )
}
