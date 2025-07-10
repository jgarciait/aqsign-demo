import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"
import { createAdminClient } from "@/utils/supabase/admin"
import { sendPasswordResetEmail } from "@/app/actions/password-reset-actions"
import crypto from "crypto"

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      )
    }

    const adminClient = createAdminClient()

    // Check if user exists in profiles table (which is synced with auth.users)
    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("id, first_name, last_name, email")
      .eq("email", email.toLowerCase())
      .single()
    
    if (profileError || !profile) {
      // Don't reveal whether email exists or not for security
      return NextResponse.json({
        success: true,
        message: "If an account with that email exists, we've sent a password reset link."
      })
    }

    // Generate a secure random token
    const resetToken = crypto.randomBytes(32).toString("hex")
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour from now

    // Store the reset token in database
    const { error: tokenError } = await adminClient
      .from("password_reset_tokens")
      .insert({
        email: email.toLowerCase(),
        token: resetToken,
        expires_at: expiresAt.toISOString(),
        used: false
      })

    if (tokenError) {
      console.error("Error storing reset token:", tokenError)
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      )
    }

    // Send password reset email
    const emailResult = await sendPasswordResetEmail({
      email: email.toLowerCase(),
      resetToken,
      name: profile.first_name || profile.email?.split("@")[0] || "Usuario"
    })

    if (emailResult.error) {
      console.error("Error sending reset email:", emailResult.error)
      // Clean up the token if email fails
      await adminClient
        .from("password_reset_tokens")
        .delete()
        .eq("token", resetToken)
      
      return NextResponse.json(
        { error: "Failed to send reset email. Please try again." },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: "If an account with that email exists, we've sent a password reset link."
    })

  } catch (error) {
    console.error("Forgot password error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
} 