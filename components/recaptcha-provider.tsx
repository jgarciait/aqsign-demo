"use client"

import { GoogleReCaptchaProvider } from "react-google-recaptcha-v3"

interface ReCaptchaProviderProps {
  children: React.ReactNode
}

export default function ReCaptchaProvider({ children }: ReCaptchaProviderProps) {
  const reCaptchaSiteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY

  if (!reCaptchaSiteKey) {
    console.warn("reCAPTCHA site key not found. reCAPTCHA will be disabled.")
    return <>{children}</>
  }

  return (
    <GoogleReCaptchaProvider
      reCaptchaKey={reCaptchaSiteKey}
      language="es"
      scriptProps={{
        async: false,
        defer: false,
        appendTo: "head",
        nonce: undefined,
      }}
    >
      {children}
    </GoogleReCaptchaProvider>
  )
} 