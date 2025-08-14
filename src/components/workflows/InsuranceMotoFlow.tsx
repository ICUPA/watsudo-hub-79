import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Shield, Upload, Calendar, Package, User, CreditCard, FileText, CheckCircle, Clock } from "lucide-react";
import { toast } from "sonner";

interface InsuranceState {
  step: 'vehicle_check' | 'document_upload' | 'start_date' | 'addons' | 'pa_category' | 
        'summary' | 'quotation_pending' | 'quotation_received' | 'payment_plan' | 'payment_pending' | 'certificate';
  hasVehicleOnFile?: boolean;
  startDate?: string;
  endDate?: string;
  selectedAddons?: string[];
  paCategory?: string;
  quoteId?: string;
  paymentMethod?: string;
}

// Default coverage is one year from start date
const defaultCoverageDays = 365;

const insuranceAddons = [
  { value: 'third_party', label: 'Third-party Liability', price: 10000 },
  { value: 'comesa', label: 'COMESA Yellow Card', price: 8000 },
  { value: 'personal_accident', label: 'Personal Accident (PA)', price: 0 }, // Price varies by category
  { value: 'none', label: 'No additional coverage', price: 0 }
];

const paCategories = [
  { 
    value: 'category_1', 
    label: 'Category I', 
    death: 1000000, 
    disability: 1000000, 
    medical: 100000,
    privatePrice: 5000,
    motoPrice: 8000,
    commercialPrice: 10000
  },
  { 
    value: 'category_2', 
    label: 'Category II', 
    death: 2000000, 
    disability: 2000000, 
    medical: 200000,
    privatePrice: 10000,
    motoPrice: 16000,
    commercialPrice: 20000
  },
  { 
    value: 'category_3', 
    label: 'Category III', 
    death: 3000000, 
    disability: 3000000, 
    medical: 300000,
    privatePrice: 15000,
    motoPrice: 24000,
    commercialPrice: 30000
  },
  { 
    value: 'category_4', 
    label: 'Category IV', 
    death: 4000000, 
    disability: 4000000, 
    medical: 400000,
    privatePrice: 20000,
    motoPrice: 32000,
    commercialPrice: 40000
  },
  { 
    value: 'category_5', 
    label: 'Category V', 
    death: 5000000, 
    disability: 5000000, 
    medical: 500000,
    privatePrice: 25000,
    motoPrice: 40000,
    commercialPrice: 50000
  }
];

const paymentPlans = [
  { 
    value: 'option_1', 
    label: 'Option 1 - 3 Payments', 
    installments: [
      { period: '1 Month', percentage: 25 },
      { period: '2 Months', percentage: 25 },
      { period: '9 Months', percentage: 50 }
    ]
  },
  { 
    value: 'option_2', 
    label: 'Option 2 - 2 Payments', 
    installments: [
      { period: '3 Months', percentage: 50 },
      { period: '9 Months', percentage: 50 }
    ]
  },
  { 
    value: 'option_3', 
    label: 'Option 3 - 2 Payments', 
    installments: [
      { period: '6 Months', percentage: 75 },
      { period: '6 Months', percentage: 25 }
    ]
  },
  { 
    value: 'option_4', 
    label: 'Option 4 - 3 Payments', 
    installments: [
      { period: '1 Month', percentage: 25 },
      { period: '3 Months', percentage: 35 },
      { period: '8 Months', percentage: 40 }
    ]
  }
];

