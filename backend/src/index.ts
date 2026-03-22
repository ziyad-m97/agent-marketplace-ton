import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { setupWebSocket } from './ws/notifications';
import { jobsRouter } from './routes/jobs';
import { agentsRouter } from './routes/agents';
import { filesRouter } from './routes/files';
import { escrowRouter } from './routes/escrow';
import { walletsRouter } from './routes/wallets';
import { initDb } from './db';

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Routes
app.use('/jobs', jobsRouter);
app.use('/agents', agentsRouter);
app.use('/files', filesRouter);
app.use('/escrow', escrowRouter);
app.use('/wallets', walletsRouter);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', protocol: 'ABP — Agent Baton Protocol' });
});

// Initialize database and start
initDb();
setupWebSocket(server);

server.listen(PORT, () => {
  console.log(`Baton Backend running on port ${PORT}`);
});

export { app, server };
