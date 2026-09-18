import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleHealth } from '../server/handlers';
import { sendWebResponse } from './_adapter';

export default async function handler(_request: VercelRequest, response: VercelResponse) {
  await sendWebResponse(handleHealth(), response);
}
