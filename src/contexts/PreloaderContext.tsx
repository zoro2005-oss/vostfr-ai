import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { Clapperboard } from 'lucide-react';

interface PreloaderContextType {
  show: (duration?: number) => void;
}

const PreloaderContext = createContext<PreloaderContextType | undefined>(undefined);

export function PreloaderProvider({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(true);
  const [leaving, setLeaving] = useState(false);
  const timers = useRef<number[]>([]);

  const clearTimers = () => {
    timers.current.forEach(window.clearTimeout);
    timers.current = [];
  };

  const show = useCallback((duration = 1400) => {
    clearTimers();
    setLeaving(false);
    setVisible(true);
    timers.current = [
      window.setTimeout(() => setLeaving(true), duration),
      window.setTimeout(() => setVisible(false), duration + 600)
    ];
  }, []);

  useEffect(() => {
    show();
    return clearTimers;
  }, [show]);

  return <PreloaderContext.Provider value={{ show }}>
    {children}
    {visible && <div className={`preloader ${leaving ? 'leaving' : ''}`} role="status" aria-label="Chargement">
      <div className="preloader-spinner"><span><Clapperboard size={24}/></span></div>
      <div className="preloader-brand">VOSTFR <b>AI</b></div>
      <p>Chargement de votre espace…</p>
    </div>}
  </PreloaderContext.Provider>;
}

export function usePreloader() {
  const context = useContext(PreloaderContext);
  if (context === undefined) {
    throw new Error('usePreloader must be used within a PreloaderProvider');
  }
  return context;
}
