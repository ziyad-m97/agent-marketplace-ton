import { useState } from 'react';

export function Settings() {
  const [maxPerJob, setMaxPerJob] = useState('20');
  const [totalBudget, setTotalBudget] = useState('100');
  const [autoDelegate, setAutoDelegate] = useState(true);

  return (
    <div>
      <h2 style={{ fontSize: 16, marginBottom: 16 }}>Permissions</h2>

      <div className="card">
        <label style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>
          Max TON per delegation
        </label>
        <input
          type="number"
          value={maxPerJob}
          onChange={e => setMaxPerJob(e.target.value)}
          style={{
            width: '100%',
            padding: '10px 12px',
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            color: 'var(--text)',
            fontSize: 14,
          }}
        />
      </div>

      <div className="card">
        <label style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>
          Total budget cap (TON)
        </label>
        <input
          type="number"
          value={totalBudget}
          onChange={e => setTotalBudget(e.target.value)}
          style={{
            width: '100%',
            padding: '10px 12px',
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            color: 'var(--text)',
            fontSize: 14,
          }}
        />
      </div>

      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 14 }}>Auto-delegate</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            Let your agent pass the baton without asking
          </div>
        </div>
        <button
          onClick={() => setAutoDelegate(!autoDelegate)}
          style={{
            width: 48,
            height: 28,
            borderRadius: 14,
            border: 'none',
            background: autoDelegate ? 'var(--accent)' : 'var(--border)',
            cursor: 'pointer',
            position: 'relative',
            transition: 'background 0.2s',
          }}
        >
          <span
            style={{
              position: 'absolute',
              top: 3,
              left: autoDelegate ? 23 : 3,
              width: 22,
              height: 22,
              borderRadius: '50%',
              background: 'white',
              transition: 'left 0.2s',
            }}
          />
        </button>
      </div>

      <button className="btn btn-primary" style={{ marginTop: 12 }}>
        Save Settings
      </button>
    </div>
  );
}
