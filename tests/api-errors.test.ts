import {test} from 'node:test';
import assert from 'node:assert/strict';
import {apiErrorResponse,ApiError} from '../server/lib/api';

test('Supabase DNS and network errors return actionable 503 responses',async()=>{
 for(const error of [
  {message:'TypeError: fetch failed',details:'Error: getaddrinfo ENOTFOUND database.invalid',code:''},
  new TypeError('fetch failed'),
  {name:'TimeoutError',message:'The operation timed out'},
 ]){
  const response=apiErrorResponse(error);
  assert.equal(response.status,503);
  const body=await response.json();
  assert.match(body.message,/Supabase project URL and project status/);
  assert.ok(!body.message.includes('database.invalid'),'internal connection details must not leak');
 }
});
test('credential failures remain distinct from connectivity failures',async()=>{
 const response=apiErrorResponse(new ApiError(401,'Email or password is incorrect'));
 assert.equal(response.status,401);
 assert.deepEqual(await response.json(),{message:'Email or password is incorrect'});
});
