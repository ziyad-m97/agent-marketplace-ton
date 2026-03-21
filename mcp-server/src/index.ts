import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { batonPass } from './tools/baton-pass';
import { batonStatus } from './tools/baton-status';
import { batonRate } from './tools/baton-rate';
import { batonListen } from './tools/baton-listen';
import { batonAccept } from './tools/baton-accept';
import { batonDeliver } from './tools/baton-deliver';
import { batonRegister } from './tools/baton-register';

const MODE = process.env.MODE || 'hiring';

const server = new McpServer({
  name: 'baton-protocol',
  version: '0.1.0',
});

// === HIRING MODE TOOLS ===
if (MODE === 'hiring') {
  server.tool(
    'baton_pass',
    'Find a specialist agent, lock TON in escrow, and submit a job. Use this when you need to delegate a task that requires credentials, infrastructure, or domain expertise you don\'t have.',
    {
      task: z.string().describe('Short description of the task to delegate'),
      context: z.string().optional().describe('Detailed context, requirements, and specifications'),
      required_skills: z.array(z.string()).optional().describe('Skills the specialist must have (e.g. ["3d-rendering", "pitch-deck"])'),
      max_budget: z.number().optional().describe('Maximum TON to spend on this delegation'),
    },
    async (params) => batonPass(params),
  );

  server.tool(
    'baton_status',
    'Check the status of a delegated job and retrieve deliverables if complete.',
    {
      job_id: z.string().describe('The job ID returned by baton_pass'),
    },
    async (params) => batonStatus(params),
  );

  server.tool(
    'baton_rate',
    'Rate a specialist after they deliver work. Rating affects their on-chain reputation.',
    {
      job_id: z.string().describe('The job ID to rate'),
      rating: z.number().min(1).max(5).describe('Rating from 1 (poor) to 5 (excellent)'),
    },
    async (params) => batonRate(params),
  );
}

// === WORKER MODE TOOLS ===
if (MODE === 'worker') {
  server.tool(
    'baton_register',
    'Register this agent as a specialist on the Baton Protocol. Your wallet address becomes your identity. Describe your capabilities in free text — hiring agents will find you via semantic search.',
    {
      description: z.string().describe('Free-text description of your capabilities (e.g. "I have Trellis 2 on an RTX 4090, I generate photorealistic 3D product renders")'),
      skills: z.array(z.string()).optional().describe('Optional skill tags for discoverability (e.g. ["3d-rendering", "product-visualization"])'),
      price_per_job: z.number().describe('Price in TON per job'),
    },
    async (params) => batonRegister(params),
  );

  server.tool(
    'baton_listen',
    'Check for incoming jobs that match your registered skills.',
    {},
    async () => batonListen(),
  );

  server.tool(
    'baton_accept',
    'Accept an incoming job and receive the full task details.',
    {
      job_id: z.string().describe('The job ID to accept'),
    },
    async (params) => batonAccept(params),
  );

  server.tool(
    'baton_deliver',
    'Submit deliverable files and a completion message for an accepted job.',
    {
      job_id: z.string().describe('The job ID to deliver'),
      message: z.string().describe('Delivery message describing what was done'),
      file_paths: z.array(z.string()).optional().describe('Paths to deliverable files'),
    },
    async (params) => batonDeliver(params),
  );
}

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`Baton MCP Server started in ${MODE} mode`);
}

main().catch(console.error);
