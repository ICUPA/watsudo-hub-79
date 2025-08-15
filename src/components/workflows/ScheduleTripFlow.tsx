import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, Clock, User, Car, Users } from "lucide-react";
import { createRide, getVehicleTypes, getNearbyDrivers } from "@/lib/supabase-api";
import { toast } from "sonner";

interface WorkflowState {
  step: 'role_selection' | 'passenger_vehicle' | 'passenger_pickup' | 'passenger_dropoff' | 
        'passenger_datetime' | 'passenger_drivers' | 'driver_route' | 'driver_time' | 'success';
  role?: 'passenger' | 'driver';
  vehicleType?: string;
  pickupLocation?: string;
  dropoffLocation?: string;
  scheduledTime?: string;
  route?: { from: string; to: string };
  timeWindow?: string;
  drivers?: any[];
  selectedDriver?: any;
}

export function ScheduleTripFlow() {
  const [state, setState] = useState<WorkflowState>({ step: 'role_selection' });
  const [isLoading, setIsLoading] = useState(false);
  const [vehicleTypes, setVehicleTypes] = useState<string[]>([]);

  const loadVehicleTypes = async () => {
    try {
      const types = await getVehicleTypes();
      setVehicleTypes(types);
    } catch (error) {
      toast.error('Failed to load vehicle types');
    }
  };

  const handleRoleSelection = (role: 'passenger' | 'driver') => {
    setState({ ...state, role, step: role === 'passenger' ? 'passenger_vehicle' : 'driver_route' });
    if (role === 'passenger') {
      loadVehicleTypes();
    }
  };

  const handleVehicleTypeSelect = (type: string) => {
    setState({ ...state, vehicleType: type, step: 'passenger_pickup' });
  };

  const handlePickupLocation = (location: string) => {
    setState({ ...state, pickupLocation: location, step: 'passenger_dropoff' });
  };

  const handleDropoffLocation = (location: string) => {
    setState({ ...state, dropoffLocation: location, step: 'passenger_datetime' });
  };

  const handleDateTimeSelection = async (timeOption: string) => {
    setState({ ...state, scheduledTime: timeOption, step: 'passenger_drivers' });
    setIsLoading(true);
    
    try {
      const drivers = await getNearbyDrivers(state.pickupLocation!);
      setState(prev => ({ ...prev, drivers: drivers.slice(0, 5) }));
      toast.success(`Found ${drivers.length} available drivers`);
    } catch (error) {
      toast.error('Failed to find drivers');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDriverSelection = async (driver: any) => {
    setIsLoading(true);
    try {
      const rideData = {
        passenger_user_id: 'mock-user-id', // Mock passenger ID
        pickup: { location: state.pickupLocation },
        dropoff: { location: state.dropoffLocation },
        scheduled_for: state.scheduledTime,
        meta: { vehicle_type: state.vehicleType },
        status: 'pending' as const
      };
      
      const result = await createRide(rideData);
      if (result.success) {
        setState({ ...state, selectedDriver: driver, step: 'success' });
        toast.success('Trip scheduled successfully!');
      }
    } catch (error) {
      toast.error('Failed to schedule trip');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDriverRoute = (route: string) => {
    const [from, to] = route.split(' - ').map(s => s.trim());
    setState({ ...state, route: { from, to }, step: 'driver_time' });
  };

  const handleDriverTimeWindow = (timeWindow: string) => {
    setState({ ...state, timeWindow, step: 'success' });
    toast.success('Availability published! You\'ll receive notifications when passengers book your route.');
  };

  const resetFlow = () => {
    setState({ step: 'role_selection' });
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Schedule Trip Workflow</h1>
        <p className="text-muted-foreground">Plan trips in advance for passengers and drivers</p>
      </div>

      {state.step === 'role_selection' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Choose Your Role
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Button
                variant="outline"
                className="h-32 flex flex-col items-center justify-center gap-4 hover:bg-primary/5"
                onClick={() => handleRoleSelection('passenger')}
              >
                <User className="h-12 w-12" />
                <div className="text-center">
                  <div className="font-semibold">Passenger</div>
                  <div className="text-sm text-muted-foreground">Schedule a trip</div>
                </div>
              </Button>
              
              <Button
                variant="outline"
                className="h-32 flex flex-col items-center justify-center gap-4 hover:bg-primary/5"
                onClick={() => handleRoleSelection('driver')}
              >
                <Car className="h-12 w-12" />
                <div className="text-center">
                  <div className="font-semibold">Driver</div>
                  <div className="text-sm text-muted-foreground">Publish availability</div>
                </div>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {state.step === 'passenger_vehicle' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Car className="h-5 w-5" />
              Choose Vehicle Type
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {vehicleTypes.map((type) => (
                <Button
                  key={type}
                  variant="outline"
                  className="h-20 flex flex-col items-center justify-center gap-2"
                  onClick={() => handleVehicleTypeSelect(type)}
                >
                  <Car className="h-6 w-6" />
                  <span className="text-sm">{type}</span>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {state.step === 'passenger_pickup' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-green-500" />
              Pickup Location
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-muted-foreground">Share your pickup location for the scheduled trip.</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g., Kimisagara, Kigali"
                  className="flex-1 px-3 py-2 border rounded-lg"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handlePickupLocation((e.target as HTMLInputElement).value);
                    }
                  }}
                />
                <Button 
                  onClick={() => {
                    const input = document.querySelector('input') as HTMLInputElement;
                    handlePickupLocation(input.value);
                  }}
                >
                  Next
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {state.step === 'passenger_dropoff' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-red-500" />
              Drop-off Location
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-muted-foreground">Share your destination for the scheduled trip.</p>
              <div className="text-sm text-muted-foreground">
                Pickup: {state.pickupLocation}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g., Kigali International Airport"
                  className="flex-1 px-3 py-2 border rounded-lg"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleDropoffLocation((e.target as HTMLInputElement).value);
                    }
                  }}
                />
                <Button 
                  onClick={() => {
                    const input = document.querySelector('input[placeholder*="Airport"]') as HTMLInputElement;
                    handleDropoffLocation(input.value);
                  }}
                >
                  Next
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {state.step === 'passenger_datetime' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Select Date & Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                <p>From: {state.pickupLocation}</p>
                <p>To: {state.dropoffLocation}</p>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Button variant="outline" onClick={() => handleDateTimeSelection('Today')}>
                  Today
                </Button>
                <Button variant="outline" onClick={() => handleDateTimeSelection('Tomorrow')}>
                  Tomorrow
                </Button>
                <Button variant="outline" onClick={() => handleDateTimeSelection('Morning (6-10 AM)')}>
                  Morning
                </Button>
                <Button variant="outline" onClick={() => handleDateTimeSelection('Evening (6-10 PM)')}>
                  Evening
                </Button>
              </div>
              
              <div className="mt-4">
                <input
                  type="datetime-local"
                  className="px-3 py-2 border rounded-lg"
                  onChange={(e) => handleDateTimeSelection(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {state.step === 'passenger_drivers' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Available Drivers for {state.scheduledTime}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">Finding aligned drivers...</div>
            ) : (
              <div className="space-y-3">
                {state.drivers?.map((driver, index) => (
                  <div
                    key={driver.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 cursor-pointer"
                    onClick={() => handleDriverSelection(driver)}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                        <Car className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <div className="font-medium">{driver.name}</div>
                        <div className="text-sm text-muted-foreground">{driver.plate}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">{driver.distance}km</div>
                      <div className="text-sm text-muted-foreground">ETA match: {driver.eta}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {state.step === 'driver_route' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Enter Your Future Route
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-muted-foreground">Enter the route you'll be available for.</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g., Kimisagara - Airport"
                  className="flex-1 px-3 py-2 border rounded-lg"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleDriverRoute((e.target as HTMLInputElement).value);
                    }
                  }}
                />
                <Button 
                  onClick={() => {
                    const input = document.querySelector('input[placeholder*="Kimisagara"]') as HTMLInputElement;
                    handleDriverRoute(input.value);
                  }}
                >
                  Next
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {state.step === 'driver_time' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Select Time Window
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                Route: {state.route?.from} → {state.route?.to}
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <Button variant="outline" onClick={() => handleDriverTimeWindow('Morning (6-10 AM)')}>
                  Morning (6-10 AM)
                </Button>
                <Button variant="outline" onClick={() => handleDriverTimeWindow('Midday (10-2 PM)')}>
                  Midday (10-2 PM)
                </Button>
                <Button variant="outline" onClick={() => handleDriverTimeWindow('Afternoon (2-6 PM)')}>
                  Afternoon (2-6 PM)
                </Button>
                <Button variant="outline" onClick={() => handleDriverTimeWindow('Evening (6-10 PM)')}>
                  Evening (6-10 PM)
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {state.step === 'success' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-green-600">
              {state.role === 'passenger' ? 'Trip Scheduled!' : 'Availability Published!'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {state.role === 'passenger' ? (
                <div>
                  <p>Your trip has been scheduled with {state.selectedDriver?.name}</p>
                  <div className="space-y-1 text-sm text-muted-foreground mt-2">
                    <p>From: {state.pickupLocation}</p>
                    <p>To: {state.dropoffLocation}</p>
                    <p>Time: {state.scheduledTime}</p>
                    <p>Driver: {state.selectedDriver?.plate}</p>
                  </div>
                </div>
              ) : (
                <div>
                  <p>Your availability has been published!</p>
                  <div className="space-y-1 text-sm text-muted-foreground mt-2">
                    <p>Route: {state.route?.from} → {state.route?.to}</p>
                    <p>Time: {state.timeWindow}</p>
                    <p>Status: Matching enabled</p>
                  </div>
                </div>
              )}
              
              <Button onClick={resetFlow} variant="outline">
                Schedule Another Trip
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}