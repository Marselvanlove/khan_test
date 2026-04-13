export interface MockOrderItem {
  productName: string;
  quantity: number;
  initialPrice: number;
}

export interface MockOrder {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  orderType: string;
  orderMethod: string;
  status: string;
  items: MockOrderItem[];
  delivery?: {
    address?: {
      city?: string;
      text?: string;
    };
  };
  customFields?: Record<string, string | null | undefined>;
}

export interface RetailCrmOrderItem {
  productName?: string;
  quantity?: number | string | null;
  initialPrice?: number | string | null;
  offer?: {
    externalId?: string;
    name?: string;
    displayName?: string;
  };
}

export interface RetailCrmAddress {
  city?: string | null;
  text?: string | null;
  countryIso?: string | null;
}

export interface RetailCrmPhone {
  number?: string | null;
}

export interface RetailCrmParty {
  id?: number;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phones?: RetailCrmPhone[];
  address?: RetailCrmAddress;
}

export interface RetailCrmCreateOrderPayload {
  externalId: string;
  site: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  countryIso: string;
  createdAt: string;
  status?: string;
  orderType?: string;
  orderMethod?: string;
  customerComment?: string;
  customFields?: Record<string, string>;
  items: Array<
    RetailCrmOrderItem & {
      productName: string;
      quantity: number;
      initialPrice: number;
    }
  >;
  delivery?: {
    address?: {
      city?: string;
      text?: string;
    };
  };
}

export interface RetailCrmOrderResponse {
  id: number;
  number?: string | null;
  externalId?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  email?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  status?: string | null;
  totalSumm?: number | string | null;
  summ?: number | string | null;
  customerComment?: string | null;
  items?: RetailCrmOrderItem[];
  delivery?: {
    address?: RetailCrmAddress;
    cost?: number | string | null;
    netCost?: number | string | null;
  };
  customer?: RetailCrmParty | null;
  contact?: RetailCrmParty | null;
  customFields?: Record<string, unknown> | null;
  payments?: Array<Record<string, unknown>> | null;
  [key: string]: unknown;
}

export interface RetailCrmPagination {
  currentPage?: number;
  totalPageCount?: number;
  totalCount?: number;
  limit?: number;
}

export interface RetailCrmOrdersListResponse {
  success: boolean;
  orders?: RetailCrmOrderResponse[];
  pagination?: RetailCrmPagination;
  errors?: string[] | Record<string, string[]>;
  errorMsg?: string;
}

export interface RetailCrmCreateOrderResponse {
  success: boolean;
  id?: number;
  order?: RetailCrmOrderResponse;
  errors?: string[] | Record<string, string[]>;
  errorMsg?: string;
}

export type RetailCrmOrderReferenceBy = "id" | "externalId" | "number";

export interface RetailCrmEditOrderResponse {
  success: boolean;
  id?: number;
  order?: RetailCrmOrderResponse;
  errors?: string[] | Record<string, string[]>;
  errorMsg?: string;
}

export interface OrderRecordInput {
  retailcrm_id: number;
  external_id: string | null;
  customer_name: string;
  phone: string | null;
  email: string | null;
  city: string | null;
  utm_source: string | null;
  status: string | null;
  item_count: number;
  total_amount: number;
  created_at: string;
  updated_at: string;
  raw_payload: RetailCrmOrderResponse;
}

export interface TelegramOrderContext {
  retailcrm_id: number;
  external_id: string | null;
  customer_name: string;
  phone: string | null;
  email: string | null;
  city: string | null;
  total_amount: number;
  created_at: string;
  utm_source: string | null;
  retailcrm_base_url?: string | null;
  alert_types: NotificationAlertType[];
  raw_payload: RetailCrmOrderResponse;
}

export interface DailyMetric {
  order_date: string;
  orders_count: number;
  revenue: number;
  high_value_orders: number;
}

export interface DashboardOrderRow {
  retailcrm_id: number;
  external_id: string | null;
  customer_name: string;
  city: string | null;
  total_amount: number;
  created_at: string;
  status: string | null;
}

export interface DashboardSummary {
  totalOrders: number;
  totalRevenue: number;
  highValueOrders: number;
  freeShippingOrders: number;
  premiumExpressOrders: number;
  unknownSourceOrders: number;
  ordersWithoutContact: number;
}

