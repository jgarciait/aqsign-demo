import { createClient } from "@/utils/supabase/server"
import { createAdminClient } from "@/utils/supabase/admin"
import { BUCKET_PUBLIC } from "@/utils/supabase/storage"
import { notFound, redirect } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import ClientWrapper from "./client-wrapper"
import DocumentSidebar from "./document-sidebar"
import Sidebar from "@/components/sidebar"
import { ensureValidRelativeDimensions, STANDARD_PAGE_WIDTH, STANDARD_PAGE_HEIGHT } from '@/utils/signature-dimensions'

interface PageProps {
  params: Promise<{ documentId: string }>
  searchParams: Promise<{ token?: string; requestId?: string }>
}

export default async function ViewSignedDocumentPage({ params, searchParams }: PageProps) {
  const { documentId } = await params
  const { token, requestId } = await searchParams

  if (!token || !requestId) {
    return notFound()
  }

  // Decode the token to get recipient email
  let recipientEmail: string
  try {
    recipientEmail = Buffer.from(token, "base64").toString("utf-8")
  } catch (error) {
    console.error("Error decoding token:", error)
    return notFound()
  }

  const adminClient = createAdminClient()

  // Get document details
  const { data: document, error: documentError } = await adminClient
    .from("documents")
    .select("*")
    .eq("id", documentId)
    .single()

  if (documentError || !document) {
    console.error("Document not found:", documentError)
    return notFound()
  }

  // Get request details to verify access
  const { data: request, error: requestError } = await adminClient
    .from("request_details")
    .select("*")
    .eq("id", requestId)
    .eq("document_id", documentId)
    .single()

  if (requestError || !request) {
    console.error("Request not found:", requestError)
    return notFound()
  }

  // Verify the recipient email matches
  if (request.customer_email !== recipientEmail) {
    console.error("Email mismatch")
    return notFound()
  }

  // Check if document has been signed
  if (request.status !== "signed" && request.status !== "returned") {
    console.error("Document not signed yet")
    return notFound()
  }

  // Get text annotations (excluding signatures)
  const { data: annotationData, error: annotationError } = await adminClient
    .from("document_annotations")
    .select("annotations")
    .eq("document_id", documentId)
    .eq("recipient_email", recipientEmail)
    .single()

  // Get signatures ONLY from document_signatures table
  const { data: signatures, error: signaturesError } = await adminClient
    .from("document_signatures")
    .select("*")
    .eq("document_id", documentId)
    .eq("recipient_email", recipientEmail)
    .eq("status", "signed")

  if (signaturesError) {
    console.error("Error fetching signatures:", signaturesError)
  }

  // Create public client to get document URL
  const supabase = await createClient()
  const { data: urlData } = supabase.storage
    .from(BUCKET_PUBLIC)
    .getPublicUrl(document.file_path)

  const documentUrl = urlData.publicUrl
  
  // Start with text annotations (filter out any signatures that might be there)
  let annotations = (annotationData?.annotations || []).filter((ann: any) => ann.type !== 'signature')
  
  // Add signatures from document_signatures table
  if (signatures && signatures.length > 0) {
    const signatureAnnotations: any[] = []
    
    signatures.forEach((sigRecord: any) => {
      // Handle both old format (direct signature_data) and new format (signatures array)
      if (sigRecord.signature_data?.signatures) {
        // New format: signatures array
        const signaturesArray = sigRecord.signature_data.signatures
        signaturesArray.forEach((sig: any) => {
          // Create base signature data
          const baseSignature = {
            id: sig.id,
            type: 'signature' as const,
            x: sig.position?.x || 100,
            y: sig.position?.y || 100,
            width: sig.position?.width || 300,
            height: sig.position?.height || 150,
            page: sig.position?.page || 1,
            relativeX: sig.position?.relativeX,
            relativeY: sig.position?.relativeY,
            relativeWidth: sig.position?.relativeWidth,
            relativeHeight: sig.position?.relativeHeight,
            imageData: sig.dataUrl || '',
            timestamp: sig.timestamp || sigRecord.signed_at,
            signatureSource: sig.source || sigRecord.signature_source || 'canvas'
          }
          
          // Normalize dimensions using standard page size as reference
          const normalized = ensureValidRelativeDimensions(baseSignature, STANDARD_PAGE_WIDTH, STANDARD_PAGE_HEIGHT)
          signatureAnnotations.push(normalized)
        })
      } else if (sigRecord.signature_data?.dataUrl) {
        // Old format: direct signature data
        signatureAnnotations.push({
          id: sigRecord.id,
          type: 'signature' as const,
          x: sigRecord.signature_data.position?.x || 100,
          y: sigRecord.signature_data.position?.y || 100,
          width: sigRecord.signature_data.position?.width || 300,
          height: sigRecord.signature_data.position?.height || 150,
          page: sigRecord.signature_data.position?.page || 1,
          relativeX: sigRecord.signature_data.position?.relativeX || 0.15,
          relativeY: sigRecord.signature_data.position?.relativeY || 0.15,
          relativeWidth: sigRecord.signature_data.position?.relativeWidth || 0.49,
          relativeHeight: sigRecord.signature_data.position?.relativeHeight || 0.19,
          imageData: sigRecord.signature_data.dataUrl || '',
          timestamp: sigRecord.signature_data.timestamp || sigRecord.signed_at,
          signatureSource: sigRecord.signature_source || 'canvas'
        })
      }
    })
    
    annotations = [...annotations, ...signatureAnnotations]
  }

  console.log("Loading view-signed document:", {
    documentId,
    recipientEmail,
    totalAnnotations: annotations.length,
    textAnnotations: annotations.filter((a: any) => a.type !== 'signature').length,
    signaturesFromDB: signatures?.length || 0,
    signaturesInAnnotations: annotations.filter((a: any) => a.type === 'signature').length,
    // Don't log full signature data to avoid console spam from base64 images
    signatureSummary: signatures?.map((sig: any) => ({
      id: sig.id,
      hasImageData: !!sig.signature_data?.dataUrl,
      position: sig.signature_data?.position,
      status: sig.status
    })),
    annotationSummary: annotations.map((a: any) => ({
      id: a.id,
      type: a.type,
      page: a.page,
      x: a.x,
      y: a.y,
      hasImageData: a.type === 'signature' ? !!a.imageData : undefined
    }))
  })

  // Get the current user for the sidebar
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="flex h-screen">
      {/* Main navigation sidebar (only show if user is authenticated) */}
      {user && <Sidebar user={user} />}
      
      {/* Main content area */}
      <div className="flex-1 flex" style={{ backgroundColor: '#F8F9FB' }}>
        {/* PDF viewer content */}
        <div className="flex-1 flex flex-col">
          <div className="flex-1" style={{ backgroundColor: '#F8F9FB' }}>
            <ClientWrapper
              documentUrl={documentUrl}
              documentName={document.file_name}
              documentId={documentId}
              annotations={annotations}
              token={token}
            />
          </div>
        </div>

        {/* Right sidebar with document details */}
        <DocumentSidebar
          document={document}
          request={request}
          recipientEmail={recipientEmail}
          signatures={signatures || []}
          annotations={annotations}
          requestId={requestId}
          documentUrl={documentUrl}
        />
      </div>
    </div>
  )
}
