import '../styles/globals.css'
import { Inter } from 'next/font/google'
import ConditionalFooter from '../components/conditional-footer'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as SonnerToaster } from 'sonner'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'FutureLearner.ai (Teaser Version)',
  description: 'AI Tutor for Every Student',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="h-full">
      <body className={`${inter.className} min-h-screen flex flex-col`}>
        <div className="flex-1">
          {children}
        </div>
        <ConditionalFooter />
        <Toaster />
        <SonnerToaster />
      </body>
    </html>
  )
}