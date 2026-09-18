export type User={id:string;name:string;email:string;roles:string[]};
export function requireSignIn(post:string){location.href='/login/user?next='+encodeURIComponent('/?post='+encodeURIComponent(post));}
export type Post={id:string;author_id:string;author:string;authorType?:string;post_type?:'property'|'service';service_category?:string;caption:string;location:string;intent:string;price:number;status:string;review_note?:string;created_at:string;hasPhone:boolean;liked:boolean;saved:boolean;counts:{view:number;like:number;share:number;save:number};media:{id:string;mime:string;url:string}[]};
export function readSession():{token:string;user:User;role:string}|null {try{return JSON.parse(localStorage.getItem('ease-home-session')||'null');}catch{return null;}}
export async function community(resource:string,body?:unknown){
 const token=readSession()?.token;
 const response=await fetch('/api/community?resource='+resource,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined,cache:'no-store'});
 const data=await response.json().catch(()=>({message:'The server did not return a valid response.'}));
 if(!response.ok)throw new Error(data.message||'Unable to complete your request.');return data;
}
export const inr=(paise:number)=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:2}).format(paise/100);
export const when=(date:string)=>new Date(date).toLocaleString('en-IN',{day:'numeric',month:'short',hour:'numeric',minute:'2-digit'});
