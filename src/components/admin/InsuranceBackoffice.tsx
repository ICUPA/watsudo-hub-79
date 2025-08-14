import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FileUpload } from "@/components/ui/FileUpload";
import { 
  Clock, 
  Upload, 
  FileText, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Download,
  Send,
  Eye,
  Edit,
  DollarSign
} from "lucide-react";
import { toast } from "sonner";

interface InsuranceQuote {
  id: string;
  user_phone: string;
  vehicle_plate: string;
  start_date: string;
  period: string;
  addons: string[];
  pa_category?: string;
  premium_amount?: number;
  status: 'pending_backoffice' | 'quoted' | 'awaiting_payment' | 'paid' | 'issued' | 'cancelled';
  quotation_pdf?: string;
  certificate_pdf?: string;
  created_at: string;
  updated_at: string;
}

// Mock data
const mockQuotes: InsuranceQuote[] = [
  {
    id: "quote_001",
    user_phone: "0788123456",
    vehicle_plate: "RAD123A",
    start_date: "2024-12-20",
    period: "One year",
    addons: ["Third-party Liability", "Personal Accident (PA)"],
    pa_category: "Premium (1,000,000 RWF)",
    premium_amount: 45000,
    status: "pending_backoffice",
    created_at: "2024-12-15T10:30:00Z",
    updated_at: "2024-12-15T10:30:00Z"
  },
  {
    id: "quote_002",
    user_phone: "0788654321",
    vehicle_plate: "RBC456B",
    start_date: "2024-12-18",
    period: "Three months",
    addons: ["COMESA Yellow Card"],
    premium_amount: 15000,
    status: "quoted",
    quotation_pdf: "/docs/quote_002.pdf",
    created_at: "2024-12-14T14:20:00Z",
    updated_at: "2024-12-15T09:15:00Z"
  },
  {
    id: "quote_003",
    user_phone: "0788789012",
    vehicle_plate: "RCA789C",
    start_date: "2024-12-16",
    period: "One month",
    addons: ["Third-party Liability", "COMESA Yellow Card"],
    premium_amount: 8500,
    status: "paid",
    quotation_pdf: "/docs/quote_003.pdf",
    certificate_pdf: "/docs/cert_003.pdf",
    created_at: "2024-12-13T16:45:00Z",
    updated_at: "2024-12-15T11:20:00Z"
  }
];

