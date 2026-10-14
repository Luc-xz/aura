import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement>

export function AuraLogoIcon({ size = 16, ...props }: IconProps & { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 18 18"
      fill="none"
      aria-hidden="true"
      {...props}>
      <path d="M9 2.5 3.2 15.5h11.6L9 2.5Z" fill="currentColor" />
    </svg>
  )
}

export function WorkspaceIcon(props: IconProps) {
  return (
    <svg className="nav-icon" viewBox="0 0 18 18" fill="none" aria-hidden="true" {...props}>
      <rect x="2.5" y="2.5" width="5.2" height="5.2" rx="1.2" />
      <rect x="10.3" y="2.5" width="5.2" height="5.2" rx="1.2" />
      <rect x="2.5" y="10.3" width="5.2" height="5.2" rx="1.2" />
      <rect x="10.3" y="10.3" width="5.2" height="5.2" rx="1.2" />
    </svg>
  )
}

export function NoteIcon(props: IconProps) {
  return (
    <svg className="nav-icon" viewBox="0 0 18 18" fill="none" aria-hidden="true" {...props}>
      <path d="M5 2.5h6l3 3v10H5z" />
      <path d="M11 2.5v3h3" />
    </svg>
  )
}

export function SettingIcon(props: IconProps) {
  return (
    <svg className="nav-icon" viewBox="0 0 18 18" fill="none" aria-hidden="true" {...props}>
      <circle cx="9" cy="9" r="2.6" />
      <path d="M9 2.2v2M9 13.8v2M2.2 9h2M13.8 9h2M4.2 4.2l1.4 1.4M12.4 12.4l1.4 1.4M13.8 4.2l-1.4 1.4M5.6 12.4l-1.4 1.4" />
    </svg>
  )
}

export function UserIcon(props: IconProps) {
  return (
    <svg className="nav-icon" viewBox="0 0 18 18" fill="none" aria-hidden="true" style={{ strokeWidth: 1.6 }} {...props}>
      <circle cx="9" cy="6.4" r="3" />
      <path d="M3.6 15c.6-2.6 2.8-4 5.4-4s4.8 1.4 5.4 4" />
    </svg>
  )
}

export function LogoutIcon(props: IconProps) {
  return (
    <svg className="nav-icon" viewBox="0 0 18 18" fill="none" aria-hidden="true" {...props}>
      <path d="M7 3h6.5v12H7" />
      <path d="M4 9h7M8.5 6 11.5 9l-3 3" />
    </svg>
  )
}
