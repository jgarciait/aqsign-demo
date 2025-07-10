"use client"

import { useMemo, useEffect, useState } from 'react'
import type { Annotation } from './pdf-annotation-editor'

interface ResponsiveAnnotationOverlayProps {
  annotations: Annotation[]
  pageSize: { width: number; height: number } | null
  originalDimensions: { width: number; height: number } | null
  scale: number
  children: React.ReactNode
}

/**
 * Overlay component that ensures annotations are positioned correctly
 * based on the current PDF scale and dimensions
 */
export default function ResponsiveAnnotationOverlay({
  annotations,
  pageSize,
  originalDimensions,
  scale,
  children
}: ResponsiveAnnotationOverlayProps) {
  const [debugInfo, setDebugInfo] = useState<any>(null)

  // Calculate the scaling factors for annotations
  const scalingInfo = useMemo(() => {
    if (!pageSize || !originalDimensions) {
      return null
    }

    const info = {
      currentScale: scale,
      displaySize: pageSize,
      originalSize: originalDimensions,
      scaleX: pageSize.width / originalDimensions.width,
      scaleY: pageSize.height / originalDimensions.height,
      annotationCount: annotations.length
    }

    setDebugInfo(info)
    return info
  }, [pageSize, originalDimensions, scale, annotations.length])

  // Log scaling information for debugging
  useEffect(() => {
    if (scalingInfo && annotations.length > 0) {
      console.log('📐 Responsive Annotation Overlay - Scaling Info:', {
        scale: scalingInfo.currentScale,
        displaySize: scalingInfo.displaySize,
        originalSize: scalingInfo.originalSize,
        scaleFactors: {
          x: scalingInfo.scaleX,
          y: scalingInfo.scaleY
        },
        annotations: annotations.map(a => ({
          id: a.id,
          type: a.type,
          position: { x: a.x, y: a.y },
          size: { width: a.width, height: a.height },
          relative: {
            x: a.relativeX,
            y: a.relativeY,
            width: a.relativeWidth,
            height: a.relativeHeight
          }
        }))
      })
    }
  }, [scalingInfo, annotations])

  // Overlay style that matches the PDF container exactly
  const overlayStyle = useMemo(() => ({
    position: 'absolute' as const,
    top: 0,
    left: 0,
    width: pageSize ? `${pageSize.width}px` : '100%',
    height: pageSize ? `${pageSize.height}px` : '100%',
    pointerEvents: 'none' as const,
    zIndex: 10
  }), [pageSize])

  // Container style for annotation positioning
  const containerStyle = useMemo(() => ({
    position: 'relative' as const,
    width: '100%',
    height: '100%',
    overflow: 'visible' as const
  }), [])

  if (!pageSize) {
    return null
  }

  return (
    <div style={overlayStyle}>
      <div style={containerStyle}>
        {children}
        
        {/* Debug overlay (only in development) */}
        {process.env.NODE_ENV === 'development' && debugInfo && (
          <div 
            style={{
              position: 'absolute',
              top: '10px',
              right: '10px',
              background: 'rgba(0, 0, 0, 0.8)',
              color: 'white',
              padding: '8px',
              borderRadius: '4px',
              fontSize: '10px',
              fontFamily: 'monospace',
              zIndex: 1000,
              maxWidth: '200px'
            }}
          >
            <div>Scale: {debugInfo.currentScale.toFixed(2)}</div>
            <div>Display: {debugInfo.displaySize.width}×{debugInfo.displaySize.height}</div>
            <div>Original: {debugInfo.originalSize.width}×{debugInfo.originalSize.height}</div>
            <div>Annotations: {debugInfo.annotationCount}</div>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Hook to calculate responsive dimensions for annotations
 */
export function useResponsiveAnnotationDimensions(
  pageSize: { width: number; height: number } | null,
  originalDimensions: { width: number; height: number } | null,
  scale: number
) {
  return useMemo(() => {
    if (!pageSize || !originalDimensions) {
      return null
    }

    return {
      scaleX: pageSize.width / originalDimensions.width,
      scaleY: pageSize.height / originalDimensions.height,
      currentScale: scale,
      isScaled: Math.abs(scale - 1.0) > 0.01
    }
  }, [pageSize, originalDimensions, scale])
} 