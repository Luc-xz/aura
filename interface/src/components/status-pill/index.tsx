import { Tag } from 'antd'

// 状态枚举与后端 TINYINT 对齐：0=进行中 1=暂停 2=已归档（执行计划 §6.1）
export const WORKSPACE_STATUS = [
  { value: 0, label: '进行中' },
  { value: 1, label: '暂停' },
  { value: 2, label: '已归档' },
]

const STATUS_MAP: Record<number, { text: string; color: string }> = {
  0: { text: '进行中', color: 'blue' },
  1: { text: '暂停', color: 'gold' },
  2: { text: '已归档', color: 'default' },
}

// 状态圆点（项目列表等紧凑场景用）
export const statusDotClass = (status?: number | null) => {
  if (status === 0) return 'bg-blue-500'
  if (status === 1) return 'bg-amber-500'
  if (status === 2) return 'bg-gray-400'
  return 'bg-gray-300'
}

export default function StatusPill({ status, className }: { status?: number | null; className?: string }) {
  const conf = STATUS_MAP[status ?? -1] ?? { text: '未知', color: 'default' }
  return (
    <Tag
      color={conf.color}
      bordered={false}
      className={`m-0 ${className ?? ''}`}>
      {conf.text}
    </Tag>
  )
}
