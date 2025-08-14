import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Search, Filter, MessageSquare, Phone } from "lucide-react";

interface WhatsAppMessage {
  id: string;
  user_id: string;
  direction: 'in' | 'out';
  payload: any;
  created_at: string;
  user?: {
    wa_id: string;
    phone_e164?: string;
    display_name?: string;
  };
}

export function WhatsAppLogs() {
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [directionFilter, setDirectionFilter] = useState<'all' | 'in' | 'out'>('all');
  const [selectedMessage, setSelectedMessage] = useState<WhatsAppMessage | null>(null);

  useEffect(() => {
    loadMessages();
  }, []);

  const loadMessages = async () => {
    try {
      setLoading(true);
      // Mock data
      const mockMessages: WhatsAppMessage[] = [
        {
          id: '1',
          user_id: 'user1',
          direction: 'in',
          payload: {
            entry: [{
              changes: [{
                value: {
                  messages: [{
                    from: '250788123456',
                    text: { body: 'Hello' },
                    type: 'text'
                  }]
                }
              }]
            }]
          },
          created_at: '2024-01-15T10:30:00Z',
          user: {
            wa_id: '250788123456',
            phone_e164: '+250788123456',
            display_name: 'John Doe'
          }
        },
        {
          id: '2',
          user_id: 'user1',
          direction: 'out',
          payload: {
            messaging_product: 'whatsapp',
            to: '250788123456',
            type: 'interactive',
            interactive: {
              type: 'list',
              header: { type: 'text', text: 'Main Menu' },
              body: { text: 'Choose a service:' }
            }
          },
          created_at: '2024-01-15T10:30:05Z',
          user: {
            wa_id: '250788123456',
            phone_e164: '+250788123456',
            display_name: 'John Doe'
          }
        }
      ];
      
      setMessages(mockMessages);
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredMessages = messages.filter(message => {
    const matchesSearch = !searchQuery || 
      message.user?.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      message.user?.phone_e164?.includes(searchQuery) ||
      JSON.stringify(message.payload).toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesDirection = directionFilter === 'all' || message.direction === directionFilter;
    
    return matchesSearch && matchesDirection;
  });

  const getMessagePreview = (message: WhatsAppMessage) => {
    if (message.direction === 'in') {
      const text = message.payload?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.text?.body;
      const interactive = message.payload?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.interactive;
      
      if (text) return text;
      if (interactive) return `Interactive: ${interactive.button_reply?.title || interactive.list_reply?.title || 'Unknown'}`;
      return 'Media or other message type';
    } else {
      const text = message.payload?.text?.body;
      const interactive = message.payload?.interactive;
      
      if (text) return text;
      if (interactive) return `${interactive.type}: ${interactive.header?.text || interactive.body?.text || 'Interactive message'}`;
      return 'Outbound message';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold">WhatsApp Message Logs</h2>
        <Button onClick={loadMessages}>Refresh</Button>
      </div>

      <div className="flex gap-4 items-center">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search messages, users, phone numbers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <Select value={directionFilter} onValueChange={(value: any) => setDirectionFilter(value)}>
          <SelectTrigger className="w-40">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Messages</SelectItem>
            <SelectItem value="in">Incoming</SelectItem>
            <SelectItem value="out">Outgoing</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="text-center py-8">Loading messages...</div>
      ) : (
        <div className="space-y-4">
          {filteredMessages.map((message) => (
            <Card key={message.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    {message.direction === 'in' ? (
                      <MessageSquare className="h-4 w-4 text-blue-500" />
                    ) : (
                      <Phone className="h-4 w-4 text-green-500" />
                    )}
                    <div>
                      <h4 className="font-medium">
                        {message.user?.display_name || 'Unknown User'}
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        {message.user?.phone_e164}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant={message.direction === 'in' ? 'default' : 'secondary'}>
                      {message.direction === 'in' ? 'Incoming' : 'Outgoing'}
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(message.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm mb-2 truncate">
                  {getMessagePreview(message)}
                </p>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      View Full Message
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl">
                    <DialogHeader>
                      <DialogTitle>Message Details</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <h4 className="font-medium">Direction</h4>
                          <p className="text-sm">{message.direction === 'in' ? 'Incoming' : 'Outgoing'}</p>
                        </div>
                        <div>
                          <h4 className="font-medium">Timestamp</h4>
                          <p className="text-sm">{new Date(message.created_at).toLocaleString()}</p>
                        </div>
                        <div>
                          <h4 className="font-medium">User</h4>
                          <p className="text-sm">{message.user?.display_name || 'Unknown'}</p>
                        </div>
                        <div>
                          <h4 className="font-medium">Phone</h4>
                          <p className="text-sm">{message.user?.phone_e164 || 'Unknown'}</p>
                        </div>
                      </div>
                      <div>
                        <h4 className="font-medium mb-2">Raw Payload</h4>
                        <ScrollArea className="h-96 w-full border rounded p-4">
                          <pre className="text-xs">
                            {JSON.stringify(message.payload, null, 2)}
                          </pre>
                        </ScrollArea>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>
          ))}

          {filteredMessages.length === 0 && (
            <Card>
              <CardContent className="text-center py-8">
                <p className="text-muted-foreground">No messages found.</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}