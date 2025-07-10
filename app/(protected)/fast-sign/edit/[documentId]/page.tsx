"use client"

import { useState, useEffect, use, useRef } from "react"
import { useRouter } from "next/navigation"
import { FileText, Upload, Trash2, ArrowLeft, X, FolderOpen, ChevronDown, Info, Edit3, Unlink } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import PdfAnnotationEditor from "@/components/pdf-annotation-editor"
import { PdfErrorBoundary } from "@/components/pdf-error-boundary"
import FastSignAquariusModal from "@/components/fast-sign-aquarius-modal"
import FileRecordSelector from "@/components/file-record-selector"
import { useToast } from "@/hooks/use-toast"

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
  const signatureCount = annotations.filter((a) => a.type === "signature").length

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onClose} />

          {/* Sidebar */}
          <div
            className="relative w-80 max-w-sm border-l border-border flex flex-col shadow-lg ml-auto"
            style={{ backgroundColor: "#FFFFFF" }}
          >
            {/* Mobile close button */}
            <div className="lg:hidden absolute top-4 left-4 z-10">
              <button
                onClick={onClose}
                className="p-2 rounded-md bg-white shadow-md border border-gray-200 hover:bg-gray-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Sidebar content */}
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
              signatureCount={signatureCount}
            />
          </div>
        </div>
      )}

      {/* Desktop Sidebar */}
      <div
        className="hidden lg:flex w-80 border-l border-border flex-col shadow-lg"
        style={{ backgroundColor: "#FFFFFF" }}
      >
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
    </>
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
  return (
    <TooltipProvider>
      {/* Sidebar header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-gray-700">Acciones del Documento</span>
          <span className="text-xs text-muted-foreground">Editando</span>
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
          <div className="w-full text-center mb-3">
            <span className="text-xs text-muted-foreground">Última actualización: {lastUpdated.toLocaleString()}</span>
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
                : "text-blue-700 bg-white hover:bg-blue-50 animate-pulse-blue"
            }`}
            title={linkedFileRecord ? "Cambiar vinculación de expediente" : "Vincular documento a un expediente"}
          >
            <FolderOpen className="h-4 w-4 mr-2" />
{linkedFileRecord ? "Cambiar Expediente" : "Añadir a Expediente"}
          </button>

          {/* Update Document Button */}
          <button
            onClick={onSave}
            disabled={isSaving}
            className="w-full inline-flex items-center justify-center px-4 py-3 shadow-sm text-sm font-medium rounded-lg text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundColor: "#0d2340",
            }}
            title="Actualizar documento con anotaciones y firmas actuales"
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
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Actualizando...
              </>
            ) : (
              <>
                <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                Actualizar Documento
              </>
            )}
          </button>

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
            title="Eliminar documento y todas las firmas"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Eliminar Documento
          </button>
        </div>
      </div>

      {/* Case File Section */}
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
            <div className="space-y-2">
                    {linkedFileRecord.filing_systems?.esquema_json?.indices?.map((field: any) => {
                      const value = linkedFileRecord.valores_json?.[field.clave]
                      if (value === undefined || value === null || value === '') return null
                      
                      return (
                        <div key={field.clave} className="flex flex-col gap-1">
                          <span className="text-xs font-medium text-gray-600">
                            {field.etiqueta}:
                          </span>
                          <span className="text-sm text-gray-900 bg-gray-50 px-2 py-1 rounded">
                            {field.tipo_dato === 'bool' 
                              ? (value ? 'Sí' : 'No')
                              : field.tipo_dato === 'fecha' 
                                ? new Date(value).toLocaleDateString()
                                : String(value)
                            }
                    </span>
                  </div>
                      )
                    })}
                    <div className="flex flex-col gap-1 pt-2 border-t border-gray-200">
                      <span className="text-xs font-medium text-gray-600">Creado:</span>
                      <span className="text-sm text-gray-900">
                        {new Date(linkedFileRecord.created_at).toLocaleString()}
                      </span>
                    </div>
                    
                    {/* Link to Case File */}
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
    </TooltipProvider>
  )
}