export type NotificationAlertType =
  | "high-value"
  | "missing-contact"
  | "unknown-source"
  | "cancelled";

export interface AdminSettings {
  singleton_key: string;
  notifications_enabled: boolean;
  high_value_enabled: boolean;
  high_value_threshold: number;
  missing_contact_enabled: boolean;
  unknown_source_enabled: boolean;
  cancelled_enabled: boolean;
  working_hours_enabled: boolean;
  workday_start_hour: number;
  workday_end_hour: number;
  timezone: string;
}

export interface OwnerMetrics {
  averageOrderValue: number;
  ordersLast24Hours: number;
  cancelRate: number;
  approvalBacklog: number;
  deliveryInFlight: number;
  pendingAlerts: number;
  pendingOrders: number;
}

export interface NotificationOverview {
  windowOpen: boolean;
  activeAlerts: NotificationAlertType[];
  pendingEvents: number;
  pendingOrders: number;
  scheduleLabel: string;
}

export interface SourceMetric {
  source: string;
  orders: number;
  revenue: number;
}

export interface GraphsSalesSummary {
  total_revenue: number;
  average_order_value: number;
  total_orders: number;
  high_value_share: number;
}

export interface GraphsTrendPoint {
  date: string;
  label: string;
  orders_count: number;
  revenue: number;
  high_value_orders: number;
}

export interface GraphsProductRow {
  name: string;
  qty: number;
  revenue: number;
  share_of_revenue: number;
}

export interface GraphsCityRow {
  city: string;
  orders: number;
  revenue: number;
  share_of_revenue: number;
}

export interface GraphsSegmentRow {
  code: OperationalOrderRow["segment_code"];
  label: string;
  orders: number;
  revenue: number;
  share_of_revenue: number;
}

export interface GraphsData {
  report_title: string;
  report_period_label: string;
  sales_summary: GraphsSalesSummary;
  sales_trend: GraphsTrendPoint[];
  top_products: GraphsProductRow[];
  top_cities: GraphsCityRow[];
  source_mix: SourceMetric[];
  segment_mix: GraphsSegmentRow[];
}

export interface OrderLineItem {
  name: string;
  quantity: number;
}

export interface OrderLineItemDetail extends OrderLineItem {
  initial_price: number;
  total_price: number;
}

export interface StatusSummaryItem {
  group: string;
  label: string;
  count: number;
}

export type PaymentStatus = "unpaid" | "partial" | "paid" | "refunded" | "unknown";

export interface NotificationLogItem {
  order_retailcrm_id: number;
  order_number: string | null;
  event_type: NotificationAlertType;
  channel: string;
  recipient: string | null;
  status: string;
  attempt: number;
  rate_limited: boolean;
  error_message: string | null;
  created_at: string;
  delivered_at: string | null;
}

export interface OperationalOrderRow {
  retailcrm_id: number;
  crm_number: string;
  external_id: string | null;
  customer_name: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  whatsapp_url: string | null;
  email: string | null;
  city: string | null;
  address: string | null;
  customer_comment: string | null;
  total_amount: number;
  created_at: string;
  utm_source: string | null;
  source_label: string;
  status_code: string | null;
  status_label: string;
  status_group: string;
  status_group_label: string;
  segment_code: "under-35" | "free-shipping" | "high-value" | "premium-express";
  segment_label: string;
  sla_label: string;
  retailcrm_url: string | null;
  manager_url: string | null;
  logistics_url: string | null;
  items: OrderLineItemDetail[];
  missing_contact: boolean;
  unknown_source: boolean;
  paid_amount: number;
  outstanding_amount: number;
  payment_status: PaymentStatus;
  is_partial_payment: boolean;
  is_cancelled_after_payment: boolean;
  payment_paid_at: string | null;
  has_payment_data: boolean;
  telegram_notified_at: string | null;
  alert_reasons: string[];
}

export interface OperationsKpiItem {
  key:
    | "new-today"
    | "approval-backlog"
    | "delivery"
    | "missing-contact"
    | "high-value-active"
    | "sla-overdue";
  label: string;
  value: number;
  hint: string;
}

export interface OperationsStatusFlowItem extends StatusSummaryItem {
  share: number;
}

export interface OperationsTabData {
  high_value_threshold: number;
  kpis: OperationsKpiItem[];
  statusFlow: OperationsStatusFlowItem[];
  actionQueue: OperationalOrderRow[];
  priorityQueue: OperationalOrderRow[];
  problemQueue: OperationalOrderRow[];
}

