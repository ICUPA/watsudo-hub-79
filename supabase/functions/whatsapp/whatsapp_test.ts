# Unit Tests for WhatsApp Utilities

import { assertEquals, assertThrows } from "https://deno.land/std@0.223.0/assert/mod.ts";
import { normalizePhone, buildUSSD, buildTelLink, isValidFlowId, WhatsAppClient } from "../_shared/wa.ts";

Deno.test("Phone normalization tests", async (t) => {
  await t.step("should normalize Rwanda numbers correctly", () => {
    assertEquals(normalizePhone("0788123456"), "+250788123456");
    assertEquals(normalizePhone("25078812345"), "+25078812345");
    assertEquals(normalizePhone("+250788123456"), "+250788123456");
  });

  await t.step("should handle international numbers", () => {
    assertEquals(normalizePhone("+1234567890"), "+1234567890");
    assertEquals(normalizePhone("1234567890"), "1234567890");
  });

  await t.step("should clean non-digit characters", () => {
    assertEquals(normalizePhone("078-812-3456"), "+250788123456");
    assertEquals(normalizePhone("(078) 812 3456"), "+250788123456");
  });
});

Deno.test("USSD building tests", async (t) => {
  await t.step("should build phone USSD correctly", () => {
    assertEquals(buildUSSD("phone", "+250788123456"), "*182*1*1*0788123456#");
    assertEquals(buildUSSD("phone", "0788123456"), "*182*1*1*0788123456#");
    assertEquals(buildUSSD("phone", "+250788123456", 1000), "*182*1*1*0788123456*1000#");
  });

  await t.step("should build code USSD correctly", () => {
    assertEquals(buildUSSD("code", "12345"), "*182*8*1*12345#");
    assertEquals(buildUSSD("code", "12345", 2000), "*182*8*1*12345*2000#");
  });
});

Deno.test("Tel link building tests", async (t) => {
  await t.step("should encode hash correctly", () => {
    const ussd = "*182*1*1*0788123456#";
    const telLink = buildTelLink(ussd);
    assertEquals(telLink, "tel:*182*1*1*0788123456%23");
  });

  await t.step("should preserve asterisks", () => {
    const ussd = "*182*8*1*12345*1000#";
    const telLink = buildTelLink(ussd);
    assertEquals(telLink, "tel:*182*8*1*12345*1000%23");
  });
});

Deno.test("Flow ID validation tests", async (t) => {
  await t.step("should validate main menu IDs", () => {
    assertEquals(isValidFlowId("MOBILITY"), true);
    assertEquals(isValidFlowId("INSURANCE"), true);
    assertEquals(isValidFlowId("QR"), true);
    assertEquals(isValidFlowId("PROFILE"), true);
    assertEquals(isValidFlowId("HOME"), true);
  });

  await t.step("should validate dynamic IDs", () => {
    assertEquals(isValidFlowId("ND_V_moto"), true);
    assertEquals(isValidFlowId("AV_U_cab"), true);
    assertEquals(isValidFlowId("PERIOD_12345"), true);
    assertEquals(isValidFlowId("ADDON_67890"), true);
    assertEquals(isValidFlowId("PA_abcdef"), true);
    assertEquals(isValidFlowId("PLAN_xyz"), true);
  });

  await t.step("should reject invalid IDs", () => {
    assertEquals(isValidFlowId("INVALID"), false);
    assertEquals(isValidFlowId("RANDOM_ID"), false);
    assertEquals(isValidFlowId(""), false);
  });
});

Deno.test("Signature verification tests", async (t) => {
  const secret = "test_secret";
  const body = "test_payload";
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
  const sigBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  const hex = Array.from(new Uint8Array(sigBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const header = `sha256=${hex}`;
  const client = new WhatsAppClient("id", "token", secret, {} as any, { log: () => {} });
  await t.step("valid signature returns true", async () => {
    assertEquals(await client.verifySignature(header, body), true);
  });
  await t.step("invalid signature returns false", async () => {
    assertEquals(await client.verifySignature("sha256=00", body), false);
    assertEquals(await client.verifySignature("", body), false);
  });
});
