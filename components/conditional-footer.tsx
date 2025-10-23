'use client'

import { usePathname } from 'next/navigation'
import Footer from './footer'

export default function ConditionalFooter() {
  const pathname = usePathname()
  
  if (!pathname) {
    return null
  }

  // List of paths where footer should be hidden
  const noFooterPaths = ['/login', '/admin-dashboard', '/quiz-assessment', 
    '/courses', '/schedule', '/achievements', '/parent-dashboard', '/course-practice', '/tutorial']
  
  // Check if current path starts with any of the paths in noFooterPaths
  const shouldHideFooter = noFooterPaths.some(path => pathname.startsWith(path))
  
  if (shouldHideFooter) {
    return null
  }
  
  return <Footer />
}