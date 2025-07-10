import Link from "next/link"
import { redirect } from "next/navigation"
import { createClient } from "@/utils/supabase/server"
import ResetPasswordForm from "@/components/reset-password-form"
import { Logo } from "@/components/logo"

interface ResetPasswordPageProps {
  searchParams: Promise<{ token?: string; email?: string }>
}

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // If user is already logged in, redirect to dashboard
  if (user) {
    redirect("/fast-sign")
  }

  const params = await searchParams
  const { token, email } = params

  // If no token or email in URL, redirect to forgot password page
  if (!token || !email) {
    redirect("/forgot-password")
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
          <h1 className="text-3xl font-bold text-center mb-4">Nueva Contraseña</h1>
          <p className="text-center mb-12">
            Está a punto de crear una nueva contraseña para su cuenta. Asegúrese de que sea segura y fácil de recordar.
          </p>
          
          <div className="w-full space-y-4 text-sm">
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className="font-medium">Enlace verificado</p>
                <p className="text-white/80 text-xs">Su enlace de restablecimiento es válido</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <div>
                <p className="font-medium">Contraseña segura</p>
                <p className="text-white/80 text-xs">Use al menos 6 caracteres con números y letras</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 rounded-full bg-yellow-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="font-medium">Enlace temporal</p>
                <p className="text-white/80 text-xs">Este enlace expirará pronto por seguridad</p>
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
          
          <h2 className="text-2xl font-bold mb-2">Crear nueva contraseña</h2>
          <p className="text-gray-600 mb-8">
            Ingrese su nueva contraseña. Asegúrese de que sea segura y la pueda recordar fácilmente.
          </p>

          <ResetPasswordForm token={token} email={email} />

          <div className="mt-6 text-center">
            <p className="text-gray-600">
              ¿Cambió de opinión?{" "}
              <Link href="/" className="text-blue-600 hover:underline">
                Volver al inicio de sesión
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
} 