import { TonConnectButton, useTonWallet } from '@tonconnect/ui-react';

export function Wallet() {
  const wallet = useTonWallet();

  return (
    <div>
      <div className="card" style={{ textAlign: 'center', marginBottom: 20 }}>
        <TonConnectButton />
      </div>

      {wallet ? (
        <>
          <div className="card">
            <div className="stat">
              <div className="stat-value">0.00</div>
              <div className="stat-label">TON Balance</div>
            </div>
          </div>

          <div className="card">
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" style={{ flex: 1 }}>
                Fund Baton
              </button>
              <button className="btn btn-secondary" style={{ flex: 1 }}>
                Withdraw
              </button>
            </div>
          </div>

          <div className="card">
            <h3 style={{ fontSize: 14, marginBottom: 12 }}>Spending Summary</h3>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span style={{ color: 'var(--text-secondary)' }}>Total delegated</span>
              <span>0 jobs</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginTop: 4 }}>
              <span style={{ color: 'var(--text-secondary)' }}>Total spent</span>
              <span>0 TON</span>
            </div>
          </div>
        </>
      ) : (
        <div className="empty">
          <p>Connect your TON wallet to get started</p>
        </div>
      )}
    </div>
  );
}