export function InsuranceMotoFlow() {
  const [state, setState] = useState<InsuranceState>({ step: 'vehicle_check' });
  const [isLoading, setIsLoading] = useState(false);

  const checkVehicleOnFile = async () => {
    setIsLoading(true);
    // Simulate checking for vehicle records
    setTimeout(() => {
      const hasVehicle = Math.random() > 0.3; // 70% chance of having vehicle
      setState({ ...state, hasVehicleOnFile: hasVehicle });
      
      if (hasVehicle) {
        toast.success('Vehicle found: RAD123A');
        setTimeout(() => {
          setState({ ...state, hasVehicleOnFile: hasVehicle, step: 'start_date' });
        }, 1000);
      } else {
        toast.info('No vehicle on file - please upload documents');
      }
      setIsLoading(false);
    }, 1500);
  };

  const handleDocumentUpload = () => {
    setIsLoading(true);
    // Simulate document processing
    setTimeout(() => {
      toast.success('Documents verified successfully');
      setState({ ...state, hasVehicleOnFile: true, step: 'start_date' });
      setIsLoading(false);
    }, 2000);
  };

  const handleStartDate = (date: string) => {
    // Calculate end date as one year from start date
    const startDate = date === 'today' ? new Date() : new Date(date);
    const endDate = new Date(startDate);
    endDate.setFullYear(endDate.getFullYear() + 1);
    
    setState({ 
      ...state, 
      startDate: date, 
      endDate: endDate.toISOString().split('T')[0],
      step: 'addons' 
    });
  };

  const handleEndDateChange = (endDate: string) => {
    setState({ ...state, endDate });
  };

  const handleAddonSelection = (addons: string[]) => {
    setState({ ...state, selectedAddons: addons });
  };

  const proceedFromAddons = () => {
    if (state.selectedAddons?.includes('personal_accident')) {
      setState({ ...state, step: 'pa_category' });
    } else {
      setState({ ...state, step: 'summary' });
    }
  };

  const handlePACategory = (category: string) => {
    setState({ ...state, paCategory: category, step: 'summary' });
  };

  const handleQuotationRequest = () => {
    const quoteId = `QUOTE_${Date.now()}`;
    setState({ ...state, quoteId, step: 'quotation_pending' });
    
    // Simulate quotation preparation
    setTimeout(() => {
      setState(prev => ({ ...prev, step: 'quotation_received' }));
      toast.success('Quotation ready!');
    }, 5000);
  };

  const handlePaymentPlan = (plan: string) => {
    setState({ ...state, paymentMethod: plan, step: 'payment_pending' });
    
    // Simulate payment processing
    setTimeout(() => {
      setState(prev => ({ ...prev, step: 'certificate' }));
      toast.success('Payment received! Certificate being prepared...');
    }, 3000);
  };

  const resetFlow = () => {
    setState({ step: 'vehicle_check' });
  };

  const calculateTotal = () => {
    let total = 150000; // Base one year price
    
    // Addon prices
    state.selectedAddons?.forEach(addon => {
      const addonItem = insuranceAddons.find(a => a.value === addon);
      if (addonItem) total += addonItem.price;
    });
    
    // PA category price (using moto price for this example)
    if (state.paCategory) {
      const paItem = paCategories.find(p => p.value === state.paCategory);
      if (paItem) total += paItem.motoPrice;
    }
    
    return total;
  };

  const formatCurrency = (amount: number) => {
    return `${amount.toLocaleString()} RWF`;
  };

  // Initialize flow
  if (state.step === 'vehicle_check' && !state.hasVehicleOnFile && !isLoading) {
    checkVehicleOnFile();
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Insurance for Moto Workflow</h1>
        <p className="text-muted-foreground">Complete moto insurance process with quotation and payment</p>
      </div>

      {state.step === 'vehicle_check' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Vehicle Check
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              {isLoading ? (
                <>
                  <div className="w-16 h-16 mx-auto mb-4 bg-primary/10 rounded-full flex items-center justify-center">
                    <Shield className="h-8 w-8 text-primary animate-pulse" />
                  </div>
                  <p className="text-lg font-medium mb-2">Checking your vehicle records...</p>
                  <p className="text-sm text-muted-foreground">Please wait while we verify your information</p>
                </>
              ) : state.hasVehicleOnFile === false ? (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Documents Required</h3>
                    <p className="text-muted-foreground mb-4">
                      Please upload the following documents to proceed:
                    </p>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        <span>Carte Jaune (Vehicle Registration)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        <span>Old Insurance Certificate (if available)</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="border-2 border-dashed border-border rounded-lg p-6">
                    <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground mb-4">Upload documents or contact support</p>
                    <div className="space-y-2">
                      <Button onClick={handleDocumentUpload} className="w-full">
                        Upload Documents
                      </Button>
                      <Button variant="outline" className="w-full">
                        Chat with Agent
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <CheckCircle className="h-16 w-16 mx-auto text-green-500" />
                  <div>
                    <h3 className="text-lg font-semibold text-green-600">Vehicle Found!</h3>
                    <p className="text-muted-foreground">RAD123A - Ready for insurance quote</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {state.step === 'start_date' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Insurance Coverage Dates
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-muted-foreground">Select when your insurance coverage should begin (Coverage is for one year by default):</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button
                  variant="outline"
                  className="h-20 flex flex-col items-center justify-center gap-2"
                  onClick={() => handleStartDate('today')}
                >
                  <Calendar className="h-6 w-6" />
                  <span>Start Today</span>
                </Button>
                
                <Button
                  variant="outline"
                  className="h-20 flex flex-col items-center justify-center gap-2"
                  onClick={() => handleStartDate('pick_date')}
                >
                  <Calendar className="h-6 w-6" />
                  <span>Pick Another Date</span>
                </Button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Custom Start Date (Future dates only)</label>
                  <input
                    type="date"
                    className="w-full px-3 py-2 border rounded-lg"
                    min={new Date().toISOString().split('T')[0]}
                    onChange={(e) => handleStartDate(e.target.value)}
                  />
                </div>
                
                {state.startDate && state.endDate && (
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      End Date (Edit if you want less than one year coverage)
                    </label>
                    <input
                      type="date"
                      className="w-full px-3 py-2 border rounded-lg"
                      value={state.endDate}
                      min={state.startDate === 'today' ? new Date().toISOString().split('T')[0] : state.startDate}
                      max={(() => {
                        const startDate = state.startDate === 'today' ? new Date() : new Date(state.startDate);
                        const maxDate = new Date(startDate);
                        maxDate.setFullYear(maxDate.getFullYear() + 1);
                        return maxDate.toISOString().split('T')[0];
                      })()}
                      onChange={(e) => handleEndDateChange(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Coverage period: {state.startDate === 'today' ? 'Today' : state.startDate} to {state.endDate}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}


      {state.step === 'addons' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Insurance Add-ons
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-muted-foreground">Select additional coverage (you can select multiple):</p>
              
              <div className="space-y-3">
                {insuranceAddons.map((addon) => (
                  <div
                    key={addon.value}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/20 cursor-pointer"
                    onClick={() => {
                      const selected = state.selectedAddons?.includes(addon.value) 
                        ? state.selectedAddons.filter(a => a !== addon.value)
                        : [...(state.selectedAddons || []), addon.value];
                      
                      if (addon.value === 'none') {
                        handleAddonSelection(['none']);
                      } else {
                        const filtered = selected.filter(a => a !== 'none');
                        handleAddonSelection(filtered);
                      }
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-5 h-5 border-2 rounded ${
                        state.selectedAddons?.includes(addon.value) ? 'bg-primary border-primary' : 'border-border'
                      }`} />
                      <div>
                        <div className="font-medium">{addon.label}</div>
                        {addon.price > 0 && (
                          <div className="text-sm text-muted-foreground">+{formatCurrency(addon.price)}</div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              <Button 
                onClick={proceedFromAddons}
                className="w-full"
                disabled={!state.selectedAddons?.length}
              >
                Continue with Selected Add-ons
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {state.step === 'pa_category' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Personal Accident Category
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-muted-foreground">Select your Personal Accident coverage level:</p>
              
              <div className="space-y-3">
                {paCategories.map((category) => (
                  <Button
                    key={category.value}
                    variant="outline"
                    className="w-full h-auto p-4 flex flex-col items-start justify-start hover:bg-primary/5 text-left"
                    onClick={() => handlePACategory(category.value)}
                  >
                    <div className="w-full">
                      <div className="font-medium mb-2">{category.label}</div>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <div>Death: {formatCurrency(category.death)}</div>
                        <div>Permanent Disability: {formatCurrency(category.disability)}</div>
                        <div>Medical Fees: {formatCurrency(category.medical)}</div>
                      </div>
                      <div className="mt-2 text-right">
                        <div className="font-medium">Motorcycle: {formatCurrency(category.motoPrice)}</div>
                      </div>
                    </div>
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {state.step === 'summary' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Insurance Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Vehicle</label>
                    <div className="text-lg font-semibold">RAD123A</div>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Coverage Period</label>
                    <div className="text-lg">
                      {state.startDate === 'today' ? 'Today' : state.startDate} to {state.endDate}
                    </div>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Add-ons</label>
                    <div className="space-y-1">
                      {state.selectedAddons?.map(addon => (
                        <div key={addon} className="text-lg">
                          {insuranceAddons.find(a => a.value === addon)?.label}
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {state.paCategory && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">PA Category</label>
                      <div className="text-lg">
                        {paCategories.find(p => p.value === state.paCategory)?.label}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Death/Disability: {formatCurrency(paCategories.find(p => p.value === state.paCategory)?.death || 0)}
                      </div>
                    </div>
                  )}
                  
                  <div className="border-t pt-4">
                    <label className="text-sm font-medium text-muted-foreground">Total Premium</label>
                    <div className="text-2xl font-bold">{formatCurrency(calculateTotal())}</div>
                  </div>
                </div>
              </div>
              
              <div className="flex gap-3">
                <Button onClick={handleQuotationRequest} className="flex-1">
                  Proceed with Quotation
                </Button>
                <Button variant="outline" onClick={() => setState({ ...state, step: 'start_date' })}>
                  Modify Selection
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {state.step === 'quotation_pending' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 animate-spin" />
              Preparing Quotation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 bg-primary/10 rounded-full flex items-center justify-center">
                <FileText className="h-8 w-8 text-primary animate-pulse" />
              </div>
              <p className="text-lg font-medium mb-2">Please wait a few minutes...</p>
              <p className="text-sm text-muted-foreground">
                Our team is preparing your personalized insurance quotation
              </p>
              <div className="mt-4 text-xs text-muted-foreground">
                Quote ID: {state.quoteId}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {state.step === 'quotation_received' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle className="h-5 w-5" />
              Quotation Ready!
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="border rounded-lg p-4 bg-muted/20">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-semibold">Total Premium</h3>
                    <p className="text-2xl font-bold">{formatCurrency(calculateTotal())}</p>
                  </div>
                  <Badge variant="default">Quote ID: {state.quoteId}</Badge>
                </div>
                
                <div className="text-sm text-muted-foreground">
                  <p>📎 Detailed quotation document attached</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Button onClick={() => setState({ ...state, step: 'payment_plan' })}>
                  Proceed with Payment
                </Button>
                <Button variant="outline">
                  Request Changes
                </Button>
                <Button variant="ghost" onClick={resetFlow}>
                  Cancel
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {state.step === 'payment_plan' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Payment Plans
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-muted-foreground">Choose your preferred payment method:</p>
              
              <div className="space-y-3">
                {paymentPlans.map((plan) => (
                  <Button
                    key={plan.value}
                    variant="outline"
                    className="w-full h-auto p-4 flex flex-col items-start justify-start hover:bg-primary/5 text-left"
                    onClick={() => handlePaymentPlan(plan.value)}
                  >
                    <div className="w-full">
                      <div className="font-medium mb-2">{plan.label}</div>
                      <div className="text-sm text-muted-foreground space-y-1">
                        {plan.installments.map((installment, index) => (
                          <div key={index} className="flex justify-between">
                            <span>{installment.period}:</span>
                            <span>{installment.percentage}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {state.step === 'payment_pending' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 animate-pulse" />
              Processing Payment
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
                <CreditCard className="h-8 w-8 text-green-600" />
              </div>
              <p className="text-lg font-medium mb-2">Payment in progress...</p>
              <p className="text-sm text-muted-foreground">
                {state.paymentMethod === 'option_1' && 'Setting up 3-payment installment plan'}
                {state.paymentMethod === 'option_2' && 'Setting up 2-payment installment plan (3+9 months)'}
                {state.paymentMethod === 'option_3' && 'Setting up 2-payment installment plan (6+6 months)'}
                {state.paymentMethod === 'option_4' && 'Setting up 3-payment installment plan (1+3+8 months)'}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {state.step === 'certificate' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle className="h-5 w-5" />
              Payment Received!
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6 text-center">
              <div>
                <CheckCircle className="h-16 w-16 mx-auto text-green-500 mb-4" />
                <h3 className="text-xl font-semibold text-green-600">Insurance Active!</h3>
                <p className="text-muted-foreground">Your insurance policy is now active for RAD123A</p>
              </div>
              
              <div className="border rounded-lg p-4 bg-green-50">
                <div className="space-y-2 text-sm">
                  <p>✅ Payment successful</p>
                  <p>📧 Receipt sent to your email</p>
                  <p>📄 Insurance certificate being prepared</p>
                  <p>⏱️ Certificate will be ready in 24 hours</p>
                  <p>📱 You'll receive SMS notification</p>
                </div>
              </div>
              
              <div className="text-xs text-muted-foreground">
                Policy Number: {state.quoteId?.replace('QUOTE_', 'POL_')}
              </div>
              
              <Button onClick={resetFlow} variant="outline" className="w-full">
                Get Insurance for Another Vehicle
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}