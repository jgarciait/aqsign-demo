import type React from "react"
import "./globals.css"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { Toaster } from "@/components/ui/toaster"
import ReCaptchaProvider from "@/components/recaptcha-provider"
import "@/utils/polyfills"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "AQ FastSign Demo - Document Signing",
  description: "Secure document signing platform",
  generator: 'v0.dev',
  other: {
    'cache-control': 'no-cache, no-store, must-revalidate',
    'pragma': 'no-cache',
    'expires': '0',
  }
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ReCaptchaProvider>
          {children}
        </ReCaptchaProvider>
        <Toaster />
      </body>
    </html>
  )
}
