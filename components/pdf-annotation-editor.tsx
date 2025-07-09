"use client"

import "@/utils/polyfills"
import type React from "react"

import { useState, useRef, useEffect, useMemo, useCallback } from "react"
import { ChevronLeft, Save, Pen, Type, Trash2, Check, ZoomIn, ZoomOut, Send, X, Plus, Edit3, ChevronRight, Hand, Menu, Settings } from "lucide-react"
import SignatureSelectionModal from "./signature-selection-modal"
import SimpleSignatureCanvas from "./simple-signature-canvas"
import { Logo } from "./logo"
import { useToast } from "@/hooks/use-toast"
import { useIsMobile } from "@/hooks/use-mobile"
import dynamic from 'next/dynamic'
import { NotificationBanner } from "@/components/ui/notification-banner"

// Simple dynamic imports - let Next.js handle the chunking
const Document = dynamic(() => import('react-pdf').then(mod => mod.Document), { 
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  )
})

const PdfPageWithOverlay = dynamic(() => import('./pdf-page-with-overlay'), { 
  ssr: false 
})

// PDF.js options for better compatibility - static object to prevent unnecessary reloads
const PDF_OPTIONS = {
  cMapUrl: 'https://unpkg.com/pdfjs-dist@4.8.69/cmaps/',
  cMapPacked: true,
  standardFontDataUrl: 'https://unpkg.com/pdfjs-dist@4.8.69/standard_fonts/',
  workerSrc: '/pdf.worker.mjs'
} as const

// Early PDF.js worker configuration - runs immediately when module loads
if (typeof window !== 'undefined') {
  // Try to configure PDF.js worker as early as possible
  import('react-pdf').then(({ pdfjs }) => {
    if (!pdfjs.GlobalWorkerOptions.workerSrc) {
      pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.mjs'
      console.log('PDF.js worker configured early:', pdfjs.GlobalWorkerOptions.workerSrc)
    }
  }).catch(() => {
    // Ignore if react-pdf is not available yet
  })
}

