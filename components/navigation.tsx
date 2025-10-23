import Link from 'next/link'

export default function Navigation() {
  return (
    <nav className="bg-blue-600 p-4">
      <ul className="flex space-x-4 justify-center">
        <li><Link href="/" className="text-white hover:underline">Home</Link></li>
        <li><Link href="/login" className="text-white hover:underline">Login</Link></li>
        <li><Link href="/admin-dashboard" className="text-white hover:underline">Admin Dashboard</Link></li>
        <li><Link href="/grammar-practice" className="text-white hover:underline">Grammar Practice</Link></li>
        <li><Link href="/quiz" className="text-white hover:underline">Quiz</Link></li>
        <li><Link href="/quiz-assessment" className="text-white hover:underline">Quiz Assessment</Link></li>
      </ul>
    </nav>
  )
}