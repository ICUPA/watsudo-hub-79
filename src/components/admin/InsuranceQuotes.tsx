import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FileUpload } from "@/components/ui/FileUpload";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface InsuranceQuote {
  id: string;
  user_id: string;
  vehicle_id?: string;
  start_date: string;
  period_id: string;
  addons: string[];
  pa_category_id?: string;
  status: 'pending_backoffice' | 'quoted' | 'awaiting_payment' | 'cancelled' | 'paid' | 'issued';
  quote_pdf_path?: string;
  amount_cents?: number;
  currency: string;
  created_at: string;
  user?: {
    wa_id: string;
    phone_e164?: string;
    display_name?: string;
  };
  vehicle?: {
    number_plate: string;
    usage_type: string;
  };
}

export function InsuranceQuotes() {
  const [quotes, setQuotes] = useState<InsuranceQuote[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string>('pending_backoffice');
  const [selectedQuote, setSelectedQuote] = useState<InsuranceQuote | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadQuotes();
  }, [selectedStatus]);

  const loadQuotes = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('insurance_quotes')
        .select(`
          *
        `)
        .eq('status', selectedStatus)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // Transform data to match interface
      const transformedQuotes = data?.map(quote => {
        const quoteData = quote.quote_data as any || {};
        return {
          id: quote.id,
          user_id: quote.user_id || '',
          vehicle_id: quote.vehicle_id || undefined,
          start_date: quoteData.start_date || new Date().toISOString().split('T')[0],
          period_id: quoteData.period_id || '',
          addons: Array.isArray(quoteData.addons) ? quoteData.addons : [],
          pa_category_id: quoteData.pa_category_id || undefined,
          status: quote.status as 'pending_backoffice' | 'quoted' | 'awaiting_payment' | 'cancelled' | 'paid' | 'issued',
          quote_pdf_path: quoteData.quote_pdf_path || undefined,
          amount_cents: quoteData.amount_cents || undefined,
          currency: 'RWF',
          created_at: quote.created_at,
          user: {
            wa_id: '',
            phone_e164: undefined,
            display_name: undefined
          },
          vehicle: {
            number_plate: 'Unknown',
            usage_type: 'unknown'
          }
        };
      }) || [];
      
      setQuotes(transformedQuotes);
    } catch (error) {
      console.error('Error loading quotes:', error);
      toast.error('Failed to load insurance quotes');
      // Fallback to empty array
      setQuotes([]);
    } finally {
      setLoading(false);
    }
  };

  const attachQuotePdf = async (quoteId: string, pdfPath: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-admin-bridge', {
        body: { 
          quote_id: quoteId, 
          storage_path: pdfPath,
          amount_cents: parseInt(selectedQuote?.amount_cents?.toString() || '0') * 100
        }
      });
      
      if (error) throw error;
      
      toast.success('Quote PDF attached and sent to customer via WhatsApp');
      loadQuotes();
    } catch (error) {
      console.error('Error attaching PDF:', error);
      toast.error('Failed to attach PDF');
    }
  };

  const updateQuoteStatus = async (quoteId: string, status: string, amount?: number) => {
    try {
      // Placeholder for Supabase update
      // await supabase
      //   .from('insurance_quotes')
      //   .update({ status, amount_cents: amount })
      //   .eq('id', quoteId);
      
      toast.success('Quote status updated');
      loadQuotes();
    } catch (error) {
      console.error('Error updating quote:', error);
      toast.error('Failed to update quote');
    }
  };

  const issueCertificate = async (quoteId: string, certPath: string) => {
    try {
      // Placeholder for API call
      // await fetch('/admin/api/quotes/issue-certificate', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ quote_id: quoteId, cert_storage_path: certPath })
      // });
      
      toast.success('Certificate issued successfully');
      loadQuotes();
    } catch (error) {
      console.error('Error issuing certificate:', error);
      toast.error('Failed to issue certificate');
    }
  };

  const getStatusColor = (status: string) => {
    const colors = {
      'pending_backoffice': 'bg-yellow-100 text-yellow-800',
      'quoted': 'bg-blue-100 text-blue-800',
      'awaiting_payment': 'bg-orange-100 text-orange-800',
      'cancelled': 'bg-red-100 text-red-800',
      'paid': 'bg-green-100 text-green-800',
      'issued': 'bg-emerald-100 text-emerald-800'
    };
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const statusCounts = {
    'pending_backoffice': 5,
    'quoted': 3,
    'awaiting_payment': 7,
    'paid': 12,
    'issued': 25,
    'cancelled': 2
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold">Insurance Quotes</h2>
      </div>

      <Tabs value={selectedStatus} onValueChange={setSelectedStatus} className="space-y-4">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="pending_backoffice">
            Pending ({statusCounts.pending_backoffice})
          </TabsTrigger>
          <TabsTrigger value="quoted">
            Quoted ({statusCounts.quoted})
          </TabsTrigger>
          <TabsTrigger value="awaiting_payment">
            Awaiting Payment ({statusCounts.awaiting_payment})
          </TabsTrigger>
          <TabsTrigger value="paid">
            Paid ({statusCounts.paid})
          </TabsTrigger>
          <TabsTrigger value="issued">
            Issued ({statusCounts.issued})
          </TabsTrigger>
          <TabsTrigger value="cancelled">
            Cancelled ({statusCounts.cancelled})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={selectedStatus} className="space-y-4">
          {loading ? (
            <div className="text-center py-8">Loading quotes...</div>
          ) : (
            <div className="grid gap-4">
              {quotes.map((quote) => (
                <Card key={quote.id}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">
                          {quote.vehicle?.number_plate || 'No Vehicle'} - {quote.user?.display_name}
                        </CardTitle>
                        <p className="text-sm text-muted-foreground">
                          {quote.user?.phone_e164} | Start: {quote.start_date}
                        </p>
                      </div>
                      <Badge className={getStatusColor(quote.status)}>
                        {quote.status.replace('_', ' ').toUpperCase()}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <Label className="text-sm font-medium">Add-ons</Label>
                        <p className="text-sm">{quote.addons.join(', ') || 'None'}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium">Amount</Label>
                        <p className="text-sm">
                          {quote.amount_cents 
                            ? `${quote.amount_cents / 100} ${quote.currency}`
                            : 'Not priced'
                          }
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            View Details
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>Quote Details</DialogTitle>
                          </DialogHeader>
                          <QuoteDetails 
                            quote={quote}
                            onAttachPdf={attachQuotePdf}
                            onUpdateStatus={updateQuoteStatus}
                            onIssueCertificate={issueCertificate}
                          />
                        </DialogContent>
                      </Dialog>

                      {quote.status === 'pending_backoffice' && (
                        <Button 
                          size="sm" 
                          onClick={() => updateQuoteStatus(quote.id, 'quoted', 50000)}
                        >
                          Mark as Quoted
                        </Button>
                      )}

                      {quote.status === 'paid' && (
                        <Button 
                          size="sm"
                          onClick={() => issueCertificate(quote.id, 'cert-path')}
                        >
                          Issue Certificate
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}

              {quotes.length === 0 && (
                <Card>
                  <CardContent className="text-center py-8">
                    <p className="text-muted-foreground">No quotes found for this status.</p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function QuoteDetails({ quote, onAttachPdf, onUpdateStatus, onIssueCertificate }: {
  quote: InsuranceQuote;
  onAttachPdf: (quoteId: string, pdfPath: string) => void;
  onUpdateStatus: (quoteId: string, status: string, amount?: number) => void;
  onIssueCertificate: (quoteId: string, certPath: string) => void;
}) {
  const [amount, setAmount] = useState(quote.amount_cents?.toString() || '');

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="font-medium">Customer</Label>
          <p>{quote.user?.display_name}</p>
          <p className="text-sm text-muted-foreground">{quote.user?.phone_e164}</p>
        </div>
        <div>
          <Label className="font-medium">Vehicle</Label>
          <p>{quote.vehicle?.number_plate}</p>
          <p className="text-sm text-muted-foreground">{quote.vehicle?.usage_type}</p>
        </div>
        <div>
          <Label className="font-medium">Start Date</Label>
          <p>{quote.start_date}</p>
        </div>
        <div>
          <Label className="font-medium">Add-ons</Label>
          <p>{quote.addons.join(', ') || 'None'}</p>
        </div>
      </div>

      {quote.status === 'pending_backoffice' && (
        <div className="space-y-4">
          <div>
            <Label htmlFor="amount">Quote Amount (RWF)</Label>
            <Input
              id="amount"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Enter quote amount"
            />
          </div>
          
          <div>
            <Label>Attach Quote PDF</Label>
            <FileUpload
              bucket="quotes"
              onUploaded={(path) => onAttachPdf(quote.id, path)}
            />
          </div>

          <Button 
            onClick={() => onUpdateStatus(quote.id, 'quoted', parseInt(amount) * 100)}
            disabled={!amount}
          >
            Submit Quote
          </Button>
        </div>
      )}

      {quote.status === 'paid' && (
        <div className="space-y-4">
          <Label>Issue Certificate</Label>
          <FileUpload
            bucket="certificates"
            onUploaded={(path) => onIssueCertificate(quote.id, path)}
          />
        </div>
      )}
    </div>
  );
}