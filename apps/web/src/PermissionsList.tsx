import {useEffect, useState} from 'react'
import {Banner, Label, Select, Spinner, Stack, Text, VisuallyHidden} from '@primer/react'
import {Blankslate, DataTable, Table} from '@primer/react/experimental'
import {ApiError, request} from './api'
import type {User} from './api'

type PermissionUser = User & {hasPassword: boolean; password: string | null; passwordAvailable: boolean}

type PermissionsListProps = {
  user: User
  onUserChange: (user: User) => void
}

export default function PermissionsList({user, onUserChange}: PermissionsListProps) {
  const [users, setUsers] = useState<PermissionUser[]>([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const canManage = user.username === 'admin' || user.role === 'admin'

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')
    request<{users: PermissionUser[]}>('/api/users', {signal: controller.signal})
      .then(data => {
        if (controller.signal.aborted) return
        setUsers(data.users)
        const currentUser = data.users.find(row => row.id === user.id)
        if (currentUser) onUserChange({id: currentUser.id, phone: currentUser.phone, username: currentUser.username, role: currentUser.role})
      })
      .catch(error => {
        if (controller.signal.aborted) return
        if (error instanceof ApiError && error.status === 401) {
          setUsers([])
          window.location.replace('/login')
          return
        }
        setError(error instanceof Error ? error.message : '读取用户列表失败，请重试。')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [user.id, onUserChange])

  async function changeRole(target: PermissionUser, role: string) {
    if (!canManage || target.username === 'admin' || savingId || loading) return
    setSavingId(target.id)
    setError('')
    try {
      const {user: updated} = await request<{user: PermissionUser}>(`/api/users/${target.id}/role`, {
        method: 'PATCH',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({role}),
      })
      setUsers(current => current.map(row => row.id === updated.id ? {...updated, password: row.password} : row))
      if (updated.id === user.id) onUserChange({id: updated.id, phone: updated.phone, username: updated.username, role: updated.role})
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        window.location.replace('/login')
        return
      }
      setError(error instanceof Error ? error.message : '修改权限失败，请重试。')
      if (error instanceof ApiError && error.status === 403) {
        try {
          const session = await request<{user: User}>('/api/auth/me')
          onUserChange(session.user)
        } catch (sessionError) {
          if (sessionError instanceof ApiError && sessionError.status === 401) window.location.replace('/login')
        }
      }
    } finally {
      setSavingId(null)
    }
  }

  return (
    <Stack gap="normal">
      {error && <Banner variant="critical" layout="compact" title={error} role="alert" />}
      {loading ? <Spinner srText="正在读取用户权限" /> : users.length === 0 ? !error && (
        <Blankslate border size="small">
          <Blankslate.Heading as="h2">暂无账户</Blankslate.Heading>
        </Blankslate>
      ) : (
        <>
          <VisuallyHidden id="permissions-table-label">账户及访问权限</VisuallyHidden>
          <Table.Container className="permissions-table">
            <DataTable
              aria-labelledby="permissions-table-label"
              data={users}
              columns={[
                {header: '账户', field: 'username', renderCell: row => row.username ?? row.phone},
                {header: '手机号', field: 'phone', renderCell: row => row.phone ?? '—'},
                {
                  header: '密码',
                  field: 'password',
                  renderCell: row => row.password !== null
                    ? <Text className="permissions-password" whiteSpace="pre-wrap">{row.password}</Text>
                    : <Text>{!row.hasPassword ? '未设置' : row.passwordAvailable ? '暂不可显示' : '重新登录后可显示'}</Text>,
                },
                {header: '当前权限', field: 'role', renderCell: row => <Label variant={row.role === 'admin' ? 'accent' : 'secondary'}>{row.role === 'admin' ? '管理员' : '仅查看'}</Label>},
                {
                  header: '操作',
                  field: 'id',
                  renderCell: row => (
                    <Select
                      size="small"
                      className="permissions-role-select"
                      aria-label={`${row.username ?? row.phone}的权限`}
                      title={row.username === 'admin' ? '内置 admin 账户权限固定' : !canManage ? '仅管理员可修改权限' : undefined}
                      value={row.role}
                      disabled={!canManage || row.username === 'admin' || !!savingId}
                      aria-busy={savingId === row.id}
                      onChange={event => {void changeRole(row, event.currentTarget.value)}}
                    >
                      <Select.Option value="admin">管理员</Select.Option>
                      <Select.Option value="user">仅查看</Select.Option>
                    </Select>
                  ),
                },
              ]}
            />
          </Table.Container>
        </>
      )}
    </Stack>
  )
}
