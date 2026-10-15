interface SwitchCtlProps {
  checked: boolean
  disabled?: boolean
  onChange: (checked: boolean) => void
}

/** 原型 15 switch：32×18 胶囊 + 14px 圆钮（aura.css .switch） */
export function SwitchCtl({ checked, disabled = false, onChange }: SwitchCtlProps) {
  return (
    <button
      type="button"
      className={`switch ${checked ? 'switch--on' : ''}`}
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      style={disabled ? { opacity: 0.45, cursor: 'not-allowed' } : undefined}
      onClick={() => onChange(!checked)}>
      <span className="switch__knob"></span>
    </button>
  )
}
