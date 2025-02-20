import { Outlet } from 'react-router'

export default function Layout() {
  return (
    <div className="border border-amber-300">
      <Outlet />
    </div>
  )
}
