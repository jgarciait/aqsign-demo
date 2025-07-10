'use client'

import { Page } from 'react-pdf'
import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import type { Annotation } from './pdf-annotation-editor'

interface Props {
  pageNumber: number
  scale: number
  annotations: Annotation[]
  onClick: (e: React.MouseEvent<Element>, pageNumber: number, pageInfo?: any) => void
  onTouch?: (e: React.TouchEvent<Element>, pageNumber: number, pageInfo?: any) => void
  children?: React.ReactNode
}

export default function PdfPageWithOverlay({
  pageNumber,
  scale,
  annotations,
  onClick,
  onTouch,
  children
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const pdfPageRef = useRef<HTMLDivElement>(null)
  const [pageInfo, setPageInfo] = useState<any>(null)
  const [pageSize, setPageSize] = useState<{ width: number; height: number } | null>(null)
  const [originalDimensions, setOriginalDimensions] = useState<{ width: number; height: number } | null>(null)
  const dimensionsSetRef = useRef(false)

  // Reset dimensions when page number changes - but keep scale stable
  useEffect(() => {
    dimensionsSetRef.current = false
    setOriginalDimensions(null)
    setPageSize(null) // Clear page size to prevent stale data
  }, [pageNumber])

  // Memoize the scaled dimensions to prevent unnecessary recalculations
  const scaledDimensions = useMemo(() => {
    if (!originalDimensions) return null
    return {
      width: originalDimensions.width * scale,
      height: originalDimensions.height * scale
    }
  }, [originalDimensions, scale])

  // Update page size and info when scale changes
  useEffect(() => {
    if (originalDimensions && scaledDimensions) {
      setPageSize(scaledDimensions)
      
      const pageInfoData = {
        width: scaledDimensions.width,
        height: scaledDimensions.height,
        originalWidth: originalDimensions.width,
        originalHeight: originalDimensions.height,
        scale
      }
      
      setPageInfo(pageInfoData)
    }
  }, [originalDimensions, scaledDimensions, scale])

  const handlePageLoadSuccess = useCallback((page: any) => {
    const { width, height } = page
    
    // Only set dimensions once per page to prevent infinite loops
    if (!dimensionsSetRef.current) {
      console.log('PDF page loaded with original dimensions:', {
        originalWidth: width,
        originalHeight: height,
        pageNumber
      })
      
      setOriginalDimensions({ width, height })
      dimensionsSetRef.current = true
    }
  }, [pageNumber]) // Only depend on pageNumber, not scale

  const handleClick = useCallback((e: React.MouseEvent<Element>) => {
    if (containerRef.current && pageInfo && pageSize) {
      const rect = containerRef.current.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      
      // Ensure coordinates are within bounds
      const boundedX = Math.max(0, Math.min(x, pageSize.width))
      const boundedY = Math.max(0, Math.min(y, pageSize.height))
      
      console.log('Click coordinates:', {
        clientX: e.clientX,
        clientY: e.clientY,
        rectLeft: rect.left,
        rectTop: rect.top,
        boundedX,
        boundedY,
        pageSize
      })
      
      onClick(e, pageNumber, {
        ...pageInfo,
        clickX: boundedX,
        clickY: boundedY,
        pdfX: boundedX / pageSize.width,
        pdfY: boundedY / pageSize.height
      })
    } else {
      onClick(e, pageNumber)
    }
  }, [onClick, pageNumber, pageInfo, pageSize])

  const handleTouch = useCallback((e: React.TouchEvent<Element>) => {
    e.preventDefault()
    
    if (containerRef.current && pageInfo && pageSize) {
      const rect = containerRef.current.getBoundingClientRect()
      const touch = e.touches[0] || e.changedTouches[0]
      
      if (touch) {
        const x = touch.clientX - rect.left
        const y = touch.clientY - rect.top
        
        // Ensure coordinates are within bounds
        const boundedX = Math.max(0, Math.min(x, pageSize.width))
        const boundedY = Math.max(0, Math.min(y, pageSize.height))
        
        const touchInfo = {
          ...pageInfo,
          clickX: boundedX,
          clickY: boundedY,
          pdfX: boundedX / pageSize.width,
          pdfY: boundedY / pageSize.height
        }
        
        if (onTouch) {
          onTouch(e, pageNumber, touchInfo)
        } else {
          // Create a mock mouse event for backward compatibility
          const mockMouseEvent = {
            clientX: touch.clientX,
            clientY: touch.clientY,
            preventDefault: () => {},
            stopPropagation: () => {}
          } as React.MouseEvent<Element>
          
          onClick(mockMouseEvent, pageNumber, touchInfo)
        }
      }
    }
  }, [onTouch, onClick, pageNumber, pageInfo, pageSize])

  // Memoize container styles to prevent unnecessary re-renders
  const containerStyle = useMemo(() => ({
    width: pageSize ? `${pageSize.width}px` : 'auto',
    height: pageSize ? `${pageSize.height}px` : 'auto',
    minWidth: pageSize ? `${pageSize.width}px` : 'auto',
    minHeight: pageSize ? `${pageSize.height}px` : 'auto',
    maxWidth: pageSize ? `${pageSize.width}px` : 'auto',
    maxHeight: pageSize ? `${pageSize.height}px` : 'auto'
  }), [pageSize])

  // Memoize layer styles to prevent unnecessary re-renders
  const layerStyle = useMemo(() => ({
    width: pageSize ? `${pageSize.width}px` : '100%',
    height: pageSize ? `${pageSize.height}px` : '100%'
  }), [pageSize])

  return (
    <div className="w-full flex justify-center mb-4">
      {/* Container with exact dimensions for both PDF and overlay */}
      <div 
        ref={containerRef}
        className="relative bg-white shadow-lg border pdf-auto-fit"
        style={containerStyle}
      >
        {/* PDF Page - exact size match */}
        <div 
          ref={pdfPageRef}
          className="absolute top-0 left-0 w-full h-full"
          style={layerStyle}
        >
          <Page
            pageNumber={pageNumber}
            scale={scale}
            renderAnnotationLayer={false}
            renderTextLayer={false}
            onLoadSuccess={handlePageLoadSuccess}
            width={pageSize?.width}
            height={pageSize?.height}
            className="w-full h-full pdf-auto-fit"
          />
        </div>

        {/* Click/Touch-capture layer - exact size match */}
        <div
          className="absolute top-0 left-0 cursor-crosshair touch-none"
          style={layerStyle}
          onClick={handleClick}
          onTouchEnd={handleTouch}
        />

        {/* Annotation overlay - exact size match with responsive positioning */}
        <div 
          className="absolute top-0 left-0 pointer-events-none"
          style={layerStyle}
        >
          {children}
        </div>
      </div>
    </div>
  )
}
