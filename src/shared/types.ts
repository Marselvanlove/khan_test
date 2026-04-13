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
}

export interface SourceMetric {
  source: string;
  orders: number;
  revenue: number;
}
