import { Button, Form, Input, Modal, Select } from 'antd'
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

// 原型 05/05b：560px 弹窗、28px 内边距、字段 label 上置、状态与模型双列、底部按钮右对齐
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

  const handleFinish = async (values: WorkspaceFormValues) => {
    await onOk(values, editing ? 'update' : 'create')
  }

  return (
    <Modal
      open={open}
      onCancel={onCancel}
      closable={false}
      maskClosable={false}
      width={560}
      style={{ top: 100 }}
      styles={{
        content: { padding: 28, borderRadius: 10, border: '1px solid var(--line)' },
        body: { display: 'flex', flexDirection: 'column', gap: 14 },
        mask: { background: 'rgba(22, 32, 42, 0.45)' },
      }}
      footer={null}>
      <div className="auth__intro">
        <span className="t-h2">{editing ? '编辑项目' : '新建项目'}</span>
        <span className="t-sm t-muted">{editing ? '更新目标与状态，改动会同步到项目上下文' : '填写目标与背景，创建后即可开始推进'}</span>
      </div>
      <Form
        form={form}
        className="aura-form flex flex-col gap-3.5"
        requiredMark={false}
        colon={false}
        layout="vertical"
        initialValues={{ status: 0 }}
        onFinish={handleFinish}>
        <Form.Item
          name="title"
          label="项目名称"
          rules={[
            { required: true, message: '请输入项目名称' },
            { max: 255, message: '不超过 255 字' },
          ]}>
          <Input
            maxLength={255}
            placeholder="例如：品牌官网改版"
          />
        </Form.Item>
        <Form.Item
          name="goal"
          label="项目目标"
          rules={[{ max: 255, message: '不超过 255 字' }]}>
          <Input
            maxLength={255}
            placeholder="一句话说明这个项目要达成什么"
          />
        </Form.Item>
        <Form.Item
          name="description"
          label="背景描述"
          rules={[{ max: 2000, message: '不超过 2000 字' }]}>
          <Input.TextArea
            rows={3}
            maxLength={2000}
            placeholder="补充背景、约束与参考资料，帮助模型理解上下文"
          />
        </Form.Item>
        <div className="flex gap-3">
          <Form.Item
            name="status"
            label={editing ? '当前状态' : '初始状态'}
            className="flex-1">
            <Select options={WORKSPACE_STATUS} />
          </Form.Item>
          <Form.Item
            name="modelId"
            label="默认模型"
            className="flex-1"
            tooltip="留空时使用账户默认模型">
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="留空使用默认模型"
              options={modelList.map((item) => ({ value: item.id, label: item.modelName }))}
            />
          </Form.Item>
        </div>
        <div className="modal__foot">
          {editing && onDelete ? (
            <span
              className="t-danger t-sm w-medium cursor-pointer"
              style={{ marginRight: 'auto', alignSelf: 'center' }}
              onClick={onDelete}>
              删除项目
            </span>
          ) : null}
          <button
            type="button"
            className="btn btn--ghost"
            onClick={onCancel}>
            取消
          </button>
          <Button
            type="primary"
            htmlType="submit"
            loading={confirmLoading}
            style={{ height: 36, fontWeight: 600 }}>
            {editing ? '保存修改' : '创建项目'}
          </Button>
        </div>
      </Form>
    </Modal>
  )
}