export function InsuranceBackoffice() {
  const [quotes, setQuotes] = useState<InsuranceQuote[]>(mockQuotes);
  const [selectedQuote, setSelectedQuote] = useState<InsuranceQuote | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [premiumAmount, setPremiumAmount] = useState("");
  const [uploadingQuotation, setUploadingQuotation] = useState(false);
  const [uploadingCertificate, setUploadingCertificate] = useState(false);

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending_backoffice: { label: "Pending Review", variant: "destructive" as const, icon: Clock },
      quoted: { label: "Quotation Sent", variant: "default" as const, icon: FileText },
      awaiting_payment: { label: "Awaiting Payment", variant: "secondary" as const, icon: DollarSign },
      paid: { label: "Payment Received", variant: "default" as const, icon: CheckCircle },
      issued: { label: "Certificate Issued", variant: "default" as const, icon: CheckCircle },
      cancelled: { label: "Cancelled", variant: "outline" as const, icon: XCircle }
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending_backoffice;
    const Icon = config.icon;
    
    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const handleQuotationUpload = async (path: string) => {
    if (!selectedQuote) return;
    
    setUploadingQuotation(true);
    try {
      // Mock upload process
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      setQuotes(prev => prev.map(quote => 
        quote.id === selectedQuote.id 
          ? { 
              ...quote, 
              quotation_pdf: path, 
              status: 'quoted',
              premium_amount: premiumAmount ? parseInt(premiumAmount) : quote.premium_amount,
              updated_at: new Date().toISOString()
            }
          : quote
      ));
      
      toast.success("Quotation uploaded successfully!");
      setIsDialogOpen(false);
      setSelectedQuote(null);
      setPremiumAmount("");
    } catch (error) {
      toast.error("Failed to upload quotation");
    } finally {
      setUploadingQuotation(false);
    }
  };

  const handleCertificateUpload = async (path: string) => {
    if (!selectedQuote) return;
    
    setUploadingCertificate(true);
    try {
      // Mock upload process
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      setQuotes(prev => prev.map(quote => 
        quote.id === selectedQuote.id 
          ? { 
              ...quote, 
              certificate_pdf: path, 
              status: 'issued',
              updated_at: new Date().toISOString()
            }
          : quote
      ));
      
      toast.success("Certificate uploaded successfully!");
      setIsDialogOpen(false);
      setSelectedQuote(null);
    } catch (error) {
      toast.error("Failed to upload certificate");
    } finally {
      setUploadingCertificate(false);
    }
  };

  const markAwaitingPayment = (quoteId: string) => {
    setQuotes(prev => prev.map(quote => 
      quote.id === quoteId 
        ? { ...quote, status: 'awaiting_payment', updated_at: new Date().toISOString() }
        : quote
    ));
    toast.success("Quote marked as awaiting payment");
  };

  const filteredQuotes = (status: string) => {
    if (status === 'all') return quotes;
    return quotes.filter(quote => quote.status === status);
  };

  const QuoteTable = ({ quotes: displayQuotes }: { quotes: InsuranceQuote[] }) => (
    <div className="rounded-lg border border-border/20 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/20">
            <TableHead>Quote Details</TableHead>
            <TableHead>Vehicle & Period</TableHead>
            <TableHead>Add-ons</TableHead>
            <TableHead>Premium</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {displayQuotes.map((quote) => (
            <TableRow key={quote.id} className="hover:bg-muted/10">
              <TableCell>
                <div>
                  <p className="font-medium">{quote.id}</p>
                  <p className="text-sm text-muted-foreground">{quote.user_phone}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(quote.created_at).toLocaleDateString()}
                  </p>
                </div>
              </TableCell>
              <TableCell>
                <div>
                  <p className="font-medium">{quote.vehicle_plate}</p>
                  <p className="text-sm text-muted-foreground">{quote.period}</p>
                  <p className="text-xs text-muted-foreground">
                    Start: {new Date(quote.start_date).toLocaleDateString()}
                  </p>
                </div>
              </TableCell>
              <TableCell>
                <div className="space-y-1">
                  {quote.addons.map((addon, index) => (
                    <Badge key={index} variant="outline" className="text-xs mr-1">
                      {addon}
                    </Badge>
                  ))}
                  {quote.pa_category && (
                    <div className="text-xs text-muted-foreground">
                      PA: {quote.pa_category}
                    </div>
                  )}
                </div>
              </TableCell>
              <TableCell>
                {quote.premium_amount ? (
                  <span className="font-medium">{quote.premium_amount.toLocaleString()} RWF</span>
                ) : (
                  <span className="text-muted-foreground">Not set</span>
                )}
              </TableCell>
              <TableCell>
                {getStatusBadge(quote.status)}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2 justify-end">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => {
                      setSelectedQuote(quote);
                      setIsDialogOpen(true);
                    }}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  
                  {quote.status === 'pending_backoffice' && (
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => {
                        setSelectedQuote(quote);
                        setIsDialogOpen(true);
                      }}
                    >
                      <Upload className="h-4 w-4" />
                    </Button>
                  )}
                  
                  {quote.status === 'quoted' && (
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => markAwaitingPayment(quote.id)}
                      className="text-success hover:text-success"
                    >
                      <DollarSign className="h-4 w-4" />
                    </Button>
                  )}
                  
                  {quote.status === 'paid' && (
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => {
                        setSelectedQuote(quote);
                        setIsDialogOpen(true);
                      }}
                      className="text-primary hover:text-primary"
                    >
                      <FileText className="h-4 w-4" />
                    </Button>
                  )}
                  
                  {(quote.quotation_pdf || quote.certificate_pdf) && (
                    <Button variant="ghost" size="sm">
                      <Download className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold gradient-text mb-2">
          Insurance Backoffice
        </h1>
        <p className="text-muted-foreground">
          Manage insurance quotes, quotations, and certificate issuance
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-warning" />
              <div>
                <p className="text-sm font-medium">Pending Review</p>
                <p className="text-2xl font-bold">{filteredQuotes('pending_backoffice').length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-sm font-medium">Quoted</p>
                <p className="text-2xl font-bold">{filteredQuotes('quoted').length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-sm font-medium">Awaiting Payment</p>
                <p className="text-2xl font-bold">{filteredQuotes('awaiting_payment').length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-success" />
              <div>
                <p className="text-sm font-medium">Completed</p>
                <p className="text-2xl font-bold">{filteredQuotes('issued').length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Insurance Quote Management</CardTitle>
          <CardDescription>
            Process quotes, upload quotations, and issue certificates
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="pending" className="space-y-4">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="pending">Pending ({filteredQuotes('pending_backoffice').length})</TabsTrigger>
              <TabsTrigger value="quoted">Quoted ({filteredQuotes('quoted').length})</TabsTrigger>
              <TabsTrigger value="payment">Payment ({filteredQuotes('awaiting_payment').length + filteredQuotes('paid').length})</TabsTrigger>
              <TabsTrigger value="issued">Issued ({filteredQuotes('issued').length})</TabsTrigger>
              <TabsTrigger value="all">All ({quotes.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="pending">
              <QuoteTable quotes={filteredQuotes('pending_backoffice')} />
            </TabsContent>

            <TabsContent value="quoted">
              <QuoteTable quotes={filteredQuotes('quoted')} />
            </TabsContent>

            <TabsContent value="payment">
              <QuoteTable quotes={[...filteredQuotes('awaiting_payment'), ...filteredQuotes('paid')]} />
            </TabsContent>

            <TabsContent value="issued">
              <QuoteTable quotes={filteredQuotes('issued')} />
            </TabsContent>

            <TabsContent value="all">
              <QuoteTable quotes={quotes} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selectedQuote?.status === 'pending_backoffice' && "Upload Quotation"}
              {selectedQuote?.status === 'paid' && "Issue Certificate"}
              {selectedQuote?.status !== 'pending_backoffice' && selectedQuote?.status !== 'paid' && "Quote Details"}
            </DialogTitle>
          </DialogHeader>
          
          {selectedQuote && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted/10 rounded-lg">
                <div>
                  <h4 className="font-medium mb-2">Quote Information</h4>
                  <div className="space-y-2 text-sm">
                    <div><strong>ID:</strong> {selectedQuote.id}</div>
                    <div><strong>Phone:</strong> {selectedQuote.user_phone}</div>
                    <div><strong>Vehicle:</strong> {selectedQuote.vehicle_plate}</div>
                    <div><strong>Period:</strong> {selectedQuote.period}</div>
                    <div><strong>Start Date:</strong> {new Date(selectedQuote.start_date).toLocaleDateString()}</div>
                  </div>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Coverage Details</h4>
                  <div className="space-y-2 text-sm">
                    <div><strong>Add-ons:</strong></div>
                    <ul className="list-disc list-inside ml-2">
                      {selectedQuote.addons.map((addon, index) => (
                        <li key={index}>{addon}</li>
                      ))}
                    </ul>
                    {selectedQuote.pa_category && (
                      <div><strong>PA Level:</strong> {selectedQuote.pa_category}</div>
                    )}
                  </div>
                </div>
              </div>

              {selectedQuote.status === 'pending_backoffice' && (
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Premium Amount (RWF)</label>
                    <Input
                      type="number"
                      placeholder="Enter premium amount"
                      value={premiumAmount}
                      onChange={(e) => setPremiumAmount(e.target.value)}
                    />
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium">Upload Quotation PDF</label>
                    <FileUpload
                      bucket="quotes"
                      onUploaded={handleQuotationUpload}
                      accept=".pdf"
                    />
                    {uploadingQuotation && (
                      <p className="text-sm text-muted-foreground mt-2">Uploading quotation...</p>
                    )}
                  </div>
                </div>
              )}

              {selectedQuote.status === 'paid' && (
                <div className="space-y-4">
                  <div className="p-4 bg-success/10 border border-success/20 rounded-lg">
                    <div className="flex items-center gap-2 text-success">
                      <CheckCircle className="h-5 w-5" />
                      <span className="font-medium">Payment Received</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Premium: {selectedQuote.premium_amount?.toLocaleString()} RWF
                    </p>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium">Upload Certificate PDF</label>
                    <FileUpload
                      bucket="certificates"
                      onUploaded={handleCertificateUpload}
                      accept=".pdf"
                    />
                    {uploadingCertificate && (
                      <p className="text-sm text-muted-foreground mt-2">Uploading certificate...</p>
                    )}
                  </div>
                </div>
              )}

              {selectedQuote.status === 'quoted' && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Quotation Sent</p>
                      <p className="text-sm text-muted-foreground">
                        Waiting for customer to proceed with payment
                      </p>
                    </div>
                    <Button onClick={() => markAwaitingPayment(selectedQuote.id)}>
                      Mark as Awaiting Payment
                    </Button>
                  </div>
                </div>
              )}

              {selectedQuote.status === 'issued' && (
                <div className="p-4 bg-success/10 border border-success/20 rounded-lg">
                  <div className="flex items-center gap-2 text-success">
                    <CheckCircle className="h-5 w-5" />
                    <span className="font-medium">Certificate Issued</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Insurance is now active for {selectedQuote.vehicle_plate}
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Close
                </Button>
                {selectedQuote.quotation_pdf && (
                  <Button variant="outline">
                    <Download className="h-4 w-4 mr-2" />
                    Download Quote
                  </Button>
                )}
                {selectedQuote.certificate_pdf && (
                  <Button variant="outline">
                    <Download className="h-4 w-4 mr-2" />
                    Download Certificate
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}