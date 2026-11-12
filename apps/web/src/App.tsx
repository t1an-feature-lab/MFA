import {useEffect, useState} from 'react'
import {Banner, Button, Spinner, Stack} from '@primer/react'
import {Navigate, Route, Routes, useLocation} from 'react-router'
import {ApiError, request} from './api'
import type {User} from './api'
import Login from './Login'
import AdminShell from './AdminShell'
import AccountSecurity from './AccountSecurity'
import PermissionsList from './PermissionsList'
import OrdersList from './OrdersList'

export default function App() {
  const [user, setUser] = useState<User | null>()
  const [error, setError] = useState('')
  const [loggingOut, setLoggingOut] = useState(false)
  const {pathname} = useLocation()

  useEffect(() => {
    const controller = new AbortController()

    async function checkSession() {
      try {
        const {user} = await request<{user: User}>('/api/auth/me', {signal: controller.signal})
        if (controller.signal.aborted) return
        setUser(user)
        setError('')
      } catch (error) {
        if (controller.signal.aborted) return
        setUser(null)
        if (error instanceof ApiError && error.status === 401) {
          setError('')
        } else {
          setError(error instanceof Error ? error.message : '检查登录状态失败，请重试。')
        }
      }
    }

    function onPageShow(event: PageTransitionEvent) {
      if (event.persisted) void checkSession()
    }

    void checkSession()
    window.addEventListener('focus', checkSession)
    window.addEventListener('pageshow', onPageShow)
    return () => {
      controller.abort()
      window.removeEventListener('focus', checkSession)
      window.removeEventListener('pageshow', onPageShow)
    }
  }, [])

  useEffect(() => {
    if (!user) document.title = '登录 · MFA'
  }, [user])

  async function logout() {
    if (loggingOut) return
    setLoggingOut(true)
    setError('')
    try {
      await request('/api/auth/logout', {method: 'POST'})
      window.location.replace('/login')
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        window.location.replace('/login')
        return
      }
      setError(error instanceof Error ? error.message : '退出登录失败，请重试。')
      setLoggingOut(false)
    }
  }

  if (user === undefined) {
    return (
      <main className="auth-page">
        <Spinner srText="正在检查登录状态" />
      </main>
    )
  }

  if (!user) {
    if (error) {
      return (
        <main className="auth-page">
          <Stack className="auth-content" gap="normal">
            <Banner variant="critical" title="暂时无法登录" description={error} role="alert" />
            <Button block onClick={() => window.location.reload()}>重试</Button>
          </Stack>
        </main>
      )
    }
    if (pathname !== '/login') return <Navigate to="/login" replace />
    return <Login />
  }

  return (
    <Routes>
      <Route element={<AdminShell user={user} error={error} onLogout={logout} loggingOut={loggingOut} />}>
        <Route path="/permissions" element={<PermissionsList user={user} onUserChange={setUser} />} />
        <Route path="/orders" element={<OrdersList />} />
        <Route path="/security/password" element={<AccountSecurity section="password" />} />
        <Route path="/security/mfa" element={<AccountSecurity section="mfa" />} />
      </Route>
      <Route path="*" element={<Navigate to="/permissions" replace />} />
    </Routes>
  )
}
