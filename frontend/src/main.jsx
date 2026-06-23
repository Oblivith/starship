import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';            // Tailwind preflight first…
import './styles/tokens.css';    // …then our tokens/base so our values win.
import { AuthProvider } from './context/AuthContext.jsx';
import { SoundManagerProvider } from './components/SoundManager.jsx';
import LoadingScreen from './components/LoadingScreen.jsx';
import App from './App.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <LoadingScreen />
    <SoundManagerProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </SoundManagerProvider>
  </React.StrictMode>
);