export default function FastSignEditPage({ params }: { params: Promise<{ documentId: string }> }) {
  const resolvedParams = use(params)
  const documentId = resolvedParams.documentId
  const router = useRouter()
  const { toast } = useToast()

  const [documentUrl, setDocumentUrl] = useState<string>("")
  const [documentName, setDocumentName] = useState<string>("")
  const [annotations, setAnnotations] = useState<FastSignAnnotation[]>([])
  const [isPrinting, setIsPrinting] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [showAquariusModal, setShowAquariusModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showFileRecordSelector, setShowFileRecordSelector] = useState(false)
  const [showUnlinkModal, setShowUnlinkModal] = useState(false)
  const [linkedFileRecord, setLinkedFileRecord] = useState<any>(null)
  const [deleteConfirmText, setDeleteConfirmText] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [isManualUpdate, setIsManualUpdate] = useState(false)

  // Load document and annotations on mount
  useEffect(() => {
    if (!documentId) return
    const loadDocument = async () => {
      try {
        setIsLoading(true)
        console.log("Loading document for editing:", documentId)

        // Get document from database
        const response = await fetch(`/api/documents/${documentId}`)
        if (!response.ok) {
          throw new Error("Failed to fetch document")
        }

        const documentData = await response.json()
        console.log("Document data:", documentData)

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
              console.log("Loaded linked file record:", fileRecordResult.record)
            }
          } catch (error) {
            console.warn("Failed to load linked file record:", error)
          }
        }

        // Load annotations (text annotations)
        try {
          const annotationsResponse = await fetch(`/api/annotations/${documentId}`)
          if (annotationsResponse.ok) {
            const annotationsData = await annotationsResponse.json()
            console.log("Loaded annotations:", annotationsData.annotations)
          }
        } catch (error) {
          console.warn("Failed to load annotations:", error)
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

            console.log("=== LOADING SIGNATURES FOR EDIT PAGE ===")
            console.log("Raw signatures data:", signaturesData)
            console.log("Signatures count:", signaturesData.signatures?.length || 0)

            if (signaturesData.signatures && signaturesData.signatures.length > 0) {
              // Convert signatures to annotations format
              const signatureAnnotations: FastSignAnnotation[] = []

              signaturesData.signatures.forEach((sigRecord: any, recordIndex: number) => {
                console.log(`Processing signature record ${recordIndex}:`, sigRecord)
                
                // Process ALL signature records regardless of recipient_email
                // This allows editing documents that originated in sent-to-sign
                console.log(`  Processing record ${recordIndex} - recipient: ${sigRecord.recipient_email}`)
                

                if (sigRecord.signature_data?.signatures) {
                  // New format: signatures array
                  console.log(
                    `  Found ${sigRecord.signature_data.signatures.length} signatures in record ${recordIndex}`,
                  )
                  sigRecord.signature_data.signatures.forEach((sig: any, sigIndex: number) => {
                    console.log(`    Processing signature ${sigIndex} in record ${recordIndex}:`, sig)
                    
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
                  console.log(`  Found old format signature in record ${recordIndex}`)
                  
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
                } else {
                  console.log(`  Warning: No valid signature data found in record ${recordIndex}`)
                }
              })

              console.log(`Total fast-sign signature annotations created: ${signatureAnnotations.length}`)
              console.log(
                "Fast-sign signature annotations:",
                signatureAnnotations.map((ann) => ({
                  id: ann.id,
                  page: ann.page,
                  position: { x: ann.x, y: ann.y, width: ann.width, height: ann.height },
                })),
              )

              setAnnotations(signatureAnnotations)
            } else {
              console.log("No fast-sign signatures found to load")
            }
          }
        } catch (error) {
          console.warn("Failed to load signatures:", error)
        }
      } catch (error) {
        console.error("Error loading document:", error)
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
    console.log("🔄 Handling annotation changes in edit mode")
    console.log("📊 Previous annotations count:", annotations.length)
    console.log("📊 New annotations count:", newAnnotations.length)
    
    // More detailed logging for debugging
    console.log("📋 Previous annotation IDs:", annotations.map(a => a.id))
    console.log("📋 New annotation IDs:", newAnnotations.map(a => a.id))
    console.log("🔍 New annotations detail:", newAnnotations.map(a => ({ 
      id: a.id, 
      type: a.type, 
      page: a.page,
      hasImageData: !!a.imageData
    })))

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
        oldAnn.page !== newAnn.page
      )
    })
    
    const hasChanged = hasAddedAnnotations || hasRemovedAnnotations || hasChangedPositions
    
    console.log("🔍 Change analysis:")
    console.log("  - Added annotations:", hasAddedAnnotations)
    console.log("  - Removed annotations:", hasRemovedAnnotations)
    console.log("  - Changed positions:", hasChangedPositions)
    console.log("  - Overall has changes:", hasChanged)
    
    if (!hasChanged) {
      console.log("⏭️ No changes detected, skipping update")
      return
    }

    // Update local state immediately to keep UI responsive
    setAnnotations(newAnnotations)
    
    // Store the latest annotations for debounced save
    pendingAnnotationsRef.current = newAnnotations

    // Set up debounced auto-save
    console.log("🔄 Setting up debounced auto-save for edit mode...")
    
    // Clear any existing timeout
    if (debouncedSaveRef.current) {
      clearTimeout(debouncedSaveRef.current)
      console.log("⏰ Cleared previous debounced save")
    }

    // Set new timeout for debounced save (1 second delay)
    debouncedSaveRef.current = setTimeout(async () => {
      console.log("💾 Executing debounced auto-save in edit mode...")
      try {
        setIsSaving(true)
        await autoSaveChanges(pendingAnnotationsRef.current)
        console.log("✅ Debounced auto-save completed")
      } catch (error) {
        console.error("❌ Debounced auto-save failed:", error)
        toast({
          title: "Auto-save failed",
          description: "Your changes are saved locally. Use the Update button to retry.",
          variant: "destructive",
        })
      } finally {
        setIsSaving(false)
        debouncedSaveRef.current = null
      }
    }, 1000) // 1 second debounce delay
    
    console.log("⏰ Debounced auto-save scheduled in 1 second")
  }

  // Cleanup debounced save on unmount
  useEffect(() => {
    return () => {
      if (debouncedSaveRef.current) {
        clearTimeout(debouncedSaveRef.current)
      }
    }
  }, [])

  const autoSaveChanges = async (newAnnotations: FastSignAnnotation[]) => {
    try {
      setIsSaving(true)

      console.log("🔄 Auto-saving changes to database...")

      // Separate signatures from text annotations
      const signatures = newAnnotations.filter((ann) => ann.type === "signature")
      const textAnnotations = newAnnotations.filter((ann) => ann.type !== "signature")
      
      console.log(`💾 Processing ${signatures.length} signatures and ${textAnnotations.length} text annotations`)
      console.log("📝 Signatures to save:", signatures.map(s => ({ id: s.id, page: s.page })))

      // First, clear all existing signatures for this document and recipient
      try {
        console.log("🗑️ Clearing all existing signatures...")
        const clearResponse = await fetch(`/api/documents/${documentId}/signature`, {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            token: Buffer.from("fast-sign-docs@view-all").toString("base64"),
            clearAll: true,
          }),
        })
        
        if (clearResponse.ok) {
          console.log("✅ Cleared existing signatures successfully")
        } else {
          const errorText = await clearResponse.text()
          console.error("❌ Failed to clear existing signatures - Response:", clearResponse.status, errorText)
        }
      } catch (error) {
        console.error("❌ Failed to clear existing signatures:", error)
      }

      console.log("📄 Auto-saving text annotations:", textAnnotations.length)

      // Save text annotations to document_annotations table
      if (textAnnotations.length > 0) {
        const annotationResponse = await fetch(`/api/annotations/${documentId}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            annotations: textAnnotations,
            token: Buffer.from("fast-sign-docs@view-all").toString("base64"),
          }),
        })

        if (!annotationResponse.ok) {
          throw new Error("Failed to auto-save text annotations")
        }
      }

      // Save all signatures as new
      if (signatures.length > 0) {
        console.log(`💾 Processing ${signatures.length} signatures...`)

        // Convert signatures to the format expected by the API
        const signatureData = {
          signatures: signatures.map(signature => ({
            id: signature.id,
            dataUrl: signature.imageData,
            source: signature.signatureSource || "canvas",
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
            timestamp: signature.timestamp || new Date().toISOString(),
          }))
        }

        console.log("📋 Consolidated signature data for update:", signatureData)

        // Create a single signature record with all signatures
        const signatureResponse = await fetch(`/api/documents/${documentId}/signature`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            consolidatedSignatureData: signatureData,
            token: Buffer.from("fast-sign-docs@view-all").toString("base64"),
          }),
        })

        if (!signatureResponse.ok) {
          const errorText = await signatureResponse.text()
          console.error("❌ Failed to save consolidated signatures:", errorText)
          throw new Error(`Failed to save signatures: ${errorText}`)
        }

        console.log(`✅ Saved all ${signatures.length} signatures as single record successfully`)
      }

      console.log("✅ Auto-save completed successfully")
      console.log(`📊 Final state: ${signatures.length} signatures saved to database`)
    } catch (error) {
      console.error("❌ Auto-save error:", error)
      // Don't show error toast for auto-save failures to avoid spamming user
    } finally {
      setIsSaving(false)
    }
  }

  const updateDocument = async () => {
    // Cancel any pending debounced save
    if (debouncedSaveRef.current) {
      clearTimeout(debouncedSaveRef.current)
      debouncedSaveRef.current = null
      console.log("⏰ Cancelled pending debounced save for manual update")
    }

    setIsSaving(true)
    setIsManualUpdate(true) // Prevent auto-save during manual update

    try {
      if (annotations.length > 0) {
        toast({
          title: "Updating document...",
          description: "Saving your annotations and signatures...",
        })

        console.log("🔄 Starting document update...")
        console.log("📝 Current annotations to save:", annotations)

        // Separate signatures from text annotations
        const signatures = annotations.filter((ann) => ann.type === "signature")
        const textAnnotations = annotations.filter((ann) => ann.type !== "signature")

        // First, clear all existing signatures
        try {
          await fetch(`/api/documents/${documentId}/signature`, {
            method: "DELETE",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              token: Buffer.from("fast-sign-docs@view-all").toString("base64"),
              clearAll: true,
            }),
          })
          console.log("✅ Cleared existing signatures")
        } catch (error) {
          console.error("❌ Failed to clear existing signatures:", error)
          throw error
        }

        console.log("📄 Text annotations to save:", textAnnotations.length)

        // Save text annotations to document_annotations table
        if (textAnnotations.length > 0) {
          console.log("💾 Saving text annotations...")
          const annotationResponse = await fetch(`/api/annotations/${documentId}`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              annotations: textAnnotations,
              token: Buffer.from("fast-sign-docs@view-all").toString("base64"),
            }),
          })

          if (!annotationResponse.ok) {
            throw new Error("Failed to save text annotations")
          }
          console.log("✅ Text annotations saved successfully")
        }

        // Save all signatures as new
        if (signatures.length > 0) {
          console.log(`💾 Processing ${signatures.length} signatures...`)

          // Convert signatures to the format expected by the API
          const signatureData = {
            signatures: signatures.map(signature => ({
              id: signature.id,
              dataUrl: signature.imageData,
              source: signature.signatureSource || "canvas",
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
              timestamp: signature.timestamp || new Date().toISOString(),
            }))
          }

          console.log("📋 Consolidated signature data for update:", signatureData)

          // Create a single signature record with all signatures
          const signatureResponse = await fetch(`/api/documents/${documentId}/signature`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              consolidatedSignatureData: signatureData,
              token: Buffer.from("fast-sign-docs@view-all").toString("base64"),
            }),
          })

          if (!signatureResponse.ok) {
            const errorText = await signatureResponse.text()
            console.error("❌ Failed to save consolidated signatures:", errorText)
            throw new Error(`Failed to save signatures: ${errorText}`)
          }

          console.log(`✅ Saved all ${signatures.length} signatures as single record successfully`)
        }
      }

      setLastUpdated(new Date())
      toast({
        title: "✅ Document updated successfully!",
        description:
          annotations.length > 0
            ? `Updated with ${annotations.filter((a) => a.type === "signature").length} signature(s) and ${annotations.filter((a) => a.type === "text").length} text annotation(s).`
            : "Document updated successfully.",
      })
    } catch (error) {
      console.error("❌ Update error:", error)
      toast({
        title: "❌ Update failed",
        description: error instanceof Error ? error.message : "Failed to update document. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
      setIsManualUpdate(false) // Re-enable auto-save
    }
  }

  const handlePrint = async () => {
    if (annotations.filter((a) => a.type === "signature").length === 0) {
      toast({
        title: "No signatures to print",
        description: "Please add at least one signature before printing.",
        variant: "destructive",
      })
      return
    }

    // Cancel any pending debounced save and force immediate save
    if (debouncedSaveRef.current) {
      clearTimeout(debouncedSaveRef.current)
      debouncedSaveRef.current = null
      console.log("⏰ Cancelled pending debounced save for immediate print save")
    }

    // Force save current annotations before printing
    if (pendingAnnotationsRef.current.length > 0) {
      try {
        setIsSaving(true)
        await autoSaveChanges(pendingAnnotationsRef.current)
        console.log("💾 Force saved annotations before printing")
      } catch (error) {
        console.error("❌ Failed to save before printing:", error)
        toast({
          title: "Print failed",
          description: "Could not save annotations before printing.",
          variant: "destructive",
        })
        return
      } finally {
        setIsSaving(false)
      }
    }

    setIsPrinting(true)

    console.log("🖨️ Print button clicked for fast-sign document!")

    try {
      // Use the fast-sign print endpoint (now with proper PDF merging like view-signed)
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
      downloadLink.download = `SIGNED_${documentName}`

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

  const handleSendToAquarius = () => {
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

  const handleLinkToFileRecord = () => {
    console.log("Opening file record selector for document:", documentId)
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
      title: "Success",
      description: "Documento vinculado exitosamente al expediente",
    })
    setShowFileRecordSelector(false)
  }

  const handleUnlinkClick = () => {
    setShowUnlinkModal(true)
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

  const handleDeleteDocument = async () => {
    if (deleteConfirmText.toLowerCase() === "eliminar") {
      // Cancel any pending debounced save
      if (debouncedSaveRef.current) {
        clearTimeout(debouncedSaveRef.current)
        debouncedSaveRef.current = null
        console.log("⏰ Cancelled pending debounced save for document deletion")
      }

      try {
        // Delete the document using the Fast Sign actions
        const { deleteFastSignDocument } = await import("@/app/actions/fast-sign-actions")
        const result = await deleteFastSignDocument(documentId)

        if (result.error) {
          throw new Error(result.error)
        }

        toast({
          title: "Documento eliminado",
          description: "El documento y todas sus firmas han sido eliminados.",
        })

        // Navigate back to manage
        router.push("/fast-sign?view=manage")
      } catch (error) {
        console.error("Delete error:", error)
        toast({
          title: "Error al eliminar",
          description: "Error al eliminar el documento. Por favor intenta de nuevo.",
          variant: "destructive",
        })
      }

      setShowDeleteModal(false)
      setDeleteConfirmText("")
    }
  }

  const handleDeleteClick = () => {
    setShowDeleteModal(true)
    setDeleteConfirmText("")
  }

  const handleBack = () => {
    router.push("/fast-sign?view=manage")
  }

  const handleGoToPage = (page: number) => {
    // Dispatch custom event to notify PDF editor to go to specific page
    const event = new CustomEvent('goToPage', { detail: { page } })
    window.dispatchEvent(event)
  }

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ backgroundColor: "#F8F9FB" }}>
        <div className="text-center">
          <svg className="animate-spin h-12 w-12 text-blue-500 mb-4 mx-auto" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <p className="text-lg font-medium text-gray-900 mb-2">Cargando documento...</p>
          <p className="text-sm text-gray-500">Por favor espera mientras cargamos tu documento para editar</p>
        </div>
      </div>
    )
  }

  if (!documentUrl) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ backgroundColor: "#F8F9FB" }}>
        <div className="text-center">
          <p className="text-lg font-medium text-gray-900 mb-2">Documento no encontrado</p>
          <Button onClick={handleBack}>Volver a Gestión de Documentos</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen relative">
      {/* PDF Editor */}
      <div className="flex-1 w-full lg:w-auto overflow-hidden" style={{ backgroundColor: "#F8F9FB" }}>
        <div className="h-full">
          <PdfErrorBoundary>
            <PdfAnnotationEditor
              documentUrl={documentUrl}
              documentName={documentName}
              documentId={documentId}
              onBack={handleBack}
              onSave={handleSaveAnnotations}
              initialAnnotations={annotations}
              token={undefined}
              readOnly={false}
              hideSaveButton={true}
              onOpenSidebar={() => window.dispatchEvent(new Event("openMainSidebar"))}
              onOpenRightSidebar={() => setIsMobileSidebarOpen(true)}
            />
          </PdfErrorBoundary>
        </div>
      </div>

      {/* Right Sidebar */}
      <DocumentSidebar
        document={{
          id: documentId,
          file_name: documentName,
          file_path: documentId,
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
        isOpen={isMobileSidebarOpen}
        onClose={() => setIsMobileSidebarOpen(false)}
      />

      {/* Send to Aquarius Modal */}
      {showAquariusModal && (
        <FastSignAquariusModal
          isOpen={showAquariusModal}
          onClose={() => setShowAquariusModal(false)}
          documentId={documentId}
          documentName={documentName}
          onSuccess={() => {
            toast({
              title: "Documento enviado a Aquarius",
              description: "Tu documento firmado ha sido subido exitosamente.",
            })
          }}
        />
      )}

      {/* File Record Selector Modal */}
      <FileRecordSelector
        isOpen={showFileRecordSelector}
        onClose={handleCloseFileRecordSelector}
        onSuccess={handleFileRecordSuccess}
        documentId={documentId}
      />

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

      {/* Unlink Confirmation Modal */}
      <Dialog open={showUnlinkModal} onOpenChange={setShowUnlinkModal}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Desvincular del Expediente</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que quieres desvincular este documento del expediente? Esta acción se puede deshacer vinculándolo de nuevo.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUnlinkModal(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleUnlinkFileRecord}
            >
              Desvincular Documento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
