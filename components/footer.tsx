import React from 'react'
import Link from 'next/link'
import { Facebook, Linkedin, Twitter, Youtube, Instagram } from 'lucide-react'

const Footer: React.FC = () => {
  return (
    <footer className="bg-gray-100 py-12 w-full">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <h3 className="font-bold text-lg mb-4">FutureLearner</h3>
            <ul className="space-y-2">
              <li><Link href="/about" className="text-gray-600 hover:text-blue-600">About</Link></li>
              <li><Link href="/what-we-offer" className="text-gray-600 hover:text-blue-600">What We Offer</Link></li>
              <li><Link href="/leadership" className="text-gray-600 hover:text-blue-600">Leadership</Link></li>
              <li><Link href="/careers" className="text-gray-600 hover:text-blue-600">Careers</Link></li>
              <li><Link href="/catalog" className="text-gray-600 hover:text-blue-600">Catalog</Link></li>
              <li><Link href="/for-enterprise" className="text-gray-600 hover:text-blue-600">For Enterprise</Link></li>
              <li><Link href="/for-schools" className="text-gray-600 hover:text-blue-600">For Schools</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="font-bold text-lg mb-4">Community</h3>
            <ul className="space-y-2">
              <li><Link href="/learners" className="text-gray-600 hover:text-blue-600">Learners</Link></li>
              <li><Link href="/partners" className="text-gray-600 hover:text-blue-600">Partners</Link></li>
              <li><Link href="/beta-testers" className="text-gray-600 hover:text-blue-600">Beta Testers</Link></li>
              <li><Link href="/blog" className="text-gray-600 hover:text-blue-600">Blog</Link></li>
              <li><Link href="/tech-blog" className="text-gray-600 hover:text-blue-600">Tech Blog</Link></li>
              <li><Link href="/teaching-center" className="text-gray-600 hover:text-blue-600">Teaching Center</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="font-bold text-lg mb-4">More</h3>
            <ul className="space-y-2">
              <li><Link href="/press" className="text-gray-600 hover:text-blue-600">Press</Link></li>
              <li><Link href="/investors" className="text-gray-600 hover:text-blue-600">Investors</Link></li>
              <li><Link href="/terms" className="text-gray-600 hover:text-blue-600">Terms</Link></li>
              <li><Link href="/privacy" className="text-gray-600 hover:text-blue-600">Privacy</Link></li>
              <li><Link href="/help" className="text-gray-600 hover:text-blue-600">Help</Link></li>
              <li><Link href="/accessibility" className="text-gray-600 hover:text-blue-600">Accessibility</Link></li>
              <li><Link href="/contact" className="text-gray-600 hover:text-blue-600">Contact</Link></li>
              <li><Link href="/directory" className="text-gray-600 hover:text-blue-600">Directory</Link></li>
              <li><Link href="/affiliates" className="text-gray-600 hover:text-blue-600">Affiliates</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="font-bold text-lg mb-4">Connect with Us</h3>
            <div className="flex space-x-4">
              <Link href="https://facebook.com/futurelearner" className="text-gray-600 hover:text-blue-600">
                <Facebook className="w-6 h-6" />
                <span className="sr-only">Facebook</span>
              </Link>
              <Link href="https://linkedin.com/company/futurelearner" className="text-gray-600 hover:text-blue-600">
                <Linkedin className="w-6 h-6" />
                <span className="sr-only">LinkedIn</span>
              </Link>
              <Link href="https://twitter.com/futurelearner" className="text-gray-600 hover:text-blue-600">
                <Twitter className="w-6 h-6" />
                <span className="sr-only">Twitter</span>
              </Link>
              <Link href="https://youtube.com/futurelearner" className="text-gray-600 hover:text-blue-600">
                <Youtube className="w-6 h-6" />
                <span className="sr-only">YouTube</span>
              </Link>
              <Link href="https://instagram.com/futurelearner" className="text-gray-600 hover:text-blue-600">
                <Instagram className="w-6 h-6" />
                <span className="sr-only">Instagram</span>
              </Link>
            </div>
          </div>
        </div>
        <div className="mt-8 text-center text-gray-600">
          © {new Date().getFullYear()} FutureLearner.ai. All rights reserved.
        </div>
      </div>
    </footer>
  )
}

export default Footer