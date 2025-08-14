import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, FileText, Eye, CheckCircle, XCircle, Camera, Car } from "lucide-react";
import { processInsuranceDocument, saveVehicleData, VehicleData } from "@/lib/backend-placeholders";
import { toast } from "sonner";

interface OCRResult {
  plate?: string;
  vin?: string;
  make?: string;
  model?: string;
  model_year?: number;
  insurance_provider?: string;
  insurance_policy?: string;
  insurance_expiry?: string;
}

export function VehicleOCR() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [ocrResult, setOcrResult] = useState<OCRResult | null>(null);
  const [ownerPhone, setOwnerPhone] = useState<string>("");
  const [usageType, setUsageType] = useState<string>("");

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      toast.error("Please select a valid image (JPEG, PNG, WebP) or PDF file");
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File size must be less than 10MB");
      return;
    }

    setSelectedFile(file);
    setOcrResult(null);

    // Create preview URL for images
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    } else {
      setPreviewUrl("");
    }
  }, []);

  const handleOCRProcess = async () => {
    if (!selectedFile) {
      toast.error("Please select a file first");
      return;
    }

    setIsProcessing(true);
    try {
      // Convert file to base64 for OCR
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(selectedFile);
      });

      // Process with OCR
      const result = await processInsuranceDocument(base64);
      setOcrResult(result);
      toast.success("Insurance document processed successfully!");
    } catch (error) {
      console.error("OCR processing error:", error);
      toast.error("Failed to process document");
    } finally {
      setIsProcessing(false);
    }
  };

  const clearSelection = () => {
    setSelectedFile(null);
    setPreviewUrl("");
    setOcrResult(null);
    setOwnerPhone("");
    setUsageType("");
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  };

  const handleSaveVehicle = async () => {
    if (!ocrResult || !ownerPhone || !usageType) {
      toast.error("Please complete all required fields");
      return;
    }

    // Normalize phone number to local format
    const localPhone = ownerPhone.startsWith("+250") ? `0${ownerPhone.slice(4)}` : ownerPhone;

    setIsSaving(true);
    try {
      const vehicleData: VehicleData = {
        plate: ocrResult.plate || "",
        vin: ocrResult.vin,
        make: ocrResult.make,
        model: ocrResult.model,
        model_year: ocrResult.model_year,
        usage_type: usageType as VehicleData['usage_type'],
        owner_phone: localPhone,
        insurance_provider: ocrResult.insurance_provider,
        insurance_policy: ocrResult.insurance_policy,
        insurance_expiry: ocrResult.insurance_expiry
      };

      const result = await saveVehicleData(vehicleData);
      if (result.success) {
        toast.success("Vehicle registered successfully!");
        clearSelection();
      }
    } catch (error) {
      console.error("Save error:", error);
      toast.error("Failed to save vehicle data");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold gradient-text mb-2">Vehicle Document OCR</h1>
        <p className="text-muted-foreground">Upload insurance certificates for automatic data extraction</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Upload Section */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Document Upload
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border-2 border-dashed border-border/20 rounded-lg p-6 text-center">
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={handleFileSelect}
                className="hidden"
                id="file-upload"
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-sm font-medium mb-2">Click to upload document</p>
                <p className="text-xs text-muted-foreground">
                  Supports JPEG, PNG, WebP, PDF (max 10MB)
                </p>
              </label>
            </div>

            {selectedFile && (
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-muted/20 rounded-lg">
                  <FileText className="h-8 w-8 text-primary" />
                  <div className="flex-1">
                    <p className="font-medium text-sm">{selectedFile.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={clearSelection}>
                    <XCircle className="h-4 w-4" />
                  </Button>
                </div>

                {previewUrl && (
                  <div className="rounded-lg overflow-hidden border">
                    <img 
                      src={previewUrl} 
                      alt="Document preview" 
                      className="w-full h-48 object-cover"
                    />
                  </div>
                )}

                <Button 
                  onClick={handleOCRProcess}
                  disabled={isProcessing}
                  className="w-full bg-gradient-primary hover:opacity-90"
                >
                  <Eye className="h-4 w-4 mr-2" />
                  {isProcessing ? "Processing..." : "Extract Data"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Results Section */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              Extracted Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!ocrResult ? (
              <div className="text-center py-8 text-muted-foreground">
                {isProcessing ? (
                  <div className="space-y-3">
                    <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto" />
                    <p>Processing document...</p>
                  </div>
                ) : (
                  <p>Upload and process a document to see extracted data</p>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium">License Plate</Label>
                    <Input 
                      value={ocrResult.plate || ""} 
                      readOnly 
                      className="mt-1" 
                      placeholder="Not detected"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium">VIN</Label>
                    <Input 
                      value={ocrResult.vin || ""} 
                      readOnly 
                      className="mt-1" 
                      placeholder="Not detected"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium">Make</Label>
                    <Input 
                      value={ocrResult.make || ""} 
                      readOnly 
                      className="mt-1" 
                      placeholder="Not detected"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Model</Label>
                    <Input 
                      value={ocrResult.model || ""} 
                      readOnly 
                      className="mt-1" 
                      placeholder="Not detected"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium">Year</Label>
                    <Input 
                      value={ocrResult.model_year?.toString() || ""} 
                      readOnly 
                      className="mt-1" 
                      placeholder="Not detected"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Insurance Provider</Label>
                    <Input 
                      value={ocrResult.insurance_provider || ""} 
                      readOnly 
                      className="mt-1" 
                      placeholder="Not detected"
                    />
                  </div>
                </div>

                 <div className="grid grid-cols-2 gap-4">
                   <div>
                     <Label className="text-sm font-medium">Policy Number</Label>
                     <Input 
                       value={ocrResult.insurance_policy || ""} 
                       readOnly 
                       className="mt-1" 
                       placeholder="Not detected"
                     />
                   </div>
                   <div>
                     <Label className="text-sm font-medium">Insurance Expiry</Label>
                     <Input 
                       value={ocrResult.insurance_expiry || ""} 
                       readOnly 
                       className="mt-1" 
                       placeholder="Not detected"
                     />
                   </div>
                 </div>

                 {/* Owner Information */}
                 <div className="border-t pt-4 mt-4">
                   <h4 className="font-medium mb-3 flex items-center gap-2">
                     <Car className="h-4 w-4" />
                     Owner Information
                   </h4>
                   <div className="grid grid-cols-2 gap-4">
                     <div>
                       <Label className="text-sm font-medium">Owner Phone *</Label>
                       <Input 
                         value={ownerPhone} 
                         onChange={(e) => setOwnerPhone(e.target.value)}
                         className="mt-1" 
                         placeholder="0788123456"
                       />
                     </div>
                     <div>
                       <Label className="text-sm font-medium">Usage Type *</Label>
                       <Select value={usageType} onValueChange={setUsageType}>
                         <SelectTrigger className="mt-1">
                           <SelectValue placeholder="Select usage type" />
                         </SelectTrigger>
                         <SelectContent>
                           <SelectItem value="personal">Personal</SelectItem>
                           <SelectItem value="commercial">Commercial</SelectItem>
                           <SelectItem value="taxi">Taxi</SelectItem>
                           <SelectItem value="motorcycle">Motorcycle</SelectItem>
                         </SelectContent>
                       </Select>
                     </div>
                   </div>
                 </div>

                 <div className="flex gap-2 pt-4">
                   <Button variant="outline" onClick={clearSelection} className="flex-1">
                     Process Another
                   </Button>
                   <Button 
                     onClick={handleSaveVehicle}
                     disabled={isSaving || !ownerPhone || !usageType}
                     className="flex-1 bg-gradient-primary hover:opacity-90"
                   >
                     {isSaving ? "Saving..." : "Save Vehicle Data"}
                   </Button>
                 </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}