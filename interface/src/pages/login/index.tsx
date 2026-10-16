import { App, Button, Form, Input } from 'antd'
import { useNavigate, useNavigation, useSearchParams, useSubmit } from 'react-router'
import { useState, useEffect } from 'react'
import { login, register, profile } from '@/api/user'
import { useUserStore } from '@/store'

const submitLogin = async (payload: any) => {
  const [err, res] = await login(payload)
  if (res) {
    return res.data
  }
  return null
}

const submitRegister = async (payload: any) => {
  const [err, res] = await register(payload)
  if (res) {
    return res.data
  }
  return null
}

export async function clientAction({ request }) {
  const formData = await request.formData()
  const payload = Object.fromEntries(formData)
  if (payload.type === 'login') {
    return await submitLogin(payload)
  }
  if (payload.type === 'register') {
    return await submitRegister(payload)
  }
}

// 原型输入框前缀图标（stroke currentColor，随前缀态着色）
const MailIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 18 18"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.4">
    <rect
      x="2.5"
      y="4"
      width="13"
      height="10"
      rx="2"
    />
    <path d="M2.9 4.6 9 9.6l6.1-5" />
  </svg>
)

const LockIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 18 18"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.4">
    <rect
      x="3.5"
      y="8"
      width="11"
      height="7"
      rx="2"
    />
    <path d="M6.2 8V6.2a2.8 2.8 0 0 1 5.6 0V8" />
  </svg>
)

const UserIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 18 18"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.4">
    <circle
      cx="9"
      cy="6.4"
      r="3"
    />
    <path d="M3.6 15c.6-2.6 2.8-4 5.4-4s4.8 1.4 5.4 4" />
  </svg>
)

// 品牌区文案与预览图排布随登录/注册双态切换（原型 01 / 02）
const BRAND: Record<'login' | 'register', { headline: [string, string]; sub: [string, string]; rows: [{ accent: boolean; height: number }, { accent: boolean; height: number }] }> = {
  login: {
    headline: ['面向长期项目推进的', 'AI 工作台'],
    sub: ['每个项目都有目标、背景与当前状态。聊天是推进方式，', '沉淀下来的结论才是资产。'],
    rows: [
      { accent: true, height: 54 },
      { accent: false, height: 54 },
    ],
  },
  register: {
    headline: ['把项目推进的', '每个结论留在这里'],
    sub: ['注册后即可创建项目、与模型协作推进，并把关键结论沉淀为', '可复用的笔记。'],
    rows: [
      { accent: false, height: 44 },
      { accent: true, height: 44 },
    ],
  },
}

function AuthBrandPanel({ type }: { type: 'login' | 'register' }) {
  const brand = BRAND[type]
  return (
    // 方案 B 转正：品牌区改浅色（原型 01/02 auth__brand--light）
    <div className="auth__brand auth__brand--light">
      <div className="auth__logo">
        <span className="auth__logo-mark">
          <svg
            width="16"
            height="16"
            viewBox="0 0 18 18"
            fill="none">
            <path
              d="M9 2.5 3.2 15.5h11.6L9 2.5Z"
              fill="#fff"
            />
          </svg>
        </span>
        Aura
        <span className="brand__tag">自主体验</span>
      </div>

      <h1 className="auth__headline">
        {brand.headline[0]}
        <br />
        {brand.headline[1]}
      </h1>
      <p className="auth__sub">
        {brand.sub[0]}
        <br />
        {brand.sub[1]}
      </p>

      <div className="auth__preview">
        <div className="auth__preview-rail">
          <span className="auth__preview-dot auth__preview-dot--first"></span>
          <span className="auth__preview-dot"></span>
          <span className="auth__preview-dot"></span>
          <span className="auth__preview-dot"></span>
        </div>
        <div className="auth__preview-body">
          <div
            className="auth__preview-row auth__preview-row--head"
            style={{ width: '62%' }}></div>
          {brand.rows.map((row, index) => (
            <div
              key={index}
              className={`auth__preview-row ${row.accent ? 'auth__preview-row--accent' : ''}`}
              style={{ height: row.height }}></div>
          ))}
          <div
            className="auth__preview-row"
            style={{ flex: '1 1 auto' }}></div>
        </div>
      </div>

      <p className="auth__caption">Aura Workspace · 登录后进入项目工作台</p>
    </div>
  )
}

export function LoginPanel() {
  const submit = useSubmit()
  const navigate = useNavigate()
  const navigation = useNavigation()
  const submitting = navigation.state === 'submitting'

  const handleSubmit = (values) => {
    submit({ ...values, type: 'login' }, { method: 'post' })
  }

  return (
    <Form
      name="login"
      layout="vertical"
      className="auth__card aura-form"
      requiredMark={false}
      colon={false}
      onFinish={handleSubmit}>
      <div className="auth__intro">
        <span className="auth__title">登录 Aura</span>
        <span className="t-sm t-muted">登录后继续推进你的项目</span>
      </div>
      <Form.Item
        name="email"
        label="邮箱"
        rules={[
          { required: true, message: '请输入邮箱' },
          { type: 'email', message: '请输入正确的邮箱' },
        ]}>
        <Input
          prefix={<MailIcon />}
          placeholder="请输入邮箱"
          autoComplete="email"
        />
      </Form.Item>
      <Form.Item
        name="password"
        label="密码"
        rules={[{ required: true, message: '请输入密码' }]}>
        <Input
          prefix={<LockIcon />}
          type="password"
          placeholder="请输入密码"
          autoComplete="current-password"
        />
      </Form.Item>
      <Button
        block
        type="primary"
        htmlType="submit"
        loading={submitting}
        disabled={submitting}
        style={{ height: 38, fontWeight: 600 }}>
        登录
      </Button>
      <span className="auth__foot">
        没有账户？
        <button
          type="button"
          className="auth__switch t-primary w-medium"
          onClick={() => navigate('/login?type=register')}>
          {' '}
          立即注册
        </button>
      </span>
    </Form>
  )
}

