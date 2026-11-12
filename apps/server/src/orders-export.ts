import ExcelJS from 'exceljs'
import type { Order } from './orders.js'

const orderStatus = { pending: '待付款', processing: '待发货', shipped: '已发货', completed: '已完成', cancelled: '已取消', refunded: '已退款' }
const paymentStatus = { unpaid: '未付款', paid: '已付款', refunded: '已退款' }
const paymentMethod = { wechat: '微信支付', alipay: '支付宝', bank_card: '银行卡' }
const channel = { web: '网页商城', app: '手机 App', wechat: '微信小程序' }

function beijingDate(value: string | null) {
  return value ? new Date(new Date(value).getTime() + 8 * 60 * 60 * 1000) : null
}

function styleWorksheet(sheet: ExcelJS.Worksheet) {
  sheet.views = [{ state: 'frozen', xSplit: 2, ySplit: 1, showGridLines: false }]
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: sheet.rowCount, column: sheet.columnCount } }
  sheet.eachRow((row, rowNumber) => {
    row.height = rowNumber === 1 ? 32 : Math.max(24, row.height ?? 24)
    row.eachCell({ includeEmpty: true }, cell => {
      cell.font = { name: 'Calibri', size: 11, color: { argb: rowNumber === 1 ? 'FF59636E' : 'FF1F2328' }, bold: rowNumber === 1 }
      cell.alignment = { vertical: 'middle', wrapText: true, horizontal: typeof cell.value === 'number' ? 'right' : 'left' }
      cell.border = { bottom: { style: 'thin', color: { argb: 'FFD1D9E0' } } }
      if (rowNumber === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF6F8FA' } }
    })
  })
}

export async function createOrdersWorkbook(orders: Order[]): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook()
  const details = workbook.addWorksheet('订单明细')
  details.columns = [
    { header: '订单号', key: 'orderNo', width: 24 },
    { header: '客户姓名', key: 'customerName', width: 16 },
    { header: '客户手机号', key: 'customerPhone', width: 18 },
    { header: '客户邮箱', key: 'customerEmail', width: 32 },
    { header: '商品及规格', key: 'items', width: 56 },
    { header: '订单状态', key: 'status', width: 14 },
    { header: '支付状态', key: 'paymentStatus', width: 14 },
    { header: '支付方式', key: 'paymentMethod', width: 16 },
    { header: '订单来源', key: 'channel', width: 16 },
    { header: '商品金额（元）', key: 'subtotal', width: 18 },
    { header: '优惠金额（元）', key: 'discountAmount', width: 18 },
    { header: '运费（元）', key: 'shippingFee', width: 16 },
    { header: '应付金额（元）', key: 'totalAmount', width: 18 },
    { header: '实付金额（元）', key: 'paidAmount', width: 18 },
    { header: '退款金额（元）', key: 'refundAmount', width: 18 },
    { header: '币种', key: 'currency', width: 10 },
    { header: '收货人', key: 'recipientName', width: 16 },
    { header: '收货手机号', key: 'recipientPhone', width: 18 },
    { header: '省份', key: 'province', width: 14 },
    { header: '城市', key: 'city', width: 14 },
    { header: '区县', key: 'district', width: 14 },
    { header: '详细地址', key: 'address', width: 40 },
    { header: '邮政编码', key: 'postalCode', width: 14 },
    { header: '物流公司', key: 'shippingCompany', width: 16 },
    { header: '物流单号', key: 'trackingNo', width: 26 },
    { header: '下单时间（北京时间）', key: 'createdAt', width: 27 },
    { header: '付款时间（北京时间）', key: 'paidAt', width: 27 },
    { header: '发货时间（北京时间）', key: 'shippedAt', width: 27 },
    { header: '完成时间（北京时间）', key: 'completedAt', width: 27 },
    { header: '取消时间（北京时间）', key: 'cancelledAt', width: 27 },
    { header: '退款时间（北京时间）', key: 'refundedAt', width: 27 },
    { header: '订单备注', key: 'note', width: 36 },
    { header: '订单 ID', key: 'id', width: 38 },
  ]

  const products = workbook.addWorksheet('商品明细')
  products.columns = [
    { header: '订单号', key: 'orderNo', width: 24 },
    { header: '商品 SKU', key: 'sku', width: 22 },
    { header: '商品名称', key: 'name', width: 32 },
    { header: '商品规格', key: 'specification', width: 28 },
    { header: '数量', key: 'quantity', width: 10 },
    { header: '单价（元）', key: 'unitPrice', width: 16 },
    { header: '商品小计（元）', key: 'lineTotal', width: 18 },
  ]

  for (const order of orders) {
    const row = details.addRow({
      ...order,
      items: order.items.map(item => `${item.name} / ${item.specification} × ${item.quantity}`).join('\n'),
      status: orderStatus[order.status],
      paymentStatus: paymentStatus[order.paymentStatus],
      paymentMethod: order.paymentMethod ? paymentMethod[order.paymentMethod] : '—',
      channel: channel[order.channel],
      subtotal: order.subtotal / 100,
      discountAmount: order.discountAmount / 100,
      shippingFee: order.shippingFee / 100,
      totalAmount: order.totalAmount / 100,
      paidAmount: order.paidAmount / 100,
      refundAmount: order.refundAmount / 100,
      createdAt: beijingDate(order.createdAt),
      paidAt: beijingDate(order.paidAt),
      shippedAt: beijingDate(order.shippedAt),
      completedAt: beijingDate(order.completedAt),
      cancelledAt: beijingDate(order.cancelledAt),
      refundedAt: beijingDate(order.refundedAt),
    })
    row.height = Math.max(24, order.items.length * 18 + 8)
    for (const item of order.items) {
      products.addRow({ ...item, orderNo: order.orderNo, unitPrice: item.unitPrice / 100, lineTotal: item.quantity * item.unitPrice / 100 })
    }
  }

  for (const key of ['orderNo', 'customerPhone', 'recipientPhone', 'postalCode', 'trackingNo', 'id']) details.getColumn(key).numFmt = '@'
  for (const key of ['subtotal', 'discountAmount', 'shippingFee', 'totalAmount', 'paidAmount', 'refundAmount']) details.getColumn(key).numFmt = '#,##0.00'
  for (const key of ['createdAt', 'paidAt', 'shippedAt', 'completedAt', 'cancelledAt', 'refundedAt']) details.getColumn(key).numFmt = 'yyyy-mm-dd hh:mm:ss'
  for (const key of ['orderNo', 'sku']) products.getColumn(key).numFmt = '@'
  for (const key of ['unitPrice', 'lineTotal']) products.getColumn(key).numFmt = '#,##0.00'
  styleWorksheet(details)
  styleWorksheet(products)
  return new Uint8Array(await workbook.xlsx.writeBuffer())
}