export type Annotation = {
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

interface PdfAnnotationEditorProps {
  documentUrl: string
  documentName: string
  documentId: string
  onBack: () => void
  onSave: (annotations: Annotation[]) => Promise<void>
  onSend?: (annotations: Annotation[]) => Promise<void>
  initialAnnotations?: Annotation[]
  token?: string
  readOnly?: boolean
  hideSaveButton?: boolean
  onOpenSidebar?: () => void
  onOpenRightSidebar?: () => void
  mappingMode?: boolean
  previewMode?: boolean
}

export default function PdfAnnotationEditor({
  documentUrl,
  documentName,
  documentId,
  onBack,
  onSave,
  onSend,
  initialAnnotations = [],
  token,
  readOnly = false,
  hideSaveButton = false,
  onOpenSidebar,
  onOpenRightSidebar,
  mappingMode = false,
  previewMode = false,
}: PdfAnnotationEditorProps) {
  const [annotations, setAnnotations] = useState<Annotation[]>(initialAnnotations)
  const [currentTool, setCurrentTool] = useState<"select" | "signature" | "text">("select")
  

  const [showSignatureModal, setShowSignatureModal] = useState(false)
  const [showSimpleCanvas, setShowSimpleCanvas] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)
  const [selectedAnnotation, setSelectedAnnotation] = useState<string | null>(null)
  const [zoomLevel, setZoomLevel] = useState(100)
  const [responsiveScale, setResponsiveScale] = useState(1.4) // Ampliar más el PDF para llenar el contenedor más ancho
  const [numPages, setNumPages] = useState<number>(0)
  const [pendingSignature, setPendingSignature] = useState<{ dataUrl: string; source: 'canvas' | 'wacom'; timestamp: string } | null>(null)
  const [pdfLoadError, setPdfLoadError] = useState<Error | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  
  // Mobile detection
  const isMobile = useIsMobile()

  const [originalSignatures, setOriginalSignatures] = useState<Annotation[]>([]) // Track original signatures from DB
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [showSaveModal, setShowSaveModal] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const documentRef = useRef<HTMLDivElement>(null)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const { toast } = useToast()
  const [showNotification, setShowNotification] = useState(false)
  const [signatureTipDismissed, setSignatureTipDismissed] = useState(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('hideSignatureTip') === 'true'
    }
    return false
  })
  const [pagesDimensions, setPagesDimensions] = useState<Map<number, any>>(new Map())

  // Touch/swipe handling for page navigation
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null)
  const [touchEnd, setTouchEnd] = useState<{ x: number; y: number } | null>(null)

  // Double-tap zoom handling
  const [lastTap, setLastTap] = useState<number>(0)
  const [viewportZoom, setViewportZoom] = useState<number>(1)
  const [zoomOrigin, setZoomOrigin] = useState<{ x: number; y: number }>({ x: 50, y: 50 })

  // Minimum swipe distance (in px)
  const minSwipeDistance = 50

  // Enhanced coordinate conversion system
  const convertRelativeToAbsolute = (annotations: Annotation[]): Annotation[] => {
    return annotations.map(annotation => {
      // Only convert if we have relative coordinates
      if (annotation.relativeX !== undefined && annotation.relativeY !== undefined) {
        // Get the page dimensions for this annotation's page
        const pageDimensions = pagesDimensions.get(annotation.page)
        if (!pageDimensions) {
          console.warn('No page dimensions for page:', annotation.page, 'keeping original coordinates')
          return annotation
        }

        // Convert relative coordinates (0-1 range) to absolute coordinates
        // These are the actual positions on the rendered page
        const absoluteX = annotation.relativeX * pageDimensions.width
        const absoluteY = annotation.relativeY * pageDimensions.height
        
        // Also convert relative dimensions if they don't exist
        let absoluteWidth = annotation.width
        let absoluteHeight = annotation.height
        
        // If the annotation has relative dimensions, use those
        if (annotation.relativeWidth !== undefined && annotation.relativeHeight !== undefined) {
          absoluteWidth = annotation.relativeWidth * pageDimensions.width
          absoluteHeight = annotation.relativeHeight * pageDimensions.height
        }

        console.log('Converting annotation coordinates:', {
          id: annotation.id,
          type: annotation.type,
          page: annotation.page,
          relative: { x: annotation.relativeX, y: annotation.relativeY },
          pageDimensions: { width: pageDimensions.width, height: pageDimensions.height },
          absolute: { x: absoluteX, y: absoluteY },
          dimensions: { width: absoluteWidth, height: absoluteHeight }
        })

        return {
          ...annotation,
          x: absoluteX,
          y: absoluteY,
          width: absoluteWidth,
          height: absoluteHeight
        }
      }
      return annotation
    })
  }

  // Enhanced function to convert absolute coordinates to relative
  const convertAbsoluteToRelative = (annotation: Annotation): Annotation => {
    const pageDimensions = pagesDimensions.get(annotation.page)
    if (!pageDimensions) {
      console.warn('No page dimensions for page:', annotation.page, 'cannot convert to relative coordinates')
      return annotation
    }

    // Convert absolute coordinates to relative (0-1 range)
    const relativeX = annotation.x / pageDimensions.width
    const relativeY = annotation.y / pageDimensions.height
    const relativeWidth = annotation.width / pageDimensions.width
    const relativeHeight = annotation.height / pageDimensions.height

    console.log('Converting to relative coordinates:', {
      id: annotation.id,
      type: annotation.type,
      page: annotation.page,
      absolute: { x: annotation.x, y: annotation.y, width: annotation.width, height: annotation.height },
      pageDimensions: { width: pageDimensions.width, height: pageDimensions.height },
      relative: { x: relativeX, y: relativeY, width: relativeWidth, height: relativeHeight }
    })

    return {
      ...annotation,
      relativeX,
      relativeY,
      relativeWidth,
      relativeHeight
    }
  }

  // Calculate responsive scale based on viewport
  const calculateResponsiveScale = useCallback(() => {
    if (typeof window !== 'undefined') {
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight
      const isMobile = viewportWidth < 1024 // lg breakpoint
      
      if (isMobile) {
        // On mobile, calculate scale to fit the viewport better
        const availableWidth = viewportWidth - 32 // Account for padding
        const availableHeight = viewportHeight - 200 // Account for header and controls
        
        // Standard US Letter size is 8.5 x 11 inches = 612 x 792 points at 72 DPI
        const pdfWidth = 612
        const pdfHeight = 792
        
        // Calculate scale to fit both width and height
        const scaleByWidth = availableWidth / pdfWidth
        const scaleByHeight = availableHeight / pdfHeight
        
        // Use the smaller scale to ensure PDF fits in viewport
        const scale = Math.min(scaleByWidth, scaleByHeight)
        
        // Cap between reasonable limits for mobile
        return Math.max(0.5, Math.min(scale, 2.0))
      } else {
        // On desktop, use standard scale - reduced for better mapping experience
        return 1.0
      }
    }
    return 1.4
  }, [])

  // Store page dimensions when pages load
  const handlePageLoad = (pageNumber: number, pageInfo: any) => {
    console.log('Page loaded:', pageNumber, pageInfo)
    setPagesDimensions(prev => new Map(prev.set(pageNumber, pageInfo)))
    
    // Update responsive scale when first page loads
    if (pageNumber === 1) {
      setResponsiveScale(calculateResponsiveScale())
    }
  }

  // Track initial annotations for conversion - ONLY convert when they actually change
  const [lastProcessedInitialAnnotations, setLastProcessedInitialAnnotations] = useState<string>('')
  const [hasUserAddedAnnotations, setHasUserAddedAnnotations] = useState(false)
  
  useEffect(() => {
    const currentKey = JSON.stringify(initialAnnotations)
    
    // Only process if initial annotations actually changed, we have page dimensions, 
    // AND user hasn't started adding their own annotations
    if (currentKey !== lastProcessedInitialAnnotations && pagesDimensions.size > 0 && !hasUserAddedAnnotations) {
      if (initialAnnotations.length > 0) {
        console.log('🔄 Converting initial annotations:', initialAnnotations.length, 'annotations')
        const convertedAnnotations = convertRelativeToAbsolute(initialAnnotations)
        console.log('✅ Converted initial annotations:', convertedAnnotations.length)
        setAnnotations(convertedAnnotations)
      } else {
        console.log('🧹 No initial annotations, clearing state')
        setAnnotations([])
      }
      
      setLastProcessedInitialAnnotations(currentKey)
      
      // Set original signatures for change tracking
      const signatures = initialAnnotations.filter(a => a.type === 'signature')
      setOriginalSignatures(signatures)
    } else if (hasUserAddedAnnotations) {
      console.log('🚫 Skipping initial annotation conversion - user has added annotations')
    }
  }, [initialAnnotations, pagesDimensions.size, hasUserAddedAnnotations])

  // Add effect to handle window resize and recalculate responsive scale
  useEffect(() => {
    // Set initial responsive scale
    setResponsiveScale(calculateResponsiveScale())
    
    const handleResize = () => {
      const newScale = calculateResponsiveScale()
      setResponsiveScale(newScale)
    }
    
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Add effect to handle goToPage event from sidebar
  useEffect(() => {
    const handleGoToPage = (event: CustomEvent) => {
      const { page } = event.detail
      if (page && page >= 1 && page <= numPages) {
        setCurrentPage(page)
        toast({
          title: `Navegando a página ${page}`,
          description: `Mostrando página ${page} de ${numPages}`,
        })
      }
    }
    
    window.addEventListener('goToPage', handleGoToPage as EventListener)
    return () => window.removeEventListener('goToPage', handleGoToPage as EventListener)
  }, [numPages, toast])

  // Check for signature changes
  const hasSignatureChanges = () => {
    const currentSignatures = annotations.filter(a => a.type === 'signature')
    
    // Check if number of signatures changed
    if (currentSignatures.length !== originalSignatures.length) {
      return true
    }
    
    // Check if any signature was modified
    for (const current of currentSignatures) {
      const original = originalSignatures.find(o => o.id === current.id)
      if (!original) {
        return true // New signature
      }
      
      // Check if position or size changed
      if (
        original.x !== current.x ||
        original.y !== current.y ||
        original.width !== current.width ||
        original.height !== current.height
      ) {
        return true
      }
    }
    
    // Check if any signature was deleted
    for (const original of originalSignatures) {
      if (!currentSignatures.find(c => c.id === original.id)) {
        return true // Signature was deleted
      }
    }
    
    return false
  }

  // Update hasUnsavedChanges when annotations change
  useEffect(() => {
    setHasUnsavedChanges(hasSignatureChanges())
  }, [annotations, originalSignatures])

  // ✅ AUTO-SAVE RESTAURADO Y CORREGIDO
  // Sync annotation changes with parent component (Fast Sign mode only)
  // This only syncs state for UI purposes, doesn't save to database
  const annotationsRef = useRef<Annotation[]>([])
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    // Skip auto-save in mapping mode - only save when user explicitly clicks save
    if (mappingMode) {
      console.log('🗺️ Mapping mode - skipping auto-save')
      annotationsRef.current = annotations
      return
    }
    
    // Only sync if we're in Fast Sign mode (no token)
    if (!token) {
      // Check if annotations actually changed (not just a re-render)
      const hasChanged = JSON.stringify(annotations) !== JSON.stringify(annotationsRef.current)
      
      if (hasChanged) {
        console.log('🔄 PDF Editor: Annotations changed, syncing with parent')
        console.log('📊 Previous annotations:', annotationsRef.current.length)
        console.log('📊 New annotations:', annotations.length)
        console.log('📝 Annotations details:', annotations.map(a => ({ id: a.id, type: a.type, hasImageData: !!a.imageData })))
        
        annotationsRef.current = annotations
        
        // Clear any pending save timeout
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current)
        }
        
        // Debounce the save to prevent multiple rapid saves
        saveTimeoutRef.current = setTimeout(() => {
          // Only save if the component is still mounted and annotations haven't changed again
          if (JSON.stringify(annotations) === JSON.stringify(annotationsRef.current)) {
            console.log('💾 PDF Editor: Syncing annotations to parent component')
            onSave(annotations)
          }
        }, 300) // 300ms debounce
      }
    } else {
      annotationsRef.current = annotations
    }
    
    // Cleanup function
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [annotations, token, onSave, mappingMode])

  // Swipe gesture handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null) // Reset touchEnd
    setTouchStart({
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY
    })
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd({
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY
    })
  }

  const handleTouchEnd = (e?: React.TouchEvent) => {
    // Handle double-tap zoom (mobile only)
    if (e && typeof window !== 'undefined' && window.innerWidth < 1024) {
      const currentTime = new Date().getTime()
      const tapLength = currentTime - lastTap
      
      if (tapLength < 500 && tapLength > 0) {
        // Double tap detected
        const touch = e.changedTouches[0]
        const rect = e.currentTarget.getBoundingClientRect()
        
        // Calculate zoom origin as percentage
        const originX = ((touch.clientX - rect.left) / rect.width) * 100
        const originY = ((touch.clientY - rect.top) / rect.height) * 100
        
        setZoomOrigin({ x: originX, y: originY })
        
        // Toggle between normal and zoomed
        if (viewportZoom === 1) {
          setViewportZoom(1.5) // Zoom in to 150%
        } else {
          setViewportZoom(1) // Zoom out to normal
          setZoomOrigin({ x: 50, y: 50 }) // Reset origin to center
        }
        
        // Prevent swipe handling on double-tap
        setLastTap(currentTime)
        return
      }
      setLastTap(currentTime)
    }

    // Handle swipe navigation (existing logic)
    if (!touchStart || !touchEnd) return
    
    const distanceX = touchStart.x - touchEnd.x
    const distanceY = touchStart.y - touchEnd.y
    const isLeftSwipe = distanceX > minSwipeDistance
    const isRightSwipe = distanceX < -minSwipeDistance
    const isUpSwipe = distanceY > minSwipeDistance
    const isDownSwipe = distanceY < -minSwipeDistance
    const isVerticalSwipe = Math.abs(distanceY) > Math.abs(distanceX)
    
    // Skip navigation if in signature placement mode
    if (currentTool === "signature") return
    
    if (viewportZoom === 1) {
      // Normal zoom: use horizontal swipes for page navigation
      if (!isVerticalSwipe) {
        if (isLeftSwipe && currentPage < (numPages || 1)) {
          setCurrentPage(prev => prev + 1)
        }
        if (isRightSwipe && currentPage > 1) {
          setCurrentPage(prev => prev - 1)
        }
      }
    } else {
      // Zoomed in: use vertical swipes for page navigation
      if (isVerticalSwipe) {
        if (isUpSwipe && currentPage < (numPages || 1)) {
          // Swipe up = next page
          setCurrentPage(prev => prev + 1)
        }
        if (isDownSwipe && currentPage > 1) {
          // Swipe down = previous page
          setCurrentPage(prev => prev - 1)
        }
      }
    }
  }

  // Handle tool selection
  const handleToolChange = (tool: "select" | "signature" | "text") => {
    console.log('🔧 Tool change requested:', tool, { mappingMode, token: !!token })
    
    if (tool === "signature") {
      if (mappingMode) {
        // Mapping mode: directly activate signature placement tool for field creation
        console.log('📍 Mapping mode: activating signature placement tool')
        setCurrentTool("signature")
      } else if (!token) {
        // Fast-sign mode: show full signature modal with Wacom support
        console.log('🎨 Fast-sign mode: showing signature modal')
        setShowSignatureModal(true)
        // currentTool will be set in handleSignatureComplete
      } else {
        // Use simple canvas for authenticated users (with token)
        console.log('🖌️ Authenticated mode: showing simple canvas')
        setShowSimpleCanvas(true)
        setCurrentTool("select") // Keep select tool active until signature is created
      }
    } else {
      setCurrentTool(tool)
    }
    setSelectedAnnotation(null)
  }

  // Load the PDF just to read how many pages it has so we can size the canvas
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        // pdf.js is only needed on the client for counting pages. We load it dynamically in useEffect to avoid
        // Node18 incompatibility (Promise.withResolvers is only in Node20+).
        const pdfModule = await import("react-pdf")
        const pdfjs = pdfModule.pdfjs
        
        // Ensure the Web-Worker path is configured; otherwise pdf.js will try to
        // import "pdf.worker.mjs" which Next cannot resolve in the browser.
        if (pdfjs.GlobalWorkerOptions && (!pdfjs.GlobalWorkerOptions.workerSrc || pdfjs.GlobalWorkerOptions.workerSrc === '')) {
          pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js"
        }
        
        // Ensure worker is properly initialized before loading document
        await new Promise(resolve => setTimeout(resolve, 100))
        
        const loadingTask = pdfjs.getDocument({
          url: documentUrl.split('#')[0],
          cMapUrl: 'https://unpkg.com/pdfjs-dist@4.8.69/cmaps/',
          cMapPacked: true,
          standardFontDataUrl: 'https://unpkg.com/pdfjs-dist@4.8.69/standard_fonts/'
        })
        
        const pdf = await loadingTask.promise
        if (!cancelled) {
          setNumPages(pdf.numPages)
        }
      } catch (err) {
        console.error("Failed to load PDF for page count", err)
        if (!cancelled) {
          // Fallback to 1 page if we can't load the PDF
          setNumPages(1)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [documentUrl])

  // Configure PDF.js worker when component mounts
  useEffect(() => {
    const configurePdfWorker = async () => {
      try {
        // Ensure Promise.withResolvers polyfill is applied
        if (typeof (Promise as any).withResolvers !== "function") {
          const polyfill = function withResolvers<T = any>() {
            let resolveFn: (value: T | PromiseLike<T>) => void
            let rejectFn: (reason?: any) => void
            const promise = new Promise<T>((res, rej) => {
              resolveFn = res
              rejectFn = rej
            })
            return { promise, resolve: resolveFn!, reject: rejectFn! }
          }
          Object.defineProperty(Promise, "withResolvers", {
            value: polyfill,
            writable: true,
            configurable: true,
          })
        }
        
        // Import pdfjs from react-pdf
        const { pdfjs } = await import("react-pdf")
        
        // Configure worker with multiple fallback options
        const workerSources = [
          '/pdf.worker.mjs',
          '/pdf.worker.min.js',
          'https://unpkg.com/pdfjs-dist@4.8.69/build/pdf.worker.mjs',
          '/pdf.worker.js'
        ]
        
        let workerConfigured = false
        for (const workerSrc of workerSources) {
          try {
            // Test if worker source is available
            const response = await fetch(workerSrc, { method: 'HEAD' })
            if (response.ok) {
              pdfjs.GlobalWorkerOptions.workerSrc = workerSrc
              console.log("PDF.js worker configured:", workerSrc)
              workerConfigured = true
              break
            }
          } catch (e) {
            console.warn(`Worker source ${workerSrc} not available:`, e)
          }
        }
        
        if (!workerConfigured) {
          console.warn("No PDF.js worker source available, PDF rendering may fail")
          // Force set to the most likely working option
          pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.mjs'
          console.log("PDF.js worker force-configured to:", pdfjs.GlobalWorkerOptions.workerSrc)
        }
         
      } catch (err) {
        console.error("Failed to configure PDF worker:", err)
        // Fallback configuration
        try {
          const { pdfjs } = await import("react-pdf")
          pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.mjs'
          console.log("PDF.js worker fallback-configured to:", pdfjs.GlobalWorkerOptions.workerSrc)
        } catch (fallbackErr) {
          console.error("Failed to configure PDF worker fallback:", fallbackErr)
        }
      }
    }
    configurePdfWorker()
  }, [])

  // Convert screen coordinates to document-relative coordinates (0-1 range)
  const getDocumentRelativeCoordinates = (e: React.MouseEvent<HTMLDivElement>) => {
    const documentElement = documentRef.current
    if (!documentElement) return null

    const rect = documentElement.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    const pageHeight = rect.height / numPages
    const page = Math.floor(y / pageHeight) + 1

    // Relative within page (0-1)
    const relativeX = x / rect.width
    const relativeY = (y - (page - 1) * pageHeight) / pageHeight

    return { relativeX, relativeY, absoluteX: x, absoluteY: y, page }
  }

  // Convert relative coordinates back to absolute coordinates
  const getAbsoluteCoordinates = (relativeX: number, relativeY: number, page: number = 1) => {
    const documentElement = documentRef.current
    if (!documentElement) return { x: 0, y: 0 }

    const rect = documentElement.getBoundingClientRect()
    const pageHeight = rect.height / numPages
    return {
      x: relativeX * rect.width,
      y: ((page - 1) + relativeY) * pageHeight,
    }
  }

  // Handle container click/touch for placing signatures and text boxes
  const handleContainerInteraction = (pageNumber: number, pageInfo?: any, clientX?: number, clientY?: number) => {
    if (readOnly) {
      return
    }
    
    if (!containerRef.current || !pageInfo) {
      return
    }

    if (currentTool === "signature") {
      const signatureWidth = 120
      const signatureHeight = 60
      
      // Use click position from pageInfo (already in page coordinates)
      const centeredX = pageInfo.clickX - (signatureWidth / 2)
      const centeredY = pageInfo.clickY - (signatureHeight / 2)
      
      // Ensure signature stays within page bounds
      const boundedX = Math.max(0, Math.min(centeredX, pageInfo.width - signatureWidth))
      const boundedY = Math.max(0, Math.min(centeredY, pageInfo.height - signatureHeight))

      if (mappingMode) {
        // MAPPING MODE: Create signature field placeholders (for sent-to-sign)
        const newSignatureField: Annotation = {
          id: crypto.randomUUID(),
          type: "signature",
          x: boundedX,
          y: boundedY,
          width: signatureWidth,
          height: signatureHeight,
          content: `${annotations.filter(a => a.type === "signature").length + 1}`,
          page: pageNumber,
          timestamp: new Date().toISOString(),
          // Calculate relative coordinates
          relativeX: boundedX / pageInfo.width,
          relativeY: boundedY / pageInfo.height,
          relativeWidth: signatureWidth / pageInfo.width,
          relativeHeight: signatureHeight / pageInfo.height
        }

        setAnnotations(prev => [...prev, newSignatureField])
        setSelectedAnnotation(newSignatureField.id)
        setHasUnsavedChanges(true)
        setHasUserAddedAnnotations(true) // Mark user activity
        console.log('📍 Mapping: Added signature field placeholder')
      } else if (pendingSignature) {
        // FAST-SIGN MODE: Place actual signature from pendingSignature
        const newSignature: Annotation = {
          id: crypto.randomUUID(),
          type: "signature",
          x: boundedX,
          y: boundedY,
          width: signatureWidth,
          height: signatureHeight,
          imageData: pendingSignature.dataUrl,
          signatureSource: pendingSignature.source,
          page: pageNumber,
          timestamp: pendingSignature.timestamp,
          // Calculate relative coordinates
          relativeX: boundedX / pageInfo.width,
          relativeY: boundedY / pageInfo.height,
          relativeWidth: signatureWidth / pageInfo.width,
          relativeHeight: signatureHeight / pageInfo.height
        }
        
        // DON'T clear pending signature - allow reuse for multiple placements
        // setPendingSignature(null) // Commented out to allow signature reuse
        
        // Add the new signature to the annotations array
        console.log('📝 Adding signature to annotations:', newSignature.id)
        setAnnotations(prev => {
          const newAnnotations = [...prev, newSignature]
          console.log('📊 Total signatures now:', newAnnotations.filter(a => a.type === 'signature').length)
          return newAnnotations
        })
        
        // Mark that user has added annotations to prevent initial conversion override
        setHasUserAddedAnnotations(true)
        
        // Navigate to the page where the signature was added
        if (pageNumber !== currentPage) {
          setCurrentPage(pageNumber)
        }
        
        // Auto-select the newly added signature
        setSelectedAnnotation(newSignature.id)
        
        setHasUnsavedChanges(true)
        console.log('✅ Signature placed, keeping signature tool active for more signatures')
      } else {
        // NO PENDING SIGNATURE IN FAST-SIGN MODE: Do nothing or show message
        console.warn('⚠️ No pending signature available for placement')
        toast({
          title: "No signature to place",
          description: "Please create a signature first by clicking 'Añadir Firma'",
          duration: 3000,
        })
        return
      }
    } else if (currentTool === "text") {
      const textWidth = 200
      const textHeight = 50
      
      // Use click position from pageInfo (already in page coordinates)
      const centeredX = pageInfo.clickX - (textWidth / 2)
      const centeredY = pageInfo.clickY - (textHeight / 2)
      
      // Ensure text box stays within page bounds
      const boundedX = Math.max(0, Math.min(centeredX, pageInfo.width - textWidth))
      const boundedY = Math.max(0, Math.min(centeredY, pageInfo.height - textHeight))

      const newTextBox: Annotation = {
        id: crypto.randomUUID(),
        type: "text",
        x: boundedX,
        y: boundedY,
        width: textWidth,
        height: textHeight,
        content: "",
        page: pageNumber,
        timestamp: new Date().toISOString(),
        // Calculate relative coordinates
        relativeX: boundedX / pageInfo.width,
        relativeY: boundedY / pageInfo.height,
        relativeWidth: textWidth / pageInfo.width,
        relativeHeight: textHeight / pageInfo.height
      }



      setAnnotations(prev => {
        const newAnnotations = [...prev, newTextBox]
        
        // State will be synced with parent via useEffect
        
        return newAnnotations
      })
      
      setHasUnsavedChanges(true)
      setHasUserAddedAnnotations(true) // Mark user activity
    }
  }

  // Legacy mouse handler for backward compatibility
  const handleContainerClick = (e: React.MouseEvent<Element>, pageNumber: number, pageInfo?: any) => {
    handleContainerInteraction(pageNumber, pageInfo, e.clientX, e.clientY)
  }

  // Touch handler for mobile devices
  const handleContainerTouch = (e: React.TouchEvent<Element>, pageNumber: number, pageInfo?: any) => {
    e.preventDefault() // Prevent default touch behavior
    const touch = e.touches[0] || e.changedTouches[0]
    if (touch) {
      handleContainerInteraction(pageNumber, pageInfo, touch.clientX, touch.clientY)
    }
  }

  // Handle signature completion
  const handleSignatureComplete = (dataUrl: string, source: 'canvas' | 'wacom') => {
    console.log('🖊️ Signature completed:', { dataUrl: !!dataUrl, source })
    setShowSignatureModal(false)

    if (!dataUrl) return

    // Store the signature and show placement instruction
    setPendingSignature({ 
      dataUrl, 
      source,
      timestamp: new Date().toISOString()
    })

    console.log('🎯 Setting currentTool to signature for placement')
    setCurrentTool("signature") // Activate signature placement tool
    
    // Show notification to guide user
    setShowNotification(true)
  }

  // Clear pending signature (allow user to change signature)
  const handleClearPendingSignature = () => {
    setPendingSignature(null)
    setCurrentTool("select")
    setShowNotification(false)
    console.log('🧹 Cleared pending signature')
  }

  // Handle simple canvas completion (for unauthenticated users)
  const handleSimpleCanvasComplete = (dataUrl: string) => {
    console.log('🖊️ Simple canvas completed:', { dataUrl: !!dataUrl })
    setShowSimpleCanvas(false)

    if (!dataUrl) return

    // Store the signature and show placement instruction
    setPendingSignature({ 
      dataUrl, 
      source: 'canvas',
      timestamp: new Date().toISOString()
    })

    console.log('🎯 Setting currentTool to signature for placement')
    setCurrentTool("signature") // Activate signature placement tool
    
    // Show notification to guide user
    setShowNotification(true)
  }

  // Auto-save signature when placed
  const saveSignatureToDatabase = async (signature: Annotation) => {
    // Skip database operations for Fast Sign (when no token is provided)
    if (!token) {
      setLastSaved(new Date())
      return
    }

    try {
      // Save ONLY to document_signatures table
      const signatureResponse = await fetch(`/api/documents/${documentId}/signature`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          signatureDataUrl: signature.imageData,
          signatureSource: signature.signatureSource || 'canvas',
          token: token,
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
        throw new Error("Failed to save signature to database")
      }

      const result = await signatureResponse.json()
      
      // Update the signature ID with the one from the database
      if (result.signature?.id) {
        setAnnotations(prevAnnotations => 
          prevAnnotations.map(ann => 
            ann.id === signature.id ? { ...ann, id: result.signature.id } : ann
          )
        )
      }

      // Remove success toast
      setLastSaved(new Date())
    } catch (error) {
      console.error("Error saving signature:", error)
      // Keep error toast for failures
      toast({
        title: "Failed to save signature",
        description: "There was an error saving your signature. Please try again.",
        duration: 5000,
        variant: "destructive"
      })
      throw error
    }
  }

  // Update signature position/size in database
  const updateSignatureInDatabase = async (signature: Annotation) => {
    // Skip database operations for Fast Sign (when no token is provided)
    if (!token) return
    
    try {
      const response = await fetch(`/api/documents/${documentId}/signature`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          signatureId: signature.id,
          token: token,
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

      if (!response.ok) {
        throw new Error("Failed to update signature position")
      }

      // Remove success toast
    } catch (error) {
      console.error("Error updating signature position:", error)
      // Keep error toast for failures
      toast({
        title: "Failed to update signature",
        description: "An error occurred while updating the signature position.",
        duration: 5000,
        variant: "destructive"
      })
    }
  }

  // Delete signature from database
  const deleteSignatureFromDatabase = async (signatureId: string) => {
    // Skip database operations for Fast Sign (when no token is provided)
    if (!token) return
    
    try {
      const response = await fetch(`/api/documents/${documentId}/signature`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          signatureId: signatureId,
          token: token
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to delete signature")
      }

      // Remove success toast
    } catch (error) {
      console.error("Error deleting signature:", error)
      // Keep error toast for failures
      toast({
        title: "Failed to delete signature",
        description: "An error occurred while deleting the signature.",
        duration: 5000,
        variant: "destructive"
      })
    }
  }

  // Sync signatures with database
  const syncSignaturesWithDatabase = async () => {
    // Skip database operations for Fast Sign (when no token is provided)
    if (!token) {
      // For Fast Sign, just update the local state
      setOriginalSignatures([...annotations.filter(a => a.type === 'signature')])
      setHasUnsavedChanges(false)
      return
    }

    const currentSignatures = annotations.filter(a => a.type === 'signature')
    
    try {
      // 1. Handle deleted signatures
      for (const original of originalSignatures) {
        const stillExists = currentSignatures.find(c => c.id === original.id)
        if (!stillExists) {
          await deleteSignatureFromDatabase(original.id)
        }
      }

      // 2. Handle new and updated signatures
      for (const current of currentSignatures) {
        const original = originalSignatures.find(o => o.id === current.id)
        
        if (!original) {
          // New signature - save it
          await saveSignatureToDatabase(current)
        } else {
          // Check if signature was modified
          if (
            original.x !== current.x ||
            original.y !== current.y ||
            original.width !== current.width ||
            original.height !== current.height ||
            original.page !== current.page
          ) {
            // Updated signature - update it
            await updateSignatureInDatabase(current)
          }
        }
      }

      // 3. Update the original signatures to current state
      setOriginalSignatures([...currentSignatures])
      setHasUnsavedChanges(false)

      // Remove success toast
      
    } catch (error) {
      console.error("Error syncing signatures:", error)
      // Keep error toast for failures
      toast({
        title: "Failed to save changes",
        description: "An error occurred while saving some changes. Please try again.",
        duration: 5000,
        variant: "destructive"
      })
      throw error
    }
  }

  // Handle annotation drag
  const handleAnnotationDrag = (id: string, newX: number, newY: number) => {
    setAnnotations(prev => {
      const newAnnotations = prev.map(ann => {
        if (ann.id === id) {
          // Get the page dimensions for proper coordinate conversion
          const pageDimensions = pagesDimensions.get(ann.page)
          if (!pageDimensions) {
            console.warn('No page dimensions for drag operation, keeping original coordinates')
            return { ...ann, x: newX, y: newY }
          }
          
          // Ensure the annotation stays within page bounds
          const boundedX = Math.max(0, Math.min(newX, pageDimensions.width - ann.width))
          const boundedY = Math.max(0, Math.min(newY, pageDimensions.height - ann.height))
          
          // Calculate new relative coordinates
          const relativeX = boundedX / pageDimensions.width
          const relativeY = boundedY / pageDimensions.height
          
          console.log('Dragging annotation:', {
            id: ann.id,
            page: ann.page,
            oldPosition: { x: ann.x, y: ann.y },
            newPosition: { x: boundedX, y: boundedY },
            relative: { x: relativeX, y: relativeY },
            pageDimensions: { width: pageDimensions.width, height: pageDimensions.height }
          })
          
          return { 
            ...ann, 
            x: boundedX, 
            y: boundedY,
            relativeX,
            relativeY
          }
        }
        return ann
      })
      
      return newAnnotations
    })
    setHasUnsavedChanges(true)
  }

  // Handle annotation resize
  const handleAnnotationResize = (id: string, newWidth: number, newHeight: number) => {
    setAnnotations(prev => {
      const newAnnotations = prev.map(ann => {
        if (ann.id === id) {
          // Get the page dimensions for proper coordinate conversion
          const pageDimensions = pagesDimensions.get(ann.page)
          if (!pageDimensions) {
            console.warn('No page dimensions for resize operation, keeping original size')
            return { ...ann, width: newWidth, height: newHeight }
          }
          
          // Ensure the annotation doesn't exceed page bounds
          const maxWidth = pageDimensions.width - ann.x
          const maxHeight = pageDimensions.height - ann.y
          const boundedWidth = Math.max(50, Math.min(newWidth, maxWidth)) // Minimum 50px width
          const boundedHeight = Math.max(30, Math.min(newHeight, maxHeight)) // Minimum 30px height
          
          // Calculate new relative dimensions
          const relativeWidth = boundedWidth / pageDimensions.width
          const relativeHeight = boundedHeight / pageDimensions.height
          
          console.log('Resizing annotation:', {
            id: ann.id,
            page: ann.page,
            oldSize: { width: ann.width, height: ann.height },
            newSize: { width: boundedWidth, height: boundedHeight },
            relative: { width: relativeWidth, height: relativeHeight },
            pageDimensions: { width: pageDimensions.width, height: pageDimensions.height }
          })
          
          return { 
            ...ann, 
            width: boundedWidth, 
            height: boundedHeight,
            relativeWidth,
            relativeHeight
          }
        }
        return ann
      })
      
      return newAnnotations
    })
    setHasUnsavedChanges(true) 
  }

  // Handle annotation content change
  const handleAnnotationContentChange = (id: string, content: string) => {
    const newAnnotations = annotations.map((annotation) => (annotation.id === id ? { ...annotation, content } : annotation))
    setAnnotations(newAnnotations)
    
    // For Fast Sign mode (no token), just update local state
    // Don't call onSave here - signatures should only be saved when user clicks "Update Document"
  }

  // Handle annotation delete
  const handleAnnotationDelete = (id: string) => {
    console.log('🗑️ PDF Editor: Deleting annotation:', id)
    const annotationToDelete = annotations.find(a => a.id === id)
    console.log('🗑️ PDF Editor: Annotation being deleted:', {
      id: annotationToDelete?.id,
      type: annotationToDelete?.type,
      page: annotationToDelete?.page
    })
    const newAnnotations = annotations.filter((annotation) => annotation.id !== id)
    console.log('📝 PDF Editor: Annotations after deletion:', newAnnotations.length, 'remaining')
    console.log('📝 PDF Editor: Remaining annotation IDs:', newAnnotations.map(a => a.id))
    setAnnotations(newAnnotations)
    setSelectedAnnotation(null)

    // State will be synced with parent via useEffect (Fast Sign mode)
    // For regular mode (with token), don't auto-delete from database - wait for user to save

    setHasUnsavedChanges(true)
  }

  // Handle zoom
  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev + 25, 200))
  }

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev - 25, 50))
  }

  // Handle save
  const handleSaveAnnotations = async () => {
    if (!hasUnsavedChanges) return
    
    try {
      setSaving(true)
      await onSave(annotations)
      setHasUnsavedChanges(false)
      setLastSaved(new Date())
      // Remove toast notification
    } catch (error) {
      console.error("Error saving annotations:", error)
      // Only show error toast
      toast({
        title: "Failed to save",
        description: "We couldn't save your changes. Please try again.",
        duration: 5000,
      })
    } finally {
      setSaving(false)
    }
  }

  // Handle send document
  const handleSendDocument = async () => {
    if (!onSend || hasUnsavedChanges) return
    
    try {
      setSending(true)
      await onSend(annotations)
      // Remove toast notification - the redirect to completion page is enough feedback
    } catch (error) {
      console.error("Error sending document:", error)
      // Only show error toast
      toast({
        title: "Failed to send",
        description: "We couldn't send your document. Please try again.",
        duration: 5000,
      })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: '#F8F9FB' }}>
      {/* Notification Banner */}
      {showNotification && currentTool === "signature" && (
        <NotificationBanner onClose={() => setShowNotification(false)}>
          Click anywhere on the document to place your signature
        </NotificationBanner>
      )}

      {/* Signature Management Tip */}
      {annotations.some(a => a.type === 'signature') && !selectedAnnotation && !showNotification && !signatureTipDismissed && (
        <NotificationBanner 
          onClose={() => {
            // Set a flag to not show this tip again in this session
            sessionStorage.setItem('hideSignatureTip', 'true')
            setSignatureTipDismissed(true)
          }}
        >
          💡 Tip: Click on a signature to select it, then click the red ❌ button to delete it
        </NotificationBanner>
      )}

      {/* Main toolbar */}
      <div 
        className="border-b border-border py-2 lg:py-3 px-2 lg:px-6" 
        style={{ 
          backgroundColor: '#FFFFFF' // --topbar
        }}
      >
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          {/* Left section - Document name (mobile: smaller, desktop: with logo) */}
          <div className="flex items-center space-x-1 lg:space-x-3 min-w-0 flex-1 lg:flex-none">
            <Logo className="hidden lg:block h-8 w-8 flex-shrink-0" color="#0d2340" />
            <span className="text-sm lg:text-base font-medium text-foreground truncate max-w-[150px] sm:max-w-[200px] lg:max-w-[300px]">
              {previewMode ? "Template Preview" : documentName}
            </span>
          </div>

          {/* Center section - Page navigation (desktop only) */}
          <div className="hidden lg:flex items-center space-x-6">
            {/* Page Navigation */}
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="p-2 rounded-lg text-foreground hover:bg-muted disabled:opacity-50 transition-colors"
                title="Previous Page"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div className="flex items-center bg-background border border-border rounded-lg px-3 py-2">
                <input
                  type="number"
                  value={currentPage}
                  onChange={(e) => {
                    const page = parseInt(e.target.value)
                    if (page > 0 && page <= numPages) {
                      setCurrentPage(page)
                    }
                  }}
                  className="w-12 text-center text-sm bg-transparent text-foreground focus:outline-none"
                />
                <span className="text-sm text-muted-foreground ml-1">/ {numPages || 1}</span>
              </div>
              <button
                onClick={() => setCurrentPage(p => Math.min(numPages || 1, p + 1))}
                disabled={currentPage >= (numPages || 1)}
                className="p-2 rounded-lg text-foreground hover:bg-muted disabled:opacity-50 transition-colors"
                title="Next Page"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Desktop Actions */}
            <div className="flex items-center space-x-2">
              {/* Add Signature Button - Hidden in preview mode */}
              {!previewMode && (
                <button
                  onClick={() => {
                    console.log('🖱️ FAST-SIGN: Desktop "Añadir Firma" button clicked!')
                    console.log('🖱️ FAST-SIGN: Current state before click:', {
                      currentTool,
                      showSignatureModal,
                      pendingSignature: !!pendingSignature,
                      token: !!token,
                      mappingMode
                    })
                    handleToolChange("signature")
                  }}
                  className={`flex items-center px-4 py-2 rounded-lg font-medium transition-colors ${
                    currentTool === "signature" || showSignatureModal || showSimpleCanvas
                      ? "bg-primary text-primary-foreground"
                      : "bg-blue-600 text-white hover:bg-blue-700"
                  }`}
                >
                  <Pen className="h-4 w-4 mr-2" />
                  {mappingMode ? "Add Field" : "Añadir Firma"}
                </button>
              )}
              
              
              {!hideSaveButton && !previewMode && (
                <button
                  onClick={handleSaveAnnotations}
                  disabled={saving || (mappingMode ? annotations.filter(a => a.type === "signature").length === 0 : !hasUnsavedChanges)}
                  className="flex items-center px-4 py-2 bg-muted text-foreground rounded-lg hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {mappingMode ? "Save Mapping" : "Save"}
                </button>
              )}
              {onSend && !previewMode && (
                <button
                  onClick={handleSendDocument}
                  disabled={sending || hasUnsavedChanges}
                  className="flex items-center px-4 py-2 bg-success text-success-foreground rounded-lg hover:bg-success/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Send className="h-4 w-4 mr-2" />
                  Send
                </button>
              )}
            </div>
          </div>

          {/* Right section - Mobile controls */}
          <div className="flex items-center space-x-2">
            {/* Mobile save button - Hidden in preview mode */}
            {!hideSaveButton && !previewMode && (
              <button
                onClick={handleSaveAnnotations}
                disabled={saving || (mappingMode ? annotations.filter(a => a.type === "signature").length === 0 : !hasUnsavedChanges)}
                className="lg:hidden flex items-center justify-center w-8 h-8 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title={saving ? "Saving..." : mappingMode ? "Save Mapping" : "Save"}
              >
                <Save className="h-4 w-4" />
              </button>
            )}
            
            {/* Mobile page indicator */}
            <div className="lg:hidden flex items-center bg-background border border-border rounded-lg px-2 py-1">
              <span className="text-xs text-foreground">{currentPage}/{numPages || 1}</span>
            </div>
            

          </div>
        </div>
      </div>

      {/* Mobile bottom toolbar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-border px-4 py-3 safe-area-pb">
        <div className="flex flex-col space-y-2">
          {/* Swipe instruction */}
          <div className="text-center">
            <p className="text-xs text-muted-foreground">
              {previewMode ? `Template Preview - Page ${currentPage}/${numPages || 1}` : `Swipe left/right to navigate pages (${currentPage}/${numPages || 1})`}
            </p>
          </div>
          


          {/* Main controls */}
          <div className={`flex items-center ${previewMode ? 'justify-center' : 'justify-between'}`}>
            {/* Left - Menu/Sidebar button - Only show on mobile screens */}
            {!previewMode && (
              <button
                onClick={onOpenSidebar}
                className="md:hidden flex items-center justify-center w-12 h-12 bg-white border border-gray-300 text-gray-700 rounded-full shadow-sm hover:shadow-md hover:border-gray-400 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
                title="Menu"
              >
                <Menu className="h-5 w-5" />
              </button>
            )}

            {/* Center - Add Signature - Hidden in preview mode */}
            {!previewMode && (
              <button
                onClick={() => handleToolChange("signature")}
                className={`flex items-center px-6 py-3 rounded-lg font-medium transition-colors ${
                  currentTool === "signature" || showSignatureModal || showSimpleCanvas
                    ? "bg-primary text-primary-foreground"
                    : "bg-blue-600 text-white hover:bg-blue-700"
                }`}
              >
                <Pen className="h-5 w-5 mr-2" />
                {mappingMode ? "Add Field" : "Añadir Firma"}
              </button>
            )}

            {/* Preview mode - Show only page navigation */}
            {previewMode && (
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  className="p-3 rounded-lg text-foreground hover:bg-muted disabled:opacity-50 transition-colors bg-white border border-border"
                  title="Previous Page"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <div className="flex items-center bg-white border border-border rounded-lg px-4 py-2">
                  <input
                    type="number"
                    value={currentPage}
                    onChange={(e) => {
                      const page = parseInt(e.target.value)
                      if (page > 0 && page <= numPages) {
                        setCurrentPage(page)
                      }
                    }}
                    className="w-12 text-center text-sm bg-transparent text-foreground focus:outline-none"
                  />
                  <span className="text-sm text-muted-foreground ml-1">/ {numPages || 1}</span>
                </div>
                <button
                  onClick={() => setCurrentPage(p => Math.min(numPages || 1, p + 1))}
                  disabled={currentPage >= (numPages || 1)}
                  className="p-3 rounded-lg text-foreground hover:bg-muted disabled:opacity-50 transition-colors bg-white border border-border"
                  title="Next Page"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            )}

            {/* Right - Toggle Right Sidebar - Hidden in preview mode */}
            {!previewMode && (
              <button
                onClick={onOpenRightSidebar}
                className="flex items-center justify-center w-12 h-12 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                title="Actions"
              >
                <Edit3 className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Document Viewer */}
      <div 
        className="flex-1 overflow-auto pb-20 lg:pb-0"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          transform: `scale(${viewportZoom})`,
          transformOrigin: `${zoomOrigin.x}% ${zoomOrigin.y}%`,
          transition: 'transform 0.3s ease-out'
        }}
      >
        <div className={`min-h-full flex justify-center ${isMobile ? 'py-2 px-1' : 'py-4 px-2 lg:px-4'}`}>
          <div
            ref={containerRef}
            className={`relative bg-white shadow-lg ${
              isMobile 
                ? 'w-full max-w-[100vw] mx-auto' 
                : 'w-full max-w-[98vw] lg:max-w-none'
            }`}
            style={{ 
              cursor: currentTool === "signature" ? "crosshair" : "default",
              width: "100%",
              ...(isMobile && {
                overflow: 'visible',
                minHeight: 'fit-content'
              })
            }}
          >
            <Document
              file={documentUrl}
              onLoadSuccess={({ numPages }) => {
                setNumPages(numPages)
                setIsLoading(false)
                setPdfLoadError(null)
                console.log("PDF loaded successfully with", numPages, "pages")
              }}
              onLoadError={(error) => {
                console.error("PDF load error:", error)
                setPdfLoadError(error)
                setIsLoading(false)
                // Try to recover by setting a fallback page count
                setNumPages(1)
                toast({
                  title: "PDF Loading Error",
                  description: "There was an issue loading the PDF. Some features may be limited.",
                  variant: "destructive"
                })
              }}
              options={PDF_OPTIONS}
              loading={
                <div className="flex items-center justify-center min-h-[50vh] w-full max-w-full">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading PDF document...</p>
                  </div>
                </div>
              }
              error={
                <div className="flex flex-col items-center justify-center min-h-[50vh] w-full max-w-full bg-gray-50 border-2 border-dashed border-gray-300">
                  <div className="text-center p-4 lg:p-8">
                    <div className="text-red-500 text-4xl lg:text-6xl mb-4">⚠️</div>
                    <h3 className="text-base lg:text-lg font-semibold text-gray-900 mb-2">PDF Loading Failed</h3>
                    <p className="text-sm lg:text-base text-gray-600 mb-4">
                      Unable to load the PDF document. This might be due to:
                    </p>
                    <ul className="text-xs lg:text-sm text-gray-500 text-left mb-6">
                      <li>• Network connectivity issues</li>
                      <li>• PDF file corruption</li>
                      <li>• Browser compatibility</li>
                      <li>• PDF.js worker not available</li>
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
                        Reload Page
                      </button>
                      <button
                        onClick={onBack}
                        className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm"
                      >
                        Go Back
                      </button>
                    </div>
                  </div>
                </div>
              }
            >
              {!isLoading && !pdfLoadError && numPages > 0 ? (
                <PdfPageWithOverlay
                  pageNumber={currentPage}
                  scale={responsiveScale}
                  annotations={annotations.filter(a => a.page === currentPage)}
                  onClick={(e, pageNumber, pageInfo) => {
                    if (pageInfo) {
                      handlePageLoad(pageNumber, pageInfo)
                    }
                    handleContainerClick(e, pageNumber, pageInfo)
                  }}
                  onTouch={(e, pageNumber, pageInfo) => {
                    if (pageInfo) {
                      handlePageLoad(pageNumber, pageInfo)
                    }
                    handleContainerTouch(e, pageNumber, pageInfo)
                  }}
                >
                  {annotations
                    .filter(a => a.page === currentPage)
                    .map(annotation => (
                      <div key={annotation.id} className="pointer-events-auto">
                        <DraggableAnnotation
                          annotation={annotation}
                          isSelected={selectedAnnotation === annotation.id}
                          onSelect={() => {
                            setSelectedAnnotation(annotation.id)
                            setCurrentTool("select")
                          }}
                          onDrag={handleAnnotationDrag}
                          onResize={handleAnnotationResize}
                          onContentChange={handleAnnotationContentChange}
                          onDelete={handleAnnotationDelete}
                          readOnly={readOnly}
                        />
                      </div>
                    ))}
                </PdfPageWithOverlay>
              ) : isLoading ? (
                <div className="flex items-center justify-center min-h-[50vh] w-full max-w-full bg-gray-50">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Initializing PDF viewer...</p>
                  </div>
                </div>
              ) : pdfLoadError ? (
                <div className="flex items-center justify-center min-h-[50vh] w-full max-w-full bg-red-50 border-2 border-red-200">
                  <div className="text-center p-4 lg:p-6">
                    <div className="text-red-500 text-3xl lg:text-4xl mb-4">❌</div>
                    <h3 className="text-base lg:text-lg font-semibold text-red-900 mb-2">PDF Error</h3>
                    <p className="text-red-700 text-xs lg:text-sm mb-4">
                      {pdfLoadError.message || "Failed to load PDF document"}
                    </p>
                    <button
                      onClick={() => {
                        setIsLoading(true)
                        setPdfLoadError(null)
                        window.location.reload()
                      }}
                      className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                    >
                      Retry
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center min-h-[50vh] w-full max-w-[90vw] lg:w-[8.5in] lg:h-[11in] bg-gray-50">
                  <div className="text-center">
                    <p className="text-gray-600">No PDF pages available</p>
                  </div>
                </div>
              )}
            </Document>
          </div>
        </div>
      </div>

      {/* Signature Selection Modal */}
      <SignatureSelectionModal
        isOpen={showSignatureModal}
        onClose={() => setShowSignatureModal(false)}
        onComplete={handleSignatureComplete}
      />

      {/* Simple Signature Canvas for unauthenticated users */}
      <SimpleSignatureCanvas
        isOpen={showSimpleCanvas}
        onClose={() => setShowSimpleCanvas(false)}
        onComplete={handleSimpleCanvasComplete}
      />
    </div>
  )
}

