#!/usr/bin/env node

/**
 * WhatsApp Webhook Test Script
 * Tests various message types and validates webhook responses
 */

const crypto = require('crypto');

// Configuration - Update these values
const WEBHOOK_URL = 'https://your-project.supabase.co/functions/v1/whatsapp';
const APP_SECRET = 'your-app-secret'; // Replace with actual app secret
const VERIFY_TOKEN = 'your-verify-token'; // Replace with actual verify token

// Test fixtures
const testFixtures = {
  // Text message test
  textMessage: {
    object: "whatsapp_business_account",
    entry: [{
      id: "test_waba_id",
      changes: [{
        value: {
          messaging_product: "whatsapp",
          metadata: {
            display_phone_number: "+250700000000",
            phone_number_id: "test_phone_id"
          },
          contacts: [{
            profile: {
              name: "Test User"
            },
            wa_id: "250700000000"
          }],
          messages: [{
            id: "test_msg_001",
            from: "250700000000",
            timestamp: "1703123456",
            type: "text",
            text: {
              body: "hello"
            }
          }]
        },
        field: "messages"
      }]
    }]
  },

  // Interactive button test
  buttonMessage: {
    object: "whatsapp_business_account",
    entry: [{
      id: "test_waba_id",
      changes: [{
        value: {
          messaging_product: "whatsapp",
          metadata: {
            display_phone_number: "+250700000000",
            phone_number_id: "test_phone_id"
          },
          contacts: [{
            profile: {
              name: "Test User"
            },
            wa_id: "250700000000"
          }],
          messages: [{
            id: "test_msg_002",
            from: "250700000000",
            timestamp: "1703123456",
            type: "interactive",
            interactive: {
              type: "button_reply",
              button_reply: {
                id: "MOBILITY",
                title: "🚕 Mobility"
              }
            }
          }]
        },
        field: "messages"
      }]
    }]
  },

  // Interactive list test
  listMessage: {
    object: "whatsapp_business_account",
    entry: [{
      id: "test_waba_id",
      changes: [{
        value: {
          messaging_product: "whatsapp",
          metadata: {
            display_phone_number: "+250700000000",
            phone_number_id: "test_phone_id"
          },
          contacts: [{
            profile: {
              name: "Test User"
            },
            wa_id: "250700000000"
          }],
          messages: [{
            id: "test_msg_003",
            from: "250700000000",
            timestamp: "1703123456",
            type: "interactive",
            interactive: {
              type: "list_reply",
              list_reply: {
                id: "ND_V_MOTO",
                title: "Moto Taxi",
                description: "Motorcycle taxi service"
              }
            }
          }]
        },
        field: "messages"
      }]
    }]
  },

  // Image message test
  imageMessage: {
    object: "whatsapp_business_account",
    entry: [{
      id: "test_waba_id",
      changes: [{
        value: {
          messaging_product: "whatsapp",
          metadata: {
            display_phone_number: "+250700000000",
            phone_number_id: "test_phone_id"
          },
          contacts: [{
            profile: {
              name: "Test User"
            },
            wa_id: "250700000000"
          }],
          messages: [{
            id: "test_msg_004",
            from: "250700000000",
            timestamp: "1703123456",
            type: "image",
            image: {
              id: "test_media_id",
              mime_type: "image/jpeg",
              sha256: "test_hash",
              caption: "Test vehicle document"
            }
          }]
        },
        field: "messages"
      }]
    }]
  },

  // Location message test
  locationMessage: {
    object: "whatsapp_business_account",
    entry: [{
      id: "test_waba_id",
      changes: [{
        value: {
          messaging_product: "whatsapp",
          metadata: {
            display_phone_number: "+250700000000",
            phone_number_id: "test_phone_id"
          },
          contacts: [{
            profile: {
              name: "Test User"
            },
            wa_id: "250700000000"
          }],
          messages: [{
            id: "test_msg_005",
            from: "250700000000",
            timestamp: "1703123456",
            type: "location",
            location: {
              latitude: -1.9441,
              longitude: 30.0619,
              name: "Kigali, Rwanda",
              address: "Kigali, Rwanda"
            }
          }]
        },
        field: "messages"
      }]
    }]
  }
};

// Generate HMAC signature for webhook verification
function generateSignature(payload, appSecret) {
  const hmac = crypto.createHmac('sha256', appSecret);
  hmac.update(JSON.stringify(payload));
  return `sha256=${hmac.digest('hex')}`;
}

// Test webhook health endpoint
async function testHealth() {
  console.log('🔍 Testing webhook health endpoint...');
  
  try {
    const response = await fetch(`${WEBHOOK_URL}/health`);
    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Health check passed:', data);
      return true;
    } else {
      console.log('❌ Health check failed:', response.status, data);
      return false;
    }
  } catch (error) {
    console.log('❌ Health check error:', error.message);
    return false;
  }
}

