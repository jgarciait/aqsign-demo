"use client"

import { useState, useEffect, useCallback } from "react"
import { getRequests } from "@/app/actions/document-actions"
import { formatDistanceToNow } from "date-fns"
import { Eye, User, Users, CheckCircle, Clock, Send } from "lucide-react"
import Link from "next/link"
import DeleteDocumentButton from "@/components/delete-document-button"
import ViewSignedDocumentButton from "@/components/view-signed-document-button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { createClient } from "@/utils/supabase/client"

// Función para obtener detalles del estado en español
function getStatusDetails(status: string) {
  switch (status?.toLowerCase()) {
    case 'sent':
      return {
        label: 'Enviado',
        icon: Send,
        bgColor: 'bg-blue-100',
        textColor: 'text-blue-800',
        progressWidth: '33%',
        description: 'Documento enviado al destinatario'
      }
    case 'signed':
      return {
        label: 'Documento Firmado',
        icon: CheckCircle,
        bgColor: 'bg-green-100',
        textColor: 'text-green-800',
        progressWidth: '100%',
        description: 'Documento firmado exitosamente',
        pulse: true
      }
    case 'returned':
      return {
        label: 'Documento Firmado',
        icon: CheckCircle,
        bgColor: 'bg-green-100',
        textColor: 'text-green-800',
        progressWidth: '100%',
        description: 'Documento firmado y devuelto',
        pulse: true
      }
    case 'pending':
      return {
        label: 'Pendiente',
        icon: Clock,
        bgColor: 'bg-yellow-100',
        textColor: 'text-yellow-800',
        progressWidth: '10%',
        description: 'Esperando envío'
      }
    default:
      return {
        label: 'Desconocido',
        icon: Clock,
        bgColor: 'bg-gray-100',
        textColor: 'text-gray-800',
        progressWidth: '0%',
        description: 'Estado no definido'
      }
  }
}

// Componente de barra de progreso
function DocumentProgressBar({ status }: { status: string }) {
  const statusDetails = getStatusDetails(status)
  
  return (
    <div className="w-full">
      <div className="flex justify-between text-xs text-gray-600 mb-1">
        <span>Progreso del documento</span>
        <span>{statusDetails.label}</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div 
          className={`h-2 rounded-full transition-all duration-500 ${
            status === 'signed' || status === 'returned' 
              ? 'bg-green-500 progress-shine' 
              : status === 'sent' 
                ? 'bg-blue-500' 
                : 'bg-yellow-500'
          }`}
          style={{ width: statusDetails.progressWidth }}
        ></div>
      </div>
      <div className="text-xs text-gray-500 mt-1">{statusDetails.description}</div>
    </div>
  )
}

