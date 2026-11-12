import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import NewTranslation from './pages/NewTranslation';
import Processing from './pages/Processing';
import Result from './pages/Result';
import History from './pages/History';
import Settings from './pages/Settings';
import Login from './pages/Login';
import Register from './pages/Register';

function RequireAuth() {
  return localStorage.getItem('vostfr_token') ? <Layout /> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route element={<RequireAuth />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/new" element={<NewTranslation />} />
        <Route path="/processing" element={<Navigate to="/new" replace />} />
        <Route path="/processing/:slug" element={<Processing />} />
        <Route path="/result/:slug" element={<Result />} />
        <Route path="/history" element={<History />} />
        <Route path="/translations" element={<History />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
