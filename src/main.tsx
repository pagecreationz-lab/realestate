import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import CreatorApp from '@/components/community/CreatorApp';
import LoginPortal from '@/components/community/SocialLogin';
import ResetPassword from '@/components/community/ResetPassword';
import '@/app/globals.css';

function App() {
  return (
    <Routes>
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/" element={<CreatorApp />} />
      <Route path="/login/user" element={<LoginPortal role="user" />} />
      <Route path="/login/broker" element={<LoginPortal role="broker" />} />
      <Route path="/login/admin" element={<LoginPortal role="admin" />} />
      <Route path="/portal/user" element={<CreatorApp />} />
      <Route path="/portal/broker" element={<CreatorApp />} />
      <Route path="/portal/admin" element={<CreatorApp key="admin" admin />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><BrowserRouter><App /></BrowserRouter></React.StrictMode>,
);
