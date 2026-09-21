import type {VercelRequest,VercelResponse} from '@vercel/node';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {handleDriveMedia} from '../server/google-drive.js';
import {toWebRequest} from './_adapter.js';
export default async function handler(request:VercelRequest,response:VercelResponse){
 const result=await handleDriveMedia(await toWebRequest(request));
 response.status(result.status);result.headers.forEach((value,name)=>response.setHeader(name,value));
 if(result.body)await pipeline(Readable.fromWeb(result.body as import('node:stream/web').ReadableStream),response);else response.end();
}
