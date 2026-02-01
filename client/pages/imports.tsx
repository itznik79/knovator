import React, { useState, useEffect, useRef } from 'react';
import { GetServerSideProps } from 'next';
import Link from 'next/link';

type ImportLog = {
  _id: string;
  fileName: string;
  totalFetched: number;
  totalImported: number;
  newJobs: number;
  updatedJobs: number;
  failedJobs: number;
  createdAt: string;
};

type QueueStats = {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  total: number;
};

type Props = {
  items: ImportLog[];
  total: number;
  page: number;
  limit: number;
};

export default function ImportsPage({ items, page, limit, total }: Props) {
  const [mounted, setMounted] = useState(false);
  const [queueStats, setQueueStats] = useState<QueueStats | null>(null);
  const [currentLimit, setCurrentLimit] = useState(limit);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    setMounted(true);

    // Connect to SSE for real-time queue stats
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
    const eventSource = new EventSource(`${API_URL}/progress/stream`);
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.queue) {
          setQueueStats(data.queue);
        }
      } catch (err) {
        console.error('Failed to parse SSE data:', err);
      }
    };

    eventSource.onerror = () => {
      console.error('SSE connection error');
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, []);

  const formatDate = (dateString: string) => {
    if (!mounted) return ''; // Prevent hydration mismatch
    return new Date(dateString).toLocaleString();
  };

  const handleLimitChange = (newLimit: number) => {
    const params = new URLSearchParams();
    params.set('page', '1');
    params.set('limit', String(newLimit));
    window.location.href = `/imports?${params.toString()}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <div className="p-6 max-w-7xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <Link href="/" className="text-blue-600 hover:text-blue-800 font-medium text-sm transition-colors">
              ← Back to Home
            </Link>
          </div>
          <Link href="/trigger">
            <button className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 shadow-md hover:shadow-lg transition-all font-medium">
              🚀 Trigger New Import
            </button>
          </Link>
        </div>

        <h1 className="text-3xl font-bold mb-6 bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
          Import History
        </h1>

        {/* Real-time Queue Stats */}
        {queueStats && queueStats.total > 0 && (
          <div className="mb-6 bg-white rounded-lg shadow-lg p-6 border border-indigo-100">
            <h2 className="text-lg font-semibold mb-4 flex items-center">
              <span className="inline-block w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></span>
              Queue Status (Live)
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4">
                <div className="text-2xl font-bold text-blue-600">{queueStats.waiting}</div>
                <div className="text-xs text-blue-700 font-medium">Waiting</div>
              </div>
              <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-lg p-4">
                <div className="text-2xl font-bold text-yellow-600">{queueStats.active}</div>
                <div className="text-xs text-yellow-700 font-medium">Processing</div>
              </div>
              <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4">
                <div className="text-2xl font-bold text-green-600">{queueStats.completed}</div>
                <div className="text-xs text-green-700 font-medium">Completed</div>
              </div>
              <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-lg p-4">
                <div className="text-2xl font-bold text-red-600">{queueStats.failed}</div>
                <div className="text-xs text-red-700 font-medium">Failed</div>
              </div>
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4">
                <div className="text-2xl font-bold text-purple-600">{queueStats.total}</div>
                <div className="text-xs text-purple-700 font-medium">Total Active</div>
              </div>
            </div>
          </div>
        )}

        {/* Items per page selector */}
        <div className="mb-4 flex items-center gap-3">
          <span className="text-sm font-medium text-gray-700">Items per page:</span>
          {[10, 20, 50, 100].map((limitOption) => (
            <button
              key={limitOption}
              onClick={() => handleLimitChange(limitOption)}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-all ${
                currentLimit === limitOption
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                  : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              {limitOption}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="overflow-x-auto bg-white rounded-lg shadow-lg border border-indigo-100">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gradient-to-r from-gray-50 to-indigo-50">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">File / URL</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">Total</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">Imported</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">New</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">Updated</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">Failed</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">Date & Time</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <div className="text-gray-400 mb-2">
                      <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <p className="text-gray-500">No import history yet.</p>
                    <Link href="/trigger" className="text-blue-600 hover:text-blue-800 font-medium">Trigger your first import →</Link>
                  </td>
                </tr>
              ) : (
                items.map((it, idx) => (
                  <tr key={it._id} className={`hover:bg-indigo-50 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                    <td className="px-6 py-4 text-sm text-gray-700 max-w-md truncate font-medium" title={it.fileName}>
                      {it.fileName}
                    </td>
                    <td className="px-6 py-4 text-sm text-right font-semibold">{it.totalFetched.toLocaleString()}</td>
                    <td className="px-6 py-4 text-sm text-right font-semibold">{it.totalImported.toLocaleString()}</td>
                    <td className="px-6 py-4 text-sm text-right">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        {it.newJobs.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-right">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {it.updatedJobs.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-right">
                      {it.failedJobs > 0 ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          {it.failedJobs.toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-gray-400">0</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-right whitespace-nowrap text-gray-600">{formatDate(it.createdAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="mt-6 flex items-center gap-4 bg-white p-4 rounded-lg shadow-md border border-indigo-100">
          {page > 1 && (
            <a href={`?page=${page - 1}&limit=${currentLimit}`}>
              <button className="px-4 py-2 bg-white border-2 border-gray-300 rounded-lg hover:bg-gray-50 hover:border-indigo-400 font-medium transition-all">
                ← Prev
              </button>
            </a>
          )}
          <div className="text-sm font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            Page {page}
          </div>
          {items.length === currentLimit && (
            <a href={`?page=${page + 1}&limit=${currentLimit}`}>
              <button className="px-4 py-2 bg-white border-2 border-gray-300 rounded-lg hover:bg-gray-50 hover:border-indigo-400 font-medium transition-all">
                Next →
              </button>
            </a>
          )}
          <div className="ml-auto text-sm font-medium text-gray-600">
            Total Records: <span className="font-bold text-indigo-600">{total.toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const page = Number((ctx.query.page as string) || '1');
  const limit = Number((ctx.query.limit as string) || '20');

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
  try {
    const params = new URLSearchParams();
    params.set('limit', String(limit));
    params.set('page', String(page));

    const res = await fetch(`${API_URL}/imports?${params.toString()}`);
    const data = await res.json();
    return { 
      props: { 
        items: data.items || [], 
        total: data.total || 0, 
        page, 
        limit
      } 
    };
  } catch (err) {
    return { props: { items: [], total: 0, page, limit } };
  }
};

