import React, { useEffect, useState } from 'react';
import Link from 'next/link';

type DlqItem = { id: string; attemptsMade: number; timestamp: number; data: any };

export default function DlqPage() {
  const [items, setItems] = useState<DlqItem[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchDlq = async () => {
    setLoading(true);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout
      
      const res = await fetch('/api/dlq', { signal: controller.signal });
      clearTimeout(timeoutId);
      
      if (!res.ok) {
        throw new Error(`Failed to fetch DLQ: ${res.status}`);
      }
      
      const json = await res.json();
      // Handle both array response and wrapped object response
      setItems(Array.isArray(json) ? json : []);
    } catch (e) {
      console.error('DLQ fetch error:', e);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDlq();
  }, []);

  const requeue = async (id: string) => {
    try {
      const res = await fetch(`/api/dlq/requeue/${id}`, { method: 'POST' });
      if (!res.ok) throw new Error('Requeue failed');
      await fetchDlq();
    } catch (e) {
      console.error('Requeue error:', e);
      alert('Failed to requeue job. Please try again.');
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Are you sure you want to permanently delete this job?')) return;
    try {
      const res = await fetch(`/api/dlq/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Remove failed');
      await fetchDlq();
    } catch (e) {
      console.error('Remove error:', e);
      alert('Failed to remove job. Please try again.');
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-4">
        <Link href="/" className="text-blue-600 hover:underline text-sm">← Back to Home</Link>
      </div>
      <h1 className="text-2xl font-semibold mb-4">Dead Letter Queue</h1>
      {loading ? (
        <div>Loading…</div>
      ) : (
        <div className="bg-white rounded shadow overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">ID</th>
                <th className="px-4 py-2 text-right text-sm font-medium text-gray-700">Attempts</th>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Timestamp</th>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                    No failed jobs in the queue
                  </td>
                </tr>
              ) : (
                items.map((it) => (
                  <tr key={it.id}>
                    <td className="px-4 py-3 text-sm text-gray-700">{it.id}</td>
                    <td className="px-4 py-3 text-sm text-right">{it.attemptsMade}</td>
                    <td className="px-4 py-3 text-sm">{new Date(it.timestamp).toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm">
                      <button onClick={() => requeue(it.id)} className="mr-2 px-3 py-1 bg-white border rounded hover:bg-gray-50">Requeue</button>
                      <button onClick={() => remove(it.id)} className="px-3 py-1 bg-white border rounded hover:bg-gray-50">Remove</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
