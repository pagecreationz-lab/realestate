import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleLogin } from '../../server/handlers.js';
import { sendWebResponse, toWebRequest } from '../_adapter.js';

export default async function handler(request: VercelRequest, response: VercelResponse) {
  await sendWebResponse(await handleLogin(await toWebRequest(request)), response);
}
