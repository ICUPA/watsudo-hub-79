import { useEffect, useState } from 'react';

export const TestWhatsApp = () => {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const testFunction = async () => {
    setLoading(true);
    try {
      // Test debug endpoint
      const response = await fetch('https://lgicrnzvnbmsnxhzytro.supabase.co/functions/v1/whatsapp/debug', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxnaWNybnp2bmJtc254aHp5dHJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUyMDg5MDgsImV4cCI6MjA3MDc4NDkwOH0.org4HqULlkLKD4ZPKtUD9aFGxNxuLRm82n-y6USJVfs'
        }
      });
      
      const data = await response.json();
      setResult({ 
        status: response.status, 
        data: data,
        ok: response.ok
      });
    } catch (error) {
      setResult({ error: error.message });
    }
    setLoading(false);
  };

  useEffect(() => {
    testFunction();
  }, []);

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">WhatsApp Function Test</h2>
      {loading && <p>Testing...</p>}
      {result && (
        <pre className="bg-gray-100 p-4 rounded overflow-auto">
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
      <button 
        onClick={testFunction}
        className="mt-4 px-4 py-2 bg-blue-500 text-white rounded"
      >
        Test Again
      </button>
    </div>
  );
};