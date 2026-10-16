import { Button, Form, Input, Modal, Select } from 'antd'
import { useEffect } from 'react'
import { WORKSPACE_STATUS } from '@/components/status-pill'
import type { WorkspaceItem, WorkspacePayload } from '@/api/workspace'

export interface WorkspaceFormValues {
  title: string
  goal?: string
  description?: string
  status?: number
}

interface WorkspaceModalProps {
  open: boolean
  /** 账户默认模型名（原型 05「默认模型」为规划中字段的禁用展示） */
  defaultModelName?: string | null
  /** 传入项目行进入编辑态（回填），null 为新建 */
  editing?: WorkspaceItem | null
  confirmLoading?: boolean
  onOk: (values: WorkspaceFormValues, mode: 'create' | 'update') => void | Promise<unknown>
  onCancel: () => void
  /** 编辑态左下删除入口；删除约束（仅归档可删）由后端 409 兜底 */
  onDelete?: () => void
}

// 表单值 → 请求体：默认模型为「规划中」字段（原型 05/05b），新建走账户默认模型回退、编辑不动既有挂载
export const toWorkspacePayload = (values: WorkspaceFormValues, mode: 'create' | 'update'): WorkspacePayload => {
  const { title, goal = '', description = '', status } = values
  if (mode === 'create') {
    return { title, goal, description, status: status ?? 0 }
  }
  return { title, goal, description, status }
}

// 原型 05/05b：560px 弹窗、28px 内边距、字段 label 上置、状态与模型双列、底部按钮右对齐
export default function WorkspaceModal({ open, defaultModelName, editing = null, confirmLoading = false, onOk, onCancel, onDelete }: WorkspaceModalProps) {
  const [form] = Form.useForm()

  useEffect(() => {
    if (!open) return
    if (editing) {
      form.setFieldsValue({
        title: editing.title,
        goal: editing.goal ?? '',
        description: editing.description ?? '',
        status: editing.status,
      })
    } else {
      form.resetFields()
    }
  }, [open, editing])

  const handleFinish = async (values: WorkspaceFormValues) => {
    await onOk(values, editing ? 'update' : 'create')
  }

  // 默认模型展示值：编辑态优先已挂载模型，否则账户默认模型（原型 05b 回填已选模型）
  const modelDisplay = editing?.modelName ?? defaultModelName ?? '未设置'

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
            label={
              <span className="inline-flex items-center gap-1">
                默认模型
                <span className="pill pill--sm pill--info">规划中</span>
              </span>
            }
            className="flex-1">
            {/* 规划中字段：禁用展示（原型 05/05b 为 input--filled 静态样式），项目级模型选择待远期 */}
            <div
              className="input input--filled"
              style={{ justifyContent: 'space-between' }}>
              {modelDisplay}
              <svg
                width="13"
                height="13"
                viewBox="0 0 14 14"
                fill="none"
                stroke="#6b7785"
                strokeWidth="1.4"
                strokeLinecap="round">
                <path d="M3.5 5.5 7 9l3.5-3.5" />
              </svg>
            </div>
          </Form.Item>
        </div>
        <div className="modal__foot">
          {editing && onDelete ? (
            <button
              type="button"
              className="cell-danger t-danger t-sm w-medium"
              style={{ marginRight: 'auto', alignSelf: 'center' }}
              onClick={onDelete}>
              删除项目
            </button>
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
