import axios, {
  AxiosError,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios'
import {
  API_TIMEOUT,
  BASE_API_URL,
  DEFAULT_API_REQUEST_ERROR,
  DEFAULT_NETWORK_CONNECTIVITY_ERROR,
} from '../constants/api'
import {
  getStoredActiveUserId,
  getStoredAuthToken,
} from './session'
import { ApiRoutes } from '../services/apiRouteRegistry'

type RequestMethod = 'get' | 'post' | 'patch' | 'delete'

interface RequestOptions<TData = unknown> {
  method: RequestMethod
  endpoint: string
  data?: TData
  params?: Record<string, unknown>
  headers?: Record<string, string>
  signal?: AbortSignal
}

export interface ApiSplitParticipant {
  id: string
  userId: string
  amountOwed: number | string
  amountPaid: number | string
  status: 'pending' | 'paid' | 'partial'
  walletAddress?: string | null
}

export interface ApiSplitItem {
  id: string
  splitId: string
  name: string
  quantity: number
  unitPrice: number | string
  totalPrice: number | string
  category?: string | null
  assignedToIds: string[]
}

export interface ApiSplitRecord {
  id: string
  totalAmount: number | string
  amountPaid: number | string
  status: 'active' | 'completed' | 'partial'
  description?: string | null
  preferredCurrency?: string | null
  creatorWalletAddress?: string | null
  dueDate?: string | null
  createdAt: string
  updatedAt: string
  participants: ApiSplitParticipant[]
  items?: ApiSplitItem[]
}

export interface ApiPaymentRecord {
  id: string
  splitId: string
  participantId: string
  txHash: string
  amount: number | string
  asset: string
  status: string
  settlementStatus?: string
  createdAt: string
  updatedAt?: string
}

export interface ApiPaymentStats {
  splitId: string
  totalAmount: number | string
  totalPaid: number | string
  remainingAmount: number | string
  paymentCount: number
  status: string
}

export interface ApiReceiptOcrData {
  items?: Array<{
    name: string
    quantity: number
    price: number
  }>
  subtotal?: number
  tax?: number
  tip?: number
  total?: number
  confidence?: number
}

export interface ApiReceiptRecord {
  id: string
  splitId: string
  uploadedBy: string
  originalFilename: string
  storagePath: string
  fileSize: number
  mimeType: string
  thumbnailPath?: string
  ocrProcessed: boolean
  ocrConfidenceScore?: number | string | null
  extractedData?: ApiReceiptOcrData | null
  createdAt: string
}

export interface ApiReceiptOcrResponse {
  processed: boolean
  data?: ApiReceiptOcrData | null
}

export interface ApiProfile {
  walletAddress: string
  displayName: string | null
  avatarUrl: string | null
  preferredCurrency: string
}

export interface ApiActivityRecord {
  id: string
  userId?: string
  activityType: string
  splitId?: string
  metadata: Record<string, unknown>
  isRead: boolean
  createdAt: string
}

export interface ApiDashboardSummary {
  totalOwed: number | string
  totalOwedToUser: number | string
  activeSplits: number
  splitsCreated: number
  unreadNotifications: number
  quickActions: Array<{
    id: string
    label: string
    route: string
    badge?: number
  }>
}

export interface ApiDashboardActivityResponse {
  data: ApiActivityRecord[]
  total: number
  page: number
  limit: number
  hasMore: boolean
  unreadCount: number
}

export interface ApiCreateSplitPayload {
  totalAmount: number
  description: string
  creatorWalletAddress: string
  preferredCurrency?: string
  dueDate?: string
  participants: Array<{
    userId: string
    amountOwed: number
    walletAddress?: string
  }>
  items?: Array<{
    name: string
    quantity: number
    unitPrice: number
    totalPrice: number
    assignedToIds: string[]
  }>
}

export interface ApiCreateActivityPayload {
  userId: string
  activityType: string
  splitId?: string
  metadata?: Record<string, unknown>
}

export interface ApiErrorLike {
  statusCode?: number
  message: string
  details?: unknown
  fieldErrors: Record<string, string>
  isNetworkError: boolean
}

export class ApiError extends Error implements ApiErrorLike {
  statusCode?: number
  details?: unknown
  fieldErrors: Record<string, string>
  isNetworkError: boolean

  constructor({
    message,
    statusCode,
    details,
    fieldErrors = {},
    isNetworkError = false,
  }: ApiErrorLike) {
    super(message)
    this.name = 'ApiError'
    this.statusCode = statusCode
    this.details = details
    this.fieldErrors = fieldErrors
    this.isNetworkError = isNetworkError
  }
}

function createApiClient(baseURL: string) {
  const apiInstance = axios.create({
    baseURL,
    timeout: API_TIMEOUT,
    headers: {
      'Content-Type': 'application/json',
    },
  })

  apiInstance.interceptors.request.use(
    async (config: InternalAxiosRequestConfig) => {
      const authToken = getStoredAuthToken()
      const activeUserId = getStoredActiveUserId()

      if (authToken) {
        config.headers.Authorization = `Bearer ${authToken}`
      } else if (activeUserId) {
        config.headers['x-user-id'] = activeUserId
      }

      if (config.data instanceof FormData) {
        delete config.headers['Content-Type']
      }

      return config
    },
  )

  return apiInstance
}


function extractMessages(input: unknown): string[] {
  if (!input) {
    return []
  }

  if (typeof input === 'string') {
    return [input]
  }

  if (Array.isArray(input)) {
    return input.flatMap((value) => extractMessages(value))
  }

  if (typeof input === 'object') {
    return Object.values(input as Record<string, unknown>).flatMap((value) =>
      extractMessages(value),
    )
  }

  return []
}

function inferFieldKey(message: string): string | null {
  const normalized = message.toLowerCase()

  if (normalized.includes('title') || normalized.includes('description')) {
    return 'title'
  }
  if (normalized.includes('currency')) {
    return 'currency'
  }
  if (normalized.includes('total') || normalized.includes('amount')) {
    return 'totalAmount'
  }
  if (normalized.includes('participant')) {
    return 'participants'
  }
  if (normalized.includes('item')) {
    return 'items'
  }
  if (normalized.includes('tax')) {
    return 'taxAmount'
  }
  if (normalized.includes('tip')) {
    return 'tipAmount'
  }
  if (normalized.includes('wallet')) {
    return 'walletAddress'
  }

  return null
}

function createFieldErrorMap(messages: string[]): Record<string, string> {
  return messages.reduce<Record<string, string>>((accumulator, message) => {
    const fieldKey = inferFieldKey(message)
    if (fieldKey && !accumulator[fieldKey]) {
      accumulator[fieldKey] = message
    }
    return accumulator
  }, {})
}

export function normalizeApiError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error
  }

  if (!axios.isAxiosError(error)) {
    return new ApiError({
      message: DEFAULT_API_REQUEST_ERROR,
      details: error,
      fieldErrors: {},
      isNetworkError: false,
    })
  }

  const axiosError = error as AxiosError<{
    message?: unknown
    error?: unknown
    statusCode?: number
  }>
  const responsePayload = axiosError.response?.data
  const messages = extractMessages(
    responsePayload?.message ?? responsePayload?.error ?? axiosError.message,
  )
  const message =
    messages[0] ??
    (axiosError.code === 'ECONNABORTED' || !axiosError.response
      ? DEFAULT_NETWORK_CONNECTIVITY_ERROR
      : DEFAULT_API_REQUEST_ERROR)

  return new ApiError({
    message,
    statusCode: axiosError.response?.status ?? responsePayload?.statusCode,
    details: responsePayload ?? axiosError.toJSON(),
    fieldErrors: createFieldErrorMap(messages),
    isNetworkError: !axiosError.response,
  })
}

