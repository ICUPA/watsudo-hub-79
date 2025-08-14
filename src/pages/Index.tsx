import { useState } from "react";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { Sidebar } from "@/components/layout/Sidebar";
import { HubDashboard, DashboardView } from "@/components/dashboard/HubDashboard";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { User, Car, Route, ShieldCheck, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const Index = () => {
  const { profile, isAdmin, refreshProfile } = useAuth();
  const [currentView, setCurrentView] = useState<DashboardView>("overview");
  const navigate = useNavigate();

  const handleRefreshProfile = async () => {
    await refreshProfile();
    toast.success("Profile refreshed!");
  };

  if (isAdmin) {
    return <HubDashboard />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background/95 to-primary/5">
      <div className="flex">
        <Sidebar currentView={currentView} onViewChange={setCurrentView} />
        <main className="flex-1 ml-64">
          <DashboardHeader />
          <div className="p-6">
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="text-3xl font-bold gradient-text mb-2">
                      Welcome, {profile?.wa_name || 'User'}!
                    </h1>
                    <p className="text-muted-foreground">
                      Your dashboard and services are ready to use. Role: {profile?.role || 'loading...'}
                    </p>
                  </div>
                  <Button onClick={handleRefreshProfile} variant="outline" size="sm">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh Profile
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <Card className="glass-card hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <User className="h-5 w-5 text-primary" />
                        Profile
                      </CardTitle>
                      <CardDescription>
                        Manage your personal information
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button variant="outline" className="w-full" onClick={() => navigate('/profile')}>
                        View Profile
                      </Button>
                    </CardContent>
                  </Card>

                  <Card className="glass-card hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Car className="h-5 w-5 text-primary" />
                        Vehicles
                      </CardTitle>
                      <CardDescription>
                        Register and manage your vehicles
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button variant="outline" className="w-full">
                        Manage Vehicles
                      </Button>
                    </CardContent>
                  </Card>

                  <Card className="glass-card hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Route className="h-5 w-5 text-primary" />
                        Rides
                      </CardTitle>
                      <CardDescription>
                        Book rides and view history
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button variant="outline" className="w-full">
                        Book Ride
                      </Button>
                    </CardContent>
                  </Card>

                  <Card className="glass-card hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <ShieldCheck className="h-5 w-5 text-primary" />
                        Insurance
                      </CardTitle>
                      <CardDescription>
                        Get quotes and manage policies
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button variant="outline" className="w-full">
                        Get Quote
                      </Button>
                    </CardContent>
                  </Card>
                </div>

                {(!profile?.wa_phone || profile?.wa_phone === '') && (
                  <Card className="glass-card border-warning/20">
                    <CardHeader>
                      <CardTitle className="text-warning">Complete Your Profile</CardTitle>
                      <CardDescription>
                        Please add your phone number to access all features.
                        <br />
                        <small className="text-xs opacity-70">
                          Current phone: {profile?.wa_phone || 'Not set'}
                        </small>
                      </CardDescription>
                    </CardHeader>
                  </Card>
                )}
              </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Index;