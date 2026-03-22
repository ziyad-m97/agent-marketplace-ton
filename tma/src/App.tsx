import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { TonConnectUIProvider } from '@tonconnect/ui-react';
import { Wallet } from './pages/Wallet';
import { Marketplace } from './pages/Marketplace';
import { History } from './pages/History';
import { Settings } from './pages/Settings';
import './index.css';

const MANIFEST_URL = 'https://ton-connect.github.io/demo-dapp-with-react-ui/tonconnect-manifest.json';

function App() {
  return (
    <TonConnectUIProvider manifestUrl={MANIFEST_URL}>
      <BrowserRouter>
        <div className="app">
          {/* Page Content */}
          <main className="content">
            <Routes>
              <Route path="/" element={<Wallet />} />
              <Route path="/marketplace" element={<Marketplace />} />
              <Route path="/history" element={<History />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </main>

          {/* Bottom Navigation */}
          <nav className="nav">
            <NavLink to="/" end className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
              <span className="material-symbols-outlined nav-icon">account_balance_wallet</span>
              <span className="nav-label">Wallet</span>
            </NavLink>
            <NavLink to="/marketplace" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
              <span className="material-symbols-outlined nav-icon">smart_toy</span>
              <span className="nav-label">Agents</span>
            </NavLink>
            <NavLink to="/history" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
              <span className="material-symbols-outlined nav-icon">history</span>
              <span className="nav-label">History</span>
            </NavLink>
            <NavLink to="/settings" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
              <span className="material-symbols-outlined nav-icon">settings</span>
              <span className="nav-label">Settings</span>
            </NavLink>
          </nav>
        </div>
      </BrowserRouter>
    </TonConnectUIProvider>
  );
}

export default App;
