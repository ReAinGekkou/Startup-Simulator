import { createRoot } from 'react-dom/client';
import { AuthProvider } from '@/src/hooks/useAuth';
import { LanguageProvider } from '@/src/hooks/useLocalization';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <LanguageProvider>
    <AuthProvider>
      <App />
    </AuthProvider>
  </LanguageProvider>
);
