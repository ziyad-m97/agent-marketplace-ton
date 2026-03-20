import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { TonConnectUIProvider } from '@tonconnect/ui-react';
import { Wallet } from './pages/Wallet';
import { Marketplace } from './pages/Marketplace';
import { History } from './pages/History';
import { Settings } from './pages/Settings';
import './index.css';

// In production, this should be the deployed URL. For dev with ngrok, update accordingly.
const MANIFEST_URL = 'https://raw.githubusercontent.com/ziyad-m97/agent-marketplace-ton/main/tma/public/tonconnect-manifest.json';

function App() {
  return (
    <TonConnectUIProvider manifestUrl={MANIFEST_URL}>
      <BrowserRouter>
        <div className="app">
          <header className="header">
            <h1>Baton</h1>
            <span className="subtitle">Agent Baton Protocol</span>
          </header>

          <main className="content">
            <Routes>
              <Route path="/" element={<Wallet />} />
              <Route path="/marketplace" element={<Marketplace />} />
              <Route path="/history" element={<History />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </main>

          <nav className="nav">
            <NavLink to="/" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
              Wallet
            </NavLink>
            <NavLink to="/marketplace" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
              Agents
            </NavLink>
            <NavLink to="/history" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
              History
            </NavLink>
            <NavLink to="/settings" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
              Settings
            </NavLink>
          </nav>
        </div>
      </BrowserRouter>
    </TonConnectUIProvider>
  );
}

export default App;