export function RegisterPanel() {
  const submit = useSubmit()
  const [form] = Form.useForm()
  const navigate = useNavigate()
  const navigation = useNavigation()
  const submitting = navigation.state === 'submitting'

  const handleSubmit = (values) => {
    submit({ ...values, type: 'register' }, { method: 'post' })
  }

  return (
    <Form
      name="register"
      layout="vertical"
      form={form}
      className="auth__card aura-form"
      requiredMark={false}
      colon={false}
      onFinish={handleSubmit}>
      <div className="auth__intro">
        <span className="auth__title">注册 Aura</span>
        <span className="t-sm t-muted">创建账户，开始你的第一个项目</span>
      </div>
      <Form.Item
        name="name"
        label="用户名"
        rules={[
          { required: true, message: '请输入用户名' },
          { pattern: /^[a-zA-Z0-9_-]{4,16}$/, message: '用户名只能包含字母、数字、下划线和减号，且长度在4-16之间' },
        ]}>
        <Input
          prefix={<UserIcon />}
          placeholder="请输入用户名"
          autoComplete="username"
        />
      </Form.Item>
      <Form.Item
        name="email"
        label="邮箱"
        rules={[
          { required: true, message: '请输入邮箱' },
          { type: 'email', message: '请输入正确的邮箱' },
        ]}>
        <Input
          prefix={<MailIcon />}
          placeholder="请输入邮箱"
          autoComplete="email"
        />
      </Form.Item>
      <Form.Item
        name="password"
        label="密码"
        rules={[
          { required: true, message: '请输入密码' },
          { pattern: /^(?=.*[a-zA-Z])(?=.*\d)(?=.*[-_])[A-Za-z\d-_]{8,}$/, message: '密码至少8位，包含字母、数字和特殊字符 (-_)' },
        ]}>
        <Input
          prefix={<LockIcon />}
          type="password"
          placeholder="请输入密码"
          autoComplete="new-password"
        />
      </Form.Item>
      <Form.Item
        name="password2"
        label="确认密码"
        validateTrigger="onBlur"
        rules={[
          { required: true, message: '请再次输入密码' },
          {
            validator: (rule, value) => {
              return new Promise((resolve, reject) => {
                if (!value) return resolve()
                if (value !== form.getFieldValue('password')) {
                  reject('两次输入的密码不一致')
                } else {
                  resolve()
                }
              })
            },
          },
        ]}>
        <Input
          prefix={<LockIcon />}
          type="password"
          placeholder="请再次输入密码"
          autoComplete="new-password"
        />
      </Form.Item>
      <Button
        block
        type="primary"
        htmlType="submit"
        loading={submitting}
        disabled={submitting}
        style={{ height: 38, fontWeight: 600 }}>
        注册
      </Button>
      <span className="auth__foot">
        已有账户？
        <button
          type="button"
          className="auth__switch t-primary w-medium"
          onClick={() => navigate('/login?type=login')}>
          {' '}
          去登录
        </button>
      </span>
    </Form>
  )
}

export default function Page({ actionData }) {
  const { message } = App.useApp()
  let [searchParams] = useSearchParams()
  const [type, setType] = useState('login')
  const setUser = useUserStore((state) => state.setUser)
  const setRoles = useUserStore((state) => state.setRoles)
  const setMenus = useUserStore((state) => state.setMenus)
  const setPermissions = useUserStore((state) => state.setPermissions)
  const navigate = useNavigate()

  const setProfile = async () => {
    const [err, res] = await profile()
    if (res?.data) {
      const { roles, permissions, menus } = res.data
      setRoles(roles)
      setMenus(menus)
      setPermissions(permissions)
    }
    return null
  }

  useEffect(() => {
    const type = searchParams.get('type')
    if (type && ['login', 'register'].includes(type)) {
      setType(type)
    }
  }, [searchParams])

  useEffect(() => {
    if (!actionData) return
    message.success(type === 'login' ? '登录成功，欢迎回来' : '注册成功，请登录')
    const go = async () => {
      if (type === 'login') {
        setUser(actionData)
        // 等角色/菜单写入 store 再进主界面，避免首帧空菜单
        await setProfile()
        navigate('/workspace')
      }
      if (type === 'register') {
        setType('login')
      }
    }
    go()
  }, [actionData])

  return (
    <div className="auth h-full w-full">
      <AuthBrandPanel type={type} />
      <div className="auth__panel">{type === 'login' ? <LoginPanel /> : <RegisterPanel />}</div>
    </div>
  )
}
