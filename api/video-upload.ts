import type {VercelRequest,VercelResponse} from '@vercel/node';
import {handleVideoUpload} from '../server/social.js';
import {toWebRequest,sendWebResponse} from './_adapter.js';
export default async function handler(request:VercelRequest,response:VercelResponse){await sendWebResponse(await handleVideoUpload(await toWebRequest(request)),response);}
