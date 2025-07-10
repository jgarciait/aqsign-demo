"use client"

import "@/utils/polyfills"
import type React from "react"
import { useState, useRef, useEffect, useCallback, useMemo } from "react"
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Send, Save, Pen, X, Check, RotateCcw } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useIsMobile } from "@/hooks/use-mobile"
import { Button } from "@/components/ui/button"
import dynamic from 'next/dynamic'

// Dynamic imports for PDF.js
const Document = dynamic(() => import('react-pdf').then(mod => mod.Document), { 
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  )
})

const Page = dynamic(() => import('react-pdf').then(mod => mod.Page), { 
  ssr: false 
})

// PDF.js options
const PDF_OPTIONS = {
  cMapUrl: 'https://unpkg.com/pdfjs-dist@4.8.69/cmaps/',
  cMapPacked: true,
  standardFontDataUrl: 'https://unpkg.com/pdfjs-dist@4.8.69/standard_fonts/',
  workerSrc: `${typeof window !== 'undefined' ? window.location.origin : ''}/pdf.worker.mjs`
} as const

// Configure PDF.js worker early
if (typeof window !== 'undefined') {
  import('react-pdf').then(({ pdfjs }) => {
    if (!pdfjs.GlobalWorkerOptions.workerSrc) {
      pdfjs.GlobalWorkerOptions.workerSrc = `${window.location.origin}/pdf.worker.mjs`
    }
  }).catch(() => {})
}

export interface SimpleAnnotation {
  id: string
  type: "signature" | "text"
  x: number
  y: number
  width: number
  height: number
  content?: string
  imageData?: string
  signatureSource?: 'canvas' | 'wacom'
  page: number
  relativeX?: number
  relativeY?: number
  timestamp: string
  relativeWidth?: number
  relativeHeight?: number
}

interface SimplePdfViewerProps {
  documentUrl: string
  documentName: string
  documentId: string
  onSave: (annotations: SimpleAnnotation[]) => Promise<void>
  onSend?: (annotations: SimpleAnnotation[]) => Promise<void>
  initialAnnotations?: SimpleAnnotation[]
  token?: string
  readOnly?: boolean
  showSendButton?: boolean
}

// Simple signature canvas component
interface SignatureCanvasProps {
  isOpen: boolean
  onClose: () => void
  onComplete: (dataUrl: string) => void
  isMobile?: boolean
}

