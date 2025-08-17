import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { QrCode, Search, Download, Eye, ExternalLink, Copy, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

interface QRRecord {
  id: string;
  user_id: string;
  amount: number | null;
  ussd: string;
  file_path: string;
  created_at: string;
  profiles?: {
    wa_phone: string;
    wa_name?: string;
  };
}

export function QRManagement() {
  const [qrRecords, setQRRecords] = useState<QRRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedQR, setSelectedQR] = useState<QRRecord | null>(null);

  useEffect(() => {
    loadQRRecords();
  }, []);

  const loadQRRecords = async () => {
    try {
      const { data, error } = await supabase
        .from("qr_generations")
        .select(`
          *,
          profiles(wa_phone, wa_name)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setQRRecords(data || []);
    } catch (error) {
      console.error("Error loading QR records:", error);
      toast.error("Failed to load QR records");
    } finally {
      setLoading(false);
    }
  };

  const filteredRecords = qrRecords.filter(record =>
    record.ussd.toLowerCase().includes(searchTerm.toLowerCase()) ||
    record.profiles?.wa_phone.includes(searchTerm) ||
    record.profiles?.wa_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast.success(`${label} copied to clipboard`);
    });
  };

  const getQRImageUrl = (filePath: string) => {
    // Use environment variable for Supabase URL
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || import.meta.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) {
      console.error('Missing SUPABASE_URL environment variable');
      return '';
    }
    return `${supabaseUrl}/storage/v1/object/public/qr/${filePath.split('qr/')[1] || filePath}`;
  };

  const deleteQRRecord = async (recordId: string) => {
    try {
      const { error } = await supabase
        .from("qr_generations")
        .delete()
        .eq("id", recordId);

      if (error) throw error;
      
      setQRRecords(prev => prev.filter(r => r.id !== recordId));
      toast.success("QR record deleted successfully");
    } catch (error) {
      console.error("Error deleting QR record:", error);
      toast.error("Failed to delete QR record");
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold gradient-text">QR Management</h1>
        <div className="text-center py-8">Loading QR records...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold gradient-text mb-2">QR Management</h1>
          <p className="text-muted-foreground">Manage generated QR codes and USSD records</p>
        </div>
        <Button onClick={loadQRRecords} variant="outline">
          Refresh
        </Button>
      </div>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            QR Code History ({filteredRecords.length})
          </CardTitle>
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by USSD, phone, or name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>USSD Code</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Generated</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRecords.map((record) => (
                <TableRow key={record.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">
                        {record.profiles?.wa_name || 'Unknown'}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {record.profiles?.wa_phone}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <code className="text-xs bg-muted px-2 py-1 rounded">
                      {record.ussd}
                    </code>
                  </TableCell>
                  <TableCell>
                    {record.amount ? (
                      <Badge variant="secondary">
                        {record.amount.toLocaleString()} RWF
                      </Badge>
                    ) : (
                      <Badge variant="outline">No amount</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {format(new Date(record.created_at), "MMM dd, yyyy 'at' HH:mm")}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedQR(record)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-md">
                          <DialogHeader>
                            <DialogTitle>QR Code Details</DialogTitle>
                          </DialogHeader>
                          {selectedQR && (
                            <div className="space-y-4">
                              <div className="text-center">
                                <img
                                  src={getQRImageUrl(selectedQR.file_path)}
                                  alt="QR Code"
                                  className="mx-auto rounded-lg border shadow-sm max-w-[200px]"
                                />
                              </div>
                              <div className="space-y-2">
                                <div>
                                  <label className="text-sm font-medium">USSD Code</label>
                                  <div className="flex items-center gap-2">
                                    <code className="flex-1 bg-muted px-3 py-2 rounded text-sm">
                                      {selectedQR.ussd}
                                    </code>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => copyToClipboard(selectedQR.ussd, "USSD code")}
                                    >
                                      <Copy className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                                <div>
                                  <label className="text-sm font-medium">Tel Link</label>
                                  <div className="flex items-center gap-2">
                                    <code className="flex-1 bg-muted px-3 py-2 rounded text-sm truncate">
                                      tel:{selectedQR.ussd}
                                    </code>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => window.open(`tel:${selectedQR.ussd}`)}
                                    >
                                      <ExternalLink className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </DialogContent>
                      </Dialog>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const link = document.createElement('a');
                          link.href = getQRImageUrl(record.file_path);
                          link.download = `qr-${record.id}.png`;
                          link.click();
                        }}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deleteQRRecord(record.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          
          {filteredRecords.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm ? "No QR records match your search." : "No QR codes generated yet."}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}