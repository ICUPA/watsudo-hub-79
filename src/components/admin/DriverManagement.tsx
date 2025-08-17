// Enhanced Driver Management Component
// Provides comprehensive driver management with Maps picker integration

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
  Car, 
  MapPin, 
  Plus, 
  Edit, 
  Trash2, 
  Eye, 
  Search, 
  Filter,
  MoreHorizontal,
  Phone,
  Mail,
  Star
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { MapsPicker, type Location } from '@/components/shared/MapsPicker';
import { cn } from '@/lib/utils';

interface Driver {
  id: string;
  user_id: string;
  profile: {
    wa_name: string;
    wa_phone: string;
    email?: string;
  };
  vehicle_type: string;
  plate_number: string;
  make: string;
  model: string;
  year: number;
  is_active: boolean;
  rating: number;
  total_rides: number;
  location: Location | null;
  last_seen_at: string;
  created_at: string;
  updated_at: string;
}

interface DriverFormData {
  user_id: string;
  vehicle_type: string;
  plate_number: string;
  make: string;
  model: string;
  year: number;
  location: Location | null;
}

export function DriverManagement() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [vehicleTypeFilter, setVehicleTypeFilter] = useState<string>('all');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [formData, setFormData] = useState<DriverFormData>({
    user_id: '',
    vehicle_type: '',
    plate_number: '',
    make: '',
    model: '',
    year: new Date().getFullYear(),
    location: null
  });

  useEffect(() => {
    loadDrivers();
  }, []);

  const loadDrivers = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('drivers')
        .select(`
          *,
          profile:profiles(wa_name, wa_phone, email),
          location
        `)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      setDrivers(data || []);
    } catch (err) {
      console.error('Error loading drivers:', err);
      setError('Failed to load drivers');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddDriver = async () => {
    try {
      if (!formData.user_id || !formData.vehicle_type || !formData.plate_number) {
        setError('Please fill in all required fields');
        return;
      }

      const { error: insertError } = await supabase
        .from('drivers')
        .insert([{
          user_id: formData.user_id,
          vehicle_type: formData.vehicle_type,
          plate_number: formData.plate_number,
          make: formData.make,
          model: formData.model,
          year: formData.year,
          location: formData.location,
          is_active: true
        }]);

      if (insertError) throw insertError;

      setIsAddDialogOpen(false);
      resetForm();
      loadDrivers();
    } catch (err) {
      console.error('Error adding driver:', err);
      setError('Failed to add driver');
    }
  };

  const handleEditDriver = async () => {
    try {
      if (!selectedDriver) return;

      const { error: updateError } = await supabase
        .from('drivers')
        .update({
          vehicle_type: formData.vehicle_type,
          plate_number: formData.plate_number,
          make: formData.make,
          model: formData.model,
          year: formData.year,
          location: formData.location,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedDriver.id);

      if (updateError) throw updateError;

      setIsEditDialogOpen(false);
      resetForm();
      loadDrivers();
    } catch (err) {
      console.error('Error updating driver:', err);
      setError('Failed to update driver');
    }
  };

  const handleToggleDriverStatus = async (driverId: string, currentStatus: boolean) => {
    try {
      const { error: updateError } = await supabase
        .from('drivers')
        .update({ 
          is_active: !currentStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', driverId);

      if (updateError) throw updateError;

      loadDrivers();
    } catch (err) {
      console.error('Error updating driver status:', err);
      setError('Failed to update driver status');
    }
  };

  const handleDeleteDriver = async (driverId: string) => {
    if (!confirm('Are you sure you want to delete this driver?')) return;

    try {
      const { error: deleteError } = await supabase
        .from('drivers')
        .delete()
        .eq('id', driverId);

      if (deleteError) throw deleteError;

      loadDrivers();
    } catch (err) {
      console.error('Error deleting driver:', err);
      setError('Failed to delete driver');
    }
  };

  const resetForm = () => {
    setFormData({
      user_id: '',
      vehicle_type: '',
      plate_number: '',
      make: '',
      model: '',
      year: new Date().getFullYear(),
      location: null
    });
    setSelectedDriver(null);
  };

  const openEditDialog = (driver: Driver) => {
    setSelectedDriver(driver);
    setFormData({
      user_id: driver.user_id,
      vehicle_type: driver.vehicle_type,
      plate_number: driver.plate_number,
      make: driver.make,
      model: driver.model,
      year: driver.year,
      location: driver.location
    });
    setIsEditDialogOpen(true);
  };

  const filteredDrivers = drivers.filter(driver => {
    const matchesSearch = driver.profile.wa_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         driver.plate_number.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || 
                         (statusFilter === 'active' && driver.is_active) ||
                         (statusFilter === 'inactive' && !driver.is_active);
    const matchesVehicleType = vehicleTypeFilter === 'all' || driver.vehicle_type === vehicleTypeFilter;

    return matchesSearch && matchesStatus && matchesVehicleType;
  });

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

  const getStatusBadge = (isActive: boolean) => {
    return isActive ? (
      <Badge variant="default" className="bg-green-100 text-green-800">Active</Badge>
    ) : (
      <Badge variant="secondary">Inactive</Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <span className="ml-2 text-gray-500">Loading drivers...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Driver Management</h1>
          <p className="text-gray-500 mt-1">
            Manage driver accounts, vehicles, and locations
          </p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Driver
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add New Driver</DialogTitle>
              <DialogDescription>
                Register a new driver with vehicle information and location.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="user_id">User ID</Label>
                  <Input
                    id="user_id"
                    value={formData.user_id}
                    onChange={(e) => setFormData({ ...formData, user_id: e.target.value })}
                    placeholder="Enter user ID"
                  />
                </div>
                <div>
                  <Label htmlFor="vehicle_type">Vehicle Type</Label>
                  <Select value={formData.vehicle_type} onValueChange={(value) => setFormData({ ...formData, vehicle_type: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select vehicle type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="moto">Motorcycle</SelectItem>
                      <SelectItem value="cab">Car</SelectItem>
                      <SelectItem value="liffan">Minibus</SelectItem>
                      <SelectItem value="truck">Truck</SelectItem>
                      <SelectItem value="rental">Rental</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="plate_number">Plate Number</Label>
                  <Input
                    id="plate_number"
                    value={formData.plate_number}
                    onChange={(e) => setFormData({ ...formData, plate_number: e.target.value })}
                    placeholder="Enter plate number"
                  />
                </div>
                <div>
                  <Label htmlFor="make">Make</Label>
                  <Input
                    id="make"
                    value={formData.make}
                    onChange={(e) => setFormData({ ...formData, make: e.target.value })}
                    placeholder="Enter vehicle make"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="model">Model</Label>
                  <Input
                    id="model"
                    value={formData.model}
                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                    placeholder="Enter vehicle model"
                  />
                </div>
                <div>
                  <Label htmlFor="year">Year</Label>
                  <Input
                    id="year"
                    type="number"
                    value={formData.year}
                    onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) })}
                    min="1900"
                    max={new Date().getFullYear() + 1}
                  />
                </div>
              </div>
              <MapsPicker
                value={formData.location}
                onChange={(location) => setFormData({ ...formData, location })}
                label="Vehicle Location"
                placeholder="Search for vehicle location..."
                showMap={true}
                mapHeight={200}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddDriver}>
                Add Driver
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search drivers by name or plate number..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
              <Select value={vehicleTypeFilter} onValueChange={(value) => setVehicleTypeFilter(value)}>
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
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Drivers Table */}
      <Card>
        <CardHeader>
          <CardTitle>Drivers ({filteredDrivers.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Driver</TableHead>
                <TableHead>Vehicle</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead>Last Seen</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDrivers.map((driver) => (
                <TableRow key={driver.id}>
                  <TableCell>
                    <div className="flex items-center space-x-3">
                      <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                        <Car className="h-5 w-5 text-gray-600" />
                      </div>
                      <div>
                        <div className="font-medium">{driver.profile.wa_name}</div>
                        <div className="text-sm text-gray-500 flex items-center space-x-1">
                          <Phone className="h-3 w-3" />
                          <span>{driver.profile.wa_phone}</span>
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <span className="text-lg">{getVehicleTypeIcon(driver.vehicle_type)}</span>
                      <div>
                        <div className="font-medium">{driver.plate_number}</div>
                        <div className="text-sm text-gray-500">
                          {driver.make} {driver.model} ({driver.year})
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {driver.location ? (
                      <div className="flex items-center space-x-1">
                        <MapPin className="h-3 w-3 text-gray-400" />
                        <span className="text-sm text-gray-600">
                          {driver.location.formatted_address.substring(0, 30)}...
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">No location</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(driver.is_active)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-1">
                      <Star className="h-3 w-3 text-yellow-400 fill-current" />
                      <span className="text-sm">{driver.rating.toFixed(1)}</span>
                      <span className="text-xs text-gray-500">({driver.total_rides})</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm text-gray-500">
                      {new Date(driver.last_seen_at).toLocaleDateString()}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(driver)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleDriverStatus(driver.id, driver.is_active)}
                      >
                        {driver.is_active ? 'Deactivate' : 'Activate'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteDriver(driver.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Driver Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Driver</DialogTitle>
            <DialogDescription>
              Update driver information and vehicle details.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit_vehicle_type">Vehicle Type</Label>
                <Select value={formData.vehicle_type} onValueChange={(value) => setFormData({ ...formData, vehicle_type: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="moto">Motorcycle</SelectItem>
                    <SelectItem value="cab">Car</SelectItem>
                    <SelectItem value="liffan">Minibus</SelectItem>
                    <SelectItem value="truck">Truck</SelectItem>
                    <SelectItem value="rental">Rental</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit_plate_number">Plate Number</Label>
                <Input
                  id="edit_plate_number"
                  value={formData.plate_number}
                  onChange={(e) => setFormData({ ...formData, plate_number: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit_make">Make</Label>
                <Input
                  id="edit_make"
                  value={formData.make}
                  onChange={(e) => setFormData({ ...formData, make: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit_model">Model</Label>
                <Input
                  id="edit_model"
                  value={formData.model}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="edit_year">Year</Label>
              <Input
                id="edit_year"
                type="number"
                value={formData.year}
                onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) })}
                min="1900"
                max={new Date().getFullYear() + 1}
              />
            </div>
            <MapsPicker
              value={formData.location}
              onChange={(location) => setFormData({ ...formData, location })}
              label="Vehicle Location"
              placeholder="Search for vehicle location..."
              showMap={true}
              mapHeight={200}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditDriver}>
              Update Driver
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