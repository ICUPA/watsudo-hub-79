
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, MessageCircle, Phone, Clock } from 'lucide-react';
import { toast } from 'sonner';

interface WhatsAppLog {
  id: string;
  direction: 'in' | 'out';
  phone_number: string;
  message_type: string;
  message_content: string;
  message_id: string;
  status: string;
  created_at: string;
  payload: any;
}

interface WhatsAppConversation {
  id: string;
  phone_number: string;
  current_step: string;
  conversation_data: any;
  last_activity_at: string;
  created_at: string;
}

export default function WhatsAppLogs() {
  const [logs, setLogs] = useState<WhatsAppLog[]>([]);
  const [conversations, setConversations] = useState<WhatsAppConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'messages' | 'conversations'>('messages');

  useEffect(() => {
    fetchData();
    
    // Set up real-time subscriptions
    const logsSubscription = supabase
      .channel('whatsapp_logs')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'whatsapp_logs'
      }, () => {
        fetchLogs();
      })
      .subscribe();

    const conversationsSubscription = supabase
      .channel('whatsapp_conversations')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'whatsapp_conversations'
      }, () => {
        fetchConversations();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(logsSubscription);
      supabase.removeChannel(conversationsSubscription);
    };
  }, []);

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([fetchLogs(), fetchConversations()]);
    setLoading(false);
  };

  const fetchLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('whatsapp_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error('Error fetching logs:', error);
      toast.error('Failed to fetch WhatsApp logs');
    }
  };

  const fetchConversations = async () => {
    try {
      const { data, error } = await supabase
        .from('whatsapp_conversations')
        .select('*')
        .order('last_activity_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setConversations(data || []);
    } catch (error) {
      console.error('Error fetching conversations:', error);
      toast.error('Failed to fetch conversations');
    }
  };

  const testWebhook = async () => {
    try {
      const webhookUrl = `${window.location.origin}/functions/v1/whatsapp`;
      const testPayload = {
        object: 'whatsapp_business_account',
        entry: [{
          id: 'test',
          changes: [{
            value: {
              messaging_product: 'whatsapp',
              metadata: { display_phone_number: 'test', phone_number_id: 'test' },
              contacts: [{
                profile: { name: 'Test User' },
                wa_id: '1234567890'
              }],
              messages: [{
                from: '1234567890',
                id: 'test_message_id',
                timestamp: Date.now().toString(),
                text: { body: 'Test message' },
                type: 'text'
              }]
            },
            field: 'messages'
          }]
        }]
      };

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testPayload)
      });

      if (response.ok) {
        toast.success('Test webhook sent successfully');
        fetchData();
      } else {
        toast.error('Webhook test failed');
      }
    } catch (error) {
      toast.error('Error testing webhook');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getStatusBadge = (status: string, direction?: string) => {
    const color = status === 'sent' || status === 'received' ? 'default' : 
                 status === 'failed' || status === 'error' ? 'destructive' : 'secondary';
    return <Badge variant={color as any}>{status}</Badge>;
  };

  const getDirectionBadge = (direction: string) => {
    return (
      <Badge variant={direction === 'in' ? 'outline' : 'default'}>
        {direction === 'in' ? '↓ IN' : '↑ OUT'}
      </Badge>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <RefreshCw className="h-6 w-6 animate-spin" />
            <span className="ml-2">Loading WhatsApp data...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">WhatsApp Integration</h2>
        <div className="flex gap-2">
          <Button onClick={testWebhook} variant="outline">
            Test Webhook
          </Button>
          <Button onClick={fetchData} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="flex space-x-1 mb-4">
        <Button
          variant={activeTab === 'messages' ? 'default' : 'outline'}
          onClick={() => setActiveTab('messages')}
          className="flex items-center gap-2"
        >
          <MessageCircle className="h-4 w-4" />
          Recent Messages ({logs.length})
        </Button>
        <Button
          variant={activeTab === 'conversations' ? 'default' : 'outline'}
          onClick={() => setActiveTab('conversations')}
          className="flex items-center gap-2"
        >
          <Phone className="h-4 w-4" />
          Active Conversations ({conversations.length})
        </Button>
      </div>

      {activeTab === 'messages' && (
        <Card>
          <CardHeader>
            <CardTitle>Recent WhatsApp Messages</CardTitle>
          </CardHeader>
          <CardContent>
            {logs.length === 0 ? (
              <div className="text-center py-8">
                <MessageCircle className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-500">No messages found. Messages will appear here when users interact with your WhatsApp bot.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {logs.map((log) => (
                  <div key={log.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {getDirectionBadge(log.direction)}
                        {getStatusBadge(log.status, log.direction)}
                        <Badge variant="secondary">{log.message_type}</Badge>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Clock className="h-3 w-3" />
                        {formatDate(log.created_at)}
                      </div>
                    </div>
                    
                    {log.phone_number && (
                      <div className="text-sm text-gray-600 mb-2">
                        <Phone className="h-3 w-3 inline mr-1" />
                        {log.phone_number}
                      </div>
                    )}
                    
                    {log.message_content && (
                      <div className="bg-gray-50 p-2 rounded text-sm">
                        {log.message_content}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === 'conversations' && (
        <Card>
          <CardHeader>
            <CardTitle>Active Conversations</CardTitle>
          </CardHeader>
          <CardContent>
            {conversations.length === 0 ? (
              <div className="text-center py-8">
                <Phone className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-500">No active conversations found. Conversations will appear here when users interact with your WhatsApp bot.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {conversations.map((conv) => (
                  <div key={conv.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        <span className="font-medium">{conv.phone_number}</span>
                        <Badge variant="outline">{conv.current_step}</Badge>
                      </div>
                      <div className="text-sm text-gray-500">
                        Last activity: {formatDate(conv.last_activity_at)}
                      </div>
                    </div>
                    
                    {conv.conversation_data?.contact_name && (
                      <div className="text-sm text-gray-600 mb-2">
                        Contact: {conv.conversation_data.contact_name}
                      </div>
                    )}
                    
                    {conv.conversation_data?.last_message && (
                      <div className="bg-gray-50 p-2 rounded text-sm">
                        Last message: {conv.conversation_data.last_message}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
