export async function readApiResponse(response:Response){
 const text=await response.text();
 let data;
 try{data=JSON.parse(text);}catch{
  throw new Error(response.status>=500?'The server could not start or is temporarily unavailable. Please try again later. If this continues, ask the administrator to check Vercel function logs.':`The API returned an invalid response (HTTP ${response.status}). Please refresh and try again.`);
 }
 if(!data||typeof data!=='object'||Array.isArray(data))throw new Error('The API returned an unexpected response. Please try again.');
 return data;
}
