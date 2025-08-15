// Shared WhatsApp utilities for production-ready messaging
// Handles signature verification, idempotency, error handling, and standardized messaging

const GRAPH_API_VERSION = "v21.0";

export interface WAMessage {
  messaging_product: "whatsapp";
  to: string;
  type: "text" | "interactive" | "image" | "document";
  text?: { body: string };
  interactive?: any;
  image?: { link: string; caption?: string };
  document?: { link: string; caption?: string; filename?: string };
}

export interface WALogger {
  log: (level: string, message: string, context?: any) => void;
}

export class WhatsAppClient {
  private phoneId: string;
  private accessToken: string;
  private appSecret: string;
  private supabase: any;
  private logger: WALogger;
  private apiUrl: string;

  constructor(
    phoneId: string,
    accessToken: string,
    appSecret: string,
    supabase: any,
    logger: WALogger
  ) {
    this.phoneId = phoneId;
    this.accessToken = accessToken;
    this.appSecret = appSecret;
    this.supabase = supabase;
    this.logger = logger;
    this.apiUrl = `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneId}/messages`;
  }

  // Robust message sending with retry logic
  async send(payload: WAMessage): Promise<any> {
    const correlationId = crypto.randomUUID();
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.logger.log("info", "Sending WhatsApp message", {
          correlationId,
          attempt,
          to: payload.to,
          type: payload.type
        });

        const response = await fetch(this.apiUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        const responseData = await response.json().catch(() => ({}));

        // Log to database
        await this.supabase.from("whatsapp_logs").insert({
          direction: "out",
          phone_number: payload.to,
          message_type: payload.type,
          payload: payload,
          metadata: responseData,
          status: response.ok ? "sent" : "failed",
        }).catch((err: any) => 
          this.logger.log("error", "Failed to log outbound message", { error: err.message })
        );

        if (!response.ok) {
          const error = new Error(
            `WhatsApp API error ${response.status}: ${JSON.stringify(responseData)}`
          );

          // Don't retry for client errors (4xx)
          if (response.status >= 400 && response.status < 500) {
            this.logger.log("error", "WhatsApp client error - not retrying", {
              status: response.status,
              response: responseData,
              correlationId
            });
            throw error;
          }

          lastError = error;
          this.logger.log("warn", `WhatsApp API error - attempt ${attempt}/${maxRetries}`, {
            status: response.status,
            response: responseData,
            correlationId
          });

          if (attempt < maxRetries) {
            await this.delay(Math.pow(2, attempt) * 1000); // Exponential backoff
            continue;
          }
          throw error;
        }

        this.logger.log("info", "WhatsApp message sent successfully", {
          correlationId,
          messageId: responseData.messages?.[0]?.id,
          attempt
        });

        return responseData;

      } catch (error) {
        lastError = error as Error;
        if (attempt === maxRetries) {
          this.logger.log("error", "Failed to send WhatsApp message after retries", {
            error: error.message,
            correlationId,
            attempts: maxRetries
          });
          throw error;
        }
      }
    }

