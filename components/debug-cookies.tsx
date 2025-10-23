'use client'

import { useEffect, useState } from 'react'

export default function DebugCookies() {
  const [cookies, setCookies] = useState<string>('')
  const [apiResult, setApiResult] = useState<any>(null)

  useEffect(() => {
    // Get client-side cookies
    setCookies(document.cookie)

    // Test API call to debug endpoint
    fetch('/api/debug/cookies', {
      credentials: 'include'
    })
    .then(res => res.json())
    .then(data => setApiResult(data))
    .catch(err => console.error('API call failed:', err))
  }, [])

  return (
    <div className="p-4 bg-gray-100 border rounded">
      <h3 className="font-bold mb-2">Debug Cookies</h3>
      <div className="mb-4">
        <h4 className="font-semibold">Client-side cookies:</h4>
        <pre className="text-xs bg-white p-2 rounded overflow-auto max-h-32">
          {cookies || 'No cookies found'}
        </pre>
      </div>
      <div>
        <h4 className="font-semibold">Server-side API result:</h4>
        <pre className="text-xs bg-white p-2 rounded overflow-auto max-h-32">
          {JSON.stringify(apiResult, null, 2)}
        </pre>
      </div>
    </div>
  )
}