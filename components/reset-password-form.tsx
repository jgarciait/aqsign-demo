"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Lock, Eye, EyeOff, CheckCircle, AlertCircle } from "lucide-react"

interface ResetPasswordFormProps {
  token: string
  email: string
}

export default function ResetPasswordForm({ token, email }: ResetPasswordFormProps) {
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [tokenValid, setTokenValid] = useState<boolean | null>(null)
  const router = useRouter()

  // Password strength validation
  const getPasswordStrength = (pass: string) => {
    if (pass.length < 6) return { strength: 'weak', message: 'Mínimo 6 caracteres' }
    if (pass.length < 8) return { strength: 'fair', message: 'Razonable, considere usar 8+ caracteres' }
    if (pass.length >= 8 && /(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(pass)) {
      return { strength: 'strong', message: 'Contraseña fuerte' }
    }
    if (pass.length >= 8) return { strength: 'good', message: 'Buena, considere agregar números y mayúsculas' }
    return { strength: 'weak', message: 'Muy débil' }
  }

  const passwordStrength = getPasswordStrength(password)

  // Verify token on component mount
  useEffect(() => {
    const verifyToken = async () => {
      try {
        const response = await fetch("/api/auth/reset-password", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ 
            token, 
            email, 
            password: "temp", // Just to trigger validation, we'll catch the validation error
            confirmPassword: "temp"
          }),
        })

        // If token is invalid, we'll get an error about the token
        // If token is valid, we'll get a validation error about the password being the same
        const data = await response.json()
        
        if (data.error && (data.error.includes("token") || data.error.includes("expired"))) {
          setTokenValid(false)
        } else {
          setTokenValid(true)
        }
      } catch (err) {
        setTokenValid(false)
      }
    }

    verifyToken()
  }, [token, email])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    // Client-side validation
    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres")
      setLoading(false)
      return
    }

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden")
      setLoading(false)
      return
    }

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          email,
          password,
          confirmPassword,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || "Ocurrió un error inesperado")
        return
      }

      setSuccess(true)
      
      // Redirect to login after 3 seconds
      setTimeout(() => {
        router.push("/?message=password-reset-success")
      }, 3000)

    } catch (err) {
      console.error("Reset password error:", err)
      setError("Ocurrió un error de conexión. Por favor, inténtelo de nuevo.")
    } finally {
      setLoading(false)
    }
  }

  // Show loading state while verifying token
  if (tokenValid === null) {
    return (
      <div className="text-center space-y-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="text-gray-600">Verificando enlace de restablecimiento...</p>
      </div>
    )
  }

  // Show error if token is invalid
  if (tokenValid === false) {
    return (
      <div className="text-center space-y-6">
        <div className="w-16 h-16 mx-auto bg-red-100 rounded-full flex items-center justify-center">
          <AlertCircle className="w-8 h-8 text-red-600" />
        </div>
        
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Enlace inválido o expirado
          </h3>
          <p className="text-gray-600 mb-4">
            Este enlace de restablecimiento ya no es válido. Esto puede suceder si:
          </p>
          <ul className="text-sm text-gray-500 space-y-1 text-left">
            <li>• El enlace ha expirado (válido por 1 hora)</li>
            <li>• Ya se utilizó para restablecer la contraseña</li>
            <li>• El enlace está mal formado</li>
          </ul>
        </div>

        <button
          onClick={() => router.push("/forgot-password")}
          className="w-full bg-[#0d2340] text-white py-3 px-4 rounded-lg hover:bg-[#1a3a5f] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
        >
          Solicitar nuevo enlace
        </button>
      </div>
    )
  }

  // Show success state
  if (success) {
    return (
      <div className="text-center space-y-6">
        <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center">
          <CheckCircle className="w-8 h-8 text-green-600" />
        </div>
        
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            ¡Contraseña actualizada!
          </h3>
          <p className="text-gray-600 mb-4">
            Su contraseña se ha actualizado exitosamente. Será redirigido al inicio de sesión en unos segundos.
          </p>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-sm text-green-800">
            <strong>¡Listo!</strong> Ya puede iniciar sesión con su nueva contraseña.
          </p>
        </div>

        <button
          onClick={() => router.push("/")}
          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
        >
          Ir al inicio de sesión ahora
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
              <AlertCircle className="h-5 w-5 text-red-400" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <div className="mt-2 text-sm text-red-700">{error}</div>
            </div>
          </div>
        </div>
      )}

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
          Nueva Contraseña
        </label>
        <div className="relative">
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full px-4 py-3 border border-gray-300 rounded-lg pl-11 pr-11 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Ingrese su nueva contraseña"
            disabled={loading}
          />
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Lock className="h-5 w-5 text-gray-400" />
          </div>
          <button
            type="button"
            className="absolute inset-y-0 right-0 pr-3 flex items-center"
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? (
              <EyeOff className="h-5 w-5 text-gray-400" />
            ) : (
              <Eye className="h-5 w-5 text-gray-400" />
            )}
          </button>
        </div>
        
        {/* Password strength indicator */}
        {password && (
          <div className="mt-2">
            <div className="flex items-center space-x-2">
              <div className="flex-1">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${
                      passwordStrength.strength === 'weak' ? 'bg-red-500 w-1/4' :
                      passwordStrength.strength === 'fair' ? 'bg-yellow-500 w-2/4' :
                      passwordStrength.strength === 'good' ? 'bg-blue-500 w-3/4' :
                      'bg-green-500 w-full'
                    }`}
                  ></div>
                </div>
              </div>
              <span className={`text-xs font-medium ${
                passwordStrength.strength === 'weak' ? 'text-red-600' :
                passwordStrength.strength === 'fair' ? 'text-yellow-600' :
                passwordStrength.strength === 'good' ? 'text-blue-600' :
                'text-green-600'
              }`}>
                {passwordStrength.message}
              </span>
            </div>
          </div>
        )}
      </div>

      <div>
        <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
          Confirmar Nueva Contraseña
        </label>
        <div className="relative">
          <input
            id="confirmPassword"
            type={showConfirmPassword ? "text" : "password"}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            className="w-full px-4 py-3 border border-gray-300 rounded-lg pl-11 pr-11 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Confirme su nueva contraseña"
            disabled={loading}
          />
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Lock className="h-5 w-5 text-gray-400" />
          </div>
          <button
            type="button"
            className="absolute inset-y-0 right-0 pr-3 flex items-center"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
          >
            {showConfirmPassword ? (
              <EyeOff className="h-5 w-5 text-gray-400" />
            ) : (
              <Eye className="h-5 w-5 text-gray-400" />
            )}
          </button>
        </div>
        
        {/* Password match indicator */}
        {confirmPassword && (
          <div className="mt-2">
            {password === confirmPassword ? (
              <p className="text-sm text-green-600 flex items-center">
                <CheckCircle className="h-4 w-4 mr-1" />
                Las contraseñas coinciden
              </p>
            ) : (
              <p className="text-sm text-red-600 flex items-center">
                <AlertCircle className="h-4 w-4 mr-1" />
                Las contraseñas no coinciden
              </p>
            )}
          </div>
        )}
      </div>

      <button
        type="submit"
        disabled={loading || !password || !confirmPassword || password !== confirmPassword}
        className="w-full bg-[#0d2340] text-white py-3 px-4 rounded-lg hover:bg-[#1a3a5f] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
      >
        {loading ? (
          <>
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            <span>Actualizando contraseña...</span>
          </>
        ) : (
          <>
            <Lock className="h-4 w-4" />
            <span>Actualizar contraseña</span>
          </>
        )}
      </button>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="text-sm font-medium text-blue-900 mb-2">Consejos para una contraseña segura:</h4>
        <ul className="text-xs text-blue-800 space-y-1">
          <li>• Use al menos 8 caracteres</li>
          <li>• Combine letras mayúsculas y minúsculas</li>
          <li>• Incluya números y símbolos</li>
          <li>• Evite información personal (nombres, fechas)</li>
          <li>• No reutilice contraseñas de otras cuentas</li>
        </ul>
      </div>
    </form>
  )
} 