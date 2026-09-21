import type {VercelRequest,VercelResponse} from '@vercel/node';
import {handleDriveCallback} from '../server/google-drive.js';
import {sendWebResponse,toWebRequest} from './_adapter.js';
export default async function handler(request:VercelRequest,response:VercelResponse){await sendWebResponse(await handleDriveCallback(await toWebRequest(request)),response);}
