import { createAdminClient } from "@/utils/supabase/admin"
import { NextRequest, NextResponse } from "next/server"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const { token, updateStatus = false } = await req.json()
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

    console.log(`Sending document ${documentId} for recipient ${recipientEmail}. Update status: ${updateStatus}`)

    const adminClient = createAdminClient()

    // Find the request record that references this document
    const { data: request, error: requestError } = await adminClient
      .from("requests")
      .select("id, status, customer:customer_id(email)")
      .eq("document_id", documentId)
      .single()

    if (requestError || !request) {
      console.error("Error finding request:", requestError)
      return NextResponse.json({ error: "Request not found" }, { status: 404 })
    }

    // Verify the recipient email matches
    const customerEmail = (request.customer as any)?.email
    if (customerEmail !== recipientEmail) {
      console.error("Email mismatch:", { customerEmail, recipientEmail })
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    // Check if already sent and not resent
    if (request.status === "returned" || request.status === "RETURNED") {
      return NextResponse.json({ error: "Document already sent" }, { status: 400 })
    }

    const currentTime = new Date().toISOString()
    
    // Determine the status based on whether this is a signing completion
    const newStatus = updateStatus ? "signed" : "returned"
    const statusField = updateStatus ? "signed_at" : "returned_at"

    // Update the request status
    const updateData: any = {
      status: newStatus,
      [statusField]: currentTime,
    }

    const { error: updateError } = await adminClient
      .from("requests")
      .update(updateData)
      .eq("id", request.id)

    if (updateError) {
      console.error("Error updating request:", updateError)
      return NextResponse.json({ error: "Failed to update request" }, { status: 500 })
    }

    // Also update request_details view if it exists
    const { error: requestDetailsError } = await adminClient
      .from("request_details")
      .update(updateData)
      .eq("id", request.id)

    if (requestDetailsError) {
      console.warn("Could not update request_details:", requestDetailsError)
      // Don't fail the whole operation if request_details update fails
    }

    // Update document status if this is a signing completion
    if (updateStatus) {
      const { error: docUpdateError } = await adminClient
        .from("documents")
        .update({
          status: "signed",
          updated_at: currentTime
        })
        .eq("id", documentId)

      if (docUpdateError) {
        console.warn("Warning: Failed to update document status:", docUpdateError)
      }
    }

    // Update signing_requests status
    const signingRequestStatus = updateStatus ? "signed" : "completed"
    const signingRequestUpdate: any = {
      status: signingRequestStatus,
      updated_at: currentTime
    }

    if (updateStatus) {
      signingRequestUpdate.signed_at = currentTime
    }

    const { error: invalidateError } = await adminClient
      .from("signing_requests")
      .update(signingRequestUpdate)
      .eq("document_id", documentId)
      .eq("recipient_email", recipientEmail)

    if (invalidateError) {
      console.warn("Warning: Failed to update signing requests:", invalidateError)
      // Don't fail the whole operation for this
    }

    const message = updateStatus 
      ? "Document signed and statuses updated successfully"
      : "Document sent successfully"

    console.log(`Document ${documentId} successfully processed by ${recipientEmail}. Status: ${newStatus}`)

    return NextResponse.json({ 
      success: true, 
      message,
      status: newStatus,
      timestamp: currentTime
    })

  } catch (error) {
    console.error("Error in send document API:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
