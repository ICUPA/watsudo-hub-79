import { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { UserManagement } from "@/components/admin/UserManagement";
import { VehicleManagement } from "@/components/admin/VehicleManagement";
import { DriverManagement } from "@/components/admin/DriverManagement";
import { RideMonitoring } from "@/components/admin/RideMonitoring";
import { QRGenerator } from "@/components/admin/QRGenerator";
import { WhatsAppSimulator } from "@/components/admin/WhatsAppSimulator";
import { DashboardOverview } from "@/components/admin/DashboardOverview";
import { VehicleOCR } from "@/components/admin/VehicleOCR";
import { InsuranceQuotes } from "@/components/admin/InsuranceQuotes";
import { InsurancePeriods } from "@/components/admin/InsurancePeriods";
import { InsuranceAddons } from "@/components/admin/InsuranceAddons";
import { InsurancePA } from "@/components/admin/InsurancePA";
import { PaymentPlans } from "@/components/admin/PaymentPlans";
import { QRCodeGenerator } from "@/components/admin/QRCodeGenerator";
import { WhatsAppWebhookLogs } from "@/components/admin/WhatsAppWebhookLogs";
import { InsuranceBackoffice } from "@/components/admin/InsuranceBackoffice";
import { ScanQRFlow } from "@/components/admin/ScanQRFlow";
import { QRManagement } from "@/components/admin/QRManagement";
import { CRUDTester } from "@/components/admin/CRUDTester";
import { NearbyDriversFlow } from "@/components/workflows/NearbyDriversFlow";
import { ScheduleTripFlow } from "@/components/workflows/ScheduleTripFlow";
import { AddVehicleFlow } from "@/components/workflows/AddVehicleFlow";
import { InsuranceMotoFlow } from "@/components/workflows/InsuranceMotoFlow";

export type DashboardView = 
  | "overview" 
  | "users" 
  | "vehicles" 
  | "drivers" 
  | "rides" 
  | "qr" 
  | "qr-management"
  | "whatsapp"
  | "vehicle-ocr"
  | "insurance-quotes"
  | "insurance-periods"
  | "insurance-addons"
  | "insurance-pa"
  | "payment-plans"
  | "qr-generator"
  | "whatsapp-logs"
  | "insurance-backoffice"
  | "scan-qr"
  | "nearby-drivers-flow"
  | "schedule-trip-flow"
  | "add-vehicle-flow"
  | "insurance-moto-flow"
  | "crud-tester"
  | "settings";

export function HubDashboard() {
  const [currentView, setCurrentView] = useState<DashboardView>("overview");

  const renderContent = () => {
    switch (currentView) {
      case "overview":
        return <DashboardOverview />;
      case "users":
        return <UserManagement />;
      case "vehicles":
        return <VehicleManagement />;
      case "drivers":
        return <DriverManagement />;
      case "rides":
        return <RideMonitoring />;
      case "qr":
        return <QRGenerator />;
      case "qr-management":
        return <QRManagement />;
      case "whatsapp":
        return <WhatsAppSimulator />;
      case "vehicle-ocr":
        return <VehicleOCR />;
      case "insurance-quotes":
        return <InsuranceQuotes />;
      case "insurance-periods":
        return <InsurancePeriods />;
      case "insurance-addons":
        return <InsuranceAddons />;
      case "insurance-pa":
        return <InsurancePA />;
      case "payment-plans":
        return <PaymentPlans />;
      case "qr-generator":
        return <QRCodeGenerator />;
      case "whatsapp-logs":
        return <WhatsAppWebhookLogs />;
      case "insurance-backoffice":
        return <InsuranceBackoffice />;
      case "scan-qr":
        return <ScanQRFlow />;
      case "nearby-drivers-flow":
        return <NearbyDriversFlow />;
      case "schedule-trip-flow":
        return <ScheduleTripFlow />;
      case "add-vehicle-flow":
        return <AddVehicleFlow />;
      case "insurance-moto-flow":
        return <InsuranceMotoFlow />;
      case "crud-tester":
        return <CRUDTester />;
      default:
        return <DashboardOverview />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="flex">
        <Sidebar 
          currentView={currentView}
          onViewChange={setCurrentView}
        />
        <div className="flex-1 ml-64">
          <DashboardHeader />
          <main className="p-6">
            <div className="animate-fade-in">
              {renderContent()}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}