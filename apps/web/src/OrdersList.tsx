import {useEffect, useState} from 'react'
import {Banner, Button, Label, Pagination, Stack, Text, VisuallyHidden} from '@primer/react'
import {Blankslate, DataTable, Table} from '@primer/react/experimental'
import type {Column} from '@primer/react/experimental'
import {DownloadIcon, PackageIcon} from '@primer/octicons-react'
import {ApiError, request} from './api'
import './OrdersList.css'

type Order = {
  id: string
  orderNo: string
  customerName: string
  customerPhone: string
  items: {name: string; specification: string; quantity: number}[]
  status: 'pending' | 'processing' | 'shipped' | 'completed' | 'cancelled' | 'refunded'
  paymentMethod: 'wechat' | 'alipay' | 'bank_card' | null
  paymentStatus: 'unpaid' | 'paid' | 'refunded'
  channel: 'web' | 'app' | 'wechat'
  totalAmount: number
  createdAt: string
}

const statuses = {
  pending: {text: '待付款', variant: 'attention'},
  processing: {text: '待发货', variant: 'accent'},
  shipped: {text: '已发货', variant: 'accent'},
  completed: {text: '已完成', variant: 'success'},
  cancelled: {text: '已取消', variant: 'secondary'},
  refunded: {text: '已退款', variant: 'done'},
} as const
const paymentStatuses = {unpaid: '未支付', paid: '已支付', refunded: '已退款'}
const paymentMethods = {wechat: '微信支付', alipay: '支付宝', bank_card: '银行卡'}
const channels = {web: '网页商城', app: '移动应用', wechat: '微信小程序'}
const currencyFormatter = new Intl.NumberFormat('zh-CN', {style: 'currency', currency: 'CNY'})
const dateFormatter = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  hour12: false, timeZone: 'Asia/Shanghai',
})
const pageSize = 20

function money(amount: number) {
  return currencyFormatter.format(amount / 100)
}

function date(value: string) {
  return dateFormatter.format(new Date(value))
}

export default function OrdersList() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [exportError, setExportError] = useState('')
  const [exporting, setExporting] = useState(false)
  const [page, setPage] = useState(1)

  useEffect(() => {
    const controller = new AbortController()
    request<{orders: Order[]}>('/api/orders', {signal: controller.signal})
      .then(data => {
        if (!controller.signal.aborted) setOrders(data.orders)
      })
      .catch(error => {
        if (controller.signal.aborted) return
        if (error instanceof ApiError && error.status === 401) {
          window.location.replace('/login')
          return
        }
        setError(error instanceof Error ? error.message : '读取订单失败，请重试。')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [])

  async function exportOrders() {
    if (exporting) return
    setExporting(true)
    setExportError('')
    try {
      const response = await fetch('/api/orders/export', {credentials: 'same-origin', cache: 'no-store'})
      if (!response.ok) {
        if (response.status === 401) {
          window.location.replace('/login')
          return
        }
        const data = await response.json().catch(() => null)
        throw new ApiError(data?.error || '导出失败，请稍后重试。', response.status)
      }
      const url = URL.createObjectURL(await response.blob())
      const link = document.createElement('a')
      link.href = url
      const today = new Intl.DateTimeFormat('sv-SE', {timeZone: 'Asia/Shanghai'}).format(new Date())
      link.download = `orders-${today}.xlsx`
      document.body.append(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (error) {
      setExportError(error instanceof ApiError ? error.message : '导出失败，请检查网络后重试。')
    } finally {
      setExporting(false)
    }
  }

  const columns: Column<Order>[] = [
    {header: '订单', field: 'orderNo', width: '160px', renderCell: order => <div className="order-cell"><Text weight="medium">{order.orderNo}</Text><Text size="small" className="order-muted">{date(order.createdAt)}</Text></div>},
    {header: '客户', field: 'customerName', width: '136px', renderCell: order => <div className="order-cell"><Text>{order.customerName}</Text><Text size="small" className="order-muted">{order.customerPhone}</Text></div>},
    {header: '商品', field: 'items', width: 'growCollapse', minWidth: '168px', renderCell: order => <div className="order-cell"><Text className="order-product-name">{order.items[0]?.name ?? '—'}</Text><Text size="small" className="order-muted">{order.items.length > 1 ? `${order.items.length} 种商品 · ` : `${order.items[0]?.specification ?? ''} · `}{order.items.reduce((total, item) => total + item.quantity, 0)} 件</Text></div>},
    {header: '金额', field: 'totalAmount', width: '112px', align: 'end', renderCell: order => <div className="order-cell order-amount"><Text weight="semibold">{money(order.totalAmount)}</Text><Text size="small" className="order-muted">{paymentStatuses[order.paymentStatus]}</Text></div>},
    {header: '状态', field: 'status', width: '92px', renderCell: order => <Label variant={statuses[order.status].variant}>{statuses[order.status].text}</Label>},
    {header: '支付与来源', field: 'paymentMethod', width: '112px', renderCell: order => <div className="order-cell"><Text>{order.paymentMethod ? paymentMethods[order.paymentMethod] : '—'}</Text><Text size="small" className="order-muted">{channels[order.channel]}</Text></div>},
  ]

  return (
    <Stack gap="normal" className="orders-page">
      <div className="orders-toolbar">
        <Button leadingVisual={DownloadIcon} onClick={() => {void exportOrders()}} disabled={loading || !orders.length || exporting} loading={exporting} loadingAnnouncement="正在导出订单">导出 Excel</Button>
      </div>
      {(error || exportError) && <Banner variant="critical" layout="compact" title={error || exportError} role="alert" />}
      {loading ? (
        <Table.Container className="orders-table" aria-busy="true" aria-label="正在读取订单">
          <Table.Skeleton columns={columns} rows={8} />
        </Table.Container>
      ) : orders.length > 0 ? (
        <>
          <VisuallyHidden id="orders-table-label">订单明细</VisuallyHidden>
          <Table.Container className="orders-table">
            <DataTable aria-labelledby="orders-table-label" data={orders.slice((page - 1) * pageSize, page * pageSize)} columns={columns} />
          </Table.Container>
          {orders.length > pageSize && <Pagination aria-label="订单分页" currentPage={page} pageCount={Math.ceil(orders.length / pageSize)} hrefBuilder={() => '/orders'} onPageChange={(event, nextPage) => {event.preventDefault(); setPage(nextPage)}} />}
        </>
      ) : !error && (
        <Blankslate border>
          <Blankslate.Visual><PackageIcon size={24} /></Blankslate.Visual>
          <Blankslate.Heading as="h2">暂无订单</Blankslate.Heading>
          <Blankslate.Description>订单记录将在这里显示。</Blankslate.Description>
        </Blankslate>
      )}
    </Stack>
  )
}
