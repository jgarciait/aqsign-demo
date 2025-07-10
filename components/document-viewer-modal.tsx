"use client"

import { useState, useEffect, useMemo } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { X, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, Download, Loader2, FileText, CheckCircle, AlertCircle, ArrowRight, Edit3, PanelRightOpen, PanelRightClose } from "lucide-react"
import dynamic from "next/dynamic"
// Removed ensureValidRelativeDimensions import - no longer needed

// OPTIMIZACIÓN: Dynamic imports para todos los componentes PDF - SOLO CLIENTE
const Document = dynamic(() => import("react-pdf").then(mod => mod.Document), { 
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  )
})

const Page = dynamic(() => import("react-pdf").then(mod => mod.Page), { 
  ssr: false
})

// Configure PDF.js SOLO en el cliente
const configurePdfJs = () => {
  if (typeof window !== 'undefined') {
    // Use centralized PDF configuration only once
    import('react-pdf').then(({ pdfjs }) => {
      if (!pdfjs.GlobalWorkerOptions.workerSrc) {
        pdfjs.GlobalWorkerOptions.workerSrc = `${window.location.origin}/pdf.worker.mjs`
        console.log('PDF.js worker configured:', pdfjs.GlobalWorkerOptions.workerSrc)
      }
    }).catch((error) => {
      console.warn('Failed to configure PDF.js worker:', error)
    })
  }
}

// Lazy load styles - solo si estamos en el cliente
const loadPdfStyles = () => {
  if (typeof window !== 'undefined') {
    // Styles will be loaded automatically by react-pdf when needed
    // Removed direct CSS imports to avoid TypeScript errors
  }
}

interface DocumentViewerModalProps {
  isOpen: boolean
  onClose: () => void
  documentId: string
  documentName: string
  token?: string
  requestId?: string
}

interface SignatureAnnotation {
  id: string
  type: 'signature'
  page: number
  imageData: string
  x?: number
  y?: number
  width?: number
  height?: number
  relativeX?: number
  relativeY?: number
  relativeWidth?: number
  relativeHeight?: number
  timestamp?: string
  signatureSource?: string
}

