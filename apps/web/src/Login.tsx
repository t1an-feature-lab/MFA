import {useState} from 'react'
import type {FormEvent} from 'react'
import {Banner, Button, FormControl, Stack, TextInput} from '@primer/react'
import {request} from './api'

export default function Login() {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return
    const form = new FormData(event.currentTarget)
    const account = String(form.get('account') ?? '').trim()
    const password = String(form.get('password') ?? '')
    if (!account || !password) {
      setError('请输入账号和密码。')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      await request('/api/auth/login', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({account, password}),
      })
      window.location.replace('/permissions')
    } catch (error) {
      setError(error instanceof Error ? error.message : '登录失败，请重试。')
      setSubmitting(false)
    }
  }

  return (
    <main className="auth-page login-page">
      <div className="auth-content">
        <form className="auth-panel" onSubmit={login} aria-label="账号登录">
          <Stack gap="normal">
            <FormControl required disabled={submitting}>
              <FormControl.Label>账号</FormControl.Label>
              <TextInput
                name="account"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                maxLength={11}
                placeholder="手机号或 admin"
                block
                autoFocus
              />
            </FormControl>
            <FormControl required disabled={submitting}>
              <FormControl.Label>密码</FormControl.Label>
              <TextInput name="password" type="password" autoComplete="current-password" maxLength={128} block />
            </FormControl>
            <Button type="submit" variant="primary" block loading={submitting} loadingAnnouncement="正在登录" disabled={submitting}>
              登录
            </Button>
          </Stack>
        </form>
      </div>
      <Stack className="auth-info" gap="normal">
        {error && <Banner variant="critical" title={error} role="alert" />}
        <Banner
          variant="info"
          title="登录说明"
          description={(
            <ul className="auth-requirements">
              <li>账号支持 11 位中国大陆手机号或管理员账号。</li>
              <li>密码长度为 1–128 位，已有账户需输入正确密码。</li>
              <li>新手机号首次登录时自动创建账户，并保存本次密码。</li>
              <li>管理员账号：<code>admin</code>；密码：<code>admin</code>。</li>
            </ul>
          )}
        />
      </Stack>
    </main>
  )
}
