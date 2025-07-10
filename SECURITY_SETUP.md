# Configuración de Seguridad - AQ FastSign Demo

## 🔒 Medidas de Seguridad Implementadas

### 1. **Honeypot Protection**
- ✅ **Implementado** en formularios de login y forgot-password
- Campo oculto que detecta bots automáticos
- Los bots llenan todos los campos, incluyendo los ocultos
- Los usuarios humanos no ven ni llenan estos campos

### 2. **Google reCAPTCHA v3**
- ✅ **Implementado** con verificación invisible
- Análiza el comportamiento del usuario en tiempo real
- Puntaje de 0.0 (bot) a 1.0 (humano)
- Umbral configurado en 0.5 (ajustable)

## 🚀 Configuración de reCAPTCHA

### Paso 1: Obtener Claves de Google reCAPTCHA

1. Visita [Google reCAPTCHA Admin](https://www.google.com/recaptcha/admin/create)
2. Crea un nuevo sitio con estas configuraciones:
   - **Label**: AQ FastSign Demo
   - **reCAPTCHA type**: reCAPTCHA v3
   - **Domains**: 
     - `localhost` (para desarrollo)
     - `yourdomain.com` (para producción)

3. Obten las claves:
   - **Site Key** (pública)
   - **Secret Key** (privada)

### Paso 2: Configurar Variables de Entorno

Añade estas variables a tu archivo `.env.local`:

```env
# Google reCAPTCHA v3 Configuration
NEXT_PUBLIC_RECAPTCHA_SITE_KEY=tu_site_key_aqui
RECAPTCHA_SECRET_KEY=tu_secret_key_aqui
```

### Paso 3: Variables de Entorno Existentes

Asegúrate de tener estas variables configuradas:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=tu_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key

# Resend (para emails)
RESEND_API_KEY=tu_resend_api_key

# Aplicación
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

## 🛡️ Características de Seguridad

### Login Form Protection
- **Honeypot**: Campo "website" oculto
- **reCAPTCHA v3**: Verificación invisible con acción "login"
- **Validación**: Puntaje mínimo 0.5
- **Fallback**: Si reCAPTCHA falla, permite el login (evita bloqueo de usuarios legítimos)

### Forgot Password Protection
- **Honeypot**: Campo "website-field" oculto
- **reCAPTCHA v3**: Verificación invisible con acción "forgot_password"
- **Rate limiting**: Protección contra spam de emails
- **No user enumeration**: No revela si el email existe

### reCAPTCHA Verification API
- **Endpoint**: `/api/auth/verify-recaptcha`
- **Verificación server-side** con Google
- **Validación de puntaje** y acción
- **Logging** para monitoreo

## 🧪 Testing

### Desarrollo Sin reCAPTCHA
Si no tienes reCAPTCHA configurado:
- La aplicación funcionará normalmente
- Se mostrará warning en consola
- Honeypot seguirá funcionando

### Testing reCAPTCHA
```bash
# Verificar que reCAPTCHA se carga
# Abrir DevTools > Network > buscar "recaptcha"

# Logs de verificación en server
# Buscar en terminal: "reCAPTCHA verification successful"
```

## 🚨 Solución de Problemas

### reCAPTCHA no se carga
1. Verificar `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` en `.env.local`
2. Verificar dominio en configuración de Google
3. Revisar errores en DevTools

### Verificación falla
1. Verificar `RECAPTCHA_SECRET_KEY` en `.env.local`
2. Verificar conexión a Google APIs
3. Ajustar umbral de puntaje si necesario

### Honeypot activado
1. Verificar que no hay auto-fill de formularios
2. Limpiar datos de navegador
3. Revisar extensiones que puedan llenar campos

## 📊 Monitoreo

### Logs a Revisar
```
# reCAPTCHA exitoso
reCAPTCHA verification successful - Score: 0.8

# Honeypot detectado
Honeypot field filled - potential bot detected

# reCAPTCHA fallido
Low reCAPTCHA score: 0.3 (minimum: 0.5)
```

### Métricas Importantes
- **Puntajes reCAPTCHA**: Monitear distribución
- **Activaciones Honeypot**: Detectar intentos de bots
- **Fallos de verificación**: Ajustar umbrales si necesario

## 🔧 Configuración Avanzada

### Ajustar Umbral reCAPTCHA
En `/api/auth/verify-recaptcha/route.ts`:
```typescript
const minScore = 0.5 // Cambiar según necesidad
// 0.0-0.3: Muy probable bot
// 0.4-0.6: Sospechoso
// 0.7-1.0: Muy probable humano
```

### Personalizar Acciones
- **login**: Para formulario de login
- **forgot_password**: Para reset de password
- **signup**: Para registro (si se implementa)

## 🌐 Producción

### Checklist Pre-Deploy
- [ ] Variables de entorno configuradas
- [ ] Dominio agregado a reCAPTCHA
- [ ] HTTPS habilitado
- [ ] Rate limiting configurado
- [ ] Logs de seguridad habilitados

### Monitoreo Continuo
- Revisar logs de seguridad regularmente
- Ajustar umbrales según patrones de tráfico
- Actualizar lista de dominios en reCAPTCHA 