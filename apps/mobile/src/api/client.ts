export class UnauthenticatedError extends Error {
  constructor() {
    super("Authentication is required");
    this.name = "UnauthenticatedError";
  }
}

export class ApiNotConfiguredError extends Error {
  constructor() {
    super("API base URL is not configured");
    this.name = "ApiNotConfiguredError";
  }
}

export interface ApiResult<T> {
  readonly ok: boolean;
  readonly status: number;
  readonly data: T | null;
}

export interface ApiRequest {
  readonly method?: "GET" | "POST" | "DELETE";
  readonly query?: Readonly<Record<string, string | number | null | undefined>>;
  readonly body?: unknown;
  readonly signal?: AbortSignal;
}

export interface ApiClient {
  request<T>(path: string, init?: ApiRequest): Promise<ApiResult<T>>;
}

type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

export interface ApiClientOptions {
  readonly baseUrl: string;
  readonly getAccessToken: () => string | null;
  readonly fetch?: FetchLike;
}

export function buildUrl(
  baseUrl: string,
  path: string,
  query?: ApiRequest["query"],
): string {
  const params = Object.entries(query ?? {})
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .map(([key, value]) =>
      `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  return `${baseUrl.replace(/\/+$/, "")}${path}${params.length ? `?${params.join("&")}` : ""}`;
}

export function createApiClient(options: ApiClientOptions): ApiClient {
  const doFetch: FetchLike = options.fetch ?? ((input, init) => globalThis.fetch(input, init));

  return {
    async request<T>(path: string, init: ApiRequest = {}): Promise<ApiResult<T>> {
      if (!options.baseUrl) {
        throw new ApiNotConfiguredError();
      }
      const token = options.getAccessToken();
      if (!token) {
        throw new UnauthenticatedError();
      }

      const headers: Record<string, string> = {
        authorization: `Bearer ${token}`,
        accept: "application/json",
      };
      const requestInit: RequestInit = {
        method: init.method ?? "GET",
        headers,
      };
      if (init.body !== undefined) {
        headers["content-type"] = "application/json";
        requestInit.body = JSON.stringify(init.body);
      }
      if (init.signal) {
        requestInit.signal = init.signal;
      }

      const response = await doFetch(buildUrl(options.baseUrl, path, init.query), requestInit);
      let data: T | null = null;
      if (response.status !== 204) {
        const text = await response.text();
        if (text) {
          try {
            data = JSON.parse(text) as T;
          } catch {
            data = null;
          }
        }
      }
      return { ok: response.ok, status: response.status, data };
    },
  };
}
