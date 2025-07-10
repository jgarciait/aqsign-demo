import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { token, action } = await request.json()

    if (!token) {
      return NextResponse.json(
        { error: "reCAPTCHA token is required" },
        { status: 400 }
      )
    }

    const secretKey = process.env.RECAPTCHA_SECRET_KEY

    if (!secretKey) {
      console.error("reCAPTCHA secret key not configured")
      return NextResponse.json(
        { error: "reCAPTCHA not configured" },
        { status: 500 }
      )
    }

    // Verify the token with Google reCAPTCHA API
    const verificationUrl = `https://www.google.com/recaptcha/api/siteverify`
    const verificationData = new URLSearchParams({
      secret: secretKey,
      response: token,
    })

    const verifyResponse = await fetch(verificationUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: verificationData,
    })

    const verificationResult = await verifyResponse.json()

    if (!verificationResult.success) {
      console.warn("reCAPTCHA verification failed:", verificationResult)
      return NextResponse.json(
        { error: "reCAPTCHA verification failed", success: false },
        { status: 400 }
      )
    }

    // Check score (reCAPTCHA v3 returns a score from 0.0 to 1.0)
    const score = verificationResult.score || 0
    const minScore = 0.5 // Adjust threshold as needed

    if (score < minScore) {
      console.warn(`Low reCAPTCHA score: ${score} (minimum: ${minScore})`)
      return NextResponse.json(
        { error: "Suspicious activity detected", success: false, score },
        { status: 400 }
      )
    }

    // Verify action if provided
    if (action && verificationResult.action !== action) {
      console.warn(`Action mismatch: expected ${action}, got ${verificationResult.action}`)
      return NextResponse.json(
        { error: "Action verification failed", success: false },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      score,
      action: verificationResult.action,
    })

  } catch (error) {
    console.error("reCAPTCHA verification error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
} 