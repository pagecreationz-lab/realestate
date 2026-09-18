import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleLogin } from '../../server/handlers';
import { sendWebResponse, toWebRequest } from '../_adapter';

export default async function handler(request: VercelRequest, response: VercelResponse) {
  await sendWebResponse(await handleLogin(await toWebRequest(request)), response);
}
