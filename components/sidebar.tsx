"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { createClient } from "@/utils/supabase/client"
import { 
  Send, 
  LayoutDashboard, 
  FileText, 
  Users, 
  Settings, 
  LogOut, 
  ChevronLeft, 
  Pen, 
  Upload, 
  FolderOpen, 
  Menu, 
  X, 
  Folder, 
  FileSearch, 
  Lightbulb 
} from "lucide-react"
import type { User } from "@supabase/supabase-js"
import { Logo } from "./logo"

export default function Sidebar({ 
  user, 
  mobileOpen: externalMobileOpen, 
  onMobileOpenChange 
}: { 
  user: User
  mobileOpen?: boolean
  onMobileOpenChange?: (open: boolean) => void
}) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  
  // Use external control if provided, otherwise use internal state
  const actualMobileOpen = externalMobileOpen !== undefined ? externalMobileOpen : mobileOpen
  const setActualMobileOpen = onMobileOpenChange || setMobileOpen
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  // Responsive sidebar behavior
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth
      // Auto-collapse on tablet/laptop screens (768px - 1024px)
      if (width >= 768 && width < 1024) {
        setCollapsed(true)
      }
      // Auto-expand on large desktop screens (>= 1024px)
      else if (width >= 1024) {
        setCollapsed(false)
      }
    }

    // Set initial state
    handleResize()

    // Listen for window resize
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push("/")
    router.refresh()
  }

  // Close mobile sidebar when route changes
  useEffect(() => {
    setActualMobileOpen(false)
  }, [pathname, setActualMobileOpen])

  // Listen for external open requests
  useEffect(() => {
    const handleOpenSidebar = () => {
      setActualMobileOpen(true)
    }

    window.addEventListener('openMainSidebar', handleOpenSidebar)
    return () => window.removeEventListener('openMainSidebar', handleOpenSidebar)
  }, [setActualMobileOpen])

  const handleFirmasClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    // Solo interceptar si estamos en fast-sign
    if (pathname === "/fast-sign") {
      e.preventDefault()
      
      // Disparar evento personalizado para que fast-sign-client lo maneje
      const customEvent = new CustomEvent('firmasNavigation', {
        detail: { href: "/fast-sign" }
      })
      window.dispatchEvent(customEvent)
    }
    // Si no estamos en fast-sign, dejar que navegue normalmente
  }

  const navItems: Array<{
    name: string
    href: string
    icon: any
    onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void
  }> = [
    {
      name: "Firmas",
      href: "/fast-sign",
      icon: Pen,
      onClick: handleFirmasClick,
    },
    {
      name: "Documentos",
      href: "/fast-sign-docs",
      icon: FolderOpen,
    },
    {
      name: "Enviar a Firmar",
      href: "/sent-to-sign",
      icon: Send,
    },
    {
      name: "Seguimiento",
      href: "/documents",
      icon: FileSearch,
    },
    {
      name: "Expedientes",
      href: "/case-files",
      icon: Folder,
    },
    {
      name: "Panel",
      href: "/dashboard",
      icon: LayoutDashboard,
    },
    {
      name: "Contactos",
      href: "/customers",
      icon: Users,
    },
    {
      name: "Tutorial",
      href: "/tutorial",
      icon: Lightbulb,
    },
    {
      name: "Configuraciones",
      href: "/settings",
      icon: Settings,
    },
  ]

  const SidebarContent = () => (
    <>
      <div className="p-4 flex items-center justify-between border-b" style={{ borderColor: '#E5E7EB' }}>
        <Link href="/fast-sign" className={`flex items-center ${collapsed ? "justify-center" : ""}`}>
          <Logo className="h-8 w-8" color="#0d2340" />
          {!collapsed && <span className="ml-2 font-semibold" style={{ color: '#282828' }}>Demo</span>}
        </Link>
        <div className="flex items-center space-x-2">
          {/* Mobile close button */}
          <button 
            onClick={() => setActualMobileOpen(false)}
            className="md:hidden p-1 rounded-md hover:bg-gray-100"
            style={{ color: '#282828' }}
          >
            <X className="h-5 w-5" />
          </button>
          {/* Desktop collapse button */}
          <button 
            onClick={() => setCollapsed(!collapsed)} 
            className="hidden md:flex items-center justify-center w-8 h-8 bg-white border border-gray-300 rounded-full shadow-sm transition-all duration-200 hover:shadow-md hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 z-10"
            style={{ color: '#282828' }}
          >
            <ChevronLeft className={`h-4 w-4 transition-transform ${collapsed ? "rotate-180" : ""}`} />
          </button>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-4">
        <ul className="space-y-1 px-2">
          {navItems.map((item) => (
            <li key={item.name}>
              <Link
                href={item.href}
                onClick={item.onClick}
                className={`flex items-center px-2 py-2 rounded-md transition-colors ${
                  pathname === item.href ? "font-medium" : "hover:opacity-80"
                }`}
                style={{
                  backgroundColor: pathname === item.href ? '#e5e7eb' : 'transparent',
                  color: '#282828'
                }}
              >
                <item.icon className="h-5 w-5 flex-shrink-0" />
                {!collapsed && <span className="ml-3">{item.name}</span>}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className="p-4 border-t" style={{ borderColor: '#E5E7EB' }}>
        {/* User Info Section */}
        {!collapsed && user?.email && (
          <div className="mb-3 pb-3 border-b" style={{ borderColor: '#E5E7EB' }}>
            <div className="text-xs text-gray-500 mb-1">Conectado como</div>
            <div className="text-sm font-medium truncate" style={{ color: '#282828' }} title={user.email}>
              {user.email}
            </div>
          </div>
        )}
        
        {/* Collapsed view - show just email initial */}
        {collapsed && user?.email && (
          <div className="mb-3 pb-3 border-b flex justify-center" style={{ borderColor: '#E5E7EB' }}>
            <div 
              className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-sm font-medium"
              style={{ color: '#282828' }}
              title={user.email}
            >
              {user.email.charAt(0).toUpperCase()}
            </div>
          </div>
        )}

        <button
          onClick={handleSignOut}
          className={`flex items-center transition-colors hover:opacity-80 ${collapsed ? "justify-center" : ""}`}
          style={{ color: '#282828' }}
        >
          <LogOut className="h-5 w-5" />
          {!collapsed && <span className="ml-2">Cerrar Sesión</span>}
        </button>
      </div>
    </>
  )

  return (
    <>


      {/* Mobile Sidebar Overlay */}
      {actualMobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black bg-opacity-50" 
            onClick={() => setActualMobileOpen(false)}
          />
          
          {/* Sidebar */}
          <div 
            className="relative w-64 max-w-sm border-r border-border flex flex-col shadow-lg"
            style={{ backgroundColor: '#FFFFFF' }}
          >
            <SidebarContent />
          </div>
        </div>
      )}

      {/* Desktop Sidebar */}
      <div className="hidden md:flex">
        <div 
          className={`${collapsed ? "w-16" : "w-64"} transition-all duration-300 border-r border-border flex flex-col shadow-sm`}
          style={{ backgroundColor: '#FFFFFF' }}
        >
          <SidebarContent />
        </div>
      </div>
    </>
  )
}
