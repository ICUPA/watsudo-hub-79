import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { QrCode, Download, ExternalLink, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface QRCodeData {
  type: "phone" | "code";
  identifier: string;
  amount?: number;
  ussd: string;
  telLink: string;
  qrCodeUrl: string;
}

export function QRGenerator() {
  const { user } = useAuth();
  const [type, setType] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [amount, setAmount] = useState("");
  const [qrData, setQrData] = useState<QRCodeData | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const normalizePhone = (phone: string): string => {
    // Remove all non-digits
    const digits = phone.replace(/\D/g, '');
    
    // If starts with 250, convert to local format
    if (digits.startsWith('250')) {
      return '0' + digits.slice(3);
    }
    
    // If starts with +250, convert to local format  
    if (digits.startsWith('+250')) {
      return '0' + digits.slice(4);
    }
    
    // If already local format or other, return as is
    return digits.startsWith('0') ? digits : '0' + digits;
  };

  const handleGenerate = async () => {
    if (!user) {
      toast.error("You must be logged in to generate QR codes");
      return;
    }

    const identifier = type === "phone" ? phone : code;
    const amountValue = amount ? parseInt(amount) : undefined;

    if (!identifier.trim()) {
      toast.error(`Please enter a ${type === "phone" ? "phone number" : "MoMo code"}`);
      return;
    }

    if (type === "phone" && !/^(\+250|0)?[0-9]{9}$/.test(identifier.replace(/\s/g, ''))) {
      toast.error("Please enter a valid phone number");
      return;
    }

    if (type === "code" && !/^\d{4,9}$/.test(identifier)) {
      toast.error("MoMo code must be 4-9 digits");
      return;
    }

    if (amountValue && amountValue <= 0) {
      toast.error("Amount must be greater than 0");
      return;
    }

    setIsGenerating(true);
    try {
      const normalizedIdentifier = type === "phone" ? normalizePhone(identifier) : identifier;
      
      const { data, error } = await supabase.functions.invoke('generate-qr', {
        body: {
          type,
          identifier: normalizedIdentifier,
          amount: amountValue,
          user_id: user.id
        }
      });

      if (error) throw error;

      if (data.success) {
        setQrData(data.data);
        toast.success("QR code generated successfully!");
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error("QR generation error:", error);
      toast.error("Failed to generate QR code");
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast.success(`${label} copied to clipboard`);
    });
  };

  const downloadQR = () => {
    if (qrData?.qrCodeUrl) {
      const link = document.createElement('a');
      link.href = qrData.qrCodeUrl;
      link.download = `qr-${type}-${Date.now()}.png`;
      link.click();
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold gradient-text mb-2">QR Generator</h1>
        <p className="text-muted-foreground">Generate USSD QR codes for mobile payments</p>
      </div>
      
      <Card className="glass-card max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            USSD QR Code Generator
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Payment Type</Label>
            <Select value={type} onValueChange={(value: "phone" | "code") => setType(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="phone">Phone Number</SelectItem>
                <SelectItem value="code">MoMo Code</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {type === "phone" ? (
            <div>
              <Label>Phone Number</Label>
              <Input
                placeholder="+250781234567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          ) : (
            <div>
              <Label>MoMo Code</Label>
              <Input
                placeholder="Enter 4-9 digit code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </div>
          )}

          <div>
            <Label>Amount (Optional)</Label>
            <Input
              type="number"
              placeholder="Enter amount in RWF"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          <Button 
            className="w-full bg-gradient-primary hover:opacity-90" 
            onClick={handleGenerate}
            disabled={isGenerating}
          >
            <QrCode className="h-4 w-4 mr-2" />
            {isGenerating ? "Generating..." : "Generate QR Code"}
          </Button>

          {qrData ? (
            <div className="space-y-4 p-4 border rounded-lg bg-muted/10">
              <div className="text-center">
                <img 
                  src={qrData.qrCodeUrl} 
                  alt="Generated QR Code" 
                  className="mx-auto rounded-lg border shadow-sm max-w-[250px]"
                />
              </div>
              
              <div className="space-y-3">
                <div>
                  <Label className="text-sm font-medium">USSD Code</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="flex-1 bg-muted px-3 py-2 rounded font-mono text-sm">
                      {qrData.ussd}
                    </code>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => copyToClipboard(qrData.ussd, "USSD code")}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium">Tel Link</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="flex-1 bg-muted px-3 py-2 rounded font-mono text-sm truncate">
                      {qrData.telLink}
                    </code>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => copyToClipboard(qrData.telLink, "Tel link")}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => window.open(qrData.telLink)}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button variant="outline" onClick={downloadQR} className="flex-1">
                    <Download className="h-4 w-4 mr-2" />
                    Download QR
                  </Button>
                  <Button variant="outline" onClick={() => {
                    setQrData(null);
                    setPhone("");
                    setCode("");
                    setAmount("");
                  }} className="flex-1">
                    Generate New
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground border-2 border-dashed border-border/20 rounded-lg">
              {isGenerating ? "Generating QR code..." : "QR code will appear here after generation"}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}