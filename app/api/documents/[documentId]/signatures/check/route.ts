import { createAdminClient } from "@/utils/supabase/admin"
import { NextRequest, NextResponse } from "next/server"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const { token, includeData = false, requiredSignatureCount } = await req.json()
    const { documentId } = await params

    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 })
    }

    // Decode the token to get recipient email
    let recipientEmail: string
    try {
      recipientEmail = Buffer.from(token, "base64").toString("utf-8")
    } catch (error) {
      console.error("Error decoding token:", error)
      return NextResponse.json({ error: "Invalid token" }, { status: 400 })
    }

    console.log(`Checking signatures for document ${documentId} and recipient ${recipientEmail}`)

    const adminClient = createAdminClient()

    // Check if any signatures exist for this document
    // Special handling for different token types:
    // - "fast-sign-docs@view-all": Return ALL signatures for the document (for fast-sign-docs viewing)
    // - "fast-sign@local": Return ALL signatures for the document (for fast-sign editing)
    // - Regular email addresses: Filter by specific recipient_email (for sent-to-sign documents)
    const selectFields = includeData ? "*" : "id"
    let signaturesQuery = adminClient
      .from("document_signatures")
      .select(selectFields)
      .eq("document_id", documentId)
      .order('created_at', { ascending: false }) // Order by most recent first, same as print endpoint

    // Only filter by recipient_email if it's NOT a special token
    if (recipientEmail !== "fast-sign@local" && recipientEmail !== "fast-sign-docs@view-all") {
      signaturesQuery = signaturesQuery.eq("recipient_email", recipientEmail)
    }

    console.log(`🔍 Querying signatures for document ${documentId}, recipient filter: ${
      recipientEmail === "fast-sign@local" || recipientEmail === "fast-sign-docs@view-all" 
        ? 'ALL (special token)' 
        : recipientEmail
    }`)

    const { data: signatures, error: signatureError } = await signaturesQuery

    if (signatureError) {
      console.error("Error checking signatures:", signatureError)
      return NextResponse.json({ error: "Failed to check signatures" }, { status: 500 })
    }

    const hasSignatures = signatures && signatures.length > 0
    const signatureCount = signatures?.length || 0
    
    // Check if we have all required signatures
    const hasAllSignatures = requiredSignatureCount 
      ? signatureCount >= requiredSignatureCount 
      : hasSignatures

    console.log(`✅ Found ${signatureCount} signatures for document ${documentId}. Required: ${requiredSignatureCount || 'any'}. Recipient filter: ${
      recipientEmail === "fast-sign@local" || recipientEmail === "fast-sign-docs@view-all" 
        ? 'ALL (special token)' 
        : recipientEmail
    }`)

    // Detailed logging for troubleshooting
    if (signatures && signatures.length > 0) {
      signatures.forEach((sig: any, index: number) => {
        console.log(`  📝 Signature ${index}:`, {
          id: sig.id,
          status: sig.status,
          created_at: sig.created_at,
          updated_at: sig.updated_at,
          signed_at: sig.signed_at,
          recipient_email: sig.recipient_email,
          hasSignatureData: !!sig.signature_data,
          signatureDataType: sig.signature_data?.signatures ? 'array' : sig.signature_data?.dataUrl ? 'direct' : 'unknown',
          signaturesCount: sig.signature_data?.signatures?.length || 0,
          signatureIds: sig.signature_data?.signatures?.map((s: any) => s.id) || []
        })
      })
    } else {
      console.log(`  ⚠️ No signatures found for document ${documentId} with recipient filter: ${recipientEmail}`)
    }

    const response: any = { 
      hasSignatures,
      signatureCount,
      hasAllSignatures,
      requiredSignatureCount: requiredSignatureCount || null
    }

    // Include signature data if requested
    if (includeData && hasSignatures) {
      response.signatures = signatures
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error("Error in signature check API:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
