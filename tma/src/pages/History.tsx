import { useEffect, useState } from 'react';
import { TonConnectButton } from '@tonconnect/ui-react';

interface Job {
  id: string;
  task: string;
  worker_address: string;
  hirer_address: string;
  status: string;
  amount: number;
  created_at: string;
  rating: number | null;
  escrow_address: string | null;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const API_HEADERS: HeadersInit = { 'ngrok-skip-browser-warning': 'true' };

const STATUS_BADGE: Record<string, string> = {
  created: 'badge-info',
  accepted: 'badge-info',
  delivered: 'badge-warning',
  completed: 'badge-success',
  disputed: 'badge-danger',
  expired: 'badge-danger',
};

const STATUS_ICON: Record<string, string> = {
  created: 'schedule',
  accepted: 'handshake',
  delivered: 'inventory',
  completed: 'check_circle',
  disputed: 'gavel',
  expired: 'timer_off',
};

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function History() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/jobs`, { headers: API_HEADERS })
      .then(res => res.json())
      .then(data => {
        const all: Job[] = data.jobs || [];
        // Show most recent first
        all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setJobs(all);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="empty"><p>Loading jobs...</p></div>;
  }

  if (jobs.length === 0) {
    return (
      <div>
        <header className="header">
          <div className="header-left">
            <button className="header-menu-btn" aria-label="Menu">
              <span className="material-symbols-outlined">menu</span>
            </button>
            <h1 className="header-title">History</h1>
          </div>
          <div className="header-right">
            <TonConnectButton />
          </div>
        </header>
        <div className="empty">
          <p>No delegations yet</p>
          <p style={{ fontSize: 13, marginTop: 12, color: 'var(--on-surface-variant)' }}>
            Jobs will appear here when your agent passes the baton
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <header className="header">
        <div className="header-left">
          <button className="header-menu-btn" aria-label="Menu">
            <span className="material-symbols-outlined">menu</span>
          </button>
          <h1 className="header-title">History</h1>
        </div>
        <div className="header-right">
          <TonConnectButton />
        </div>
      </header>

      <div style={{ paddingTop: 24 }}>
        <div className="space-y-sm">
          {jobs.map(job => {
            const isOnChain = job.escrow_address && !job.escrow_address.startsWith('pending');
            return (
              <div className="job-item" key={job.id} style={{ padding: '16px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flex: 1, minWidth: 0 }}>
                  <div className="tx-icon">
                    <span
                      className="material-symbols-outlined"
                      style={{ color: 'var(--primary)', fontSize: 20 }}
                    >
                      {STATUS_ICON[job.status] || 'help'}
                    </span>
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div className="job-task" style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.3 }}>
                      {job.task}
                    </div>
                    <div className="job-meta" style={{ fontSize: 11, color: 'var(--on-surface-variant)', marginTop: 4 }}>
                      {shortAddr(job.worker_address)} · {timeAgo(job.created_at)}
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 8 }}>
                  <span className={`badge ${STATUS_BADGE[job.status] || 'badge-info'}`}>
                    {job.status}
                  </span>
                  <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 14, fontWeight: 700, marginTop: 6 }}>
                    {job.amount} TON
                  </div>
                  {isOnChain && (
                    <div style={{ fontSize: 10, color: 'var(--primary)', marginTop: 2 }}>
                      on-chain
                    </div>
                  )}
                  {job.rating && (
                    <div style={{ fontSize: 12, color: 'var(--tertiary)', marginTop: 2 }}>
                      {'★'.repeat(job.rating)}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
