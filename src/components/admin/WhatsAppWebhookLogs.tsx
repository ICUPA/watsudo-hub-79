import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageSquare, RefreshCw, Phone, ArrowUpDown, Database } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface WhatsAppLog {
  id: string;
  created_at: string;
  phone_number: string;
  direction: string;
  message_type: string;
  message_content: string;
  status: string;
  metadata: any;
  user_id?: string;
}

interface WhatsAppConversation {
  id: string;
  phone_number: string;
  current_step: string;
  last_activity_at: string;
  conversation_data: any;
  user_id?: string;
}

export function WhatsAppWebhookLogs() {
  const [logs, setLogs] = useState<WhatsAppLog[]>([]);
  const [conversations, setConversations] = useState<WhatsAppConversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("logs");

  const fetchLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('whatsapp_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

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
        .limit(50);

      if (error) throw error;
      setConversations(data || []);
    } catch (error) {
      console.error('Error fetching conversations:', error);
      toast.error('Failed to fetch conversations');
    }
  };

  const fetchData = async () => {
    setIsLoading(true);
    await Promise.all([fetchLogs(), fetchConversations()]);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'sent': return 'bg-green-500/20 text-green-700 border-green-500/30';
      case 'delivered': return 'bg-blue-500/20 text-blue-700 border-blue-500/30';
      case 'read': return 'bg-purple-500/20 text-purple-700 border-purple-500/30';
      case 'failed': return 'bg-red-500/20 text-red-700 border-red-500/30';
      default: return 'bg-gray-500/20 text-gray-700 border-gray-500/30';
    }
  };

  const getDirectionIcon = (direction: string) => {
    return direction === 'in' ? (
      <ArrowUpDown className="h-4 w-4 rotate-180 text-blue-600" />
    ) : (
      <ArrowUpDown className="h-4 w-4 text-green-600" />
    );
  };

  const truncateMessage = (message: string, maxLength: number = 100) => {
    if (message.length <= maxLength) return message;
    return message.substring(0, maxLength) + '...';
  };

  const formatMessageContent = (content: string, type: string) => {
    try {
      if (type === 'interactive' || content.startsWith('{')) {
        const parsed = JSON.parse(content);
        if (parsed.interactive?.button_reply) {
          return `Button: ${parsed.interactive.button_reply.title}`;
        }
        if (parsed.interactive?.list_reply) {
          return `List: ${parsed.interactive.list_reply.title}`;
        }
        if (parsed.text?.body) {
          return parsed.text.body;
        }
        return content;
      }
      return content;
    } catch {
      return content;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold gradient-text mb-2">WhatsApp Integration</h1>
          <p className="text-muted-foreground">Monitor WhatsApp webhook logs and conversations</p>
        </div>
        <Button onClick={fetchData} disabled={isLoading} variant="outline">
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="logs" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Message Logs ({logs.length})
          </TabsTrigger>
          <TabsTrigger value="conversations" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            Active Conversations ({conversations.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="logs">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Recent WhatsApp Messages
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px]">
                <div className="space-y-2">
                  {logs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-start gap-3 p-3 rounded-lg border border-border/50 hover:bg-muted/10 transition-colors"
                    >
                      <div className="flex flex-col items-center gap-1 min-w-0">
                        {getDirectionIcon(log.direction)}
                        <span className="text-xs text-muted-foreground">
                          {log.direction}
                        </span>
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Phone className="h-3 w-3 text-muted-foreground" />
                          <span className="font-mono text-sm">{log.phone_number}</span>
                          <Badge variant="outline" className="text-xs">
                            {log.message_type}
                          </Badge>
                          <Badge 
                            variant="outline" 
                            className={`text-xs ${getStatusColor(log.status)}`}
                          >
                            {log.status}
                          </Badge>
                        </div>
                        
                        <p className="text-sm text-muted-foreground break-words">
                          {formatMessageContent(log.message_content || '', log.message_type)}
                        </p>
                        
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  ))}
                  
                  {logs.length === 0 && !isLoading && (
                    <div className="text-center py-8 text-muted-foreground">
                      No WhatsApp logs found. Messages will appear here once your webhook receives them.
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="conversations">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Active Conversations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px]">
                <div className="space-y-3">
                  {conversations.map((conversation) => (
                    <div
                      key={conversation.id}
                      className="p-4 rounded-lg border border-border/50 hover:bg-muted/10 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <span className="font-mono font-medium">{conversation.phone_number}</span>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {conversation.current_step}
                        </Badge>
                      </div>
                      
                      <div className="text-sm text-muted-foreground mb-2">
                        Last activity: {formatDistanceToNow(new Date(conversation.last_activity_at), { addSuffix: true })}
                      </div>
                      
                      {conversation.conversation_data && Object.keys(conversation.conversation_data).length > 0 && (
                        <div className="bg-muted/20 rounded p-2 mt-2">
                          <p className="text-xs font-medium mb-1">Conversation Data:</p>
                          <pre className="text-xs text-muted-foreground overflow-auto">
                            {JSON.stringify(conversation.conversation_data, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  ))}
                  
                  {conversations.length === 0 && !isLoading && (
                    <div className="text-center py-8 text-muted-foreground">
                      No active conversations found. Conversations will appear here when users interact with your WhatsApp bot.
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}