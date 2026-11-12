import { randomUUID } from 'node:crypto'
import type { Pool } from 'pg'

export type OrderItem = {
  sku: string
  name: string
  specification: string
  quantity: number
  unitPrice: number
}

export type Order = {
  id: string
  orderNo: string
  customerName: string
  customerPhone: string
  customerEmail: string
  items: OrderItem[]
  status: 'pending' | 'processing' | 'shipped' | 'completed' | 'cancelled' | 'refunded'
  paymentMethod: 'wechat' | 'alipay' | 'bank_card' | null
  paymentStatus: 'unpaid' | 'paid' | 'refunded'
  channel: 'web' | 'app' | 'wechat'
  subtotal: number
  discountAmount: number
  shippingFee: number
  totalAmount: number
  paidAmount: number
  refundAmount: number
  currency: 'CNY'
  recipientName: string
  recipientPhone: string
  province: string
  city: string
  district: string
  address: string
  postalCode: string
  shippingCompany: string | null
  trackingNo: string | null
  createdAt: string
  paidAt: string | null
  shippedAt: string | null
  completedAt: string | null
  cancelledAt: string | null
  refundedAt: string | null
  note: string
}

const fields = [
  'id', 'orderNo', 'customerName', 'customerPhone', 'customerEmail', 'items', 'status',
  'paymentMethod', 'paymentStatus', 'channel', 'subtotal', 'discountAmount', 'shippingFee',
  'totalAmount', 'paidAmount', 'refundAmount', 'currency', 'recipientName', 'recipientPhone',
  'province', 'city', 'district', 'address', 'postalCode', 'shippingCompany', 'trackingNo',
  'createdAt', 'paidAt', 'shippedAt', 'completedAt', 'cancelledAt', 'refundedAt', 'note',
] as const satisfies readonly (keyof Order)[]
const columns = fields.map(field => field.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`))

export function createDemoOrders(now = new Date()): Order[] {
  const products = [
    {sku: 'KB-001', name: '无线机械键盘', specification: '雾白 / 茶轴', unitPrice: 32900},
    {sku: 'MS-002', name: '静音无线鼠标', specification: '石墨黑 / 双模', unitPrice: 12900},
    {sku: 'HB-003', name: '多功能扩展坞', specification: '深空灰 / 7 合 1', unitPrice: 23900},
    {sku: 'CP-004', name: '不锈钢保温杯', specification: '奶油白 / 500ml', unitPrice: 8900},
    {sku: 'BG-005', name: '轻量通勤双肩包', specification: '炭黑 / 20L', unitPrice: 25900},
    {sku: 'LP-006', name: '桌面护眼台灯', specification: '暖白 / 可调光', unitPrice: 19900},
    {sku: 'ST-007', name: '铝合金笔记本支架', specification: '银色 / 可折叠', unitPrice: 15900},
    {sku: 'CB-008', name: 'USB-C 快充线', specification: '编织灰 / 2 米', unitPrice: 5900},
    {sku: 'HP-009', name: '无线降噪耳机', specification: '午夜黑 / 标准版', unitPrice: 59900},
    {sku: 'NT-010', name: '方格笔记本套装', specification: '原木色 / A5 三册', unitPrice: 4500},
  ]
  const addresses = [
    ['浙江省', '杭州市', '西湖区', '310000'],
    ['上海市', '上海市', '徐汇区', '200030'],
    ['北京市', '北京市', '海淀区', '100080'],
    ['广东省', '深圳市', '南山区', '518000'],
    ['江苏省', '南京市', '鼓楼区', '210000'],
    ['四川省', '成都市', '武侯区', '610000'],
    ['湖北省', '武汉市', '洪山区', '430070'],
    ['福建省', '厦门市', '思明区', '361000'],
  ]
  const statuses: Order['status'][] = [
    'completed', 'shipped', 'processing', 'pending', 'completed',
    'cancelled', 'shipped', 'completed', 'refunded', 'processing',
  ]
  const paymentMethods = ['wechat', 'alipay', 'bank_card'] as const
  const channels = ['web', 'app', 'wechat'] as const
  const surnames = ['陈', '林', '周', '沈', '许', '苏']
  const names = ['星予', '知夏', '沐辰', '清禾']
  const hour = 60 * 60 * 1000
  const day = 24 * hour

  return Array.from({length: 100}, (_, index) => {
    const status = statuses[index % statuses.length]
    const customer = index % 24
    const customerName = `${surnames[customer % surnames.length]}${names[Math.floor(customer / surnames.length)]}`
    const customerPhone = `1380000${String(customer + 1).padStart(4, '0')}`
    const items = Array.from({length: index % 3 + 1}, (_, itemIndex) => ({
      ...products[(index + itemIndex * 3) % products.length],
      quantity: (index + itemIndex) % 3 + 1,
    }))
    const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)
    const discountAmount = index % 4 === 0 ? Math.min(2000, Math.floor(subtotal / 10)) : 0
    const shippingFee = subtotal >= 19900 ? 0 : 1000
    const totalAmount = subtotal - discountAmount + shippingFee
    const paid = status !== 'pending' && status !== 'cancelled'
    const shipped = status === 'shipped' || status === 'completed' || status === 'refunded'
    const completed = status === 'completed' || status === 'refunded'
    const daysAgo = status === 'pending' ? index % 3 + 1
      : status === 'processing' ? index % 4 + 2
      : status === 'shipped' ? index % 7 + 3 : index % 22 + 7
    const created = now.getTime() - daysAgo * day - (index % 24) * hour
    const at = (offset: number) => new Date(created + offset).toISOString()
    const [province, city, district, postalCode] = addresses[index % addresses.length]

    return {
      id: randomUUID(),
      orderNo: `MOCK-${String(index + 1).padStart(6, '0')}`,
      customerName,
      customerPhone,
      customerEmail: `customer${String(customer + 1).padStart(2, '0')}@example.com`,
      items,
      status,
      paymentMethod: paid ? paymentMethods[index % paymentMethods.length] : null,
      paymentStatus: status === 'refunded' ? 'refunded' : paid ? 'paid' : 'unpaid',
      channel: channels[index % channels.length],
      subtotal,
      discountAmount,
      shippingFee,
      totalAmount,
      paidAmount: paid ? totalAmount : 0,
      refundAmount: status === 'refunded' ? totalAmount : 0,
      currency: 'CNY',
      recipientName: customerName,
      recipientPhone: customerPhone,
      province,
      city,
      district,
      address: `示例路 ${index % 18 + 1} 号 ${index % 8 + 1} 栋 ${index % 20 + 1}01 室`,
      postalCode,
      shippingCompany: shipped ? ['顺丰速运', '中通快递', '圆通速递'][index % 3] : null,
      trackingNo: shipped ? `MOCK-SHIP-${String(index + 1).padStart(8, '0')}` : null,
      createdAt: at(0),
      paidAt: paid ? at(10 * 60 * 1000) : null,
      shippedAt: shipped ? at(2 * day) : null,
      completedAt: completed ? at(5 * day) : null,
      cancelledAt: status === 'cancelled' ? at(hour) : null,
      refundedAt: status === 'refunded' ? at(6 * day) : null,
      note: ['请在工作日配送', '请联系收货人后送达', '不需要纸质发票', ''][index % 4],
    }
  })
}

export async function initializeOrders(database: Pool) {
  await database.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id uuid PRIMARY KEY,
      order_no text NOT NULL UNIQUE,
      customer_name text NOT NULL,
      customer_phone text NOT NULL,
      customer_email text NOT NULL,
      items jsonb NOT NULL CHECK (jsonb_typeof(items) = 'array' AND jsonb_array_length(items) > 0),
      status text NOT NULL CHECK (status IN ('pending', 'processing', 'shipped', 'completed', 'cancelled', 'refunded')),
      payment_method text CHECK (payment_method IN ('wechat', 'alipay', 'bank_card')),
      payment_status text NOT NULL CHECK (payment_status IN ('unpaid', 'paid', 'refunded')),
      channel text NOT NULL CHECK (channel IN ('web', 'app', 'wechat')),
      subtotal integer NOT NULL CHECK (subtotal >= 0),
      discount_amount integer NOT NULL CHECK (discount_amount >= 0 AND discount_amount <= subtotal),
      shipping_fee integer NOT NULL CHECK (shipping_fee >= 0),
      total_amount integer NOT NULL CHECK (total_amount = subtotal - discount_amount + shipping_fee),
      paid_amount integer NOT NULL CHECK (paid_amount >= 0 AND paid_amount <= total_amount),
      refund_amount integer NOT NULL CHECK (refund_amount >= 0 AND refund_amount <= paid_amount),
      currency text NOT NULL CHECK (currency = 'CNY'),
      recipient_name text NOT NULL,
      recipient_phone text NOT NULL,
      province text NOT NULL,
      city text NOT NULL,
      district text NOT NULL,
      address text NOT NULL,
      postal_code text NOT NULL,
      shipping_company text,
      tracking_no text,
      created_at timestamptz NOT NULL,
      paid_at timestamptz,
      shipped_at timestamptz,
      completed_at timestamptz,
      cancelled_at timestamptz,
      refunded_at timestamptz,
      note text NOT NULL DEFAULT '',
      CHECK (paid_at IS NULL OR paid_at >= created_at),
      CHECK (shipped_at IS NULL OR (paid_at IS NOT NULL AND shipped_at >= paid_at)),
      CHECK (completed_at IS NULL OR (shipped_at IS NOT NULL AND completed_at >= shipped_at)),
      CHECK (cancelled_at IS NULL OR cancelled_at >= created_at),
      CHECK (refunded_at IS NULL OR (paid_at IS NOT NULL AND refunded_at >= paid_at))
    );
  `)

  const orders = createDemoOrders()
  const values = orders.flatMap(order => fields.map(field => field === 'items' ? JSON.stringify(order.items) : order[field]))
  const placeholders = orders.map((_, row) => `(${fields.map((_, column) => `$${row * fields.length + column + 1}`).join(', ')})`)
  await database.query(
    `INSERT INTO orders (${columns.join(', ')}) VALUES ${placeholders.join(', ')} ON CONFLICT (order_no) DO NOTHING`,
    values,
  )
}

export async function readOrders(database: Pool): Promise<Order[]> {
  const projection = fields.map((field, index) => `'${field}', ${columns[index]}`).join(', ')
  const {rows} = await database.query<{data: Order}>(
    `SELECT jsonb_build_object(${projection}) AS data FROM orders ORDER BY created_at DESC, order_no ASC`,
  )
  return rows.map(row => row.data)
}
