/**
 * 🤖 Script de Test de Seguridad - Bot Attack Simulation
 * 
 * Ejecutar con: node test-bot-attack.js
 */

const fetch = require('node-fetch');

async function testHoneypotAttack() {
  console.log('🤖 Iniciando simulación de ataque de bot...\n');

  // Test 1: Ataque normal de honeypot
  console.log('📋 Test 1: Honeypot Attack');
  try {
    const response = await fetch('http://localhost:3000/api/auth/forgot-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'BotAttacker/1.0 (Automated)'
      },
      body: JSON.stringify({
        email: 'bot@test.com',
        'website-field': 'I am a bot filling hidden fields' // Honeypot trigger
      })
    });

    const result = await response.text();
    console.log('📊 Status:', response.status);
    console.log('📋 Response:', result);
    console.log('✅ Expected: Error por honeypot\n');
  } catch (error) {
    console.error('❌ Test 1 Failed:', error.message);
  }

  // Test 2: Usuario normal (sin honeypot)
  console.log('👤 Test 2: Normal User');
  try {
    const response = await fetch('http://localhost:3000/api/auth/forgot-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Normal User)'
      },
      body: JSON.stringify({
        email: 'normal@test.com'
        // Sin honeypot field
      })
    });

    const result = await response.text();
    console.log('📊 Status:', response.status);
    console.log('📋 Response:', result.substring(0, 100) + '...');
    console.log('✅ Expected: Email enviado correctamente\n');
  } catch (error) {
    console.error('❌ Test 2 Failed:', error.message);
  }

  // Test 3: Ataque masivo (rate limiting test)
  console.log('🔥 Test 3: Mass Attack (Rate Limiting)');
  const attacks = [];
  
  for (let i = 0; i < 5; i++) {
    attacks.push(
      fetch('http://localhost:3000/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': `BotSpammer-${i}/1.0`
        },
        body: JSON.stringify({
          email: `spam${i}@bot.com`,
          'website-field': `bot-attack-${i}` // Honeypot
        })
      })
    );
  }

  try {
    const responses = await Promise.all(attacks);
    console.log('📊 Attacks sent:', responses.length);
    console.log('📊 Status codes:', responses.map(r => r.status));
    console.log('✅ Expected: Multiple 400 errors (honeypot detection)\n');
  } catch (error) {
    console.error('❌ Test 3 Failed:', error.message);
  }

  console.log('🏁 Tests completed! Check server logs for security messages.');
}

// Ejecutar tests
testHoneypotAttack().catch(console.error); 