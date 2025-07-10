# 🤖 Simulación de Ataques de Bots

## 🎯 **Tipos de Simulaciones**

### **1. Honeypot Attack Simulation**

#### **Test Manual (Browser)**
```javascript
// 1. Abrir DevTools (F12) en http://localhost:3000
// 2. Ir a Console tab
// 3. Ejecutar este código:

// Hacer visible el campo honeypot
document.querySelector('input[name="website"]').style.display = 'block';
document.querySelector('input[name="website"]').parentElement.style.display = 'block';

// Llenar el campo honeypot
document.querySelector('input[name="website"]').value = 'bot-filled-field';

// Ahora enviar el formulario normalmente
// ✅ Debería mostrar: "Error de validación"
```

#### **Test Automático (JavaScript)**
```javascript
// Ejecutar en Console del browser
const form = document.querySelector('form');
const honeypotField = document.querySelector('input[name="website"]');

// Simular bot llenando honeypot
honeypotField.value = 'I am a bot';

// Enviar formulario
form.dispatchEvent(new Event('submit'));

// ✅ Resultado esperado: "Honeypot field filled - potential bot detected"
```

### **2. Bot Script Simulation**

#### **Crear Script de Bot Simple**
```javascript
// bot-simulator.js
async function simulateBotAttack() {
  const loginData = {
    email: 'test@example.com',
    password: 'password123',
    website: 'I am filling hidden fields' // Honeypot trigger
  };

  try {
    const response = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(loginData)
    });

    console.log('Bot attack result:', await response.json());
  } catch (error) {
    console.error('Bot attack failed:', error);
  }
}

// Ejecutar múltiples ataques
for (let i = 0; i < 5; i++) {
  simulateBotAttack();
}
```

### **3. Selenium Bot Simulation**

#### **Instalar Selenium**
```bash
npm install selenium-webdriver chromedriver
```

#### **Bot con Selenium**
```javascript
// selenium-bot.js
const { Builder, By, until } = require('selenium-webdriver');

async function seleniumBotAttack() {
  const driver = await new Builder().forBrowser('chrome').build();
  
  try {
    await driver.get('http://localhost:3000');
    
    // Llenar formulario como bot (muy rápido)
    await driver.findElement(By.id('email')).sendKeys('bot@example.com');
    await driver.findElement(By.id('password')).sendKeys('password123');
    
    // Intentar llenar honeypot (comportamiento de bot)
    await driver.executeScript(`
      const honeypot = document.querySelector('input[name="website"]');
      if (honeypot) honeypot.value = 'bot-behavior';
    `);
    
    // Enviar formulario
    await driver.findElement(By.css('button[type="submit"]')).click();
    
    // Verificar resultado
    await driver.wait(until.elementLocated(By.css('.bg-red-50')), 5000);
    const errorText = await driver.findElement(By.css('.bg-red-50')).getText();
    console.log('Bot detection result:', errorText);
    
  } finally {
    await driver.quit();
  }
}

seleniumBotAttack();
```

### **4. Puppeteer Bot Simulation**

#### **Instalar Puppeteer**
```bash
npm install puppeteer
```

#### **Bot Más Sofisticado**
```javascript
// puppeteer-bot.js
const puppeteer = require('puppeteer');

async function advancedBotAttack() {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  
  // Simular comportamiento de bot
  await page.setUserAgent('Bot/1.0 (Automated)');
  
  try {
    await page.goto('http://localhost:3000');
    
    // Comportamiento de bot: llenar campos muy rápido
    await page.type('#email', 'bot@test.com', { delay: 10 }); // Muy rápido
    await page.type('#password', 'password123', { delay: 10 });
    
    // Llenar honeypot (comportamiento típico de bot)
    await page.evaluate(() => {
      const honeypot = document.querySelector('input[name="website"]');
      if (honeypot) honeypot.value = 'automated-bot-fill';
    });
    
    // Enviar formulario
    await page.click('button[type="submit"]');
    
    // Esperar respuesta
    await page.waitForSelector('.bg-red-50, .bg-green-50', { timeout: 5000 });
    
    const result = await page.$eval('.bg-red-50, .bg-green-50', el => el.textContent);
    console.log('Bot attack result:', result);
    
  } catch (error) {
    console.error('Bot simulation error:', error);
  } finally {
    await browser.close();
  }
}

advancedBotAttack();
```

### **5. cURL Bot Simulation**

#### **Ataque API Directo**
```bash
# Test 1: Honeypot attack via API
curl -X POST http://localhost:3000/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "website": "bot-filled-field"
  }'

# Test 2: Multiple rapid requests (rate limiting)
for i in {1..10}; do
  curl -X POST http://localhost:3000/api/auth/forgot-password \
    -H "Content-Type: application/json" \
    -d '{"email": "spam@test.com"}' &
done
wait
```

