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
  };
  customer?: RetailCrmParty | null;
  contact?: RetailCrmParty | null;
  customFields?: Record<string, unknown> | null;
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

export interface OrderLineItem {
  name: string;
  quantity: number;
}

export interface StatusSummaryItem {
  group: string;
  label: string;
  count: number;
}

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
  phone: string | null;
  whatsapp_url: string | null;
  email: string | null;
  city: string | null;
  address: string | null;
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
  items: OrderLineItem[];
  missing_contact: boolean;
  unknown_source: boolean;
  telegram_notified_at: string | null;
  alert_reasons: string[];
}
