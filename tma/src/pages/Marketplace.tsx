import { useEffect, useState, useRef } from 'react';
import { TonConnectButton, useTonAddress } from '@tonconnect/ui-react';

interface Agent {
  id: number;
  address: string;
  name: string | null;
  skills: string[];
  price_per_job: number;
  reputation: number;
  total_jobs: number;
  description: string | null;
  total_earnings?: number;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const API_HEADERS: HeadersInit = { 'ngrok-skip-browser-warning': 'true' };

export function Marketplace() {
  const address = useTonAddress();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [statsModalAgent, setStatsModalAgent] = useState<Agent | null>(null);

  // Become a Specialist states
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [skills, setSkills] = useState('');
  const [price, setPrice] = useState('2.5');
  const [isRegistering, setIsRegistering] = useState(false);

  // Interaction refs
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPress = useRef<boolean>(false);

  const fetchAgents = () => {
    fetch(`${API_URL}/agents?active=true`, { headers: API_HEADERS })
      .then(res => res.json())
      .then(data => {
        setAgents(data.agents || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchAgents();
  }, []);

  const handleRegister = async () => {
    if (!address) {
      alert("Please connect your TON wallet first!");
      return;
    }
    if (!name.trim()) {
      alert("Please give your specialist a name.");
      return;
    }
    if (!description.trim()) {
      alert("Please provide a description of your agent's capabilities.");
      return;
    }

    setIsRegistering(true);
    try {
      const res = await fetch(`${API_URL}/agents/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...API_HEADERS },
        body: JSON.stringify({
          address,
          name,
          description,
          price_per_job: Number(price),
          skills: skills.split(',').map(s => s.trim()).filter(Boolean)
        })
      });

      if (!res.ok) throw new Error('Registration failed');

      alert("Successfully registered as a Specialist!");
      setName('');
      setDescription('');
      setSkills('');
      setShowAddModal(false);
      fetchAgents();
    } catch (err) {
      console.error(err);
      alert("Failed to register. Make sure the backend is running.");
    } finally {
      setIsRegistering(false);
    }
  };

  const handlePointerDown = (agent: Agent) => {
    if (agent.address !== address) return;

    isLongPress.current = false;
    timerRef.current = setTimeout(() => {
      isLongPress.current = true;
      if (confirm("Do you want to suppress (delete) your agent?")) {
        deleteAgent(agent.id);
      }
    }, 600);
  };

  const handlePointerUpOrLeave = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleCardClick = async (agent: Agent) => {
    if (isLongPress.current) return;

    if (agent.address === address) {
      try {
        const res = await fetch(`${API_URL}/agents/${agent.id}`, { headers: API_HEADERS });
        const data = await res.json();
        if (data.agent) {
          setStatsModalAgent(data.agent);
        }
      } catch (err) {
        console.error("Failed to fetch agent stats", err);
      }
    }
  };

  const deleteAgent = async (agentId: number) => {
    try {
      const res = await fetch(`${API_URL}/agents/${agentId}`, {
        method: 'DELETE',
        headers: API_HEADERS,
      });
      if (res.ok) {
        fetchAgents();
      } else {
        const body = await res.json();
        alert(body.error || "Failed to delete agent");
      }
    } catch {
      alert("Failed to delete agent");
    }
  };

  // Split agents: mine on top, others below
  const myAgents = agents.filter(a => a.address === address);
  const otherAgents = agents.filter(a => a.address !== address);

  const displayName = (agent: Agent) =>
    agent.name || `@${agent.address.slice(0, 6)}...${agent.address.slice(-4)}`;

  const renderAgentCard = (agent: Agent, isMine: boolean) => (
    <div
      className="agent-card"
      key={agent.id}
      onPointerDown={() => handlePointerDown(agent)}
      onPointerUp={handlePointerUpOrLeave}
      onPointerLeave={handlePointerUpOrLeave}
      onClick={() => handleCardClick(agent)}
      style={{
        userSelect: isMine ? 'none' : 'auto',
        cursor: isMine ? 'pointer' : 'default',
        border: isMine ? '1px solid var(--primary)' : '1px solid var(--border-subtle)',
      }}
      title={isMine ? "Tap for stats, long press to delete" : "Specialist Agent"}
    >
      <div className="agent-info">
        <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {agent.name || 'Unnamed Agent'}
          {isMine && <span className="badge badge-info" style={{ padding: '2px 8px', fontSize: 10 }}>You</span>}
        </h3>
        <p style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: "'Space Grotesk', monospace" }}>
          {agent.address.slice(0, 6)}...{agent.address.slice(-4)}
        </p>
        {agent.description && (
          <p style={{ fontSize: 12, color: 'var(--on-surface-variant)', marginTop: 4, marginBottom: 6, lineHeight: 1.4 }}>
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
        <div className="agent-rating" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 6, marginBottom: 2 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'var(--tertiary)' }}>star</span>
          <span style={{ fontWeight: 700, color: 'var(--on-surface)', fontSize: 13 }}>
            {agent.reputation > 0 ? agent.reputation.toFixed(1) : 'New'}
          </span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--on-surface-variant)' }}>{agent.total_jobs} jobs</div>
      </div>
    </div>
  );

  if (loading) {
    return <div className="empty"><p>Loading specialists...</p></div>;
  }

  return (
    <div>
      <header className="header">
        <div className="header-left">
          <button className="header-menu-btn" onClick={() => setShowAddModal(true)} aria-label="Add Agent">
            <span className="material-symbols-outlined">add</span>
          </button>
          <h1 className="header-title">Agents</h1>
        </div>
        <div className="header-right">
          <TonConnectButton />
          <div className="header-avatar">
            <span className="material-symbols-outlined">person</span>
          </div>
        </div>
      </header>

      <div style={{ paddingTop: showAddModal ? 0 : 24 }}>
        {showAddModal && (
          <div className="space-y" style={{ paddingBottom: 24, paddingTop: 24, borderBottom: '1px solid var(--border-subtle)', marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 className="page-title" style={{ marginBottom: 0 }}>Host Agent</h2>
              <button
                className="header-menu-btn"
                onClick={() => setShowAddModal(false)}
                style={{ padding: 0 }}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="card">
              <p style={{ fontSize: 12, color: 'var(--on-surface-variant)', marginBottom: 16, lineHeight: 1.5 }}>
                Register your specialist agent to receive jobs from the marketplace.
              </p>

              <label style={{ fontSize: 13, color: 'var(--on-surface-variant)', display: 'block', marginBottom: 10, fontWeight: 600 }}>
                Name
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="glass-input"
                placeholder="e.g. RenderBot, DeckMaster, DataCruncher..."
                style={{ marginBottom: 16 }}
              />

              <label style={{ fontSize: 13, color: 'var(--on-surface-variant)', display: 'block', marginBottom: 10, fontWeight: 600 }}>
                Description
              </label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="glass-input"
                rows={3}
                placeholder="What can your agent do?"
                style={{ resize: 'vertical', width: '100%', marginBottom: 16 }}
              />

              <label style={{ fontSize: 13, color: 'var(--on-surface-variant)', display: 'block', marginBottom: 10, fontWeight: 600 }}>
                Skills (comma-separated)
              </label>
              <input
                type="text"
                value={skills}
                onChange={e => setSkills(e.target.value)}
                className="glass-input"
                placeholder="e.g. 3d-rendering, product-mockup, blender"
                style={{ marginBottom: 16 }}
              />

              <label style={{ fontSize: 13, color: 'var(--on-surface-variant)', display: 'block', marginBottom: 10, fontWeight: 600 }}>
                Price per Job (TON)
              </label>
              <input
                type="number"
                step="0.1"
                value={price}
                onChange={e => setPrice(e.target.value)}
                className="glass-input"
                style={{ marginBottom: 16 }}
              />

              <button
                className="btn btn-primary"
                onClick={handleRegister}
                disabled={isRegistering}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18, marginRight: 8 }}>verified</span>
                {isRegistering ? 'Registering...' : 'Register Agent'}
              </button>
            </div>
          </div>
        )}

        {/* Host Stats Modal Overlay */}
        {statsModalAgent && (
          <div style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(5px)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16
          }}>
            <div className="glass-card" style={{ width: '100%', maxWidth: 400, position: 'relative' }}>
              <button
                onClick={() => setStatsModalAgent(null)}
                style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}
              >
                <span className="material-symbols-outlined">close</span>
              </button>

              <h2 className="page-title" style={{ marginTop: 0, marginBottom: 4 }}>{displayName(statsModalAgent)}</h2>
              <p style={{ color: 'var(--primary)', fontFamily: 'monospace', fontSize: 12, marginBottom: 24 }}>
                {statsModalAgent.address.slice(0, 10)}...{statsModalAgent.address.slice(-6)}
              </p>

              <div className="stats-grid">
                <div className="stat-card">
                  <span className="material-symbols-outlined stat-icon" style={{ color: 'var(--tertiary)' }}>task_alt</span>
                  <div>
                    <p className="stat-label">Total Jobs</p>
                    <p className="stat-value" style={{ color: 'var(--tertiary)' }}>{statsModalAgent.total_jobs}</p>
                  </div>
                </div>

                <div className="stat-card">
                  <span className="material-symbols-outlined stat-icon" style={{ color: 'var(--primary)' }}>star</span>
                  <div>
                    <p className="stat-label">Rating</p>
                    <p className="stat-value">{statsModalAgent.reputation > 0 ? `${statsModalAgent.reputation.toFixed(1)} ★` : 'New'}</p>
                  </div>
                </div>

                <div className="stat-card" style={{ gridColumn: 'span 2', marginTop: 8 }}>
                  <span className="material-symbols-outlined stat-icon" style={{ color: '#FCD535' }}>account_balance</span>
                  <div>
                    <p className="stat-label">Total Earnings</p>
                    <p className="stat-value" style={{ color: '#FCD535' }}>{statsModalAgent.total_earnings || 0} TON</p>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 24 }}>
                <button className="btn" style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }} onClick={() => setStatsModalAgent(null)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* My Specialists */}
        {!showAddModal && myAgents.length > 0 && (
          <>
            <h2 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--primary)' }}>person</span>
              My Specialists
            </h2>
            <div className="space-y-sm" style={{ marginBottom: 24 }}>
              {myAgents.map(agent => renderAgentCard(agent, true))}
            </div>
          </>
        )}

        {/* Other Specialists */}
        {!showAddModal && (
          <h2 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--tertiary)' }}>groups</span>
            {myAgents.length > 0 ? 'Marketplace' : 'Specialists'}
          </h2>
        )}

        {!showAddModal && otherAgents.length === 0 && myAgents.length === 0 && (
          <div className="empty">
            <p>No specialists registered yet</p>
            <p style={{ fontSize: 13, marginTop: 12, color: 'var(--on-surface-variant)' }}>
              Specialists will appear here once they register on the protocol
            </p>
          </div>
        )}

        {!showAddModal && otherAgents.length === 0 && myAgents.length > 0 && (
          <div className="empty">
            <p>No other specialists yet</p>
            <p style={{ fontSize: 13, marginTop: 12, color: 'var(--on-surface-variant)' }}>
              Other specialists will appear here as they join
            </p>
          </div>
        )}

        {!showAddModal && otherAgents.length > 0 && (
          <div className="space-y-sm">
            {otherAgents.map(agent => renderAgentCard(agent, false))}
          </div>
        )}
      </div>
    </div>
  );
}
