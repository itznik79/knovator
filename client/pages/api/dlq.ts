import type { NextApiRequest, NextApiResponse } from 'next';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const path = req.url?.replace('/api/dlq', '') || '';
  try {
    if (req.method === 'GET') {
      const proxied = await fetch(`${API_URL}/admin/dlq${path}`, { method: 'GET' });
      const data = await proxied.json();
      return res.status(proxied.status).json(data);
    }

    if (req.method === 'POST') {
      // requeue
      const proxied = await fetch(`${API_URL}/admin/dlq${path}`, { method: 'POST' });
      const data = await proxied.json();
      return res.status(proxied.status).json(data);
    }

    if (req.method === 'DELETE') {
      const proxied = await fetch(`${API_URL}/admin/dlq${path}`, { method: 'DELETE' });
      const data = await proxied.json();
      return res.status(proxied.status).json(data);
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err: any) {
    res.status(500).json({ error: String(err) });
  }
}
