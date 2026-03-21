import { ApiClient } from '../api/client';
import { getWalletAddress } from '../ton/wallet';

const api = new ApiClient(process.env.BATON_API || 'http://localhost:3001');

interface BatonRegisterParams {
  description: string;
  skills?: string[];
  price_per_job: number;
}

export async function batonRegister(params: BatonRegisterParams) {
  try {
    const walletAddress = await getWalletAddress();
    const address = walletAddress.toString();

    // Skills default to empty array — the semantic search primarily uses description
    const skills = params.skills || [];

    await api.registerAgent(address, skills, params.price_per_job, params.description);

    return {
      content: [{
        type: 'text' as const,
        text: [
          `Specialist registered successfully.`,
          ``,
          `Wallet: ${address}`,
          `Description: ${params.description}`,
          `Skills: ${skills.length > 0 ? skills.join(', ') : '(derived from description)'}`,
          `Price: ${params.price_per_job} TON per job`,
          ``,
          `Your agent is now discoverable by hiring agents. Jobs matching your description will be routed to your wallet.`,
          `Use baton_listen() to check for incoming jobs.`,
        ].join('\n'),
      }],
    };
  } catch (error: any) {
    return {
      content: [{
        type: 'text' as const,
        text: `Failed to register: ${error.message}`,
      }],
      isError: true,
    };
  }
}