export interface MarketingKpiItem {
  key:
    | "orders"
    | "revenue"
    | "average-order-value"
    | "high-value-share"
    | "unknown-source-rate"
    | "cancel-rate";
  label: string;
  value: number;
  hint: string;
}

export interface MarketingSourceRow {
  source: string;
  orders: number;
  revenue: number;
  average_order_value: number;
  high_value_orders: number;
  high_value_share: number;
  cancel_rate: number;
}

export interface MarketingGeoRow {
  city: string;
  orders: number;
  revenue: number;
  top_source: string;
}

export interface MarketingOrderFact {
  retailcrm_id: number;
  crm_number: string;
  created_at: string;
  total_amount: number;
  source_label: string;
  city: string | null;
  status_label: string;
  status_group: string;
  segment_code: OperationalOrderRow["segment_code"];
  unknown_source: boolean;
}

export interface MarketingAttributionIssueRow {
  retailcrm_id: number;
  crm_number: string;
  created_at: string;
  total_amount: number;
  city: string | null;
  status_label: string;
  reason: string;
  manager_url: string | null;
  retailcrm_url: string | null;
}

export interface MarketingTabData {
  report_period_label: string;
  sourceOptions: string[];
  cityOptions: string[];
  facts: MarketingOrderFact[];
  kpis: MarketingKpiItem[];
  sourceTable: MarketingSourceRow[];
  highValueSources: MarketingSourceRow[];
  geoBreakdown: MarketingGeoRow[];
  attributionIssues: MarketingAttributionIssueRow[];
}

export interface FinanceKpiItem {
  key: "gmv" | "paid-amount" | "unpaid-amount" | "average-order-value" | "cancel-losses" | "paid-rate";
  label: string;
  value: number | null;
  hint: string;
}

export interface FinancePaymentSummaryRow {
  status: PaymentStatus;
  label: string;
  count: number;
  amount: number;
}

export interface FinanceSegmentRevenueRow {
  segment: OperationalOrderRow["segment_code"];
  label: string;
  orders: number;
  gmv: number;
  paid_amount: number;
  share_of_revenue: number;
}

export interface FinanceCancellationLosses {
  cancelled_orders: number;
  cancelled_amount: number;
  cancelled_after_payment_count: number;
  potential_refund_amount: number;
}

export interface FinanceOrderFact {
  retailcrm_id: number;
  crm_number: string;
  customer_name: string;
  created_at: string;
  total_amount: number;
  status_label: string;
  status_group: string;
  segment_code: OperationalOrderRow["segment_code"];
  segment_label: string;
  payment_status: PaymentStatus;
  paid_amount: number;
  outstanding_amount: number;
  is_partial_payment: boolean;
  is_cancelled_after_payment: boolean;
  payment_paid_at: string | null;
  has_payment_data: boolean;
  manager_url: string | null;
  retailcrm_url: string | null;
}

export interface FinanceAccountingExceptionRow {
  retailcrm_id: number;
  crm_number: string;
  customer_name: string;
  total_amount: number;
  paid_amount: number;
  outstanding_amount: number;
  status_label: string;
  payment_status: PaymentStatus;
  payment_paid_at: string | null;
  issue_label: string;
  manager_url: string | null;
  retailcrm_url: string | null;
}

export interface FinanceTabData {
  report_period_label: string;
  has_reliable_payment_data: boolean;
  facts: FinanceOrderFact[];
  kpis: FinanceKpiItem[];
  paymentSummary: FinancePaymentSummaryRow[];
  segmentRevenue: FinanceSegmentRevenueRow[];
  cancellationLosses: FinanceCancellationLosses;
  accountingExceptions: FinanceAccountingExceptionRow[];
}

export type TelegramMessageStateStatus = "sent" | "confirming" | "completed";

export interface TelegramMessageStateRecord {
  id: string;
  order_retailcrm_id: number;
  chat_id: string;
  message_id: number | null;
  alert_types: NotificationAlertType[];
  status: TelegramMessageStateStatus;
  completed_at: string | null;
  completed_by_user_id: number | null;
  completed_by_username: string | null;
  crm_status_before: string | null;
  crm_status_after: string | null;
  created_at: string;
}
