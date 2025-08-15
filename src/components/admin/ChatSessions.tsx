import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Search, MessageSquare, User, Clock, Settings, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ChatSession {
  id: string;
  user_id: string;
  state: string;
  context: any;
  updated_at: string;
  created_at: string;
}

export function ChatSessions() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("chat_sessions")
        .select("*")
        .order("updated_at", { ascending: false });
      
      if (error) throw error;
      setSessions(data || []);
    } catch (error) {
      console.error("Error loading chat sessions:", error);
      toast.error("Failed to load chat sessions");
    } finally {
      setLoading(false);
    }
  };

  const filteredSessions = sessions.filter(session => 
    session.user_id.includes(searchTerm) ||
    session.state.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const resetSession = async (sessionId: string) => {
    try {
      const { error } = await supabase
        .from("chat_sessions")
        .update({ 
          state: "MAIN_MENU", 
          context: {}, 
          updated_at: new Date().toISOString() 
        })
        .eq("id", sessionId);
      
      if (error) throw error;
      
      setSessions(prev => prev.map(session => 
        session.id === sessionId 
          ? { ...session, state: "MAIN_MENU", context: {} }
          : session
      ));
      toast.success("Session reset successfully");
    } catch (error) {
      console.error("Error resetting session:", error);
      toast.error("Failed to reset session");
    }
  };

  const getStateBadge = (state: string) => {
    const stateColors: Record<string, any> = {
      'MAIN_MENU': 'default',
      'QR_MENU': 'secondary',
      'MOBILITY_MENU': 'outline',
      'INS_CHECK_VEHICLE': 'default',
      'INS_COLLECT_DOCS': 'secondary',
      'ND_WAIT_LOCATION': 'outline',
      'AV_DOC': 'default'
    };
    
    return (
      <Badge variant={stateColors[state] || 'outline'} className="text-xs">
        {state.replace(/_/g, ' ')}
      </Badge>
    );
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return "Just now";
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold gradient-text mb-2">
            Chat Sessions
          </h1>
          <p className="text-muted-foreground">
            Active WhatsApp conversation states and flow management
          </p>
        </div>
        <Button 
          onClick={loadSessions}
          className="bg-gradient-primary hover:opacity-90"
        >
          <MessageSquare className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Active Sessions
            <Badge variant="outline" className="ml-auto">
              {filteredSessions.length} sessions
            </Badge>
          </CardTitle>
          <CardDescription>
            Monitor and manage user conversation flows and states
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by user name, phone, or state..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="rounded-lg border border-border/20 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/20">
                  <TableHead>User</TableHead>
                  <TableHead>Current State</TableHead>
                  <TableHead>Context</TableHead>
                  <TableHead>Last Activity</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      Loading sessions...
                    </TableCell>
                  </TableRow>
                ) : filteredSessions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No sessions found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSessions.map((session) => (
                    <TableRow key={session.id} className="hover:bg-muted/10">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 bg-primary/10 rounded-full flex items-center justify-center">
                            <User className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">
                              User {session.user_id.slice(0, 8)}
                            </p>
                            <p className="text-xs text-muted-foreground font-mono">
                              {session.user_id}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {getStateBadge(session.state)}
                      </TableCell>
                      <TableCell>
                        <div className="max-w-xs">
                          {Object.keys(session.context || {}).length > 0 ? (
                            <details className="cursor-pointer">
                              <summary className="text-xs text-muted-foreground hover:text-foreground">
                                {Object.keys(session.context).length} properties
                              </summary>
                              <pre className="text-xs mt-1 p-2 bg-muted rounded text-wrap max-h-32 overflow-y-auto">
                                {JSON.stringify(session.context, null, 2)}
                              </pre>
                            </details>
                          ) : (
                            <span className="text-xs text-muted-foreground">Empty</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {formatTimestamp(session.updated_at)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => resetSession(session.id)}
                            className="text-orange-600 hover:text-orange-700"
                          >
                            <Play className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm">
                            <Settings className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}