    throw lastError;
  }

  // Convenience methods for common message types
  async sendText(to: string, body: string): Promise<any> {
    return this.send({
      messaging_product: "whatsapp",
      to: this.normalizeRecipient(to),
      type: "text",
      text: { body }
    });
  }

  async sendButtons(
    to: string,
    body: string,
    buttons: { id: string; title: string }[]
  ): Promise<any> {
    return this.send({
      messaging_product: "whatsapp",
      to: this.normalizeRecipient(to),
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: body },
        action: { buttons: buttons.map(b => ({ type: "reply", reply: b })) }
      }
    });
  }

  async sendList(
    to: string,
    body: string,
    rows: { id: string; title: string; description?: string }[],
    header = "Select",
    sectionTitle = "Options"
  ): Promise<any> {
    return this.send({
      messaging_product: "whatsapp",
      to: this.normalizeRecipient(to),
      type: "interactive",
      interactive: {
        type: "list",
        header: { type: "text", text: header },
        body: { text: body },
        action: { button: "Choose", sections: [{ title: sectionTitle, rows }] }
      }
    });
  }

  async sendImage(to: string, imageUrl: string, caption?: string): Promise<any> {
    return this.send({
      messaging_product: "whatsapp",
      to: this.normalizeRecipient(to),
      type: "image",
      image: { link: imageUrl, caption }
    });
  }

  async sendDocument(
    to: string,
    documentUrl: string,
    caption?: string,
    filename?: string
  ): Promise<any> {
    return this.send({
      messaging_product: "whatsapp",
      to: this.normalizeRecipient(to),
      type: "document",
      document: { link: documentUrl, caption, filename }
    });
  }

  // Webhook signature verification
  async verifySignature(signature: string, body: string): Promise<boolean> {
    if (!signature) return false;

    const [algo, digest] = signature.split("=");
    if (algo !== "sha256" || !digest) return false;

    try {
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(this.appSecret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["verify"]
      );

      const hexBytes = new Uint8Array(digest.length / 2);
      for (let i = 0; i < digest.length; i += 2) {
        hexBytes[i / 2] = parseInt(digest.slice(i, i + 2), 16);
      }

      return await crypto.subtle.verify("HMAC", key, hexBytes, encoder.encode(body));
    } catch (error) {
      this.logger.log("error", "Signature verification failed", { error: error.message });
      return false;
    }
  }

  // Fetch media from WhatsApp
  async fetchMedia(mediaId: string): Promise<{ bytes: Uint8Array; mime: string }> {
    try {
      const metaResponse = await fetch(
        `https://graph.facebook.com/${GRAPH_API_VERSION}/${mediaId}`,
        { headers: { Authorization: `Bearer ${this.accessToken}` } }
      );

      if (!metaResponse.ok) {
        throw new Error(`Failed to fetch media metadata: ${metaResponse.status}`);
      }

      const metadata = await metaResponse.json();
      const fileResponse = await fetch(metadata.url, {
        headers: { Authorization: `Bearer ${this.accessToken}` }
      });

      if (!fileResponse.ok) {
        throw new Error(`Failed to fetch media file: ${fileResponse.status}`);
      }

      return {
        bytes: new Uint8Array(await fileResponse.arrayBuffer()),
        mime: metadata.mime_type ?? "application/octet-stream"
      };
    } catch (error) {
      this.logger.log("error", "Media fetch failed", { mediaId, error: error.message });
      throw error;
    }
  }

  // Check for duplicate message processing
  async checkIdempotency(messageId: string): Promise<boolean> {
    if (!messageId) return false;

    try {
      const { data } = await this.supabase
        .from("whatsapp_logs")
        .select("id")
        .eq("message_id", messageId)
        .eq("direction", "in")
        .limit(1);

      return (data?.length || 0) > 0;
    } catch (error) {
      this.logger.log("error", "Idempotency check failed", { messageId, error: error.message });
      return false;
    }
  }

  private normalizeRecipient(to: string): string {
    // Remove + prefix for WhatsApp API
    return to.replace(/^\+/, "");
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Phone number normalization utilities
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  if (digits.startsWith("07")) return `+250${digits.slice(1)}`;
  if (digits.startsWith("2507")) return `+${digits}`;
  return digits;
}

// USSD utilities
export function buildUSSD(type: "phone" | "code", identifier: string, amount?: number): string {
  if (type === "phone") {
    const local = identifier.startsWith("+250") ? `0${identifier.slice(4)}` : identifier.replace(/^\+/, '');
    return amount ? `*182*1*1*${local}*${amount}#` : `*182*1*1*${local}#`;
  } else {
    return amount ? `*182*8*1*${identifier}*${amount}#` : `*182*8*1*${identifier}#`;
  }
}

export function buildTelLink(ussd: string): string {
  // Encode # as %23 for tel: links, keep * literal
  return `tel:${encodeURIComponent(ussd).replace(/%2A/g, "*")}`;
}

// State machine utilities
export function getInteractiveId(message: any): string | undefined {
  if (message?.type !== "interactive") return undefined;
  const interactive = message.interactive;
  if (interactive?.type === "button_reply") return interactive.button_reply?.id;
  if (interactive?.type === "list_reply") return interactive.list_reply?.id;
  return undefined;
}

// Valid flow IDs for validation
export const VALID_FLOW_IDS = [
  // Main menu
  "MOBILITY", "INSURANCE", "QR", "PROFILE", "HOME",
  // Mobility
  "ND", "ST", "AV",
  // QR
  "QR_PHONE", "QR_CODE", "QR_AMT_WITH", "QR_AMT_NONE",
  "QR_A_1000", "QR_A_2000", "QR_A_5000", "QR_A_OTHER",
  "QR_AGAIN", "QR_CHANGE_DEFAULT",
  // Insurance
  "START_TODAY", "START_PICK", "SUM_CONTINUE", "CANCEL",
  "PROCEED", "ASK_CHANGES", "PAID", "REMIND_ME"
] as const;

export function isValidFlowId(id: string): boolean {
  return VALID_FLOW_IDS.includes(id as any) ||
    id.startsWith("ND_V_") ||
    id.startsWith("AV_U_") ||
    id.startsWith("PERIOD_") ||
    id.startsWith("ADDON_") ||
    id.startsWith("PA_") ||
    id.startsWith("PLAN_");
}
