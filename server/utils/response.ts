
export const httpCodes: Record<number, string> = {
  100: "Continue",
  101: "Switching Protocols",
  200: "OK",
  201: "Created",
  202: "Accepted",
  204: "No Content",
  205: "Reset Content",
  206: "Partial Content",
  300: "Multiple Choices",
  301: "Moved Permanently",
  302: "Found",
  304: "Not Modified",
  305: "Use Proxy",
  307: "Temporary Redirect",
  308: "Permanent Redirect",
  400: "Bad Request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not Found",
  409: "Conflict",
  422: "Unprocessable Entity",
  500: "Internal Server Error",
} as const;

export function constructResponse<T>({ success = true, data, error = null, httpCode = 200, errCode = null }: {
  success?: boolean;
  data?: T;
  error?: string | null;
  httpCode?: number;
  errCode?: string | null;
}) {
  const message = {
    status: httpCodes[httpCode],
    code: httpCode,
    errCode: errCode,
  }

  return {
    success,
    message,
    data,
    error,
  };
}