import React, { useState } from 'react';
import Link from 'next/link';

export default function TriggerImportPage() {
  const [loading, setLoading] = useState(false);
  const [customUrl, setCustomUrl] = useState('');
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

  const handleTriggerAll = async () => {
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout
      
      const res = await fetch(`${API_URL}/imports/start`, { 
        method: 'POST',
        signal: controller.signal 
      });
      clearTimeout(timeoutId);
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ message: 'Unknown error' }));
        throw new Error(errorData.message || `HTTP ${res.status}: ${res.statusText}`);
      }
      
      const data = await res.json();
      setResult(data);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setError('Request timeout - please try again');
      } else {
        setError(err.message || 'Failed to trigger import');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleTriggerCustom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customUrl.trim()) return;

    setLoading(true);
    setError('');
    setResult(null);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout
      
      const res = await fetch(`${API_URL}/imports/start/url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: customUrl }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ message: 'Unknown error' }));
        throw new Error(errorData.message || `HTTP ${res.status}: ${res.statusText}`);
      }
      
      const data = await res.json();
      setResult(data);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setError('Request timeout - please try again');
      } else {
        setError(err.message || 'Failed to trigger import');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <Link href="/" className="text-blue-600 hover:underline text-sm">← Back to Home</Link>
      </div>

      <h1 className="text-2xl font-semibold mb-2">Trigger Job Import</h1>
      <p className="text-sm text-gray-600 mb-6">Start fetching jobs from configured feeds or a custom URL.</p>

      {/* Trigger All Feeds */}
      <div className="bg-white rounded shadow p-6 mb-6">
        <h2 className="text-lg font-medium mb-3">Import from All Configured Feeds</h2>
        <p className="text-sm text-gray-600 mb-4">
          This will fetch jobs from all 9 preconfigured feeds and queue them for processing.
        </p>
        <button
          onClick={handleTriggerAll}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {loading ? 'Triggering...' : 'Trigger All Feeds'}
        </button>
      </div>

      {/* Trigger Custom URL */}
      <div className="bg-white rounded shadow p-6 mb-6">
        <h2 className="text-lg font-medium mb-3">Import from Custom URL</h2>
        <p className="text-sm text-gray-600 mb-4">
          Enter a specific feed URL to import jobs from a single source.
        </p>
        <form onSubmit={handleTriggerCustom} className="space-y-3">
          <input
            type="url"
            value={customUrl}
            onChange={(e) => setCustomUrl(e.target.value)}
            placeholder="https://jobicy.com/?feed=job_feed&job_categories=design-multimedia"
            className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
          <p className="text-xs text-gray-500">
            Note: URL must be valid with no spaces. Example categories: design-multimedia, data-science, copywriting
          </p>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {loading ? 'Triggering...' : 'Trigger Custom Feed'}
          </button>
        </form>
      </div>

      {/* Result Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-4 mb-4">
          <p className="text-red-800 font-medium">Error:</p>
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {result && (
        <div className="bg-green-50 border border-green-200 rounded p-4 mb-4">
          <p className="text-green-800 font-medium mb-2">✓ Import Triggered Successfully</p>
          <p className="text-sm text-gray-700 mb-3">Jobs are being queued for processing. Results:</p>
          <div className="bg-white rounded p-3 text-sm overflow-x-auto">
            <pre className="text-xs">{JSON.stringify(result, null, 2)}</pre>
          </div>
          <div className="mt-4">
            <Link href="/imports" className="text-blue-600 hover:underline text-sm">
              → View Import History
            </Link>
          </div>
        </div>
      )}

      {/* Info Section */}
      <div className="bg-gray-50 rounded p-4 text-sm">
        <h3 className="font-medium mb-2">ℹ️ How It Works</h3>
        <ul className="list-disc list-inside space-y-1 text-gray-700">
          <li>Clicking trigger fetches jobs from the feed(s)</li>
          <li>Jobs are parsed from XML and queued in Redis</li>
          <li>Worker processes handle the queue and upsert to MongoDB</li>
          <li>Import logs are created with statistics (new/updated/failed)</li>
          <li>Check <Link href="/imports" className="text-blue-600 hover:underline">Import History</Link> to see results</li>
        </ul>
      </div>
    </div>
  );
}
