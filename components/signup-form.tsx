"use client"

import type React from "react"
import { useState } from "react"
import { useGoogleReCaptcha } from "react-google-recaptcha-v3"
import { handleSignup } from "@/app/actions/auth-actions"

export default function SignupForm() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [invitationCode, setInvitationCode] = useState("")
  const [honeypot, setHoneypot] = useState("") // Honeypot field
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const { executeRecaptcha } = useGoogleReCaptcha()

  const verifyRecaptcha = async (action: string): Promise<boolean> => {
    if (!executeRecaptcha) {
      console.warn("reCAPTCHA not available")
      return true // Allow signup if reCAPTCHA is not configured
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
      return true // Allow signup on reCAPTCHA error to avoid blocking legitimate users
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setMessage(null)

    // Honeypot check - if filled, it's likely a bot
    if (honeypot) {
      console.warn("Honeypot field filled - potential bot detected")
      setError("Error de validación")
      return
    }

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden")
      return
    }

    setLoading(true)

    // Verify reCAPTCHA
    const recaptchaValid = await verifyRecaptcha("signup")
    if (!recaptchaValid) {
      setError("Verificación de seguridad fallida. Por favor, inténtelo de nuevo.")
      setLoading(false)
      return
    }

    try {
      const result = await handleSignup(
        email,
        password,
        invitationCode || undefined,
        firstName || undefined,
        lastName || undefined,
      )

      if (result.error) {
        setError(result.error)
      } else if (result.success) {
        setMessage(result.message || "Revisa tu correo electrónico para el enlace de confirmación")
        // Clear form on success
        setEmail("")
        setPassword("")
        setConfirmPassword("")
        setFirstName("")
        setLastName("")
        setInvitationCode("")
        setHoneypot("")
      }
    } catch (err) {
      console.error("Signup error:", err)
      setError("Ocurrió un error inesperado")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-md text-sm">{error}</div>}

      {message && (
        <div className="bg-green-50 border border-green-200 text-green-700 p-3 rounded-md text-sm">{message}</div>
      )}

      {/* Honeypot field - hidden from users but visible to bots */}
      <div style={{ display: "none" }}>
        <label htmlFor="phone-number">
          Leave this empty
        </label>
        <input
          id="phone-number"
          name="phone-number"
          type="text"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
          autoComplete="off"
          tabIndex={-1}
        />
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-foreground mb-1">
          Correo Electrónico *
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="nombre@empresa.com"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="firstName" className="block text-sm font-medium text-foreground mb-1">
            Nombre
          </label>
          <input
            id="firstName"
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Juan"
          />
        </div>
        <div>
          <label htmlFor="lastName" className="block text-sm font-medium text-foreground mb-1">
            Apellido
          </label>
          <input
            id="lastName"
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Pérez"
          />
        </div>
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-foreground mb-1">
          Contraseña *
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label htmlFor="confirm-password" className="block text-sm font-medium text-foreground mb-1">
          Confirmar Contraseña *
        </label>
        <input
          id="confirm-password"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label htmlFor="invitation-code" className="block text-sm font-medium text-foreground mb-1">
          Código de Invitación
        </label>
        <input
          id="invitation-code"
          type="text"
          value={invitationCode}
          onChange={(e) => setInvitationCode(e.target.value.toUpperCase())}
          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="e.g., ABCDE"
          maxLength={5}
        />
        <p className="text-xs text-gray-500 mt-1">Opcional: Ingresa el código de invitación si tienes uno</p>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-[#0d2340] text-white py-2 px-4 rounded-md hover:bg-[#1a3a5f] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50"
      >
        {loading ? "Creando cuenta..." : "Registrarse"}
      </button>

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
