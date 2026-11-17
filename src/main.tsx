import React from 'react'; import { createRoot } from 'react-dom/client'; import { BrowserRouter } from 'react-router-dom'; import './styles.css'; import App from './App';
import { ThemeProvider } from './contexts/ThemeContext';
import { PreloaderProvider } from './contexts/PreloaderContext';
import { ProcessingProvider } from './contexts/ProcessingContext';
createRoot(document.getElementById('root')!).render(<React.StrictMode><BrowserRouter><ThemeProvider><PreloaderProvider><ProcessingProvider><App/></ProcessingProvider></PreloaderProvider></ThemeProvider></BrowserRouter></React.StrictMode>);
