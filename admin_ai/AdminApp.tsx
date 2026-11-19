import { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { adminApi } from './api';
import AdminAccess from './AdminAccess';
import AdminLayout from './AdminLayout';
import { ToastProvider } from './ui';
import type { AdminMe } from './types';
import Overview from './pages/Overview';
import Users from './pages/Users';
import Generations from './pages/Generations';
import Languages from './pages/Languages';
import Plans from './pages/Plans';
import Payments from './pages/Payments';
import Credits from './pages/Credits';
import Activity from './pages/Activity';
import Notifications from './pages/Notifications';
import Support from './pages/Support';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';
import Security from './pages/Security';
import Promotions from './pages/Promotions';
import Monitoring from './pages/Monitoring';

export default function AdminApp() {
  const [admin, setAdmin] = useState<AdminMe | null>(null);
  const [state, setState] = useState<'checking' | 'login' | 'ok'>('checking');

  useEffect(() => {
    let active = true;
    adminApi.get<AdminMe>('/me')
      .then((data) => { if (active) { setAdmin(data); setState('ok'); } })
      .catch(() => { if (active) setState('login'); });
    return () => { active = false; };
  }, []);

  if (state === 'checking') {
    return <div className="admin-loading">Vérification des droits administrateurs…</div>;
  }

  if (state === 'login' || !admin) {
    return <AdminAccess onSuccess={(data) => { setAdmin(data); setState('ok'); }} />;
  }

  return <ToastProvider>
    <AdminLayout admin={admin}>
      <Routes>
        <Route index element={<Overview/>}/>
        <Route path="users" element={<Users/>}/>
        <Route path="generations" element={<Generations/>}/>
        <Route path="languages" element={<Languages/>}/>
        <Route path="plans" element={<Plans/>}/>
        <Route path="payments" element={<Payments/>}/>
        <Route path="credits" element={<Credits/>}/>
        <Route path="activity" element={<Activity/>}/>
        <Route path="notifications" element={<Notifications/>}/>
        <Route path="support" element={<Support/>}/>
        <Route path="analytics" element={<Analytics/>}/>
        <Route path="settings" element={<Settings/>}/>
        <Route path="security" element={<Security/>}/>
        <Route path="promotions" element={<Promotions/>}/>
        <Route path="monitoring" element={<Monitoring/>}/>
        <Route path="*" element={<Navigate to="/admin_ai" replace/>}/>
      </Routes>
    </AdminLayout>
  </ToastProvider>;
}
