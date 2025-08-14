import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Search, Filter, MessageSquare, Phone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface WhatsAppLog {
  id: string;
  user_id?: string;
  phone_number: string;
  direction: string;
  message_type: string;
  message_content?: string;
  metadata?: any;
  status: string;
  created_at: string;
}

export function WhatsAppLogs() {
  const [messages, setMessages] = useState<WhatsAppLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [directionFilter, setDirectionFilter] = useState<'all' | 'inbound' | 'outbound'>('all');
  const [selectedMessage, setSelectedMessage] = useState<WhatsAppLog | null>(null);

  useEffect(() => {
    loadMessages();
  }, []);

  const loadMessages = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("whatsapp_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      
      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error('Error loading messages:', error);
      toast.error("Failed to load WhatsApp logs");
    } finally {
      setLoading(false);
    }
  };

  const filteredMessages = messages.filter(message => {
    const matchesSearch = !searchQuery || 
      message.phone_number?.includes(searchQuery) ||
      message.message_content?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      JSON.stringify(message.metadata).toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesDirection = directionFilter === 'all' || message.direction === directionFilter;
    
    return matchesSearch && matchesDirection;
  });

  const getMessagePreview = (message: WhatsAppLog) => {
    if (message.message_content) {
      return message.message_content.length > 100 
        ? message.message_content.slice(0, 100) + "..."
        : message.message_content;
    }
    return `${message.message_type} message`;
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
            <SelectItem value="inbound">Incoming</SelectItem>
            <SelectItem value="outbound">Outgoing</SelectItem>
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
                    {message.direction === 'inbound' ? (
                      <MessageSquare className="h-4 w-4 text-blue-500" />
                    ) : (
                      <Phone className="h-4 w-4 text-green-500" />
                    )}
                    <div>
                      <h4 className="font-medium">
                        {message.phone_number}
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        {message.message_type}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant={message.direction === 'inbound' ? 'default' : 'secondary'}>
                      {message.direction === 'inbound' ? 'Incoming' : 'Outgoing'}
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
                          <p className="text-sm">{message.direction}</p>
                        </div>
                        <div>
                          <h4 className="font-medium">Timestamp</h4>
                          <p className="text-sm">{new Date(message.created_at).toLocaleString()}</p>
                        </div>
                        <div>
                          <h4 className="font-medium">Phone</h4>
                          <p className="text-sm">{message.phone_number}</p>
                        </div>
                        <div>
                          <h4 className="font-medium">Type</h4>
                          <p className="text-sm">{message.message_type}</p>
                        </div>
                      </div>
                      <div>
                        <h4 className="font-medium mb-2">Message Content</h4>
                        <div className="border rounded p-4 bg-muted/20">
                          <p className="text-sm">{message.message_content || "No content"}</p>
                        </div>
                      </div>
                      {message.metadata && (
                        <div>
                          <h4 className="font-medium mb-2">Metadata</h4>
                          <ScrollArea className="h-96 w-full border rounded p-4">
                            <pre className="text-xs">
                              {JSON.stringify(message.metadata, null, 2)}
                            </pre>
                          </ScrollArea>
                        </div>
                      )}
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