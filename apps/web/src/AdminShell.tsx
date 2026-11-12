import {useEffect, useRef, useState} from 'react'
import {ActionList, ActionMenu, Avatar, Banner, Dialog, IconButton, NavList, PageHeader, PageLayout, Stack} from '@primer/react'
import {KeyIcon, PackageIcon, ShieldLockIcon, SignOutIcon, ThreeBarsIcon} from '@primer/octicons-react'
import {Link, Outlet, useLocation} from 'react-router'
import type {User} from './api'
import avatar from './assets/avatar.svg'

const titles = {
  permissions: '权限列表',
  orders: '订单数据',
  'security/password': '修改密码',
  'security/mfa': '双重身份验证',
}

function getPage(pathname: string): keyof typeof titles {
  switch (pathname.replace(/\/+$/, '').toLowerCase()) {
    case '/orders': return 'orders'
    case '/security/password': return 'security/password'
    case '/security/mfa': return 'security/mfa'
    default: return 'permissions'
  }
}

type AdminShellProps = {
  user: User
  error: string
  onLogout: () => Promise<void>
  loggingOut: boolean
}

export default function AdminShell({user, error, onLogout, loggingOut}: AdminShellProps) {
  const {pathname} = useLocation()
  const page = getPage(pathname)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuButton = useRef<HTMLButtonElement>(null)
  const account = user.phone ?? user.username ?? '当前账户'

  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

  useEffect(() => {
    document.title = `${titles[page]} · MFA`
  }, [page])

  const sidebar = (
    <div className="admin-sidebar">
      <NavList aria-label="主导航">
        <NavList.Item as={Link} to="/permissions" aria-current={page === 'permissions' ? 'page' : undefined} onClick={() => setMenuOpen(false)}>
          <NavList.LeadingVisual><ShieldLockIcon /></NavList.LeadingVisual>
          权限列表
        </NavList.Item>
        <NavList.Item as={Link} to="/orders" aria-current={page === 'orders' ? 'page' : undefined} onClick={() => setMenuOpen(false)}>
          <NavList.LeadingVisual><PackageIcon /></NavList.LeadingVisual>
          订单数据
        </NavList.Item>
      </NavList>
      <div className="admin-account">
        <ActionMenu>
          <ActionMenu.Button
            variant="invisible"
            size="large"
            block
            alignContent="start"
            leadingVisual={<Avatar src={avatar} size={28} alt="" />}
            aria-label={`账户菜单：${account}`}
          >
            <span className="admin-account-copy">
              <span>{account}</span>
              <span className="admin-account-role">{user.role === 'admin' ? '管理员' : '仅查看'}</span>
            </span>
          </ActionMenu.Button>
          <ActionMenu.Overlay side="outside-top" align="start" width="auto" style={{minWidth: 192}}>
            <ActionList onClick={() => setMenuOpen(false)}>
              <ActionList.LinkItem as={Link} to="/security/password">
                <ActionList.LeadingVisual><KeyIcon /></ActionList.LeadingVisual>
                修改密码
              </ActionList.LinkItem>
              <ActionList.LinkItem as={Link} to="/security/mfa">
                <ActionList.LeadingVisual><ShieldLockIcon /></ActionList.LeadingVisual>
                双重身份验证
              </ActionList.LinkItem>
              <ActionList.Divider />
              <ActionList.Item variant="danger" onSelect={() => {void onLogout()}} disabled={loggingOut} loading={loggingOut}>
                <ActionList.LeadingVisual><SignOutIcon /></ActionList.LeadingVisual>
                退出登录
              </ActionList.Item>
            </ActionList>
          </ActionMenu.Overlay>
        </ActionMenu>
      </div>
    </div>
  )

  return (
    <div className="admin-shell">
      <PageLayout containerWidth="full" padding="none" columnGap="normal" className="admin-layout">
        <PageLayout.Sidebar
          aria-label="后台侧边栏"
          width={{min: '256px', default: '256px', max: '256px'}}
          padding="none"
          divider="none"
          sticky
          hidden={{narrow: true, regular: false}}
          className="admin-sidebar-region"
        >
          {sidebar}
        </PageLayout.Sidebar>
        <PageLayout.Content width="large" padding="none" className="admin-content">
          <PageHeader hasBorder>
            <PageHeader.TitleArea variant="medium">
              <PageHeader.LeadingAction hidden={{narrow: false, regular: true}}>
                <IconButton ref={menuButton} icon={ThreeBarsIcon} aria-label="打开导航菜单" onClick={() => setMenuOpen(true)} aria-expanded={menuOpen} />
              </PageHeader.LeadingAction>
              <PageHeader.Title as="h1" className="admin-page-title">{titles[page]}</PageHeader.Title>
            </PageHeader.TitleArea>
          </PageHeader>
          <Stack gap="normal" paddingBlock="spacious">
            {error && <Banner variant="critical" title={error} role="alert" />}
            <Outlet />
          </Stack>
        </PageLayout.Content>
      </PageLayout>
      {menuOpen && (
        <Dialog title="后台管理" position="left" width="small" onClose={() => setMenuOpen(false)} returnFocusRef={menuButton} className="admin-mobile-dialog">
          <Dialog.Body className="admin-mobile-dialog-body">{sidebar}</Dialog.Body>
        </Dialog>
      )}
    </div>
  )
}
