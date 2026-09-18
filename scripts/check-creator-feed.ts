import {handleCommunity} from '../server/community';
const response=await handleCommunity(new Request('http://localhost/api/community?resource=feed'));
const body=await response.json();
console.log(JSON.stringify({status:response.status,message:body.message,postCount:body.posts?.length}));