async function request<TResponse, TData = unknown>({
  method,
  endpoint,
  data,
  params,
  headers,
  signal,
}: RequestOptions<TData>): Promise<TResponse> {
  try {
    const response = await apiClient.request<TResponse>({
      method,
      url: endpoint,
      data,
      params,
      headers,
      signal,
    } as AxiosRequestConfig<TData>)

    return response.data
  } catch (requestError) {
    throw normalizeApiError(requestError)
  }
}

function normalizeSignedUrlResponse(response: unknown): string | null {
  if (typeof response === 'string') {
    return response
  }

  if (response && typeof response === 'object') {
    const candidate = (response as { url?: unknown }).url
    if (typeof candidate === 'string') {
      return candidate
    }
  }

  return null
}

export function normalizeDecimal(value: number | string | null | undefined): number {
  if (typeof value === 'number') {
    return value
  }

  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : 0
  }

  return 0
}

export function getApiErrorMessage(error: unknown): string {
  return normalizeApiError(error).message
}

export function getApiFieldErrors(error: unknown): Record<string, string> {
  return normalizeApiError(error).fieldErrors
}

export const apiClient = createApiClient(BASE_API_URL)

export async function fetchSplitById(splitId: string, signal?: AbortSignal): Promise<ApiSplitRecord> {
  return request<ApiSplitRecord>({
    method: 'get',
    endpoint: ApiRoutes.splits.byId(splitId),
    signal,
  })
}

