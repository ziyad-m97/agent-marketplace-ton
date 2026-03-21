import { useTonWallet, CHAIN } from '@tonconnect/ui-react';

export function Wallet() {
  const wallet = useTonWallet();

  return (
    <div className="space-y">
      {/* Balance Card */}
      {wallet?.account.chain === CHAIN.MAINNET && (
        <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid var(--danger)', borderRadius: 'var(--radius-lg)', padding: '16px', marginBottom: '16px', textAlign: 'center' }}>
          <p style={{ color: 'var(--danger)', fontSize: 13, fontWeight: 600 }}>
            ⚠️ Mainnet Detected!
          </p>
          <p style={{ color: 'var(--on-surface-variant)', fontSize: 12, marginTop: 4 }}>
            Please switch your wallet to <b>Testnet</b> to use this preview app.
          </p>
        </div>
      )}
      <div className="glass-card">
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          <span className="balance-label">Current Assets</span>
          <h2 className="balance-value">
            {wallet ? '0.00' : '1,234.56'} <span className="balance-unit">TON</span>
          </h2>
          <p className="balance-usd">$ {wallet ? '0.00' : '7,845.12'} USD</p>

          {/* Action Buttons */}
          <div className="action-buttons">
            <button className="action-btn">
              <span className="material-symbols-outlined">south_west</span>
              <span>Receive</span>
            </button>
            <button className="action-btn">
              <span className="material-symbols-outlined">north_east</span>
              <span>Send</span>
            </button>
            <button className="action-btn">
              <span className="material-symbols-outlined">swap_horiz</span>
              <span>Swap</span>
            </button>
          </div>
        </div>
      </div>

      {/* Stats Bento Grid */}
      <div className="stats-grid">
        <div className="stat-card">
          <span className="material-symbols-outlined stat-icon" style={{ color: 'var(--tertiary)' }}>trending_up</span>
          <div>
            <p className="stat-label">24h Change</p>
            <p className="stat-value" style={{ color: 'var(--tertiary)' }}>+12.4%</p>
          </div>
        </div>
        <div className="stat-card">
          <span className="material-symbols-outlined stat-icon" style={{ color: 'var(--primary)' }}>bolt</span>
          <div>
            <p className="stat-label">Protocol Yield</p>
            <p className="stat-value">5.2% APY</p>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <section>
        <div className="section-header">
          <h3 className="section-title">Recent Activity</h3>
          <button className="section-link">View All</button>
        </div>

        <div className="tx-list">
          {/* Transaction 1 */}
          <div className="tx-item">
            <div className="tx-left">
              <div className="tx-icon">
                <span className="material-symbols-outlined" style={{ color: 'var(--primary)' }}>call_received</span>
              </div>
              <div className="tx-info">
                <span className="tx-title">Received TON</span>
                <span className="tx-subtitle">From EQB9...1d4f</span>
              </div>
            </div>
            <div className="tx-right">
              <span className="tx-amount positive">+ 450.00</span>
              <span className="tx-status">Completed</span>
            </div>
          </div>

          {/* Transaction 2 */}
          <div className="tx-item">
            <div className="tx-left">
              <div className="tx-icon">
                <span className="material-symbols-outlined" style={{ color: 'var(--tertiary)' }}>smart_toy</span>
              </div>
              <div className="tx-info">
                <span className="tx-title">Agent Execution</span>
                <span className="tx-subtitle">Auto-Swap Protocol</span>
              </div>
            </div>
            <div className="tx-right">
              <span className="tx-amount">- 12.50</span>
              <span className="tx-status">Processing</span>
            </div>
          </div>

          {/* Transaction 3 */}
          <div className="tx-item">
            <div className="tx-left">
              <div className="tx-icon">
                <span className="material-symbols-outlined" style={{ color: 'var(--on-surface-variant)' }}>call_made</span>
              </div>
              <div className="tx-info">
                <span className="tx-title">Sent TON</span>
                <span className="tx-subtitle">To EQA2...8v9z</span>
              </div>
            </div>
            <div className="tx-right">
              <span className="tx-amount">- 100.00</span>
              <span className="tx-status">2h ago</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
