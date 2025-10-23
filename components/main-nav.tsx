import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"

export function MainNav() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0052FF]">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <Link href="/" className="flex items-center">
            <Image
              src="/logo/FL Logo Transparent.png"
              alt="FutureLearner.ai"
              width={240}
              height={80}
              className="h-16 w-auto"
              priority
            />
          </Link>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center space-x-8">
            <Link 
              href="/solutions" 
              className="text-white/90 hover:text-white transition-colors"
            >
              Solutions
            </Link>
            <Link 
              href="/about" 
              className="text-white/90 hover:text-white transition-colors"
            >
              About Us
            </Link>
            <Link 
              href="/contact" 
              className="text-white/90 hover:text-white transition-colors"
            >
              Contact
            </Link>
            <Button 
              asChild
              className="bg-white text-[#0052FF] hover:bg-blue-50 transition-colors font-medium px-6"
            >
              <Link href="/login">
                Login
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </nav>
  )
}
