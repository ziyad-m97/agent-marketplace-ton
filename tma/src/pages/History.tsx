import { useEffect, useState } from 'react';
import { TonConnectButton } from '@tonconnect/ui-react';

interface Job {
  id: string;
  task: string;
  worker_address: string;
  status: string;
  amount: number;
  created_at: string;
  rating: number | null;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

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

export function History() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/jobs`)
      .then(res => res.json())
      .then(data => {
        setJobs(data.jobs || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="empty"><p>Loading jobs...</p></div>;
  }

  if (jobs.length === 0) {
    return (
      <div className="empty">
        <p>No delegations yet</p>
        <p style={{ fontSize: 13, marginTop: 12, color: 'var(--on-surface-variant)' }}>
          Jobs will appear here when your agent passes the baton
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Top App Bar */}
      <header className="header">
        <div className="header-left">
          <button className="header-menu-btn" aria-label="Menu">
            <span className="material-symbols-outlined">menu</span>
          </button>
          <h1 className="header-title">History</h1>
        </div>
        <div className="header-right">
          <TonConnectButton />
          <div className="header-avatar">
            <span className="material-symbols-outlined">person</span>
          </div>
        </div>
      </header>

      <div style={{ paddingTop: 24 }}>
        <h2 className="page-title">Job History</h2>

        <div className="space-y-sm">
        {jobs.map(job => (
          <div className="job-item" key={job.id}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
              <div className="tx-icon">
                <span
                  className="material-symbols-outlined"
                  style={{ color: 'var(--primary)', fontSize: 20 }}
                >
                  {STATUS_ICON[job.status] || 'help'}
                </span>
              </div>
              <div>
                <div className="job-task">{job.task}</div>
                <div className="job-meta">
                  @{job.worker_address} · {new Date(job.created_at).toLocaleDateString()}
                </div>
              </div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <span className={`badge ${STATUS_BADGE[job.status] || 'badge-info'}`}>
                {job.status}
              </span>
              <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 15, fontWeight: 700, marginTop: 6 }}>
                {job.amount} TON
              </div>
              {job.rating && (
                <div style={{ fontSize: 12, color: 'var(--tertiary)', marginTop: 2 }}>
                  {'★'.repeat(job.rating)}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
    </div>
  );
}
