import { createContext, useContext } from 'react'
import type { ReactNode } from 'react'

export interface LeftbarNavSlot {
  /** 页面注入的自定义左栏内容（替换 模块导航+项目列表 整段）；卸载时置 null 恢复默认 */
  node: ReactNode
  /** 使用 260px 窄栏（原型 09 笔记编辑） */
  narrow?: boolean
}

// 独立模块承载 context：避免路由布局模块（react-router 插件加载路径）与页面别名导入
// 形成 leftbar-b 双实例时 context 断连——两侧始终引用同一份 leftbar-nav 模块
export const LeftbarNavContext = createContext<{ setNav: (slot: LeftbarNavSlot | null) => void }>({
  setNav: () => {},
})

export const useLeftbarNav = () => useContext(LeftbarNavContext)
