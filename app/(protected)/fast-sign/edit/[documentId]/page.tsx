"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import {
  FileText,
  Save,
  X,
  Printer,
  Trash2,
  ArrowLeft,
  Send,
  ChevronLeft,
  ChevronRight,
  Link,
  Unlink
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import PdfAnnotationEditor from "@/components/pdf-annotation-editor"
import FastSignAquariusModal from "@/components/fast-sign-aquarius-modal"
import FileRecordSelector from "@/components/file-record-selector"

interface FastSignAnnotation {
  id: string
  type: "signature" | "text"
  x: number
  y: number
  width: number
  height: number
  content?: string
  imageData?: string
  signatureSource?: "canvas" | "wacom"
  page: number
  relativeX?: number
  relativeY?: number
  relativeWidth?: number
  relativeHeight?: number
  timestamp: string
}

interface Document {
  id: string
  file_name: string
  file_path: string
}

interface DocumentSidebarProps {
  document: {
    id: string
    file_name: string
    file_path: string
  }
  annotations: FastSignAnnotation[]
  linkedFileRecord?: any
  onPrint: () => void
  onSendToAquarius: () => void
  onDelete: () => void
  onSave: () => void
  onLinkToFileRecord: () => void
  onUnlinkFileRecord: () => void
  onGoToPage?: (page: number) => void
  isPrinting: boolean
  isSaving: boolean
  lastUpdated?: Date | null
  isOpen?: boolean
  onClose?: () => void
}

