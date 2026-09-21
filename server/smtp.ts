import {createCipheriv,createDecipheriv,createHash,randomBytes} from 'node:crypto';
import nodemailer from 'nodemailer';
import {z} from 'zod';
import {env} from './config/env.js';
import {ApiError} from './lib/api.js';

export const emailSettingsSchema=z.object({
 sender:z.string().trim().email().max(254),
 site_url:z.string().url().refine(v=>{const u=new URL(v);return !u.username&&!u.password&&(u.protocol==='https:'||(u.protocol==='http:'&&u.hostname==='localhost'));},'Use HTTPS, or HTTP localhost for development'),
 smtp_host:z.string().trim().min(1).max(253).regex(/^[a-zA-Z0-9](?:[a-zA-Z0-9.-]*[a-zA-Z0-9])?$/,'Enter a server hostname, such as smtp.gmail.com, not an email address, URL or port'),
 smtp_port:z.number().int().min(1).max(65535),
 smtp_security:z.enum(['starttls','tls']),
 smtp_username:z.string().trim().min(1).max(254),
}).strict();
export const smtpSaveSchema=emailSettingsSchema.extend({smtp_password:z.string().max(1024).optional()})
 .refine(v=>v.smtp_port!==587||v.smtp_security==='starttls',{path:['smtp_security'],message:'Port 587 requires STARTTLS. Choose STARTTLS, or use port 465 with SSL/TLS.'})
 .refine(v=>v.smtp_port!==465||v.smtp_security==='tls',{path:['smtp_security'],message:'Port 465 requires SSL/TLS. Choose SSL/TLS, or use port 587 with STARTTLS.'});
export type MailSettings=z.infer<typeof emailSettingsSchema>&{smtp_password:string};
export const publicMailFields='sender,site_url,smtp_host,smtp_port,smtp_security,smtp_username';

function encryptionKey(){
 if(!env.jwtSecret||env.jwtSecret==='change-this-secret-before-production')throw new ApiError(503,'Configure the server JWT_SECRET before saving SMTP credentials.');
 return createHash('sha256').update('easehome:smtp-password:v1:').update(env.jwtSecret).digest();
}
export function encryptSmtpPassword(password:string){
 const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',encryptionKey(),iv);
 const encrypted=Buffer.concat([cipher.update(password,'utf8'),cipher.final()]);
 return [iv,cipher.getAuthTag(),encrypted].map(v=>v.toString('base64')).join('.');
}
export function decryptSmtpPassword(value:string){
 try{
  const parts=value.split('.');if(parts.length!==3)throw new Error('Invalid ciphertext');
  const [iv,tag,encrypted]=parts.map(v=>Buffer.from(v,'base64'));
  const decipher=createDecipheriv('aes-256-gcm',encryptionKey(),iv);decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted),decipher.final()]).toString('utf8');
 }catch{throw new ApiError(503,'SMTP credentials cannot be read. Ask the Super Admin to save the SMTP password again.');}
}
export async function deliver(to:string,subject:string,text:string,config:MailSettings){
 const transport=nodemailer.createTransport({
  host:config.smtp_host,port:config.smtp_port,secure:config.smtp_security==='tls',
  requireTLS:config.smtp_security==='starttls',
  auth:{user:config.smtp_username,pass:config.smtp_password},
  tls:{rejectUnauthorized:true,minVersion:'TLSv1.2'},
  connectionTimeout:10000,greetingTimeout:10000,socketTimeout:15000,dnsTimeout:10000,
  disableFileAccess:true,disableUrlAccess:true,logger:false,debug:false,
 });
 try{await transport.sendMail({from:config.sender,to,subject,text});}
 catch(error){
  const code=error&&typeof error==='object'&&'code' in error?error.code:undefined;
  if(code==='EAUTH')throw new ApiError(503,config.smtp_host.toLowerCase()==='smtp.gmail.com'
   ?'Gmail rejected SMTP authentication. Enable Google 2-Step Verification, generate an App Password for the SMTP username account, and save that App Password in SMTP settings.'
   :'SMTP authentication was rejected. Check the SMTP username and password or provider app password, then save the corrected credentials.');
  if(code==='ETIMEDOUT'||code==='ECONNECTION'||code==='EDNS')throw new ApiError(503,'Cannot connect to the SMTP server. Check the hostname, port, connection security and hosting network access.');
  throw new ApiError(503,'Email could not be sent. Ask the Super Admin to check the SMTP host, port, encryption, username, password and sender.');
 }
 finally{transport.close();}
}
