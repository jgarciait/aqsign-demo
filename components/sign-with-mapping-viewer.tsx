"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, Download, Loader2, Check, Edit3, Menu } from "lucide-react"
import { Document, Page, pdfjs } from "react-pdf"
import "react-pdf/dist/Page/AnnotationLayer.css"
import "react-pdf/dist/Page/TextLayer.css"
import { Logo } from "@/components/logo"
import { useToast } from "@/hooks/use-toast"
import { SignatureField } from "./simple-document-viewer"
import SimpleSignatureCanvas from "./simple-signature-canvas"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"

// Configure PDF.js worker - must be done before any PDF operations
if (typeof window !== 'undefined') {
  // Use local worker file
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.mjs'
  
  // Disable ES module worker to prevent fallback to pdf.worker.mjs
  pdfjs.GlobalWorkerOptions.workerPort = null
  
  console.log('PDF.js worker configured:', pdfjs.GlobalWorkerOptions.workerSrc)
}

// PDF.js options for better compatibility - static object to prevent unnecessary reloads
const PDF_OPTIONS = {
  cMapUrl: 'https://unpkg.com/pdfjs-dist@4.8.69/cmaps/',
  cMapPacked: true,
  standardFontDataUrl: 'https://unpkg.com/pdfjs-dist@4.8.69/standard_fonts/',
  workerSrc: '/pdf.worker.mjs', // Explicit worker source in options
} as const

interface SignWithMappingViewerProps {
  documentId: string
  documentName: string
  documentUrl: string
  signatureFields: SignatureField[]
  token: string
  onComplete: () => void
  onBack?: () => void
}

interface CompletedSignature {
  fieldId: string
  signatureDataUrl: string
  signatureSource: 'canvas' | 'wacom'
}

