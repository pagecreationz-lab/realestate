import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleHealth } from '../server/handlers.js';
import { sendWebResponse } from './_adapter.js';

export default async function handler(_request: VercelRequest, response: VercelResponse) {
  await sendWebResponse(handleHealth(), response);
}