export async function updateSplit(
  splitId: string,
  payload: Partial<Pick<ApiSplitRecord, 'totalAmount' | 'description' | 'preferredCurrency' | 'status'>>,
  signal?: AbortSignal,
): Promise<ApiSplitRecord> {
  return request<ApiSplitRecord, typeof payload>({
    method: 'patch',
    endpoint: ApiRoutes.splits.byId(splitId),
    data: payload,
    signal,
  })
}

export async function createSplit(
  payload: ApiCreateSplitPayload,
  signal?: AbortSignal,
): Promise<ApiSplitRecord> {
  return request<ApiSplitRecord, ApiCreateSplitPayload>({
    method: 'post',
    endpoint: ApiRoutes.splits.create(),
    data: payload,
    signal,
  })
}

export async function fetchSplitPayments(
  splitId: string,
  signal?: AbortSignal,
): Promise<ApiPaymentRecord[]> {
  return request<ApiPaymentRecord[]>({
    method: 'get',
    endpoint: ApiRoutes.payments.bySplit(splitId),
    signal,
  })
}

export async function fetchSplitPaymentStats(
  splitId: string,
  signal?: AbortSignal,
): Promise<ApiPaymentStats> {
  return request<ApiPaymentStats>({
    method: 'get',
    endpoint: ApiRoutes.payments.stats(splitId),
    signal,
  })
}

export async function submitSplitPayment(
  payload: {
    splitId: string
    participantId: string
    stellarTxHash: string
    idempotencyKey?: string
    externalReference?: string
  },
  signal?: AbortSignal,
): Promise<{
  success: boolean
  message: string
  paymentId?: string
  isDuplicate?: boolean
  idempotencyKey?: string
}> {
  return request({
    method: 'post',
    endpoint: ApiRoutes.payments.submit(),
    data: payload,
    signal,
  })
}

export async function fetchSplitReceipts(
  splitId: string,
  signal?: AbortSignal,
): Promise<ApiReceiptRecord[]> {
  return request<ApiReceiptRecord[]>({
    method: 'get',
    endpoint: ApiRoutes.receipts.bySplit(splitId),
    signal,
  })
}

export async function uploadReceiptForSplit(
  splitId: string,
  file: File,
  signal?: AbortSignal,
): Promise<ApiReceiptRecord> {
  const formData = new FormData()
  formData.append('file', file)

  return request<ApiReceiptRecord, FormData>({
    method: 'post',
    endpoint: ApiRoutes.receipts.upload(splitId),
    data: formData,
    headers: {
      Accept: 'application/json',
    },
    signal,
  })
}

