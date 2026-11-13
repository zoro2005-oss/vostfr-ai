import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import NewTranslation from './pages/NewTranslation';
import Processing from './pages/Processing';
import Result from './pages/Result';
import History from './pages/History';
import Settings from './pages/Settings';
import Maquette from './pages/Maquette';
import Landing from './pages/Landing';

function isAuthenticated() {
  return Boolean(localStorage.getItem('vostfr_token'));
}

function RequireAuth() {
  return isAuthenticated() ? <Layout /> : <Navigate to="/login" replace />;
}

function Home() {
  return isAuthenticated() ? <Navigate to="/dashboard" replace /> : <Landing />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/maquette" element={<Maquette />} />
      <Route path="/login" element={<Landing />} />
      <Route path="/register" element={<Landing />} />
      <Route element={<RequireAuth />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/new" element={<NewTranslation />} />
        <Route path="/processing" element={<Navigate to="/new" replace />} />
        <Route path="/processing/:slug" element={<Processing />} />
        <Route path="/result/:slug" element={<Result />} />
        <Route path="/history" element={<History />} />
        <Route path="/translations" element={<History />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to={isAuthenticated() ? '/dashboard' : '/'} replace />} />
    </Routes>
  );
}
