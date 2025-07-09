import { NextRequest, NextResponse } from "next/server"
import { createPublicClient } from "@/utils/supabase/public-client"
import { createAdminClient } from "@/utils/supabase/admin"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const { documentId } = await params
    const body = await request.json()
    const { annotations, token } = body

    console.log("Annotations API called:", { documentId, annotationCount: annotations?.length, hasToken: !!token })

    if (!annotations || !token) {
      return NextResponse.json(
        { error: "Missing annotations or token" },
        { status: 400 }
      )
    }

    // Decode the token to get recipient email
    let recipientEmail: string
    try {
      recipientEmail = Buffer.from(token, "base64").toString("utf-8")
      console.log("Decoded recipient email:", recipientEmail)
    } catch (error) {
      console.error("Invalid token:", error)
      return NextResponse.json(
        { error: "Invalid token" },
        { status: 400 }
      )
    }

    const supabase = createPublicClient()
    const adminClient = createAdminClient()

    // Verify the document exists
    const { data: document, error: docError } = await supabase
      .from("documents")
      .select("*")
      .eq("id", documentId)
      .single()

    if (docError || !document) {
      console.error("Document not found:", docError)
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      )
    }

    // Filter out any signatures from the annotations (they should go to document_signatures table)
    const textOnlyAnnotations = annotations.filter((ann: any) => ann.type !== 'signature')

    // Check if annotations record already exists for this document and recipient
    const { data: existingAnnotations } = await supabase
      .from("document_annotations")
      .select("*")
      .eq("document_id", documentId)
      .eq("recipient_email", recipientEmail)
      .single()

    if (existingAnnotations) {
      // Update existing annotations with text-only annotations
      const { error: updateError } = await adminClient
        .from("document_annotations")
        .update({
          annotations: textOnlyAnnotations,
          updated_at: new Date().toISOString(),
        })
        .eq("document_id", documentId)
        .eq("recipient_email", recipientEmail)

      if (updateError) {
        console.error("Error updating annotations:", updateError)
        return NextResponse.json(
          { error: "Failed to update annotations" },
          { status: 500 }
        )
      }
    } else {
      // Insert new annotations record (only if there are text annotations)
      if (textOnlyAnnotations.length > 0) {
        const { error: insertError } = await adminClient
          .from("document_annotations")
          .insert({
            document_id: documentId,
            recipient_email: recipientEmail,
            annotations: textOnlyAnnotations,
          })

        if (insertError) {
          console.error("Error inserting annotations:", insertError)
          return NextResponse.json(
            { error: "Failed to save annotations" },
            { status: 500 }
          )
        }
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

    console.log("Annotations saved successfully")
    return NextResponse.json(
      { success: true, message: "Annotations saved successfully" },
      { status: 200 }
    )

  } catch (error) {
    console.error("Error in annotations API:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ documentId: string }> }) {
  try {
    const { documentId } = await params
    const recipientEmail = request.nextUrl.searchParams.get("email")

    if (!documentId) {
      return NextResponse.json({ error: "Missing document ID" }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Get the annotations
    // If no email is provided, return ALL annotations for the document (for fast-sign-docs)
    // If email is provided, filter by specific recipient_email (for regular document viewing)
    let annotationsQuery = supabase
      .from("document_annotations")
      .select("annotations, recipient_email")
      .eq("document_id", documentId)

    // Only filter by recipient_email if email parameter is provided
    if (recipientEmail) {
      annotationsQuery = annotationsQuery.eq("recipient_email", recipientEmail)
    }

    const { data, error } = await annotationsQuery

    if (error && error.code !== "PGRST116") {
      // PGRST116 is "no rows returned" error
      console.error("Error fetching annotations:", error)
      return NextResponse.json({ error: "Error fetching annotations" }, { status: 500 })
    }

    // If no email filter was applied, combine all annotations from all recipients
    if (!recipientEmail && data && data.length > 0) {
      const allAnnotations = data.reduce((acc: any[], record: any) => {
        if (record.annotations && Array.isArray(record.annotations)) {
          return acc.concat(record.annotations)
        }
        return acc
      }, [])
      return NextResponse.json({ annotations: allAnnotations })
    }

    // If email filter was applied or only one record found, return the single record's annotations
    const singleRecord = Array.isArray(data) ? data[0] : data
    return NextResponse.json({ annotations: singleRecord?.annotations || [] })
  } catch (error) {
    console.error("Error fetching annotations:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "An unexpected error occurred" },
      { status: 500 },
    )
  }
}
