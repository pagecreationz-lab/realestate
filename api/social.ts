import type {VercelRequest,VercelResponse} from '@vercel/node';
import {handleSocial} from '../server/social.js';
import {toWebRequest,sendWebResponse} from './_adapter.js';
export default async function handler(request:VercelRequest,response:VercelResponse){await sendWebResponse(await handleSocial(await toWebRequest(request)),response);}