function SignatureCanvas({ isOpen, onClose, onComplete, isMobile = false }: SignatureCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasSignature, setHasSignature] = useState(false)

  const canvasWidth = isMobile ? Math.min(350, (typeof window !== 'undefined' ? window.innerWidth - 40 : 350)) : 500
  const canvasHeight = isMobile ? 200 : 250

  useEffect(() => {
    if (!isOpen) return
    
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    canvas.width = canvasWidth
    canvas.height = canvasHeight

    ctx.fillStyle = "#FFFFFF"
    ctx.fillRect(0, 0, canvasWidth, canvasHeight)

    ctx.strokeStyle = "#1e40af"
    ctx.lineWidth = isMobile ? 3 : 2
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    ctx.imageSmoothingEnabled = true
  }, [isOpen, canvasWidth, canvasHeight, isMobile])

  const getCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }

    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height

    if ("touches" in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      }
    } else {
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
      }
    }
  }

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    setIsDrawing(true)
    setHasSignature(true)

    const { x, y } = getCoordinates(e)
    ctx.beginPath()
    ctx.moveTo(x, y)

    if ("touches" in e) {
      e.preventDefault()
    }
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return

    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const { x, y } = getCoordinates(e)
    ctx.lineTo(x, y)
    ctx.stroke()

    if ("touches" in e) {
      e.preventDefault()
    }
  }

  const stopDrawing = (e?: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return
    setIsDrawing(false)

    if (e && "touches" in e) {
      e.preventDefault()
    }
  }

  const clearSignature = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    ctx.fillStyle = "#FFFFFF"
    ctx.fillRect(0, 0, canvasWidth, canvasHeight)
    setHasSignature(false)
  }

  const saveSignature = () => {
    const canvas = canvasRef.current
    if (!canvas || !hasSignature) return

    const tempCanvas = document.createElement("canvas")
    tempCanvas.width = canvasWidth
    tempCanvas.height = canvasHeight
    const tempCtx = tempCanvas.getContext("2d", { alpha: true })

    if (!tempCtx) return

    const originalCtx = canvas.getContext("2d")
    if (!originalCtx) return

    const imageData = originalCtx.getImageData(0, 0, canvasWidth, canvasHeight)
    const data = imageData.data

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]

      if (r > 250 && g > 250 && b > 250) {
        data[i + 3] = 0
      }
    }

    tempCtx.putImageData(imageData, 0, 0)
    const dataUrl = tempCanvas.toDataURL("image/png")
    onComplete(dataUrl)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="text-lg font-medium">Añadir Firma</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4">
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 bg-gray-50">
            <div className="flex justify-center mb-3">
              <canvas
                ref={canvasRef}
                className="border border-gray-300 rounded bg-white cursor-crosshair touch-none"
                style={{ 
                  width: `${canvasWidth}px`, 
                  height: `${canvasHeight}px`,
                  maxWidth: '100%'
                }}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
              />
            </div>
            
            <p className="text-sm text-gray-600 text-center">
              {isMobile ? "Dibuje su firma con el dedo" : "Dibuje su firma con el ratón"}
            </p>
          </div>

          <div className="flex gap-3 mt-4">
            <Button
              variant="outline"
              onClick={clearSignature}
              className="flex-1 flex items-center justify-center gap-2"
              disabled={!hasSignature}
            >
              <RotateCcw className="h-4 w-4" />
              Limpiar
            </Button>
            
            <Button
              onClick={saveSignature}
              className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700"
              disabled={!hasSignature}
            >
              <Check className="h-4 w-4" />
              Usar Firma
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function SimplePdfViewer({
  documentUrl,
  documentName,
  documentId,
  onSave,
  onSend,
  initialAnnotations = [],
  token,
  readOnly = false,
  showSendButton = true
}: SimplePdfViewerProps) {
  const [annotations, setAnnotations] = useState<SimpleAnnotation[]>(initialAnnotations)
  const [currentPage, setCurrentPage] = useState(1)
  const [numPages, setNumPages] = useState<number>(0)
  const [scale, setScale] = useState(1.0)
  const [isLoading, setIsLoading] = useState(true)
  const [pdfError, setPdfError] = useState<Error | null>(null)
  const [showSignatureCanvas, setShowSignatureCanvas] = useState(false)
  const [pendingSignature, setPendingSignature] = useState<{ dataUrl: string; timestamp: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)
  const [pageClickPosition, setPageClickPosition] = useState<{ x: number; y: number; pageWidth: number; pageHeight: number } | null>(null)

  const { toast } = useToast()
  const isMobile = useIsMobile()
  const containerRef = useRef<HTMLDivElement>(null)

  // Calculate responsive scale
  const calculateScale = useCallback(() => {
    if (typeof window !== 'undefined') {
      const viewportWidth = window.innerWidth
      const isMobileView = viewportWidth < 1024
      
      if (isMobileView) {
        const availableWidth = viewportWidth - 32
        const pdfWidth = 612 // Standard PDF width
        return Math.max(0.5, Math.min(availableWidth / pdfWidth, 1.5))
      } else {
        return 1.2
      }
    }
    return 1.0
  }, [])

  // Update scale on resize
  useEffect(() => {
    setScale(calculateScale())
    
    const handleResize = () => {
      setScale(calculateScale())
    }
    
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [calculateScale])

  // Configure PDF.js worker
  useEffect(() => {
    const configurePdfWorker = async () => {
      try {
        const { pdfjs } = await import("react-pdf")
        if (!pdfjs.GlobalWorkerOptions.workerSrc) {
          pdfjs.GlobalWorkerOptions.workerSrc = `${window.location.origin}/pdf.worker.mjs`
        }
      } catch (err) {
        console.error("Failed to configure PDF worker:", err)
      }
    }
    configurePdfWorker()
  }, [])

  // Handle page click for signature placement
  const handlePageClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (readOnly || !pendingSignature) return

    const pageElement = e.currentTarget
    const rect = pageElement.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    const signatureWidth = 200
    const signatureHeight = 100
    
    const centeredX = Math.max(0, Math.min(x - signatureWidth / 2, rect.width - signatureWidth))
    const centeredY = Math.max(0, Math.min(y - signatureHeight / 2, rect.height - signatureHeight))

    const newSignature: SimpleAnnotation = {
      id: crypto.randomUUID(),
      type: "signature",
      x: centeredX,
      y: centeredY,
      width: signatureWidth,
      height: signatureHeight,
      imageData: pendingSignature.dataUrl,
      signatureSource: 'canvas',
      page: currentPage,
      relativeX: centeredX / rect.width,
      relativeY: centeredY / rect.height,
      relativeWidth: signatureWidth / rect.width,
      relativeHeight: signatureHeight / rect.height,
      timestamp: pendingSignature.timestamp
    }

    setAnnotations(prev => [...prev, newSignature])
    setPendingSignature(null)
    
    toast({
      title: "Firma añadida",
      description: "La firma se ha colocado en el documento.",
      duration: 3000,
    })
  }, [readOnly, pendingSignature, currentPage, toast])

  // Handle signature completion
  const handleSignatureComplete = useCallback((dataUrl: string) => {
    setShowSignatureCanvas(false)
    
    if (!dataUrl) return

    setPendingSignature({
      dataUrl,
      timestamp: new Date().toISOString()
    })

    toast({
      title: "Firma lista",
      description: "Haga clic en el documento donde desea colocar la firma.",
      duration: 5000,
    })
  }, [toast])

  // Handle save
  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      await onSave(annotations)
      toast({
        title: "Documento guardado",
        description: "Las firmas se han guardado correctamente.",
        duration: 3000,
      })
    } catch (error) {
      console.error("Error saving:", error)
      toast({
        title: "Error al guardar",
        description: "No se pudo guardar el documento. Inténtelo de nuevo.",
        variant: "destructive",
        duration: 5000,
      })
    } finally {
      setSaving(false)
    }
  }, [annotations, onSave, toast])

  // Handle send
  const handleSend = useCallback(async () => {
    if (!onSend) return

    const signatureCount = annotations.filter(a => a.type === 'signature').length
    if (signatureCount === 0) {
      toast({
        title: "Se requiere firma",
        description: "Debe añadir al menos una firma antes de enviar.",
        variant: "destructive",
        duration: 5000,
      })
      return
    }

    setSending(true)
    try {
      await onSend(annotations)
      toast({
        title: "Documento enviado",
        description: "El documento se ha enviado correctamente.",
        duration: 3000,
      })
    } catch (error) {
      console.error("Error sending:", error)
      toast({
        title: "Error al enviar",
        description: "No se pudo enviar el documento. Inténtelo de nuevo.",
        variant: "destructive",
        duration: 5000,
      })
    } finally {
      setSending(false)
    }
  }, [annotations, onSend, toast])

  // Delete annotation
  const handleDeleteAnnotation = useCallback((id: string) => {
    setAnnotations(prev => prev.filter(a => a.id !== id))
  }, [])

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h1 className="text-lg font-medium text-gray-900 truncate">
              {documentName}
            </h1>
            <div className="text-sm text-gray-500">
              Página {currentPage} de {numPages || 1}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Add Signature Button */}
            {!readOnly && (
              <Button
                onClick={() => setShowSignatureCanvas(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white"
                disabled={!!pendingSignature}
              >
                <Pen className="h-4 w-4 mr-2" />
                {isMobile ? "Firma" : "Añadir Firma"}
              </Button>
            )}

            {/* Save Button */}
            <Button
              onClick={handleSave}
              disabled={saving}
              variant="outline"
            >
              <Save className="h-4 w-4 mr-2" />
              {saving ? "Guardando..." : "Guardar"}
            </Button>

            {/* Send Button */}
            {showSendButton && onSend && (
              <Button
                onClick={handleSend}
                disabled={sending}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <Send className="h-4 w-4 mr-2" />
                {sending ? "Enviando..." : "Enviar"}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* PDF Viewer */}
      <div className="pdf-document-container">
        <div className="pdf-document-wrapper">
          <div 
            ref={containerRef}
            className="pdf-document-content pdf-auto-fit"
            style={{ 
              cursor: pendingSignature ? "crosshair" : "default"
            }}
          >
            <Document
              file={documentUrl}
              onLoadSuccess={({ numPages }) => {
                setNumPages(numPages)
                setIsLoading(false)
                setPdfError(null)
              }}
              onLoadError={(error) => {
                console.error("PDF load error:", error)
                setPdfError(error)
                setIsLoading(false)
              }}
              options={PDF_OPTIONS}
              loading={
                <div className="pdf-loading-container">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Cargando documento...</p>
                  </div>
                </div>
              }
              error={
                <div className="pdf-error-container">
                  <div className="text-center">
                    <div className="text-red-500 text-6xl mb-4">⚠️</div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Error al cargar PDF</h3>
                    <p className="text-gray-600 mb-4">No se pudo cargar el documento PDF.</p>
                    <Button onClick={() => window.location.reload()}>
                      Intentar de nuevo
                    </Button>
                  </div>
                </div>
              }
            >
              {!isLoading && !pdfError && numPages > 0 && (
                <div 
                  className="relative"
                  onClick={handlePageClick}
                >
                  <Page
                    pageNumber={currentPage}
                    scale={scale}
                    renderAnnotationLayer={false}
                    renderTextLayer={false}
                    className="max-w-full"
                  />
                  
                  {/* Render annotations */}
                  {annotations
                    .filter(a => a.page === currentPage)
                    .map(annotation => (
                      <div
                        key={annotation.id}
                        className="absolute border-2 border-blue-500 bg-blue-100 bg-opacity-50"
                        style={{
                          left: `${annotation.x}px`,
                          top: `${annotation.y}px`,
                          width: `${annotation.width}px`,
                          height: `${annotation.height}px`,
                          zIndex: 10
                        }}
                      >
                        {annotation.type === 'signature' && annotation.imageData && (
                          <img
                            src={annotation.imageData}
                            alt="Signature"
                            className="w-full h-full object-contain"
                          />
                        )}
                        
                        {!readOnly && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteAnnotation(annotation.id)
                            }}
                            className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    ))}
                </div>
              )}
            </Document>
          </div>
        </div>
      </div>

      {/* Page Navigation */}
      {numPages > 1 && (
        <div className="bg-white border-t border-gray-200 px-4 py-3">
          <div className="flex items-center justify-center space-x-4">
            <Button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage <= 1}
              variant="outline"
              size="sm"
            >
              <ChevronLeft className="h-4 w-4" />
              {!isMobile && "Anterior"}
            </Button>
            
            <span className="text-sm text-gray-600">
              Página {currentPage} de {numPages}
            </span>
            
            <Button
              onClick={() => setCurrentPage(prev => Math.min(numPages, prev + 1))}
              disabled={currentPage >= numPages}
              variant="outline"
              size="sm"
            >
              {!isMobile && "Siguiente"}
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Signature Canvas Modal */}
      <SignatureCanvas
        isOpen={showSignatureCanvas}
        onClose={() => setShowSignatureCanvas(false)}
        onComplete={handleSignatureComplete}
        isMobile={isMobile}
      />

      {/* Pending Signature Indicator */}
      {pendingSignature && (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg z-40">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
            <span className="text-sm">Haga clic donde desea colocar la firma</span>
            <button
              onClick={() => setPendingSignature(null)}
              className="ml-2 text-white hover:text-gray-200"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
