import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle, XCircle, Clock, Play, Database, Users, Car, QrCode } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface TestResult {
  name: string;
  status: 'pending' | 'passed' | 'failed';
  message: string;
  duration?: number;
}

export function CRUDTester() {
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const updateTestResult = (name: string, status: TestResult['status'], message: string, duration?: number) => {
    setTestResults(prev => {
      const existing = prev.find(r => r.name === name);
      if (existing) {
        existing.status = status;
        existing.message = message;
        existing.duration = duration;
        return [...prev];
      }
      return [...prev, { name, status, message, duration }];
    });
  };

  const runTest = async (name: string, testFn: () => Promise<void>) => {
    updateTestResult(name, 'pending', 'Running...');
    const startTime = Date.now();
    
    try {
      await testFn();
      const duration = Date.now() - startTime;
      updateTestResult(name, 'passed', 'Success', duration);
    } catch (error) {
      const duration = Date.now() - startTime;
      updateTestResult(name, 'failed', error instanceof Error ? error.message : 'Unknown error', duration);
    }
  };

  const testProfiles = async () => {
    // Test profile creation
    const { data: created, error: createError } = await supabase
      .from("profiles")
      .insert({ wa_phone: "+250788000111", wa_name: "Test User" })
      .select()
      .single();
    
    if (createError) throw createError;

    // Test profile read
    const { data: read, error: readError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", created.id)
      .single();
      
    if (readError) throw readError;

    // Test profile update
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ wa_name: "Updated Test User" })
      .eq("id", created.id);
      
    if (updateError) throw updateError;

    // Test profile deletion
    const { error: deleteError } = await supabase
      .from("profiles")
      .delete()
      .eq("id", created.id);
      
    if (deleteError) throw deleteError;
  };

  const testVehicles = async () => {
    // Create test profile first
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .insert({ wa_phone: "+250788000222", wa_name: "Vehicle Test User" })
      .select()
      .single();
      
    if (profileError) throw profileError;

    try {
      // Test vehicle creation
      const { data: created, error: createError } = await supabase
        .from("vehicles")
        .insert({
          user_id: profile.id,
          usage_type: "moto",
          plate: "TEST123A",
          make: "Honda",
          model: "CB150R"
        })
        .select()
        .single();
      
      if (createError) throw createError;

      // Test vehicle read
      const { data: read, error: readError } = await supabase
        .from("vehicles")
        .select("*")
        .eq("id", created.id)
        .single();
        
      if (readError) throw readError;

      // Test vehicle update
      const { error: updateError } = await supabase
        .from("vehicles")
        .update({ verified: true })
        .eq("id", created.id);
        
      if (updateError) throw updateError;

      // Test vehicle deletion
      const { error: deleteError } = await supabase
        .from("vehicles")
        .delete()
        .eq("id", created.id);
        
      if (deleteError) throw deleteError;
    } finally {
      // Cleanup profile
      await supabase.from("profiles").delete().eq("id", profile.id);
    }
  };

  const testQRGenerations = async () => {
    // Create test profile first
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .insert({ wa_phone: "+250788000333", wa_name: "QR Test User" })
      .select()
      .single();
      
    if (profileError) throw profileError;

    try {
      // Test QR generation creation
      const { data: created, error: createError } = await supabase
        .from("qr_generations")
        .insert({
          user_id: profile.id,
          ussd: "*182*1*1*0788000333*1000#",
          file_path: "qr/test/test.png",
          amount: 1000
        })
        .select()
        .single();
      
      if (createError) throw createError;

      // Test QR generation read
      const { data: read, error: readError } = await supabase
        .from("qr_generations")
        .select("*")
        .eq("id", created.id)
        .single();
        
      if (readError) throw readError;

      // Test QR generation deletion
      const { error: deleteError } = await supabase
        .from("qr_generations")
        .delete()
        .eq("id", created.id);
        
      if (deleteError) throw deleteError;
    } finally {
      // Cleanup profile
      await supabase.from("profiles").delete().eq("id", profile.id);
    }
  };

  const testInsurance = async () => {
    // Create test profile first
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .insert({ wa_phone: "+250788000444", wa_name: "Insurance Test User" })
      .select()
      .single();
      
    if (profileError) throw profileError;

    try {
      // Test insurance quote creation
      const { data: created, error: createError } = await supabase
        .from("insurance_quotes")
        .insert({
          user_id: profile.id,
          status: "draft",
          quote_data: { test: true }
        })
        .select()
        .single();
      
      if (createError) throw createError;

      // Test insurance quote read
      const { data: read, error: readError } = await supabase
        .from("insurance_quotes")
        .select("*")
        .eq("id", created.id)
        .single();
        
      if (readError) throw readError;

      // Test insurance quote update
      const { error: updateError } = await supabase
        .from("insurance_quotes")
        .update({ status: "pending" })
        .eq("id", created.id);
        
      if (updateError) throw updateError;

      // Test insurance quote deletion
      const { error: deleteError } = await supabase
        .from("insurance_quotes")
        .delete()
        .eq("id", created.id);
        
      if (deleteError) throw deleteError;
    } finally {
      // Cleanup profile
      await supabase.from("profiles").delete().eq("id", profile.id);
    }
  };

  const runAllTests = async () => {
    setIsRunning(true);
    setTestResults([]);
    
    try {
      toast.info("Running CRUD tests...");
      
      await runTest("Profiles CRUD", testProfiles);
      await runTest("Vehicles CRUD", testVehicles);
      await runTest("QR Generations CRUD", testQRGenerations);
      await runTest("Insurance Quotes CRUD", testInsurance);
      
      const passed = testResults.filter(r => r.status === 'passed').length;
      const total = testResults.length;
      
      if (passed === total) {
        toast.success(`All ${total} CRUD tests passed!`);
      } else {
        toast.warning(`${passed}/${total} CRUD tests passed`);
      }
    } catch (error) {
      toast.error("Test suite failed");
    } finally {
      setIsRunning(false);
    }
  };

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'passed': return <CheckCircle className="h-4 w-4 text-success" />;
      case 'failed': return <XCircle className="h-4 w-4 text-destructive" />;
      default: return <Clock className="h-4 w-4 text-muted-foreground animate-spin" />;
    }
  };

  const getStatusBadge = (status: TestResult['status']) => {
    switch (status) {
      case 'passed': return <Badge className="bg-success">Passed</Badge>;
      case 'failed': return <Badge variant="destructive">Failed</Badge>;
      default: return <Badge variant="secondary">Running</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold gradient-text mb-2">CRUD Operations Test</h1>
          <p className="text-muted-foreground">Test all database operations to ensure everything works correctly</p>
        </div>
        <Button 
          onClick={runAllTests} 
          disabled={isRunning}
          className="bg-gradient-primary hover:opacity-90"
        >
          <Play className="h-4 w-4 mr-2" />
          {isRunning ? "Running Tests..." : "Run All Tests"}
        </Button>
      </div>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Test Results
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {testResults.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No tests run yet. Click "Run All Tests" to start testing CRUD operations.
              </div>
            ) : (
              testResults.map((result) => (
                <div key={result.name} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(result.status)}
                    <div>
                      <div className="font-medium">{result.name}</div>
                      <div className="text-sm text-muted-foreground">{result.message}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {result.duration && (
                      <span className="text-xs text-muted-foreground">{result.duration}ms</span>
                    )}
                    {getStatusBadge(result.status)}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="entities" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="entities">Core Entities</TabsTrigger>
          <TabsTrigger value="flows">User Flows</TabsTrigger>
          <TabsTrigger value="admin">Admin Operations</TabsTrigger>
          <TabsTrigger value="integration">Integration</TabsTrigger>
        </TabsList>
        
        <TabsContent value="entities" className="space-y-4">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Core Entity Testing
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium mb-2">Profiles</h4>
                  <p className="text-sm text-muted-foreground">User profile creation, reading, updating, and deletion</p>
                </div>
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium mb-2">Vehicles</h4>
                  <p className="text-sm text-muted-foreground">Vehicle registration and management operations</p>
                </div>
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium mb-2">QR Generations</h4>
                  <p className="text-sm text-muted-foreground">QR code generation and tracking records</p>
                </div>
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium mb-2">Insurance Quotes</h4>
                  <p className="text-sm text-muted-foreground">Insurance quote management and processing</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="flows" className="space-y-4">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Car className="h-5 w-5" />
                User Flow Testing
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium mb-2">WhatsApp Integration</h4>
                  <p className="text-sm text-muted-foreground">Test webhook processing and message handling</p>
                </div>
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium mb-2">QR Code Generation Flow</h4>
                  <p className="text-sm text-muted-foreground">End-to-end QR generation and storage</p>
                </div>
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium mb-2">Vehicle Registration Flow</h4>
                  <p className="text-sm text-muted-foreground">OCR processing and vehicle verification</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="admin" className="space-y-4">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Admin Operations Testing
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium mb-2">User Management</h4>
                  <p className="text-sm text-muted-foreground">Admin user creation, editing, and role management</p>
                </div>
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium mb-2">Insurance Backoffice</h4>
                  <p className="text-sm text-muted-foreground">Quote processing and certificate issuance</p>
                </div>
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium mb-2">System Configuration</h4>
                  <p className="text-sm text-muted-foreground">Insurance periods, addons, and payment plans</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="integration" className="space-y-4">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <QrCode className="h-5 w-5" />
                Integration Testing
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium mb-2">Edge Functions</h4>
                  <p className="text-sm text-muted-foreground">WhatsApp webhook and QR generation functions</p>
                </div>
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium mb-2">Storage Operations</h4>
                  <p className="text-sm text-muted-foreground">File upload, retrieval, and public access</p>
                </div>
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium mb-2">RLS Policies</h4>
                  <p className="text-sm text-muted-foreground">Row-level security and access control</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}