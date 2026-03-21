import { useState } from 'react';
import { TonConnectButton } from '@tonconnect/ui-react';

export function Settings() {
  const [maxPerJob, setMaxPerJob] = useState('20');
  const [totalBudget, setTotalBudget] = useState('100');
  const [autoDelegate, setAutoDelegate] = useState(true);

  return (
    <div>
      {/* Top App Bar */}
      <header className="header">
        <div className="header-left">
          <button className="header-menu-btn" aria-label="Menu">
            <span className="material-symbols-outlined">menu</span>
          </button>
          <h1 className="header-title">Settings</h1>
        </div>
        <div className="header-right">
          <TonConnectButton />
          <div className="header-avatar">
            <span className="material-symbols-outlined">person</span>
          </div>
        </div>
      </header>

      <div className="space-y" style={{ paddingTop: 24 }}>
        <h2 className="page-title">Permissions</h2>

        <div className="card">
          <label style={{ fontSize: 13, color: 'var(--on-surface-variant)', display: 'block', marginBottom: 10, fontWeight: 600 }}>
            Max TON per delegation
          </label>
          <input
            type="number"
            value={maxPerJob}
            onChange={e => setMaxPerJob(e.target.value)}
            className="glass-input"
          />
        </div>

        <div className="card">
          <label style={{ fontSize: 13, color: 'var(--on-surface-variant)', display: 'block', marginBottom: 10, fontWeight: 600 }}>
            Total budget cap (TON)
          </label>
          <input
            type="number"
            value={totalBudget}
            onChange={e => setTotalBudget(e.target.value)}
            className="glass-input"
          />
        </div>

        <div className="card">
          <div className="settings-item">
            <div className="settings-item-text">
              <h4>Auto-delegate</h4>
              <p>Let your agent pass the baton without asking</p>
            </div>
            <button
              onClick={() => setAutoDelegate(!autoDelegate)}
              className={`toggle-switch ${autoDelegate ? 'on' : 'off'}`}
            >
              <span
                className="toggle-knob"
                style={{ left: autoDelegate ? 23 : 3 }}
              />
            </button>
          </div>
        </div>

        <button className="btn btn-primary" style={{ marginTop: 4 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 18, marginRight: 8 }}>save</span>
          Save Settings
        </button>
      </div>
    </div>
  );
}
