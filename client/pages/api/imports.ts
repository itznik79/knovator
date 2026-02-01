import type { NextApiRequest, NextApiResponse } from 'next';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const qs = req.url?.split('?')[1] || '';
  try {
    const proxied = await fetch(`${API_URL}/imports${qs ? `?${qs}` : ''}`, {
      method: req.method || 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await proxied.json();
    res.status(proxied.status).json(data);
  } catch (err: any) {
    res.status(500).json({ error: String(err) });
  }
}