import type {VercelRequest,VercelResponse} from '@vercel/node';
import {handleCommunity} from '../server/community';
import {sendWebResponse,toWebRequest} from './_adapter';
export default async function handler(request:VercelRequest,response:VercelResponse){response.setHeader('Cache-Control','private, no-store');await sendWebResponse(await handleCommunity(await toWebRequest(request)),response);}
