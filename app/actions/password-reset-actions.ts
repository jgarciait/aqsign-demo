"use server"

import { createAdminClient } from "@/utils/supabase/admin"
import { createClient } from "@/utils/supabase/server"
import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY!)

type SendPasswordResetEmailParams = {
  email: string
  resetToken: string
  name: string
}

export async function sendPasswordResetEmail({
  email,
  resetToken,
  name
}: SendPasswordResetEmailParams) {
  try {
    // Create the reset link
    const baseUrl = process.env.NEXT_PUBLIC_VERCEL_URL
      ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
      : process.env.NEXT_PUBLIC_SITE_URL
        ? process.env.NEXT_PUBLIC_SITE_URL
        : "http://localhost:3000"

    const resetLink = `${baseUrl}/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`

    // Email HTML template
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Restablecer Contraseña - AQSign</title>
</head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333; padding: 20px;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h1 style="color: #0D2340; font-size: 28px; margin-bottom: 10px;">AQSign</h1>
    <h2 style="color: #666; font-size: 20px; margin: 0;">Restablecer Contraseña</h2>
  </div>
  
  <p>Hola ${name},</p>
  
  <p>Hemos recibido una solicitud para restablecer la contraseña de su cuenta en AQSign.</p>
  
  <p>Si usted solicitó este restablecimiento, haga clic en el botón de abajo para crear una nueva contraseña:</p>
  
  <div style="text-align: center; margin: 30px 0;">
    <a href="${resetLink}" style="background-color: #0D2340; color: white; padding: 15px 30px; border-radius: 5px; text-decoration: none; font-weight: bold; display: inline-block;">
      Restablecer Contraseña
    </a>
  </div>
  
  <p>O copie y pegue este enlace en su navegador:</p>
  
  <p style="word-break: break-all; color: #4F46E5; font-size: 14px;">
    <a href="${resetLink}" style="color: #4F46E5;">${resetLink}</a>
  </p>
  
  <div style="margin-top: 30px; padding: 15px; background-color: #f8f9fa; border-radius: 5px;">
    <p style="margin: 0; font-size: 14px; color: #666;">
      <strong>Importante:</strong>
    </p>
    <ul style="margin: 10px 0; padding-left: 20px; font-size: 14px; color: #666;">
      <li>Este enlace expirará en 1 hora por seguridad</li>
      <li>Si no solicitó este restablecimiento, puede ignorar este correo</li>
      <li>Por su seguridad, no comparta este enlace con nadie</li>
    </ul>
  </div>
  
  <p style="margin-top: 30px; font-size: 14px; color: #666;">
    Si tiene algún problema o pregunta, no dude en contactarnos.
  </p>
  
  <p style="margin-top: 20px;">
    Gracias,<br>
    <strong>Equipo AQSign</strong>
  </p>
  
  <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
  
  <p style="font-size: 12px; color: #999; text-align: center;">
    Este es un correo automático, por favor no responda a esta dirección.
  </p>
</body>
</html>
`

    // Text version for email clients that don't support HTML
    const emailText = `
Hola ${name},

Hemos recibido una solicitud para restablecer la contraseña de su cuenta en AQSign.

Si usted solicitó este restablecimiento, visite el siguiente enlace para crear una nueva contraseña:

${resetLink}

IMPORTANTE:
- Este enlace expirará en 1 hora por seguridad
- Si no solicitó este restablecimiento, puede ignorar este correo
- Por su seguridad, no comparta este enlace con nadie

Si tiene algún problema o pregunta, no dude en contactarnos.

Gracias,
Equipo AQSign

---
Este es un correo automático, por favor no responda a esta dirección.
`

    // Send the email
    const { data, error } = await resend.emails.send({
      from: "AQSign <no-reply@aqplatform.app>",
      to: [email],
      subject: "Restablecer Contraseña - AQSign",
      html: emailHtml,
      text: emailText,
    })

    if (error) {
      console.error("Error sending password reset email:", error)
      return { error: error.message }
    }

    console.log("Password reset email sent successfully:", data)
    return { success: true, data }

  } catch (error) {
    console.error("Error sending password reset email:", error)
    return { error: error instanceof Error ? error.message : "An unexpected error occurred" }
  }
}

export async function verifyResetToken(token: string, email: string) {
  try {
    const adminClient = createAdminClient()

    // Find the token in database
    const { data: tokenData, error: tokenError } = await adminClient
      .from("password_reset_tokens")
      .select("*")
      .eq("token", token)
      .eq("email", email.toLowerCase())
      .eq("used", false)
      .single()

    if (tokenError || !tokenData) {
      return { valid: false, error: "Invalid or expired reset token" }
    }

    // Check if token has expired
    const now = new Date()
    const expiresAt = new Date(tokenData.expires_at)

    if (now > expiresAt) {
      // Clean up expired token
      await adminClient
        .from("password_reset_tokens")
        .delete()
        .eq("token", token)

      return { valid: false, error: "Reset token has expired" }
    }

    return { valid: true, tokenData }

  } catch (error) {
    console.error("Error verifying reset token:", error)
    return { valid: false, error: "An unexpected error occurred" }
  }
}

export async function resetPassword(token: string, email: string, newPassword: string) {
  try {
    const adminClient = createAdminClient()

    // First verify the token
    const tokenVerification = await verifyResetToken(token, email)
    if (!tokenVerification.valid) {
      return { success: false, error: tokenVerification.error }
    }

    // Get the user ID from profiles table
    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("id")
      .eq("email", email.toLowerCase())
      .single()
    
    if (profileError || !profile) {
      return { success: false, error: "User not found" }
    }

    // Update the password using Supabase admin client  
    // Use the service role client to update user password
    const supabaseAdmin = createAdminClient()
    
    const { error: passwordUpdateError } = await supabaseAdmin.auth.admin.updateUserById(
      profile.id,
      { password: newPassword }
    )

    if (passwordUpdateError) {
      console.error("Error updating password:", passwordUpdateError)
      return { success: false, error: "Failed to update password" }
    }

    // Mark the token as used
    await adminClient
      .from("password_reset_tokens")
      .update({ used: true })
      .eq("token", token)

    return { success: true, message: "Password updated successfully" }

  } catch (error) {
    console.error("Error resetting password:", error)
    return { success: false, error: "An unexpected error occurred" }
  }
} 