export async function fetchReceiptSignedUrl(receiptId: string, signal?: AbortSignal): Promise<string | null> {
  const response = await request<unknown>({
    method: 'get',
    endpoint: ApiRoutes.receipts.signedUrl(receiptId),
    signal,
  })

  return normalizeSignedUrlResponse(response)
}

export async function fetchReceiptOcrData(
  receiptId: string,
  signal?: AbortSignal,
): Promise<ApiReceiptOcrResponse> {
  return request<ApiReceiptOcrResponse>({
    method: 'get',
    endpoint: ApiRoutes.receipts.ocrData(receiptId),
    signal,
  })
}

export async function createItem(
  payload: {
    splitId: string
    name: string
    quantity: number
    unitPrice: number
    totalPrice: number
    assignedToIds: string[]
  },
  signal?: AbortSignal,
): Promise<ApiSplitItem> {
  return request<ApiSplitItem, typeof payload>({
    method: 'post',
    endpoint: ApiRoutes.items.create(),
    data: payload,
    signal,
  })
}

export async function deleteItem(itemId: string, signal?: AbortSignal): Promise<void> {
  await request<void>({
    method: 'delete',
    endpoint: ApiRoutes.items.byId(itemId),
    signal,
  })
}

export async function fetchProfile(walletAddress: string, signal?: AbortSignal): Promise<ApiProfile | null> {
  try {
    return await request<ApiProfile>({
      method: 'get',
      endpoint: ApiRoutes.profile.byWallet(walletAddress),
      signal,
    })
  } catch (error) {
    const apiError = normalizeApiError(error)
    if (apiError.statusCode === 404) {
      return null
    }
    throw apiError
  }
}

export async function fetchDashboardSummary(signal?: AbortSignal): Promise<ApiDashboardSummary> {
  return request<ApiDashboardSummary>({
    method: 'get',
    endpoint: ApiRoutes.dashboard.summary(),
    signal,
  })
}

export async function fetchDashboardActivity(
  page = 1,
  limit = 10,
  signal?: AbortSignal,
): Promise<ApiDashboardActivityResponse> {
  return request<ApiDashboardActivityResponse>({
    method: 'get',
    endpoint: ApiRoutes.dashboard.activity(),
    params: {
      page,
      limit,
    },
    signal,
  })
}

export async function fetchUserActivities(
  userId: string,
  params?: {
    splitId?: string
    limit?: number
    page?: number
    isRead?: boolean
  },
  signal?: AbortSignal,
): Promise<{
  data: ApiActivityRecord[]
  total: number
  page: number
  limit: number
  totalPages: number
  hasMore: boolean
  unreadCount: number
}> {
  return request({
    method: 'get',
    endpoint: ApiRoutes.activities.byUser(userId),
    params,
    signal,
  })
}

export async function createActivityRecord(
  payload: ApiCreateActivityPayload,
  signal?: AbortSignal,
): Promise<ApiActivityRecord> {
  return request<ApiActivityRecord, ApiCreateActivityPayload>({
    method: 'post',
    endpoint: ApiRoutes.activities.create(),
    data: payload,
    signal,
  })
}


export async function markActivitiesAsRead(
  userId: string,
  activityIds: string[],
  signal?: AbortSignal,
): Promise<{ updated: number }> {
  return request<{ updated: number }, { activityIds: string[] }>({
    method: 'patch',
    endpoint: ApiRoutes.activities.markRead(userId),
    data: { activityIds },
    signal,
  })
}

export async function markAllActivitiesAsRead(
  userId: string,
  signal?: AbortSignal,
): Promise<{ updated: number }> {
  return request<{ updated: number }>({
    method: 'patch',
    endpoint: ApiRoutes.activities.markAllRead(userId),
    signal,
  })
}
