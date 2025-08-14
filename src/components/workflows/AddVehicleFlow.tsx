import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Car, Upload, FileText, CheckCircle, AlertCircle } from "lucide-react";
import { processInsuranceDocument, saveVehicleData } from "@/lib/backend-placeholders";
import { toast } from "sonner";

interface VehicleData {
  plate?: string;
  vin?: string;
  make?: string;
  model?: string;
  model_year?: number;
  usage_type?: string;
  owner_phone?: string;
  insurance_provider?: string;
  insurance_policy?: string;
  insurance_expiry?: string;
}

interface WorkflowState {
  step: 'usage_type' | 'document_upload' | 'processing' | 'verification' | 'success';
  usageType?: string;
  extractedData?: VehicleData;
  vehicleId?: string;
  isProcessing?: boolean;
}

const usageTypes = [
  { value: 'moto_taxi', label: 'Moto Taxi', description: 'Passenger transport' },
  { value: 'cab', label: 'Cab', description: 'Car taxi service' },
  { value: 'liffan', label: 'Liffan', description: 'Goods transport' },
  { value: 'truck', label: 'Truck', description: 'Heavy goods' },
  { value: 'rental', label: 'Rental', description: 'Rental service' },
  { value: 'other', label: 'Other', description: 'Other purposes' }
];

export function AddVehicleFlow() {
  const [state, setState] = useState<WorkflowState>({ step: 'usage_type' });

  const handleUsageTypeSelect = (usageType: string) => {
    setState({ ...state, usageType, step: 'document_upload' });
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setState({ ...state, step: 'processing', isProcessing: true });

    try {
      // Convert file to base64
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });

      // Process with OCR
      const extractedData = await processInsuranceDocument(base64);
      setState({ 
        ...state, 
        extractedData, 
        step: 'verification',
        isProcessing: false 
      });
      toast.success('Document processed successfully!');
    } catch (error) {
      toast.error('Failed to process document');
      setState({ ...state, step: 'document_upload', isProcessing: false });
    }
  };

  const handleDataVerification = async (verified: boolean) => {
    if (!verified) {
      setState({ ...state, step: 'document_upload' });
      return;
    }

    try {
      const vehicleData = {
        plate: state.extractedData.plate || 'UNKNOWN',
        ...state.extractedData,
        usage_type: state.usageType as any,
        owner_phone: '+250788767816' // Mock phone
      };

      const result = await saveVehicleData(vehicleData);
      if (result.success) {
        setState({ 
          ...state, 
          vehicleId: result.id, 
          step: 'success' 
        });
        toast.success('Vehicle added successfully!');
      }
    } catch (error) {
      toast.error('Failed to save vehicle data');
    }
  };

  const resetFlow = () => {
    setState({ step: 'usage_type' });
  };

  const getUsageTypeLabel = (value: string) => {
    return usageTypes.find(type => type.value === value)?.label || value;
  };

  const getDriverFeatures = (usageType: string) => {
    const driverTypes = ['moto_taxi', 'cab', 'liffan', 'truck'];
    return driverTypes.includes(usageType);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Add Vehicle Workflow</h1>
        <p className="text-muted-foreground">Register vehicles using insurance certificate OCR</p>
      </div>

      {state.step === 'usage_type' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Car className="h-5 w-5" />
              Choose Vehicle Usage Type
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {usageTypes.map((type) => (
                <Button
                  key={type.value}
                  variant="outline"
                  className="h-24 flex flex-col items-center justify-center gap-2 hover:bg-primary/5"
                  onClick={() => handleUsageTypeSelect(type.value)}
                >
                  <Car className="h-6 w-6" />
                  <div className="text-center">
                    <div className="font-medium">{type.label}</div>
                    <div className="text-xs text-muted-foreground">{type.description}</div>
                  </div>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {state.step === 'document_upload' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Upload Insurance Certificate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div>
                <Badge variant="secondary" className="mb-4">
                  {getUsageTypeLabel(state.usageType!)}
                </Badge>
                <p className="text-muted-foreground">
                  Please upload a clear photo or PDF of your insurance certificate. 
                  Our OCR system will automatically extract vehicle information.
                </p>
              </div>

              <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="file-upload"
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <div className="text-lg font-medium mb-2">Upload Insurance Certificate</div>
                  <div className="text-sm text-muted-foreground">
                    Click to select file (JPG, PNG, PDF)
                  </div>
                </label>
              </div>

              <div className="text-xs text-muted-foreground">
                <p>✓ Supported formats: JPEG, PNG, PDF</p>
                <p>✓ Maximum file size: 10MB</p>
                <p>✓ Ensure text is clear and readable</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {state.step === 'processing' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 animate-spin" />
              Processing Document
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 bg-primary/10 rounded-full flex items-center justify-center">
                <FileText className="h-8 w-8 text-primary animate-pulse" />
              </div>
              <p className="text-lg font-medium mb-2">Extracting vehicle information...</p>
              <p className="text-sm text-muted-foreground">
                Using OCR to read insurance certificate data
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {state.step === 'verification' && state.extractedData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Verify Extracted Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <p className="text-muted-foreground">
                Please verify the information extracted from your insurance certificate:
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Plate Number</label>
                    <div className="text-lg font-semibold">{state.extractedData.plate || 'Not found'}</div>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">VIN</label>
                    <div className="text-lg">{state.extractedData.vin || 'Not found'}</div>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Make & Model</label>
                    <div className="text-lg">{state.extractedData.make} {state.extractedData.model}</div>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Year</label>
                    <div className="text-lg">{state.extractedData.model_year}</div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Insurance Provider</label>
                    <div className="text-lg font-semibold">{state.extractedData.insurance_provider}</div>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Policy Number</label>
                    <div className="text-lg">{state.extractedData.insurance_policy}</div>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Expiry Date</label>
                    <div className="text-lg">{state.extractedData.insurance_expiry}</div>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Usage Type</label>
                    <div className="text-lg">
                      <Badge variant="default">
                        {getUsageTypeLabel(state.usageType!)}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <Button 
                  onClick={() => handleDataVerification(true)}
                  className="flex-1"
                >
                  ✓ Information is Correct
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => handleDataVerification(false)}
                  className="flex-1"
                >
                  ✗ Re-upload Document
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {state.step === 'success' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle className="h-5 w-5" />
              Vehicle Added Successfully!
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Vehicle</label>
                  <div className="text-lg font-semibold">
                    {state.extractedData?.plate} - {state.extractedData?.make} {state.extractedData?.model}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Usage Type</label>
                  <div className="text-lg">
                    <Badge variant="default">
                      {getUsageTypeLabel(state.usageType!)}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="border rounded-lg p-4 bg-muted/20">
                <h4 className="font-semibold mb-2">Next Actions Available:</h4>
                <div className="space-y-2 text-sm">
                  {getDriverFeatures(state.usageType!) ? (
                    <>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span>Driver features enabled</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span>Can receive passenger requests</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span>Schedule trips available</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span>Live tracking enabled</span>
                      </div>
                    </>
                  ) : state.usageType === 'rental' ? (
                    <>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span>Listed under Rentals</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span>Owner chat enabled</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span>Availability calendar active</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span>Vehicle stored in system</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="text-xs text-muted-foreground">
                Vehicle ID: {state.vehicleId}
              </div>

              <Button onClick={resetFlow} variant="outline" className="w-full">
                Add Another Vehicle
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}