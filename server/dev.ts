import 'dotenv/config';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {handleDriveCallback,handleDriveMedia} from './google-drive.js';
import {handleCommunity} from './community.js';
import {handleSocial,handleVideoUpload} from './social.js';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { handleAnalytics, handleEnquiry, handleHealth, handleLogin, handleModeration, handleProperties, handleSiteVisit } from './handlers.js';

const port = Number(process.env.API_PORT ?? 4000);

async function readBody(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}

async function toWebRequest(request: IncomingMessage) {
  const url = `http://${request.headers.host ?? `localhost:${port}`}${request.url ?? '/'}`;
  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers)) {
    if (Array.isArray(value)) value.forEach((item) => headers.append(name, item));
    else if (value !== undefined) headers.set(name, value);
  }
  const method = request.method ?? 'GET';
  const body = method === 'GET' || method === 'HEAD' ? undefined : await readBody(request);
  return new Request(url, { method, headers, body: body?.length ? body : undefined });
}

async function send(response: Response, target: ServerResponse) {
  target.statusCode = response.status;
  response.headers.forEach((value, name) => target.setHeader(name, value));
  if(response.body)await pipeline(Readable.fromWeb(response.body as import('node:stream/web').ReadableStream),target);else target.end();
}

createServer(async (request, response) => {
  try {
    const webRequest = await toWebRequest(request);
    const pathname = new URL(webRequest.url).pathname;
    let result: Response;
    let match: RegExpMatchArray | null;

    if (pathname === '/api/drive-callback') result = await handleDriveCallback(webRequest);
    else if (pathname === '/api/drive-media') result = await handleDriveMedia(webRequest);
    else if (pathname === '/api/health') result = handleHealth();
    else if (pathname === '/api/community') result = await handleCommunity(webRequest);
    else if (pathname === '/api/social') result = await handleSocial(webRequest);
    else if (pathname === '/api/video-upload') result = await handleVideoUpload(webRequest);
    else if (pathname === '/api/auth/login') result = await handleLogin(webRequest);
    else if (pathname === '/api/properties') result = await handleProperties(webRequest);
    else if (pathname === '/api/admin/analytics') result = await handleAnalytics(webRequest);
    else if ((match = pathname.match(/^\/api\/properties\/([^/]+)\/enquiries$/))) result = await handleEnquiry(webRequest, decodeURIComponent(match[1]));
    else if ((match = pathname.match(/^\/api\/properties\/([^/]+)\/site-visits$/))) result = await handleSiteVisit(webRequest, decodeURIComponent(match[1]));
    else if ((match = pathname.match(/^\/api\/admin\/properties\/([^/]+)\/moderate$/))) result = await handleModeration(webRequest, decodeURIComponent(match[1]));
    else result = Response.json({ message: 'API route not found' }, { status: 404 });

    await send(result, response);
  } catch (error) {
    console.error(error);
    await send(Response.json({ message: 'Unexpected server error' }, { status: 500 }), response);
  }
}).listen(port, () => console.log(`EASE HOME API listening on http://localhost:${port}`));
