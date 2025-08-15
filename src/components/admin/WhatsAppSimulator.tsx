import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, Send, Upload, Phone, Bot, User, Image, FileText } from "lucide-react";
import { sendWhatsAppMessage } from "@/lib/supabase-api";
import { toast } from "sonner";

interface Message {
  id: string;
  type: 'text' | 'image' | 'document' | 'system';
  content: string;
  from: 'user' | 'bot';
  timestamp: Date;
  imageUrl?: string;
  processed?: boolean;
}

interface ConversationState {
  step: 'main_menu' | 'qr_entry' | 'qr_momo_setup' | 'qr_amount' | 'qr_amount_pick' | 'qr_amount_custom' | 'qr_generating' | 
        'qr_scan' | 'qr_decode' | 'nearby_drivers' | 'nd_vehicle_type' | 'nd_location' | 'nd_driver_list' | 'nd_driver_detail' | 'nd_booking' |
        'schedule_trip' | 'st_role' | 'st_passenger_vehicle' | 'st_passenger_pickup' | 'st_passenger_dropoff' | 'st_passenger_datetime' | 'st_passenger_drivers' |
        'st_driver_route' | 'st_driver_time' | 'add_vehicle' | 'av_usage_type' | 'av_insurance_upload' | 'av_processing' | 'av_success' |
        'insurance' | 'ins_vehicle_check' | 'ins_start_date' | 'ins_period' | 'ins_addons' | 'ins_pa_category' | 'ins_summary' | 
        'ins_quotation_pending' | 'ins_quotation_received' | 'ins_payment_plan' | 'ins_payment_pending' | 'ins_certificate' |
        'ins_period_confirm' | 'ins_custom_date' | 'ins_custom_end_date';
  
  // QR Code data
  userMomo?: string;
  qrAmount?: number;
  
  // Driver/Ride data
  selectedVehicleType?: string;
  userLocation?: string;
  nearbyDrivers?: any[];
  selectedDriver?: any;
  rideData?: any;
  
  // Vehicle registration
  extractedData?: any;
  ownerPhone?: string;
  usageType?: string;
  
  // Schedule trip
  tripRole?: 'passenger' | 'driver';
  pickupLocation?: string;
  dropoffLocation?: string;
  scheduledTime?: string;
  
  // Insurance flow
  hasVehicleOnFile?: boolean;
  insuranceStartDate?: string;
  selectedPeriod?: string;
  selectedAddons?: number[];
  selectedPACategory?: string;
  insuranceQuoteId?: string;
}

