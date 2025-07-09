import { createAdminClient } from "@/utils/supabase/admin"
import { type NextRequest, NextResponse } from "next/server"
import { BUCKET_PUBLIC } from "@/utils/supabase/storage"
import { PDFDocument, rgb } from 'pdf-lib'
import { encodeFileNameForHeader } from "@/utils/file-utils"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  console.log('Print API: Route called!')
  
  const { documentId } = await params
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')
  const requestId = searchParams.get('requestId')

  console.log('Print API: Parameters:', { documentId, token: token ? 'present' : 'missing', requestId })

  if (!token || !requestId) {
    console.log('Print API: Missing required parameters')
    return NextResponse.json({ error: 'Missing token or requestId' }, { status: 400 })
  }

  // Decode the token to get recipient email
  let recipientEmail: string
  try {
    recipientEmail = Buffer.from(token, "base64").toString("utf-8")
    console.log('Print API: Decoded recipient email:', recipientEmail)
  } catch (error) {
    console.log('Print API: Failed to decode token:', error)
    return NextResponse.json({ error: 'Invalid token' }, { status: 400 })
  }



  const adminClient = createAdminClient()

  try {
    console.log(`Print API: Processing document ${documentId} for user ${recipientEmail}`)
    
    // Get document details
    const { data: document, error: documentError } = await adminClient
      .from("documents")
      .select("*")
      .eq("id", documentId)
      .single()

    if (documentError || !document) {
      console.error('Print API: Document not found:', documentError)
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    console.log(`Print API: Found document ${document.file_name}`)

    // Get request details to verify access
    const { data: requestDetails, error: requestError } = await adminClient
      .from("request_details")
      .select("*")
      .eq("id", requestId)
      .eq("document_id", documentId)
      .single()

    if (requestError || !requestDetails) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    }

    // Verify the recipient email matches
    if (requestDetails.customer_email !== recipientEmail) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Check if document has been signed
    if (requestDetails.status !== "signed" && requestDetails.status !== "returned") {
      return NextResponse.json({ error: 'Document not signed yet' }, { status: 400 })
    }

    // Get the original PDF file
    const { data: pdfData, error: downloadError } = await adminClient.storage
      .from(BUCKET_PUBLIC)
      .download(document.file_path)

    if (downloadError || !pdfData) {
      return NextResponse.json({ error: 'Failed to download document' }, { status: 500 })
    }

    // Get text annotations (excluding signatures)
    const { data: annotationData, error: annotationError } = await adminClient
      .from("document_annotations")
      .select("annotations")
      .eq("document_id", documentId)
      .eq("recipient_email", recipientEmail)
      .single()

    // Get signatures from document_signatures table
    const { data: signatures, error: signaturesError } = await adminClient
      .from("document_signatures")
      .select("*")
      .eq("document_id", documentId)
      .eq("recipient_email", recipientEmail)
      .eq("status", "signed")

    if (signaturesError) {
      console.error("Error fetching signatures:", signaturesError)
    }

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
            signatureAnnotations.push({
              id: sig.id,
              type: 'signature' as const,
              x: sig.position?.x || 100,
              y: sig.position?.y || 100,
              width: sig.position?.width || 300,
              height: sig.position?.height || 150,
              page: sig.position?.page || 1,
              relativeX: sig.position?.relativeX || 0.15,
              relativeY: sig.position?.relativeY || 0.15,
              relativeWidth: sig.position?.relativeWidth || 0.49,
              relativeHeight: sig.position?.relativeHeight || 0.19,
              imageData: sig.dataUrl || '',
              timestamp: sig.timestamp || sigRecord.signed_at,
              signatureSource: sig.source || sigRecord.signature_source || 'canvas'
            })
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

    // Load the PDF document
    const pdfBytes = await pdfData.arrayBuffer()
    const pdfDoc = await PDFDocument.load(pdfBytes)
    const pages = pdfDoc.getPages()

    console.log(`Processing PDF with ${pages.length} pages and ${annotations.length} annotations`)

    // Process each annotation
    for (const annotation of annotations) {
      const pageIndex = (annotation.page || 1) - 1 // Convert to 0-based index
      
      if (pageIndex < 0 || pageIndex >= pages.length) {
        console.warn(`Annotation page ${annotation.page} is out of range (PDF has ${pages.length} pages)`)
        continue
      }

      const page = pages[pageIndex]
      const { width: pageWidth, height: pageHeight } = page.getSize()

      if (annotation.type === 'signature' && annotation.imageData) {
        try {
          // Extract base64 data from data URL
          const base64Data = annotation.imageData.split(',')[1]
          if (!base64Data) {
            console.warn('Invalid signature image data')
            continue
          }

          // Convert base64 to bytes
          const imageBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0))
          
          // Embed the image
          let image
          if (annotation.imageData.includes('data:image/png')) {
            image = await pdfDoc.embedPng(imageBytes)
          } else if (annotation.imageData.includes('data:image/jpeg') || annotation.imageData.includes('data:image/jpg')) {
            image = await pdfDoc.embedJpg(imageBytes)
          } else {
            // Default to PNG
            image = await pdfDoc.embedPng(imageBytes)
          }

          // Calculate position and size
          let x, y, width, height

          if (annotation.relativeX !== undefined && annotation.relativeY !== undefined) {
            // Use relative positioning
            x = annotation.relativeX * pageWidth
            y = pageHeight - (annotation.relativeY * pageHeight) - (annotation.height || 150)
            width = annotation.width || 300
            height = annotation.height || 150
          } else {
            // Use absolute positioning (legacy)
            x = annotation.x || 100
            y = pageHeight - (annotation.y || 100) - (annotation.height || 150)
            width = annotation.width || 300
            height = annotation.height || 150
          }

          // Ensure the signature fits within the page
          if (x + width > pageWidth) {
            width = pageWidth - x
          }
          if (y < 0) {
            height = height + y
            y = 0
          }

          // Draw the signature image
          page.drawImage(image, {
            x,
            y,
            width,
            height,
          })

          console.log(`Added signature to page ${annotation.page} at position (${x}, ${y}) with size ${width}x${height}`)
        } catch (error) {
          console.error('Error adding signature to PDF:', error)
        }
      } else if (annotation.type === 'text' && annotation.text) {
        try {
          // Calculate position
          let x, y

          if (annotation.relativeX !== undefined && annotation.relativeY !== undefined) {
            x = annotation.relativeX * pageWidth
            y = pageHeight - (annotation.relativeY * pageHeight) - 20 // Adjust for text height
          } else {
            x = annotation.x || 100
            y = pageHeight - (annotation.y || 100) - 20
          }

          // Draw text annotation
          page.drawText(annotation.text, {
            x,
            y,
            size: annotation.fontSize || 12,
            color: rgb(0, 0, 0), // Black text
          })

          console.log(`Added text annotation "${annotation.text}" to page ${annotation.page}`)
        } catch (error) {
          console.error('Error adding text annotation to PDF:', error)
        }
      }
    }

    // Save the modified PDF
    const modifiedPdfBytes = await pdfDoc.save()
    
    console.log(`Print API: Successfully created merged PDF with ${annotations.length} annotations (${annotations.filter((a: any) => a.type === 'signature').length} signatures)`)

    // Return the modified PDF
    return new NextResponse(modifiedPdfBytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; ${encodeFileNameForHeader(`SIGNED_${document.file_name}`)}`,
        "X-Document-Status": "signed",
        "X-Signature-Count": String(signatures?.length || 0),
        "X-Signed-By": `${requestDetails.customer_first_name} ${requestDetails.customer_last_name}`,
        "X-Signed-Date": requestDetails.signed_at || '',
        "Cache-Control": "no-cache, no-store, must-revalidate", // Prevent caching during development
        "Access-Control-Allow-Origin": "*",
      },
    })
  } catch (error) {
    console.error('Error in print endpoint:', error)
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
