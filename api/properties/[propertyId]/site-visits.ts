import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleSiteVisit } from '../../../server/handlers';
import { queryString, sendWebResponse, toWebRequest } from '../../_adapter';

export default async function handler(request: VercelRequest, response: VercelResponse) {
  await sendWebResponse(await handleSiteVisit(await toWebRequest(request), queryString(request.query.propertyId)), response);
}
