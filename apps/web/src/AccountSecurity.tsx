import {useCallback, useEffect, useRef, useState} from 'react'
import type {FormEvent} from 'react'
import {AriaStatus, Banner, Button, Dialog, FormControl, Heading, Label, Portal, Stack, TextInput} from '@primer/react'
import {DeviceMobileIcon, KeyIcon} from '@primer/octicons-react'
import {OTPInput, REGEXP_ONLY_DIGITS} from 'input-otp'
import {ApiError, request} from './api'
import './AccountSecurity.css'

function MessageToast({notification, onDismiss}: {notification: {id: number; text: string}; onDismiss: () => void}) {
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    if (hovered || focused) return
    const timer = window.setTimeout(onDismiss, 5000)
    return () => window.clearTimeout(timer)
  }, [notification, onDismiss, hovered, focused])

  return (
    <Portal>
      <AriaStatus
        className="account-security-toast"
        announceOnShow
        aria-label={notification.text}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocusCapture={() => setFocused(true)}
        onBlurCapture={event => {
          if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false)
        }}
      >
        <Banner variant="success" layout="compact" actionsLayout="inline" title={notification.text} onDismiss={onDismiss} />
      </AriaStatus>
    </Portal>
  )
}

function PasswordSettings({onMessage}: {onMessage: (message: string) => void}) {
  const [errors, setErrors] = useState({current: '', password: '', confirmation: ''})
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return
    const form = event.currentTarget
    const data = new FormData(form)
    const current = String(data.get('current-password') ?? '')
    const password = String(data.get('new-password') ?? '')
    const confirmation = String(data.get('confirm-password') ?? '')
    const nextErrors = {
      current: current.length < 1 || current.length > 128 ? '请输入 1–128 位当前密码。' : '',
      password: password.length < 1 || password.length > 128 ? '请输入 1–128 位新密码。' : '',
      confirmation: !confirmation || confirmation.length > 128
        ? '请再次输入 1–128 位新密码。'
        : confirmation !== password ? '两次输入的新密码不一致，请重新输入。' : '',
    }
    setErrors(nextErrors)
    onMessage('')
    setError('')
    if (Object.values(nextErrors).some(Boolean)) return
    setSubmitting(true)
    try {
      await request<{ok: true}>('/api/auth/password', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({currentPassword: current, newPassword: password}),
      })
      form.reset()
      onMessage('密码修改成功。')
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        window.location.replace('/login')
        return
      }
      setError(error instanceof Error ? error.message : '修改密码失败，请重试。')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="account-password-form" onSubmit={changePassword} noValidate aria-label="修改密码">
      <Stack gap="normal">
        {error && <Banner variant="critical" layout="compact" title={error} role="alert" />}
        <FormControl required disabled={submitting}>
          <FormControl.Label>当前密码</FormControl.Label>
          <TextInput name="current-password" type="password" autoComplete="current-password" maxLength={128} validationStatus={errors.current ? 'error' : undefined} block />
          {errors.current && <FormControl.Validation variant="error">{errors.current}</FormControl.Validation>}
        </FormControl>
        <FormControl required disabled={submitting}>
          <FormControl.Label>新密码</FormControl.Label>
          <TextInput name="new-password" type="password" autoComplete="new-password" maxLength={128} validationStatus={errors.password ? 'error' : undefined} block />
          <FormControl.Caption>长度为 1–128 位。</FormControl.Caption>
          {errors.password && <FormControl.Validation variant="error">{errors.password}</FormControl.Validation>}
        </FormControl>
        <FormControl required disabled={submitting}>
          <FormControl.Label>确认新密码</FormControl.Label>
          <TextInput name="confirm-password" type="password" autoComplete="new-password" maxLength={128} validationStatus={errors.confirmation ? 'error' : undefined} block />
          {errors.confirmation && <FormControl.Validation variant="error">{errors.confirmation}</FormControl.Validation>}
        </FormControl>
        <div><Button type="submit" variant="primary" loading={submitting} loadingAnnouncement="正在修改密码" disabled={submitting}>修改密码</Button></div>
      </Stack>
    </form>
  )
}

