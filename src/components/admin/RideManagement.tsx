// Enhanced Ride Management Component
// Provides comprehensive ride tracking and management with Maps integration

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  MapPin, 
  Car, 
  User, 
  Clock, 
  Search, 
  Filter,
  Eye,
  Phone,
  Navigation,
  Calendar,
  DollarSign,
  Star
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { MapsPicker, type Location } from '@/components/shared/MapsPicker';
import { cn } from '@/lib/utils';

interface Ride {
  id: string;
  user_id: string;
  driver_id?: string;
  pickup_location: Location;
  dropoff_location: Location;
  status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
  vehicle_type: string;
  scheduled_time?: string;
  created_at: string;
  updated_at: string;
  user: {
    wa_name: string;
    wa_phone: string;
  };
  driver?: {
    wa_name: string;
    wa_phone: string;
    vehicle: {
      plate_number: string;
      make: string;
      model: string;
    };
  };
  estimated_fare?: number;
  actual_fare?: number;
  rating?: number;
  feedback?: string;
}

interface RideFilters {
  status: string;
  vehicleType: string;
  dateRange: string;
  searchQuery: string;
}

export function RideManagement() {
  const [rides, setRides] = useState<Ride[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<RideFilters>({
    status: 'all',
    vehicleType: 'all',
    dateRange: 'all',
    searchQuery: ''
  });
  const [selectedRide, setSelectedRide] = useState<Ride | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [availableDrivers, setAvailableDrivers] = useState<any[]>([]);
  const [selectedDriverId, setSelectedDriverId] = useState<string>('');

  useEffect(() => {
    loadRides();
    loadAvailableDrivers();
  }, []);

  const loadRides = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('rides')
        .select(`
          *,
          user:profiles!rides_user_id_fkey(wa_name, wa_phone),
          driver:profiles!rides_driver_id_fkey(wa_name, wa_phone),
          driver_vehicle:drivers(vehicle:vehicles(plate_number, make, model))
        `)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      // Transform the data to match our interface
      const transformedRides = (data || []).map(ride => ({
        ...ride,
        driver: ride.driver ? {
          wa_name: ride.driver.wa_name,
          wa_phone: ride.driver.wa_phone,
          vehicle: ride.driver_vehicle?.vehicle || {}
        } : undefined
      }));

      setRides(transformedRides);
    } catch (err) {
      console.error('Error loading rides:', err);
      setError('Failed to load rides');
    } finally {
      setIsLoading(false);
    }
  };

  const loadAvailableDrivers = async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('drivers')
        .select(`
          id,
          profile:profiles(wa_name, wa_phone),
          vehicle:vehicles(plate_number, make, model)
        `)
        .eq('is_active', true);

      if (fetchError) throw fetchError;

      setAvailableDrivers(data || []);
    } catch (err) {
      console.error('Error loading available drivers:', err);
    }
  };

  const handleAssignDriver = async () => {
    try {
      if (!selectedRide || !selectedDriverId) return;

      const { error: updateError } = await supabase
        .from('rides')
        .update({ 
          driver_id: selectedDriverId,
          status: 'confirmed',
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedRide.id);

      if (updateError) throw updateError;

      setIsAssignDialogOpen(false);
      setSelectedDriverId('');
      loadRides();
    } catch (err) {
      console.error('Error assigning driver:', err);
      setError('Failed to assign driver');
    }
  };

  const handleUpdateRideStatus = async (rideId: string, newStatus: Ride['status']) => {
    try {
      const { error: updateError } = await supabase
        .from('rides')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', rideId);

      if (updateError) throw updateError;

      loadRides();
    } catch (err) {
      console.error('Error updating ride status:', err);
      setError('Failed to update ride status');
    }
  };

  const getStatusBadge = (status: Ride['status']) => {
    const statusConfig = {
      pending: { variant: 'secondary', text: 'Pending', color: 'bg-yellow-100 text-yellow-800' },
      confirmed: { variant: 'default', text: 'Confirmed', color: 'bg-blue-100 text-blue-800' },
      in_progress: { variant: 'default', text: 'In Progress', color: 'bg-purple-100 text-purple-800' },
      completed: { variant: 'default', text: 'Completed', color: 'bg-green-100 text-green-800' },
      cancelled: { variant: 'destructive', text: 'Cancelled', color: 'bg-red-100 text-red-800' }
    };

    const config = statusConfig[status];
    return (
      <Badge className={config.color}>
        {config.text}
      </Badge>
    );
  };

  const getVehicleTypeIcon = (type: string) => {
    switch (type) {
      case 'moto':
        return '🛵';
      case 'cab':
        return '🚗';
      case 'liffan':
        return '🚐';
      case 'truck':
        return '🚛';
      case 'rental':
        return '🚙';
      default:
        return '🚗';
    }
  };

  const filteredRides = rides.filter(ride => {
    const matchesStatus = filters.status === 'all' || ride.status === filters.status;
    const matchesVehicleType = filters.vehicleType === 'all' || ride.vehicle_type === filters.vehicleType;
    const matchesSearch = ride.user.wa_name.toLowerCase().includes(filters.searchQuery.toLowerCase()) ||
                         ride.user.wa_phone.includes(filters.searchQuery) ||
                         ride.id.toLowerCase().includes(filters.searchQuery.toLowerCase());

    let matchesDateRange = true;
    if (filters.dateRange !== 'all') {
      const rideDate = new Date(ride.created_at);
      const now = new Date();
      const diffInHours = (now.getTime() - rideDate.getTime()) / (1000 * 60 * 60);

      switch (filters.dateRange) {
        case 'today':
          matchesDateRange = rideDate.toDateString() === now.toDateString();
          break;
        case 'week':
          matchesDateRange = diffInHours <= 168; // 7 days
          break;
        case 'month':
          matchesDateRange = diffInHours <= 720; // 30 days
          break;
      }
    }

    return matchesStatus && matchesVehicleType && matchesSearch && matchesDateRange;
  });

  const getStatusActions = (ride: Ride) => {
    switch (ride.status) {
      case 'pending':
        return (
          <div className="flex space-x-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedRide(ride);
                setIsAssignDialogOpen(true);
              }}
            >
              Assign Driver
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleUpdateRideStatus(ride.id, 'cancelled')}
              className="text-red-600"
            >
              Cancel
            </Button>
          </div>
        );
      case 'confirmed':
        return (
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleUpdateRideStatus(ride.id, 'in_progress')}
          >
            Start Ride
          </Button>
        );
      case 'in_progress':
        return (
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleUpdateRideStatus(ride.id, 'completed')}
          >
            Complete
          </Button>
        );
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <span className="ml-2 text-gray-500">Loading rides...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Ride Management</h1>
          <p className="text-gray-500 mt-1">
            Track and manage all ride requests and assignments
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant="outline">
            Total: {rides.length}
          </Badge>
          <Badge variant="outline" className="bg-green-100 text-green-800">
            Active: {rides.filter(r => ['pending', 'confirmed', 'in_progress'].includes(r.status)).length}
          </Badge>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {rides.filter(r => r.status === 'pending').length}
            </div>
            <p className="text-xs text-muted-foreground">
              Awaiting driver assignment
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <Car className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {rides.filter(r => r.status === 'in_progress').length}
            </div>
            <p className="text-xs text-muted-foreground">
              Currently active rides
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {rides.filter(r => r.status === 'completed').length}
            </div>
            <p className="text-xs text-muted-foreground">
              Successfully completed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {rides
                .filter(r => r.status === 'completed' && r.actual_fare)
                .reduce((sum, r) => sum + (r.actual_fare || 0), 0)
                .toLocaleString('en-RW', { style: 'currency', currency: 'RWF' })
              }
            </div>
            <p className="text-xs text-muted-foreground">
              Total revenue
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search rides by user, phone, or ride ID..."
                  value={filters.searchQuery}
                  onChange={(e) => setFilters({ ...filters, searchQuery: e.target.value })}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Select value={filters.status} onValueChange={(value) => setFilters({ ...filters, status: value })}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filters.vehicleType} onValueChange={(value) => setFilters({ ...filters, vehicleType: value })}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Vehicles</SelectItem>
                  <SelectItem value="moto">Motorcycle</SelectItem>
                  <SelectItem value="cab">Car</SelectItem>
                  <SelectItem value="liffan">Minibus</SelectItem>
                  <SelectItem value="truck">Truck</SelectItem>
                  <SelectItem value="rental">Rental</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filters.dateRange} onValueChange={(value) => setFilters({ ...filters, dateRange: value })}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">This Week</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Rides Table */}
      <Card>
        <CardHeader>
          <CardTitle>Rides ({filteredRides.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ride ID</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Route</TableHead>
                <TableHead>Vehicle</TableHead>
                <TableHead>Driver</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRides.map((ride) => (
                <TableRow key={ride.id}>
                  <TableCell>
                    <div className="font-mono text-sm">
                      {ride.id.slice(0, 8)}...
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-3">
                      <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                        <User className="h-4 w-4 text-blue-600" />
                      </div>
                      <div>
                        <div className="font-medium">{ride.user.wa_name}</div>
                        <div className="text-sm text-gray-500 flex items-center space-x-1">
                          <Phone className="h-3 w-3" />
                          <span>{ride.user.wa_phone}</span>
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="flex items-center space-x-1 text-sm">
                        <MapPin className="h-3 w-3 text-green-500" />
                        <span className="text-gray-600">
                          {ride.pickup_location.formatted_address.substring(0, 25)}...
                        </span>
                      </div>
                      <div className="flex items-center space-x-1 text-sm">
                        <Navigation className="h-3 w-3 text-red-500" />
                        <span className="text-gray-600">
                          {ride.dropoff_location.formatted_address.substring(0, 25)}...
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <span className="text-lg">{getVehicleTypeIcon(ride.vehicle_type)}</span>
                      <span className="text-sm font-medium">{ride.vehicle_type}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {ride.driver ? (
                      <div className="space-y-1">
                        <div className="font-medium text-sm">{ride.driver.wa_name}</div>
                        <div className="text-xs text-gray-500">
                          {ride.driver.vehicle.plate_number}
                        </div>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">Unassigned</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(ride.status)}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm text-gray-500">
                      <div>{new Date(ride.created_at).toLocaleDateString()}</div>
                      <div>{new Date(ride.created_at).toLocaleTimeString()}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedRide(ride);
                          setIsViewDialogOpen(true);
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {getStatusActions(ride)}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* View Ride Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Ride Details</DialogTitle>
            <DialogDescription>
              Complete information about this ride request
            </DialogDescription>
          </DialogHeader>
          {selectedRide && (
            <div className="space-y-6">
              {/* Basic Information */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-500">Ride ID</Label>
                  <div className="font-mono text-sm mt-1">{selectedRide.id}</div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">Status</Label>
                  <div className="mt-1">{getStatusBadge(selectedRide.status)}</div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">Created</Label>
                  <div className="text-sm mt-1">
                    {new Date(selectedRide.created_at).toLocaleString()}
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">Vehicle Type</Label>
                  <div className="text-sm mt-1 flex items-center space-x-2">
                    <span className="text-lg">{getVehicleTypeIcon(selectedRide.vehicle_type)}</span>
                    <span>{selectedRide.vehicle_type}</span>
                  </div>
                </div>
              </div>

              {/* User Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">User Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-gray-500">Name</Label>
                      <div className="text-sm mt-1">{selectedRide.user.wa_name}</div>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-500">Phone</Label>
                      <div className="text-sm mt-1">{selectedRide.user.wa_phone}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Route Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Route Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <Label className="text-sm font-medium text-gray-500">Pickup Location</Label>
                      <MapsPicker
                        value={selectedRide.pickup_location}
                        onChange={() => {}} // Read-only
                        showMap={false}
                        disabled={true}
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-500">Dropoff Location</Label>
                      <MapsPicker
                        value={selectedRide.dropoff_location}
                        onChange={() => {}} // Read-only
                        showMap={false}
                        disabled={true}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Driver Information */}
              {selectedRide.driver && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Driver Information</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm font-medium text-gray-500">Name</Label>
                        <div className="text-sm mt-1">{selectedRide.driver.wa_name}</div>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-500">Phone</Label>
                        <div className="text-sm mt-1">{selectedRide.driver.wa_phone}</div>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-gray-500">Vehicle</Label>
                        <div className="text-sm mt-1">
                          {selectedRide.driver.vehicle.plate_number} - {selectedRide.driver.vehicle.make} {selectedRide.driver.vehicle.model}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Fare Information */}
              {(selectedRide.estimated_fare || selectedRide.actual_fare) && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Fare Information</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      {selectedRide.estimated_fare && (
                        <div>
                          <Label className="text-sm font-medium text-gray-500">Estimated Fare</Label>
                          <div className="text-lg font-bold text-blue-600 mt-1">
                            {selectedRide.estimated_fare.toLocaleString('en-RW', { style: 'currency', currency: 'RWF' })}
                          </div>
                        </div>
                      )}
                      {selectedRide.actual_fare && (
                        <div>
                          <Label className="text-sm font-medium text-gray-500">Actual Fare</Label>
                          <div className="text-lg font-bold text-green-600 mt-1">
                            {selectedRide.actual_fare.toLocaleString('en-RW', { style: 'currency', currency: 'RWF' })}
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Driver Dialog */}
      <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Driver</DialogTitle>
            <DialogDescription>
              Select an available driver for this ride
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="driver">Select Driver</Label>
              <Select value={selectedDriverId} onValueChange={setSelectedDriverId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a driver" />
                </SelectTrigger>
                <SelectContent>
                  {availableDrivers.map((driver) => (
                    <SelectItem key={driver.id} value={driver.id}>
                      {driver.profile.wa_name} - {driver.vehicle?.plate_number || 'No vehicle'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAssignDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAssignDriver} disabled={!selectedDriverId}>
              Assign Driver
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Error Display */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="text-red-800">{error}</div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setError(null)}
              className="mt-2"
            >
              Dismiss
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