// Test webhook verification
async function testVerification() {
  console.log('🔍 Testing webhook verification...');
  
  try {
    const challenge = 'test_challenge_123';
    const url = `${WEBHOOK_URL}?hub.mode=subscribe&hub.verify_token=${VERIFY_TOKEN}&hub.challenge=${challenge}`;
    
    const response = await fetch(url);
    const data = await response.text();
    
    if (response.ok && data === challenge) {
      console.log('✅ Webhook verification passed');
      return true;
    } else {
      console.log('❌ Webhook verification failed:', response.status, data);
      return false;
    }
  } catch (error) {
    console.log('❌ Webhook verification error:', error.message);
    return false;
  }
}

// Test message processing
async function testMessageProcessing(fixtureName, payload) {
  console.log(`🔍 Testing ${fixtureName}...`);
  
  try {
    const signature = generateSignature(payload, APP_SECRET);
    
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': signature
      },
      body: JSON.stringify(payload)
    });
    
    const data = await response.text();
    
    if (response.ok) {
      console.log(`✅ ${fixtureName} processed successfully:`, data);
      return true;
    } else {
      console.log(`❌ ${fixtureName} failed:`, response.status, data);
      return false;
    }
  } catch (error) {
    console.log(`❌ ${fixtureName} error:`, error.message);
    return false;
  }
}

// Test OCR worker endpoint
async function testOCRWorker() {
  console.log('🔍 Testing OCR worker endpoint...');
  
  try {
    const response = await fetch(`${WEBHOOK_URL.replace('/whatsapp', '/ocr_worker')}`);
    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ OCR worker accessible:', data);
      return true;
    } else {
      console.log('❌ OCR worker failed:', response.status, data);
      return false;
    }
  } catch (error) {
    console.log('❌ OCR worker error:', error.message);
    return false;
  }
}

// Run all tests
async function runTests() {
  console.log('🚀 Starting WhatsApp Webhook Tests\n');
  
  const results = {
    health: false,
    verification: false,
    textMessage: false,
    buttonMessage: false,
    listMessage: false,
    imageMessage: false,
    locationMessage: false,
    ocrWorker: false
  };
  
  // Test health endpoint
  results.health = await testHealth();
  console.log('');
  
  // Test webhook verification
  results.verification = await testVerification();
  console.log('');
  
  // Test message processing
  results.textMessage = await testMessageProcessing('Text Message', testFixtures.textMessage);
  console.log('');
  
  results.buttonMessage = await testMessageProcessing('Button Message', testFixtures.buttonMessage);
  console.log('');
  
  results.listMessage = await testMessageProcessing('List Message', testFixtures.listMessage);
  console.log('');
  
  results.imageMessage = await testMessageProcessing('Image Message', testFixtures.imageMessage);
  console.log('');
  
  results.locationMessage = await testMessageProcessing('Location Message', testFixtures.locationMessage);
  console.log('');
  
  // Test OCR worker
  results.ocrWorker = await testOCRWorker();
  console.log('');
  
  // Summary
  console.log('📊 Test Results Summary:');
  console.log('========================');
  Object.entries(results).forEach(([test, passed]) => {
    const status = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} ${test}`);
  });
  
  const passedCount = Object.values(results).filter(Boolean).length;
  const totalCount = Object.keys(results).length;
  
  console.log(`\n🎯 Overall: ${passedCount}/${totalCount} tests passed`);
  
  if (passedCount === totalCount) {
    console.log('🎉 All tests passed! Webhook is working correctly.');
  } else {
    console.log('⚠️  Some tests failed. Check the webhook implementation.');
  }
  
  return results;
}

// CLI usage
if (require.main === module) {
  // Check if required environment variables are set
  if (WEBHOOK_URL.includes('your-project') || APP_SECRET === 'your-app-secret' || VERIFY_TOKEN === 'your-verify-token') {
    console.log('❌ Please update the configuration variables in this script:');
    console.log('   - WEBHOOK_URL: Your actual Supabase function URL');
    console.log('   - APP_SECRET: Your actual WhatsApp app secret');
    console.log('   - VERIFY_TOKEN: Your actual webhook verify token');
    console.log('\nExample:');
    console.log('   WEBHOOK_URL = "https://abc123.supabase.co/functions/v1/whatsapp"');
    console.log('   APP_SECRET = "abc123def456..."');
    console.log('   VERIFY_TOKEN = "my_verify_token"');
    process.exit(1);
  }
  
  runTests().catch(console.error);
}

module.exports = {
  testFixtures,
  generateSignature,
  testHealth,
  testVerification,
  testMessageProcessing,
  testOCRWorker,
  runTests
};
