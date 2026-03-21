import { useState, useEffect, useCallback } from 'react';
import { useTonWallet, useTonAddress, useTonConnectModal, CHAIN, TonConnectButton } from '@tonconnect/ui-react';

const TESTNET_API = 'https://testnet.toncenter.com/api/v2';
const MAINNET_API = 'https://toncenter.com/api/v2';

async function fetchTonBalance(addr: string, testnet: boolean): Promise<string> {
  const base = testnet ? TESTNET_API : MAINNET_API;
  const res = await fetch(`${base}/getAddressBalance?address=${encodeURIComponent(addr)}`);
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'Failed to fetch balance');
  // Convert nanotons to TON (divide by 1e9)
  const nano = BigInt(data.result);
  const whole = nano / 1_000_000_000n;
  const frac = nano % 1_000_000_000n;
  const fracStr = frac.toString().padStart(9, '0').replace(/0+$/, '');
  return fracStr ? `${whole}.${fracStr}` : `${whole}`;
}

export function Wallet() {
  const wallet = useTonWallet();
  const address = useTonAddress();
  const { open } = useTonConnectModal();
  const [balance, setBalance] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchBalance = useCallback(async () => {
    if (!wallet || !address) {
      setBalance(null);
      return;
    }

    setLoading(true);
    try {
      const isTestnet = wallet.account.chain === CHAIN.TESTNET;
      const bal = await fetchTonBalance(address, isTestnet);
      setBalance(bal);
    } catch (err) {
      console.error('Failed to fetch balance:', err);
      setBalance('—');
    } finally {
      setLoading(false);
    }
  }, [wallet, address]);

  useEffect(() => {
    fetchBalance();
    if (!wallet) return;
    const interval = setInterval(fetchBalance, 15000);
    return () => clearInterval(interval);
  }, [fetchBalance, wallet]);

  const shortAddress = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : '';

  const formatBalance = (val: string | null) => {
    if (val === null || val === '—') return val ?? '0.00';
    const num = parseFloat(val);
    return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  };

  // Not connected — show centered connect prompt
  if (!wallet) {
    return (
      <div>
        <header className="header">
          <div className="header-left">
            <button className="header-menu-btn" aria-label="Menu">
              <span className="material-symbols-outlined">menu</span>
            </button>
            <h1 className="header-title">Wallet</h1>
          </div>
          <div className="header-right">
            <div className="header-avatar">
              <span className="material-symbols-outlined">person</span>
            </div>
          </div>
        </header>

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 'calc(100dvh - 200px)',
          textAlign: 'center',
          padding: '0 32px',
          gap: 24,
        }}>
          <div style={{
            width: 80,
            height: 80,
            borderRadius: '50%',
            background: 'rgba(150, 204, 255, 0.08)',
            border: '1px solid rgba(150, 204, 255, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 36, color: 'var(--primary)' }}>
              account_balance_wallet
            </span>
          </div>
          <div>
            <h2 style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: 22,
              fontWeight: 700,
              marginBottom: 8,
            }}>
              Connect Your Wallet
            </h2>
            <p style={{
              fontSize: 14,
              color: 'var(--on-surface-variant)',
              lineHeight: 1.5,
            }}>
              Connect your TON wallet to view your balance and interact with the agent marketplace.
            </p>
          </div>
          <button
            className="btn btn-primary"
            onClick={open}
            style={{ maxWidth: 280 }}
          >
            <span className="material-symbols-outlined" style={{ marginRight: 8, fontSize: 20 }}>link</span>
            Connect Wallet
          </button>
        </div>
      </div>
    );
  }

  // Connected — show real wallet data
  return (
    <div>
      <header className="header">
        <div className="header-left">
          <button className="header-menu-btn" aria-label="Menu">
            <span className="material-symbols-outlined">menu</span>
          </button>
          <h1 className="header-title">Wallet</h1>
        </div>
        <div className="header-right">
          <TonConnectButton />
          <div className="header-avatar">
            <span className="material-symbols-outlined">person</span>
          </div>
        </div>
      </header>

      <div className="space-y" style={{ paddingTop: 24 }}>
        {wallet.account.chain === CHAIN.MAINNET && (
          <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid var(--danger)', borderRadius: 'var(--radius-lg)', padding: '16px', marginBottom: '16px', textAlign: 'center' }}>
            <p style={{ color: 'var(--danger)', fontSize: 13, fontWeight: 600 }}>
              Mainnet Detected!
            </p>
            <p style={{ color: 'var(--on-surface-variant)', fontSize: 12, marginTop: 4 }}>
              Please switch your wallet to <b>Testnet</b> to use this preview app.
            </p>
          </div>
        )}

        {/* Balance Card */}
        <div className="glass-card">
          <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
            <span className="balance-label">Current Balance</span>
            <h2 className="balance-value">
              {loading && balance === null ? '...' : formatBalance(balance)} <span className="balance-unit">TON</span>
            </h2>
            <p style={{ marginTop: 12, fontSize: 13, color: 'var(--on-surface-variant)', fontFamily: "'Space Grotesk', monospace" }}>
              {shortAddress}
            </p>
          </div>
        </div>

        {/* Network Info */}
        <div className="stats-grid">
          <div className="stat-card">
            <span className="material-symbols-outlined stat-icon" style={{ color: 'var(--primary)' }}>lan</span>
            <div>
              <p className="stat-label">Network</p>
              <p className="stat-value" style={{ fontSize: 16 }}>
                {wallet.account.chain === CHAIN.TESTNET ? 'Testnet' : 'Mainnet'}
              </p>
            </div>
          </div>
          <div className="stat-card">
            <span className="material-symbols-outlined stat-icon" style={{ color: 'var(--tertiary)' }}>account_balance_wallet</span>
            <div>
              <p className="stat-label">Wallet</p>
              <p className="stat-value" style={{ fontSize: 16 }}>
                {wallet.device.appName || 'Unknown'}
              </p>
            </div>
          </div>
        </div>

        {/* Refresh */}
        <button
          className="btn btn-secondary"
          onClick={fetchBalance}
          disabled={loading}
          style={{ opacity: loading ? 0.6 : 1 }}
        >
          <span className="material-symbols-outlined" style={{ marginRight: 8, fontSize: 20 }}>refresh</span>
          {loading ? 'Refreshing...' : 'Refresh Balance'}
        </button>
      </div>
    </div>
  );
}
