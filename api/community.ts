import type {VercelRequest,VercelResponse} from '@vercel/node';
import {handleCommunity} from '../server/community.js';
import {sendWebResponse,toWebRequest} from './_adapter.js';
export default async function handler(request:VercelRequest,response:VercelResponse){response.setHeader('Cache-Control','private, no-store');await sendWebResponse(await handleCommunity(await toWebRequest(request)),response);}
