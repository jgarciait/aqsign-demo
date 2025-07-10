"use client"

import { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface PdfResponsiveContainerProps {
  children: ReactNode
  className?: string
  wrapperClassName?: string
  contentClassName?: string
  style?: React.CSSProperties
  onTouchStart?: (e: React.TouchEvent) => void
  onTouchMove?: (e: React.TouchEvent) => void
  onTouchEnd?: (e: React.TouchEvent) => void
}

interface PdfLoadingContainerProps {
  children: ReactNode
  className?: string
  stage?: string
  showSpinner?: boolean
}

interface PdfErrorContainerProps {
  children: ReactNode
  className?: string
  error?: string | Error
  onRetry?: () => void
  showRetryButton?: boolean
}

/**
 * Responsive container for PDF documents with optimized scroll and layout behavior
 */
export function PdfResponsiveContainer({
  children,
  className,
  wrapperClassName,
  contentClassName,
  style,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
}: PdfResponsiveContainerProps) {
  return (
    <div 
      className={cn("pdf-document-container", className)}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      style={style}
    >
      <div className={cn("pdf-document-wrapper", wrapperClassName)}>
        <div className={cn("pdf-document-content pdf-auto-fit", contentClassName)}>
          {children}
        </div>
      </div>
    </div>
  )
}

/**
 * Loading container for PDF documents with consistent styling
 */
export function PdfLoadingContainer({
  children,
  className,
  stage,
  showSpinner = true,
}: PdfLoadingContainerProps) {
  return (
    <div className={cn("pdf-loading-container", className)}>
      <div className="text-center">
        {showSpinner && (
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        )}
        {stage && (
          <p className="text-gray-600 mb-2">{stage}</p>
        )}
        {children}
      </div>
    </div>
  )
}

/**
 * Error container for PDF documents with consistent styling and retry functionality
 */
export function PdfErrorContainer({
  children,
  className,
  error,
  onRetry,
  showRetryButton = true,
}: PdfErrorContainerProps) {
  const errorMessage = typeof error === 'string' ? error : error?.message || 'Error desconocido'
  
  return (
    <div className={cn("pdf-error-container", className)}>
      <div className="text-center">
        <div className="text-red-500 text-4xl lg:text-6xl mb-4">⚠️</div>
        <h3 className="text-base lg:text-lg font-semibold text-gray-900 mb-2">
          Error al cargar PDF
        </h3>
        {error && (
          <p className="text-sm lg:text-base text-gray-600 mb-4">
            {errorMessage}
          </p>
        )}
        {children}
        {showRetryButton && onRetry && (
          <button
            onClick={onRetry}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm mt-4"
          >
            Reintentar
          </button>
        )}
      </div>
    </div>
  )
}

/**
 * Hook for responsive PDF scaling based on container size
 */
export function useResponsivePdfScale() {
  const calculateScale = (containerWidth: number, isMobile: boolean = false): number => {
    if (typeof window === 'undefined') return 1.0
    
    // Standard PDF width (US Letter: 8.5" = 612px at 72 DPI)
    const standardPdfWidth = 612
    
    if (isMobile) {
      // On mobile, use available width with minimal padding (content is now 5% wider)
      const availableWidth = containerWidth - 24 // 12px padding on each side
      return Math.max(0.5, Math.min(availableWidth / standardPdfWidth, 1.4))
    } else {
      // On desktop, use more of the available space (content is now 5% wider)
      const availableWidth = containerWidth - 48 // 24px padding on each side
      return Math.max(0.8, Math.min(availableWidth / standardPdfWidth, 2.0))
    }
  }

  const getResponsiveScale = (viewportWidth: number): number => {
    const isMobile = viewportWidth < 768
    return calculateScale(viewportWidth, isMobile)
  }

  return {
    calculateScale,
    getResponsiveScale,
  }
}

/**
 * Utility function to get PDF document styles based on device and container
 */
export function getPdfDocumentStyles(
  scale: number = 1,
  rotation: number = 0,
  cursor: string = 'default'
) {
  return {
    cursor,
    transform: `scale(${scale}) rotate(${rotation}deg)`,
    transformOrigin: 'center center',
    transition: 'transform 0.3s ease-in-out',
    imageRendering: 'crisp-edges' as const,
    WebkitFontSmoothing: 'antialiased' as const,
    MozOsxFontSmoothing: 'grayscale' as const,
  }
}

export default PdfResponsiveContainer 