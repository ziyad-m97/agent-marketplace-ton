import { useState, useEffect, useCallback } from 'react';
import { useTonWallet, useTonAddress, useTonConnectModal, useTonConnectUI, CHAIN, TonConnectButton } from '@tonconnect/ui-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const API_HEADERS: HeadersInit = { 'ngrok-skip-browser-warning': 'true' };

export function Wallet() {
  const wallet = useTonWallet();
  const tonConnectAddress = useTonAddress();
  const { open } = useTonConnectModal();

  const [batonAddress, setBatonAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [initialBalance, setInitialBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  // TonConnect UI for deposit
  const [tonConnectUI] = useTonConnectUI();

  // Deposit state
  const [depositAmount, setDepositAmount] = useState('2');
  const [depositing, setDepositing] = useState(false);
  const [depositResult, setDepositResult] = useState<string | null>(null);

  // Withdraw state
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawResult, setWithdrawResult] = useState<string | null>(null);

  // Get or create Baton wallet + fetch balance
  const fetchBatonWallet = useCallback(async () => {
    if (!tonConnectAddress) {
      setBatonAddress(null);
      setBalance(null);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/wallets/get-or-create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...API_HEADERS },
        body: JSON.stringify({ ton_connect_address: tonConnectAddress }),
      });
      const data = await res.json();
      setBatonAddress(data.baton_address);
      setBalance(data.balance_ton);

      // Track initial balance for spending
      const stored = localStorage.getItem(`baton_initial_${tonConnectAddress}`);
      if (stored) {
        setInitialBalance(parseFloat(stored));
      } else if (data.balance_ton > 0) {
        localStorage.setItem(`baton_initial_${tonConnectAddress}`, String(data.balance_ton));
        setInitialBalance(data.balance_ton);
      }
    } catch (err) {
      console.error('Failed to fetch Baton wallet:', err);
    } finally {
      setLoading(false);
    }
  }, [tonConnectAddress]);

  // Refresh just the balance
  const refreshBalance = useCallback(async () => {
    if (!tonConnectAddress) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/wallets/${encodeURIComponent(tonConnectAddress)}/balance`, {
        headers: API_HEADERS,
      });
      const data = await res.json();
      setBalance(data.balance_ton);
    } catch (err) {
      console.error('Balance refresh failed:', err);
    } finally {
      setLoading(false);
    }
  }, [tonConnectAddress]);

  useEffect(() => {
    fetchBatonWallet();
    if (!tonConnectAddress) return;
    const interval = setInterval(refreshBalance, 15000);
    return () => clearInterval(interval);
  }, [fetchBatonWallet, refreshBalance, tonConnectAddress]);

  const handleDeposit = async () => {
    if (!batonAddress || !depositAmount) return;
    setDepositing(true);
    setDepositResult(null);
    try {
      const amountNano = BigInt(Math.floor(parseFloat(depositAmount) * 1e9)).toString();
      await tonConnectUI.sendTransaction({
        validUntil: Math.floor(Date.now() / 1000) + 600,
        messages: [{ address: batonAddress, amount: amountNano }],
      });
      setDepositResult(`Deposited ${depositAmount} TON`);
      setDepositAmount('2');
      setTimeout(refreshBalance, 8000);
    } catch (err: any) {
      if (err?.message?.includes('Cancelled') || err?.message?.includes('rejected')) {
        setDepositResult(null);
      } else {
        setDepositResult(`Error: ${err.message}`);
      }
    } finally {
      setDepositing(false);
    }
  };

  const handleWithdraw = async () => {
    if (!tonConnectAddress || !withdrawAmount) return;
    setWithdrawing(true);
    setWithdrawResult(null);
    try {
      const res = await fetch(`${API_URL}/wallets/withdraw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...API_HEADERS },
        body: JSON.stringify({
          ton_connect_address: tonConnectAddress,
          to_address: tonConnectAddress, // withdraw to personal wallet
          amount: parseFloat(withdrawAmount),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setWithdrawResult(`Sent ${withdrawAmount} TON to your personal wallet`);
        setWithdrawAmount('');
        setTimeout(refreshBalance, 5000);
      } else {
        setWithdrawResult(`Error: ${data.error}`);
      }
    } catch (err: any) {
      setWithdrawResult(`Error: ${err.message}`);
    } finally {
      setWithdrawing(false);
    }
  };

  const shortAddress = (addr: string | null) =>
    addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : '';

  const formatBalance = (val: number | null) => {
    if (val === null) return '0.00';
    return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  };

  const spent = initialBalance !== null && balance !== null
    ? Math.max(0, initialBalance - balance) : 0;
  const usagePercent = initialBalance && initialBalance > 0
    ? Math.min(100, (spent / initialBalance) * 100) : 0;

  const resetInitialBalance = () => {
    if (!tonConnectAddress) return;
    localStorage.removeItem(`baton_initial_${tonConnectAddress}`);
    if (balance !== null && balance > 0) {
      localStorage.setItem(`baton_initial_${tonConnectAddress}`, String(balance));
      setInitialBalance(balance);
    } else {
      setInitialBalance(null);
    }
  };

  // Not connected
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
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          minHeight: 'calc(100dvh - 200px)', textAlign: 'center', padding: '0 32px', gap: 24,
        }}>
          <div style={{
            width: 80, height: 80, borderRadius: '50%',
            background: 'rgba(150, 204, 255, 0.08)', border: '1px solid rgba(150, 204, 255, 0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 36, color: 'var(--primary)' }}>
              account_balance_wallet
            </span>
          </div>
          <div>
            <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
              Connect Your Wallet
            </h2>
            <p style={{ fontSize: 14, color: 'var(--on-surface-variant)', lineHeight: 1.5 }}>
              Connect your TON wallet to create your Baton account and start delegating or earning.
            </p>
          </div>
          <button className="btn btn-primary" onClick={() => open()} style={{ maxWidth: 280 }}>
            <span className="material-symbols-outlined" style={{ marginRight: 8, fontSize: 20 }}>link</span>
            Connect Wallet
          </button>
        </div>
      </div>
    );
  }

  // Connected
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
        {/* Baton Wallet Balance Card */}
        <div className="glass-card">
          <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
            <span className="balance-label">Baton Balance</span>
            <h2 className="balance-value">
              {loading && balance === null ? '...' : formatBalance(balance)} <span className="balance-unit">TON</span>
            </h2>
            <p style={{ marginTop: 12, fontSize: 13, color: 'var(--on-surface-variant)', fontFamily: "'Space Grotesk', monospace" }}>
              {shortAddress(batonAddress)}
            </p>
          </div>
        </div>

        {/* Agent Spending Bar */}
        {initialBalance !== null && initialBalance > 0 && (
          <div style={{ background: 'var(--surface-container)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--tertiary)' }}>smart_toy</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--on-surface)' }}>Agent Spending</span>
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: usagePercent > 75 ? 'var(--danger)' : usagePercent > 50 ? 'var(--warning)' : 'var(--primary)' }}>
                {usagePercent.toFixed(1)}%
              </span>
            </div>
            <div style={{ width: '100%', height: 10, borderRadius: 5, background: 'var(--surface-container-highest)', overflow: 'hidden' }}>
              <div style={{
                width: `${usagePercent}%`, height: '100%', borderRadius: 5,
                background: usagePercent > 75
                  ? 'linear-gradient(90deg, var(--warning), var(--danger))'
                  : usagePercent > 50
                    ? 'linear-gradient(90deg, var(--primary), var(--warning))'
                    : 'linear-gradient(90deg, var(--primary), var(--primary-container))',
                transition: 'width 0.6s ease',
              }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
              <span style={{ fontSize: 11, color: 'var(--on-surface-variant)' }}>
                {spent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })} TON spent
              </span>
              <span style={{ fontSize: 11, color: 'var(--on-surface-variant)' }}>
                of {initialBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })} TON
              </span>
            </div>
            <button onClick={resetInitialBalance} style={{
              marginTop: 12, background: 'none', border: 'none', color: 'var(--primary)',
              fontSize: 11, fontWeight: 700, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.1em', padding: 0,
            }}>
              Reset baseline
            </button>
          </div>
        )}

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
        <button className="btn btn-secondary" onClick={refreshBalance} disabled={loading} style={{ opacity: loading ? 0.6 : 1 }}>
          <span className="material-symbols-outlined" style={{ marginRight: 8, fontSize: 20 }}>refresh</span>
          {loading ? 'Refreshing...' : 'Refresh Balance'}
        </button>

        {/* Deposit Section */}
        <div style={{ background: 'var(--surface-container)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--tertiary)' }}>add_circle</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--on-surface)' }}>Deposit TON</span>
          </div>

          <input
            type="number" step="0.5" min="0" placeholder="Amount in TON"
            value={depositAmount} onChange={e => setDepositAmount(e.target.value)}
            className="glass-input" style={{ marginBottom: 12 }}
          />

          <button className="btn btn-primary" onClick={handleDeposit}
            disabled={depositing || !depositAmount || parseFloat(depositAmount) <= 0}>
            <span className="material-symbols-outlined" style={{ marginRight: 8, fontSize: 20 }}>
              {depositing ? 'hourglass_empty' : 'add_circle'}
            </span>
            {depositing ? 'Confirm in Tonkeeper...' : `Deposit ${depositAmount || ''} TON`}
          </button>

          {depositResult && (
            <p style={{
              fontSize: 12, marginTop: 12, textAlign: 'center', lineHeight: 1.5,
              color: depositResult.startsWith('Error') ? 'var(--danger)' : 'var(--primary)',
            }}>
              {depositResult}
            </p>
          )}

          <p style={{ fontSize: 11, color: 'var(--on-surface-variant)', marginTop: 12, lineHeight: 1.5, textAlign: 'center' }}>
            Transfers TON from your personal wallet to your Baton account.
          </p>
        </div>

        {/* Withdraw Section */}
        <div style={{ background: 'var(--surface-container)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--primary)' }}>send</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--on-surface)' }}>Withdraw to Personal Wallet</span>
          </div>

          <input
            type="number" step="0.1" min="0" placeholder="Amount in TON"
            value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)}
            className="glass-input" style={{ marginBottom: 12 }}
          />

          <button className="btn btn-secondary" onClick={handleWithdraw}
            disabled={withdrawing || !withdrawAmount || parseFloat(withdrawAmount) <= 0}>
            <span className="material-symbols-outlined" style={{ marginRight: 8, fontSize: 20 }}>
              {withdrawing ? 'hourglass_empty' : 'arrow_outward'}
            </span>
            {withdrawing ? 'Sending...' : 'Withdraw'}
          </button>

          {withdrawResult && (
            <p style={{
              fontSize: 12, marginTop: 12, textAlign: 'center', lineHeight: 1.5,
              color: withdrawResult.startsWith('Error') ? 'var(--danger)' : 'var(--primary)',
            }}>
              {withdrawResult}
            </p>
          )}

          <p style={{ fontSize: 11, color: 'var(--on-surface-variant)', marginTop: 12, lineHeight: 1.5, textAlign: 'center' }}>
            Withdraws to your connected wallet ({shortAddress(tonConnectAddress)})
          </p>
        </div>

        {/* Testnet Faucet Deposit */}
        <div style={{ background: 'var(--surface-container)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--on-surface-variant)' }}>water_drop</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--on-surface)' }}>Testnet Faucet</span>
          </div>

          <p style={{ fontSize: 12, color: 'var(--on-surface-variant)', marginBottom: 12, lineHeight: 1.5 }}>
            Send your Baton address to the faucet bot to receive free testnet TON.
          </p>

          <button className="btn btn-secondary" onClick={() => {
            if (batonAddress) {
              navigator.clipboard.writeText(batonAddress);
            }
          }} style={{ marginBottom: 8 }}>
            <span className="material-symbols-outlined" style={{ marginRight: 8, fontSize: 20 }}>content_copy</span>
            Copy Baton Address
          </button>

          <a href="https://t.me/testgiver_ton_bot" target="_blank" rel="noopener noreferrer"
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}>
            <span className="material-symbols-outlined" style={{ marginRight: 8, fontSize: 20 }}>open_in_new</span>
            Open Faucet Bot
          </a>
        </div>
      </div>
    </div>
  );
}
