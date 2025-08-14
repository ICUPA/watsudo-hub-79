import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, User, Car, MapPin, QrCode } from "lucide-react";

const activities = [
  {
    id: 1,
    type: "user",
    message: "New user registered",
    user: "+25078123456",
    time: "2 min ago",
    icon: User
  },
  {
    id: 2,
    type: "ride",
    message: "Ride completed",
    user: "Driver: John Doe",
    time: "5 min ago",
    icon: MapPin
  },
  {
    id: 3,
    type: "vehicle",
    message: "Vehicle verified",
    user: "Plate: RAB 123A",
    time: "12 min ago",
    icon: Car
  },
  {
    id: 4,
    type: "qr",
    message: "QR code generated",
    user: "Amount: 5,000 RWF",
    time: "18 min ago",
    icon: QrCode
  }
];

export function RecentActivity() {
  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Recent Activity
        </CardTitle>
        <CardDescription>
          Latest system events
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {activities.map((activity) => {
            const Icon = activity.icon;
            return (
              <div key={activity.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/20 hover:bg-muted/30 transition-colors">
                <div className="h-8 w-8 bg-primary/10 rounded-full flex items-center justify-center">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{activity.message}</p>
                  <p className="text-xs text-muted-foreground">{activity.user}</p>
                </div>
                <span className="text-xs text-muted-foreground">{activity.time}</span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}