import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Search, Car, FileCheck, Eye, CheckCircle, XCircle } from "lucide-react";

// Mock data
const mockVehicles = [
  {
    id: "1",
    user_id: "1",
    usage_type: "moto",
    plate: "RAB 123A",
    vin: "1HGBH41JXMN109186",
    make: "Honda",
    model: "CBR 150",
    model_year: 2022,
    insurance_provider: "SONARWA",
    insurance_policy: "POL123456",
    insurance_expiry: "2024-12-31",
    doc_url: "/docs/insurance_cert_1.pdf",
    verified: true,
    created_at: "2024-01-15T10:30:00Z",
    owner_name: "Jean Uwimana"
  },
  {
    id: "2",
    user_id: "2", 
    usage_type: "cab",
    plate: "RAC 456B",
    vin: "2HGFC2F53HH123456",
    make: "Toyota",
    model: "Corolla",
    model_year: 2021,
    insurance_provider: "RADIANT",
    insurance_policy: "POL789012",
    insurance_expiry: "2024-06-30",
    doc_url: "/docs/insurance_cert_2.pdf",
    verified: false,
    created_at: "2024-01-12T09:15:00Z",
    owner_name: "Marie Mukamana"
  }
];

export function VehicleManagement() {
  const [searchTerm, setSearchTerm] = useState("");
  const [vehicles, setVehicles] = useState(mockVehicles);

  const filteredVehicles = vehicles.filter(vehicle => 
    vehicle.plate?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    vehicle.make?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    vehicle.model?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    vehicle.owner_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleVerify = (vehicleId: string) => {
    setVehicles(prev => prev.map(vehicle => 
      vehicle.id === vehicleId ? { ...vehicle, verified: true } : vehicle
    ));
  };

  const getUsageTypeBadge = (type: string) => {
    const types: Record<string, { label: string; variant: any }> = {
      moto: { label: "Moto Taxi", variant: "default" },
      cab: { label: "Cab", variant: "secondary" },
      liffan: { label: "Liffan", variant: "outline" },
      truck: { label: "Truck", variant: "outline" },
      rental: { label: "Rental", variant: "secondary" }
    };
    return types[type] || { label: type, variant: "default" };
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold gradient-text mb-2">
            Vehicle Management
          </h1>
          <p className="text-muted-foreground">
            Vehicle registry and verification system
          </p>
        </div>
        <Button className="bg-gradient-primary hover:opacity-90">
          <Car className="h-4 w-4 mr-2" />
          Add Vehicle
        </Button>
      </div>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Vehicle Registry</CardTitle>
          <CardDescription>
            All registered vehicles with OCR-extracted data
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by plate, make, model, or owner..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Badge variant="outline" className="px-3 py-1">
                {filteredVehicles.length} vehicles
              </Badge>
              <Badge variant="default" className="px-3 py-1 bg-success/20 text-success">
                {filteredVehicles.filter(v => v.verified).length} verified
              </Badge>
            </div>
          </div>

          <div className="rounded-lg border border-border/20 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/20">
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Usage</TableHead>
                  <TableHead>Insurance</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredVehicles.map((vehicle) => {
                  const usageType = getUsageTypeBadge(vehicle.usage_type);
                  return (
                    <TableRow key={vehicle.id} className="hover:bg-muted/10">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 bg-primary/10 rounded-lg flex items-center justify-center">
                            <Car className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">{vehicle.plate}</p>
                            <p className="text-sm text-muted-foreground">
                              {vehicle.make} {vehicle.model} ({vehicle.model_year})
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="font-medium">{vehicle.owner_name}</p>
                      </TableCell>
                      <TableCell>
                        <Badge variant={usageType.variant}>
                          {usageType.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <p className="font-medium">{vehicle.insurance_provider}</p>
                          <p className="text-muted-foreground">
                            Exp: {new Date(vehicle.insurance_expiry).toLocaleDateString()}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {vehicle.verified ? (
                            <>
                              <CheckCircle className="h-4 w-4 text-success" />
                              <Badge variant="default" className="bg-success/20 text-success">
                                Verified
                              </Badge>
                            </>
                          ) : (
                            <>
                              <XCircle className="h-4 w-4 text-warning" />
                              <Badge variant="outline" className="text-warning border-warning">
                                Pending
                              </Badge>
                            </>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 justify-end">
                          <Button variant="ghost" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm">
                            <FileCheck className="h-4 w-4" />
                          </Button>
                          {!vehicle.verified && (
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleVerify(vehicle.id)}
                              className="text-success hover:text-success"
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}