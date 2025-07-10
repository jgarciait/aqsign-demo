"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { Upload, FileText, Trash2, FolderOpen, Plus, Info, Edit3, Unlink } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import PdfAnnotationEditor from "@/components/pdf-annotation-editor"
import FastSignAquariusModal from "@/components/fast-sign-aquarius-modal"
import { PdfErrorBoundary } from "@/components/pdf-error-boundary"

import { createFastSignDocument } from "@/app/actions/fast-sign-actions"
import { useRouter } from "next/navigation"
import { configurePdfJsWithFallback } from "@/utils/pdf-config"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
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

interface DocumentSidebarProps {
  document: {
    id: string
    file_name: string
    file_path: string
  } | null
  annotations: FastSignAnnotation[]
  linkedFileRecord?: any
  onPrint: () => void
  onSendToAquarius: () => void
  onDelete: () => void
  onSave?: () => void
  onLinkToFileRecord: () => void
  onUnlinkFileRecord: () => void
  onGoToPage?: (page: number) => void
  isPrinting: boolean
  isSaved: boolean
  isSaving: boolean
  lastUpdated?: Date | null
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
  isSaved,
  isSaving,
  lastUpdated,
}: DocumentSidebarProps) {
  const signatureCount = annotations.filter((a) => a.type === "signature").length

  if (!document) {
    return (
      <div className="w-80 border-l border-border flex flex-col shadow-lg" style={{ backgroundColor: "#FFFFFF" }}>
        <div className="p-6 text-center text-gray-500">
          <FileText className="h-12 w-12 mx-auto mb-4 text-gray-400" />
          <p>Sube un documento para comenzar</p>
        </div>
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className="w-80 border-l border-border flex flex-col shadow-lg" style={{ backgroundColor: "#FFFFFF" }}>
        {/* Sidebar header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-700">Acciones del Documento</span>
            <span className="text-xs text-muted-foreground">{isSaved ? "Guardado" : "Sin guardar"}</span>
          </div>
          <div className="flex items-center justify-between mb-4">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              Documento Fast Sign
            </span>
            <div className="flex items-center gap-2">
              {/* Document Info Icon */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="p-1 rounded-full hover:bg-gray-100 transition-colors">
                    <Info className="h-4 w-4 text-gray-600" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  <div className="text-sm">
                    <div className="font-medium mb-1">Detalles del Documento</div>
                    <div className="text-xs text-gray-600">
                      <div className="flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        <span>{document.file_name}</span>
                      </div>
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>

              {/* Signatures Info Icon */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="p-1 rounded-full hover:bg-gray-100 transition-colors">
                    <Edit3 className="h-4 w-4 text-gray-600" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  <div className="text-sm">
                    <div className="font-medium mb-1">Anotaciones ({annotations.length})</div>
                    <div className="text-xs text-gray-600 space-y-1">
                      {annotations.length === 0 ? (
                        <div>Aún no hay anotaciones</div>
                      ) : (
                        annotations.slice(0, 5).map((annotation) => (
                          <div key={annotation.id} className="flex items-center gap-1">
                            {annotation.type === "signature" ? (
                              <div className="w-2 h-2 bg-blue-500 rounded" />
                            ) : (
                              <div className="w-2 h-2 bg-green-500 rounded" />
                            )}
                            <span>
                              {annotation.type === "signature" ? "Firma" : "Texto"} en Página {annotation.page}
                            </span>
                          </div>
                        ))
                      )}
                      {annotations.length > 5 && (
                        <div className="text-xs text-gray-500">
                          +{annotations.length - 5} más...
                        </div>
                      )}
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>

            <span className="text-xs text-muted-foreground">
              {signatureCount} firma{signatureCount !== 1 ? "s" : ""}
              {isSaving && " (guardando...)"}
            </span>
            </div>
          </div>

        {/* Last Updated */}
        {lastUpdated && (
          <div className="mb-3 text-center">
            <span className="text-xs text-muted-foreground">
              Última actualización: {lastUpdated.toLocaleString()}
            </span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-3">
          {/* Link to Case File Button */}
          <button
            onClick={onLinkToFileRecord}
            className={`w-full inline-flex items-center justify-center px-4 py-3 shadow-sm text-sm font-medium rounded-lg transition-all duration-300 ${
              linkedFileRecord 
                ? "text-green-700 bg-green-50 border border-green-300 hover:bg-green-100" 
                : "text-blue-700 bg-white hover:bg-blue-50 border border-blue-200"
            }`}
            title={linkedFileRecord ? "Cambiar vinculación de expediente" : "Vincular documento a un expediente"}
          >
            <FolderOpen className="h-4 w-4 mr-2" />
{linkedFileRecord ? "Cambiar Expediente" : "Añadir a Expediente"}
          </button>

          {/* Save Annotations Button - only shows when document is saved and there are annotations */}
          {onSave && isSaved && annotations.length > 0 && (
            <button
              onClick={onSave}
              disabled={isSaving}
              className="w-full inline-flex items-center justify-center px-4 py-3 shadow-sm text-sm font-medium rounded-lg text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                backgroundColor: "#0d2340",
              }}
              title="Actualizar firmas y anotaciones guardadas"
            >
              {isSaving ? (
                <>
                  <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Actualizando Firmas...
                </>
              ) : (
                <>
                  <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3-3m0 0l-3 3m3-3v12"
                    />
                  </svg>
                  Actualizar Firmas
                </>
              )}
            </button>
          )}

          {/* Print Button */}
          <button
            onClick={onPrint}
            disabled={isPrinting || signatureCount === 0}
            className="w-full inline-flex items-center justify-center px-4 py-3 shadow-sm text-sm font-medium rounded-lg text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundColor: "#0d2340",
            }}
            title={signatureCount === 0 ? "Agrega una firma antes de guardar" : "Guardar documento con firmas en PC"}
          >
            {isPrinting ? (
              <>
                <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Preparando Documento...
              </>
            ) : (
              <>
                <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
                  />
                </svg>
                Guardar en PC
              </>
            )}
          </button>

          {/* Send to Aquarius Button */}
          <button
            onClick={onSendToAquarius}
            disabled={signatureCount === 0}
            className="w-full inline-flex items-center justify-center px-4 py-3 shadow-sm text-sm font-medium rounded-lg border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title={signatureCount === 0 ? "Agrega una firma antes de enviar a Aquarius" : "Enviar a Aquarius"}
          >
            <Upload className="h-4 w-4 mr-2" />
            Enviar a Aquarius
          </button>

          {/* Delete Button */}
          <button
            onClick={onDelete}
            className="w-full inline-flex items-center justify-center px-4 py-3 shadow-sm text-sm font-medium rounded-lg border border-red-300 text-red-700 bg-white hover:bg-red-50 transition-colors"
            title="Eliminar documento y empezar de nuevo"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Eliminar Documento
          </button>
        </div>
      </div>

      {/* Linked Case File Section */}
      <div className="p-4 space-y-4 flex-1">
        {/* Linked Case File */}
        {linkedFileRecord && (
        <div>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="case-file" className="border border-green-200 rounded-lg">
                <AccordionTrigger className="px-3 py-2 hover:no-underline">
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2">
                      <FolderOpen className="h-4 w-4 text-green-600" />
                      <span className="text-sm font-medium text-green-700">
                        Documento en Expediente
                      </span>
                      <Badge variant="secondary" className="bg-green-100 text-green-800 text-xs">
                        {linkedFileRecord.filing_systems?.nombre || 'Expediente'}
                      </Badge>
            </div>
                    <div
                      onClick={(e) => {
                        e.stopPropagation()
                        onUnlinkFileRecord()
                      }}
                      className="p-1 rounded-full hover:bg-red-100 transition-colors text-red-600 hover:text-red-700 cursor-pointer"
                      title="Desvincular del expediente"
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          e.stopPropagation()
                          onUnlinkFileRecord()
                        }
                      }}
                    >
                      <Unlink className="h-4 w-4" />
          </div>
        </div>
                </AccordionTrigger>
                <AccordionContent className="px-3 pb-3">
                  <div className="space-y-2 text-sm">
                    {linkedFileRecord.filing_systems?.esquema_json?.indices?.slice(0, 4).map((field: any) => {
                      const value = linkedFileRecord.valores_json?.[field.clave]
                      if (!value) return null
                      
                      let displayValue = value
                      if (field.tipo_dato === 'bool') {
                        displayValue = value ? 'Sí' : 'No'
                      } else if (field.tipo_dato === 'fecha') {
                        displayValue = new Date(value).toLocaleDateString()
                      }
                      
                      return (
                        <div key={field.clave} className="flex justify-between">
                          <span className="font-medium text-gray-600">{field.etiqueta}:</span>
                          <span className="text-gray-900">{displayValue}</span>
                        </div>
                      )
                    })}
                    
                    <div className="flex justify-between">
                      <span className="font-medium text-gray-600">Creado:</span>
                      <span className="text-gray-900">
                        {new Date(linkedFileRecord.created_at).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="pt-2 border-t border-gray-200">
                      <a
                        href={`/case-files/${linkedFileRecord.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 hover:underline transition-colors"
                      >
                        <FolderOpen className="h-4 w-4" />
                        Ver Expediente Completo
                      </a>
                    </div>
                </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        )}

        {/* Signatures Section */}
        {annotations.filter(a => a.type === "signature").length > 0 && (
          <div className="mt-4">
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="signatures" className="border border-blue-200 rounded-lg">
                <AccordionTrigger className="px-3 py-2 hover:no-underline">
                  <div className="flex items-center gap-2">
                    <Edit3 className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-700">
                      Firmas en Documento
                    </span>
                    <Badge variant="secondary" className="bg-blue-100 text-blue-800 text-xs">
                      {annotations.filter(a => a.type === "signature").length}
                    </Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-3 pb-3">
                  <div className="relative">
                    {/* Scroll indicator for many signatures */}
                    {annotations.filter(a => a.type === "signature").length > 4 && (
                      <div className="absolute top-0 right-0 z-10 bg-gradient-to-b from-white via-white to-transparent h-6 w-4 pointer-events-none"></div>
                    )}
                    
                    <div 
                      className={`space-y-3 ${
                        annotations.filter(a => a.type === "signature").length > 4 
                          ? 'max-h-[400px] overflow-y-auto pr-2' 
                          : ''
                      }`}
                      style={{
                        scrollbarWidth: 'thin',
                        scrollbarColor: '#d1d5db #f3f4f6'
                      }}
                    >
                      {annotations
                        .filter(a => a.type === "signature")
                        .map((signature, index) => (
                          <div 
                            key={signature.id} 
                            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-blue-50 transition-colors cursor-pointer border border-gray-200"
                            onClick={() => onGoToPage?.(signature.page)}
                          >
                            <div className="flex items-center gap-3">
                              {/* Signature thumbnail */}
                              <div className="w-12 h-8 bg-white border border-gray-300 rounded flex items-center justify-center overflow-hidden">
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
                                <span className="text-sm font-medium text-gray-900">
                                  Firma {index + 1}
                                </span>
                                <span className="text-xs text-gray-500">
                                  Página {signature.page}
                                </span>
                              </div>
                            </div>
                            
                            {/* Go to page button */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                onGoToPage?.(signature.page)
                              }}
                              className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                              title={`Ir a página ${signature.page}`}
                            >
                              Ir a Página
                            </button>
                          </div>
                        ))}
                    </div>
                    
                    {/* Bottom scroll indicator */}
                    {annotations.filter(a => a.type === "signature").length > 4 && (
                      <div className="absolute bottom-0 right-0 z-10 bg-gradient-to-t from-white via-white to-transparent h-6 w-4 pointer-events-none"></div>
                    )}
                    
                    {/* Scroll hint */}
                    {annotations.filter(a => a.type === "signature").length > 4 && (
                      <div className="text-center mt-2 pt-2 border-t border-gray-100">
                        <p className="text-xs text-gray-400">
                          Scroll para ver más firmas ({annotations.filter(a => a.type === "signature").length} total)
                        </p>
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        )}
      </div>
    </div>
    </TooltipProvider>
  )
}

export default function FastSignClient() {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [documentUrl, setDocumentUrl] = useState<string>("")
  const [documentId, setDocumentId] = useState<string>("")
  const [isUploading, setIsUploading] = useState(false)
  const [annotations, setAnnotations] = useState<FastSignAnnotation[]>([])
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [isPrinting, setIsPrinting] = useState(false)
  const [showAquariusModal, setShowAquariusModal] = useState(false)
  const [showDocumentManager, setShowDocumentManager] = useState(false)
  const [currentView, setCurrentView] = useState<"options" | "upload">("options")
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState("")
  const [isSaved, setIsSaved] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [documentName, setDocumentName] = useState<string>("")
  const [hasInitialized, setHasInitialized] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [showSaveConfirmModal, setShowSaveConfirmModal] = useState(false)

  const [linkedFileRecord, setLinkedFileRecord] = useState<any>(null)
  const [showFileRecordSelector, setShowFileRecordSelector] = useState(false)
  const [showUnlinkModal, setShowUnlinkModal] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()
  const router = useRouter()

  // Ref para el debounced save
  const debouncedSaveRef = useRef<NodeJS.Timeout | null>(null)

  // Initialize enhanced PDF.js configuration
  useEffect(() => {
    configurePdfJsWithFallback()
  }, [])

  // Interceptar navegación cuando hay documento abierto
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (uploadedFile && annotations.length > 0 && !isSaved) {
        e.preventDefault()
        e.returnValue = ''
      }
    }

    const handleFirmasNavigation = (e: CustomEvent) => {
      // Show confirmation if there's any document loaded (saved or unsaved)
      if (uploadedFile || documentId) {
        e.preventDefault()
        setShowSaveConfirmModal(true)
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    window.addEventListener('firmasNavigation', handleFirmasNavigation as EventListener)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      window.removeEventListener('firmasNavigation', handleFirmasNavigation as EventListener)
    }
  }, [uploadedFile, documentId, annotations, isSaved])

  // Initialize view directly to upload
  useEffect(() => {
    // Ir directamente a upload, saltando la página de opciones
    setCurrentView("upload")
    
    if (!hasInitialized) {
      setHasInitialized(true)
    }
  }, [hasInitialized])

  const handleFileSelect = async (file: File) => {
    if (file.type !== "application/pdf") {
      setUploadError("Por favor selecciona un archivo PDF")
      return
    }

    if (file.size > 50 * 1024 * 1024) {
      setUploadError("El tamaño del archivo debe ser menor a 50MB")
      return
    }

    setUploadedFile(file)
    setUploadError(null)
    setIsSaved(false)
    setDocumentName("") // Clear document name for new uploads

    // Create a blob URL for immediate viewing
    const blobUrl = URL.createObjectURL(file)
    setDocumentUrl(blobUrl)
    setDocumentId(`temp-${Date.now()}`) // Temporary ID

    // Immediately save document to prevent data loss
    await saveDocumentImmediately(file)
  }

  const saveDocumentImmediately = async (file: File) => {
    setIsSaving(true)

    try {
      // Show uploading toast
      toast({
        title: "Guardando documento...",
        description: "Guardando automáticamente para evitar pérdida de datos.",
      })

      console.log("Uploading document to bucket immediately...")

      // Upload to bucket
      const formData = new FormData()
      formData.append("file", file)

      const uploadResponse = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      })

      if (!uploadResponse.ok) {
        throw new Error("Failed to upload document to bucket")
      }

      const result = await uploadResponse.json()
      console.log("Upload result:", result)

      // Save to database
      const dbResult = await createFastSignDocument(
        file.name,
        result.path,
        result.url,
        file.size,
        file.type,
      )

      if (dbResult.error) {
        throw new Error(`Failed to save to database: ${dbResult.error}`)
      }

      // Update state with permanent URLs and IDs
      setDocumentId(dbResult.document.id)
      setDocumentUrl(result.url)
      setIsSaved(true)
      setDocumentName(file.name)

      // Clean up the blob URL
      if (documentUrl && documentUrl.startsWith("blob:")) {
        URL.revokeObjectURL(documentUrl)
      }

      console.log("Document saved immediately with ID:", dbResult.document.id)

      toast({
        title: "✅ Documento guardado",
        description: "El documento se ha guardado automáticamente. Ahora puedes agregar firmas con seguridad.",
      })

    } catch (error) {
      console.error("Immediate save error:", error)
      toast({
        title: "❌ Error al guardar",
        description: "No se pudo guardar el documento automáticamente. Las firmas se guardarán cuando uses 'Actualizar Firmas'.",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0])
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0])
    }
  }

  const unifiedSave = async (currentAnnotations?: FastSignAnnotation[]) => {
    // Cancel any pending debounced save
    if (debouncedSaveRef.current) {
      clearTimeout(debouncedSaveRef.current)
      debouncedSaveRef.current = null
      console.log("⏰ Cancelled pending debounced save for manual save")
    }

    // Use provided annotations or fall back to state
    const annotationsToSave = currentAnnotations || annotations
    
    if (!uploadedFile) {
      toast({
        title: "No hay documento para guardar",
        description: "Por favor sube un documento primero.",
        variant: "destructive",
      })
      return
    }

    setIsSaving(true)

    try {
      let currentDocumentId = documentId
      let currentDocumentUrl = documentUrl

      // Step 1: Save document to bucket and database if not already saved
      if (!isSaved) {
        // Show uploading toast
        toast({
          title: "Subiendo documento...",
          description: "Por favor espera mientras subimos tu documento al servidor.",
        })

        console.log("Uploading document to bucket...")

        // Upload to bucket
        const formData = new FormData()
        formData.append("file", uploadedFile)

        const uploadResponse = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        })

        if (!uploadResponse.ok) {
          throw new Error("Failed to upload document to bucket")
        }

        const result = await uploadResponse.json()
        console.log("Upload result:", result)

        // Show saving to database toast
        toast({
          title: "Saving document...",
          description: "Document uploaded successfully. Now saving to database...",
        })

        // Save to database - use the correct property name 'path'
        const dbResult = await createFastSignDocument(
          uploadedFile.name,
          result.path,
          result.url,
          uploadedFile.size,
          uploadedFile.type,
        )

        if (dbResult.error) {
          throw new Error(`Failed to save to database: ${dbResult.error}`)
        }

        // Update internal variables but DON'T update React state yet
        // This prevents PDF from reloading while we save annotations
        currentDocumentUrl = result.url
        currentDocumentId = dbResult.document.id

        console.log("Document saved to bucket and database successfully")
        console.log("New document ID:", currentDocumentId)
        
        // Update the document name for display
        setDocumentName(uploadedFile.name)
      } else {
        // Document already saved, just show updating toast if there are annotations
        if (annotationsToSave.length > 0) {
          toast({
            title: "Actualizando firmas...",
            description: "Guardando las firmas y anotaciones actualizadas.",
          })
        }
      }

      // Step 2: Save annotations and signatures if any exist
      if (annotationsToSave.length > 0) {
        console.log("Current annotations:", annotationsToSave)

        // Separate signatures from text annotations
        const signatures = annotationsToSave.filter((ann) => ann.type === "signature")
        const textAnnotations = annotationsToSave.filter((ann) => ann.type !== "signature")

        console.log("=== FAST SIGN SAVE DEBUG ===")
        console.log("Total annotations:", annotationsToSave.length)
        console.log("Text annotations to save:", textAnnotations.length, textAnnotations)
        console.log("Current document ID:", currentDocumentId)

        // Use helper function to save annotations
        await saveAnnotationsToDatabase(annotationsToSave, currentDocumentId)
      }

      // Update React state only if document was not previously saved
      if (!isSaved) {
        setDocumentId(currentDocumentId)
        setDocumentUrl(currentDocumentUrl)
        setIsSaved(true)

        // Clean up the blob URL now that everything is saved
        if (documentUrl.startsWith("blob:")) {
          URL.revokeObjectURL(documentUrl)
        }
      }

      // Final success toast
      setLastUpdated(new Date())
      if (isSaved && annotationsToSave.length > 0) {
        // Document was already saved, just updated annotations
        toast({
          title: "✅ Firmas actualizadas",
          description: `Se han guardado ${annotationsToSave.filter((a) => a.type === "signature").length} firma(s) y ${annotationsToSave.filter((a) => a.type === "text").length} anotación(es).`,
        })
      } else {
        // Either new document or no annotations
        toast({
          title: "✅ Documento guardado exitosamente",
          description:
            annotationsToSave.length > 0
              ? `Tu documento con ${annotationsToSave.filter((a) => a.type === "signature").length} firma(s) y ${annotationsToSave.filter((a) => a.type === "text").length} anotación(es) ha sido guardado.`
              : "Tu documento ha sido guardado y puede ser gestionado desde la lista de documentos.",
        })
      }

    } catch (error) {
      console.error("Save error:", error)
      toast({
        title: "❌ Error al guardar",
        description: error instanceof Error ? error.message : "No se pudo guardar el documento. Intenta de nuevo.",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteDocument = async () => {
    if (deleteConfirmText.toLowerCase() === "eliminar") {
      // Cancel any pending debounced save
      if (debouncedSaveRef.current) {
        clearTimeout(debouncedSaveRef.current)
        debouncedSaveRef.current = null
        console.log("⏰ Cancelled pending debounced save for document deletion")
      }

      try {
        // If document is saved to database, delete it from there
        if (isSaved && documentId) {
          const { deleteFastSignDocument } = await import("@/app/actions/fast-sign-actions")
          const result = await deleteFastSignDocument(documentId)
          
          if (result.error) {
            toast({
              title: "Error al eliminar",
              description: result.error,
              variant: "destructive",
            })
            return
          }
          
          toast({
            title: "Documento eliminado",
            description: "El documento ha sido eliminado permanentemente.",
          })
        } else {
          // Document is only in browser cache, just clear it
          toast({
            title: "Documento eliminado",
            description: "Comenzando con un nuevo documento.",
          })
        }

        // Clean up blob URL if it exists
        if (documentUrl.startsWith("blob:")) {
          URL.revokeObjectURL(documentUrl)
        }

        // Reset all state
        setUploadedFile(null)
        setDocumentUrl("")
        setDocumentId("")
        setAnnotations([])
        setUploadError(null)
        setShowDeleteModal(false)
        setDeleteConfirmText("")
        setIsSaved(false)
        setIsSaving(false)
        setLinkedFileRecord(null)
        if (fileInputRef.current) {
          fileInputRef.current.value = ""
        }
      } catch (error) {
        console.error("Error deleting document:", error)
        toast({
          title: "Error",
          description: "Ocurrió un error al eliminar el documento.",
          variant: "destructive",
        })
      }
    }
  }

  const handleDeleteClick = () => {
    setShowDeleteModal(true)
    setDeleteConfirmText("")
  }

  // Debounced auto-save for fast-sign
  const pendingAnnotationsRef = useRef<FastSignAnnotation[]>([])

  const handleSaveAnnotations = async (newAnnotations: FastSignAnnotation[]) => {
    console.log("=== HANDLE SAVE ANNOTATIONS ===")
    console.log("Received annotations:", newAnnotations.length)
    console.log("Signature annotations:", newAnnotations.filter((a) => a.type === "signature").length)
    console.log("Text annotations:", newAnnotations.filter((a) => a.type === "text").length)
    console.log("Document saved status:", isSaved)

    // Update local state immediately for smooth UI
    setAnnotations(newAnnotations)
    
    // Store the latest annotations for debounced save
    pendingAnnotationsRef.current = newAnnotations

    // If document is saved, auto-save annotations
    if (documentId && isSaved) {
      console.log("🔄 Setting up debounced auto-save...")
      
      // Clear any existing timeout
      if (debouncedSaveRef.current) {
        clearTimeout(debouncedSaveRef.current)
        console.log("⏰ Cleared previous debounced save")
      }

      // Set new timeout for debounced save (1 second delay)
      debouncedSaveRef.current = setTimeout(async () => {
        console.log("💾 Executing debounced auto-save...")
        try {
          setIsSaving(true)
          await saveAnnotationsToDatabase(pendingAnnotationsRef.current)
          setLastUpdated(new Date())
          console.log("✅ Debounced auto-save completed")
        } catch (error) {
          console.error("❌ Debounced auto-save failed:", error)
          toast({
            title: "Auto-save failed",
            description: "Your changes are saved locally. Use the Save button to retry.",
            variant: "destructive",
          })
        } finally {
          setIsSaving(false)
          debouncedSaveRef.current = null
        }
      }, 1000) // 1 second debounce delay
      
      console.log("⏰ Debounced auto-save scheduled in 1 second")
    } else if (uploadedFile && !isSaved) {
      // Document not saved yet, trigger unified save to save document + annotations
      console.log("📝 Document not saved yet, will save everything when Save button is clicked")
    } else {
      console.log("📝 Annotations updated in local state only (document not saved yet)")
    }
  }

  // Cleanup debounced save on unmount
  useEffect(() => {
    return () => {
      if (debouncedSaveRef.current) {
        clearTimeout(debouncedSaveRef.current)
      }
    }
  }, [])

  const handlePrint = async () => {
    if (!isSaved) {
      toast({
        title: "Document not saved",
        description: "Please save the document first before printing.",
        variant: "destructive",
      })
      return
    }

    if (!documentUrl || annotations.filter((a) => a.type === "signature").length === 0) {
      toast({
        title: "No signatures to print",
        description: "Please add at least one signature before printing.",
        variant: "destructive",
      })
      return
    }

    setIsPrinting(true)

    console.log("🖨️ Print button clicked for fast-sign document!")

    try {
      // Cancel any pending debounced save and force immediate save
      if (debouncedSaveRef.current) {
        clearTimeout(debouncedSaveRef.current)
        debouncedSaveRef.current = null
        console.log("⏰ Cancelled pending debounced save for immediate print save")
      }

      // IMPORTANT: Save current annotations to database before printing
      console.log("💾 Saving current annotations before printing...")
      await saveAnnotationsToDatabase(annotations)
      
      // Wait a moment to ensure the database transaction is fully committed
      console.log("⏳ Waiting for database commit...")
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Use the fast-sign print endpoint
      const printUrl = `/api/fast-sign/${documentId}/print`

      // Fetch the merged PDF first to ensure it's processed
      const response = await fetch(printUrl)

      if (!response.ok) {
        console.error("❌ Failed to generate merged PDF:", response.status, response.statusText)
        throw new Error(`Failed to generate PDF: ${response.statusText}`)
      }

      console.log("✅ Merged PDF generated successfully")

      // Step 2: Create a blob URL for the merged PDF
      const pdfBlob = await response.blob()
      const blobUrl = URL.createObjectURL(pdfBlob)

      console.log("📄 Created blob URL for merged PDF")

      // Step 3: Create a temporary download link and click it to open in new tab
      const downloadLink = window.document.createElement("a")
      downloadLink.href = blobUrl
      downloadLink.target = "_blank"
      downloadLink.download = `SIGNED_${uploadedFile?.name || documentName || "document.pdf"}`

      // Add to DOM temporarily
      window.document.body.appendChild(downloadLink)

      // Click the link to open in new tab
      downloadLink.click()

      // Remove from DOM
      window.document.body.removeChild(downloadLink)

      console.log("🌐 Opened merged PDF in new tab using download link")

      // Clean up blob URL after a delay
      setTimeout(() => {
        URL.revokeObjectURL(blobUrl)
        console.log("🧹 Cleaned up blob URL")
      }, 10000) // Longer delay to ensure PDF is fully loaded

      toast({
        title: "Document ready",
        description: "The signed document has been opened in a new tab for printing.",
      })
    } catch (error) {
      console.error("❌ Error processing signed document for printing:", error)
      toast({
        title: "Print failed",
        description: "Failed to prepare document for printing.",
        variant: "destructive",
      })
    } finally {
      setIsPrinting(false)
    }
  }

  // Helper function to save annotations to database
  const saveAnnotationsToDatabase = async (annotationsToSave: FastSignAnnotation[], targetDocumentId?: string) => {
    const docId = targetDocumentId || documentId
    
    // Allow saving if we have a valid document ID (either from parameter or state)
    // and either the document is saved OR we have a target document ID (during initial save)
    if (!docId || (!isSaved && !targetDocumentId)) {
      console.log("⚠️ Cannot save annotations - no valid document ID")
      return
    }

    try {
      console.log("🔄 Saving annotations to database...")
      console.log("📄 Document ID:", docId)
      console.log("📊 Total annotations to save:", annotationsToSave.length)
      
      // Separate signatures from text annotations
      const signatures = annotationsToSave.filter((a) => a.type === "signature")
      const textAnnotations = annotationsToSave.filter((a) => a.type !== "signature")
      
      console.log("✍️ Signatures to save:", signatures.length)
      console.log("📝 Text annotations to save:", textAnnotations.length)

      // First, clear all existing signatures
      const deleteResponse = await fetch(`/api/documents/${docId}/signature`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token: Buffer.from("fast-sign@local").toString("base64"),
          clearAll: true,
        }),
      })
      
      if (!deleteResponse.ok) {
        console.warn("⚠️ Failed to clear existing signatures, continuing anyway")
      } else {
        console.log("✅ Cleared existing signatures")
      }

      // Save text annotations if any
      if (textAnnotations.length > 0) {
        const annotationResponse = await fetch(`/api/annotations/${docId}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            annotations: textAnnotations,
            token: Buffer.from("fast-sign@local").toString("base64"),
          }),
        })

        if (!annotationResponse.ok) {
          throw new Error("Failed to save text annotations")
        }
        console.log("✅ Saved text annotations")
      }

      // Save all signatures as new
      if (signatures.length > 0) {
        console.log(`💾 Processing ${signatures.length} signatures...`)
        
        for (const signature of signatures) {
          console.log(`➕ Creating signature ${signature.id}`)
          const signatureResponse = await fetch(`/api/documents/${docId}/signature`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              signatureDataUrl: signature.imageData,
              signatureSource: signature.signatureSource || "canvas",
              token: Buffer.from("fast-sign@local").toString("base64"),
              position: {
                x: signature.x,
                y: signature.y,
                width: signature.width,
                height: signature.height,
                page: signature.page,
                relativeX: signature.relativeX,
                relativeY: signature.relativeY,
                relativeWidth: signature.relativeWidth,
                relativeHeight: signature.relativeHeight
              }
            }),
          })

          if (!signatureResponse.ok) {
            const errorText = await signatureResponse.text()
            console.error("❌ Failed to create signature:", signature.id, errorText)
            throw new Error(`Failed to save signature: ${errorText}`)
          }

          console.log(`✅ Signature ${signature.id} saved successfully`)
        }
        
        // Verify signatures were saved by checking the database
        console.log("🔍 Verifying signatures were saved...")
        const verifyResponse = await fetch(`/api/documents/${docId}/signatures/check`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            token: Buffer.from("fast-sign@local").toString("base64"),
            includeData: false,
          }),
        })
        
        if (verifyResponse.ok) {
          const verifyData = await verifyResponse.json()
          console.log(`✅ Verification: ${verifyData.signatureCount || 0} signatures found in database`)
        } else {
          console.warn("⚠️ Could not verify signature save")
        }
      }

      console.log("✅ All annotations saved to database")
      
    } catch (error) {
      console.error("❌ Error saving annotations to database:", error)
      throw error
    }
  }

  const handleSendToAquarius = () => {
    if (!isSaved) {
      toast({
        title: "Document not saved",
        description: "Please save the document first before sending to Aquarius.",
        variant: "destructive",
      })
      return
    }

    if (annotations.filter((a) => a.type === "signature").length === 0) {
      toast({
        title: "No signatures to send",
        description: "Please add at least one signature before sending to Aquarius.",
        variant: "destructive",
      })
      return
    }
    setShowAquariusModal(true)
  }

  // Custom Aquarius upload for Fast Sign documents
  const handleAquariusUpload = async (integrationId: string, token: string, doctype: string) => {
    try {
      // Get the signed PDF from the fast-sign print endpoint
      const printResponse = await fetch(`/api/fast-sign/${documentId}/print`)
      if (!printResponse.ok) {
        throw new Error("Failed to generate signed PDF")
      }

      const pdfBlob = await printResponse.blob()

      // Here you would call the Aquarius API to upload the document
      // For now, we'll just show a success message
      return {
        success: true,
        message: `Document "${uploadedFile?.name}" uploaded successfully to Aquarius!`,
        documentId: `FST-${Date.now()}`,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to upload document",
      }
    }
  }

  const handleStartSigning = () => {
    console.log("Start Signing clicked, changing view to upload")
    setCurrentView("upload")
  }

  // Force save function for sidebar
  const handleForceSave = async () => {
    if (!isSaved || !documentId) {
      // If document isn't saved yet, use unifiedSave
      await unifiedSave(annotations)
    } else {
      // Cancel any pending debounced save and force immediate save
      if (debouncedSaveRef.current) {
        clearTimeout(debouncedSaveRef.current)
        debouncedSaveRef.current = null
        console.log("⏰ Cancelled pending debounced save for force save")
      }

      try {
        setIsSaving(true)
        await saveAnnotationsToDatabase(annotations)
        setLastUpdated(new Date())
        toast({
          title: "Guardado exitoso",
          description: "Todas las anotaciones han sido guardadas.",
        })
      } catch (error) {
        console.error("❌ Force save failed:", error)
        toast({
          title: "Error al guardar",
          description: "No se pudieron guardar las anotaciones. Intenta de nuevo.",
          variant: "destructive",
        })
      } finally {
        setIsSaving(false)
      }
    }
  }

  const handleLinkToFileRecord = () => {
    setShowFileRecordSelector(true)
  }

  const handleCloseFileRecordSelector = () => {
    setShowFileRecordSelector(false)
  }

  const handleFileRecordSuccess = async (recordId: string) => {
    console.log("Document linked to file record:", recordId)
    
    // Load the linked file record data
    try {
      const { getFileRecordById } = await import("@/app/actions/filing-system-actions")
      const fileRecordResult = await getFileRecordById(recordId)
      if (fileRecordResult.record) {
        setLinkedFileRecord(fileRecordResult.record)
      }
    } catch (error) {
      console.warn("Failed to load linked file record after linking:", error)
    }
    
    toast({
      title: "Éxito",
      description: "Documento vinculado exitosamente al expediente",
    })
    setShowFileRecordSelector(false)
  }

  const handleUnlinkClick = () => {
    setShowUnlinkModal(true)
  }

  const handleGoToPage = (page: number) => {
    // Dispatch custom event to notify PDF editor to go to specific page
    const event = new CustomEvent('goToPage', { detail: { page } })
    window.dispatchEvent(event)
  }

  const handleUnlinkFileRecord = async () => {
    try {
      const { unlinkDocumentFromFileRecord } = await import("@/app/actions/filing-system-actions")
      const result = await unlinkDocumentFromFileRecord(documentId)
      
      if (result.error) {
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive",
        })
      } else {
        setLinkedFileRecord(null)
        toast({
          title: "Éxito",
          description: "Documento desvinculado del expediente",
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al desvincular documento del expediente",
        variant: "destructive",
      })
    } finally {
      setShowUnlinkModal(false)
    }
  }

  // Manejar confirmación de guardado antes de navegar
  const handleSaveAndNavigate = async () => {
    try {
      // Guardar cambios actuales si hay anotaciones
      if (annotations.length > 0) {
        await handleForceSave()
      }
      
      // Limpiar estado completamente
      setUploadedFile(null)
      setDocumentUrl("")
      setDocumentId("")
      setAnnotations([])
      setIsSaved(false)
      setIsSaving(false)
      setDocumentName("")
      setLastUpdated(null)
      setLinkedFileRecord(null)
      setShowSaveConfirmModal(false)
      
      // Forzar vista de upload
      setCurrentView("upload")
      
      // Navegar a nueva página de fast-sign
      router.push("/fast-sign")
      router.refresh()
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo guardar el documento",
        variant: "destructive",
      })
    }
  }

  const handleDiscardAndNavigate = () => {
    // Limpiar estado completamente sin guardar
    setUploadedFile(null)
    setDocumentUrl("")
    setDocumentId("")
    setAnnotations([])
    setIsSaved(false)
    setIsSaving(false)
    setDocumentName("")
    setLastUpdated(null)
    setLinkedFileRecord(null)
    setShowSaveConfirmModal(false)
    
    // Forzar vista de upload
    setCurrentView("upload")
    
    // Navegar a nueva página de fast-sign
    router.push("/fast-sign")
    router.refresh()
  }



  // Eliminamos la vista de opciones, vamos directo a upload

  // If no document is uploaded, show upload interface
  if (!uploadedFile || !documentUrl) {
    return (
      <div className="flex h-full" style={{ backgroundColor: "#F8F9FB" }}>
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="max-w-2xl w-full">


            {/* Mensaje claro en azul */}
            <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 mb-6 text-center">
              <p className="text-lg font-semibold text-blue-700">
                👆 Escoja Documento en su Ordenador para Comenzar a Firmar
              </p>
              <p className="text-blue-600 mt-1">
                Haga clic en el área de abajo o arrastre su archivo PDF aquí
              </p>
            </div>

            {uploadError && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">{uploadError}</p>
              </div>
            )}

            <div
              className="border-2 border-dashed border-blue-300 rounded-lg p-12 text-center cursor-pointer hover:border-blue-400 hover:bg-gray-50 transition-colors animate-pulse"
              style={{
                animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                boxShadow: '0 0 0 1px rgba(59, 130, 246, 0.3)'
              }}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={handleFileChange}
                disabled={isUploading}
              />

              {isUploading ? (
                <div className="flex flex-col items-center">
                  <svg className="animate-spin h-12 w-12 text-blue-500 mb-4" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  <p className="text-lg font-medium text-gray-900 mb-2">Subiendo documento...</p>
                  <p className="text-sm text-gray-500">Por favor espera mientras procesamos tu archivo</p>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <Upload className="h-16 w-16 text-gray-400 mb-4" />
                  <p className="text-xl font-medium text-gray-900 mb-2">Arrastra tu PDF aquí o haz clic para navegar</p>
                  <p className="text-sm text-gray-500 mb-4">Admite archivos PDF de hasta 50MB</p>
                  <div className="flex items-center space-x-2 text-xs text-gray-400">
                    <FileText className="h-4 w-4" />
                    <span>Solo documentos PDF</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <DocumentSidebar
          document={null}
          annotations={annotations}
          linkedFileRecord={linkedFileRecord}
          onPrint={handlePrint}
          onSendToAquarius={handleSendToAquarius}
          onDelete={handleDeleteClick}
          onSave={handleForceSave}
          onLinkToFileRecord={handleLinkToFileRecord}
          onUnlinkFileRecord={handleUnlinkClick}
          onGoToPage={handleGoToPage}
          isPrinting={isPrinting}
          isSaved={isSaved}
          isSaving={isSaving}
          lastUpdated={lastUpdated}
        />
      </div>
    )
  }

  // Show document editor with signature capabilities
  return (
    <div className="flex h-full">
      {/* PDF Editor */}
      <div className="flex-1" style={{ backgroundColor: "#F8F9FB" }}>
        <div className="h-full">
          <PdfErrorBoundary>
            <PdfAnnotationEditor
              documentUrl={documentUrl}
              documentName={uploadedFile?.name || documentName || "Document"}
              documentId={documentId}
              onBack={() => {}} // Not needed for fast sign
              onSave={handleSaveAnnotations}
              initialAnnotations={annotations}
              token={undefined} // No token for Fast Sign - enables local-only mode
              readOnly={false}
              hideSaveButton={true} // Hide the save button - use unified save in sidebar
            />
          </PdfErrorBoundary>
        </div>
      </div>

      {/* Right Sidebar */}
      <DocumentSidebar
        document={{
          id: documentId,
          file_name: uploadedFile?.name || documentName || "Document",
          file_path: documentId,
        }}
        annotations={annotations}
        linkedFileRecord={linkedFileRecord}
        onPrint={handlePrint}
        onSendToAquarius={handleSendToAquarius}
        onDelete={handleDeleteClick}
        onSave={handleForceSave}
        onLinkToFileRecord={handleLinkToFileRecord}
        onUnlinkFileRecord={handleUnlinkClick}
        onGoToPage={handleGoToPage}
        isPrinting={isPrinting}
        isSaved={isSaved}
        isSaving={isSaving}
        lastUpdated={lastUpdated}
      />

      {/* Send to Aquarius Modal */}
      {showAquariusModal && (
        <FastSignAquariusModal
          isOpen={showAquariusModal}
          onClose={() => setShowAquariusModal(false)}
          documentId={documentId}
          documentName={uploadedFile?.name || documentName || "Document"}
          onSuccess={() => {
            toast({
              title: "Documento enviado a Aquarius",
              description: "Tu documento firmado ha sido subido exitosamente.",
            })
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Eliminar Documento</DialogTitle>
            <DialogDescription>
              Esta acción no se puede deshacer. Esto eliminará permanentemente tu documento y todas las firmas.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="delete-confirm" className="text-right">
                Escribe "eliminar"
              </Label>
              <Input
                id="delete-confirm"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                className="col-span-3"
                placeholder="eliminar"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteModal(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteDocument}
              disabled={deleteConfirmText.toLowerCase() !== "eliminar"}
            >
              Eliminar Documento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* File Record Selector Modal */}
      {showFileRecordSelector && (
        <FileRecordSelector
          isOpen={showFileRecordSelector}
          onClose={handleCloseFileRecordSelector}
          onSuccess={handleFileRecordSuccess}
          documentId={documentId}
        />
      )}

      {/* Unlink Confirmation Modal */}
      <Dialog open={showUnlinkModal} onOpenChange={setShowUnlinkModal}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Desvincular del Expediente</DialogTitle>
            <DialogDescription>
              ¿Estás seguro que deseas desvincular este documento del expediente? Esta acción se puede revertir.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUnlinkModal(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleUnlinkFileRecord}>
              Desvincular
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Save Confirmation Modal for Navigation */}
      <Dialog open={showSaveConfirmModal} onOpenChange={setShowSaveConfirmModal}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>¿Comenzar nuevo proceso de firma?</DialogTitle>
            <DialogDescription>
              {annotations.length > 0 
                ? `Tienes un documento abierto con ${annotations.length} anotación${annotations.length !== 1 ? 'es' : ''}. ¿Qué deseas hacer antes de comenzar un nuevo proceso de firma?`
                : 'Tienes un documento abierto. ¿Deseas comenzar un nuevo proceso de firma?'
              }
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setShowSaveConfirmModal(false)}>
              Cancelar
            </Button>
            {annotations.length > 0 ? (
              <>
                <Button
                  variant="destructive"
                  onClick={handleDiscardAndNavigate}
                >
                  Descartar Cambios
                </Button>
                <Button
                  onClick={handleSaveAndNavigate}
                  style={{ backgroundColor: "#0d2340" }}
                >
                  Guardar y Continuar
                </Button>
              </>
            ) : (
              <Button
                onClick={handleDiscardAndNavigate}
                style={{ backgroundColor: "#0d2340" }}
              >
                Comenzar Nuevo Proceso
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
