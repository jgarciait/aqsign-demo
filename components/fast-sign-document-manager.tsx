"use client"

import { useState, useEffect, useCallback, useRef, lazy, Suspense } from "react"
import { 
  Search, 
  Edit2, 
  Trash2, 
  Archive, 
  FileText, 
  Calendar, 
  ArchiveRestore, 
  Filter, 
  Clock, 
  ChevronLeft, 
  ChevronRight, 
  FolderOpen, 
  Tag, 
  X, 
  User, 
  Users, 
  Eye, 
  MoreVertical, 
  Download,
  Mail,
  AlertTriangle
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { 
  getFastSignDocumentsByArchiveStatus, 
  archiveFastSignDocument, 
  unarchiveFastSignDocument, 
  deleteFastSignDocument,
  checkDocumentSignatureStatus,
  checkMultipleDocumentsSignatureStatus,
  checkDocumentTemplateUsage,
  getDocumentsWithStatus,
} from "@/app/actions/fast-sign-actions"
import { formatDistanceToNow, isToday, isYesterday, isThisWeek, isThisMonth } from "date-fns"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"

// Lazy loading para componentes pesados
const DocumentViewerModal = lazy(() => import("@/components/document-viewer-modal"))

interface FileRecord {
  id: string
  valores_json: Record<string, any>
  created_at: string
  filing_systems: {
    id: string
    nombre: string
    filing_indices: Array<{
      clave: string
      etiqueta: string
      tipo_dato: string
      obligatorio: boolean
      orden: number
    }>
  }
}

interface Document {
  id: string
  file_name: string
  file_path: string
  file_size?: number
  file_type?: string
  status: string
  created_at: string
  updated_at: string
  archived: boolean
  document_type?: string
  file_record_id?: string
  category_id?: string
  case_file_metadata?: Record<string, any>
  file_records?: FileRecord
  creator?: {
    first_name: string
    last_name: string
    email: string
    full_name: string
  } | null
  hasSigned?: boolean
  documentStatus?: string
  statusDetails?: {
    mappingCount: number
    signingRequestCount: number
    signatureCount: number
    hasAnnotationSignatures: boolean
  }
}

interface DocumentsResponse {
  documents: Document[]
  totalCount: number
  totalPages: number
  currentPage: number
  error?: string
}

interface FastSignDocumentManagerProps {
  onClose: () => void
}

export default function FastSignDocumentManager({ onClose }: FastSignDocumentManagerProps) {
  const [activeDocuments, setActiveDocuments] = useState<Document[]>([])
  const [archivedDocuments, setArchivedDocuments] = useState<Document[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [activeDateFilter, setActiveDateFilter] = useState("all")
  const [archivedDateFilter, setArchivedDateFilter] = useState("all")
  const [loading, setLoading] = useState(true)
  const [searchLoading, setSearchLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("active")
  const [showOnlyMyDocuments, setShowOnlyMyDocuments] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  
  // Pagination state
  const [activePagination, setActivePagination] = useState({
    currentPage: 1,
    totalPages: 0,
    totalCount: 0
  })
  const [archivedPagination, setArchivedPagination] = useState({
    currentPage: 1,
    totalPages: 0,
    totalCount: 0
  })
  
  // Modal state for document viewer
  const [documentViewerModal, setDocumentViewerModal] = useState<{
    isOpen: boolean
    documentId: string
    documentName: string
  }>({
    isOpen: false,
    documentId: "",
    documentName: ""
  })

  // Template confirmation modal state
  const [templateConfirmModal, setTemplateConfirmModal] = useState<{
    isOpen: boolean
    documentId: string
    documentName: string
    templateCount: number
    copiedDocumentsCount?: number
    warning?: string
    templates: Array<{ id: string; name: string }>
  }>({
    isOpen: false,
    documentId: "",
    documentName: "",
    templateCount: 0,
    copiedDocumentsCount: 0,
    warning: "",
    templates: []
  })

  // General delete confirmation modal state
  const [deleteConfirmModal, setDeleteConfirmModal] = useState<{
    isOpen: boolean
    documentId: string
    documentName: string
  }>({
    isOpen: false,
    documentId: "",
    documentName: ""
  })
  
  const router = useRouter()
  const { toast } = useToast()
  const [isWideScreen, setIsWideScreen] = useState(false)

  // OPTIMIZACIÓN: Función unificada para cargar datos SIN dependencias problemáticas
  const loadDocuments = useCallback(async (
    tab: "active" | "archived",
    page: number = 1,
    search?: string,
    showMyDocs?: boolean
  ) => {
    setLoading(true)
    
    try {
      const currentSearchTerm = search !== undefined ? search : searchTerm
      const currentShowMyDocs = showMyDocs !== undefined ? showMyDocs : showOnlyMyDocuments
      const isActiveTab = tab === "active"
      
      // Una sola llamada optimizada al backend
      const result = await getFastSignDocumentsByArchiveStatus(
        !isActiveTab, // archived = false for active tab, true for archived tab
        currentSearchTerm, 
        page, 
        10, // Límite razonable
        currentShowMyDocs
      )

      if (result.error) {
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive",
        })
      } else {
        // Los documentos ya vienen con hasSigned desde el backend optimizado
        if (isActiveTab) {
          setActiveDocuments(result.documents)
          setActivePagination({
            currentPage: result.currentPage || 1,
            totalPages: result.totalPages || 0,
            totalCount: result.totalCount || 0
          })
        } else {
          setArchivedDocuments(result.documents)
          setArchivedPagination({
            currentPage: result.currentPage || 1,
            totalPages: result.totalPages || 0,
            totalCount: result.totalCount || 0
          })
        }
        
        // Set currentUserId if not already set
        if (!currentUserId && result.currentUserId) {
          setCurrentUserId(result.currentUserId)
        }
      }
    } catch (error) {
      toast({
        title: "Error",
        description: `Error al cargar documentos ${tab === "active" ? "activos" : "archivados"}`,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [toast]) // SOLO toast como dependencia

  // OPTIMIZACIÓN: Carga inicial - solo una vez
  useEffect(() => {
    loadDocuments("active", 1)
  }, []) // Sin dependencias - solo se ejecuta al montar

  // OPTIMIZACIÓN: Cargar tab cuando cambia (sin dependencias problemáticas)
  useEffect(() => {
    if (activeTab === "archived" && archivedDocuments.length === 0) {
      loadDocuments("archived", 1)
    }
  }, [activeTab]) // Solo depende del tab activo

  // OPTIMIZACIÓN: Debounced search con ref para evitar dependencias
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }
    
    searchTimeoutRef.current = setTimeout(() => {
      loadDocuments(activeTab as "active" | "archived", 1, searchTerm)
    }, 500) // Aumenté más el debounce
    
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [searchTerm, activeTab])

  // OPTIMIZACIÓN: Recargar solo cuando cambia el filtro de usuario
  useEffect(() => {
    if (currentUserId) { 
      loadDocuments(activeTab as "active" | "archived", 1, searchTerm, showOnlyMyDocuments)
    }
  }, [showOnlyMyDocuments]) // Solo cuando cambia el filtro

  // Detectar ancho de pantalla
  useEffect(() => {
    const checkScreenWidth = () => {
      setIsWideScreen(window.innerWidth >= 1600)
    }
    
    checkScreenWidth()
    window.addEventListener('resize', checkScreenWidth)
    
    return () => window.removeEventListener('resize', checkScreenWidth)
  }, [])

  const handleEdit = (documentId: string) => {
    router.push(`/fast-sign/edit/${documentId}`)
  }

  const handleView = (documentId: string, documentName: string) => {
    setDocumentViewerModal({
      isOpen: true,
      documentId,
      documentName
    })
  }

  const handlePrint = (documentId: string, fileName: string) => {
    window.open(`/api/fast-sign/${documentId}/print`, '_blank')
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const closeDocumentViewer = () => {
    setDocumentViewerModal({
      isOpen: false,
      documentId: "",
      documentName: ""
    })
  }

  const handleArchive = async (documentId: string) => {
    setActionLoading(documentId)
    try {
      const result = await archiveFastSignDocument(documentId)
      if (result.error) {
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive",
        })
      } else {
        toast({
          title: "Éxito",
          description: "Documento archivado exitosamente",
        })
        // OPTIMIZACIÓN: Solo recargar la tab activa (active)
        loadDocuments("active", activePagination.currentPage, searchTerm, showOnlyMyDocuments)
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al archivar documento",
        variant: "destructive",
      })
    } finally {
      setActionLoading(null)
    }
  }

  const handleUnarchive = async (documentId: string) => {
    setActionLoading(documentId)
    try {
      const result = await unarchiveFastSignDocument(documentId)
      if (result.error) {
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive",
        })
      } else {
        toast({
          title: "Éxito",
          description: "Documento desarchivado exitosamente",
        })
        // OPTIMIZACIÓN: Solo recargar la tab activa (archived)
        loadDocuments("archived", archivedPagination.currentPage, searchTerm, showOnlyMyDocuments)
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al desarchivar documento",
        variant: "destructive",
      })
    } finally {
      setActionLoading(null)
    }
  }

  const handleDelete = async (documentId: string) => {
    // Find the document name for the confirmation modal
    const allDocuments = [...activeDocuments, ...archivedDocuments]
    const document = allDocuments.find(doc => doc.id === documentId)
    const documentName = document?.file_name || "Unknown Document"

    // Always show general delete confirmation modal first
    setDeleteConfirmModal({
      isOpen: true,
      documentId,
      documentName
    })
  }

  const handleConfirmDelete = async () => {
    const documentId = deleteConfirmModal.documentId
    
    // Close the general confirmation modal
    setDeleteConfirmModal({
      isOpen: false,
      documentId: "",
      documentName: ""
    })

    // Check if the document is being used as a template
    try {
      const templateCheck = await checkDocumentTemplateUsage(documentId)
      
      if (templateCheck.error) {
        toast({
          title: "Error",
          description: templateCheck.error,
          variant: "destructive",
        })
        return
      }

      if (templateCheck.isUsedAsTemplate) {
        // Show template confirmation modal
        setTemplateConfirmModal({
          isOpen: true,
          documentId,
          documentName: deleteConfirmModal.documentName,
          templateCount: templateCheck.templateCount,
          copiedDocumentsCount: templateCheck.copiedDocumentsCount,
          warning: templateCheck.warning || undefined,
          templates: templateCheck.templates || []
        })
        return
      }

      // If not used as template, proceed with regular deletion
      await performDocumentDeletion(documentId)
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al verificar el uso del documento como plantilla",
        variant: "destructive",
      })
    }
  }

  const performDocumentDeletion = async (documentId: string) => {
    setActionLoading(documentId)
    try {
      const result = await deleteFastSignDocument(documentId)
      if (result.error) {
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive",
        })
      } else {
        toast({
          title: "Éxito",
          description: "Documento eliminado exitosamente",
        })
        // OPTIMIZACIÓN: Solo recargar la tab actual
        const currentPage = activeTab === "active" ? activePagination.currentPage : archivedPagination.currentPage
        loadDocuments(activeTab as "active" | "archived", currentPage, searchTerm, showOnlyMyDocuments)
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al eliminar documento",
        variant: "destructive",
      })
    } finally {
      setActionLoading(null)
    }
  }

  const handleConfirmTemplateDelete = async () => {
    setTemplateConfirmModal({
      isOpen: false,
      documentId: "",
      documentName: "",
      templateCount: 0,
      copiedDocumentsCount: 0,
      warning: "",
      templates: []
    })
    await performDocumentDeletion(templateConfirmModal.documentId)
  }

  const formatCaseFileData = (fileRecord: FileRecord) => {
    if (!fileRecord?.filing_systems?.filing_indices) return null
    
    const indices = fileRecord.filing_systems.filing_indices.sort((a, b) => a.orden - b.orden)
    const displayFields = indices.slice(0, 2) // Show first 2 fields
    
    return displayFields.map(field => {
      const value = fileRecord.valores_json[field.clave]
      if (!value) return null
      
      let displayValue = value
      if (field.tipo_dato === 'bool') {
        displayValue = value ? 'Sí' : 'No'
      } else if (field.tipo_dato === 'fecha') {
        displayValue = new Date(value).toLocaleDateString()
      }
      
      return { label: field.etiqueta, value: displayValue }
    }).filter(Boolean)
  }

  const renderStatusBadge = (document: Document) => {
    const status = document.documentStatus || "sin_mapeo"
    const isFastSignDocument = document.document_type === 'fast_sign'
    
    // Different status configurations for fast_sign vs email documents
    const fastSignStatusConfig = {
      firmado: {
        text: "Firmado",
        className: "bg-green-100 text-green-800 border-green-200",
        icon: "CheckCircle"
      },
      sin_firma: {
        text: "Sin Firma",
        className: "bg-orange-100 text-orange-800 border-orange-200",
        icon: "AlertTriangle"
      }
    }

    const emailStatusConfig = {
      sin_mapeo: {
        text: "Sin Mapeo",
        className: "bg-gray-100 text-gray-800 border-gray-200",
        icon: "AlertCircle"
      },
      mapeado: {
        text: "Mapeado",
        className: "bg-blue-100 text-blue-800 border-blue-200",
        icon: "MapPin"
      },
      enviado: {
        text: "Enviado",
        className: "bg-yellow-100 text-yellow-800 border-yellow-200",
        icon: "Send"
      },
      firmado: {
        text: "Firmado",
        className: "bg-green-100 text-green-800 border-green-200",
        icon: "CheckCircle"
      },
      error: {
        text: "Error",
        className: "bg-red-100 text-red-800 border-red-200",
        icon: "XCircle"
      }
    }

    // Choose the appropriate configuration based on document type
    const statusConfig = isFastSignDocument ? fastSignStatusConfig : emailStatusConfig
    
    // For fast_sign documents, convert complex statuses to "sin_firma" 
    let displayStatus = status
    if (isFastSignDocument && (status === "sin_mapeo" || status === "mapeado" || status === "enviado")) {
      displayStatus = "sin_firma"
    }

    const config = statusConfig[displayStatus as keyof typeof statusConfig] || 
      (isFastSignDocument ? fastSignStatusConfig.sin_firma : emailStatusConfig.sin_mapeo)

    return (
      <div className="flex items-center space-x-2">
        <Badge 
          variant="outline" 
          className={`text-xs font-medium ${config.className}`}
        >
          {config.text}
        </Badge>
        {document.statusDetails && (
          <div className="text-xs text-gray-500">
            {document.statusDetails.mappingCount > 0 && (
              <span title={`${document.statusDetails.mappingCount} mapeo(s)`}>
                📍 {document.statusDetails.mappingCount}
              </span>
            )}
            {document.statusDetails.signingRequestCount > 0 && (
              <span title={`${document.statusDetails.signingRequestCount} solicitud(es) de firma`} className="ml-1">
                📧 {document.statusDetails.signingRequestCount}
              </span>
            )}
            {document.statusDetails.signatureCount > 0 && (
              <span title={`${document.statusDetails.signatureCount} firma(s)`} className="ml-1">
                ✅ {document.statusDetails.signatureCount}
              </span>
            )}
          </div>
        )}
      </div>
    )
  }

  const PaginationControls = ({ pagination, onPageChange, isLoading }: {
    pagination: { currentPage: number, totalPages: number, totalCount: number }
    onPageChange: (page: number) => void
    isLoading: boolean
  }) => (
    <div className="flex items-center justify-between py-2 px-1">
      <div className="text-sm text-gray-600">
        Mostrando {Math.min(5, pagination.totalCount)} de {pagination.totalCount} documentos
      </div>
      <div className="flex items-center space-x-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(pagination.currentPage - 1)}
          disabled={pagination.currentPage <= 1 || isLoading}
          className="h-8 w-8 p-0"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm text-gray-600">
          Página {pagination.currentPage} de {pagination.totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(pagination.currentPage + 1)}
          disabled={pagination.currentPage >= pagination.totalPages || isLoading}
          className="h-8 w-8 p-0"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )

  const DocumentTable = ({ documents, isArchived, pagination, onPageChange }: { 
    documents: Document[], 
    isArchived: boolean,
    pagination: { currentPage: number, totalPages: number, totalCount: number }
    onPageChange: (page: number) => void
  }) => {
    const [actionLoading, setActionLoading] = useState<string | null>(null)

    if (loading) {
      return (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      )
    }

    if (documents.length === 0) {
      return (
        <div className="text-center py-16 bg-gray-50 rounded-lg border border-gray-200">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <FileText className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {isArchived ? "No hay Documentos Archivados" : "No hay Documentos Activos"}
          </h3>
          <p className="text-gray-500 text-sm max-w-sm mx-auto">
            {isArchived 
              ? "Los documentos que archives aparecerán aquí para fácil acceso posterior." 
              : "Sube tu primer documento para comenzar con AQ Fast Sign."}
          </p>
        </div>
      )
    }

    return (
      <div className="space-y-4">
        {/* Vista de tabla para desktop */}
        <div className="hidden lg:block bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <div className="relative">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Documento</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Creador</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Expediente</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Estado de Firma</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Creado</th>
                    <th className="sticky right-0 bg-gray-50 px-6 py-4 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider border-l border-gray-200">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {documents.map((document) => {
                    const caseFileData = document.file_records ? formatCaseFileData(document.file_records) : null
                    
                    return (
                      <tr key={document.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div className="flex items-center space-x-3">
                            <div className="flex-shrink-0">
                              <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                                document.document_type === 'email' 
                                  ? 'bg-blue-100' 
                                  : 'bg-red-100'
                              }`}>
                                {document.document_type === 'email' ? (
                                  <Mail className="h-4 w-4 text-blue-600" />
                                ) : (
                                  <FileText className="h-4 w-4 text-red-600" />
                                )}
                              </div>
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center space-x-2">
                                <div className="text-sm font-medium text-gray-900 truncate max-w-xs" title={document.file_name}>
                                  {document.file_name}
                                </div>
                                {document.document_type === 'email' && (
                                  <Badge variant="outline" className="text-xs border-blue-200 text-blue-700 bg-blue-50">
                                    Email
                                  </Badge>
                                )}
                              </div>
                              <div className="text-xs text-gray-500 mt-0.5">
                                {document.file_size ? formatFileSize(document.file_size) : 'Archivo PDF'}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center space-x-2">
                            <div className="h-6 w-6 bg-gray-200 rounded-full flex items-center justify-center">
                              <User className="h-3 w-3 text-gray-600" />
                            </div>
                            <div className="text-sm text-gray-900">
                              {document.creator?.full_name || 'Usuario Desconocido'}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {caseFileData ? (
                            <div className="space-y-1">
                              <div className="flex items-center space-x-1">
                                <FolderOpen className="h-3 w-3 text-green-600" />
                                <Badge variant="outline" className="text-xs border-green-200 text-green-700 bg-green-50">
                                  {document.file_records?.filing_systems?.nombre || "Desconocido"}
                                </Badge>
                              </div>
                              {caseFileData.map((field, idx) => (
                                <div key={idx} className="text-xs text-gray-600">
                                  <span className="font-medium">{field?.label}:</span> {field?.value}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="flex items-center space-x-1 text-gray-400">
                              <Tag className="h-3 w-3" />
                              <span className="text-xs">Sin expediente</span>
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {renderStatusBadge(document)}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center space-x-1 text-xs text-gray-500">
                            <Calendar className="h-3 w-3" />
                            <span>{formatDistanceToNow(new Date(document.created_at), { addSuffix: true })}</span>
                          </div>
                        </td>
                        <td className="sticky right-0 bg-white px-6 py-4 text-right border-l border-gray-200">
                          {isWideScreen ? (
                            // Botones individuales para pantallas anchas (>=1600px)
                            <div className="flex items-center justify-end space-x-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleView(document.id, document.file_name)}
                                disabled={actionLoading === document.id}
                                className="h-8 px-2 text-gray-600 hover:text-white hover:bg-[#174070] transition-colors"
                                title="Ver documento"
                              >
                                <Eye className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEdit(document.id)}
                                disabled={actionLoading === document.id}
                                className="h-8 px-2 text-gray-600 hover:text-white hover:bg-[#174070] transition-colors"
                              >
                                <Edit2 className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handlePrint(document.id, document.file_name)}
                                disabled={actionLoading === document.id}
                                className="h-8 px-2 text-gray-600 hover:text-white hover:bg-[#174070] transition-colors"
                                title="Guardar en PC"
                              >
                                <Download className="h-3 w-3" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    disabled={actionLoading === document.id}
                                    className="h-8 px-2 text-red-600 hover:text-white hover:bg-red-600 transition-colors"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Eliminar Documento</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      ¿Estás seguro de que quieres eliminar "{document.file_name}"? Esta acción no se puede deshacer.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleDelete(document.id)}
                                      className="bg-red-600 hover:bg-red-700 transition-colors"
                                    >
                                      Eliminar
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          ) : (
                            // Dropdown menu para pantallas menores a 1600px
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 text-gray-600 hover:bg-gray-100"
                                  disabled={actionLoading === document.id}
                                >
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem 
                                  onClick={() => handleView(document.id, document.file_name)}
                                  className="text-gray-700 hover:text-gray-900 hover:bg-gray-50"
                                >
                                  <Eye className="h-4 w-4 mr-2" />
                                  Ver Documento
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => handleEdit(document.id)}
                                  className="text-gray-700 hover:text-gray-900 hover:bg-gray-50"
                                >
                                  <Edit2 className="h-4 w-4 mr-2" />
                                  Editar
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => handlePrint(document.id, document.file_name)}
                                  className="text-gray-700 hover:text-gray-900 hover:bg-gray-50"
                                >
                                  <Download className="h-4 w-4 mr-2" />
                                  Guardar en PC
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  onClick={() => handleDelete(document.id)}
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Eliminar
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Vista compacta para tablet */}
        <div className="hidden md:block lg:hidden bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <div className="relative">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Documento</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Estado</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Creado</th>
                    <th className="sticky right-0 bg-gray-50 px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider border-l border-gray-200">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {documents.map((document) => {
                    return (
                      <tr key={document.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center space-x-2">
                            <div className={`h-6 w-6 rounded-lg flex items-center justify-center ${
                              document.document_type === 'email' 
                                ? 'bg-blue-100' 
                                : 'bg-red-100'
                            }`}>
                              {document.document_type === 'email' ? (
                                <Mail className="h-3 w-3 text-blue-600" />
                              ) : (
                                <FileText className="h-3 w-3 text-red-600" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-medium text-gray-900 truncate max-w-xs" title={document.file_name}>
                                {document.file_name}
                              </div>
                              <div className="text-xs text-gray-500">
                                {document.creator?.full_name || 'Usuario Desconocido'}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {renderStatusBadge(document)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-xs text-gray-500">
                            {formatDistanceToNow(new Date(document.created_at), { addSuffix: true })}
                          </div>
                        </td>
                        <td className="sticky right-0 bg-white px-4 py-3 text-right border-l border-gray-200">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-gray-600 hover:bg-gray-100"
                                disabled={actionLoading === document.id}
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem 
                                onClick={() => handleView(document.id, document.file_name)}
                                className="text-gray-700 hover:text-gray-900 hover:bg-gray-50"
                              >
                                <Eye className="h-4 w-4 mr-2" />
                                Ver Documento
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => handleEdit(document.id)}
                                className="text-gray-700 hover:text-gray-900 hover:bg-gray-50"
                              >
                                <Edit2 className="h-4 w-4 mr-2" />
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => handlePrint(document.id, document.file_name)}
                                className="text-gray-700 hover:text-gray-900 hover:bg-gray-50"
                              >
                                <Download className="h-4 w-4 mr-2" />
                                Guardar en PC
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {isArchived ? (
                                <DropdownMenuItem 
                                  onClick={() => handleUnarchive(document.id)}
                                  className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                  disabled={actionLoading === document.id}
                                >
                                  <ArchiveRestore className="h-4 w-4 mr-2" />
                                  Restaurar
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem 
                                  onClick={() => handleArchive(document.id)}
                                  className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                  disabled={actionLoading === document.id}
                                >
                                  <Archive className="h-4 w-4 mr-2" />
                                  Archivar
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem 
                                onClick={() => handleDelete(document.id)}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Eliminar
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Vista de cards para móvil */}
        <div className="md:hidden space-y-3">
          {documents.map((document) => {
            const caseFileData = document.file_records ? formatCaseFileData(document.file_records) : null
            
            return (
              <div key={document.id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-2 flex-1 min-w-0">
                    <div className={`h-4 w-4 rounded-lg flex items-center justify-center ${
                      document.document_type === 'email' 
                        ? 'bg-blue-100' 
                        : 'bg-red-100'
                    }`}>
                      {document.document_type === 'email' ? (
                        <Mail className="h-4 w-4 text-blue-600" />
                      ) : (
                        <FileText className="h-4 w-4 text-red-600" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate" title={document.file_name}>
                        {document.file_name}
                      </p>
                    </div>
                  </div>
                  <div className="ml-2 flex-shrink-0">
                    {renderStatusBadge(document)}
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>Por {document.creator?.full_name || 'Usuario Desconocido'}</span>
                    <span>{formatDistanceToNow(new Date(document.created_at), { addSuffix: true })}</span>
                  </div>

                  {caseFileData && (
                    <div className="space-y-1">
                      <div className="flex items-center space-x-1">
                        <FolderOpen className="h-3 w-3 text-green-600" />
                        <Badge variant="outline" className="text-xs border-green-200 text-green-700 bg-green-50">
                          {document.file_records?.filing_systems?.nombre || "Desconocido"}
                        </Badge>
                      </div>
                      {caseFileData.slice(0, 1).map((field, idx) => (
                        <div key={idx} className="text-xs text-gray-600">
                          <span className="font-medium">{field?.label}:</span> {field?.value}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end space-x-2 pt-2 border-t border-gray-100">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleView(document.id, document.file_name)}
                    disabled={actionLoading === document.id}
                    className="h-8 px-3 text-xs text-gray-600 hover:text-white hover:bg-[#174070] transition-colors"
                  >
                    <Eye className="h-3 w-3 mr-1" />
                    Ver
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEdit(document.id)}
                    disabled={actionLoading === document.id}
                    className="h-8 px-3 text-xs text-gray-600 hover:text-white hover:bg-[#174070] transition-colors"
                  >
                    <Edit2 className="h-3 w-3 mr-1" />
                    Editar
                  </Button>
                  {isArchived ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleUnarchive(document.id)}
                      disabled={actionLoading === document.id}
                      className="h-8 px-3 text-xs text-blue-600 hover:text-white hover:bg-[#174070] transition-colors"
                    >
                      <ArchiveRestore className="h-3 w-3 mr-1" />
                      Restaurar
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleArchive(document.id)}
                      disabled={actionLoading === document.id}
                      className="h-8 px-3 text-xs text-blue-600 hover:text-white hover:bg-[#174070] transition-colors"
                    >
                      <Archive className="h-3 w-3 mr-1" />
                      Archivar
                    </Button>
                  )}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={actionLoading === document.id}
                        className="h-8 px-3 text-xs text-red-600 hover:text-white hover:bg-red-600 transition-colors"
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        Eliminar
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Eliminar Documento</AlertDialogTitle>
                        <AlertDialogDescription>
                          ¿Estás seguro de que quieres eliminar "{document.file_name}"? Esta acción no se puede deshacer.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDelete(document.id)}
                          className="bg-red-600 hover:bg-red-700 transition-colors"
                        >
                          Eliminar
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            )
          })}
        </div>
        
        <PaginationControls 
          pagination={pagination}
          onPageChange={onPageChange}
          isLoading={loading}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6 bg-gray-50 min-h-screen">
      <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm border">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Gestión de Documentos</h2>
          <p className="text-gray-600 text-sm mt-1">Gestiona tus documentos Fast Sign</p>
        </div>
        <Button variant="outline" onClick={onClose} className="text-sm hover:bg-[#174070] hover:text-white hover:border-[#174070]">
          Volver a Subir
        </Button>
      </div>

      {/* User Filter Toggle */}
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              {showOnlyMyDocuments ? (
                <User className="h-4 w-4 text-blue-600 flex-shrink-0" />
              ) : (
                <Users className="h-4 w-4 text-green-600 flex-shrink-0" />
              )}
              <Label htmlFor="user-filter" className="text-sm font-medium">
                {showOnlyMyDocuments ? "Mostrando solo mis documentos" : "Mostrando todos los documentos"}
              </Label>
            </div>
            <Switch
              id="user-filter"
              checked={!showOnlyMyDocuments}
              onCheckedChange={(checked) => setShowOnlyMyDocuments(!checked)}
            />
          </div>
          <div className="text-xs text-gray-500 sm:text-right">
            {showOnlyMyDocuments ? "Cambiar para ver documentos de todos los usuarios" : "Cambiar para ver solo tus documentos"}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border">
        <Tabs defaultValue="active" className="w-full" onValueChange={setActiveTab}>
          <div className="border-b border-gray-200 px-6 pt-4">
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="active" className="flex items-center gap-2 font-semibold">
                <FileText className="h-4 w-4" />
                Activos ({activePagination.totalCount})
              </TabsTrigger>
              <TabsTrigger value="archived" className="flex items-center gap-2 font-semibold">
                <Archive className="h-4 w-4" />
                Archivados ({archivedPagination.totalCount})
              </TabsTrigger>
            </TabsList>
          </div>

        <TabsContent value="active" className="space-y-4 p-6">
          {searchTerm && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Search className="h-4 w-4 text-blue-600" />
                  <span className="text-sm text-blue-800">
                    Buscando: <strong>"{searchTerm}"</strong>
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSearchTerm("")}
                  className="text-blue-600 hover:text-blue-800 hover:bg-blue-100 h-6 px-2"
                >
                  Limpiar
                </Button>
              </div>
            </div>
          )}
          <div className="flex flex-col gap-3 mb-4">
            {/* Búsqueda */}
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Buscar documentos en todas las pestañas..."
                value={searchTerm}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                className="pl-10 pr-10 h-10 text-sm w-full"
              />
              {searchTerm && !searchLoading && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
              {searchLoading && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#0b233f]"></div>
                </div>
              )}
            </div>
            
            {/* Filtro de fecha */}
            <div className="flex items-center gap-2 sm:justify-end">
              <Filter className="h-4 w-4 text-gray-500 flex-shrink-0" />
              <Select value={activeDateFilter} onValueChange={setActiveDateFilter}>
                <SelectTrigger className="w-full sm:w-[140px] h-10 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todo el Tiempo</SelectItem>
                  <SelectItem value="today">Hoy</SelectItem>
                  <SelectItem value="yesterday">Ayer</SelectItem>
                  <SelectItem value="week">Esta Semana</SelectItem>
                  <SelectItem value="month">Este Mes</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <DocumentTable 
            documents={activeDocuments} 
            isArchived={false}
            pagination={activePagination}
            onPageChange={(page) => loadDocuments("active", page, searchTerm, showOnlyMyDocuments)}
          />
        </TabsContent>

        <TabsContent value="archived" className="space-y-4 p-6">
          {searchTerm && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Search className="h-4 w-4 text-blue-600" />
                  <span className="text-sm text-blue-800">
                    Buscando: <strong>"{searchTerm}"</strong>
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSearchTerm("")}
                  className="text-blue-600 hover:text-blue-800 hover:bg-blue-100 h-6 px-2"
                >
                  Limpiar
                </Button>
              </div>
            </div>
          )}
                      <div className="flex flex-col gap-3 mb-4">
              {/* Búsqueda */}
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Buscar documentos en todas las pestañas..."
                  value={searchTerm}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-10 h-10 text-sm w-full"
                />
                {searchTerm && !searchLoading && (
                  <button
                    onClick={() => setSearchTerm("")}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
                {searchLoading && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#0b233f]"></div>
                  </div>
                )}
              </div>
              
              {/* Filtro de fecha */}
              <div className="flex items-center gap-2 sm:justify-end">
                <Filter className="h-4 w-4 text-gray-500 flex-shrink-0" />
                <Select value={archivedDateFilter} onValueChange={setArchivedDateFilter}>
                  <SelectTrigger className="w-full sm:w-[140px] h-10 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todo el Tiempo</SelectItem>
                    <SelectItem value="today">Hoy</SelectItem>
                    <SelectItem value="yesterday">Ayer</SelectItem>
                    <SelectItem value="week">Esta Semana</SelectItem>
                    <SelectItem value="month">Este Mes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          
          <DocumentTable 
            documents={archivedDocuments} 
            isArchived={true}
            pagination={archivedPagination}
            onPageChange={(page) => loadDocuments("archived", page, searchTerm, showOnlyMyDocuments)}
          />
        </TabsContent>
        </Tabs>
      </div>
      
      {/* Document Viewer Modal */}
      <Suspense fallback={<div>Cargando...</div>}>
        <DocumentViewerModal
          isOpen={documentViewerModal.isOpen}
          onClose={closeDocumentViewer}
          documentId={documentViewerModal.documentId}
          documentName={documentViewerModal.documentName}
        />
      </Suspense>

      {/* General Delete Confirmation Modal */}
      <AlertDialog open={deleteConfirmModal.isOpen} onOpenChange={(open) => {
        if (!open) {
          setDeleteConfirmModal({
            isOpen: false,
            documentId: "",
            documentName: ""
          })
        }
      }}>
        <AlertDialogContent className="sm:max-w-[400px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red-500" />
              Confirmar Eliminación
            </AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que deseas eliminar el documento <strong>"{deleteConfirmModal.documentName}"</strong>?
              <br /><br />
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-red-600 hover:bg-red-700 transition-colors"
            >
              Eliminar Documento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Template Confirmation Modal */}
      <AlertDialog open={templateConfirmModal.isOpen} onOpenChange={(open) => {
        if (!open) {
          setTemplateConfirmModal({
            isOpen: false,
            documentId: "",
            documentName: "",
            templateCount: 0,
            copiedDocumentsCount: 0,
            warning: "",
            templates: []
          })
        }
      }}>
        <AlertDialogContent className="sm:max-w-[500px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Documento Usado como Plantilla
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  El documento <strong>"{templateConfirmModal.documentName}"</strong> está siendo usado como plantilla en {templateConfirmModal.templateCount} plantilla{templateConfirmModal.templateCount > 1 ? 's' : ''}.
                </p>
                
                {templateConfirmModal.templates.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <p className="text-sm font-medium text-amber-800 mb-2">
                      Plantillas que usan este documento:
                    </p>
                    <ul className="text-sm text-amber-700 space-y-1">
                      {templateConfirmModal.templates.map((template) => (
                        <li key={template.id} className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 bg-amber-400 rounded-full"></div>
                          {template.name}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {templateConfirmModal.copiedDocumentsCount && templateConfirmModal.copiedDocumentsCount > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-sm font-medium text-blue-800 mb-2">
                      Documentos creados desde las plantillas:
                    </p>
                    <p className="text-sm text-blue-700">
                      {templateConfirmModal.copiedDocumentsCount} documento{templateConfirmModal.copiedDocumentsCount > 1 ? 's' : ''} ha{templateConfirmModal.copiedDocumentsCount > 1 ? 'n' : ''} sido creado{templateConfirmModal.copiedDocumentsCount > 1 ? 's' : ''} desde est{templateConfirmModal.copiedDocumentsCount > 1 ? 'as plantillas' : 'a plantilla'}.
                    </p>
                    <p className="text-xs text-blue-600 mt-1">
                      Estos documentos permanecerán intactos después de eliminar el documento original.
                    </p>
                  </div>
                )}
                
                {templateConfirmModal.warning && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-sm text-red-800">
                      <strong>⚠️ Advertencia:</strong> Al eliminar este documento original:
                    </p>
                    <ul className="text-sm text-red-700 mt-2 space-y-1 ml-4">
                      <li>• Las {templateConfirmModal.templateCount} plantilla{templateConfirmModal.templateCount > 1 ? 's' : ''} asociada{templateConfirmModal.templateCount > 1 ? 's' : ''} serán eliminada{templateConfirmModal.templateCount > 1 ? 's' : ''}</li>
                      <li>• No se podrán crear nuevos documentos desde est{templateConfirmModal.templateCount > 1 ? 'as plantillas' : 'a plantilla'}</li>
                      {templateConfirmModal.copiedDocumentsCount && templateConfirmModal.copiedDocumentsCount > 0 && (
                        <li>• Los {templateConfirmModal.copiedDocumentsCount} documento{templateConfirmModal.copiedDocumentsCount > 1 ? 's' : ''} ya creado{templateConfirmModal.copiedDocumentsCount > 1 ? 's' : ''} permanecerán intactos</li>
                      )}
                      <li>• Esta acción <strong>no se puede deshacer</strong></li>
                    </ul>
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmTemplateDelete}
              className="bg-red-600 hover:bg-red-700 transition-colors"
            >
              Eliminar Documento y Plantillas
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
