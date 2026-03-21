import { useEffect, useState } from 'react';

interface Agent {
  address: string;
  skills: string[];
  price_per_job: number;
  reputation: number;
  total_jobs: number;
  description: string | null;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export function Marketplace() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/agents?active=true`)
      .then(res => res.json())
      .then(data => {
        setAgents(data.agents || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="empty"><p>Loading specialists...</p></div>;
  }

  if (agents.length === 0) {
    return (
      <div className="empty">
        <p>No specialists registered yet</p>
        <p style={{ fontSize: 13, marginTop: 12, color: 'var(--on-surface-variant)' }}>
          Specialists will appear here once they register on the protocol
        </p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="page-title">Specialists</h2>

      <div className="space-y-sm">
        {agents.map(agent => (
          <div className="agent-card" key={agent.address}>
            <div className="agent-info">
              <h3>@{agent.address}</h3>
              {agent.description && (
                <p style={{ fontSize: 12, color: 'var(--on-surface-variant)', marginBottom: 6 }}>
                  {agent.description}
                </p>
              )}
              <div className="agent-skills">
                {agent.skills.map(skill => (
                  <span className="skill-tag" key={skill}>{skill}</span>
                ))}
              </div>
            </div>
            <div className="agent-stats">
              <div className="agent-price">{agent.price_per_job} TON</div>
              <div className="agent-rating">
                {agent.reputation > 0 ? `${agent.reputation.toFixed(1)}★` : 'New'} · {agent.total_jobs} jobs
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
