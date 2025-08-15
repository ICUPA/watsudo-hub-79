import { useState, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Scan, Upload, ExternalLink, Copy, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Mock decode function for demonstration
const mockDecodeQR = async (base64: string): Promise<{success: boolean; ussd?: string}> => {
  const mockUSSD = "*182*1*1*0788123456*5000#";
  return { success: true, ussd: mockUSSD };
};

interface DecodedQR {
  success: boolean;
  ussd?: string;
  telLink?: string;
  amount?: number;
  phoneNumber?: string;
  type?: 'phone' | 'code';
}

export function ScanQRFlow() {
  const [isScanning, setIsScanning] = useState(false);
  const [decodedData, setDecodedData] = useState<DecodedQR | null>(null);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error("Please upload an image file");
      return;
    }

    setIsScanning(true);
    setUploadedImage(URL.createObjectURL(file));

    try {
      // Convert to base64
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });

      // Mock decode with realistic processing time
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Mock QR decode function
      const result = await mockDecodeQR(base64);
      
      if (result.success && result.ussd) {
        // Parse the USSD code to extract details
        const ussdMatch = result.ussd.match(/\*182\*(\d+)\*1\*(\d+)(?:\*(\d+))?\#/);
        
        if (ussdMatch) {
          const [, service, , phoneOrCode, amount] = ussdMatch;
          const isPhoneType = service === '1';
          
          setDecodedData({
            success: true,
            ussd: result.ussd,
            telLink: `tel:${result.ussd.replace(/#/g, '%23')}`,
            type: isPhoneType ? 'phone' : 'code',
            phoneNumber: isPhoneType ? `0${phoneOrCode}` : undefined,
            amount: amount ? parseInt(amount) : undefined
          });
          
          toast.success("QR code decoded successfully!");
        } else {
          throw new Error("Invalid USSD format");
        }
      } else {
        setDecodedData({ success: false });
        toast.error("Could not decode QR code. Please try a clearer image.");
      }
    } catch (error) {
      console.error("QR decode error:", error);
      setDecodedData({ success: false });
      toast.error("Failed to decode QR code");
    } finally {
      setIsScanning(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast.success(`${label} copied to clipboard`);
    });
  };

  const executeUSSD = (ussd: string) => {
    const telLink = `tel:${ussd.replace(/#/g, '%23')}`;
    window.open(telLink, '_blank');
    toast.success("Opening USSD dialer");
  };

  const resetScan = () => {
    setDecodedData(null);
    setUploadedImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold gradient-text mb-2">
          Scan QR Code
        </h1>
        <p className="text-muted-foreground">
          Upload and decode USSD QR codes for mobile payments
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Scan className="h-5 w-5" />
              QR Code Scanner
            </CardTitle>
            <CardDescription>
              Upload a QR code image to decode the USSD information
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border-2 border-dashed border-border/20 rounded-lg p-8 text-center">
              {uploadedImage ? (
                <div className="space-y-4">
                  <img
                    src={uploadedImage}
                    alt="Uploaded QR Code"
                    className="max-w-full max-h-64 mx-auto rounded border"
                  />
                  <div className="flex justify-center gap-2">
                    <Button
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isScanning}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Different
                    </Button>
                    <Button
                      variant="outline"
                      onClick={resetScan}
                      disabled={isScanning}
                    >
                      Reset
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <Scan className="h-16 w-16 mx-auto text-muted-foreground" />
                  <div>
                    <h3 className="text-lg font-medium">Upload QR Code</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Select an image file containing a USSD QR code
                    </p>
                    <Button 
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isScanning}
                      className="bg-gradient-primary hover:opacity-90"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      {isScanning ? "Scanning..." : "Choose Image"}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageUpload}
            />

            {isScanning && (
              <div className="flex items-center justify-center gap-2 p-4 bg-primary/10 rounded-lg">
                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                <span className="text-sm font-medium">Decoding QR code...</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {decodedData?.success ? (
                <CheckCircle className="h-5 w-5 text-success" />
              ) : decodedData && !decodedData.success ? (
                <XCircle className="h-5 w-5 text-destructive" />
              ) : (
                <AlertCircle className="h-5 w-5 text-muted-foreground" />
              )}
              Decoded Information
            </CardTitle>
            <CardDescription>
              {decodedData?.success ? "QR code successfully decoded" : 
               decodedData && !decodedData.success ? "Failed to decode QR code" :
               "Upload a QR code to see decoded information"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {decodedData?.success ? (
              <div className="space-y-4">
                <div className="p-4 bg-success/10 border border-success/20 rounded-lg">
                  <div className="flex items-center gap-2 text-success mb-2">
                    <CheckCircle className="h-4 w-4" />
                    <span className="font-medium">Decoding Successful</span>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium">Payment Type</label>
                      <p className="text-sm">
                        {decodedData.type === 'phone' ? 'Phone Number Payment' : 'MoMo Code Payment'}
                      </p>
                    </div>
                    
                    {decodedData.phoneNumber && (
                      <div>
                        <label className="text-sm font-medium">Phone Number</label>
                        <div className="flex items-center gap-2 mt-1">
                          <code className="bg-muted px-2 py-1 rounded text-sm">
                            {decodedData.phoneNumber}
                          </code>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => copyToClipboard(decodedData.phoneNumber!, "Phone number")}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    )}

                    {decodedData.amount && (
                      <div>
                        <label className="text-sm font-medium">Amount</label>
                        <p className="text-lg font-bold text-success">
                          {decodedData.amount.toLocaleString()} RWF
                        </p>
                      </div>
                    )}

                    <div>
                      <label className="text-sm font-medium">USSD Code</label>
                      <div className="flex items-center gap-2 mt-1">
                        <code className="flex-1 bg-muted px-3 py-2 rounded font-mono text-sm">
                          {decodedData.ussd}
                        </code>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => copyToClipboard(decodedData.ussd!, "USSD code")}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <Button 
                        onClick={() => executeUSSD(decodedData.ussd!)}
                        className="flex-1 bg-gradient-primary hover:opacity-90"
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Pay Now
                      </Button>
                      <Button 
                        variant="outline" 
                        onClick={() => {
                          // Mock save functionality
                          toast.success("Payment saved to collection");
                        }}
                        className="flex-1"
                      >
                        Save Payment
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ) : decodedData && !decodedData.success ? (
              <div className="space-y-4">
                <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <div className="flex items-center gap-2 text-destructive mb-2">
                    <XCircle className="h-4 w-4" />
                    <span className="font-medium">Decoding Failed</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Could not decode the QR code. Please ensure:
                  </p>
                  <ul className="text-sm text-muted-foreground mt-2 space-y-1">
                    <li>• Image is clear and well-lit</li>
                    <li>• QR code is fully visible</li>
                    <li>• Image format is supported (JPG, PNG)</li>
                    <li>• QR code contains valid USSD data</li>
                  </ul>
                </div>
                
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Try Different Image
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={resetScan}
                    className="flex-1"
                  >
                    Reset
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground border-2 border-dashed border-border/20 rounded-lg">
                <Scan className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Upload a QR code to see decoded information</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle>QR Code Information</CardTitle>
          <CardDescription>
            Learn about supported QR code formats and USSD structures
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="formats" className="space-y-4">
            <TabsList>
              <TabsTrigger value="formats">Supported Formats</TabsTrigger>
              <TabsTrigger value="examples">Examples</TabsTrigger>
              <TabsTrigger value="troubleshooting">Troubleshooting</TabsTrigger>
            </TabsList>

            <TabsContent value="formats" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium mb-2">Phone Number Payments</h4>
                  <p className="text-sm text-muted-foreground mb-2">
                    Direct payments to phone numbers
                  </p>
                  <code className="text-xs bg-muted p-2 rounded block">
                    *182*1*1*[phone]*[amount]#
                  </code>
                </div>
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium mb-2">MoMo Code Payments</h4>
                  <p className="text-sm text-muted-foreground mb-2">
                    Payments using MoMo codes
                  </p>
                  <code className="text-xs bg-muted p-2 rounded block">
                    *182*8*1*[code]*[amount]#
                  </code>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="examples" className="space-y-4">
              <div className="space-y-4">
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium mb-2">Example 1: Phone Payment with Amount</h4>
                  <code className="text-sm bg-muted p-2 rounded block">
                    *182*1*1*788123456*5000#
                  </code>
                  <p className="text-xs text-muted-foreground mt-2">
                    Payment of 5,000 RWF to phone number 0788123456
                  </p>
                </div>
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium mb-2">Example 2: MoMo Code Payment</h4>
                  <code className="text-sm bg-muted p-2 rounded block">
                    *182*8*1*1234*2000#
                  </code>
                  <p className="text-xs text-muted-foreground mt-2">
                    Payment of 2,000 RWF using MoMo code 1234
                  </p>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="troubleshooting" className="space-y-4">
              <div className="space-y-4">
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium mb-2">Common Issues</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• <strong>Blurry images:</strong> Ensure good lighting and stable camera</li>
                    <li>• <strong>Partial QR codes:</strong> Make sure entire code is visible</li>
                    <li>• <strong>Invalid format:</strong> Only USSD QR codes are supported</li>
                    <li>• <strong>Large files:</strong> Compress images if upload fails</li>
                  </ul>
                </div>
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium mb-2">Best Practices</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Use good lighting when capturing QR codes</li>
                    <li>• Keep camera steady and focused</li>
                    <li>• Ensure QR code fills most of the frame</li>
                    <li>• Use PNG or JPG formats for best results</li>
                  </ul>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}