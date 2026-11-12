export type User = {
  id: string
  phone: string | null
  username: string | null
  role: 'user' | 'admin'
}

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}

export async function request<T = unknown>(path: string, options?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(path, {credentials: 'same-origin', cache: 'no-store', ...options})
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new Error('无法连接服务，请检查网络后重试。')
  }

  if (!response.ok) {
    const data = await response.json().catch(() => null)
    throw new ApiError(data?.error || '请求失败，请稍后重试。', response.status)
  }

  return response.json()
}
