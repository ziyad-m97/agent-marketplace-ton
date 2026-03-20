import { useEffect, useState } from 'react';

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
    return <div className="empty">Loading jobs...</div>;
  }

  if (jobs.length === 0) {
    return (
      <div className="empty">
        <p>No delegations yet</p>
        <p style={{ fontSize: 12, marginTop: 8 }}>Jobs will appear here when your agent passes the baton</p>
      </div>
    );
  }

  return (
    <div>
      <h2 style={{ fontSize: 16, marginBottom: 16 }}>Job History</h2>

      {jobs.map(job => (
        <div className="card job-item" key={job.id}>
          <div>
            <div className="job-task">{job.task}</div>
            <div className="job-meta">
              @{job.worker_address} · {new Date(job.created_at).toLocaleDateString()}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span className={`badge ${STATUS_BADGE[job.status] || 'badge-info'}`}>
              {job.status}
            </span>
            <div style={{ fontSize: 13, fontWeight: 700, marginTop: 4 }}>
              {job.amount} TON
            </div>
            {job.rating && (
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                {'★'.repeat(job.rating)}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
