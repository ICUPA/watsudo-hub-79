import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function TestWhatsApp() {
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!phone || !message) return;
    
    setLoading(true);
    try {
      // Use environment variable for Supabase URL
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || import.meta.env.NEXT_PUBLIC_SUPABASE_URL;
      if (!supabaseUrl) {
        throw new Error('Missing SUPABASE_URL environment variable');
      }
      
      const response = await fetch(`${supabaseUrl}/functions/v1/whatsapp/debug`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone,
          message,
        }),
      });

      const data = await response.json();
      setResponse(JSON.stringify(data, null, 2));
    } catch (error) {
      setResponse(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Test WhatsApp Integration</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Phone Number</label>
          <Input
            type="tel"
            placeholder="+250700000000"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Message</label>
          <Input
            type="text"
            placeholder="Hello from test app"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
        </div>
        <Button onClick={handleSend} disabled={loading} className="w-full">
          {loading ? 'Sending...' : 'Send Test Message'}
        </Button>
        {response && (
          <div className="mt-4">
            <label className="block text-sm font-medium mb-2">Response</label>
            <pre className="bg-gray-100 p-2 rounded text-xs overflow-auto">
              {response}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
}