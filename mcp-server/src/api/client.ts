import fs from 'fs';
import path from 'path';

export class ApiClient {
  public baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  private async request(endpoint: string, options: RequestInit = {}): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!res.ok) {
      const errBody: any = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(errBody.error || `HTTP ${res.status}`);
    }

    return res.json();
  }

  // === Agents ===

  async searchAgents(skill?: string, maxBudget?: number) {
    return this.request('/jobs/search', {
      method: 'POST',
      body: JSON.stringify({ skill, max_budget: maxBudget }),
    });
  }

  async registerAgent(address: string, skills: string[], pricePerJob: number, description?: string) {
    return this.request('/agents/register', {
      method: 'POST',
      body: JSON.stringify({ address, skills, price_per_job: pricePerJob, description }),
    });
  }

  // === Jobs ===

  async createJob(data: {
    hirer_address: string;
    worker_address: string;
    task: string;
    context: string;
    escrow_address: string;
    amount: number;
  }) {
    return this.request('/jobs/create', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getJob(jobId: string) {
    return this.request(`/jobs/${jobId}`);
  }

  async getJobs(filters: { hirer?: string; worker?: string; status?: string } = {}) {
    const params = new URLSearchParams();
    if (filters.hirer) params.set('hirer', filters.hirer);
    if (filters.worker) params.set('worker', filters.worker);
    if (filters.status) params.set('status', filters.status);
    return this.request(`/jobs?${params.toString()}`);
  }

  async acceptJob(jobId: string, workerAddress: string) {
    return this.request(`/jobs/${jobId}/accept`, {
      method: 'PATCH',
      body: JSON.stringify({ worker_address: workerAddress }),
    });
  }

  async deliverJob(jobId: string, message: string) {
    return this.request(`/jobs/${jobId}/deliver`, {
      method: 'PATCH',
      body: JSON.stringify({ message }),
    });
  }

  async confirmJob(jobId: string) {
    return this.request(`/jobs/${jobId}/confirm`, {
      method: 'PATCH',
    });
  }

  async rateJob(jobId: string, rating: number) {
    return this.request(`/jobs/${jobId}/rate`, {
      method: 'POST',
      body: JSON.stringify({ rating }),
    });
  }

  // === Files ===

  async uploadFiles(jobId: string, filePaths: string[], uploadedBy: string) {
    const formData = new FormData();
    formData.append('job_id', jobId);
    formData.append('uploaded_by', uploadedBy);

    for (const filePath of filePaths) {
      const fileBuffer = fs.readFileSync(filePath);
      const fileName = path.basename(filePath);
      const blob = new Blob([fileBuffer]);
      formData.append('files', blob, fileName);
    }

    const res = await fetch(`${this.baseUrl}/files/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      const errBody: any = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(errBody.error || `HTTP ${res.status}`);
    }

    return res.json();
  }
}
