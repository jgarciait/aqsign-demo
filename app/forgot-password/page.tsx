import Link from "next/link"
import { redirect } from "next/navigation"
import { createClient } from "@/utils/supabase/server"
import ForgotPasswordForm from "@/components/forgot-password-form"
import { Logo } from "@/components/logo"

export default async function ForgotPasswordPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // If user is already logged in, redirect to dashboard
  if (user) {
    redirect("/fast-sign")
  }

  return (
    <div className="flex min-h-screen">
      {/* Left side - Welcome section */}
      <div className="hidden md:flex md:w-1/2 bg-[#0d2340] text-white flex-col items-center justify-center p-8">
        <div className="max-w-md mx-auto flex flex-col items-center">
          <div className="mb-8">
            <div className="mx-auto">
              <Logo className="h-24 w-24" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-center mb-4">¿Olvidó su contraseña?</h1>
          <p className="text-center mb-12">
            No se preocupe, le enviaremos un enlace para restablecer su contraseña de forma segura
          </p>
          
          <div className="w-full space-y-4 text-sm">
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-white text-xs font-bold">1</span>
              </div>
              <div>
                <p className="font-medium">Ingrese su correo electrónico</p>
                <p className="text-white/80 text-xs">Use el correo asociado a su cuenta</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-white text-xs font-bold">2</span>
              </div>
              <div>
                <p className="font-medium">Revise su bandeja de entrada</p>
                <p className="text-white/80 text-xs">Le enviaremos un enlace de restablecimiento</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-white text-xs font-bold">3</span>
              </div>
              <div>
                <p className="font-medium">Cree una nueva contraseña</p>
                <p className="text-white/80 text-xs">Haga clic en el enlace y establezca una nueva contraseña</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Form section */}
      <div className="w-full md:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="md:hidden flex justify-center mb-8">
            <Logo className="h-16 w-16" color="#0d2340" />
          </div>
          
          <h2 className="text-2xl font-bold mb-2">Restablecer contraseña</h2>
          <p className="text-gray-600 mb-8">
            Ingrese su correo electrónico y le enviaremos un enlace para restablecer su contraseña
          </p>

          <ForgotPasswordForm />

          <div className="mt-6 text-center">
            <p className="text-gray-600">
              ¿Recordó su contraseña?{" "}
              <Link href="/" className="text-blue-600 hover:underline">
                Volver al inicio de sesión
              </Link>
            </p>
          </div>
          
          <div className="mt-4 text-center">
            <p className="text-gray-600">
              ¿No tiene una cuenta?{" "}
              <Link href="/signup" className="text-blue-600 hover:underline">
                Crear una cuenta
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
} 