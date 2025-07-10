import { NextResponse } from "next/server"
import { createAdminClient } from "@/utils/supabase/admin"
import { BUCKET_PUBLIC } from "@/utils/supabase/storage"
import { PDFDocument, rgb } from 'pdf-lib'
import { encodeFileNameForHeader } from "@/utils/file-utils"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  console.log('Fast Sign Print API: Route called!')
  
  try {
    console.log('Fast Sign Print API: Extracting params...')
    const { documentId } = await params
    console.log(`Fast Sign Print API: Document ID: ${documentId}`)
    
    if (!documentId) {
      console.error('Fast Sign Print API: No document ID provided')
      return NextResponse.json({ error: 'Document ID is required' }, { status: 400 })
    }
    
    console.log('Fast Sign Print API: Creating admin client...')
    const adminClient = createAdminClient()
    
    console.log(`Fast Sign Print API: Processing document ${documentId}`)
    
    // Get document details with better error handling
    let document
    try {
      const { data: documentData, error: documentError } = await adminClient
        .from("documents")
        .select("*")
        .eq("id", documentId)
        .single()

      if (documentError) {
        console.error('Fast Sign Print API: Database error getting document:', documentError)
        return NextResponse.json({ 
          error: 'Database error retrieving document',
          details: documentError.message 
        }, { status: 500 })
      }

      if (!documentData) {
        console.error('Fast Sign Print API: Document not found:', documentId)
        return NextResponse.json({ error: 'Document not found' }, { status: 404 })
      }

      document = documentData
      console.log(`Fast Sign Print API: Found document ${document.file_name}`)
    } catch (error) {
      console.error('Fast Sign Print API: Exception getting document:', error)
      return NextResponse.json({ 
        error: 'Failed to retrieve document',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 })
    }

    // Get the original PDF file with better error handling
    let pdfData
    try {
      console.log(`Fast Sign Print API: Attempting to download from path: ${document.file_path}`)
      console.log(`Fast Sign Print API: Document file name: ${document.file_name}`)
      
      const { data: downloadData, error: downloadError } = await adminClient.storage
        .from(BUCKET_PUBLIC)
        .download(document.file_path)

      if (downloadError) {
        console.error('Fast Sign Print API: Storage error downloading document:', downloadError)
        return NextResponse.json({ 
          error: 'Storage error downloading document',
          details: downloadError.message,
          file_path: document.file_path
        }, { status: 500 })
      }

      if (!downloadData) {
        console.error('Fast Sign Print API: No data returned from storage')
        return NextResponse.json({ 
          error: 'No data returned from storage',
          file_path: document.file_path
        }, { status: 500 })
      }

      pdfData = downloadData
      console.log(`Fast Sign Print API: Downloaded PDF successfully, size: ${pdfData.size} bytes`)
    } catch (error) {
      console.error('Fast Sign Print API: Exception downloading document:', error)
      return NextResponse.json({ 
        error: 'Failed to download document',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 })
    }

    // Get signatures for this document with better error handling
    let signatures
    try {
      console.log('Querying signatures for document:', documentId)
      
      // First, let's check what's actually in the database for this document
      const { data: allSignatures, error: allSigError } = await adminClient
        .from('document_signatures')
        .select('*')
        .eq('document_id', documentId)
      
      if (allSigError) {
        console.warn('Fast Sign Print API: Error querying all signatures:', allSigError)
      } else {
        console.log('All signatures for this document:', allSignatures)
      }
      
      // Now query for ALL signatures for this document (not just fast-sign@local)
      const { data: signaturesData, error: sigError } = await adminClient
        .from('document_signatures')
        .select('*')
        .eq('document_id', documentId)

      if (sigError) {
        console.error('Fast Sign Print API: Database error fetching signatures:', sigError)
        // Don't fail the request for missing signatures, just log it
        signatures = []
      } else {
        signatures = signaturesData || []
      }

      console.log(`Fast Sign Print API: Found ${signatures.length} signature records`)
      if (signatures.length > 0) {
        signatures.forEach((sig: any, index: number) => {
          console.log(`  Signature record ${index}:`, {
            id: sig.id,
            hasSignatureData: !!sig.signature_data,
            signatureDataType: sig.signature_data?.signatures ? 'array' : sig.signature_data?.dataUrl ? 'direct' : 'unknown',
            signaturesCount: sig.signature_data?.signatures?.length || 0
          })
        })
      }
    } catch (error) {
      console.error('Fast Sign Print API: Exception fetching signatures:', error)
      // Don't fail the request for missing signatures, just log it
      signatures = []
    }

    // Get text annotations for this document directly from database with better error handling
    let annotationData = null
    try {
      const { data: textAnnotations, error: annotationError } = await adminClient
        .from('document_annotations')
        .select('*')
        .eq('document_id', documentId)

      if (annotationError) {
        console.warn('Fast Sign Print API: Failed to fetch text annotations:', annotationError)
      } else if (textAnnotations && textAnnotations.length > 0) {
        // Convert to the expected format
        annotationData = {
          annotations: textAnnotations.map((ann: any) => ({
            id: ann.id,
            type: ann.annotation_type || 'text',
            x: ann.x,
            y: ann.y,
            width: ann.width,
            height: ann.height,
            page: ann.page,
            text: ann.text,
            fontSize: ann.font_size,
            relativeX: ann.relative_x,
            relativeY: ann.relative_y
          }))
        }
        console.log(`Found ${textAnnotations.length} text annotations`)
      } else {
        console.log('No text annotations found')
      }
    } catch (error) {
      console.warn('Fast Sign Print API: Exception fetching text annotations:', error)
    }

    // Collect all annotations (text annotations from document_annotations + signatures from document_signatures)
    let annotations: any[] = []

    try {
      // Add text annotations if any (filter out any signatures that might be there)
      if (annotationData?.annotations && Array.isArray(annotationData.annotations)) {
        annotations.push(...annotationData.annotations.filter((ann: any) => ann.type !== 'signature'))
      }

      // Add signatures from document_signatures table
      if (signatures && signatures.length > 0) {
        signatures.forEach((sigRecord: any) => {
          console.log('Processing signature record:', {
            id: sigRecord.id,
            hasSignatureData: !!sigRecord.signature_data,
            signatureDataKeys: sigRecord.signature_data ? Object.keys(sigRecord.signature_data) : []
          })
          
          try {
            if (sigRecord.signature_data?.signatures) {
              // New format: signatures array
              console.log(`  Processing ${sigRecord.signature_data.signatures.length} signatures from array format`)
              sigRecord.signature_data.signatures.forEach((sig: any, sigIndex: number) => {
                console.log(`    Processing signature ${sigIndex}:`, {
                  id: sig.id,
                  hasDataUrl: !!sig.dataUrl,
                  hasPosition: !!sig.position,
                  page: sig.position?.page
                })
                annotations.push({
                  id: sig.id,
                  type: 'signature',
                  x: sig.position?.x,
                  y: sig.position?.y,
                  width: sig.position?.width || 200,
                  height: sig.position?.height || 100,
                  page: sig.position?.page || 1,
                  relativeX: sig.position?.relativeX,
                  relativeY: sig.position?.relativeY,
                  relativeWidth: sig.position?.relativeWidth,
                  relativeHeight: sig.position?.relativeHeight,
                  imageData: sig.dataUrl || '',
                  timestamp: sig.timestamp || sigRecord.signed_at,
                  signatureSource: sig.source || sigRecord.signature_source || 'canvas'
                })
              })
            } else if (sigRecord.signature_data?.dataUrl) {
              // Old format: direct signature data
              console.log(`  Processing old format signature in record ${sigRecord.id}`)
              annotations.push({
                id: sigRecord.id,
                type: 'signature',
                x: sigRecord.signature_data.position?.x,
                y: sigRecord.signature_data.position?.y,
                width: sigRecord.signature_data.position?.width || 200,
                height: sigRecord.signature_data.position?.height || 100,
                page: sigRecord.signature_data.position?.page || 1,
                relativeX: sigRecord.signature_data.position?.relativeX,
                relativeY: sigRecord.signature_data.position?.relativeY,
                relativeWidth: sigRecord.signature_data.position?.relativeWidth,
                relativeHeight: sigRecord.signature_data.position?.relativeHeight,
                imageData: sigRecord.signature_data.dataUrl || '',
                timestamp: sigRecord.signature_data.timestamp || sigRecord.signed_at,
                signatureSource: sigRecord.signature_source || 'canvas'
              })
            } else {
              console.log('  Warning: Signature record has no valid signature data')
            }
          } catch (error) {
            console.error('Fast Sign Print API: Error processing individual signature record:', error)
            // Continue processing other signatures
          }
        })
      }
    } catch (error) {
      console.error('Fast Sign Print API: Error processing signature records:', error)
      return NextResponse.json({ 
        error: 'Failed to process signature data',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 })
    }

    console.log(`Total annotations to process: ${annotations.length}`)
    console.log('Signature annotations:', annotations.filter(a => a.type === 'signature').map(a => ({
      id: a.id,
      page: a.page,
      hasImageData: !!a.imageData,
      imageDataLength: a.imageData?.length || 0
    })))

    // Load the PDF document with better error handling
    let pdfDoc, pages
    try {
      const pdfBytes = await pdfData.arrayBuffer()
      console.log(`Fast Sign Print API: PDF file size: ${pdfBytes.byteLength} bytes`)
      
      pdfDoc = await PDFDocument.load(pdfBytes)
      pages = pdfDoc.getPages()
      console.log(`Fast Sign Print API: PDF loaded successfully, ${pages.length} pages`)
    } catch (pdfError) {
      console.error('Fast Sign Print API: Error loading PDF:', pdfError)
      console.error('Fast Sign Print API: PDF file path:', document.file_path)
      console.error('Fast Sign Print API: PDF file name:', document.file_name)
      return NextResponse.json({ 
        error: 'Failed to load PDF document',
        details: pdfError instanceof Error ? pdfError.message : 'Unknown PDF error'
      }, { status: 500 })
    }

    // Process each annotation with better error handling
    for (const annotation of annotations) {
      try {
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

            // Calculate position and dimensions with CORRECT PDF coordinate system conversion
            let x, y, width, height
            
            // PDF coordinate system: (0,0) is bottom-left
            // Web coordinate system: (0,0) is top-left  
            // We need to convert from web coordinates (stored in DB) to PDF coordinates
            if (annotation.relativeX !== undefined && annotation.relativeY !== undefined) {
              x = annotation.relativeX * pageWidth
              // Convert Y from web coordinates (0=top) to PDF coordinates (0=bottom)
              y = pageHeight - (annotation.relativeY * pageHeight) - ((annotation.relativeHeight || 0.08) * pageHeight)
              width = (annotation.relativeWidth || 0.2) * pageWidth
              height = (annotation.relativeHeight || 0.08) * pageHeight
            } else {
              // Fallback to absolute coordinates (legacy) - also need Y conversion
              x = annotation.x || 100
              y = pageHeight - (annotation.y || 100) - (annotation.height || 100)
              width = annotation.width || 200
              height = annotation.height || 100
            }
            
            console.log(`Fast Sign Print: Converting web coordinates to PDF coordinates for signature ${annotation.id}:`, {
              original: {
                relativeX: annotation.relativeX,
                relativeY: annotation.relativeY,
                relativeWidth: annotation.relativeWidth,
                relativeHeight: annotation.relativeHeight
              },
              pageSize: { pageWidth, pageHeight },
              calculated: { x, y, width, height }
            })

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

          } catch (error) {
            console.error('Fast Sign Print API: Error adding signature to PDF:', error)
            // Continue processing other annotations
          }
        } else if (annotation.type === 'text' && annotation.text) {
          try {
            // Calculate position with PDF coordinate system conversion
            let x, y

            if (annotation.relativeX !== undefined && annotation.relativeY !== undefined) {
              x = annotation.relativeX * pageWidth
              // Convert Y from web coordinates to PDF coordinates  
              y = pageHeight - (annotation.relativeY * pageHeight) - 20 // Account for text height
            } else {
              x = annotation.x || 100
              y = pageHeight - (annotation.y || 100) - 20 // Convert legacy coordinates too
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
            console.error('Fast Sign Print API: Error adding text annotation to PDF:', error)
            // Continue processing other annotations
          }
        }
      } catch (error) {
        console.error('Fast Sign Print API: Error processing annotation:', error)
        // Continue processing other annotations
      }
    }

    // Save the modified PDF with better error handling
    let modifiedPdfBytes
    try {
      modifiedPdfBytes = await pdfDoc.save()
      console.log(`Fast Sign Print API: Modified PDF saved successfully, size: ${modifiedPdfBytes.length} bytes`)
    } catch (saveError) {
      console.error('Fast Sign Print API: Error saving modified PDF:', saveError)
      return NextResponse.json({ 
        error: 'Failed to save modified PDF',
        details: saveError instanceof Error ? saveError.message : 'Unknown save error'
      }, { status: 500 })
    }

    // Return the modified PDF
    return new NextResponse(modifiedPdfBytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; ${encodeFileNameForHeader(`SIGNED_${document.file_name}`)}`,
        "X-Document-Status": "fast-signed",
        "X-Signature-Count": String(signatures?.length || 0),
        "X-Document-Type": "fast_sign",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Access-Control-Allow-Origin": "*",
      },
    })
  } catch (error) {
    console.error("Fast Sign Print API: Unexpected error:", error)
    return NextResponse.json({ 
      error: "Internal server error",
      details: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}
