# 🔍 Guía de Verificación reCAPTCHA

## 🚀 **Pasos de Verificación**

### **Paso 1: Verificar Carga en Browser**

1. **Abrir DevTools** (F12)
2. **Ir a Network tab**
3. **Refrescar página** (F5)
4. **Buscar "recaptcha"** en los requests

**✅ Si funciona verás:**
```
🌐 https://www.google.com/recaptcha/api.js?...
🌐 https://www.google.com/recaptcha/api2/...
```

**❌ Si NO funciona:**
- No aparecen requests de recaptcha
- Console error: "reCAPTCHA not available"

### **Paso 2: Verificar Console Logs**

**Abre Console (F12 > Console) y busca:**

#### **✅ Mensajes de éxito:**
```javascript
reCAPTCHA verification successful - Score: 0.8
```

#### **⚠️ Mensajes de advertencia:**
```javascript
reCAPTCHA not available
```

#### **❌ Mensajes de error:**
```javascript
reCAPTCHA verification failed: { error: "..." }
Low reCAPTCHA score: 0.3 (minimum: 0.5)
```

### **Paso 3: Verificar Variables de Entorno**

**Crear/editar `.env.local`:**
```env
# Obtener en: https://www.google.com/recaptcha/admin/create
NEXT_PUBLIC_RECAPTCHA_SITE_KEY=6LeXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
RECAPTCHA_SECRET_KEY=6LeXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

**⚠️ IMPORTANTE:** Reiniciar servidor después de agregar variables:
```bash
# Ctrl+C para parar
pnpm run dev  # Reiniciar
```

### **Paso 4: Test Manual del Login**

1. **Ir a** `http://localhost:3000`
2. **Llenar formulario** con credenciales válidas
3. **Enviar formulario**
4. **Revisar logs en terminal**

#### **✅ Con reCAPTCHA funcionando:**
```bash
# En terminal del servidor
reCAPTCHA verification successful - Score: 0.9
POST /api/auth/verify-recaptcha 200
```

#### **⚠️ Sin reCAPTCHA configurado:**
```bash
# En browser console
reCAPTCHA not available
# Pero el login sigue funcionando (graceful fallback)
```

### **Paso 5: Test de Honeypot**

**Para probar honeypot (campo anti-bot):**

1. **Abrir DevTools > Elements**
2. **Buscar campo oculto:**
   ```html
   <div style="display: none">
     <input id="website" name="website" type="text" value="">
   </div>
   ```
3. **Cambiar style a** `display: block`
4. **Llenar el campo que ahora es visible**
5. **Enviar formulario**

#### **✅ Honeypot funcionando:**
```bash
# En terminal
Honeypot field filled - potential bot detected
# Error: "Error de validación"
```

## 🛠️ **Configuración de reCAPTCHA**

### **Obtener Claves:**

1. **Ir a:** [Google reCAPTCHA Admin](https://www.google.com/recaptcha/admin/create)

2. **Configuración:**
   - **Label:** AQ FastSign Demo
   - **Type:** reCAPTCHA v3
   - **Domains:** 
     ```
     localhost
     127.0.0.1
     tu-dominio-produccion.com
     ```

3. **Copiar claves** a `.env.local`

### **Estructura de .env.local:**
```env
# Supabase (existentes)
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# Resend (existente)
RESEND_API_KEY=...

# reCAPTCHA (nuevo)
NEXT_PUBLIC_RECAPTCHA_SITE_KEY=6Le...
RECAPTCHA_SECRET_KEY=6Le...

# URL base
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

## 🧪 **Tests de Verificación**

### **Test 1: Verificación Básica**
```bash
# 1. Abrir http://localhost:3000
# 2. F12 > Network
# 3. Buscar "recaptcha" en requests
# 4. ¿Aparecen? ✅ Configurado correctamente
```

### **Test 2: Score Verification**
```bash
# 1. Llenar login form normalmente
# 2. Enviar
# 3. Revisar terminal logs:
#    "reCAPTCHA verification successful - Score: 0.X"
```

### **Test 3: API Endpoint**

**Test directo del endpoint:**
```bash
# Con curl o Postman
POST http://localhost:3000/api/auth/verify-recaptcha
Content-Type: application/json

{
  "token": "test-token",
  "action": "login"
}

# Sin reCAPTCHA configurado: error 500
# Con reCAPTCHA: validación real
```

### **Test 4: Comportamiento sin reCAPTCHA**
```bash
# 1. Remover claves de .env.local
# 2. Reiniciar servidor
# 3. Probar login
# 4. Debería funcionar con warning en console
```

## 🚨 **Troubleshooting**

### **Problema: reCAPTCHA no carga**
```bash
# Verificar:
1. ✅ NEXT_PUBLIC_RECAPTCHA_SITE_KEY en .env.local
2. ✅ Dominio localhost en configuración Google
3. ✅ Servidor reiniciado después de .env.local
4. ✅ No hay errores en console
```

### **Problema: Score muy bajo**
```bash
# Posibles causas:
- Bot behavior detection
- VPN/proxy usage
- Automated testing tools
- Ajustar threshold en /api/auth/verify-recaptcha/route.ts
```

### **Problema: "not a function" errors**
```bash
# Verificar:
1. ✅ react-google-recaptcha-v3 instalado
2. ✅ Provider en layout.tsx
3. ✅ useGoogleReCaptcha hook usado correctamente
```

## 📊 **Monitoreo en Producción**

### **Logs importantes:**
```bash
# ✅ Éxito
reCAPTCHA verification successful - Score: 0.8

# ⚠️ Advertencias
reCAPTCHA not available
Low reCAPTCHA score: 0.3

# 🤖 Bot detectado
Honeypot field filled - potential bot detected

# ❌ Errores
reCAPTCHA verification failed
```

### **Métricas a trackear:**
- **Distribution de scores** (0.0-1.0)
- **Honeypot activations** (intentos de bots)
- **Verification failures** (problemas de configuración)
- **False positives** (usuarios legítimos bloqueados)

## 🎯 **Estado Actual**

**Con configuración mínima (sin reCAPTCHA):**
- ✅ Honeypot funcionando
- ✅ Login funcional con fallback
- ⚠️ Warning en console

**Con reCAPTCHA configurado:**
- ✅ Verificación invisible
- ✅ Score-based validation
- ✅ Full security protection 