### **6. reCAPTCHA Low Score Simulation**

#### **Forzar Score Bajo**
```javascript
// En DevTools Console
// Override de executeRecaptcha para simular score bajo
window.originalExecuteRecaptcha = window.executeRecaptcha;
window.executeRecaptcha = async (action) => {
  // Simular token que resultará en score bajo
  return 'simulated-low-score-token';
};

// Ahora intentar login - debería fallar por score bajo
```

### **7. Automated Form Filling Attack**

#### **Script de Ataque Masivo**
```javascript
// mass-attack.js
async function massAttack() {
  const emails = [
    'bot1@spam.com',
    'bot2@spam.com', 
    'bot3@spam.com'
  ];
  
  const attacks = emails.map(async (email, index) => {
    // Simular bot llenando honeypot
    const formData = {
      email: email,
      password: 'password123',
      website: `bot-${index}-honeypot-fill` // Trigger honeypot
    };
    
    try {
      const response = await fetch('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Bot/Automated-Attack-1.0'
        },
        body: JSON.stringify(formData)
      });
      
      console.log(`Attack ${index}:`, await response.text());
    } catch (error) {
      console.error(`Attack ${index} failed:`, error);
    }
  });
  
  await Promise.all(attacks);
}

massAttack();
```

## 🧪 **Tests de Validación**

### **Test Suite Completo**
```javascript
// security-test-suite.js
const tests = [
  {
    name: 'Honeypot Detection',
    data: { email: 'test@test.com', website: 'bot-fill' },
    expected: 'Error de validación'
  },
  {
    name: 'Normal User',
    data: { email: 'user@test.com', password: 'password' },
    expected: 'Login attempt'
  },
  {
    name: 'Rapid Fire Attack',
    data: { email: 'spam@test.com' },
    count: 10,
    expected: 'Rate limiting'
  }
];

async function runSecurityTests() {
  for (const test of tests) {
    console.log(`Running: ${test.name}`);
    
    if (test.count) {
      // Test de rate limiting
      const promises = Array(test.count).fill().map(() =>
        fetch('/api/auth/forgot-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(test.data)
        })
      );
      
      const results = await Promise.all(promises);
      console.log(`${test.name}: ${results.length} requests sent`);
    } else {
      // Test individual
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(test.data)
      });
      
      console.log(`${test.name}:`, response.status);
    }
  }
}

runSecurityTests();
```

## 📊 **Resultados Esperados**

### **✅ Detección Exitosa de Honeypot**
```bash
# En terminal del servidor
Honeypot field filled - potential bot detected

# En browser
Error: "Error de validación"
```

### **✅ reCAPTCHA Score Bajo**
```bash
# En terminal del servidor
Low reCAPTCHA score: 0.2 (minimum: 0.5)

# En browser  
Error: "Verificación de seguridad fallida"
```

### **✅ Comportamiento Normal**
```bash
# En terminal del servidor
reCAPTCHA verification successful - Score: 0.8
Login attempt successful
```

## 🛠️ **Herramientas de Testing**

### **1. Browser Extensions**
- **User-Agent Switcher**: Simular bots por User-Agent
- **Form Filler**: Llenar formularios automáticamente
- **Developer Tools**: Manipular campos ocultos

### **2. Automation Tools**
- **Selenium**: Control completo del browser
- **Puppeteer**: Browser headless de Chrome
- **Playwright**: Cross-browser automation

### **3. API Testing**
- **Postman**: Tests de API manuales
- **curl**: Tests de línea de comandos
- **Artillery.io**: Load testing y bot simulation

## 🔬 **Monitoreo de Ataques**

### **Logs a Observar**
```bash
# Terminal del servidor - buscar estos logs:

# ✅ Honeypot activado
Honeypot field filled - potential bot detected

# ✅ reCAPTCHA falló  
reCAPTCHA verification failed
Low reCAPTCHA score: 0.X

# ⚠️ Múltiples requests rápidos
POST /api/auth/* 429 (si hay rate limiting)

# ❌ Errores de validación
Error de validación
Verificación de seguridad fallida
```

## 🎯 **Métricas de Éxito**

### **Honeypot Protection**
- ✅ **100%** de bots detectados que llenan honeypot
- ✅ **0%** de falsos positivos en usuarios reales

### **reCAPTCHA Protection**  
- ✅ **Score > 0.5** para usuarios normales
- ✅ **Score < 0.5** para comportamiento automatizado

### **Overall Security**
- ✅ **Graceful fallback** si reCAPTCHA falla
- ✅ **No blocking** de usuarios legítimos
- ✅ **Clear logging** para monitoreo 