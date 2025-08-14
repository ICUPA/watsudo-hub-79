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
import { Search, UserCheck, MapPin, Star, Clock, Phone } from "lucide-react";

// Mock data
const mockDrivers = [
  {
    id: "1",
    user_id: "2",
    wa_phone: "+250782345678",
    wa_name: "Marie Mukamana",
    is_active: true,
    rating: 4.8,
    total_trips: 145,
    location: { lat: -1.9441, lng: 30.0619 },
    last_seen_at: "2024-01-20T14:22:00Z",
    vehicle_count: 1,
    status: "online"
  },
  {
    id: "2", 
    user_id: "4",
    wa_phone: "+250783456789",
    wa_name: "Jean Claude Ndayishimiye",
    is_active: true,
    rating: 4.5,
    total_trips: 89,
    location: { lat: -1.9506, lng: 30.0588 },
    last_seen_at: "2024-01-20T13:45:00Z",
    vehicle_count: 2,
    status: "busy"
  },
  {
    id: "3",
    user_id: "5", 
    wa_phone: "+250784567890",
    wa_name: "Alice Uwimana",
    is_active: false,
    rating: 4.9,
    total_trips: 234,
    location: null,
    last_seen_at: "2024-01-19T18:30:00Z",
    vehicle_count: 1,
    status: "offline"
  }
];

export function DriverManagement() {
  const [searchTerm, setSearchTerm] = useState("");
  const [drivers, setDrivers] = useState(mockDrivers);

  const filteredDrivers = drivers.filter(driver => 
    driver.wa_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    driver.wa_phone.includes(searchTerm)
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "online":
        return <Badge className="bg-success/20 text-success">Online</Badge>;
      case "busy":
        return <Badge className="bg-warning/20 text-warning">Busy</Badge>;
      case "offline":
        return <Badge variant="outline">Offline</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const renderRating = (rating: number) => {
    return (
      <div className="flex items-center gap-1">
        <Star className="h-4 w-4 fill-primary text-primary" />
        <span className="font-medium">{rating.toFixed(1)}</span>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold gradient-text mb-2">
            Driver Management
          </h1>
          <p className="text-muted-foreground">
            Monitor and manage active drivers
          </p>
        </div>
        <Button className="bg-gradient-primary hover:opacity-90">
          <UserCheck className="h-4 w-4 mr-2" />
          Add Driver
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="glass-card">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-success/10 rounded-lg flex items-center justify-center">
                <UserCheck className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold">{drivers.filter(d => d.status === "online").length}</p>
                <p className="text-sm text-muted-foreground">Online Now</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-warning/10 rounded-lg flex items-center justify-center">
                <Clock className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold">{drivers.filter(d => d.status === "busy").length}</p>
                <p className="text-sm text-muted-foreground">Currently Busy</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-primary/10 rounded-lg flex items-center justify-center">
                <Star className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {(drivers.reduce((sum, d) => sum + d.rating, 0) / drivers.length).toFixed(1)}
                </p>
                <p className="text-sm text-muted-foreground">Avg. Rating</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Driver Directory</CardTitle>
          <CardDescription>
            All registered drivers and their current status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or phone number..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Badge variant="outline" className="px-3 py-1">
              {filteredDrivers.length} drivers
            </Badge>
          </div>

          <div className="rounded-lg border border-border/20 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/20">
                  <TableHead>Driver</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Rating</TableHead>
                  <TableHead>Trips</TableHead>
                  <TableHead>Vehicles</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Seen</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDrivers.map((driver) => (
                  <TableRow key={driver.id} className="hover:bg-muted/10">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 bg-primary/10 rounded-full flex items-center justify-center">
                          <UserCheck className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{driver.wa_name}</p>
                          <p className="text-xs text-muted-foreground">ID: {driver.id}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span className="font-mono text-sm">{driver.wa_phone}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {renderRating(driver.rating)}
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{driver.total_trips}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span>{driver.vehicle_count}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(driver.status)}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-muted-foreground">
                        {new Date(driver.last_seen_at).toLocaleString()}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 justify-end">
                        <Button variant="ghost" size="sm">
                          <MapPin className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          View
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}