import type {
  RetailCrmCreateOrderPayload,
  RetailCrmCreateOrderResponse,
  RetailCrmEditOrderResponse,
  RetailCrmOrderReferenceBy,
  RetailCrmOrderResponse,
  RetailCrmOrdersListResponse,
} from "./types";

export interface RetailCrmClientConfig {
  baseUrl: string;
  apiKey: string;
  defaultSite?: string;
}

export interface RetailCrmListOptions {
  page?: number;
  limit?: number;
  siteCode?: string;
}

export interface RetailCrmGetOrderOptions {
  by?: RetailCrmOrderReferenceBy;
  siteCode?: string;
}

export interface RetailCrmEditOrderOptions extends RetailCrmGetOrderOptions {}

export class RetailCrmApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly payload: unknown,
  ) {
    super(message);
    this.name = "RetailCrmApiError";
  }
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

function buildApiUrl(baseUrl: string, path: string, query: URLSearchParams): URL {
  const url = new URL(`${normalizeBaseUrl(baseUrl)}/api/v5/${path.replace(/^\/+/, "")}`);
  url.search = query.toString();

  return url;
}

function stringifyRetailCrmErrors(payload: {
  errorMsg?: string;
  errors?: string[] | Record<string, string[]>;
}): string {
  if (payload.errorMsg) {
    return payload.errorMsg;
  }

  if (Array.isArray(payload.errors)) {
    return payload.errors.join("; ");
  }

  if (payload.errors && typeof payload.errors === "object") {
    return Object.entries(payload.errors)
      .flatMap(([field, messages]) => messages.map((message) => `${field}: ${message}`))
      .join("; ");
  }

  return "RetailCRM API request failed";
}

export function isDuplicateExternalIdError(error: unknown): boolean {
  if (!(error instanceof RetailCrmApiError)) {
    return false;
  }

  const message = error.message.toLowerCase();

  return message.includes("externalid") && (message.includes("already") || message.includes("существ"));
}

export function createRetailCrmClient(config: RetailCrmClientConfig) {
  const baseUrl = normalizeBaseUrl(config.baseUrl);

  async function getJson<T>(path: string, params: URLSearchParams): Promise<T> {
    params.set("apiKey", config.apiKey);

    const response = await fetch(buildApiUrl(baseUrl, path, params), {
      headers: {
        Accept: "application/json",
      },
    });

    const payload = (await response.json()) as T & {
      success?: boolean;
      errors?: string[] | Record<string, string[]>;
      errorMsg?: string;
    };

    if (!response.ok || payload.success === false) {
      throw new RetailCrmApiError(stringifyRetailCrmErrors(payload), response.status, payload);
    }

    return payload;
  }

  async function postForm<T>(path: string, body: URLSearchParams): Promise<T> {
    const query = new URLSearchParams({ apiKey: config.apiKey });
    const response = await fetch(buildApiUrl(baseUrl, path, query), {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      },
      body,
    });

    const payload = (await response.json()) as T & {
      success?: boolean;
      errors?: string[] | Record<string, string[]>;
      errorMsg?: string;
    };

    if (!response.ok || payload.success === false) {
      throw new RetailCrmApiError(stringifyRetailCrmErrors(payload), response.status, payload);
    }

    return payload;
  }

  function applyReferenceOptions(
    params: URLSearchParams,
    options: RetailCrmGetOrderOptions = {},
  ) {
    params.set("by", options.by ?? "id");

    if ((options.by === "externalId" || options.by === "number") && (options.siteCode ?? config.defaultSite)) {
      params.set("site", options.siteCode ?? config.defaultSite ?? "");
    }
  }

  return {
    async createOrder(order: RetailCrmCreateOrderPayload): Promise<RetailCrmCreateOrderResponse> {
      const body = new URLSearchParams();

      body.set("site", order.site || config.defaultSite || "");
      body.set("order", JSON.stringify(order));

      return postForm<RetailCrmCreateOrderResponse>("orders/create", body);
    },

    async listOrders(options: RetailCrmListOptions = {}): Promise<RetailCrmOrdersListResponse> {
      const params = new URLSearchParams();

      params.set("limit", String(options.limit ?? 100));
      params.set("page", String(options.page ?? 1));

      if (options.siteCode ?? config.defaultSite) {
        params.append("filter[sites][]", options.siteCode ?? config.defaultSite ?? "");
      }

      return getJson<RetailCrmOrdersListResponse>("orders", params);
    },

    async listAllOrders(options: Omit<RetailCrmListOptions, "page"> = {}) {
      const orders = [];
      let currentPage = 1;
      let totalPages = 1;

      do {
        const response = await this.listOrders({ ...options, page: currentPage });
        orders.push(...(response.orders ?? []));
        totalPages = Math.max(response.pagination?.totalPageCount ?? 1, 1);
        currentPage += 1;
      } while (currentPage <= totalPages);

      return orders;
    },

    async getOrder(
      reference: string | number,
      options: RetailCrmGetOrderOptions = {},
    ): Promise<RetailCrmOrderResponse> {
      const params = new URLSearchParams();

      applyReferenceOptions(params, options);

      const payload = await getJson<{ success: boolean; order?: RetailCrmOrderResponse }>(
        `orders/${encodeURIComponent(String(reference))}`,
        params,
      );

      if (!payload.order) {
        throw new RetailCrmApiError("RetailCRM order not found", 404, payload);
      }

      return payload.order;
    },

    async editOrder(
      reference: string | number,
      order: Partial<RetailCrmOrderResponse>,
      options: RetailCrmEditOrderOptions = {},
    ): Promise<RetailCrmEditOrderResponse> {
      const body = new URLSearchParams();

      body.set("order", JSON.stringify(order));

      if (options.by) {
        body.set("by", options.by);
      }

      if ((options.by === "externalId" || options.by === "number") && (options.siteCode ?? config.defaultSite)) {
        body.set("site", options.siteCode ?? config.defaultSite ?? "");
      }

      return postForm<RetailCrmEditOrderResponse>(
        `orders/${encodeURIComponent(String(reference))}/edit`,
        body,
      );
    },
  };
}
