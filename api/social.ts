import type {VercelRequest,VercelResponse} from '@vercel/node';
import {handleSocial} from '../server/social';
import {toWebRequest,sendWebResponse} from './_adapter';
export default async function handler(request:VercelRequest,response:VercelResponse){await sendWebResponse(await handleSocial(await toWebRequest(request)),response);}