export default function SignWithMappingViewer({
  documentId,
  documentName,
  documentUrl,
  signatureFields,
  token,
  onComplete,
  onBack
}: SignWithMappingViewerProps) {
  const [numPages, setNumPages] = useState<number>(0)
  const [pageNumber, setPageNumber] = useState<number>(1)
  const [scale, setScale] = useState<number>(1.0)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [pdfLoadError, setPdfLoadError] = useState<Error | null>(null)
  const [pageSize, setPageSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 })
  const [completedSignatures, setCompletedSignatures] = useState<CompletedSignature[]>([])
  const [showSignatureModal, setShowSignatureModal] = useState<boolean>(false)
  const [currentField, setCurrentField] = useState<SignatureField | null>(null)
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [sharedSignature, setSharedSignature] = useState<{ dataUrl: string; source: 'canvas' | 'wacom' } | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false)

  const { toast } = useToast()

  // Ensure PDF.js worker is properly configured
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Force reconfigure the worker to prevent ES module fallback
      pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.mjs'
      pdfjs.GlobalWorkerOptions.workerPort = null
      
      console.log('PDF.js worker reconfigured in useEffect:', pdfjs.GlobalWorkerOptions.workerSrc)
    }
  }, [])

  // Force loading to false after timeout
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (isLoading) {
        console.warn("PDF loading timeout - setting loading to false")
        setIsLoading(false)
      }
    }, 10000) // 10 second timeout

    return () => clearTimeout(timeout)
  }, [documentUrl, isLoading])

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages)
    setPageNumber(1)
    setIsLoading(false)
    setPdfLoadError(null)
  }

  const onPageLoadSuccess = ({ width, height }: { width: number; height: number }) => {
    setPageSize({ width, height })
  }

  const goToPrevPage = () => {
    setPageNumber(prev => Math.max(prev - 1, 1))
  }

  const goToNextPage = () => {
    setPageNumber(prev => Math.min(prev + 1, numPages))
  }

  const handleFieldClick = (field: SignatureField) => {
    // Navigate to the page where the signature field is located
    if (field.page !== pageNumber) {
      setPageNumber(field.page)
    }
    
    setCurrentField(field)
    setShowSignatureModal(true)
    setIsDrawerOpen(false)
  }

  const handleSignatureComplete = (signatureDataUrl: string) => {
    if (!currentField) return

    // Save the signature for this field
    const newSignature: CompletedSignature = {
      fieldId: currentField.id,
      signatureDataUrl: signatureDataUrl,
      signatureSource: 'canvas'
    }

    setCompletedSignatures(prev => {
      const filtered = prev.filter(sig => sig.fieldId !== currentField.id)
      return [...filtered, newSignature]
    })

    // Save as shared signature for easy reuse
    setSharedSignature({ dataUrl: signatureDataUrl, source: 'canvas' })

    setShowSignatureModal(false)
    setCurrentField(null)

    toast({
      title: "Firma añadida",
      description: `Firma añadida al campo "${currentField.label}"`,
    })
  }

  const handleUseSharedSignature = (field: SignatureField) => {
    if (!sharedSignature) return

    const newSignature: CompletedSignature = {
      fieldId: field.id,
      signatureDataUrl: sharedSignature.dataUrl,
      signatureSource: sharedSignature.source
    }

    setCompletedSignatures(prev => {
      const filtered = prev.filter(sig => sig.fieldId !== field.id)
      return [...filtered, newSignature]
    })

    toast({
      title: "Firma aplicada",
      description: `Firma aplicada al campo "${field.label}"`,
    })
  }

  const handleSubmitSignatures = async () => {
    if (completedSignatures.length !== signatureFields.length) {
      toast({
        title: "Firmas incompletas",
        description: "Debe completar todas las firmas requeridas antes de enviar",
        variant: "destructive"
      })
      return
    }

    setIsSubmitting(true)

    try {
      // Submit all signatures
      for (const signature of completedSignatures) {
        const field = signatureFields.find(f => f.id === signature.fieldId)
        if (!field) continue

        const response = await fetch(`/api/documents/${documentId}/signature`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            signatureDataUrl: signature.signatureDataUrl,
            signatureSource: signature.signatureSource,
            token: token,
            position: {
              x: field.x,
              y: field.y,
              width: field.width,
              height: field.height,
              page: field.page,
              relativeX: field.relativeX,
              relativeY: field.relativeY
            }
          }),
        })

        if (!response.ok) {
          throw new Error(`Failed to save signature for field ${field.label}`)
        }
      }

      // Send the document
      const sendResponse = await fetch(`/api/documents/${documentId}/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token: token
        }),
      })

      if (!sendResponse.ok) {
        const errorData = await sendResponse.json()
        throw new Error(errorData.error || "Failed to send document")
      }

      toast({
        title: "Documento firmado",
        description: "Todas las firmas han sido aplicadas y el documento enviado exitosamente",
      })

      onComplete()

    } catch (error) {
      console.error("Error submitting signatures:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Error al enviar las firmas",
        variant: "destructive"
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const goToFieldPage = (field: SignatureField) => {
    setPageNumber(field.page)
  }

  const isFieldCompleted = (fieldId: string) => {
    return completedSignatures.some(sig => sig.fieldId === fieldId)
  }

  const fieldsOnCurrentPage = signatureFields.filter(field => field.page === pageNumber)
  const completedCount = completedSignatures.length
  const totalCount = signatureFields.length

  // Reusable sidebar content component
  const SidebarContent = ({ onClose }: { onClose?: () => void }) => (
    <>
      <div className="p-4 border-b">
        <h2 className="text-lg font-semibold">Firmas Requeridas</h2>
        <p className="text-sm text-gray-600 mt-1">
          {completedCount} de {totalCount} completadas
        </p>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-3">
        {signatureFields.map((field, index) => {
          const isCompleted = isFieldCompleted(field.id)
          
          return (
            <Card 
              key={field.id} 
              className={`cursor-pointer transition-all ${
                isCompleted ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-blue-300'
              }`}
              onClick={() => {
                goToFieldPage(field)
                onClose?.() // Close drawer on mobile when navigating
              }}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">
                    {field.label}
                  </CardTitle>
                  {isCompleted && (
                    <div className="bg-green-500 text-white rounded-full w-5 h-5 flex items-center justify-center">
                      <Check className="h-3 w-3" />
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-xs text-gray-600 mb-2">
                  Página {field.page}
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation()
                      goToFieldPage(field)
                      onClose?.() // Close drawer when navigating
                    }}
                    className="flex-1"
                  >
                    Ir a página
                  </Button>
                  <Button
                    size="sm"
                    variant={isCompleted ? "secondary" : "default"}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleFieldClick(field)
                      onClose?.() // Close drawer when opening signature modal
                    }}
                    className="flex-1"
                  >
                    <Edit3 className="h-3 w-3 mr-1" />
                    {isCompleted ? "Cambiar" : "Firmar"}
                  </Button>
                </div>
                {sharedSignature && !isCompleted && (
                  <div className="mt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleUseSharedSignature(field)
                      }}
                      className="w-full"
                    >
                      Usar firma anterior
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="p-4 border-t">
        <Button
          onClick={() => {
            handleSubmitSignatures()
            onClose?.() // Close drawer after submitting
          }}
          disabled={isSubmitting || completedCount !== totalCount}
          className="w-full bg-green-600 hover:bg-green-700 text-white"
        >
          {isSubmitting ? "Enviando..." : `Enviar Documento (${completedCount}/${totalCount})`}
        </Button>
      </div>
    </>
  )

  return (
    <div className="flex flex-col md:flex-row h-screen bg-white">
      {/* Main document viewer */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Header */}
        <div className="px-3 md:px-6 py-3 md:py-4 border-b bg-gray-50 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 md:space-x-4 flex-1 min-w-0">
              {onBack && (
                <Button variant="outline" size="sm" onClick={onBack} className="shrink-0">
                  <ChevronLeft className="h-4 w-4 md:mr-1" />
                  <span className="hidden md:inline">Atrás</span>
                </Button>
              )}
              <div className="flex items-center space-x-2 min-w-0">
                <Logo className="h-5 w-5 md:h-6 md:w-6 shrink-0" color="#0d2340" />
                <h1 className="text-sm md:text-lg font-semibold truncate">
                  {documentName}
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant={completedCount === totalCount ? "default" : "secondary"} className="text-xs">
                {completedCount}/{totalCount}
              </Badge>
              {/* Mobile menu button */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsDrawerOpen(true)}
                className="md:hidden h-8 w-8 p-0"
              >
                <Menu className="h-4 w-4" />
              </Button>
              {/* Hide send button on mobile - it will be in the sidebar/drawer */}
              <Button
                onClick={handleSubmitSignatures}
                disabled={isSubmitting || completedCount !== totalCount}
                className="hidden md:flex bg-green-600 hover:bg-green-700 text-white"
              >
                {isSubmitting ? "Enviando..." : "Enviar Documento"}
              </Button>
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="px-3 md:px-6 py-2 md:py-3 border-b bg-gray-50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 md:gap-4">
            {/* Page navigation */}
            <div className="flex items-center gap-1 md:gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={goToPrevPage}
                disabled={pageNumber <= 1 || isLoading}
                className="h-8 w-8 p-0 md:h-9 md:w-auto md:px-3"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs md:text-sm font-medium min-w-[80px] md:min-w-[100px] text-center">
                {isLoading ? "..." : `${pageNumber} de ${numPages}`}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={goToNextPage}
                disabled={pageNumber >= numPages || isLoading}
                className="h-8 w-8 p-0 md:h-9 md:w-auto md:px-3"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="text-xs md:text-sm text-gray-600 hidden sm:block">
            Haz clic en las áreas azules para firmar
          </div>
        </div>

        {/* Document viewer - Scrollable container */}
        <div className="flex-1 overflow-auto bg-gray-100 p-2 md:p-4 pb-20 md:pb-2 min-h-0">
          <div className="w-full min-h-full flex justify-center">
            <div className="bg-white shadow-lg relative max-w-full">
              <Document
                file={documentUrl}
                onLoadSuccess={onDocumentLoadSuccess}
                onLoadError={(error) => {
                  console.error("Error loading PDF:", error)
                  setPdfLoadError(error)
                  setIsLoading(false)
                  setNumPages(1)
                  toast({
                    title: "Error al cargar PDF",
                    description: "Hubo un problema al cargar el documento. Algunas funciones pueden estar limitadas.",
                    variant: "destructive"
                  })
                }}
                options={PDF_OPTIONS}
                loading={
                  <div className="flex items-center justify-center min-h-[50vh] w-full max-w-full">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                      <p className="text-gray-600">Cargando documento PDF...</p>
                    </div>
                  </div>
                }
                error={
                  <div className="flex flex-col items-center justify-center min-h-[50vh] w-full max-w-full bg-gray-50 border-2 border-dashed border-gray-300">
                    <div className="text-center p-4 lg:p-8">
                      <div className="text-red-500 text-4xl lg:text-6xl mb-4">⚠️</div>
                      <h3 className="text-base lg:text-lg font-semibold text-gray-900 mb-2">Error al cargar PDF</h3>
                      <p className="text-sm lg:text-base text-gray-600 mb-4">
                        No se pudo cargar el documento PDF. Esto podría deberse a:
                      </p>
                      <ul className="text-xs lg:text-sm text-gray-500 text-left mb-6">
                        <li>• Problemas de conectividad de red</li>
                        <li>• Corrupción del archivo PDF</li>
                        <li>• Incompatibilidad del navegador</li>
                        <li>• PDF.js worker no disponible</li>
                      </ul>
                      <div className="flex flex-col sm:flex-row gap-2 justify-center">
                        <button
                          onClick={() => {
                            setIsLoading(true)
                            setPdfLoadError(null)
                            window.location.reload()
                          }}
                          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                        >
                          Recargar Página
                        </button>
                      </div>
                    </div>
                  </div>
                }
              >

                {!isLoading && !pdfLoadError && numPages > 0 ? (
                  <>
                    <Page
                      pageNumber={pageNumber}
                      scale={scale}
                      onLoadSuccess={onPageLoadSuccess}
                      loading={
                        <div className="flex items-center justify-center h-96">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                        </div>
                      }
                    />

                    {/* Render signature fields */}
                    {fieldsOnCurrentPage.map((field) => {
                      const isCompleted = isFieldCompleted(field.id)
                      const signature = completedSignatures.find(sig => sig.fieldId === field.id)

                      return (
                        <div
                          key={field.id}
                          className={`absolute cursor-pointer transition-all ${
                            isCompleted 
                              ? 'border-2 border-green-500 bg-green-100' 
                              : 'border-2 border-blue-500 bg-blue-100 hover:bg-blue-200'
                          } bg-opacity-50 flex items-center justify-center group`}
                          style={{
                            left: `${field.relativeX * pageSize.width * scale}px`,
                            top: `${field.relativeY * pageSize.height * scale}px`,
                            width: `${field.relativeWidth * pageSize.width * scale}px`,
                            height: `${field.relativeHeight * pageSize.height * scale}px`,
                          }}
                          onClick={() => handleFieldClick(field)}
                        >
                          {isCompleted && signature ? (
                            <img
                              src={signature.signatureDataUrl}
                              alt="Firma"
                              className="w-full h-full object-contain"
                            />
                          ) : (
                            <>
                              {/* Pulsing circle indicator */}
                              <div className="absolute inset-0 flex items-center justify-center">
                                <div className="relative">
                                  <div className="w-8 h-8 bg-blue-500 rounded-full animate-ping opacity-75"></div>
                                  <div className="absolute inset-0 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                                    <Edit3 className="h-4 w-4 text-white" />
                                  </div>
                                </div>
                              </div>
                              {/* Field label */}
                              <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-75 text-white text-xs p-1 text-center">
                                {field.label}
                              </div>
                            </>
                          )}
                          
                          {isCompleted && (
                            <div className="absolute -top-1 -right-1 bg-green-500 text-white rounded-full w-5 h-5 flex items-center justify-center">
                              <Check className="h-3 w-3" />
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </>
                ) : isLoading ? (
                  <div className="flex items-center justify-center min-h-[50vh] w-full max-w-full bg-gray-50">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                      <p className="text-gray-600">Inicializando visor PDF...</p>
                    </div>
                  </div>
                ) : pdfLoadError ? (
                  <div className="flex items-center justify-center min-h-[50vh] w-full max-w-full bg-red-50 border-2 border-red-200">
                    <div className="text-center p-4 lg:p-6">
                      <div className="text-red-500 text-3xl lg:text-4xl mb-4">❌</div>
                      <h3 className="text-base lg:text-lg font-semibold text-red-900 mb-2">Error de PDF</h3>
                      <p className="text-red-700 text-xs lg:text-sm mb-4">
                        {pdfLoadError.message || "Error al cargar el documento PDF"}
                      </p>
                      <button
                        onClick={() => {
                          setIsLoading(true)
                          setPdfLoadError(null)
                          window.location.reload()
                        }}
                        className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                      >
                        Reintentar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center min-h-[50vh] w-full max-w-full bg-gray-50">
                    <div className="text-center">
                      <p className="text-gray-600">No hay páginas PDF disponibles</p>
                    </div>
                  </div>
                )}
              </Document>
            </div>
          </div>
        </div>
      </div>

      {/* Sidebar with signature fields - Desktop only */}
      <div className="hidden md:flex w-80 border-l bg-gray-50 flex-col">
        <SidebarContent />
      </div>

      {/* Mobile Drawer */}
      <Sheet open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
        <SheetContent side="right" className="w-[75vw] sm:w-80 p-0 bg-gray-50">
          <SheetHeader className="sr-only">
            <SheetTitle>Firmas Requeridas</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col h-full">
            <SidebarContent onClose={() => setIsDrawerOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>

      {/* Signature Modal */}
      {showSignatureModal && currentField && (
        <SimpleSignatureCanvas
          isOpen={showSignatureModal}
          onClose={() => setShowSignatureModal(false)}
          onComplete={handleSignatureComplete}
        />
      )}

      {/* Fixed Bottom Bar - Mobile only */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 border-t bg-white p-4 z-10">
        {completedCount === totalCount ? (
          <Button
            onClick={handleSubmitSignatures}
            disabled={isSubmitting}
            className="w-full bg-green-600 hover:bg-green-700 text-white py-3"
            size="lg"
          >
            {isSubmitting ? "Enviando..." : "Enviar Documento"}
          </Button>
        ) : (
          <Button
            onClick={() => setIsDrawerOpen(true)}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3"
            size="lg"
          >
            Firmar el Documento ({completedCount}/{totalCount})
          </Button>
        )}
      </div>
    </div>
  )
}
