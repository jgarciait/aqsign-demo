import { createPublicClient } from "@/utils/supabase/public-client"
import { createAdminClient } from "@/utils/supabase/admin"

interface SignPageProps {
  params: Promise<{
    documentId: string
  }>
  searchParams: Promise<{
    token?: string
  }>
}

// Function to format date in Puerto Rico timezone (12-hour format)
function formatDatePuertoRico(dateString: string | Date) {
  const date = new Date(dateString)
  return date.toLocaleDateString('es-PR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'America/Puerto_Rico'
  })
}

export default async function SignPage({ params, searchParams }: SignPageProps) {
  const { documentId } = await params
  const { token } = await searchParams

  console.log("Sign page accessed:", { documentId, token, env: process.env.NODE_ENV })

  if (!token) {
    console.error("No token provided in URL")
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6 text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Invalid Request</h1>
          <p className="text-gray-600 mb-4">
            This signing link is missing required parameters. Please contact the sender for a new link.
          </p>
        </div>
      </div>
    )
  }

  try {
    // Decode the token (it appears to be base64 encoded email)
    let decodedToken: string
    try {
      decodedToken = Buffer.from(token, "base64").toString("utf-8")
      console.log("Decoded token:", decodedToken)
      
      // Basic email validation
      if (!decodedToken.includes("@") || !decodedToken.includes(".")) {
        throw new Error("Invalid email format in token")
      }
    } catch (tokenError) {
      console.error("Invalid token format:", tokenError)
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
            </div>
            <h1 className="text-xl font-semibold text-gray-900 mb-2">Invalid Token</h1>
            <p className="text-gray-600 mb-4">
              This signing link has an invalid token. Please contact the sender for a new link.
            </p>
          </div>
        </div>
      )
    }

    const supabase = createPublicClient()

    // Only check if the document exists - simplified validation
    const { data: document, error: docError } = await supabase
      .from("documents")
      .select("*")
      .eq("id", documentId)
      .single()

    if (docError || !document) {
      console.error("Document not found:", docError)
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h1 className="text-xl font-semibold text-gray-900 mb-2">Document Not Found</h1>
            <p className="text-gray-600 mb-4">
              The requested document could not be found. Please contact the sender for a new link.
            </p>
          </div>
        </div>
      )
    }

    // Check for existing signing request and document status
    const { data: signingRequest } = await supabase
      .from("signing_requests")
      .select("*")
      .eq("document_id", documentId)
      .eq("recipient_email", decodedToken)
      .single()

    // Check if the signing request has expired (only if it exists)
    if (signingRequest?.expires_at && new Date(signingRequest.expires_at) < new Date()) {
      console.error("Signing request has expired")
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-orange-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h1 className="text-xl font-semibold text-gray-900 mb-2">Enlace Expirado</h1>
            <p className="text-gray-600 mb-4">
              Este enlace de firma ha expirado. Debe solicitar que le envíen el documento nuevamente.
            </p>
            <div className="mt-6 text-sm text-gray-500">
              Si necesita ayuda, contacte a la persona que le envió este documento.
            </div>
          </div>
        </div>
      )
    }

    // Check the request status to prevent signing already processed documents
    // Use admin client directly instead of fetch to avoid server-side fetch issues
    const adminClient = createAdminClient()
    
    let requestStatus: any = null
    let existingSignatures: any[] = []
    
    try {
      // Get the request status
      const { data: requestData, error: requestError } = await adminClient
        .from("requests")
        .select("status, signed_at, returned_at, customer:customer_id(email)")
        .eq("document_id", documentId)
        .single()

      // Log for debugging
      console.log('Request data:', { requestData, requestError, decodedToken })

      if (requestData) {
        requestStatus = {
          status: requestData.status,
          signed_at: requestData.signed_at,
          returned_at: requestData.returned_at
        }
        
        // Verify email match for extra security, but don't block if it fails
        const customerEmail = requestData.customer?.email
        if (customerEmail && customerEmail !== decodedToken) {
          console.warn('Email mismatch:', { customerEmail, decodedToken })
        }
      }

      // Get existing signatures regardless of email verification
      const { data: signaturesData } = await adminClient
        .from("document_signatures")
        .select("id, created_at")
        .eq("document_id", documentId)
        .eq("recipient_email", decodedToken)

      existingSignatures = signaturesData || []
      
      // Log for debugging
      console.log('Document status check:', {
        currentStatus: requestStatus?.status,
        hasSignatures: existingSignatures.length > 0,
        signatureCount: existingSignatures.length
      })
      
    } catch (error) {
      console.error('Error fetching document status:', error)
      // Continue with empty/default values
    }

    // If the document has already been signed or is not in "sent" status, prevent access
    const hasSignatures = existingSignatures && existingSignatures.length > 0
    const currentStatus = requestStatus?.status || "unknown"
    
    // Allow signing only if status is "sent" (existing signatures will be cleared on resend)
    // Block all other cases: status is not "sent"
    const shouldBlockAccess = currentStatus !== "sent"
    
    if (shouldBlockAccess) {      
      console.log(`Document cannot be signed. Status: ${currentStatus}, Has signatures: ${hasSignatures}`)
      
      let errorMessage = "Este documento ya no está disponible para firma."
      let errorTitle = "Enlace No Disponible"
      let iconBgClass = "bg-red-100"
      let iconColorClass = "text-red-600"
      let showSuccessIcon = false
      
      // If document has signatures or is already processed, show as signed
      if (hasSignatures || currentStatus === "returned" || currentStatus === "signed") {
        errorMessage = "Este documento ya ha sido firmado y procesado. No se puede firmar nuevamente."
        errorTitle = "Documento Ya Firmado"
        iconBgClass = "bg-green-100"
        iconColorClass = "text-green-600"
        showSuccessIcon = true
      } else if (currentStatus === "draft") {
        errorMessage = "Este documento aún no ha sido enviado para firma. Contacte al remitente."
        errorTitle = "Documento No Enviado"
        iconBgClass = "bg-gray-100"
        iconColorClass = "text-gray-600"
        showSuccessIcon = false
      }
      
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6 text-center">
            <div className={`w-16 h-16 mx-auto mb-4 ${iconBgClass} rounded-full flex items-center justify-center`}>
              <svg className={`w-8 h-8 ${iconColorClass}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {showSuccessIcon ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                  />
                )}
              </svg>
            </div>
            <h1 className="text-xl font-semibold text-gray-900 mb-2">{errorTitle}</h1>
            <p className="text-gray-600 mb-4">{errorMessage}</p>
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-2">
                <strong>Estado del documento:</strong> {
                  hasSignatures ? "Firmado" :
                  currentStatus === "sent" ? "Enviado" : 
                  currentStatus === "returned" ? "Devuelto" :
                  currentStatus === "signed" ? "Firmado" :
                  currentStatus === "draft" ? "Borrador" : 
                  currentStatus
                }
              </p>
              {hasSignatures && existingSignatures[0]?.created_at && (
                <p className="text-sm text-gray-600 mb-2">
                  <strong>Firmado el:</strong> {formatDatePuertoRico(existingSignatures[0].created_at)}
                </p>
              )}
              {!hasSignatures && requestStatus?.signed_at && (
                <p className="text-sm text-gray-600 mb-2">
                  <strong>Firmado el:</strong> {formatDatePuertoRico(requestStatus.signed_at)}
                </p>
              )}
              {requestStatus?.returned_at && (
                <p className="text-sm text-gray-600">
                  <strong>Procesado el:</strong> {formatDatePuertoRico(requestStatus.returned_at)}
                </p>
              )}
            </div>
            <div className="mt-6 text-sm text-gray-500">
              Para obtener una nueva copia o reenvío, contacte a la persona que le envió este documento.
            </div>
          </div>
        </div>
      )
    }

    // If we get here, allow access to the document - use the original document viewer
    const DocumentViewerWrapper = (await import("./document-viewer-wrapper")).default
    
    return (
      <DocumentViewerWrapper
        documentUrl={document.file_url || `/api/pdf/${documentId}`}
        documentName={document.file_name}
        documentId={documentId}
        token={token}
        recipientEmail={decodedToken}
      />
    )
  } catch (error) {
    console.error("Error processing signing request:", error)
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6 text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Error</h1>
          <p className="text-gray-600 mb-4">
            An error occurred while processing your request. Please try again or contact support.
          </p>
        </div>
      </div>
    )
  }
}
