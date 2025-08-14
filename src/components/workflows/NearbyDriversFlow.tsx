import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Star, Clock, Phone, MessageSquare, Car } from "lucide-react";
import { getNearbyDrivers, createRide, notifyDriver, getVehicleTypes } from "@/lib/backend-placeholders";
import { toast } from "sonner";

interface Driver {
  id: string;
  name: string;
  phone: string;
  plate: string;
  vehicle_type: string;
  rating: number;
  distance: number;
  eta: string;
  status: 'online' | 'offline' | 'busy';
}

interface WorkflowState {
  step: 'vehicle_type' | 'location' | 'driver_list' | 'driver_detail' | 'booking' | 'confirmed';
  vehicleType?: string;
  location?: string;
  drivers?: Driver[];
  selectedDriver?: Driver;
  rideId?: string;
}

export function NearbyDriversFlow() {
  const [state, setState] = useState<WorkflowState>({ step: 'vehicle_type' });
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

  const handleVehicleTypeSelect = (type: string) => {
    setState({ ...state, vehicleType: type, step: 'location' });
  };

  const handleLocationSubmit = async (location: string) => {
    if (!location.trim()) return;
    
    setIsLoading(true);
    setState({ ...state, location, step: 'driver_list' });
    
    try {
      const drivers = await getNearbyDrivers(location, state.vehicleType!);
      setState({ ...state, location, drivers, step: 'driver_list' });
      toast.success(`Found ${drivers.length} nearby drivers`);
    } catch (error) {
      toast.error('Failed to find nearby drivers');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDriverSelect = (driver: Driver) => {
    setState({ ...state, selectedDriver: driver, step: 'driver_detail' });
  };

  const handleBookRide = async () => {
    if (!state.selectedDriver || !state.location) return;
    
    setIsLoading(true);
    try {
      const rideData = {
        passenger_phone: '+250788767816', // Mock passenger
        pickup_location: state.location,
        vehicle_type: state.vehicleType!,
        status: 'pending' as const
      };
      
      const result = await createRide(rideData);
      if (result.success) {
        await notifyDriver(state.selectedDriver.id, result.ride_id!);
        setState({ ...state, rideId: result.ride_id, step: 'confirmed' });
        toast.success('Ride request sent to driver');
      }
    } catch (error) {
      toast.error('Failed to book ride');
    } finally {
      setIsLoading(false);
    }
  };

  const resetFlow = () => {
    setState({ step: 'vehicle_type' });
  };

  // Load vehicle types on mount
  if (vehicleTypes.length === 0 && state.step === 'vehicle_type') {
    loadVehicleTypes();
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Nearby Drivers Workflow</h1>
        <p className="text-muted-foreground">Find and book rides with nearby drivers</p>
        
        {/* Progress Indicator */}
        <div className="flex items-center gap-2 mt-4">
          {['vehicle_type', 'location', 'driver_list', 'booking'].map((step, index) => (
            <div key={step} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${
                state.step === step ? 'bg-primary text-primary-foreground' : 
                ['location', 'driver_list', 'booking'].slice(0, ['vehicle_type', 'location', 'driver_list', 'booking'].indexOf(state.step)).includes(step) 
                  ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground'
              }`}>
                {index + 1}
              </div>
              {index < 3 && <div className="w-8 h-0.5 bg-border" />}
            </div>
          ))}
        </div>
      </div>

      {/* Step Content */}
      {state.step === 'vehicle_type' && (
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

      {state.step === 'location' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Share Your Location
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-muted-foreground">Enter your pickup location to find nearby {state.vehicleType} drivers.</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g., Kimisagara, Kigali"
                  className="flex-1 px-3 py-2 border rounded-lg"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleLocationSubmit((e.target as HTMLInputElement).value);
                    }
                  }}
                />
                <Button 
                  onClick={() => {
                    const input = document.querySelector('input') as HTMLInputElement;
                    handleLocationSubmit(input.value);
                  }}
                  disabled={isLoading}
                >
                  {isLoading ? 'Finding...' : 'Find Drivers'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {state.step === 'driver_list' && state.drivers && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Nearby {state.vehicleType} Drivers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {state.drivers.map((driver) => (
                <div
                  key={driver.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 cursor-pointer"
                  onClick={() => handleDriverSelect(driver)}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                      <Car className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <div className="font-medium">{driver.name}</div>
                      <div className="text-sm text-muted-foreground">{driver.plate}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant={driver.status === 'online' ? 'default' : 'secondary'}>
                          {driver.status}
                        </Badge>
                        <div className="flex items-center gap-1 text-sm">
                          <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                          {driver.rating}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">{driver.distance}km</div>
                    <div className="text-sm text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {driver.eta}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {state.step === 'driver_detail' && state.selectedDriver && (
        <Card>
          <CardHeader>
            <CardTitle>Driver Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                  <Car className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold">{state.selectedDriver.name}</h3>
                  <p className="text-muted-foreground">{state.selectedDriver.plate}</p>
                  <div className="flex items-center gap-4 mt-2">
                    <Badge variant="default">Online</Badge>
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      <span>{state.selectedDriver.rating}</span>
                    </div>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      {state.selectedDriver.distance}km away
                    </div>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      ETA: {state.selectedDriver.eta}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <Button onClick={handleBookRide} disabled={isLoading} className="flex-1">
                  {isLoading ? 'Booking...' : 'Book Ride'}
                </Button>
                <Button variant="outline" className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  WhatsApp
                </Button>
                <Button variant="outline" className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  Call
                </Button>
                <Button variant="ghost" onClick={() => setState({ ...state, step: 'driver_list' })}>
                  Back
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {state.step === 'confirmed' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-green-600">Ride Request Sent!</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p>Your ride request has been sent to {state.selectedDriver?.name}.</p>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>• Driver will confirm or reject within 2 minutes</p>
                <p>• You'll receive notifications about ride status</p>
                <p>• Ride ID: {state.rideId}</p>
              </div>
              <Button onClick={resetFlow} variant="outline">
                Book Another Ride
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}