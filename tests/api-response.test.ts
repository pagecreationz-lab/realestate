import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readApiResponse} from '../components/community/response';
test('plain-text Vercel crashes produce a useful error, not JSON syntax errors',async()=>{
 await assert.rejects(readApiResponse(new Response('A server error has occurred\nFUNCTION_INVOCATION_FAILED',{status:500})),/server could not start/);
 assert.deepEqual(await readApiResponse(Response.json({message:'Email or password is incorrect'},{status:401})),{message:'Email or password is incorrect'});
 await assert.rejects(readApiResponse(Response.json(null)),/unexpected response/);
});