// View-only signature overlay component
const SignatureOverlay = ({ 
  signature, 
  pageWidth, 
  pageHeight, 
  scale 
}: { 
  signature: SignatureAnnotation
  pageWidth: number
  pageHeight: number
  scale: number
}) => {
  // Convert relative coordinates to absolute coordinates for the current page scale
  const getAbsolutePosition = () => {
    // Use original relative coordinates without normalization to preserve exact positioning
    let relativeX = signature.relativeX
    let relativeY = signature.relativeY
    let relativeWidth = signature.relativeWidth
    let relativeHeight = signature.relativeHeight
    
    // Only use fallback calculations if relative coordinates are completely missing
    if (relativeX === undefined || relativeX === null) {
      relativeX = (signature.x || 0) / pageWidth
    }
    if (relativeY === undefined || relativeY === null) {
      relativeY = (signature.y || 0) / pageHeight
    }
    if (relativeWidth === undefined || relativeWidth === null) {
      relativeWidth = (signature.width || 200) / pageWidth
    }
    if (relativeHeight === undefined || relativeHeight === null) {
      relativeHeight = (signature.height || 100) / pageHeight
    }
    
    const position = {
      x: relativeX * pageWidth * scale,
      y: relativeY * pageHeight * scale,
      width: relativeWidth * pageWidth * scale,
      height: relativeHeight * pageHeight * scale
    }
    
    console.log('📍 SignatureOverlay position calculation:', {
      signatureId: signature.id,
      originalRelative: { x: signature.relativeX, y: signature.relativeY, width: signature.relativeWidth, height: signature.relativeHeight },
      usedRelative: { x: relativeX, y: relativeY, width: relativeWidth, height: relativeHeight },
      pageSize: { width: pageWidth, height: pageHeight },
      scale,
      finalPosition: position
    })
    
    return position
  }

  const position = getAbsolutePosition()

  return (
    <div
      className="absolute border-2 border-blue-500 bg-blue-50 bg-opacity-20 pointer-events-none"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${position.width}px`,
        height: `${position.height}px`,
        zIndex: 10
      }}
    >
      {signature.imageData && (
        <img
          src={signature.imageData}
          alt="Signature"
          className="w-full h-full object-contain"
          style={{
            filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1))'
          }}
        />
      )}
    </div>
  )
}

// Enhanced PDF page component with signature overlays
const PDFPageWithSignatures = ({
  pageNumber,
  scale,
  signatures,
  onPageLoad,
  showOverlays = true
}: {
  pageNumber: number
  scale: number
  signatures: SignatureAnnotation[]
  onPageLoad?: (pageNumber: number, width: number, height: number) => void
  showOverlays?: boolean
}) => {
  const [pageSize, setPageSize] = useState<{ width: number; height: number } | null>(null)

  const handlePageLoadSuccess = (page: any) => {
    const { width, height } = page
    setPageSize({ width, height })
    if (onPageLoad) {
      onPageLoad(pageNumber, width, height)
    }
  }

  const pageSignatures = signatures.filter(sig => sig.page === pageNumber)

  return (
    <div className="relative">
      <Page
        pageNumber={pageNumber}
        scale={scale}
        onLoadSuccess={handlePageLoadSuccess}
        renderTextLayer={false}
        renderAnnotationLayer={false}
        loading={<PDFLoadingSkeleton />}
        onLoadError={(error) => {
          console.warn("Page load error:", error)
        }}
      />
      
      {/* Signature overlays - only show if not using merged PDF */}
      {showOverlays && pageSize && pageSignatures.map((signature) => (
        <SignatureOverlay
          key={signature.id}
          signature={signature}
          pageWidth={pageSize.width}
          pageHeight={pageSize.height}
          scale={scale}
        />
      ))}
    </div>
  )
}

// Signature thumbnail component
const SignatureThumbnail = ({ 
  signature, 
  index, 
  onGoToPage,
  isCurrentPage 
}: { 
  signature: SignatureAnnotation
  index: number
  onGoToPage: (page: number) => void
  isCurrentPage: boolean
}) => {
  const getSignatureSourceIcon = (source?: string) => {
    switch (source) {
      case 'wacom':
        return '🖊️'
      case 'mouse':
        return '🖱️'
      case 'touch':
        return '👆'
      default:
        return '✍️'
    }
  }

  const getSignatureSourceText = (source?: string) => {
    switch (source) {
      case 'wacom':
        return 'Tableta gráfica'
      case 'mouse':
        return 'Ratón'
      case 'touch':
        return 'Táctil'
      default:
        return 'Canvas'
    }
  }

  return (
    <div 
      className={`group flex items-center justify-between p-3 rounded-lg transition-all cursor-pointer border-2 ${
        isCurrentPage 
          ? 'bg-blue-50 border-blue-200 shadow-sm' 
          : 'bg-gray-50 border-gray-200 hover:bg-blue-50 hover:border-blue-200'
      }`}
      onClick={() => onGoToPage(signature.page)}
    >
      <div className="flex items-center gap-3">
        {/* Signature thumbnail */}
        <div className="w-16 h-10 bg-white border border-gray-300 rounded flex items-center justify-center overflow-hidden shadow-sm">
          {signature.imageData ? (
            <img
              src={signature.imageData}
              alt={`Firma ${index + 1}`}
              className="max-w-full max-h-full object-contain"
            />
          ) : (
            <Edit3 className="h-4 w-4 text-gray-400" />
          )}
        </div>
        
        {/* Signature info */}
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-900">
              Firma {index + 1}
            </span>
            <span className="text-xs" title={getSignatureSourceText(signature.signatureSource)}>
              {getSignatureSourceIcon(signature.signatureSource)}
            </span>
          </div>
          <span className="text-xs text-gray-500">
            Página {signature.page}
          </span>
          {signature.timestamp && (
            <span className="text-xs text-gray-400">
              {new Date(signature.timestamp).toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>
      
      {/* Go to page indicator */}
      <div className={`p-1 rounded-full transition-colors ${
        isCurrentPage 
          ? 'bg-blue-100 text-blue-600' 
          : 'bg-gray-100 text-gray-500 group-hover:bg-blue-100 group-hover:text-blue-600'
      }`}>
        <ArrowRight className="h-3 w-3" />
      </div>
    </div>
  )
}

// Loading component with better visual feedback
const LoadingComponent = ({ stage }: { stage: string }) => {
  return (
    <div className="flex items-center justify-center h-96">
      <div className="text-center max-w-md">
        {/* Animated document icon */}
        <div className="relative mb-6">
          <div className="w-16 h-16 mx-auto mb-4 relative">
            <FileText className="w-16 h-16 text-blue-500" />
            <div className="absolute inset-0 rounded-full border-2 border-blue-500 border-t-transparent animate-spin"></div>
          </div>
          
          {/* Progress dots */}
          <div className="flex justify-center space-x-2 mb-4">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
          </div>
        </div>
        
        {/* Loading text */}
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-gray-900">Preparando documento</h3>
          <p className="text-sm text-gray-600">{stage}</p>
          <div className="w-full bg-gray-200 rounded-full h-2 mt-4">
            <div className="bg-blue-500 h-2 rounded-full animate-pulse" style={{ width: '60%' }}></div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Enhanced loading skeleton for PDF pages
const PDFLoadingSkeleton = () => {
  return (
    <div className="bg-white shadow-lg rounded-lg p-8 animate-pulse">
      <div className="space-y-4">
        {/* Header lines */}
        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
        <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        
        {/* Content blocks */}
        <div className="space-y-3 mt-8">
          <div className="h-3 bg-gray-200 rounded"></div>
          <div className="h-3 bg-gray-200 rounded w-5/6"></div>
          <div className="h-3 bg-gray-200 rounded w-4/6"></div>
        </div>
        
        {/* More content */}
        <div className="space-y-3 mt-8">
          <div className="h-3 bg-gray-200 rounded w-3/4"></div>
          <div className="h-3 bg-gray-200 rounded"></div>
          <div className="h-3 bg-gray-200 rounded w-2/3"></div>
        </div>
        
        {/* Signature placeholder */}
        <div className="mt-12 pt-8 border-t border-gray-200">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-8 bg-gray-200 rounded animate-pulse"></div>
            <div className="flex-1">
              <div className="h-2 bg-gray-200 rounded w-1/3"></div>
              <div className="h-2 bg-gray-200 rounded w-1/4 mt-2"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function DocumentViewerModal({
  isOpen,
  onClose,
  documentId,
  documentName,
  token,
  requestId
}: DocumentViewerModalProps) {
  const [numPages, setNumPages] = useState<number>(0)
  const [pageNumber, setPageNumber] = useState<number>(1)
  const [scale, setScale] = useState<number>(1.0)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [loadingStage, setLoadingStage] = useState<string>("Iniciando...")
  const [documentUrl, setDocumentUrl] = useState<string>("")
  const [error, setError] = useState<string>("")
  const [hasSignatures, setHasSignatures] = useState<boolean>(false)
  const [signatures, setSignatures] = useState<SignatureAnnotation[]>([])
  const [isLoadingSignatures, setIsLoadingSignatures] = useState<boolean>(false)
  const [showSignaturesPanel, setShowSignaturesPanel] = useState<boolean>(true)
  const [isUsingMergedPdf, setIsUsingMergedPdf] = useState<boolean>(false)

  // Sort signatures by page number
  const sortedSignatures = [...signatures].sort((a, b) => {
    if (a.page === b.page) {
      // If on same page, sort by y position (top to bottom)
      return (a.y || 0) - (b.y || 0)
    }
    return a.page - b.page
  })

  // PDF.js options - memoized to prevent unnecessary reloads
  const PDF_OPTIONS = useMemo(() => ({
    cMapUrl: 'https://unpkg.com/pdfjs-dist@4.8.69/cmaps/',
    cMapPacked: true,
    standardFontDataUrl: 'https://unpkg.com/pdfjs-dist@4.8.69/standard_fonts/',
    workerSrc: typeof window !== 'undefined' ? `${window.location.origin}/pdf.worker.mjs` : '/pdf.worker.mjs'
  }), [])

  // Configure PDF.js when component mounts
  useEffect(() => {
    configurePdfJs()
    loadPdfStyles()
    
    // Cleanup function to prevent transport destroyed errors
    return () => {
      // Reset loading state on unmount
      setIsLoading(true)
      setError("")
    }
  }, [])

  // Generate the document URL when modal opens
  useEffect(() => {
    if (isOpen && documentId) {
      setIsLoading(true)
      setError("")
      setLoadingStage("Iniciando...")
      
      console.log(`DocumentViewerModal: Starting to load document ${documentId}`)
      
      // For signed documents with token and requestId, use the signed document print API
      if (token && requestId) {
        // This is a signed document - use print API to get merged PDF
        console.log('🎯 DocumentViewerModal: Loading signed document with token and requestId')
        const url = `/api/documents/${documentId}/print?token=${encodeURIComponent(token)}&requestId=${encodeURIComponent(requestId)}`
        console.log('🔗 Using URL:', url)
        setLoadingStage("Cargando documento firmado...")
        setDocumentUrl(url)
        setHasSignatures(true)
        setIsUsingMergedPdf(true) // This is a merged PDF with signatures baked in
        setIsLoading(false)
        loadSignaturesForSignedDocument()
      } else {
        // Check if this is a fast-sign document or case file document
        // We'll try the fast-sign print endpoint first, then fallback to regular PDF
        console.log('DocumentViewerModal: Checking document type and setting URL')
        checkDocumentTypeAndSetUrl()
      }

    }
  }, [isOpen, documentId, token, requestId])

  const loadSignaturesForSignedDocument = async () => {
    if (!token || !requestId) return
    
    setIsLoadingSignatures(true)
    try {
      // For signed documents, we can extract signatures from the document annotations
      const response = await fetch(`/api/annotations/${documentId}?token=${encodeURIComponent(token)}&requestId=${encodeURIComponent(requestId)}`)
      
      if (response.ok) {
        const data = await response.json()
        const signatureAnnotations: SignatureAnnotation[] = []
        
        // Look for signature annotations in the response
        if (data.annotations && Array.isArray(data.annotations)) {
          data.annotations.forEach((annotation: any, index: number) => {
            if (annotation.type === 'signature' && annotation.imageData) {
              signatureAnnotations.push({
                id: annotation.id || `signature-${index}`,
                type: "signature",
                page: annotation.page || 1,
                imageData: annotation.imageData,
                x: annotation.x,
                y: annotation.y,
                width: annotation.width,
                height: annotation.height,
                relativeX: annotation.relativeX,
                relativeY: annotation.relativeY,
                timestamp: annotation.timestamp,
                signatureSource: annotation.signatureSource || "canvas",
              })
            }
          })
        }
        
        setSignatures(signatureAnnotations)
      } else {
        // Fallback: try to get signatures from the original API pattern
        console.log("Fallback: using signed document signature extraction")
        setSignatures([])
      }
    } catch (error) {
      console.error("Error loading signatures for signed document:", error)
      setSignatures([])
    } finally {
      setIsLoadingSignatures(false)
    }
  }

  const loadSignaturesForFastSign = async () => {
    setIsLoadingSignatures(true)
    try {
      // Use a special token that allows loading ALL signatures for the document
      // This bypasses the recipient_email filter for fast-sign-docs viewing
      const response = await fetch(`/api/documents/${documentId}/signatures/check`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token: Buffer.from("fast-sign-docs@view-all").toString("base64"),
          includeData: true,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        const signatureAnnotations: SignatureAnnotation[] = []

        if (data.signatures && data.signatures.length > 0) {
          data.signatures.forEach((sigRecord: any) => {
            if (sigRecord.signature_data?.signatures) {
              // New format: signatures array
              sigRecord.signature_data.signatures.forEach((sig: any) => {
                signatureAnnotations.push({
                  id: sig.id,
                  type: "signature",
                  page: sig.position?.page || 1,
                  imageData: sig.dataUrl || "",
                  x: sig.position?.x,
                  y: sig.position?.y,
                  width: sig.position?.width,
                  height: sig.position?.height,
                  relativeX: sig.position?.relativeX,
                  relativeY: sig.position?.relativeY,
                  relativeWidth: sig.position?.relativeWidth,
                  relativeHeight: sig.position?.relativeHeight,
                  timestamp: sig.timestamp || sigRecord.signed_at,
                  signatureSource: sig.source || sigRecord.signature_source || "canvas",
                })
              })
            } else if (sigRecord.signature_data?.dataUrl) {
              // Old format: direct signature data
              signatureAnnotations.push({
                id: sigRecord.id,
                type: "signature",
                page: sigRecord.signature_data.position?.page || 1,
                imageData: sigRecord.signature_data.dataUrl || "",
                x: sigRecord.signature_data.position?.x,
                y: sigRecord.signature_data.position?.y,
                width: sigRecord.signature_data.position?.width,
                height: sigRecord.signature_data.position?.height,
                relativeX: sigRecord.signature_data.position?.relativeX,
                relativeY: sigRecord.signature_data.position?.relativeY,
                relativeWidth: sigRecord.signature_data.position?.relativeWidth,
                relativeHeight: sigRecord.signature_data.position?.relativeHeight,
                timestamp: sigRecord.signature_data.timestamp || sigRecord.signed_at,
                signatureSource: sigRecord.signature_source || "canvas",
              })
            }
          })
        }

        setSignatures(signatureAnnotations)
      }
    } catch (error) {
      console.error("Error loading signatures:", error)
    } finally {
      setIsLoadingSignatures(false)
    }
  }

  const checkDocumentTypeAndSetUrl = async () => {
    try {
      setLoadingStage("Verificando tipo de documento...")
      console.log(`DocumentViewerModal: Starting document type check for ${documentId}`)
      
      const startTime = Date.now()
      
      // Use Promise.allSettled to make parallel requests for better performance
      const [docResponse, signatureResponse] = await Promise.allSettled([
        fetch(`/api/pdf/${documentId}`, { method: 'HEAD' }),
        fetch(`/api/documents/${documentId}/signatures/check`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            token: Buffer.from("fast-sign-docs@view-all").toString("base64"),
            includeData: false,
          }),
        })
      ])
      
      const parallelRequestsTime = Date.now() - startTime
      console.log(`DocumentViewerModal: Parallel requests completed in ${parallelRequestsTime}ms`)
      
      const docExists = docResponse.status === 'fulfilled' && docResponse.value.ok
      
      if (signatureResponse.status === 'fulfilled' && signatureResponse.value.ok) {
        setLoadingStage("Verificando firmas...")
        
        try {
          const signatureData = await signatureResponse.value.json()
          
          if (signatureData.hasSignatures) {
            // This document has signatures - use fast-sign print endpoint for merged PDF
            console.log(`🎯 DocumentViewerModal: Document has ${signatureData.signatureCount} signatures - using fast-sign print endpoint`)
            console.log('🔗 Using URL:', `/api/fast-sign/${documentId}/print`)
            setLoadingStage("Procesando documento con firmas...")
            setDocumentUrl(`/api/fast-sign/${documentId}/print`)
            setHasSignatures(true)
            setIsUsingMergedPdf(true) // This is a merged PDF with signatures baked in
            // Load signature metadata for the panel but don't show overlays (signatures already in PDF)
            loadSignaturesForFastSign()
            return
          }
        } catch (jsonError) {
          console.warn('Error parsing signature response:', jsonError)
        }
      }
      
      if (docExists) {
        // No signatures or signature check failed - use regular PDF
        console.log('🎯 DocumentViewerModal: Document has no signatures - using regular PDF endpoint')
        console.log('🔗 Using URL:', `/api/pdf/${documentId}`)
        setLoadingStage("Cargando documento original...")
        setDocumentUrl(`/api/pdf/${documentId}`)
        setHasSignatures(false)
        setIsUsingMergedPdf(false) // Regular PDF, no merged signatures
        setSignatures([])
      } else {
        // Document not found in regular endpoint, try fast-sign endpoint as fallback
        setLoadingStage("Verificando documento en fast-sign...")
        console.log('DocumentViewerModal: Trying fast-sign endpoint as fallback')
        
        try {
          const fastSignResponse = await fetch(`/api/fast-sign/${documentId}/print`, { method: 'HEAD' })
          
          if (fastSignResponse.ok) {
            // Document found in fast-sign endpoint
            console.log('🎯 DocumentViewerModal: Document found in fast-sign endpoint (fallback)')
            console.log('🔗 Using URL:', `/api/fast-sign/${documentId}/print`)
            setLoadingStage("Procesando documento con firmas...")
            setDocumentUrl(`/api/fast-sign/${documentId}/print`)
            setHasSignatures(true)
            setIsUsingMergedPdf(true) // This is also a merged PDF with signatures baked in
            loadSignaturesForFastSign()
          } else {
            console.log('Document not found in any endpoint')
            setError("Documento no encontrado")
          }
        } catch (fastSignError) {
          console.error('Error checking fast-sign endpoint:', fastSignError)
          setError("Error al cargar el documento")
        }
      }
    } catch (error) {
      console.error('Error determining document type:', error)
      setError("Error al cargar el documento")
    } finally {
      setIsLoading(false)
    }
  }

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages)
    setPageNumber(1)
    setIsLoading(false)
    setError("")
  }

  const onDocumentLoadError = (error: any) => {
    console.error("Error loading PDF:", error)
    
    // Handle specific error types
    if (error?.message?.includes('Transport destroyed')) {
      setError('Conexión interrumpida. Por favor, recargue la página.')
    } else if (error?.message?.includes('worker')) {
      setError('Error de configuración del visor PDF. Por favor, recargue la página.')
    } else {
      setError(`Error al cargar el documento: ${error?.message || 'Error desconocido'}`)
    }
    
    setIsLoading(false)
  }

  const goToPrevPage = () => {
    setPageNumber(prev => Math.max(prev - 1, 1))
  }

  const goToNextPage = () => {
    setPageNumber(prev => Math.min(prev + 1, numPages))
  }

  const goToPage = (page: number) => {
    setPageNumber(Math.max(1, Math.min(page, numPages)))
  }

  const zoomIn = () => {
    setScale(prev => Math.min(prev + 0.2, 3.0))
  }

  const zoomOut = () => {
    setScale(prev => Math.max(prev - 0.2, 0.5))
  }

  const handleDownload = () => {
    if (documentUrl) {
      const link = document.createElement('a')
      link.href = documentUrl
      link.download = documentName
      link.target = '_blank'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[90vw] w-[90vw] h-[100vh] p-0 overflow-hidden flex flex-col" hideCloseButton>
        <DialogHeader className="px-6 py-3 bg-gray-50 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <DialogTitle className="text-lg font-semibold truncate max-w-md">
                {documentName}
              </DialogTitle>
              {hasSignatures && !isLoading && (
                <div className="flex items-center space-x-1 text-green-600 bg-green-50 px-2 py-1 rounded-full text-xs">
                  <CheckCircle className="h-3 w-3" />
                  <span>Con firmas ({signatures.length})</span>
                  {isUsingMergedPdf && (
                    <span className="text-xs text-green-700 bg-green-100 px-1 rounded">
                      Integradas
                    </span>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
                disabled={isLoading || !!error}
              >
                <Download className="h-4 w-4 mr-1" />
                Descargar
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Toolbar */}
        <div className="px-6 py-2 border-b bg-gray-50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            {/* Page navigation */}
            <Button
              variant="outline"
              size="sm"
              onClick={goToPrevPage}
              disabled={pageNumber <= 1 || isLoading}
              className="h-7 px-2"
            >
              <ChevronLeft className="h-3 w-3" />
            </Button>
            <span className="text-xs font-medium min-w-[80px] text-center">
              {isLoading ? "..." : `${pageNumber} de ${numPages}`}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={goToNextPage}
              disabled={pageNumber >= numPages || isLoading}
              className="h-7 px-2"
            >
              <ChevronRight className="h-3 w-3" />
            </Button>
          </div>

          <div className="flex items-center gap-2">
            {/* Signatures panel toggle */}
            {hasSignatures && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSignaturesPanel(!showSignaturesPanel)}
                className="h-7 px-2"
                title={showSignaturesPanel ? "Ocultar panel de firmas" : "Mostrar panel de firmas"}
              >
                {showSignaturesPanel ? (
                  <PanelRightClose className="h-3 w-3" />
                ) : (
                  <PanelRightOpen className="h-3 w-3" />
                )}
              </Button>
            )}

            {/* Zoom controls */}
            <Button
              variant="outline"
              size="sm"
              onClick={zoomOut}
              disabled={scale <= 0.5 || isLoading}
              className="h-7 px-2"
            >
              <ZoomOut className="h-3 w-3" />
            </Button>
            <span className="text-xs font-medium min-w-[50px] text-center">
              {Math.round(scale * 100)}%
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={zoomIn}
              disabled={scale >= 3.0 || isLoading}
              className="h-7 px-2"
            >
              <ZoomIn className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Main content area */}
        <div className="flex flex-1 min-h-0">
          {/* Document viewer */}
          <div className="pdf-document-container bg-gray-100">
            <div className="pdf-document-wrapper">
              {isLoading ? (
                <LoadingComponent stage={loadingStage} />
              ) : error ? (
                <div className="pdf-error-container">
                  <div className="text-center max-w-md">
                    <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Error al cargar</h3>
                    <p className="text-red-600 mb-4">{error}</p>
                    <Button onClick={() => window.location.reload()}>
                      Reintentar
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="pdf-document-content pdf-auto-fit">
                  <Document
                    key={documentUrl} // Force re-render when URL changes
                    file={documentUrl}
                    onLoadSuccess={onDocumentLoadSuccess}
                    onLoadError={onDocumentLoadError}
                    options={PDF_OPTIONS}
                    loading={<PDFLoadingSkeleton />}
                  >
                    <PDFPageWithSignatures
                      pageNumber={pageNumber}
                      scale={scale}
                      signatures={signatures}
                      showOverlays={!isUsingMergedPdf}
                      onPageLoad={(pageNumber, width, height) => {
                        // Handle page load success
                      }}
                    />
                  </Document>
                </div>
              )}
            </div>
          </div>

          {/* Signatures sidebar */}
          {hasSignatures && showSignaturesPanel && (
            <div className="w-80 lg:w-80 md:w-72 border-l border-gray-200 bg-white flex flex-col shrink-0">
              <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                    <Edit3 className="h-4 w-4" />
                    Firmas del Documento
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowSignaturesPanel(false)}
                    className="h-6 w-6 p-0 lg:hidden"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
                
                {signatures.length > 0 && (
                  <div className="flex items-center justify-between mt-2">
                    <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                      {signatures.length} firma{signatures.length !== 1 ? 's' : ''}
                    </span>
                    <span className="text-xs text-gray-500">
                      {sortedSignatures.filter(s => s.page === pageNumber).length > 0 
                        ? `${sortedSignatures.filter(s => s.page === pageNumber).length} en página actual`
                        : 'Ninguna en página actual'
                      }
                    </span>
                  </div>
                )}
              </div>
              
              <div className="flex-1 overflow-hidden p-4">
                {isLoadingSignatures ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-center">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-blue-500" />
                      <p className="text-sm text-gray-600">Cargando firmas...</p>
                    </div>
                  </div>
                ) : signatures.length > 0 ? (
                  <div className="relative">
                    {/* Scroll indicator for many signatures */}
                    {signatures.length > 5 && (
                      <div className="absolute top-0 right-0 z-10 bg-gradient-to-b from-white via-white to-transparent h-8 w-6 pointer-events-none"></div>
                    )}
                    
                    <div 
                      className={`space-y-3 ${
                        signatures.length > 5 
                          ? 'max-h-[450px] overflow-y-auto pr-2' 
                          : ''
                      }`}
                      style={{
                        scrollbarWidth: 'thin',
                        scrollbarColor: '#d1d5db #f3f4f6'
                      }}
                    >
                      {sortedSignatures.map((signature, index) => (
                        <SignatureThumbnail
                          key={signature.id}
                          signature={signature}
                          index={index}
                          onGoToPage={goToPage}
                          isCurrentPage={signature.page === pageNumber}
                        />
                      ))}
                    </div>
                    
                    {/* Bottom scroll indicator */}
                    {signatures.length > 5 && (
                      <div className="absolute bottom-0 right-0 z-10 bg-gradient-to-t from-white via-white to-transparent h-8 w-6 pointer-events-none"></div>
                    )}
                    
                    {/* Scroll hint */}
                    {signatures.length > 5 && (
                      <div className="text-center mt-2 pt-2 border-t border-gray-100">
                        <p className="text-xs text-gray-400">
                          Scroll para ver más firmas ({signatures.length} total)
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Edit3 className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-sm text-gray-500">No se encontraron firmas</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Las firmas aparecerán aquí cuando estén disponibles
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