function DocumentSidebar({
  document,
  annotations,
  linkedFileRecord,
  onPrint,
  onSendToAquarius,
  onDelete,
  onSave,
  onLinkToFileRecord,
  onUnlinkFileRecord,
  onGoToPage,
  isPrinting,
  isSaving,
  lastUpdated,
  isOpen = true,
  onClose,
}: DocumentSidebarProps) {
  const signatureCount = annotations.filter(a => a.type === "signature").length
  const textCount = annotations.filter(a => a.type === "text").length

  // Group annotations by page for better organization
  const pageAnnotations = annotations.reduce((acc, annotation) => {
    const page = annotation.page || 1
    if (!acc[page]) acc[page] = []
    acc[page].push(annotation)
    return acc
  }, {} as Record<number, FastSignAnnotation[]>)

  const pages = Object.keys(pageAnnotations).map(Number).sort((a, b) => a - b)

  if (!isOpen) return null

  return (
    <div className="w-80 border-l border-border bg-white flex flex-col shadow-lg h-full">
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="font-semibold text-sm">Editar Documento</h3>
        {onClose && (
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-auto">
        <SidebarContent
          document={document}
          annotations={annotations}
          linkedFileRecord={linkedFileRecord}
          onPrint={onPrint}
          onSendToAquarius={onSendToAquarius}
          onDelete={onDelete}
          onSave={onSave}
          onLinkToFileRecord={onLinkToFileRecord}
          onUnlinkFileRecord={onUnlinkFileRecord}
          onGoToPage={onGoToPage}
          isPrinting={isPrinting}
          isSaving={isSaving}
          lastUpdated={lastUpdated}
          signatureCount={signatureCount}
        />
      </div>
    </div>
  )
}

function SidebarContent({
  document,
  annotations,
  linkedFileRecord,
  onPrint,
  onSendToAquarius,
  onDelete,
  onSave,
  onLinkToFileRecord,
  onUnlinkFileRecord,
  onGoToPage,
  isPrinting,
  isSaving,
  lastUpdated,
  signatureCount,
}: {
  document: { id: string; file_name: string; file_path: string }
  annotations: FastSignAnnotation[]
  linkedFileRecord?: any
  onPrint: () => void
  onSendToAquarius: () => void
  onDelete: () => void
  onSave: () => void
  onLinkToFileRecord: () => void
  onUnlinkFileRecord: () => void
  onGoToPage?: (page: number) => void
  isPrinting: boolean
  isSaving: boolean
  lastUpdated?: Date | null
  signatureCount: number
}) {
  // Group annotations by page
  const pageAnnotations = annotations.reduce((acc, annotation) => {
    const page = annotation.page || 1
    if (!acc[page]) acc[page] = []
    acc[page].push(annotation)
    return acc
  }, {} as Record<number, FastSignAnnotation[]>)

  const pages = Object.keys(pageAnnotations).map(Number).sort((a, b) => a - b)

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('es-ES', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    })
  }

  return (
    <div className="p-4 space-y-4">
      {/* Document Info */}
      <div className="space-y-3">
        <div>
          <h4 className="font-medium text-sm mb-2 flex items-center">
            <FileText className="h-4 w-4 mr-2" />
            {document.file_name}
          </h4>
          <div className="text-xs text-muted-foreground space-y-1">
            <div>Firmas: {signatureCount}</div>
            <div>Texto: {annotations.filter(a => a.type === "text").length}</div>
            {lastUpdated && (
              <div>Actualizado: {formatTime(lastUpdated)}</div>
            )}
          </div>
        </div>

        {/* File Record Link Status */}
        {linkedFileRecord ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Link className="h-4 w-4 text-green-600 mr-2" />
                <span className="text-sm font-medium text-green-800">Vinculado</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={onUnlinkFileRecord}
                className="text-green-700 hover:text-green-900 h-6 px-2"
              >
                <Unlink className="h-3 w-3" />
              </Button>
            </div>
            <div className="text-xs text-green-700 mt-1 truncate">
              {linkedFileRecord.name}
            </div>
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={onLinkToFileRecord}
            className="w-full"
          >
            <Link className="h-4 w-4 mr-2" />
            Vincular a Expediente
          </Button>
        )}
      </div>

      {/* Actions */}
      <div className="space-y-2">
        <Button
          onClick={onSave}
          disabled={isSaving}
          size="sm"
          className="w-full"
        >
          <Save className="h-4 w-4 mr-2" />
          {isSaving ? "Guardando..." : "Guardar Cambios"}
        </Button>

        <div className="grid grid-cols-2 gap-2">
          <Button
            onClick={onPrint}
            disabled={isPrinting}
            variant="outline"
            size="sm"
          >
            <Printer className="h-4 w-4 mr-2" />
            {isPrinting ? "..." : "Imprimir"}
          </Button>

          <Button
            onClick={onSendToAquarius}
            variant="outline"
            size="sm"
          >
            <Send className="h-4 w-4 mr-2" />
            Enviar
          </Button>
        </div>
      </div>

      {/* Annotations by Page */}
      {pages.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-medium text-sm">Anotaciones por Página</h4>
          <div className="space-y-2">
            {pages.map(page => {
              const pageAnns = pageAnnotations[page]
              const signatures = pageAnns.filter(a => a.type === "signature")
              const texts = pageAnns.filter(a => a.type === "text")

              return (
                <div key={page} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm">Página {page}</span>
                    {onGoToPage && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onGoToPage(page)}
                        className="h-6 px-2 text-xs"
                      >
                        Ir
                      </Button>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground space-y-1">
                    {signatures.length > 0 && (
                      <div>• {signatures.length} firma(s)</div>
                    )}
                    {texts.length > 0 && (
                      <div>• {texts.length} texto(s)</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Delete Action */}
      <div className="pt-4 border-t">
        <Button
          onClick={onDelete}
          variant="destructive"
          size="sm"
          className="w-full"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Eliminar Documento
        </Button>
      </div>
    </div>
  )
}

export default function FastSignEditPage({ params }: { params: Promise<{ documentId: string }> }) {
  const router = useRouter()
  const { toast } = useToast()
  
  // Unwrap params
  const [documentId, setDocumentId] = useState<string>("")
  
  useEffect(() => {
    params.then(p => setDocumentId(p.documentId))
  }, [params])

  // State
  const [documentUrl, setDocumentUrl] = useState("")
  const [documentName, setDocumentName] = useState("")
  const [annotations, setAnnotations] = useState<FastSignAnnotation[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isPrinting, setIsPrinting] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showAquariusModal, setShowAquariusModal] = useState(false)
  const [showFileRecordSelector, setShowFileRecordSelector] = useState(false)
  const [linkedFileRecord, setLinkedFileRecord] = useState<any>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [isManualUpdate, setIsManualUpdate] = useState(false)

  // Load document and annotations on mount
  useEffect(() => {
    if (!documentId) return
    const loadDocument = async () => {
      try {
        setIsLoading(true)

        // Get document from database
        const response = await fetch(`/api/documents/${documentId}`)
        if (!response.ok) {
          throw new Error("Failed to fetch document")
        }

        const documentData = await response.json()

        // Set document state
        setDocumentUrl(documentData.file_url || documentData.url)
        setDocumentName(documentData.file_name)

        // Load linked file record if exists
        if (documentData.file_record_id) {
          try {
            const { getFileRecordById } = await import("@/app/actions/filing-system-actions")
            const fileRecordResult = await getFileRecordById(documentData.file_record_id)
            if (fileRecordResult.record) {
              setLinkedFileRecord(fileRecordResult.record)
            }
          } catch (error) {
            // Failed to load linked file record
          }
        }

        // Load annotations (text annotations)
        try {
          const annotationsResponse = await fetch(`/api/annotations/${documentId}`)
          if (annotationsResponse.ok) {
            const annotationsData = await annotationsResponse.json()
          }
        } catch (error) {
          // Failed to load annotations
        }

        // Load signatures
        try {
          const signaturesResponse = await fetch(`/api/documents/${documentId}/signatures/check`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              token: Buffer.from("fast-sign-docs@view-all").toString("base64"),
              includeData: true,
            }),
          })

          if (signaturesResponse.ok) {
            const signaturesData = await signaturesResponse.json()

            if (signaturesData.signatures && signaturesData.signatures.length > 0) {
              // Convert signatures to annotations format
              const signatureAnnotations: FastSignAnnotation[] = []

              signaturesData.signatures.forEach((sigRecord: any, recordIndex: number) => {
                
                // Process ALL signature records regardless of recipient_email
                // This allows editing documents that originated in sent-to-sign
                

                if (sigRecord.signature_data?.signatures) {
                  // New format: signatures array
                  sigRecord.signature_data.signatures.forEach((sig: any, sigIndex: number) => {
                    
                    // Ensure each signature has a unique ID
                    const signatureId = sig.id || `sig-${recordIndex}-${sigIndex}-${Date.now()}`
                    
                    signatureAnnotations.push({
                      id: signatureId,
                      type: "signature",
                      x: sig.position?.x || 100,
                      y: sig.position?.y || 100,
                      width: sig.position?.width || 300,
                      height: sig.position?.height || 150,
                      page: sig.position?.page || 1,
                      relativeX: sig.position?.relativeX || 0.15,
                      relativeY: sig.position?.relativeY || 0.15,
                      relativeWidth: sig.position?.relativeWidth || 0.49,
                      relativeHeight: sig.position?.relativeHeight || 0.19,
                      imageData: sig.dataUrl || "",
                      timestamp: sig.timestamp || sigRecord.signed_at,
                      signatureSource: sig.source || sigRecord.signature_source || "canvas",
                    })
                  })
                } else if (sigRecord.signature_data?.dataUrl) {
                  // Old format: direct signature data
                  
                  // Ensure unique ID for old format
                  const signatureId = sigRecord.id || `sig-old-${recordIndex}-${Date.now()}`
                  
                  signatureAnnotations.push({
                    id: signatureId,
                    type: "signature",
                    x: sigRecord.signature_data.position?.x || 100,
                    y: sigRecord.signature_data.position?.y || 100,
                    width: sigRecord.signature_data.position?.width || 300,
                    height: sigRecord.signature_data.position?.height || 150,
                    page: sigRecord.signature_data.position?.page || 1,
                    relativeX: sigRecord.signature_data.position?.relativeX || 0.15,
                    relativeY: sigRecord.signature_data.position?.relativeY || 0.15,
                    relativeWidth: sigRecord.signature_data.position?.relativeWidth || 0.49,
                    relativeHeight: sigRecord.signature_data.position?.relativeHeight || 0.19,
                    imageData: sigRecord.signature_data.dataUrl || "",
                    timestamp: sigRecord.signature_data.timestamp || sigRecord.signed_at,
                    signatureSource: sigRecord.signature_source || "canvas",
                  })
                }
              })

              setAnnotations(signatureAnnotations)
            }
          }
        } catch (error) {
          // Failed to load signatures
        }
      } catch (error) {
        toast({
          title: "Failed to load document",
          description: "Could not load the document for editing. Please try again.",
          variant: "destructive",
        })
        router.push("/fast-sign?view=manage")
      } finally {
        setIsLoading(false)
      }
    }

    loadDocument()
  }, [documentId, router, toast])

  // Debounced auto-save for fast-sign edit mode
  const debouncedSaveRef = useRef<NodeJS.Timeout | null>(null)
  const pendingAnnotationsRef = useRef<FastSignAnnotation[]>([])

  const handleSaveAnnotations = async (newAnnotations: FastSignAnnotation[]) => {
    // In edit mode, we always want to update the database since the document exists
    
    // More detailed logging for debugging

    // Check for actual changes using a more reliable comparison
    const previousIds = new Set(annotations.map(a => a.id))
    const newIds = new Set(newAnnotations.map(a => a.id))
    
    const hasAddedAnnotations = newAnnotations.some(a => !previousIds.has(a.id))
    const hasRemovedAnnotations = annotations.some(a => !newIds.has(a.id))
    const hasChangedPositions = newAnnotations.some(newAnn => {
      const oldAnn = annotations.find(a => a.id === newAnn.id)
      return oldAnn && (
        oldAnn.x !== newAnn.x ||
        oldAnn.y !== newAnn.y ||
        oldAnn.width !== newAnn.width ||
        oldAnn.height !== newAnn.height ||
        oldAnn.page !== newAnn.page ||
        oldAnn.relativeX !== newAnn.relativeX ||
        oldAnn.relativeY !== newAnn.relativeY ||
        oldAnn.relativeWidth !== newAnn.relativeWidth ||
        oldAnn.relativeHeight !== newAnn.relativeHeight
      )
    })

    const hasChanged = hasAddedAnnotations || hasRemovedAnnotations || hasChangedPositions

    if (!hasChanged && !isManualUpdate) {
      return
    }

    // Update the state immediately to show the changes
    setAnnotations(newAnnotations)
    setLastUpdated(new Date())

    // Set up debounced auto-save
    if (debouncedSaveRef.current) {
      clearTimeout(debouncedSaveRef.current)
    }

    // Store the pending annotations
    pendingAnnotationsRef.current = newAnnotations

    debouncedSaveRef.current = setTimeout(async () => {
      try {
        await autoSaveChanges(pendingAnnotationsRef.current)
      } catch (error) {
        toast({
          title: "Auto-save failed",
          description: "Your changes could not be saved automatically. Please save manually.",
          variant: "destructive",
        })
      }
    }, 1000)

    // Reset manual update flag
    setIsManualUpdate(false)
  }

  const autoSaveChanges = async (newAnnotations: FastSignAnnotation[]) => {

    const signatures = newAnnotations.filter((a) => a.type === "signature")
    const textAnnotations = newAnnotations.filter((a) => a.type === "text")

    if (!documentId) {
      return
    }

    try {
      // First clear existing signatures
      const clearResponse = await fetch(`/api/documents/${documentId}/signatures`, {
        method: "DELETE",
      })

      if (!clearResponse.ok) {
        throw new Error("Failed to clear existing signatures")
      }

      // Save text annotations if any
      if (textAnnotations.length > 0) {
        const textResponse = await fetch(`/api/annotations/${documentId}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            annotations: textAnnotations.map((ann) => ({
              id: ann.id,
              type: ann.type,
              content: ann.content,
              x: ann.x,
              y: ann.y,
              width: ann.width,
              height: ann.height,
              page: ann.page,
            })),
          }),
        })

        if (!textResponse.ok) {
          throw new Error("Failed to save text annotations")
        }
      }

      // Process signatures one by one
      for (const signature of signatures) {
        const signatureResponse = await fetch(`/api/documents/${documentId}/signature`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            id: signature.id,
            dataUrl: signature.imageData,
            position: {
              x: signature.x,
              y: signature.y,
              width: signature.width,
              height: signature.height,
              page: signature.page,
              relativeX: signature.relativeX,
              relativeY: signature.relativeY,
              relativeWidth: signature.relativeWidth,
              relativeHeight: signature.relativeHeight,
            },
            source: signature.signatureSource || "canvas",
            timestamp: signature.timestamp,
          }),
        })

        if (!signatureResponse.ok) {
          const errorText = await signatureResponse.text()
          throw new Error(`Failed to save signature: ${errorText}`)
        }
      }

      setLastUpdated(new Date())
    } catch (error) {
      throw error
    }
  }

  const updateDocument = async () => {
    if (!documentId) {
      return
    }

    setIsSaving(true)
    setIsManualUpdate(true)

    try {
      // Cancel any pending debounced save
      if (debouncedSaveRef.current) {
        clearTimeout(debouncedSaveRef.current)
        debouncedSaveRef.current = null
      }

      await autoSaveChanges(annotations)

      toast({
        title: "Document saved",
        description: "Your changes have been saved successfully.",
      })
    } catch (error) {
      toast({
        title: "Failed to save",
        description: "Could not save your changes. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const linkToFileRecord = async (recordId: string) => {
    try {
      const response = await fetch(`/api/documents/${documentId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          file_record_id: recordId,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to link to file record")
      }

      // Reload file record data
      try {
        const { getFileRecordById } = await import("@/app/actions/filing-system-actions")
        const fileRecordResult = await getFileRecordById(recordId)
        if (fileRecordResult.record) {
          setLinkedFileRecord(fileRecordResult.record)
        }
      } catch (error) {
        // Failed to load linked file record after linking
      }

      toast({
        title: "Document linked",
        description: "Document has been linked to the file record successfully.",
      })
    } catch (error) {
      toast({
        title: "Failed to link",
        description: "Could not link document to file record. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handlePrint = async () => {
    setIsPrinting(true)

    try {
      // Cancel any pending debounced save and save immediately before printing
      if (debouncedSaveRef.current) {
        clearTimeout(debouncedSaveRef.current)
        debouncedSaveRef.current = null
      }

      await autoSaveChanges(annotations)

      // Generate the merged PDF with signatures
      const response = await fetch(`/api/fast-sign/${documentId}/print`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      })

      if (!response.ok) {
        throw new Error(`Failed to generate merged PDF: ${response.status} ${response.statusText}`)
      }

      const blob = await response.blob()

      // Create download link
      const url = window.URL.createObjectURL(blob)
      
      // Open in new tab
      const newWindow = window.open(url, '_blank')
      if (!newWindow) {
        // Fallback to download if popup is blocked
        const link = document.createElement('a')
        link.href = url
        link.download = `${documentName || 'document'}_signed.pdf`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
      }

      // Clean up the blob URL after a delay
      setTimeout(() => {
        window.URL.revokeObjectURL(url)
      }, 1000)

      toast({
        title: "Document ready for printing",
        description: "The signed document has been opened in a new tab.",
      })
    } catch (error) {
      toast({
        title: "Print failed",
        description: "Could not prepare the document for printing. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsPrinting(false)
    }
  }

  const handleSendToAquarius = () => {
    setShowAquariusModal(true)
  }

  const handleLinkToFileRecord = () => {
    setShowFileRecordSelector(true)
  }

  const handleCloseFileRecordSelector = () => {
    setShowFileRecordSelector(false)
  }

  const handleFileRecordSuccess = async (recordId: string) => {
    setShowFileRecordSelector(false)
    await linkToFileRecord(recordId)
  }

  const handleUnlinkClick = () => {
    handleUnlinkFileRecord()
  }

  const handleUnlinkFileRecord = async () => {
    try {
      const response = await fetch(`/api/documents/${documentId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          file_record_id: null,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to unlink from file record")
      }

      setLinkedFileRecord(null)

      toast({
        title: "Document unlinked",
        description: "Document has been unlinked from the file record.",
      })
    } catch (error) {
      toast({
        title: "Failed to unlink",
        description: "Could not unlink document from file record. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleDeleteDocument = async () => {
    try {
      const response = await fetch(`/api/documents/${documentId}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error("Failed to delete document")
      }

      toast({
        title: "Document deleted",
        description: "The document has been deleted successfully.",
      })

      router.push("/fast-sign?view=manage")
    } catch (error) {
      toast({
        title: "Failed to delete",
        description: "Could not delete the document. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleDeleteClick = () => {
    setShowDeleteDialog(true)
  }

  const handleBack = () => {
    router.push("/fast-sign?view=manage")
  }

  const handleGoToPage = (page: number) => {
    // This would need to be implemented in the PDF viewer component
    return page
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p>Cargando documento...</p>
        </div>
      </div>
    )
  }

  if (!documentUrl) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p>Documento no encontrado</p>
          <Button onClick={handleBack} className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full">
      {/* Header Bar */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-white border-b border-border">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="sm" onClick={handleBack}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver
            </Button>
            <div>
              <h1 className="text-lg font-semibold truncate max-w-md">{documentName}</h1>
              <p className="text-sm text-muted-foreground">Modo edición</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
              {isSidebarOpen ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className={`flex-1 pt-20 ${isSidebarOpen ? '' : 'pr-0'}`}>
        <PdfAnnotationEditor
          key={documentId}
          documentUrl={documentUrl}
          documentName={documentName}
          documentId={documentId}
          onBack={handleBack}
          onSave={handleSaveAnnotations}
          initialAnnotations={annotations}
          readOnly={false}
          hideSaveButton={true}
        />
      </div>

      {/* Sidebar */}
      {isSidebarOpen && (
        <DocumentSidebar
          document={{
            id: documentId,
            file_name: documentName,
            file_path: documentUrl,
          }}
          annotations={annotations}
          linkedFileRecord={linkedFileRecord}
          onPrint={handlePrint}
          onSendToAquarius={handleSendToAquarius}
          onDelete={handleDeleteClick}
          onSave={updateDocument}
          onLinkToFileRecord={handleLinkToFileRecord}
          onUnlinkFileRecord={handleUnlinkClick}
          onGoToPage={handleGoToPage}
          isPrinting={isPrinting}
          isSaving={isSaving}
          lastUpdated={lastUpdated}
        />
      )}

      {/* Modals */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar documento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El documento y todas sus firmas serán eliminados permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteDocument} className="bg-red-600 hover:bg-red-700">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <FastSignAquariusModal
        isOpen={showAquariusModal}
        onClose={() => setShowAquariusModal(false)}
        documentId={documentId}
        documentName={documentName}
      />

      <FileRecordSelector
        isOpen={showFileRecordSelector}
        onClose={handleCloseFileRecordSelector}
        onSuccess={handleFileRecordSuccess}
        documentId={documentId}
      />
    </div>
  )
}
