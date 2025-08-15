import { 
  LayoutDashboard, 
  Users, 
  Car, 
  UserCheck, 
  MapPin, 
  QrCode, 
  MessageSquare,
  Settings,
  FileText,
  Calendar,
  Package,
  Shield,
  CreditCard,
  Scan
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DashboardView } from "@/components/dashboard/HubDashboard";

interface SidebarProps {
  currentView: DashboardView;
  onViewChange: (view: DashboardView) => void;
}

const navItems = [
  {
    id: "overview" as DashboardView,
    label: "Overview",
    icon: LayoutDashboard,
    description: "System overview"
  },
  {
    id: "users" as DashboardView,
    label: "Users",
    icon: Users,
    description: "User management"
  },
  {
    id: "vehicles" as DashboardView,
    label: "Vehicles",
    icon: Car,
    description: "Vehicle registry"
  },
  {
    id: "drivers" as DashboardView,
    label: "Drivers",
    icon: UserCheck,
    description: "Driver management"
  },
  {
    id: "rides" as DashboardView,
    label: "Rides",
    icon: MapPin,
    description: "Ride monitoring"
  },
  {
    id: "qr" as DashboardView,
    label: "QR Generator",
    icon: QrCode,
    description: "USSD QR codes"
  },
  {
    id: "scan-qr" as DashboardView,
    label: "Scan QR",
    icon: Scan,
    description: "QR decoder"
  },
  {
    id: "whatsapp" as DashboardView,
    label: "WhatsApp Sim",
    icon: MessageSquare,
    description: "Message simulator"
  },
  {
    id: "whatsapp-logs" as DashboardView,
    label: "WhatsApp Logs",
    icon: MessageSquare,
    description: "Webhook logs"
  },
  {
    id: "vehicle-ocr" as DashboardView,
    label: "Vehicle OCR",
    icon: FileText,
    description: "Document processing"
  },
  {
    id: "insurance-periods" as DashboardView,
    label: "Insurance Periods",
    icon: Calendar,
    description: "Period management"
  },
  {
    id: "insurance-addons" as DashboardView,
    label: "Insurance Addons",
    icon: Package,
    description: "Addon management"
  },
  {
    id: "insurance-pa" as DashboardView,
    label: "Insurance PA",
    icon: Shield,
    description: "Personal Accident"
  },
  {
    id: "payment-plans" as DashboardView,
    label: "Payment Plans",
    icon: CreditCard,
    description: "Payment options"
  },
  {
    id: "insurance-backoffice" as DashboardView,
    label: "Insurance Office",
    icon: Shield,
    description: "Quote management"
  },
  {
    id: "insurance-quotes" as DashboardView,
    label: "Insurance Quotes",
    icon: FileText,
    description: "Quote tracking"
  },
  {
    id: "nearby-drivers-flow" as DashboardView,
    label: "Nearby Drivers",
    icon: MapPin,
    description: "Find drivers flow"
  },
  {
    id: "schedule-trip-flow" as DashboardView,
    label: "Schedule Trip",
    icon: Calendar,
    description: "Trip planning flow"
  },
  {
    id: "add-vehicle-flow" as DashboardView,
    label: "Add Vehicle",
    icon: Car,
    description: "Vehicle registration"
  },
  {
    id: "insurance-moto-flow" as DashboardView,
    label: "Insurance Moto",
    icon: Shield,
    description: "Moto insurance flow"
  }
];

export function Sidebar({ currentView, onViewChange }: SidebarProps) {
  return (
    <div className="fixed left-0 top-0 h-full w-64 glass-card border-r border-border/20 p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold gradient-text mb-2">
          Mobility Hub
        </h1>
        <p className="text-sm text-muted-foreground">
          Admin Dashboard
        </p>
      </div>

      <div className="flex-1 overflow-y-auto max-h-[calc(100vh-240px)]">
        <nav className="space-y-2 pr-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => onViewChange(item.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300",
                  "hover:bg-primary/10 hover:translate-x-1",
                  currentView === item.id && "bg-primary/20 glow-border"
                )}
              >
                <Icon className={cn(
                  "h-5 w-5 transition-colors",
                  currentView === item.id ? "text-primary" : "text-muted-foreground"
                )} />
                <div className="flex-1 text-left">
                  <div className={cn(
                    "font-medium transition-colors",
                    currentView === item.id ? "text-primary" : "text-foreground"
                  )}>
                    {item.label}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {item.description}
                  </div>
                </div>
              </button>
            );
          })}
        </nav>
      </div>

      <div className="absolute bottom-6 left-6 right-6">
        <div className="glass-card p-4 rounded-xl border border-border/20">
          <div className="flex items-center gap-3">
            <Settings className="h-5 w-5 text-muted-foreground" />
            <div>
              <div className="font-medium text-sm">System Status</div>
              <div className="text-xs text-success">All systems operational</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}