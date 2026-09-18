import type { VercelRequest, VercelResponse } from '@vercel/node';

export async function toWebRequest(request: VercelRequest) {
  const protocol = request.headers['x-forwarded-proto'] ?? 'https';
  const host = request.headers.host ?? 'localhost';
  const url = `${protocol}://${host}${request.url ?? '/'}`;
  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers)) {
    if (Array.isArray(value)) value.forEach((item) => headers.append(name, item));
    else if (value !== undefined) headers.set(name, value);
  }
  const method = request.method ?? 'GET';
  const body = method === 'GET' || method === 'HEAD' ? undefined : JSON.stringify(request.body ?? {});
  return new Request(url, { method, headers, body });
}

export async function sendWebResponse(response: Response, target: VercelResponse) {
  target.status(response.status);
  response.headers.forEach((value, name) => target.setHeader(name, value));
  target.send(Buffer.from(await response.arrayBuffer()));
}

export function queryString(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value ?? '';
}
