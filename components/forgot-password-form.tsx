"use client"

import React, { useState } from "react"
import { Mail, ArrowRight, CheckCircle } from "lucide-react"
import { useGoogleReCaptcha } from "react-google-recaptcha-v3"

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("")
  const [honeypot, setHoneypot] = useState("") // Honeypot field
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const { executeRecaptcha } = useGoogleReCaptcha()

  const verifyRecaptcha = async (action: string): Promise<boolean> => {
    if (!executeRecaptcha) {
      console.warn("reCAPTCHA not available")
      return true // Allow action if reCAPTCHA is not configured
    }

    try {
      const token = await executeRecaptcha(action)
      
      const response = await fetch("/api/auth/verify-recaptcha", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token, action }),
      })

      const result = await response.json()
      
      if (!result.success) {
        console.warn("reCAPTCHA verification failed:", result)
        return false
      }

      console.log(`reCAPTCHA verification successful - Score: ${result.score}`)
      return true
    } catch (error) {
      console.error("reCAPTCHA verification error:", error)
      return true // Allow action on reCAPTCHA error to avoid blocking legitimate users
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setMessage(null)
    setLoading(true)

    // Honeypot check - if filled, it's likely a bot
    if (honeypot) {
      console.warn("Honeypot field filled - potential bot detected")
      setError("Error de validación")
      setLoading(false)
      return
    }

    // Verify reCAPTCHA
    const recaptchaValid = await verifyRecaptcha("forgot_password")
    if (!recaptchaValid) {
      setError("Verificación de seguridad fallida. Por favor, inténtelo de nuevo.")
      setLoading(false)
      return
    }

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || "Ocurrió un error inesperado")
        return
      }

      setMessage(data.message)
      setSubmitted(true)
    } catch (err) {
      console.error("Forgot password error:", err)
      setError("Ocurrió un error de conexión. Por favor, inténtelo de nuevo.")
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="text-center space-y-6">
        <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center">
          <CheckCircle className="w-8 h-8 text-green-600" />
        </div>
        
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            ¡Correo enviado!
          </h3>
          <p className="text-gray-600 mb-4">
            {message}
          </p>
          <p className="text-sm text-gray-500">
            Por favor, revise su bandeja de entrada y carpeta de spam. El enlace expirará en 1 hora.
          </p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            <strong>¿No recibió el correo?</strong>
          </p>
          <ul className="text-xs text-blue-700 mt-2 space-y-1">
            <li>• Verifique su carpeta de spam o correo no deseado</li>
            <li>• Asegúrese de haber ingresado el correo correcto</li>
            <li>• Puede intentar nuevamente en unos minutos</li>
          </ul>
        </div>

        <button
          onClick={() => {
            setSubmitted(false)
            setEmail("")
            setHoneypot("")
            setMessage(null)
            setError(null)
          }}
          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
        >
          Intentar con otro correo
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                Error
              </h3>
              <div className="mt-2 text-sm text-red-700">
                {error}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Honeypot field - hidden from users but visible to bots */}
      <div style={{ display: "none" }}>
        <label htmlFor="website-field">
          Leave this empty
        </label>
        <input
          id="website-field"
          name="website-field"
          type="text"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
          autoComplete="off"
          tabIndex={-1}
        />
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
          Correo Electrónico
        </label>
        <div className="relative">
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-4 py-3 border border-gray-300 rounded-lg pl-11 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="correo@ejemplo.com"
            disabled={loading}
          />
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Mail className="h-5 w-5 text-gray-400" />
          </div>
        </div>
        <p className="mt-2 text-xs text-gray-500">
          Ingrese la dirección de correo electrónico asociada con su cuenta
        </p>
      </div>

      <button
        type="submit"
        disabled={loading || !email.trim()}
        className="w-full bg-[#0d2340] text-white py-3 px-4 rounded-lg hover:bg-[#1a3a5f] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
      >
        {loading ? (
          <>
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            <span>Enviando...</span>
          </>
        ) : (
          <>
            <span>Enviar enlace de restablecimiento</span>
            <ArrowRight className="h-4 w-4" />
          </>
        )}
      </button>

      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h4 className="text-sm font-medium text-gray-900 mb-2">Instrucciones:</h4>
        <ul className="text-xs text-gray-600 space-y-1">
          <li>• Ingrese el correo electrónico asociado con su cuenta</li>
          <li>• Recibirá un enlace de restablecimiento en su bandeja de entrada</li>
          <li>• El enlace será válido por 1 hora por motivos de seguridad</li>
          <li>• Si no encuentra el correo, revise su carpeta de spam</li>
        </ul>
      </div>

      <div className="mt-4 text-center">
        <p className="text-xs text-gray-500">
          Este sitio está protegido por reCAPTCHA y se aplican la{" "}
          <a
            href="https://policies.google.com/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            Política de Privacidad
          </a>{" "}
          y los{" "}
          <a
            href="https://policies.google.com/terms"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            Términos de Servicio
          </a>{" "}
          de Google.
        </p>
      </div>
    </form>
  )
} 