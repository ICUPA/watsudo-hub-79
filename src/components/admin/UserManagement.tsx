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
import { Search, UserPlus, Edit, Trash2, Phone, User, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Profile {
  id: string;
  user_id: string;
  wa_phone: string;
  wa_name?: string;
  locale: string;
  role: 'user' | 'admin' | 'driver';
  default_momo_phone?: string;
  default_momo_code?: string;
  created_at: string;
  updated_at: string;
}

export function UserManagement() {
  const [searchTerm, setSearchTerm] = useState("");
  const [users, setUsers] = useState<Profile[]>([]);
  const [editingUsers, setEditingUsers] = useState<Record<string, Partial<Profile>>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error("Error loading users:", error);
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(user => 
    user.wa_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.wa_phone.includes(searchTerm)
  );

  const handleEditUser = (userId: string, field: keyof Profile, value: string) => {
    setEditingUsers(prev => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        [field]: value
      }
    }));
  };

  const handleSaveUser = async (userId: string) => {
    const updates = editingUsers[userId];
    if (!updates) return;

    try {
      const { error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", userId);
      
      if (error) throw error;
      
      setUsers(prev => prev.map(user => 
        user.id === userId ? { ...user, ...updates } : user
      ));
      setEditingUsers(prev => {
        const { [userId]: _, ...rest } = prev;
        return rest;
      });
      toast.success("User updated successfully");
    } catch (error) {
      console.error("Error updating user:", error);
      toast.error("Failed to update user");
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "admin": return "destructive";
      case "driver": return "secondary";
      default: return "default";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold gradient-text mb-2">
            User Management
          </h1>
          <p className="text-muted-foreground">
            Manage WhatsApp users and their profiles
          </p>
        </div>
        <Button className="bg-gradient-primary hover:opacity-90">
          <UserPlus className="h-4 w-4 mr-2" />
          Add User
        </Button>
      </div>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Users Directory</CardTitle>
          <CardDescription>
            All registered WhatsApp users in the system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or phone number..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Badge variant="outline" className="px-3 py-1">
              {filteredUsers.length} users
            </Badge>
          </div>

          <div className="rounded-lg border border-border/20 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/20">
                  <TableHead>User</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>MoMo Details</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.id} className="hover:bg-muted/10">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 bg-primary/10 rounded-full flex items-center justify-center">
                          <User className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <Input
                            value={editingUsers[user.id]?.wa_name ?? user.wa_name ?? ""}
                            onChange={(e) => handleEditUser(user.id, "wa_name", e.target.value)}
                            className="font-medium border-0 p-0 h-auto bg-transparent focus-visible:ring-0"
                            placeholder="Enter name..."
                          />
                          <p className="text-xs text-muted-foreground">ID: {user.id.slice(0, 8)}...</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span className="font-mono text-sm">{user.wa_phone}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <select
                        value={editingUsers[user.id]?.role ?? user.role}
                        onChange={(e) => handleEditUser(user.id, "role", e.target.value)}
                        className="bg-transparent border border-border rounded px-2 py-1 text-sm"
                      >
                        <option value="user">User</option>
                        <option value="driver">Driver</option>
                        <option value="admin">Admin</option>
                      </select>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm space-y-1">
                        <Input
                          value={editingUsers[user.id]?.default_momo_phone ?? user.default_momo_phone ?? ""}
                          onChange={(e) => handleEditUser(user.id, "default_momo_phone", e.target.value)}
                          placeholder="MoMo phone..."
                          className="h-7 text-xs"
                        />
                        <Input
                          value={editingUsers[user.id]?.default_momo_code ?? user.default_momo_code ?? ""}
                          onChange={(e) => handleEditUser(user.id, "default_momo_code", e.target.value)}
                          placeholder="MoMo code..."
                          className="h-7 text-xs"
                        />
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {new Date(user.created_at).toLocaleDateString()}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="default" className="bg-success/20 text-success">
                        Active
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 justify-end">
                        {editingUsers[user.id] ? (
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleSaveUser(user.id)}
                            className="text-success hover:text-success"
                          >
                            <Save className="h-4 w-4" />
                          </Button>
                        ) : (
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => setEditingUsers(prev => ({ ...prev, [user.id]: {} }))}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}