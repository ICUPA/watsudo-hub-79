import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { ArrowLeft, Save, User, Phone, Globe, Calendar, Shield } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Vehicle {
  id: string;
  plate: string;
  make: string;
  model: string;
  model_year: number;
  usage_type: string;
  verified: boolean;
  insurance_expiry: string;
}

export default function Profile() {
  const { profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  
  // Profile form state
  const [profileData, setProfileData] = useState({
    wa_name: profile?.wa_name || '',
    wa_phone: profile?.wa_phone || '',
    locale: profile?.locale || 'en',
    default_momo_phone: profile?.default_momo_phone || '',
    default_momo_code: profile?.default_momo_code || ''
  });

  useEffect(() => {
    if (profile) {
      setProfileData({
        wa_name: profile.wa_name || '',
        wa_phone: profile.wa_phone || '',
        locale: profile.locale || 'en',
        default_momo_phone: profile.default_momo_phone || '',
        default_momo_code: profile.default_momo_code || ''
      });
      loadVehicles();
    }
  }, [profile]);

  const loadVehicles = async () => {
    try {
      const { data, error } = await supabase
        .from('vehicles')
        .select('*')
        .eq('user_id', profile?.user_id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading vehicles:', error);
        return;
      }

      setVehicles(data || []);
    } catch (error) {
      console.error('Error loading vehicles:', error);
    }
  };

  const handleSaveProfile = async () => {
    if (!profile?.user_id) {
      toast.error('User ID not available');
      return;
    }
    
    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update(profileData)
        .eq('user_id', profile.user_id);

      if (error) {
        toast.error('Failed to update profile');
        console.error('Error updating profile:', error);
        return;
      }

      await refreshProfile();
      toast.success('Profile updated successfully');
    } catch (error) {
      toast.error('Failed to update profile');
      console.error('Error updating profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setProfileData(prev => ({ ...prev, [field]: value }));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin': return 'destructive';
      case 'driver': return 'default';
      default: return 'secondary';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background/95 to-primary/5">
      <div className="container mx-auto p-6 max-w-4xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" onClick={() => navigate('/')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold gradient-text">User Profile</h1>
            <p className="text-muted-foreground">Manage your account and preferences</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Profile Summary Card */}
          <div className="lg:col-span-1">
            <Card className="glass-card">
              <CardHeader className="text-center">
                <Avatar className="h-24 w-24 mx-auto mb-4">
                  <AvatarImage src="" />
                  <AvatarFallback className="text-lg">
                    {profile?.wa_name?.charAt(0)?.toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                <CardTitle className="text-xl">{profile?.wa_name || 'User'}</CardTitle>
                <CardDescription>
                  <Badge variant={getRoleBadgeVariant(profile?.role || 'user')} className="mb-2">
                    <Shield className="h-3 w-3 mr-1" />
                    {profile?.role?.toUpperCase()}
                  </Badge>
                  <div className="text-sm text-muted-foreground">
                    Member since {formatDate(profile?.created_at || '')}
                  </div>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{profile?.wa_phone || 'No phone set'}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <span>{profile?.locale?.toUpperCase() || 'EN'}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>Last updated {formatDate(profile?.updated_at || '')}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-2">
            <Tabs defaultValue="personal" className="space-y-6">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="personal">Personal Info</TabsTrigger>
                <TabsTrigger value="vehicles">Vehicles</TabsTrigger>
                <TabsTrigger value="payment">Payment</TabsTrigger>
              </TabsList>

              {/* Personal Information Tab */}
              <TabsContent value="personal">
                <Card className="glass-card">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <User className="h-5 w-5" />
                      Personal Information
                    </CardTitle>
                    <CardDescription>
                      Update your personal details and contact information
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="wa_name">Full Name</Label>
                        <Input
                          id="wa_name"
                          value={profileData.wa_name}
                          onChange={(e) => handleInputChange('wa_name', e.target.value)}
                          placeholder="Enter your full name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="wa_phone">WhatsApp Phone</Label>
                        <Input
                          id="wa_phone"
                          value={profileData.wa_phone}
                          onChange={(e) => handleInputChange('wa_phone', e.target.value)}
                          placeholder="07XXXXXXXX"
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="locale">Language</Label>
                      <Select value={profileData.locale} onValueChange={(value) => handleInputChange('locale', value)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="en">English</SelectItem>
                          <SelectItem value="fr">French</SelectItem>
                          <SelectItem value="sw">Swahili</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <Button onClick={handleSaveProfile} disabled={loading} className="w-full">
                      <Save className="h-4 w-4 mr-2" />
                      {loading ? 'Saving...' : 'Save Changes'}
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Vehicles Tab */}
              <TabsContent value="vehicles">
                <Card className="glass-card">
                  <CardHeader>
                    <CardTitle>My Vehicles</CardTitle>
                    <CardDescription>
                      Manage your registered vehicles and insurance
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {vehicles.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-muted-foreground mb-4">No vehicles registered</p>
                        <Button variant="outline">Add Vehicle</Button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {vehicles.map((vehicle) => (
                          <div key={vehicle.id} className="border rounded-lg p-4">
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <h4 className="font-semibold">{vehicle.plate}</h4>
                                <p className="text-sm text-muted-foreground">
                                  {vehicle.make} {vehicle.model} ({vehicle.model_year})
                                </p>
                              </div>
                              <div className="flex gap-2">
                                <Badge variant={vehicle.verified ? 'default' : 'secondary'}>
                                  {vehicle.verified ? 'Verified' : 'Pending'}
                                </Badge>
                                <Badge variant="outline">{vehicle.usage_type}</Badge>
                              </div>
                            </div>
                            {vehicle.insurance_expiry && (
                              <p className="text-xs text-muted-foreground">
                                Insurance expires: {formatDate(vehicle.insurance_expiry)}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Payment Tab */}
              <TabsContent value="payment">
                <Card className="glass-card">
                  <CardHeader>
                    <CardTitle>Payment Information</CardTitle>
                    <CardDescription>
                      Manage your mobile money settings
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="default_momo_phone">Mobile Money Phone</Label>
                        <Input
                          id="default_momo_phone"
                          value={profileData.default_momo_phone}
                          onChange={(e) => handleInputChange('default_momo_phone', e.target.value)}
                          placeholder="07XXXXXXXX"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="default_momo_code">Mobile Money Code</Label>
                        <Input
                          id="default_momo_code"
                          value={profileData.default_momo_code}
                          onChange={(e) => handleInputChange('default_momo_code', e.target.value)}
                          placeholder="Provider code"
                        />
                      </div>
                    </div>

                    <Button onClick={handleSaveProfile} disabled={loading} className="w-full">
                      <Save className="h-4 w-4 mr-2" />
                      {loading ? 'Saving...' : 'Save Payment Info'}
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}