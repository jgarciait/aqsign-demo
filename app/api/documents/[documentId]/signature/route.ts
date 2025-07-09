import { NextRequest, NextResponse } from "next/server"
import { createPublicClient } from "@/utils/supabase/public-client"
import { createAdminClient } from "@/utils/supabase/admin"
import { randomUUID } from "crypto"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const { documentId } = await params
    const body = await request.json()

    console.log("=== SIGNATURE API CALLED ===")
    console.log("Document ID:", documentId)

    // Handle two different formats:
    // 1. consolidatedSignatureData: Multiple signatures in one record (fast-sign)
    // 2. signatureDataUrl: Single signature (sent-to-sign)
    const { consolidatedSignatureData, signatureDataUrl, signatureSource, token, position } = body

    console.log("Has consolidatedSignatureData:", !!consolidatedSignatureData)
    console.log("Has signatureDataUrl:", !!signatureDataUrl)
    console.log("Has token:", !!token)

    if (!token) {
      return NextResponse.json({ error: "Missing token" }, { status: 400 })
    }

    if (!consolidatedSignatureData && !signatureDataUrl) {
      return NextResponse.json({ error: "Missing signature data" }, { status: 400 })
    }

    // Decode the token to get recipient email
    let recipientEmail: string
    try {
      recipientEmail = Buffer.from(token, "base64").toString("utf-8")
    } catch (error) {
      console.error("Invalid token:", error)
      return NextResponse.json({ error: "Invalid token" }, { status: 400 })
    }

    console.log("Decoded recipient email:", recipientEmail)

    const adminClient = createAdminClient()

    // Handle special tokens - when using "fast-sign-docs@view-all", save signatures as "fast-sign@local"
    const effectiveRecipientEmail = recipientEmail === "fast-sign-docs@view-all" ? "fast-sign@local" : recipientEmail

    // Handle consolidated signature data (multiple signatures in one record)
    if (consolidatedSignatureData) {
      console.log("Processing consolidated signature data...")
      console.log("Number of signatures:", consolidatedSignatureData.signatures?.length || 0)

      if (!consolidatedSignatureData.signatures || consolidatedSignatureData.signatures.length === 0) {
        return NextResponse.json({ error: "No signatures provided in consolidated data" }, { status: 400 })
      }

      // Create a single signature record with all signatures
      const { data: signatureRecord, error: signatureError } = await adminClient
        .from("document_signatures")
        .insert({
          document_id: documentId,
          recipient_email: effectiveRecipientEmail,
          status: "signed",
          signed_at: new Date().toISOString(),
          signature_data: consolidatedSignatureData,
          signature_source: "canvas",
        })
        .select()
        .single()

      if (signatureError) {
        console.error("Error creating consolidated signature record:", signatureError)
        return NextResponse.json({ error: "Failed to save signatures" }, { status: 500 })
      }

      console.log("✅ Consolidated signature record created successfully")
      console.log("Signature record ID:", signatureRecord.id)

      // Update the document's status and updated_at timestamp
      const { error: docUpdateError } = await adminClient
        .from("documents")
        .update({
          status: "signed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", documentId)

      if (docUpdateError) {
        console.warn("Failed to update document status:", docUpdateError)
        // Don't fail the request if document update fails
      }

      return NextResponse.json(
        { success: true, message: "Signatures saved successfully", signatureId: signatureRecord.id },
        { status: 200 }
      )
    }

    // Handle single signature data (original format)
    if (signatureDataUrl) {
      console.log("Processing single signature data...")
      console.log("Signature source:", signatureSource)
      console.log("Position:", position)
      console.log("Signature data length:", signatureDataUrl.length)

      if (!signatureSource || !position) {
        return NextResponse.json({ error: "Missing signature source or position" }, { status: 400 })
      }

      // Generate a unique ID for this signature
      const signatureId = crypto.randomUUID()
      console.log("Generated signature ID:", signatureId)

      // Create signature data in the new format
      const signatureData = {
        signatures: [{
          id: signatureId,
          dataUrl: signatureDataUrl,
          source: signatureSource,
          position: position,
          timestamp: new Date().toISOString(),
        }]
      }

      try {
        // Try to get existing signature record for this document and recipient
        const { data: existingSignature, error: fetchError } = await adminClient
          .from("document_signatures")
          .select("*")
          .eq("document_id", documentId)
          .eq("recipient_email", effectiveRecipientEmail)
          .single()

        if (fetchError && fetchError.code !== "PGRST116") {
          // Error other than "no rows found"
          console.error("Error checking existing signature:", fetchError)
          return NextResponse.json({ error: "Database error" }, { status: 500 })
        }

        if (existingSignature) {
          console.log("Found existing signature record, updating...")
          // Update existing record by adding new signature to the signatures array
          const currentSignatures = existingSignature.signature_data?.signatures || []
          const updatedSignatures = [...currentSignatures, signatureData.signatures[0]]
          
          const { error: updateError } = await adminClient
            .from("document_signatures")
            .update({
              signature_data: { signatures: updatedSignatures },
              updated_at: new Date().toISOString(),
            })
            .eq("id", existingSignature.id)

          if (updateError) {
            console.error("Error updating signature:", updateError)
            return NextResponse.json({ error: "Failed to update signature" }, { status: 500 })
          }

          console.log("✅ Signature updated successfully")
        } else {
          console.log("No existing signature record, creating new one...")
          // Create new signature record
          const { error: createError } = await adminClient
            .from("document_signatures")
            .insert({
              document_id: documentId,
              recipient_email: effectiveRecipientEmail,
              status: "signed",
              signed_at: new Date().toISOString(),
              signature_data: signatureData,
              signature_source: signatureSource,
            })

          if (createError) {
            console.error("Error creating signature:", createError)
            return NextResponse.json({ error: "Failed to create signature" }, { status: 500 })
          }

          console.log("✅ Signature created successfully")
        }

      } catch (error) {
        console.error("Error processing signature:", error)
        return NextResponse.json({ error: "Failed to save signature" }, { status: 500 })
      }

      // Update the document's status and updated_at timestamp
      const { error: docUpdateError } = await adminClient
        .from("documents")
        .update({
          status: "signed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", documentId)

      if (docUpdateError) {
        console.warn("Failed to update document status:", docUpdateError)
        // Don't fail the request if document update fails
      }

      return NextResponse.json(
        { success: true, message: "Signature saved successfully", signatureId: signatureId },
        { status: 200 }
      )
    }

    return NextResponse.json({ error: "Invalid request format" }, { status: 400 })

  } catch (error) {
    console.error("Error in signature API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// UPDATE signature position/size
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const { documentId } = await params
    const body = await request.json()
    const { signatureId, token, position } = body

    console.log("=== SIGNATURE PUT API CALLED ===")
    console.log("Document ID:", documentId)
    console.log("Signature ID:", signatureId)
    console.log("Position to update:", position)

    if (!signatureId || !token || !position) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    // Decode the token to get recipient email
    let recipientEmail: string
    try {
      recipientEmail = Buffer.from(token, "base64").toString("utf-8")
    } catch (error) {
      console.error("Invalid token:", error)
      return NextResponse.json(
        { error: "Invalid token" },
        { status: 400 }
      )
    }

    const adminClient = createAdminClient()

    // Handle special token - when using "fast-sign-docs@view-all", work with "fast-sign@local"
    const effectiveRecipientEmail = recipientEmail === "fast-sign-docs@view-all" ? "fast-sign@local" : recipientEmail

    // Get the existing signature record to find and update the specific signature
    const { data: existingSignature, error: fetchError } = await adminClient
      .from("document_signatures")
      .select("signature_data")
      .eq("document_id", documentId)
      .eq("recipient_email", effectiveRecipientEmail)
      .single()

    if (fetchError || !existingSignature) {
      console.error("Error fetching existing signature record:", fetchError)
      return NextResponse.json(
        { error: "Signature record not found" },
        { status: 404 }
      )
    }

    // Handle both old and new signature formats
    let updatedSignatureData
    
    if (existingSignature.signature_data?.signatures) {
      // New format: signatures array - find and update the specific signature
      const signatures = existingSignature.signature_data.signatures
      const signatureIndex = signatures.findIndex((sig: any) => sig.id === signatureId)
      
      if (signatureIndex === -1) {
        return NextResponse.json(
          { error: "Signature not found in signatures array" },
          { status: 404 }
        )
      }
      
      // Update the specific signature's position while preserving other data
      const updatedSignatures = [...signatures]
      const oldSignature = updatedSignatures[signatureIndex]
      console.log("Old signature data:", oldSignature)
      
      updatedSignatures[signatureIndex] = {
        ...updatedSignatures[signatureIndex],
        position: {
          ...updatedSignatures[signatureIndex].position,
          ...position
        },
        timestamp: new Date().toISOString()
      }
      
      console.log("Updated signature data:", updatedSignatures[signatureIndex])
      
      updatedSignatureData = {
        signatures: updatedSignatures
      }
    } else {
      // Old format: direct signature data - update position while preserving dataUrl
      updatedSignatureData = {
        dataUrl: existingSignature.signature_data?.dataUrl,
        position: {
          ...existingSignature.signature_data?.position,
          ...position
        },
        timestamp: new Date().toISOString()
      }
    }

    // Update the signature record
    const { error: updateError } = await adminClient
      .from("document_signatures")
      .update({
        signature_data: updatedSignatureData
      })
      .eq("document_id", documentId)
      .eq("recipient_email", effectiveRecipientEmail)

    if (updateError) {
      console.error("Error updating signature:", updateError)
      return NextResponse.json(
        { error: "Failed to update signature" },
        { status: 500 }
      )
    }

    // Update the document's updated_at timestamp
    const { error: docUpdateError } = await adminClient
      .from("documents")
      .update({
        updated_at: new Date().toISOString(),
      })
      .eq("id", documentId)

    if (docUpdateError) {
      console.warn("Failed to update document timestamp:", docUpdateError)
      // Don't fail the request if document timestamp update fails
    }

    console.log("✅ Signature position updated successfully in database")
    return NextResponse.json(
      { success: true, message: "Signature updated successfully" },
      { status: 200 }
    )

  } catch (error) {
    console.error("Error in signature UPDATE API:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// DELETE signature
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const { documentId } = await params
    const body = await request.json()
    const { signatureId, token, clearAll } = body

    if (!token) {
      return NextResponse.json(
        { error: "Missing token" },
        { status: 400 }
      )
    }

    // Decode the token to get recipient email
    let recipientEmail: string
    try {
      recipientEmail = Buffer.from(token, "base64").toString("utf-8")
    } catch (error) {
      console.error("Invalid token:", error)
      return NextResponse.json(
        { error: "Invalid token" },
        { status: 400 }
      )
    }

    const adminClient = createAdminClient()

    if (clearAll) {
      // Handle special token - when using "fast-sign-docs@view-all", clear ALL signatures for this document
      if (recipientEmail === "fast-sign-docs@view-all") {
        console.log("Clearing ALL signatures for document (special token)")
        const { error: deleteError } = await adminClient
          .from("document_signatures")
          .delete()
          .eq("document_id", documentId)

        if (deleteError) {
          console.error("Error clearing all signatures:", deleteError)
          return NextResponse.json(
            { error: "Failed to clear signatures" },
            { status: 500 }
          )
        }
      } else {
        // Clear signatures for specific recipient
        console.log("Clearing signatures for recipient:", recipientEmail)
        const { error: deleteError } = await adminClient
          .from("document_signatures")
          .delete()
          .eq("document_id", documentId)
          .eq("recipient_email", recipientEmail)

        if (deleteError) {
          console.error("Error clearing signatures:", deleteError)
          return NextResponse.json(
            { error: "Failed to clear signatures" },
            { status: 500 }
          )
        }
      }

      return NextResponse.json(
        { success: true, message: "All signatures cleared successfully" },
        { status: 200 }
      )
    } else if (signatureId) {
      // Handle special token for specific signature deletion
      const effectiveRecipientEmail = recipientEmail === "fast-sign-docs@view-all" ? "fast-sign@local" : recipientEmail
      
      // Delete specific signature from the signatures array
      const { data: existingSignature } = await adminClient
        .from("document_signatures")
        .select("*")
        .eq("document_id", documentId)
        .eq("recipient_email", effectiveRecipientEmail)
        .single()

      if (!existingSignature) {
        return NextResponse.json(
          { error: "Signature record not found" },
          { status: 404 }
        )
      }

      // Remove the specific signature from the array
      const signatures = existingSignature.signature_data?.signatures || []
      const updatedSignatures = signatures.filter((sig: any) => sig.id !== signatureId)

      if (updatedSignatures.length === 0) {
        // If no signatures left, delete the entire record
        const { error: deleteError } = await adminClient
          .from("document_signatures")
          .delete()
          .eq("document_id", documentId)
          .eq("recipient_email", effectiveRecipientEmail)

        if (deleteError) {
          console.error("Error deleting signature record:", deleteError)
          return NextResponse.json(
            { error: "Failed to delete signature record" },
            { status: 500 }
          )
        }
      } else {
        // Update the record with the remaining signatures
        const { error: updateError } = await adminClient
          .from("document_signatures")
          .update({
            signature_data: { signatures: updatedSignatures }
          })
          .eq("document_id", documentId)
          .eq("recipient_email", effectiveRecipientEmail)

        if (updateError) {
          console.error("Error updating signature record:", updateError)
          return NextResponse.json(
            { error: "Failed to update signature record" },
            { status: 500 }
          )
        }
      }

      // Update the document's updated_at timestamp
      const { error: docUpdateError } = await adminClient
        .from("documents")
        .update({
          updated_at: new Date().toISOString(),
        })
        .eq("id", documentId)

      if (docUpdateError) {
        console.warn("Failed to update document timestamp:", docUpdateError)
        // Don't fail the request if document timestamp update fails
      }

      return NextResponse.json(
        { success: true, message: "Signature deleted successfully" },
        { status: 200 }
      )
    } else {
      return NextResponse.json(
        { error: "Missing signature ID or clearAll flag" },
        { status: 400 }
      )
    }

  } catch (error) {
    console.error("Error in signature DELETE API:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
