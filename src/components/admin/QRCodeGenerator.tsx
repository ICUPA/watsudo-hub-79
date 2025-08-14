import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Download, Copy, Phone } from "lucide-react";
import { toast } from "sonner";

export function QRCodeGenerator() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [momoCode, setMomoCode] = useState('');
  const [amount, setAmount] = useState('');
  const [generateWithAmount, setGenerateWithAmount] = useState(false);
  const [generatedQR, setGeneratedQR] = useState<{
    imageUrl: string;
    ussdString: string;
    telUri: string;
  } | null>(null);
  const [generating, setGenerating] = useState(false);

  const buildUSSD = (type: 'phone' | 'code', identifier: string, amount?: string) => {
    if (type === 'phone') {
      return amount ? `*182*1*1*${identifier}*${amount}#` : `*182*1*1*${identifier}#`;
    } else {
      return amount ? `*182*8*1*${identifier}*${amount}#` : `*182*8*1*${identifier}#`;
    }
  };

  const telUriFromUssd = (ussd: string) => {
    return `tel:${ussd.replace('#', '%23')}`;
  };

  const generateQRCode = async (type: 'phone' | 'code') => {
    const identifier = type === 'phone' ? phoneNumber : momoCode;
    const amountValue = generateWithAmount ? amount : '';

    if (!identifier.trim()) {
      toast.error(`Please enter a ${type === 'phone' ? 'phone number' : 'MoMo code'}`);
      return;
    }

    if (generateWithAmount && (!amountValue || parseInt(amountValue) <= 0)) {
      toast.error('Please enter a valid amount');
      return;
    }

    if (type === 'phone' && !/^\+?2507\d{8}$/.test(identifier.replace(/\s/g, ''))) {
      toast.error('Please enter a valid Rwandan phone number (+2507XXXXXXXX)');
      return;
    }

    if (type === 'code' && !/^\d{4,9}$/.test(identifier)) {
      toast.error('Please enter a valid MoMo code (4-9 digits)');
      return;
    }

    try {
      setGenerating(true);
      
      const cleanIdentifier = type === 'phone' 
        ? identifier.replace(/^\+/, '').replace(/\s/g, '')
        : identifier;
      
      const ussdString = buildUSSD(type, cleanIdentifier, amountValue);
      const telUri = telUriFromUssd(ussdString);

      // Simulate QR code generation (in real implementation, this would generate the QR PNG)
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Mock QR code image (in production, this would be the actual generated QR code)
      const mockImageUrl = `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==`;
      
      setGeneratedQR({
        imageUrl: mockImageUrl,
        ussdString,
        telUri
      });

      toast.success('QR code generated successfully!');
    } catch (error) {
      console.error('Error generating QR code:', error);
      toast.error('Failed to generate QR code');
    } finally {
      setGenerating(false);
    }
  };

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${type} copied to clipboard`);
  };

  const downloadQR = () => {
    if (!generatedQR) return;
    
    // In production, this would download the actual QR image
    const link = document.createElement('a');
    link.href = generatedQR.imageUrl;
    link.download = `qr-code-${Date.now()}.png`;
    link.click();
    
    toast.success('QR code downloaded');
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold">QR Code Generator</h2>
      </div>

      <Tabs defaultValue="phone" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="phone">Phone Number</TabsTrigger>
          <TabsTrigger value="code">MoMo Code</TabsTrigger>
        </TabsList>

        <TabsContent value="phone" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Generate QR for Phone Number</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+250788123456"
                />
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="phone-amount"
                  checked={generateWithAmount}
                  onChange={(e) => setGenerateWithAmount(e.target.checked)}
                  className="rounded"
                />
                <Label htmlFor="phone-amount">Include amount</Label>
              </div>

              {generateWithAmount && (
                <div>
                  <Label htmlFor="phone-amount-input">Amount (RWF)</Label>
                  <Input
                    id="phone-amount-input"
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="1000"
                    min="1"
                  />
                </div>
              )}

              <Button 
                onClick={() => generateQRCode('phone')} 
                disabled={generating}
                className="w-full"
              >
                {generating ? 'Generating...' : 'Generate QR Code'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="code" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Generate QR for MoMo Code</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="code">MoMo Code</Label>
                <Input
                  id="code"
                  value={momoCode}
                  onChange={(e) => setMomoCode(e.target.value)}
                  placeholder="12345"
                />
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="code-amount"
                  checked={generateWithAmount}
                  onChange={(e) => setGenerateWithAmount(e.target.checked)}
                  className="rounded"
                />
                <Label htmlFor="code-amount">Include amount</Label>
              </div>

              {generateWithAmount && (
                <div>
                  <Label htmlFor="code-amount-input">Amount (RWF)</Label>
                  <Input
                    id="code-amount-input"
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="1000"
                    min="1"
                  />
                </div>
              )}

              <Button 
                onClick={() => generateQRCode('code')} 
                disabled={generating}
                className="w-full"
              >
                {generating ? 'Generating...' : 'Generate QR Code'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {generatedQR && (
        <Card>
          <CardHeader>
            <CardTitle>Generated QR Code</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center">
              <img 
                src={generatedQR.imageUrl} 
                alt="Generated QR Code" 
                className="mx-auto border rounded-lg bg-white p-4"
                style={{ width: '256px', height: '256px' }}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <span className="text-sm font-mono">{generatedQR.ussdString}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(generatedQR.ussdString, 'USSD')}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <span className="text-sm font-mono truncate">{generatedQR.telUri}</span>
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(generatedQR.telUri, 'Tel URI')}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(generatedQR.telUri)}
                  >
                    <Phone className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            <Button onClick={downloadQR} className="w-full">
              <Download className="h-4 w-4 mr-2" />
              Download QR Code
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}