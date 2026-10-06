import { ApiClient } from '@/shared/api/client'
import { buildQuery, type Page } from '@/shared/api/catalog-resource'
import { environment } from '@/shared/config/env'

import type {
  CustomerOption,
  DraftPreview,
  MoneyReview,
  OperationStatus,
  Payment,
  PartInput,
  PendingWithholdingsPage,
  VoucherInput,
  Withholding,
  WithholdingInput,
  ProductOption,
  ReceivablesPage,
  Sale,
  SaleDocument,
  SaleFilters,
  SaleInput,
  SaleRefund,
  SaleReturn,
  SaleReview,
  SaleSummary,
} from './types'

const BASE = '/sales'

export interface ReturnLineInput {
  sale_line_id: number
  fit_quantity: string
  unfit_quantity: string
}

export function createSalesApi(client: ApiClient) {
  const post = <T>(path: string, body: object) =>
    client.request<T>(`${BASE}${path}`, { method: 'POST', body })
  const get = <T>(path: string) => client.request<T>(`${BASE}${path}`)

  return {
    list(filters: SaleFilters = {}): Promise<Page<SaleSummary>> {
      return get(
        `/${buildQuery({
          customer_id: filters.customerId,
          state: filters.state,
          origin: filters.origin,
          payment_state: filters.paymentState,
          date_from: filters.dateFrom,
          date_to: filters.dateTo,
          page: filters.page,
          page_size: filters.pageSize,
        })}`,
      )
    },
    receivables(filters: SaleFilters = {}): Promise<ReceivablesPage> {
      return get(
        `/receivables/${buildQuery({
          customer_id: filters.customerId,
          origin: filters.origin,
          payment_state: filters.paymentState,
          min_age_days: filters.minAgeDays,
          condition: filters.condition,
          only_debt: filters.onlyDebt ? 'true' : undefined,
          page: filters.page,
          page_size: filters.pageSize,
        })}`,
      )
    },
    get(id: number): Promise<Sale> {
      return get(`/${id}/`)
    },
    document(id: number): Promise<SaleDocument> {
      return get(`/${id}/document/`)
    },
    create(data: SaleInput, key: string): Promise<Sale> {
      return post('/', { ...data, idempotency_key: key })
    },
    update(
      id: number,
      data: Partial<SaleInput>,
      expectedVersion: number,
      key: string,
    ): Promise<Sale> {
      return client.request(`${BASE}/${id}/`, {
        method: 'PATCH',
        body: {
          ...data,
          expected_version: expectedVersion,
          idempotency_key: key,
        },
      })
    },
    /** Consulta de solo lectura: no guarda, no numera ni crea recibo. */
    draftPreview(
      data: Partial<SaleInput>,
      signal?: AbortSignal,
    ): Promise<DraftPreview> {
      return client.request(`${BASE}/draft-preview/`, {
        method: 'POST',
        body: data,
        ...(signal ? { signal } : {}),
      })
    },
    preview(id: number): Promise<SaleReview> {
      return post(`/${id}/preview/`, {})
    },
    confirm(
      id: number,
      data: { expectedVersion: number; reviewToken: string },
      key: string,
    ): Promise<Sale> {
      return post(`/${id}/confirm/`, {
        expected_version: data.expectedVersion,
        review_token: data.reviewToken,
        idempotency_key: key,
      })
    },
    payments(id: number): Promise<Payment[]> {
      return get(`/${id}/payments/`)
    },
    paymentPreview(
      id: number,
      data: {
        operationId: string
        parts: PartInput[]
        withholding?: WithholdingInput | null
      },
    ): Promise<MoneyReview> {
      return post(`/${id}/payments/preview/`, settlementBody(data))
    },
    /** Con dinero devuelve el pago; con solo retención, la retención registrada. */
    registerPayment(
      id: number,
      data: {
        operationId: string
        parts: PartInput[]
        withholding?: WithholdingInput | null
        reviewToken: string
      },
      key: string,
    ): Promise<Payment | Withholding> {
      return post(`/${id}/payments/`, {
        ...settlementBody(data),
        review_token: data.reviewToken,
        idempotency_key: key,
      })
    },
    pendingWithholdings(
      filters: { customerId?: number; page?: number; pageSize?: number } = {},
    ): Promise<PendingWithholdingsPage> {
      return get(
        `/withholdings/pending/${buildQuery({
          customer_id: filters.customerId,
          page: filters.page,
          page_size: filters.pageSize,
        })}`,
      )
    },
    completeVoucher(
      id: number,
      withholdingId: number,
      data: VoucherInput,
      key: string,
    ): Promise<Withholding> {
      return post(`/${id}/withholdings/${withholdingId}/voucher/`, {
        ...voucherBody(data),
        idempotency_key: key,
      })
    },
    correctVoucher(
      id: number,
      withholdingId: number,
      data: VoucherInput & { operationId: string; reason: string },
      key: string,
    ): Promise<Withholding> {
      return post(`/${id}/withholdings/${withholdingId}/voucher-correction/`, {
        ...voucherBody(data),
        operation_id: data.operationId,
        reason: data.reason,
        idempotency_key: key,
      })
    },
    voidWithholding(
      id: number,
      withholdingId: number,
      data: { reason: string },
      key: string,
    ): Promise<Withholding> {
      return post(`/${id}/withholdings/${withholdingId}/void/`, {
        reason: data.reason,
        idempotency_key: key,
      })
    },
    correctionPreview(
      id: number,
      paymentId: number,
      data: {
        operationId: string
        reason: string
        replacement?: { operationId: string; parts: PartInput[] } | null
      },
    ): Promise<MoneyReview> {
      return post(`/${id}/payments/${paymentId}/correction-preview/`, {
        operation_id: data.operationId,
        reason: data.reason,
        ...(data.replacement
          ? {
              replacement: {
                operation_id: data.replacement.operationId,
                parts: data.replacement.parts,
              },
            }
          : {}),
      })
    },
    correctPayment(
      id: number,
      paymentId: number,
      data: {
        operationId: string
        reason: string
        reviewToken: string
        replacement?: { operationId: string; parts: PartInput[] } | null
      },
      key: string,
    ): Promise<Payment> {
      return post(`/${id}/payments/${paymentId}/correct/`, {
        operation_id: data.operationId,
        reason: data.reason,
        review_token: data.reviewToken,
        idempotency_key: key,
        ...(data.replacement
          ? {
              replacement: {
                operation_id: data.replacement.operationId,
                parts: data.replacement.parts,
              },
            }
          : {}),
      })
    },
    returnPreview(
      id: number,
      data: { operationId: string; reason: string; lines: ReturnLineInput[] },
    ): Promise<MoneyReview> {
      return post(`/${id}/returns/preview/`, {
        operation_id: data.operationId,
        reason: data.reason,
        lines: data.lines,
      })
    },
    registerReturn(
      id: number,
      data: {
        operationId: string
        reason: string
        lines: ReturnLineInput[]
        reviewToken: string
      },
      key: string,
    ): Promise<SaleReturn> {
      return post(`/${id}/returns/`, {
        operation_id: data.operationId,
        reason: data.reason,
        lines: data.lines,
        review_token: data.reviewToken,
        idempotency_key: key,
      })
    },
    refundPreview(
      id: number,
      data: {
        operationId: string
        saleReturnId: number
        reason: string
        parts: PartInput[]
      },
    ): Promise<MoneyReview> {
      return post(`/${id}/refunds/preview/`, {
        operation_id: data.operationId,
        sale_return_id: data.saleReturnId,
        reason: data.reason,
        parts: data.parts,
      })
    },
    registerRefund(
      id: number,
      data: {
        operationId: string
        saleReturnId: number
        reason: string
        parts: PartInput[]
        reviewToken: string
      },
      key: string,
    ): Promise<SaleRefund> {
      return post(`/${id}/refunds/`, {
        operation_id: data.operationId,
        sale_return_id: data.saleReturnId,
        reason: data.reason,
        parts: data.parts,
        review_token: data.reviewToken,
        idempotency_key: key,
      })
    },
    voidPreview(
      id: number,
      data: {
        reason: string
        refund?: { operationId: string; parts: PartInput[] } | null
      },
    ): Promise<MoneyReview> {
      return post(`/${id}/void-preview/`, voidBody(data))
    },
    void(
      id: number,
      data: {
        reason: string
        expectedVersion: number
        reviewToken: string
        refund?: { operationId: string; parts: PartInput[] } | null
      },
      key: string,
    ): Promise<Sale> {
      return post(`/${id}/void/`, {
        ...voidBody(data),
        expected_version: data.expectedVersion,
        review_token: data.reviewToken,
        idempotency_key: key,
      })
    },
    operation(operationId: string): Promise<OperationStatus> {
      return get(`/operations/${operationId}/`)
    },
    customerOptions(
      search: string,
      page: number,
    ): Promise<Page<CustomerOption>> {
      return get(
        `/customer-options/${buildQuery({ search, page, page_size: 20 })}`,
      )
    },
    productOptions(search: string, page: number): Promise<Page<ProductOption>> {
      return get(
        `/product-options/${buildQuery({ search, page, page_size: 20 })}`,
      )
    },
  }
}

/** Dinero y retención de una misma acción; las partes se omiten si no hay dinero. */
export function settlementBody(data: {
  operationId: string
  parts: PartInput[]
  withholding?: WithholdingInput | null
}): object {
  return {
    operation_id: data.operationId,
    ...(data.parts.length > 0 ? { parts: data.parts } : {}),
    ...(data.withholding ? { withholding: data.withholding } : {}),
  }
}

/** El desglose renta/IVA es opcional: se envía completo o no se envía. */
export function voucherBody(data: VoucherInput): object {
  const breakdown =
    data.incomeTaxAmount != null && data.vatAmount != null
      ? {
          income_tax_amount: data.incomeTaxAmount,
          vat_amount: data.vatAmount,
        }
      : {}
  return {
    voucher_number: data.voucherNumber,
    voucher_date: data.voucherDate,
    ...breakdown,
  }
}

function voidBody(data: {
  reason: string
  refund?: { operationId: string; parts: PartInput[] } | null
}): object {
  return {
    reason: data.reason,
    ...(data.refund
      ? {
          refund: {
            operation_id: data.refund.operationId,
            parts: data.refund.parts,
          },
        }
      : {}),
  }
}

export const salesApi = createSalesApi(new ApiClient(environment.apiBaseUrl))
