// QR Code generation utility
export const generateQRCode = async (data: string): Promise<string> => {
  // Using QR Server API as placeholder - in production this would be handled by Supabase Edge Function
  const size = "300x300";
  const url = `https://api.qrserver.com/v1/create-qr-code/?size=${size}&data=${encodeURIComponent(data)}`;
  
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  } catch (error) {
    console.error("QR generation failed:", error);
    throw new Error("Failed to generate QR code");
  }
};

export interface QRCodeData {
  type: "phone" | "code";
  identifier: string;
  amount?: number;
  ussd: string;
  telLink: string;
}

export const createQRCodeData = (
  type: "phone" | "code",
  identifier: string,
  amount?: number
): QRCodeData => {
  // Normalize phone number to local format (remove +250 if present)
  const localNumber = identifier.startsWith("+250") ? `0${identifier.slice(4)}` : identifier;
  
  const ussd = type === "phone"
    ? amount 
      ? `*182*1*1*${localNumber}*${amount}#`
      : `*182*1*1*${localNumber}#`
    : amount
      ? `*182*8*1*${identifier}*${amount}#`
      : `*182*8*1*${identifier}#`;
  
  // Create tel: link for USSD launcher - replace # with %23 for QR codes
  const telLink = `tel:${ussd.replace(/#/g, '%23')}`;
  
  return {
    type,
    identifier: localNumber, // Always store as local number
    amount,
    ussd,
    telLink // Now contains proper tel: link with %23 encoding
  };
};