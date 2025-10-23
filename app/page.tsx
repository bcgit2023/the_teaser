'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import LoaderOne from '@/components/LoaderOne'

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    router.push('/login')
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <LoaderOne />
      </div>
    </div>
  )
}