// Draggable annotation component
interface DraggableAnnotationProps {
  annotation: Annotation
  isSelected: boolean
  onSelect: () => void
  onDrag: (id: string, x: number, y: number) => void
  onResize: (id: string, width: number, height: number) => void
  onContentChange: (id: string, content: string) => void
  onDelete: (id: string) => void
  readOnly?: boolean
}

function DraggableAnnotation({
  annotation,
  isSelected,
  onSelect,
  onDrag,
  onResize,
  onContentChange,
  onDelete,
  readOnly = false,
}: DraggableAnnotationProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [position, setPosition] = useState({ x: annotation.x, y: annotation.y })
  const [size, setSize] = useState({ width: annotation.width, height: annotation.height })

  // Update position and size when annotation changes
  useEffect(() => {
    setPosition({ x: annotation.x, y: annotation.y })
    setSize({ width: annotation.width, height: annotation.height })
  }, [annotation])

  // Unified handler for mouse and touch start events for dragging
  const handleDragStart = (clientX: number, clientY: number, e: React.MouseEvent | React.TouchEvent) => {
    if (readOnly) return
    e.stopPropagation()
    onSelect()
    setIsDragging(true)
    setDragStart({ x: clientX - position.x, y: clientY - position.y })
  }

  // Unified handler for mouse and touch start events for resizing
  const handleResizeStart = (clientX: number, clientY: number, e: React.MouseEvent | React.TouchEvent) => {
    if (readOnly) return
    e.stopPropagation()
    onSelect()
    setIsResizing(true)
    setDragStart({ x: clientX, y: clientY })
  }

  // Handle mouse down for dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    handleDragStart(e.clientX, e.clientY, e)
  }

  // Handle touch start for dragging
  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault() // Prevent default touch behavior
    const touch = e.touches[0]
    if (touch) {
      handleDragStart(touch.clientX, touch.clientY, e)
    }
  }

  // Handle mouse down for resizing
  const handleResizeMouseDown = (e: React.MouseEvent) => {
    handleResizeStart(e.clientX, e.clientY, e)
  }

  // Handle touch start for resizing
  const handleResizeTouchStart = (e: React.TouchEvent) => {
    e.preventDefault() // Prevent default touch behavior
    const touch = e.touches[0]
    if (touch) {
      handleResizeStart(touch.clientX, touch.clientY, e)
    }
  }

  // Handle mouse and touch move/end events
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const newX = e.clientX - dragStart.x
        const newY = e.clientY - dragStart.y
        setPosition({ x: newX, y: newY })
      } else if (isResizing) {
        const dx = e.clientX - dragStart.x
        const dy = e.clientY - dragStart.y
        setSize({
          width: Math.max(50, size.width + dx),
          height: Math.max(20, size.height + dy),
        })
        setDragStart({ x: e.clientX, y: e.clientY })
      }
    }

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault() // Prevent scrolling while dragging
      const touch = e.touches[0]
      if (!touch) return

      if (isDragging) {
        const newX = touch.clientX - dragStart.x
        const newY = touch.clientY - dragStart.y
        setPosition({ x: newX, y: newY })
      } else if (isResizing) {
        const dx = touch.clientX - dragStart.x
        const dy = touch.clientY - dragStart.y
        setSize({
          width: Math.max(50, size.width + dx),
          height: Math.max(20, size.height + dy),
        })
        setDragStart({ x: touch.clientX, y: touch.clientY })
      }
    }

    const handleEnd = () => {
      if (isDragging) {
        onDrag(annotation.id, position.x, position.y)
      } else if (isResizing) {
        onResize(annotation.id, size.width, size.height)
      }
      setIsDragging(false)
      setIsResizing(false)
    }

    if (isDragging || isResizing) {
      // Mouse events
      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleEnd)
      
      // Touch events
      document.addEventListener("touchmove", handleTouchMove, { passive: false })
      document.addEventListener("touchend", handleEnd)
      document.addEventListener("touchcancel", handleEnd)
    }

    return () => {
      // Mouse events
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleEnd)
      
      // Touch events
      document.removeEventListener("touchmove", handleTouchMove)
      document.removeEventListener("touchend", handleEnd)
      document.removeEventListener("touchcancel", handleEnd)
    }
  }, [isDragging, isResizing, dragStart, position, size, annotation.id, onDrag, onResize])

  return (
    <div
      className={`absolute border-2 ${
        isSelected 
          ? "border-blue-500" 
          : annotation.type === "signature" 
            ? "border-blue-200 hover:border-blue-400" 
            : "border-transparent"
      } touch-none ${annotation.type === "signature" ? "cursor-pointer" : ""}`}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${size.width}px`,
        height: `${size.height}px`,
        cursor: readOnly ? "default" : (isDragging ? "grabbing" : annotation.type === "signature" ? "pointer" : "grab"),
        zIndex: isSelected ? 30 : 25,
        pointerEvents: "auto",
      }}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      onClick={(e) => {
        e.stopPropagation()
        // Auto-select signature when clicked (especially useful for signatures)
        if (!isSelected && annotation.type === "signature") {
          onSelect()
        }
      }}
    >
      {annotation.type === "text" ? (
        <textarea
          className="w-full h-full p-2 resize-none border-none focus:outline-none focus:ring-0"
          value={annotation.content || ""}
          onChange={(e) => readOnly ? undefined : onContentChange(annotation.id, e.target.value)}
          placeholder={readOnly ? "" : "Enter text here..."}
          onClick={(e) => e.stopPropagation()}
          readOnly={readOnly}
        />
      ) : annotation.type === "signature" ? (
        annotation.imageData ? (
          <img
            src={annotation.imageData}
            alt="Signature"
            className="w-full h-full object-contain pointer-events-none"
            draggable={false}
          />
        ) : (
          // Show pulsing blue dot for signature mapping mode
          <div className="w-full h-full flex items-center justify-center relative">
            {/* Pulsing blue dot */}
            <div className="relative">
              {/* Main dot */}
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center shadow-lg">
                <div className="w-3 h-3 bg-white rounded-full"></div>
              </div>
              {/* Pulsing rings */}
              <div className="absolute inset-0 w-8 h-8 bg-blue-400 rounded-full animate-ping opacity-75"></div>
              <div className="absolute inset-0 w-8 h-8 bg-blue-300 rounded-full animate-pulse opacity-50"></div>
            </div>
            {/* Optional label */}
            <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 text-xs text-blue-600 font-medium whitespace-nowrap">
              Signature {annotation.content || ""}
            </div>
          </div>
        )
      ) : null}

      {isSelected && !readOnly && (
        <>
          <div
            className="absolute bottom-right w-8 h-8 bg-blue-500 rounded-full cursor-se-resize -right-4 -bottom-4 flex items-center justify-center touch-none"
            onMouseDown={handleResizeMouseDown}
            onTouchStart={handleResizeTouchStart}
          >
            <div className="w-2 h-2 bg-white rounded-full" />
          </div>
          <button
            className="absolute -top-4 -right-4 bg-red-500 hover:bg-red-600 text-white rounded-full w-8 h-8 flex items-center justify-center touch-none shadow-lg transition-colors duration-200 z-50"
            onClick={(e) => {
              e.stopPropagation()
              onDelete(annotation.id)
            }}
            title="Delete signature"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </>
      )}
    </div>
  )
}
