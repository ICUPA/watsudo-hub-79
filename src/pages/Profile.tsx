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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { 
  ArrowLeft, 
  Save, 
  User, 
  Phone, 
  Globe, 
  Calendar, 
  Shield, 
  AlertCircle,
  CheckCircle,
  RefreshCw
} from "lucide-react";
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

interface ProfileFormData {
  wa_name: string;
  wa_phone: string;
  locale: string;
  default_momo_phone: string;
  default_momo_code: string;
}

export default function Profile() {
  const { profile, user, updateProfile, refreshProfile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // Profile form state with validation
  const [profileData, setProfileData] = useState<ProfileFormData>({
    wa_name: '',
    wa_phone: '',
    locale: 'en',
    default_momo_phone: '',
    default_momo_code: ''
  });

  // Update form data when profile loads
  useEffect(() => {
    if (profile) {
      console.log('Profile loaded in component:', profile);
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

  // Load user vehicles
  const loadVehicles = async () => {
    const userId = profile?.user_id || user?.id;
    if (!userId) return;
    
    try {
      const { data, error } = await supabase
        .from('vehicles')
        .select('*')
        .eq('user_id', userId)
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

  // Validate form data
  const validateForm = (data: ProfileFormData): Record<string, string> => {
    const newErrors: Record<string, string> = {};

    if (!data.wa_name.trim()) {
      newErrors.wa_name = 'Full name is required';
    }

    if (!data.wa_phone.trim()) {
      newErrors.wa_phone = 'WhatsApp phone number is required';
    } else if (!/^(\+?[0-9]{10,15})$/.test(data.wa_phone.replace(/\s/g, ''))) {
      newErrors.wa_phone = 'Please enter a valid phone number';
    }

    if (data.default_momo_phone && !/^(\+?[0-9]{10,15})$/.test(data.default_momo_phone.replace(/\s/g, ''))) {
      newErrors.default_momo_phone = 'Please enter a valid mobile money phone number';
    }

    return newErrors;
  };

  // Handle form input changes
  const handleInputChange = (field: keyof ProfileFormData, value: string) => {
    setProfileData(prev => ({ ...prev, [field]: value }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  // Handle profile save
  const handleSaveProfile = async () => {
    // Validate form
    const validationErrors = validateForm(profileData);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      toast.error('Please fix the errors before saving');
      return;
    }

    setLoading(true);
    try {
      const success = await updateProfile(profileData);
      if (success) {
        setErrors({});
      }
    } catch (error) {
      console.error('Error saving profile:', error);
      toast.error('Failed to save profile');
    } finally {
      setLoading(false);
    }
  };

  // Handle profile refresh
  const handleRefreshProfile = async () => {
    setLoading(true);
    try {
      await refreshProfile();
      toast.success('Profile refreshed successfully');
    } catch (error) {
      console.error('Error refreshing profile:', error);
      toast.error('Failed to refresh profile');
    } finally {
      setLoading(false);
    }
  };

  // Utility functions
  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin': return 'destructive';
      case 'driver': return 'default';
      default: return 'secondary';
    }
  };

  // Show loading state
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background/95 to-primary/5 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading profile...</p>
        </div>
      </div>
    );
  }

  // Show error state if no profile
  if (!profile && !authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background/95 to-primary/5 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Profile Not Found
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Unable to load your profile. This might be a temporary issue.
            </p>
            <div className="space-y-2">
              <Button onClick={handleRefreshProfile} className="w-full" disabled={loading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Retry Loading Profile
              </Button>
              <Button variant="outline" onClick={() => navigate('/')} className="w-full">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

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
          <Button variant="outline" onClick={handleRefreshProfile} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Profile Status Alert */}
        {profile && (!profile.wa_name || !profile.wa_phone) && (
          <Alert className="mb-6 border-warning bg-warning/10">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Your profile is incomplete. Please fill in your name and phone number to access all features.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Profile Summary Card */}
          <div className="lg:col-span-1">
            <Card className="glass-card">
              <CardHeader className="text-center">
                <Avatar className="h-24 w-24 mx-auto mb-4">
                  <AvatarImage src="" />
                  <AvatarFallback className="text-lg">
                    {profile?.wa_name?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                <CardTitle className="text-xl">
                  {profile?.wa_name || user?.email?.split('@')[0] || 'User'}
                </CardTitle>
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
                {profile?.wa_name && profile?.wa_phone && (
                  <div className="flex items-center gap-2 text-sm text-success">
                    <CheckCircle className="h-4 w-4" />
                    <span>Profile Complete</span>
                  </div>
                )}
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
                        <Label htmlFor="wa_name">Full Name *</Label>
                        <Input
                          id="wa_name"
                          value={profileData.wa_name}
                          onChange={(e) => handleInputChange('wa_name', e.target.value)}
                          placeholder="Enter your full name"
                          className={errors.wa_name ? 'border-destructive' : ''}
                        />
                        {errors.wa_name && (
                          <p className="text-sm text-destructive">{errors.wa_name}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="wa_phone">WhatsApp Phone *</Label>
                        <Input
                          id="wa_phone"
                          value={profileData.wa_phone}
                          onChange={(e) => handleInputChange('wa_phone', e.target.value)}
                          placeholder="+250781234567"
                          className={errors.wa_phone ? 'border-destructive' : ''}
                        />
                        {errors.wa_phone && (
                          <p className="text-sm text-destructive">{errors.wa_phone}</p>
                        )}
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="locale">Language</Label>
                      <Select 
                        value={profileData.locale} 
                        onValueChange={(value) => handleInputChange('locale', value)}
                      >
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

                    <Button 
                      onClick={handleSaveProfile} 
                      disabled={loading} 
                      className="w-full"
                    >
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
                          placeholder="+250781234567"
                          className={errors.default_momo_phone ? 'border-destructive' : ''}
                        />
                        {errors.default_momo_phone && (
                          <p className="text-sm text-destructive">{errors.default_momo_phone}</p>
                        )}
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

                    <Button 
                      onClick={handleSaveProfile} 
                      disabled={loading} 
                      className="w-full"
                    >
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