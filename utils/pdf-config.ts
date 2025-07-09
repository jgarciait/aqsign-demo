// Central PDF.js configuration to ensure consistency across all components

let pdfConfigured = false

export function configurePdfJs() {
  if (typeof window === 'undefined' || pdfConfigured) {
    return
  }

  // Configure Promise.withResolvers polyfill if needed (Node 18 compatibility)
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

  // Dynamic import and configure PDF.js
  import("react-pdf").then(({ pdfjs }) => {
    // Try different worker files in order of preference
    const workerFiles = [
      `${window.location.origin}/pdf.worker.mjs`,
      `${window.location.origin}/pdf.worker.min.js`,
      `${window.location.origin}/pdf.worker.js`
    ]
    
    // Use the first available worker file (prefer .mjs for newer PDF.js versions)
    pdfjs.GlobalWorkerOptions.workerSrc = workerFiles[0]
    
    console.log('PDF.js worker configured:', pdfjs.GlobalWorkerOptions.workerSrc)
    pdfConfigured = true
  }).catch((error) => {
    console.error('Failed to configure PDF.js:', error)
  })
}

// PDF.js options for components with fallback worker sources
export const PDF_OPTIONS = {
  cMapUrl: 'https://unpkg.com/pdfjs-dist@4.8.69/cmaps/',
  cMapPacked: true,
  standardFontDataUrl: 'https://unpkg.com/pdfjs-dist@4.8.69/standard_fonts/',
  workerSrc: typeof window !== 'undefined' ? `${window.location.origin}/pdf.worker.mjs` : '/pdf.worker.mjs'
} as const

// Fallback worker sources for different scenarios (prefer .mjs for newer versions)
export const WORKER_FALLBACKS = [
  '/pdf.worker.mjs',
  '/pdf.worker.min.js',
  '/pdf.worker.js',
  '/api/pdf-worker',
  'https://unpkg.com/pdfjs-dist@4.8.69/build/pdf.worker.min.js'
] as const

// Enhanced PDF.js configuration with fallback logic
export async function configurePdfJsWithFallback() {
  if (typeof window === 'undefined') return

  try {
    const { pdfjs } = await import("react-pdf")
    
    let workerConfigured = false
    
    // Try each fallback worker source
    for (const workerSrc of WORKER_FALLBACKS) {
      try {
        const fullWorkerSrc = workerSrc.startsWith('http') ? workerSrc : `${window.location.origin}${workerSrc}`
        
        // Test if worker source is available
        const response = await fetch(fullWorkerSrc, { method: 'HEAD' })
        if (response.ok) {
          pdfjs.GlobalWorkerOptions.workerSrc = fullWorkerSrc
          
          console.log("PDF.js worker configured successfully:", fullWorkerSrc)
          workerConfigured = true
          break
        }
      } catch (e) {
        console.warn(`Worker source ${workerSrc} not available:`, e)
      }
    }
    
    if (!workerConfigured) {
      console.warn("No PDF.js worker source available, using CDN fallback")
      pdfjs.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@4.8.69/build/pdf.worker.mjs'
    }
    
  } catch (error) {
    console.error('Failed to configure PDF.js with fallback:', error)
  }
}

// Call configuration immediately
if (typeof window !== 'undefined') {
  configurePdfJs()
} 