export default function DocumentsPage() {
  const [requests, setRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showOnlyMyDocuments, setShowOnlyMyDocuments] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [realtimeStatus, setRealtimeStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected')
  const [activeTab, setActiveTab] = useState("all")

  const loadRequests = useCallback(async () => {
    setLoading(true)
    try {
      const result = await getRequests(showOnlyMyDocuments)
      
      if (result.error) {
        setError(result.error)
      } else {
        setRequests(result.requests)
        if (!currentUserId && result.currentUserId) {
          setCurrentUserId(result.currentUserId)
        }
        setError(null)
      }
    } catch (err) {
      setError("Error al cargar las solicitudes")
    } finally {
      setLoading(false)
    }
  }, [showOnlyMyDocuments, currentUserId])

  useEffect(() => {
    loadRequests()
  }, [])

  // Recargar cuando cambie el filtro de usuario
  useEffect(() => {
    if (currentUserId) {
      loadRequests()
    }
  }, [showOnlyMyDocuments])

  // Configurar actualizaciones en tiempo real
  useEffect(() => {
    const supabase = createClient()
    
    const channel = supabase
      .channel("document-requests")
      .on("postgres_changes", 
        { 
          event: "*", 
          schema: "public", 
          table: "document_requests" 
        }, 
        (payload) => {
          console.log("Realtime update:", payload)
          // Recargar datos cuando hay cambios
          loadRequests()
        }
      )
      .subscribe((status) => {
        console.log("Realtime status:", status)
        setRealtimeStatus(status === "SUBSCRIBED" ? "connected" : 
                          status === "CHANNEL_ERROR" ? "disconnected" : "connecting")
      })

    return () => {
      channel.unsubscribe()
    }
  }, [loadRequests])

  if (loading) {
    return (
      <div className="p-8 max-w-6xl mx-auto">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-300 rounded w-1/3 mb-6"></div>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white p-6 rounded-lg shadow-sm">
                <div className="h-4 bg-gray-300 rounded w-3/4 mb-2"></div>
                <div className="h-4 bg-gray-300 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8 max-w-6xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-red-800 mb-2">Error</h2>
          <p className="text-red-600">{error}</p>
          <button
            onClick={loadRequests}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  // Agrupar solicitudes por estado
  const groupedRequests = requests.reduce(
    (acc, request) => {
      const status = request.status || "unknown"
      if (!acc[status]) {
        acc[status] = []
      }
      acc[status].push(request)
      return acc
    },
    {} as Record<string, typeof requests>,
  )

  // Obtener todos los estados únicos con traducciones
  const statuses = ["all", ...Object.keys(groupedRequests)]
  const getStatusLabel = (status: string) => {
    if (status === "all") return "Todos"
    return getStatusDetails(status).label
  }

  // Filtrar documentos según el tab activo
  const filteredRequests = activeTab === "all" ? requests : (groupedRequests[activeTab] || [])

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Gestionar y dar seguimiento a solicitudes de firma de documentos</h1>

      {/* Filtro de Usuario */}
      <div className="bg-white rounded-lg shadow-sm border p-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              {showOnlyMyDocuments ? (
                <User className="h-4 w-4 text-blue-600" />
              ) : (
                <Users className="h-4 w-4 text-green-600" />
              )}
              <Label htmlFor="user-filter" className="text-sm font-medium">
                {showOnlyMyDocuments ? "Mostrando solo mis solicitudes" : "Mostrando todas las solicitudes"}
              </Label>
            </div>
            <Switch
              id="user-filter"
              checked={!showOnlyMyDocuments}
              onCheckedChange={(checked) => setShowOnlyMyDocuments(!checked)}
            />
          </div>
          
          {/* Indicador de estado en tiempo real */}
          <div className="flex items-center space-x-2">
            <div className={`h-2 w-2 rounded-full ${
              realtimeStatus === 'connected' ? 'bg-green-500' :
              realtimeStatus === 'connecting' ? 'bg-yellow-500' :
              'bg-red-500'
            }`}></div>
            <span className="text-xs text-gray-500">
              {realtimeStatus === 'connected' ? 'Conectado' :
               realtimeStatus === 'connecting' ? 'Conectando...' :
               'Desconectado'}
            </span>
          </div>
        </div>
      </div>

      {/* Navegación por pestañas */}
      <div className="mb-8">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {statuses.map((status) => (
              <button
                key={status}
                onClick={() => setActiveTab(status)}
                className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  status === activeTab
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                {getStatusLabel(status)}
                {status === "all"
                  ? ` (${requests.length || 0})`
                  : ` (${groupedRequests[status]?.length || 0})`}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Lista de documentos */}
      <div className="space-y-4">
        {filteredRequests.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <p className="text-gray-500">
              {activeTab === "all" 
                ? (showOnlyMyDocuments ? "No has creado ninguna solicitud de documento" : "No se encontraron solicitudes de documento")
                : `No hay documentos con estado "${getStatusLabel(activeTab)}"`
              }
            </p>
          </div>
        ) : (
          filteredRequests.map((request: any) => {
            const customer = request.customer as any
            const document = request.document as any
            const statusDetails = getStatusDetails(request.status)
            const initials = customer
              ? `${(customer.first_name || "").charAt(0)}${(customer.last_name || "").charAt(0)}`
              : "??"

            return (
              <div 
                key={request.id} 
                className={`bg-white border rounded-lg shadow-sm overflow-hidden transition-all duration-300 hover:shadow-md ${
                  statusDetails.pulse ? 'signed-document-pulse signed-border-glow' : ''
                }`}
              >
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <h2 className="text-lg font-medium text-gray-900 mb-2">{request.title}</h2>
                      <p className="text-sm text-gray-500">
                        {request.sent_at
                          ? formatDistanceToNow(new Date(request.sent_at), { addSuffix: true })
                          : "Fecha desconocida"}
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${statusDetails.bgColor} ${statusDetails.textColor} ${
                        statusDetails.pulse ? 'signed-text-glow font-bold' : ''
                      }`}
                    >
                      <statusDetails.icon className="h-4 w-4 mr-1" />
                      {statusDetails.label}
                    </span>
                  </div>

                  {/* Barra de progreso */}
                  <div className="mb-4">
                    <DocumentProgressBar status={request.status} />
                  </div>

                  <div className="flex items-center mb-4">
                    <div className="flex-shrink-0">
                      <span className="inline-flex items-center justify-center h-10 w-10 rounded-full bg-gray-200">
                        <span className="text-sm font-medium leading-none text-gray-800">{initials}</span>
                      </span>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-900">
                        {customer ? `${customer.first_name || ""} ${customer.last_name || ""}`.trim() : "Desconocido"}
                      </p>
                      <p className="text-sm text-gray-500">{customer?.email || "Sin email"}</p>
                    </div>
                  </div>

                  {document && (
                    <div className="mb-4 flex items-center text-sm text-gray-500">
                      <svg
                        className="flex-shrink-0 mr-1.5 h-5 w-5 text-gray-400"
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z"
                          clipRule="evenodd"
                        />
                      </svg>
                      {document.file_name}
                    </div>
                  )}

                  <div className="flex justify-between items-center">
                    <div className="flex space-x-4">
                      <Link
                        href={`/documents/${request.id}`}
                        className="inline-flex items-center text-sm font-medium text-gray-700 hover:text-gray-900"
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Ver Detalles
                      </Link>
                      {customer && document && (
                        <ViewSignedDocumentButton 
                          requestId={request.id} 
                          documentId={document.id} 
                          recipientEmail={customer.email} 
                          status={request.status} 
                        />
                      )}
                    </div>
                    <DeleteDocumentButton 
                      requestId={request.id} 
                      title={request.title} 
                      onDeleted={loadRequests}
                    />
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