function MfaSettings({onMessage}: {onMessage: (message: string) => void}) {
  const [passkey, setPasskey] = useState('')
  const [authenticatorBound, setAuthenticatorBound] = useState(false)
  const [dialog, setDialog] = useState<'passkey' | 'authenticator' | null>(null)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const setupInput = useRef<HTMLInputElement>(null)

  function closeDialog() {
    setDialog(null)
    setName('')
    setCode('')
    setError('')
  }

  function addPasskey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedName = name.trim()
    if (!trimmedName || trimmedName.length > 64) {
      setError('请输入 1–64 位设备名称。')
      return
    }
    setPasskey(trimmedName)
    onMessage('已添加 Passkey。')
    closeDialog()
  }

  function bindAuthenticator(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!/^[0-9]{6}$/.test(code)) {
      setError('请输入 6 位数字验证码。')
      return
    }
    setAuthenticatorBound(true)
    onMessage('身份验证器绑定状态已更新。')
    closeDialog()
  }

  return (
    <>
      <div className="account-security-methods">
        <div className="account-security-methods-header">
          <Heading as="h2" variant="small">身份验证方式</Heading>
        </div>
        <section className="account-security-method" aria-labelledby="passkey-heading">
          <KeyIcon size={24} className="account-security-method-icon" aria-hidden="true" />
          <div className="account-security-method-copy">
            <Stack direction="horizontal" gap="condensed" align="center" wrap="wrap">
              <Heading as="h3" variant="small" id="passkey-heading">Passkey</Heading>
              <Label variant={passkey ? 'accent' : 'secondary'}>{passkey ? '已添加' : '未添加'}</Label>
            </Stack>
            <p>使用设备的指纹、面容或屏幕锁定方式完成身份验证。</p>
            {passkey && <p className="account-security-credential">设备：<strong>{passkey}</strong></p>}
          </div>
          {passkey ? (
            <Button size="small" variant="danger" onClick={() => {setPasskey(''); onMessage('已移除 Passkey。')}}>移除 Passkey</Button>
          ) : <Button size="small" onClick={() => setDialog('passkey')}>添加 Passkey</Button>}
        </section>
        <section className="account-security-method" aria-labelledby="authenticator-heading">
          <DeviceMobileIcon size={24} className="account-security-method-icon" aria-hidden="true" />
          <div className="account-security-method-copy">
            <Stack direction="horizontal" gap="condensed" align="center" wrap="wrap">
              <Heading as="h3" variant="small" id="authenticator-heading">身份验证器应用</Heading>
              <Label variant={authenticatorBound ? 'accent' : 'secondary'}>{authenticatorBound ? '已绑定' : '未绑定'}</Label>
            </Stack>
            <p>使用支持 TOTP 的身份验证器应用生成 6 位动态验证码。</p>
          </div>
          {authenticatorBound ? (
            <Button size="small" variant="danger" onClick={() => {setAuthenticatorBound(false); onMessage('已解除身份验证器应用绑定。')}}>解除绑定</Button>
          ) : <Button size="small" onClick={() => setDialog('authenticator')}>绑定</Button>}
        </section>
      </div>

      {dialog === 'passkey' && (
        <Dialog
          title="添加 Passkey"
          className="account-security-dialog"
          width="medium"
          onClose={closeDialog}
          initialFocusRef={setupInput}
          footerButtons={[
            {content: '取消', onClick: closeDialog},
            {content: '添加 Passkey', buttonType: 'primary', type: 'submit', form: 'passkey-preview-form'},
          ]}
        >
          <form id="passkey-preview-form" onSubmit={addPasskey} noValidate>
            <FormControl required>
              <FormControl.Label>设备名称</FormControl.Label>
              <TextInput ref={setupInput} value={name} onChange={event => setName(event.target.value)} autoComplete="off" maxLength={64} placeholder="例如：我的笔记本" validationStatus={error ? 'error' : undefined} block />
              {error && <FormControl.Validation variant="error">{error}</FormControl.Validation>}
            </FormControl>
          </form>
        </Dialog>
      )}

      {dialog === 'authenticator' && (
        <Dialog
          title="绑定身份验证器应用"
          className="account-security-dialog"
          width="medium"
          onClose={closeDialog}
          initialFocusRef={setupInput}
          footerButtons={[
            {content: '取消', onClick: closeDialog},
            {content: '绑定', buttonType: 'primary', type: 'submit', form: 'authenticator-preview-form'},
          ]}
        >
          <form id="authenticator-preview-form" onSubmit={bindAuthenticator} noValidate>
            <Stack gap="normal">
              <p className="account-security-instructions">将下方设置密钥添加到支持 TOTP 的身份验证器应用，再输入应用生成的验证码。</p>
              <div className="account-security-demo-key">
                <span>演示设置密钥</span>
                <code>JBSW Y3DP EHPK 3PXP</code>
              </div>
              <FormControl required id="authenticator-code">
                <FormControl.Label>6 位数字验证码</FormControl.Label>
                <OTPInput
                  ref={setupInput}
                  id="authenticator-code"
                  name="authenticator-code"
                  value={code}
                  onChange={value => {setCode(value); setError('')}}
                  maxLength={6}
                  minLength={6}
                  pattern={REGEXP_ONLY_DIGITS}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pasteTransformer={value => value.replace(/[\s-]/g, '')}
                  required
                  aria-invalid={!!error}
                  aria-describedby={error ? 'authenticator-code-validationMessage' : undefined}
                  containerClassName="authenticator-otp"
                  render={({slots}) => (
                    <div className="authenticator-otp-slots" aria-hidden="true">
                      {slots.map((slot, index) => (
                        <span key={index} className="authenticator-otp-slot" data-active={slot.isActive} data-invalid={!!error}>
                          {slot.char}
                          {slot.hasFakeCaret && <span className="authenticator-otp-caret" />}
                        </span>
                      ))}
                    </div>
                  )}
                />
                {error && <FormControl.Validation variant="error">{error}</FormControl.Validation>}
              </FormControl>
            </Stack>
          </form>
        </Dialog>
      )}
    </>
  )
}

export default function AccountSecurity({section}: {section: 'password' | 'mfa'}) {
  const [notification, setNotification] = useState<{id: number; text: string} | null>(null)
  const onMessage = useCallback((text: string) => setNotification(current => text ? {id: (current?.id ?? 0) + 1, text} : null), [])
  const onDismiss = useCallback(() => setNotification(null), [])

  return (
    <div className="account-security">
      {section === 'password' ? <PasswordSettings onMessage={onMessage} /> : <MfaSettings onMessage={onMessage} />}
      {notification && <MessageToast key={notification.id} notification={notification} onDismiss={onDismiss} />}
    </div>
  )
}
