import {encryptSmtpPassword,type MailSettings} from '../server/smtp';
export const mailSettings:MailSettings={sender:'accounts@example.test',site_url:'https://example.test',smtp_host:'smtp.example.test',smtp_port:587,smtp_security:'starttls',smtp_username:'accounts@example.test',smtp_password:'test-smtp-password'};
export function storedMailSettings(){const {smtp_password,...settings}=mailSettings;return {...settings,smtp_password_enc:encryptSmtpPassword(smtp_password)};}