export function WhatsAppSimulator() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'system',
      content: 'WhatsApp Bot Connected',
      from: 'bot',
      timestamp: new Date()
    },
    {
      id: '2',
      type: 'text',
      content: '🚗 **Welcome to MoveRwanda!**\n\nChoose an option:\n1️⃣ Generate QR Code\n2️⃣ Nearby Drivers\n3️⃣ Schedule Trip\n4️⃣ Add Vehicle\n5️⃣ Get Motor Insurance\n6️⃣ More\n\nReply with number (1-6) or option name.',
      from: 'bot',
      timestamp: new Date()
    }
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("0788767816");
  const [isProcessing, setIsProcessing] = useState(false);
  const [conversationState, setConversationState] = useState<ConversationState>({ step: 'main_menu' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addMessage = (message: Omit<Message, 'id' | 'timestamp'>) => {
    const newMessage: Message = {
      ...message,
      id: Date.now().toString(),
      timestamp: new Date()
    };
    setMessages(prev => [...prev, newMessage]);
    return newMessage;
  };

  const processUserMessage = async (content: string, type: 'text' | 'image' = 'text', imageFile?: File) => {
    // Add user message
    addMessage({ type, content, from: 'user', imageUrl: imageFile ? URL.createObjectURL(imageFile) : undefined });
    
    setIsProcessing(true);
    
    try {
      let botResponse = "";
      let newState = { ...conversationState };

      switch (conversationState.step) {
        case 'main_menu':
          if (content === '1' || content.toLowerCase().includes('qr') || content.toLowerCase().includes('generate')) {
            botResponse = "💳 **Generate QR Code**\n\nChecking your MoMo details...";
            newState.step = 'qr_entry';
            
            setTimeout(async () => {
              const savedMomo = await getUserMoMo(phoneNumber);
              if (savedMomo) {
                newState.userMomo = savedMomo;
                const chooseAmountMsg = `💳 MoMo found: ${savedMomo}\n\nChoose amount mode:\n1️⃣ With amount\n2️⃣ No amount (recipient chooses)`;
                addMessage({ type: 'text', content: chooseAmountMsg, from: 'bot' });
                setConversationState({ ...newState, step: 'qr_amount' });
              } else {
                const enterMomoMsg = "📱 **Enter your MoMo number**\n\nFormat: 07XXXXXXXX";
                addMessage({ type: 'text', content: enterMomoMsg, from: 'bot' });
                setConversationState({ ...newState, step: 'qr_momo_setup' });
              }
            }, 1000);
          }
          else if (content === '2' || content.toLowerCase().includes('nearby') || content.toLowerCase().includes('driver')) {
            const vehicleTypes = await getVehicleTypes();
            botResponse = `🚗 **Nearby Drivers**\n\nChoose vehicle type:\n${vehicleTypes.map((type, i) => `${i + 1}️⃣ ${type}`).join('\n')}`;
            newState.step = 'nd_vehicle_type';
          }
          else if (content === '3' || content.toLowerCase().includes('schedule')) {
            botResponse = "📅 **Schedule Trip**\n\nChoose your role:\n1️⃣ Passenger\n2️⃣ Driver";
            newState.step = 'st_role';
          }
          else if (content === '4' || content.toLowerCase().includes('add') || content.toLowerCase().includes('vehicle')) {
            const types = ["Moto Taxi", "Cab", "Liffan", "Truck", "Rental", "Other"];
            botResponse = `🚗 **Add Vehicle**\n\nChoose usage type:\n${types.map((type, i) => `${i + 1}️⃣ ${type}`).join('\n')}`;
            newState.step = 'av_usage_type';
          }
          else if (content === '5' || content.toLowerCase().includes('insurance') || content.toLowerCase().includes('motor')) {
            botResponse = "🛡️ **Insurance for Moto**\n\nChecking your vehicle records...";
            newState.step = 'insurance';
            
            setTimeout(async () => {
              // Mock check for vehicle on file
              const hasVehicle = Math.random() > 0.5;
              newState.hasVehicleOnFile = hasVehicle;
              
              if (hasVehicle) {
                const vehicleMsg = "✅ **Vehicle Found: RAD123A**\n\nProceed with insurance quote?\n\n1️⃣ Continue\n2️⃣ Back to menu";
                addMessage({ type: 'text', content: vehicleMsg, from: 'bot' });
                setConversationState({ ...newState, step: 'ins_vehicle_check' });
              } else {
                const docsMsg = "📄 **Documents Required**\n\nPlease upload:\n• Carte Jaune (Vehicle Registration)\n• Old Insurance Certificate\n\n📎 Upload documents or type 'agent' to chat with support.\n\n(In real WhatsApp, tap attachment → Camera/Document)";
                addMessage({ type: 'text', content: docsMsg, from: 'bot' });
                setConversationState({ ...newState, step: 'ins_vehicle_check' });
              }
            }, 1500);
          }
          else if (content === '6' || content.toLowerCase().includes('more')) {
            botResponse = "📋 **More Features**\n\n1️⃣ Scan QR Code\n2️⃣ Payment History\n3️⃣ Support\n4️⃣ Settings\n\nSelect option or type 'menu' to return.";
          }
          else if (content.toLowerCase().includes('menu') || content.toLowerCase().includes('back')) {
            botResponse = "🚗 **Welcome to MoveRwanda!**\n\nChoose an option:\n1️⃣ Generate QR Code\n2️⃣ Nearby Drivers\n3️⃣ Schedule Trip\n4️⃣ Add Vehicle\n5️⃣ Get Motor Insurance\n6️⃣ More\n\nReply with number (1-6) or option name.";
          }
          else {
            botResponse = "🚗 **Welcome to MoveRwanda!**\n\nChoose an option:\n1️⃣ Generate QR Code\n2️⃣ Nearby Drivers\n3️⃣ Schedule Trip\n4️⃣ Add Vehicle\n5️⃣ Get Motor Insurance\n6️⃣ More\n\nReply with number (1-6) or option name.";
          }
          break;

        case 'qr_momo_setup':
          if (content.match(/^07\d{8}$/)) {
            await saveUserMoMo(phoneNumber, content);
            newState.userMomo = content;
            botResponse = `✅ MoMo saved: ${content}\n\nChoose amount mode:\n1️⃣ With amount\n2️⃣ No amount (recipient chooses)`;
            newState.step = 'qr_amount';
          } else {
            botResponse = "❌ Invalid format. Please enter MoMo as: 07XXXXXXXX";
          }
          break;

        case 'qr_amount':
          if (content === '1') {
            botResponse = "💰 **Set Amount**\n\nQuick pick:\n1️⃣ 1,000 RWF\n2️⃣ 2,000 RWF\n3️⃣ 5,000 RWF\n4️⃣ Other amount";
            newState.step = 'qr_amount_pick';
          } else if (content === '2') {
            newState.qrAmount = undefined;
            botResponse = "🔄 Generating QR code...";
            newState.step = 'qr_generating';
            
            setTimeout(async () => {
              const ussdCode = `*182*1*1*${newState.userMomo!.replace(/^0/, '')}#`;
              const telLink = `tel:${ussdCode.replace(/#/g, '%23')}`;
              const result = await generatePaymentQR(newState.userMomo!);
              const qrMsg = `✅ **QR Code Generated!**\n\n💳 MoMo: ${newState.userMomo}\n💰 Amount: Recipient chooses\n📱 USSD: ${ussdCode}\n🔗 Tel Link: ${telLink}\n\n[QR Code Image]\n\n**Actions:**\n• Generate another\n• Home`;
              addMessage({ type: 'text', content: qrMsg, from: 'bot' });
              setConversationState({ ...newState, step: 'main_menu' });
            }, 1500);
          } else {
            botResponse = "Please choose an option:\n1️⃣ With amount\n2️⃣ No amount";
          }
          break;

        case 'qr_amount_pick':
          if (content === '1' || content === '1000') {
            newState.qrAmount = 1000;
            botResponse = "🔄 Generating QR code...";
            newState.step = 'qr_generating';
            
            setTimeout(async () => {
              const ussdCode = `*182*1*1*${newState.userMomo!.replace(/^0/, '')}*1000#`;
              const telLink = `tel:${ussdCode.replace(/#/g, '%23')}`;
              const result = await generatePaymentQR(newState.userMomo!, 1000);
              const qrMsg = `✅ **QR Code Generated!**\n\n💳 MoMo: ${newState.userMomo}\n💰 Amount: 1,000 RWF\n📱 USSD: ${ussdCode}\n🔗 Tel Link: ${telLink}\n\n[QR Code Image]\n\n**Actions:**\n• Generate another\n• Home`;
              addMessage({ type: 'text', content: qrMsg, from: 'bot' });
              setConversationState({ ...newState, step: 'main_menu' });
            }, 1500);
          } else if (content === '2' || content === '2000') {
            newState.qrAmount = 2000;
            botResponse = "🔄 Generating QR code...";
            newState.step = 'qr_generating';
            
            setTimeout(async () => {
              const ussdCode = `*182*1*1*${newState.userMomo!.replace(/^0/, '')}*2000#`;
              const telLink = `tel:${ussdCode.replace(/#/g, '%23')}`;
              const result = await generatePaymentQR(newState.userMomo!, 2000);
              const qrMsg = `✅ **QR Code Generated!**\n\n💳 MoMo: ${newState.userMomo}\n💰 Amount: 2,000 RWF\n📱 USSD: ${ussdCode}\n🔗 Tel Link: ${telLink}\n\n[QR Code Image]\n\n**Actions:**\n• Generate another\n• Home`;
              addMessage({ type: 'text', content: qrMsg, from: 'bot' });
              setConversationState({ ...newState, step: 'main_menu' });
            }, 1500);
          } else if (content === '3' || content === '5000') {
            newState.qrAmount = 5000;
            botResponse = "🔄 Generating QR code...";
            newState.step = 'qr_generating';
            
            setTimeout(async () => {
              const ussdCode = `*182*1*1*${newState.userMomo!.replace(/^0/, '')}*5000#`;
              const telLink = `tel:${ussdCode.replace(/#/g, '%23')}`;
              const result = await generatePaymentQR(newState.userMomo!, 5000);
              const qrMsg = `✅ **QR Code Generated!**\n\n💳 MoMo: ${newState.userMomo}\n💰 Amount: 5,000 RWF\n📱 USSD: ${ussdCode}\n🔗 Tel Link: ${telLink}\n\n[QR Code Image]\n\n**Actions:**\n• Generate another\n• Home`;
              addMessage({ type: 'text', content: qrMsg, from: 'bot' });
              setConversationState({ ...newState, step: 'main_menu' });
            }, 1500);
          } else if (content === '4') {
            botResponse = "💰 Enter custom amount (digits only, e.g., 3500):";
            newState.step = 'qr_amount_custom';
          } else {
            botResponse = "Please choose an option (1-4) or enter amount directly.";
          }
          break;

        case 'qr_amount_custom':
          if (content.match(/^\d+$/) && parseInt(content) > 0) {
            const amount = parseInt(content);
            newState.qrAmount = amount;
            botResponse = "🔄 Generating QR code...";
            newState.step = 'qr_generating';
            
            setTimeout(async () => {
              const ussdCode = `*182*1*1*${newState.userMomo!.replace(/^0/, '')}*${amount}#`;
              const telLink = `tel:${ussdCode.replace(/#/g, '%23')}`;
              const result = await generatePaymentQR(newState.userMomo!, amount);
              const qrMsg = `✅ **QR Code Generated!**\n\n💳 MoMo: ${newState.userMomo}\n💰 Amount: ${amount.toLocaleString()} RWF\n📱 USSD: ${ussdCode}\n🔗 Tel Link: ${telLink}\n\n[QR Code Image]\n\n**Actions:**\n• Generate another\n• Home`;
              addMessage({ type: 'text', content: qrMsg, from: 'bot' });
              setConversationState({ ...newState, step: 'main_menu' });
            }, 1500);
          } else {
            botResponse = "❌ Please enter a valid amount (digits only, greater than 0).";
          }
          break;

        case 'qr_scan':
          if (type === 'image' && imageFile) {
            botResponse = "🔍 Decoding QR code...";
            newState.step = 'qr_decode';
            
            setTimeout(async () => {
              const base64 = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.readAsDataURL(imageFile);
              });
              
              const decoded = await decodeQR(base64);
              if (decoded.success) {
                const decodeMsg = `✅ **QR Code Decoded!**\n\n📱 USSD: ${decoded.ussd}\n\n**Actions:**\n1️⃣ Pay now\n2️⃣ Save\n3️⃣ Back`;
                addMessage({ type: 'text', content: decodeMsg, from: 'bot' });
                setConversationState({ ...newState, step: 'qr_decode' });
              } else {
                const errorMsg = "❌ Could not decode QR code.\n\n**Options:**\n• Resend clearer image\n• Contact support\n• Back";
                addMessage({ type: 'text', content: errorMsg, from: 'bot' });
                setConversationState({ ...newState, step: 'qr_scan' });
              }
            }, 2000);
          } else {
            botResponse = "📷 Please upload a QR code image.";
          }
          break;

        case 'qr_decode':
          if (content === '1') {
            botResponse = "📱 **Opening USSD Dialer**\n\nPress dial to execute payment.\n\nBack to menu when done.";
            newState.step = 'main_menu';
          } else if (content === '2') {
            botResponse = "💾 QR code saved to your collection!\n\nBack to menu.";
            newState.step = 'main_menu';
          } else {
            botResponse = "🚗 **Welcome to MoveRwanda!**\n\nChoose an option:\n1️⃣ Generate QR Code\n2️⃣ Nearby Drivers\n3️⃣ Schedule Trip\n4️⃣ Add Vehicle\n5️⃣ More";
            newState.step = 'main_menu';
          }
          break;

        case 'nd_vehicle_type':
          const vehicleTypesNd = await getVehicleTypes();
          const selectedIndex = parseInt(content) - 1;
          if (selectedIndex >= 0 && selectedIndex < vehicleTypesNd.length) {
            newState.selectedVehicleType = vehicleTypesNd[selectedIndex];
            botResponse = "📍 **Share Your Location**\n\nPlease share your current location to find nearby drivers.\n\n(In real WhatsApp, tap attachment → Location)";
            newState.step = 'nd_location';
          } else {
            botResponse = `Please choose a valid option (1-${vehicleTypesNd.length}).`;
          }
          break;

        case 'nd_location':
          newState.userLocation = content;
          botResponse = "🔍 Finding nearby drivers...";
          newState.step = 'nd_driver_list';
          
          setTimeout(async () => {
            const drivers = await getNearbyDrivers(content, newState.selectedVehicleType!);
            newState.nearbyDrivers = drivers;
            const driversList = drivers.map((d, i) => 
              `${i + 1}️⃣ ${d.plate} • ${d.distance}km • ⭐${d.rating}`
            ).join('\n');
            const driversMsg = `🚗 **Top 10 Nearby ${newState.selectedVehicleType} Drivers**\n\n${driversList}\n\nSelect driver:`;
            addMessage({ type: 'text', content: driversMsg, from: 'bot' });
            setConversationState({ ...newState, step: 'nd_driver_list' });
          }, 1500);
          break;

        case 'nd_driver_list':
          const driverIndex = parseInt(content) - 1;
          if (driverIndex >= 0 && driverIndex < (newState.nearbyDrivers?.length || 0)) {
            newState.selectedDriver = newState.nearbyDrivers![driverIndex];
            const driver = newState.selectedDriver;
            botResponse = `👤 **${driver.name}**\n🚗 ${driver.plate}\n⭐ ${driver.rating}/5 rating\n📍 ${driver.distance}km away\n⏱️ ETA: ${driver.eta}\n\n**Actions:**\n1️⃣ Book\n2️⃣ Open WhatsApp\n3️⃣ Back`;
            newState.step = 'nd_driver_detail';
          } else {
            botResponse = `Please select a valid driver (1-${newState.nearbyDrivers?.length || 0}).`;
          }
          break;

        case 'nd_driver_detail':
          if (content === '1') {
            botResponse = "📱 Creating ride request...";
            newState.step = 'nd_booking';
            
            setTimeout(async () => {
              const ride = await createRide({
                passenger_phone: phoneNumber,
                driver_id: newState.selectedDriver.id,
                pickup_location: newState.userLocation,
                vehicle_type: newState.selectedVehicleType,
                status: 'pending'
              });
              
              await notifyDriver(newState.selectedDriver.id, ride.ride_id!);
              const waitingMsg = "⏳ **Ride Request Sent**\n\nNotifying driver... You'll receive confirmation shortly.";
              addMessage({ type: 'text', content: waitingMsg, from: 'bot' });
              
              // Simulate driver response
              setTimeout(async () => {
                const accepted = Math.random() > 0.3; // 70% acceptance rate
                await driverResponse(ride.ride_id!, accepted ? 'confirm' : 'reject');
                
                if (accepted) {
                  const confirmMsg = `✅ **Ride Confirmed!**\n\n👤 Driver: ${newState.selectedDriver.name}\n🚗 ${newState.selectedDriver.plate}\n📱 ${newState.selectedDriver.phone}\n\n🚗 Status: En-route\n⏱️ ETA: ${newState.selectedDriver.eta}\n\n**Live Updates:**\n📍 Driver approaching\n📞 Driver will call`;
                  addMessage({ type: 'text', content: confirmMsg, from: 'bot' });
                  
                  // Simulate trip lifecycle
                  setTimeout(() => {
                    addMessage({ type: 'text', content: "📍 **Driver Status: Arrived**\n\nYour driver has arrived at pickup location.", from: 'bot' });
                  }, 5000);
                  
                  setTimeout(() => {
                    addMessage({ type: 'text', content: "✅ **Trip Completed**\n\nThank you for using MoveRwanda!\n\nRate your experience: ⭐⭐⭐⭐⭐", from: 'bot' });
                  }, 10000);
                } else {
                  const rejectMsg = `❌ **Ride Rejected**\n\nDriver declined the request.\n\n**Menu:**\n1️⃣ Pick another\n2️⃣ Refresh\n3️⃣ Back to menu`;
                  addMessage({ type: 'text', content: rejectMsg, from: 'bot' });
                }
                setConversationState({ ...newState, step: 'main_menu' });
              }, 3000);
            }, 1000);
          } else if (content === '2') {
            botResponse = `📱 **Opening WhatsApp**\n\nDeep link: wa.me/250${newState.selectedDriver.phone.slice(1)}\n\nDirect chat with ${newState.selectedDriver.name}.`;
            newState.step = 'nd_driver_list';
          } else {
            // Back to driver list
            const drivers = newState.nearbyDrivers!;
            const driversList = drivers.map((d, i) => 
              `${i + 1}️⃣ ${d.plate} • ${d.distance}km • ⭐${d.rating}`
            ).join('\n');
            botResponse = `🚗 **Top 10 Nearby ${newState.selectedVehicleType} Drivers**\n\n${driversList}\n\nSelect driver:`;
            newState.step = 'nd_driver_list';
          }
          break;

        case 'st_role':
          if (content === '1') {
            newState.tripRole = 'passenger';
            const vehicleTypes = await getVehicleTypes();
            botResponse = `📅 **Schedule Trip - Passenger**\n\nChoose vehicle type:\n${vehicleTypes.map((type, i) => `${i + 1}️⃣ ${type}`).join('\n')}`;
            newState.step = 'st_passenger_vehicle';
          } else if (content === '2') {
            newState.tripRole = 'driver';
            botResponse = "📅 **Schedule Trip - Driver**\n\nEnter your future route:\n\n📍 From: (e.g., Kimisagara)\n📍 To: (e.g., Airport)\n\nFormat: From - To";
            newState.step = 'st_driver_route';
          } else {
            botResponse = "Please choose your role:\n1️⃣ Passenger\n2️⃣ Driver";
          }
          break;

        case 'st_passenger_vehicle':
          const vehicleTypesSt = await getVehicleTypes();
          const vehicleIndex = parseInt(content) - 1;
          if (vehicleIndex >= 0 && vehicleIndex < vehicleTypesSt.length) {
            newState.selectedVehicleType = vehicleTypesSt[vehicleIndex];
            botResponse = "📍 **Pickup Location**\n\nShare your pickup location.\n\n(In real WhatsApp, tap attachment → Location)";
            newState.step = 'st_passenger_pickup';
          } else {
            botResponse = `Please choose a valid vehicle type (1-${vehicleTypesSt.length}).`;
          }
          break;

        case 'st_passenger_pickup':
          newState.pickupLocation = content;
          botResponse = "📍 **Drop-off Location**\n\nShare your destination.\n\n(In real WhatsApp, tap attachment → Location)";
          newState.step = 'st_passenger_dropoff';
          break;

        case 'st_passenger_dropoff':
          newState.dropoffLocation = content;
          botResponse = "📅 **Select Date/Time**\n\n1️⃣ Today\n2️⃣ Tomorrow\n3️⃣ Pick date\n4️⃣ Preset times\n\nChoose option:";
          newState.step = 'st_passenger_datetime';
          break;

        case 'st_passenger_datetime':
          let timeWindow = "";
          if (content === '1') {
            timeWindow = "Today";
          } else if (content === '2') {
            timeWindow = "Tomorrow";
          } else if (content === '3') {
            botResponse = "📅 Enter date (YYYY-MM-DD) and time (HH:MM):\n\nExample: 2024-12-15 14:30";
            break;
          } else if (content === '4') {
            botResponse = "⏰ **Preset Times**\n\n1️⃣ 6:00 AM\n2️⃣ 8:00 AM\n3️⃣ 12:00 PM\n4️⃣ 5:00 PM\n5️⃣ 7:00 PM\n\nChoose time:";
            break;
          } else if (content.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/)) {
            timeWindow = content;
          } else if (['1', '2', '3', '4', '5'].includes(content)) {
            const times = ['6:00 AM', '8:00 AM', '12:00 PM', '5:00 PM', '7:00 PM'];
            timeWindow = `Tomorrow ${times[parseInt(content) - 1]}`;
          } else {
            botResponse = "Please choose a valid time option.";
            break;
          }
          
          newState.scheduledTime = timeWindow;
          botResponse = "🔍 Finding aligned drivers...";
          newState.step = 'st_passenger_drivers';
          
          setTimeout(async () => {
            const drivers = await getNearbyDrivers(newState.pickupLocation!, newState.selectedVehicleType!);
            newState.nearbyDrivers = drivers.slice(0, 5); // Limit for schedule
            const driversList = drivers.slice(0, 5).map((d, i) => 
              `${i + 1}️⃣ ${d.plate} • ${d.distance}km • ETA match: ${d.eta}`
            ).join('\n');
            const driversMsg = `📅 **Aligned Drivers for ${timeWindow}**\n\n${driversList}\n\nSelect driver to book:`;
            addMessage({ type: 'text', content: driversMsg, from: 'bot' });
            setConversationState({ ...newState, step: 'nd_driver_detail' });
          }, 1500);
          break;

        case 'st_driver_route':
          if (content.includes(' - ') || content.includes(' to ')) {
            const [from, to] = content.split(/ - | to /);
            botResponse = `📅 **Route Set**\n\n📍 From: ${from}\n📍 To: ${to}\n\n⏰ **Select Time Window**\n\n1️⃣ Morning (6-10 AM)\n2️⃣ Midday (10-2 PM)\n3️⃣ Afternoon (2-6 PM)\n4️⃣ Evening (6-10 PM)\n5️⃣ Custom time`;
            newState.step = 'st_driver_time';
          } else {
            botResponse = "Please enter route in format: From - To\n\nExample: Kimisagara - Airport";
          }
          break;

        case 'st_driver_time':
          const timeSlots = ['Morning (6-10 AM)', 'Midday (10-2 PM)', 'Afternoon (2-6 PM)', 'Evening (6-10 PM)'];
          const slotIndex = parseInt(content) - 1;
          if (slotIndex >= 0 && slotIndex < 4) {
            newState.scheduledTime = timeSlots[slotIndex];
            botResponse = `✅ **Availability Published!**\n\n📍 Route: Available\n⏰ Time: ${timeSlots[slotIndex]}\n🔄 Matching: Enabled\n\nYou'll receive notifications when passengers book your route.\n\nBack to menu.`;
            newState.step = 'main_menu';
          } else if (content === '5') {
            botResponse = "⏰ Enter custom time window (e.g., 15:30-16:30):";
          } else if (content.match(/^\d{2}:\d{2}-\d{2}:\d{2}$/)) {
            newState.scheduledTime = content;
            botResponse = `✅ **Availability Published!**\n\n📍 Route: Available\n⏰ Time: ${content}\n🔄 Matching: Enabled\n\nYou'll receive notifications when passengers book your route.\n\nBack to menu.`;
            newState.step = 'main_menu';
          } else {
            botResponse = "Please choose a valid time option (1-5) or enter time in HH:MM-HH:MM format.";
          }
          break;

        case 'av_usage_type':
          const types = ["Moto Taxi", "Cab", "Liffan", "Truck", "Rental", "Other"];
          const typeIndex = parseInt(content) - 1;
          if (typeIndex >= 0 && typeIndex < types.length) {
            newState.usageType = types[typeIndex].toLowerCase().replace(' ', '_');
            botResponse = "📄 **Upload Insurance Certificate**\n\nPlease upload a photo or PDF of your insurance certificate.\n\n(In real WhatsApp, tap attachment → Camera/Document)";
            newState.step = 'av_insurance_upload';
          } else {
            botResponse = `Please choose a valid usage type (1-${types.length}).`;
          }
          break;

        case 'av_insurance_upload':
          if (type === 'image' && imageFile) {
            botResponse = "📄 **Processing Insurance Document**\n\nExtracting vehicle information via OCR...";
            newState.step = 'av_processing';
            
            setTimeout(async () => {
              const base64 = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.readAsDataURL(imageFile);
              });
              
              const extractedData = await processInsuranceDocument(base64);
              newState.extractedData = extractedData;
              
              // Simulate successful OCR processing
              const mockExtractedData = {
                plate: extractedData.plate || 'RAD123A',
                owner: 'John Doe',
                insurer: 'SONARWA',
                policy_no: 'POL123456',
                validity: '2025-12-31',
                specs: { make: 'Toyota', model: 'Hiace' }
              };
              
              const vehicleData = {
                plate: mockExtractedData.plate,
                owner_phone: phoneNumber,
                usage_type: newState.usageType as any
              };
              
              await saveVehicleData(vehicleData);
              
              const successMsg = `✅ **Vehicle Added Successfully!**\n\n🚗 Plate: ${mockExtractedData.plate}\n👤 Owner: ${mockExtractedData.owner}\n🏢 Insurer: ${mockExtractedData.insurer}\n📄 Policy: ${mockExtractedData.policy_no}\n📅 Valid until: ${mockExtractedData.validity}\n🎯 Usage: ${newState.usageType?.replace('_', ' ')}\n\n**Next Actions:**`;
              
              if (['moto_taxi', 'cab', 'liffan', 'truck'].includes(newState.usageType!)) {
                const driverMsg = `${successMsg}\n✅ Driver features enabled!\n🚗 You can now receive passengers\n📅 Schedule trips available\n📱 Live tracking enabled`;
                addMessage({ type: 'text', content: driverMsg, from: 'bot' });
              } else if (newState.usageType === 'rental') {
                const rentalMsg = `${successMsg}\n🏠 Listed under Rentals\n📞 Owner chat enabled\n📅 Availability calendar active`;
                addMessage({ type: 'text', content: rentalMsg, from: 'bot' });
              } else {
                const otherMsg = `${successMsg}\n📝 Stored as Other category`;
                addMessage({ type: 'text', content: otherMsg, from: 'bot' });
              }
              
              setConversationState({ ...newState, step: 'main_menu' });
            }, 3000);
          } else {
            botResponse = "📄 Please upload an insurance certificate (photo/PDF).";
          }
          break;

        case 'insurance':
          // This case is handled in the 'more' section above
          break;

        case 'ins_vehicle_check':
          if (content === '1' || content.toLowerCase().includes('continue')) {
            botResponse = "📅 **Insurance Start Date**\n\nWhen should your insurance start?\n\n1️⃣ Start today\n2️⃣ Pick another date";
            newState.step = 'ins_start_date';
          } else if (type === 'image') {
            botResponse = "📄 **Documents Received**\n\nProcessing Carte Jaune and insurance certificate...\n\nVerifying vehicle details...";
            
            setTimeout(() => {
              const verifiedMsg = "✅ **Documents Verified**\n\n🚗 Vehicle: RAD123A\n👤 Owner: Confirmed\n📄 Documents: Valid\n\nProceed with insurance quote?\n\n1️⃣ Continue\n2️⃣ Back to menu";
              addMessage({ type: 'text', content: verifiedMsg, from: 'bot' });
              setConversationState({ ...newState, step: 'ins_start_date' });
            }, 2000);
          } else if (content.toLowerCase().includes('agent')) {
            botResponse = "👨‍💼 **Connecting to Support Agent**\n\nTransferring to human support for document assistance...\n\nType 'menu' to return to main menu.";
            newState.step = 'main_menu';
          } else {
            botResponse = "Please:\n1️⃣ Continue with existing vehicle\n📎 Upload required documents\n👨‍💼 Type 'agent' for support";
          }
          break;

        case 'ins_start_date':
          if (content === '1') {
            const today = new Date();
            const endDate = new Date(today);
            endDate.setFullYear(endDate.getFullYear() + 1);
            
            botResponse = `📅 **Coverage Period**\n\nStart: ${today.toDateString()}\nEnd: ${endDate.toDateString()} (1 year)\n\n1️⃣ Continue with these dates\n2️⃣ Change end date\n3️⃣ Back`;
            newState.insuranceStartDate = today.toISOString().split('T')[0];
            newState.step = 'ins_period_confirm';
          } else if (content === '2') {
            botResponse = "📅 **Custom Start Date**\n\nEnter date (DD/MM/YYYY):\n\nNote: Date must be in the future.\nExample: 25/12/2024";
            newState.step = 'ins_custom_date';
          } else {
            botResponse = "Please choose:\n1️⃣ Start today\n2️⃣ Pick another date";
          }
          break;

        case 'ins_custom_date':
          const datePattern = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
          const match = content.match(datePattern);
          if (match) {
            const [, day, month, year] = match;
            const customStartDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            if (customStartDate > today) {
              const endDate = new Date(customStartDate);
              endDate.setFullYear(endDate.getFullYear() + 1);
              
              botResponse = `📅 **Coverage Period**\n\nStart: ${customStartDate.toDateString()}\nEnd: ${endDate.toDateString()} (1 year)\n\n1️⃣ Continue with these dates\n2️⃣ Change end date\n3️⃣ Back`;
              newState.insuranceStartDate = customStartDate.toISOString().split('T')[0];
              newState.step = 'ins_period_confirm';
            } else {
              botResponse = "❌ **Invalid Date**\n\nStart date must be in the future. Please enter a valid date (DD/MM/YYYY):";
            }
          } else {
            botResponse = "❌ **Invalid Format**\n\nPlease enter date in DD/MM/YYYY format:";
          }
          break;

        case 'ins_period_confirm':
          if (content === '1') {
            botResponse = "🛡️ **Insurance Add-ons**\n\nSelect additional coverage (you can choose multiple):\n\n1️⃣ Third-party Liability\n2️⃣ COMESA Yellow Card\n3️⃣ Personal Accident (PA)\n4️⃣ Comprehensive Coverage\n\nType numbers separated by commas (e.g., 1,3) or 'done' when finished:";
            newState.step = 'ins_addons';
            newState.selectedAddons = [];
          } else if (content === '2') {
            botResponse = "📅 **Change End Date**\n\nEnter preferred end date (DD/MM/YYYY):\n\nNote: Maximum 1 year from start date.";
            newState.step = 'ins_custom_end_date';
          } else if (content === '3') {
            botResponse = "📅 **Insurance Start Date**\n\nWhen should your insurance start?\n\n1️⃣ Start today\n2️⃣ Pick another date";
            newState.step = 'ins_start_date';
          }
          break;

        case 'ins_custom_end_date':
          const endDatePattern = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
          const endMatch = content.match(endDatePattern);
          if (endMatch) {
            const [, day, month, year] = endMatch;
            const customEndDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
            const startDate = new Date(newState.insuranceStartDate || '');
            const maxEndDate = new Date(startDate);
            maxEndDate.setFullYear(maxEndDate.getFullYear() + 1);
            
            if (customEndDate > startDate && customEndDate <= maxEndDate) {
              botResponse = `📅 **Coverage Period Updated**\n\nStart: ${startDate.toDateString()}\nEnd: ${customEndDate.toDateString()}\n\n1️⃣ Continue with these dates\n2️⃣ Change end date\n3️⃣ Back`;
              newState.step = 'ins_period_confirm';
            } else {
              botResponse = "❌ **Invalid Date**\n\nEnd date must be after start date and within 1 year. Please enter a valid date (DD/MM/YYYY):";
            }
          } else {
            botResponse = "❌ **Invalid Format**\n\nPlease enter date in DD/MM/YYYY format:";
          }
          break;


        case 'ins_addons':
          if (content.toLowerCase() === 'done') {
            const currentAddons = newState.selectedAddons || [];
            if (currentAddons.length === 0) {
              botResponse = "❌ **No coverage selected**\n\nPlease select at least one coverage option:\n\n1️⃣ Third-party Liability\n2️⃣ COMESA Yellow Card\n3️⃣ Personal Accident (PA)\n4️⃣ Comprehensive Coverage\n\nType numbers separated by commas (e.g., 1,3):";
            } else {
              const addonNames = ['Third-party Liability', 'COMESA Yellow Card', 'Personal Accident (PA)', 'Comprehensive Coverage'];
              const selectedNames = currentAddons.map(i => addonNames[(i as number)-1]);
              
              // Check if Personal Accident is selected
              if (currentAddons.includes(3)) {
                botResponse = `✅ **Coverage Selected**\n\nSelected: ${selectedNames.join(', ')}\n\n🩺 **Personal Accident Categories**\n\nChoose coverage level:\n\n1️⃣ Level I (Death: 1M, Disability: 1M, Medical: 100k, Motorcycles: 8k)\n2️⃣ Level II (Death: 2M, Disability: 2M, Medical: 200k, Motorcycles: 16k)\n3️⃣ Level III (Death: 3M, Disability: 3M, Medical: 300k, Motorcycles: 24k)\n4️⃣ Level IV (Death: 4M, Disability: 4M, Medical: 400k, Motorcycles: 32k)\n5️⃣ Level V (Death: 5M, Disability: 5M, Medical: 500k, Motorcycles: 40k)\n\nSelect level:`;
                newState.step = 'ins_pa_category';
              } else {
                const summary = `📋 **Insurance Summary**\n\n🚗 Vehicle: RAD123A\n📅 Start: ${newState.insuranceStartDate}\n🛡️ Add-ons: ${selectedNames.join(', ')}\n\nProceed with quotation?\n\n1️⃣ Continue\n2️⃣ Modify selection`;
                botResponse = summary;
                newState.step = 'ins_summary';
              }
            }
          } else {
            const numbers = content.split(',').map(n => parseInt(n.trim())).filter(n => n >= 1 && n <= 4);
            if (numbers.length > 0) {
              const currentAddons = newState.selectedAddons || [];
              const allAddons = [...new Set([...currentAddons, ...numbers])];
              const addonNames = ['Third-party Liability', 'COMESA Yellow Card', 'Personal Accident (PA)', 'Comprehensive Coverage'];
              const selectedNames = allAddons.map(i => addonNames[i-1]);
              
              botResponse = `✅ **Coverage Added**\n\nSelected: ${selectedNames.join(', ')}\n\nType 'done' to continue or add more numbers:`;
              newState.selectedAddons = allAddons;
            } else {
              botResponse = "❌ **Invalid selection**\n\nPlease type valid numbers (1-4) separated by commas:";
            }
          }
          break;

        case 'ins_pa_category':
          const paIndex = parseInt(content) - 1;
          if (paIndex >= 0 && paIndex < 5) {
            const paLevels = ['Level I', 'Level II', 'Level III', 'Level IV', 'Level V'];
            const selectedPACategory = paLevels[paIndex];
            const addonNames = ['Third-party Liability', 'COMESA Yellow Card', 'Personal Accident (PA)', 'Comprehensive Coverage'];
            const currentAddons = newState.selectedAddons || [];
            const selectedNames = currentAddons.map(i => addonNames[i-1]);
            
            newState.selectedPACategory = selectedPACategory;
            const summary = `📋 **Insurance Summary**\n\n🚗 Vehicle: RAD123A\n📅 Start: ${newState.insuranceStartDate}\n🛡️ Add-ons: ${selectedNames.join(', ')} (PA: ${selectedPACategory})\n\nProceed with quotation?\n\n1️⃣ Continue\n2️⃣ Modify selection`;
            botResponse = summary;
            newState.step = 'ins_summary';
          } else {
            botResponse = "Please select a valid PA level (1-5).";
          }
          break;

        case 'ins_summary':
          if (content === '1') {
            newState.insuranceQuoteId = `quote_${Date.now()}`;
            botResponse = "⏳ **Preparing Quotation**\n\nPlease wait a few minutes while our team prepares your personalized insurance quote...\n\n🔄 Processing your request\n📧 You'll receive the quotation shortly";
            newState.step = 'ins_quotation_pending';
            
            setTimeout(() => {
              const quoteMsg = "📋 **Quotation Ready!**\n\n💰 Total Premium: 45,000 RWF\n📄 Quote ID: " + newState.insuranceQuoteId + "\n\n[📎 Insurance_Quote.pdf]\n\n**Choose action:**\n1️⃣ Proceed with payment\n2️⃣ Request changes\n3️⃣ Cancel";
              addMessage({ type: 'text', content: quoteMsg, from: 'bot' });
              setConversationState({ ...newState, step: 'ins_quotation_received' });
            }, 5000);
          } else if (content === '2') {
            botResponse = "🛡️ **Insurance Add-ons**\n\nSelect additional coverage (you can choose multiple):\n\n1️⃣ Third-party Liability\n2️⃣ COMESA Yellow Card\n3️⃣ Personal Accident (PA)\n4️⃣ Comprehensive Coverage\n\nType numbers separated by commas (e.g., 1,3) or 'done' when finished:";
            newState.step = 'ins_addons';
            newState.selectedAddons = [];
          } else {
            botResponse = "Please choose:\n1️⃣ Continue with quotation\n2️⃣ Modify selection";
          }
          break;

        case 'ins_quotation_received':
          if (content === '1') {
            botResponse = "💳 **Payment Plans**\n\nChoose your payment plan:\n\n1️⃣ 1+2+9 months (25% + 25% + 50%)\n2️⃣ 3+9 months (50% + 50%)\n3️⃣ 6+6 months (75% + 25%)\n4️⃣ 1+3+8 months (25% + 35% + 40%)\n\nSelect option:";
            newState.step = 'ins_payment_plan';
          } else if (content === '2') {
            botResponse = "📞 **Request Changes**\n\nConnecting you with our insurance agent to discuss modifications...\n\nType 'menu' when done.";
            newState.step = 'main_menu';
          } else if (content === '3') {
            botResponse = "❌ **Quote Cancelled**\n\nYour insurance quote has been cancelled. You can restart the process anytime.\n\nReturning to main menu...";
            newState.step = 'main_menu';
          } else {
            botResponse = "Please choose:\n1️⃣ Proceed with payment\n2️⃣ Request changes\n3️⃣ Cancel";
          }
          break;

        case 'ins_payment_plan':
          const paymentPlans = [
            '1+2+9 months (25% + 25% + 50%)', 
            '3+9 months (50% + 50%)', 
            '6+6 months (75% + 25%)', 
            '1+3+8 months (25% + 35% + 40%)'
          ];
          const planIndex = parseInt(content) - 1;
          if (planIndex >= 0 && planIndex < paymentPlans.length) {
            const selectedPlan = paymentPlans[planIndex];
            botResponse = `✅ **Payment Plan Selected**\n\n${selectedPlan}\n\n📱 **Pay via Mobile Money**\n\nDial: *182*7*1# and follow prompts\nAmount: 45,000 RWF\nReference: ${newState.insuranceQuoteId}\n\nType 'paid' when payment is complete.`;
            newState.step = 'ins_payment_pending';
          } else {
            botResponse = "Please select a valid payment plan (1-4).";
          }
          break;

        case 'ins_certificate':
          botResponse = "🏠 **Insurance Active!**\n\n✅ Your moto insurance is now active\n📄 Certificate: [📎 Certificate.pdf]\n📱 Digital copy in app\n\n🚗 **Your Coverage:**\n🛡️ Third-party: Active\n🌍 COMESA: Active\n🩺 PA: Premium level\n\n📞 Claims: Call 3456\n📧 Support: insurance@moverwa.com\n\nWelcome back to main menu!";
          newState.step = 'main_menu';
          break;

        default:
          botResponse = "🚗 **Welcome to MoveRwanda!**\n\nChoose an option:\n1️⃣ Generate QR Code\n2️⃣ Nearby Drivers\n3️⃣ Schedule Trip\n4️⃣ Add Vehicle\n5️⃣ Get Motor Insurance\n6️⃣ More\n\nReply with number (1-6) or option name.";
          newState.step = 'main_menu';
          break;
      }

      if (botResponse) {
        setTimeout(() => {
          addMessage({ type: 'text', content: botResponse, from: 'bot' });
          setConversationState(newState);
        }, 500);
      }

    } catch (error) {
      console.error("Error processing message:", error);
      addMessage({ 
        type: 'text', 
        content: "❌ An error occurred. Please try again or contact support.", 
        from: 'bot' 
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const sendMessage = () => {
    if (inputMessage.trim()) {
      processUserMessage(inputMessage.trim());
      setInputMessage("");
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      processUserMessage(`Uploaded: ${file.name}`, 'image', file);
    }
  };

  const simulateIncomingCall = () => {
    toast.success("📞 Simulated incoming call from driver");
    addMessage({
      type: 'system',
      content: '📞 Incoming call from Driver (0788123456)',
      from: 'bot'
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold gradient-text mb-2">WhatsApp Bot Simulator</h1>
        <p className="text-muted-foreground">Experience the exact WhatsApp interaction flows</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card className="glass-card h-[600px] flex flex-col">
            <CardHeader className="flex-shrink-0 border-b border-border/20">
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Chat with MoveRwanda Bot
                <Badge variant="secondary" className="ml-auto">
                  <Bot className="h-3 w-3 mr-1" />
                  Online
                </Badge>
              </CardTitle>
            </CardHeader>
            
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.from === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg p-3 ${
                        message.from === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : message.type === 'system'
                          ? 'bg-muted/20 text-muted-foreground border border-border/20'
                          : 'bg-muted text-foreground'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {message.from === 'bot' && (
                          <Bot className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        )}
                        {message.from === 'user' && (
                          <User className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        )}
                        <div className="space-y-2">
                          {message.imageUrl && (
                            <img
                              src={message.imageUrl}
                              alt="Uploaded content"
                              className="max-w-[200px] rounded border"
                            />
                          )}
                          <div className="whitespace-pre-wrap text-sm">
                            {message.content}
                          </div>
                          <div className="text-xs opacity-70">
                            {message.timestamp.toLocaleTimeString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {isProcessing && (
                  <div className="flex justify-start">
                    <div className="bg-muted text-foreground rounded-lg p-3 max-w-[80%]">
                      <div className="flex items-center gap-2">
                        <Bot className="h-4 w-4" />
                        <div className="flex space-x-1">
                          <div className="w-2 h-2 bg-current rounded-full animate-bounce"></div>
                          <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                          <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            <div className="flex-shrink-0 p-4 border-t border-border/20">
              <div className="flex gap-2">
                <Input
                  placeholder="Type a message..."
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                  disabled={isProcessing}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isProcessing}
                >
                  <Upload className="h-4 w-4" />
                </Button>
                <Button onClick={sendMessage} disabled={isProcessing || !inputMessage.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf"
                className="hidden"
                onChange={handleFileUpload}
              />
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-lg">Test Controls</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Phone Number</label>
                <Input
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="0788767816"
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Quick Actions</label>
                <div className="grid grid-cols-1 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => processUserMessage("1")}
                  >
                    Generate QR
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => processUserMessage("2")}
                  >
                    Find Drivers
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => processUserMessage("3")}
                  >
                    Schedule Trip
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => processUserMessage("4")}
                  >
                    Add Vehicle
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => processUserMessage("menu")}
                  >
                    Back to Menu
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Simulations</label>
                <div className="grid grid-cols-1 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={simulateIncomingCall}
                  >
                    <Phone className="h-4 w-4 mr-2" />
                    Incoming Call
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-lg">Conversation State</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div><strong>Step:</strong> {conversationState.step}</div>
                {conversationState.userMomo && (
                  <div><strong>MoMo:</strong> {conversationState.userMomo}</div>
                )}
                {conversationState.selectedVehicleType && (
                  <div><strong>Vehicle:</strong> {conversationState.selectedVehicleType}</div>
                )}
                {conversationState.tripRole && (
                  <div><strong>Role:</strong> {conversationState.tripRole}</div>
                )}
                {conversationState.usageType && (
                  <div><strong>Usage:</strong> {conversationState.usageType}</div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}