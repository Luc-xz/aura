const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

const pad = (n: number) => (n > 9 ? String(n) : `0${n}`)

export const formatDate = (input: string | number | Date) => {
  const d = new Date(input)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// 相对时间：7 天内给相对描述，更早（或时钟偏差导致的未来时间）回退为日期
export const formatRelative = (input: string | number | Date): string => {
  const date = new Date(input)
  if (Number.isNaN(date.getTime())) return ''
  const diff = Date.now() - date.getTime()
  if (diff < 0) return formatDate(date)
  if (diff < MINUTE) return '刚刚'
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)} 分钟前`
  if (diff < DAY) return `${Math.floor(diff / HOUR)} 小时前`
  if (diff < DAY * 2) return '昨天'
  if (diff < DAY * 7) return `${Math.floor(diff / DAY)} 天前`
  return formatDate(date)
}
