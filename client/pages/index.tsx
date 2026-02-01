import Link from 'next/link';

export default function Home() {
  return (
    <main className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-semibold mb-2">Knovator — Admin</h1>
      <p className="text-sm text-gray-600 mb-4">Admin interface for the job importer.</p>
      <div className="space-y-2">
        <Link href="/trigger" className="block px-4 py-2 bg-blue-600 text-white rounded shadow hover:bg-blue-700">
          🚀 Trigger Job Import
        </Link>
        <Link href="/imports" className="block px-4 py-2 bg-white rounded shadow hover:bg-gray-50">
          📊 Import History
        </Link>
        <Link href="/admin/dlq" className="block px-4 py-2 bg-white rounded shadow hover:bg-gray-50">
          ⚠️ Dead Letter Queue (DLQ)
        </Link>
      </div>
    </main>
  );
}
