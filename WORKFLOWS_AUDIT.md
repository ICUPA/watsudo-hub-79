# Workflows Audit Mapping

This document maps each node in the WhatsApp UX workflow spec to its implementation code paths and tests.

| Spec Node ID     | Description                                                | Code Path(s)                                   | Test File(s)                            |
|------------------|------------------------------------------------------------|-------------------------------------------------|-----------------------------------------|
| A0               | Inbound WhatsApp Message entrypoint                        | `src/webhook/whatsapp.ts`                      | `src/webhook/__tests__/whatsapp.test.ts`|
| A1               | Amount Shortcut detection (`^\s*\d+\s*$`)               | `src/router/amountShortcut.ts`                 | `src/router/__tests__/amountShortcut.test.ts`|
| ASHORT           | Amount Shortcut flow (QR default identifier)               | `src/flows/qr/shortcut.ts`                      | `src/flows/qr/__tests__/shortcut.test.ts`|
| A2               | AI Orchestrator intent classification                      | `src/orchestrator/intent.ts`                    | `src/orchestrator/__tests__/intent.test.ts`|
| ARouter          | Router dispatch to tool and UI                             | `src/router/index.ts`                           | `src/router/__tests__/router.test.ts`   |
| AClar            | Clarifying question via WhatsApp List                      | `src/router/clarify.ts`                         | `src/router/__tests__/clarify.test.ts`  |
| HOME             | Main menu display                                          | `src/flows/menu/mainMenu.ts`                    | `src/flows/menu/__tests__/mainMenu.test.ts`|
| MM               | Main Menu options                                          | `src/flows/menu/options.ts`                     |                                         |
| QR               | QR Codes flow entry                                        | `src/flows/qr/index.ts`                         |                                         |
| ID0              | Identifier type selection (Phone vs Code)                  | `src/flows/qr/identifierSelect.ts`              |                                         |
| P1, C1           | Check if Phone/Code stored                                 | `src/storage/userIdentifiers.ts`                |                                         |
| P1a, C1a         | Store new Phone/Code                                       | `src/storage/userIdentifiers.ts`                |                                         |
| A1a, C2a         | Free-text amount entry                                     | `src/flows/qr/amountInput.ts`                   |                                         |
| U1, U1a, U2, U2a | USSD builder functions                                     | `src/utils/ussdBuilder.ts`                      | `src/utils/__tests__/ussdBuilder.test.ts`|
| G                | QR generation & storage pipeline                           | `src/flows/qr/generate.ts`                      | `src/flows/qr/__tests__/generate.test.ts`|
| D                | Send QR image + post-action menu                           | `src/flows/qr/sendQr.ts`                        | `src/flows/qr/__tests__/sendQr.test.ts`|
| ND               | Nearby Drivers flow entry                                   | `src/flows/mobility/nearby.ts`                  |                                         |
| ND1..ND8         | Nearby flow steps                                          | `src/flows/mobility/nearby/*.ts`                |                                         |
| ST               | Schedule Trip flow entry                                   | `src/flows/mobility/schedule.ts`                |                                         |
| ST1..SP3, SD0..SD1 | Schedule sub-flows (passenger & driver)                   | `src/flows/mobility/schedule/*.ts`              |                                         |
| AV               | Add Vehicle flow entry                                     | `src/flows/mobility/addVehicle.ts`              |                                         |
| AV1..AV5         | Add Vehicle sub-flows (OCR pipeline)                       | `src/flows/mobility/addVehicle/*.ts`            |                                         |
| INS              | Insurance flow entry                                       | `src/flows/insurance/index.ts`                   |                                         |
| I1..I13          | Insurance sub-flows                                        | `src/flows/insurance/*.ts`                      |                                         |
| Webhook          | WhatsApp webhook handler                                   | `src/webhook/whatsapp.ts`                       | `src/webhook/__tests__/whatsapp.test.ts`|
| IDs Parser       | Interactive ID parsing                                      | `src/router/interactiveParser.ts`               | `src/router/__tests__/interactiveParser.test.ts`|
| Message Builders | Functions to build button/list templates                   | `src/utils/waBuilders.ts`                       | `src/utils/__tests__/waBuilders.test.ts`|
| Security         | Signature validation & idempotency                         | `src/webhook/security.ts`                       | `src/webhook/__tests__/security.test.ts`|
| Logs             | Structured logging for inbound/outbound                    | `src/logging/whatsappLogs.ts`                   | `src/logging/__tests__/whatsappLogs.test.ts`|

_This mapping will serve as the blueprint for implementation and testing._
