/** Outbound HTTP request shape used by the credential resolver and request pipeline. */
export interface HttpRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  query?: Record<string, string>;
  body?: unknown;
}
