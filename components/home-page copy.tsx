import Image from 'next/image'
import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen">
      <header className="bg-blue-600 text-white py-4">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold">FutureLearner.ai</h1>
            <nav className="hidden md:flex space-x-4">
              <Link href="#" className="hover:underline">For Students</Link>
              <Link href="#" className="hover:underline">For Teachers</Link>
              <Link href="#" className="hover:underline">How It Works</Link>
              <Link href="/login" className="bg-white text-blue-600 px-4 py-2 rounded hover:bg-blue-100">
                Login / Sign Up
              </Link>
            </nav>
          </div>
        </div>
      </header>

      <main className="flex-grow">
        <section className="bg-gray-100 py-20">
          <div className="container mx-auto px-4">
            <div className="flex flex-col md:flex-row items-center">
              <div className="md:w-1/2 mb-8 md:mb-0">
                <h2 className="text-4xl font-bold mb-6">Revolutionize Learning with AI-Powered Mastery</h2>
                <ul className="space-y-4 mb-8">
                  {[
                    "Personalized learning paths adapted to each student's needs",
                    "Real-time feedback and support from AI tutors",
                    "Efficient group supervision for enhanced focus and safety",
                    "Comprehensive analytics for students, parents, and educators"
                  ].map((item, index) => (
                    <li key={index} className="flex items-center">
                      <svg className="w-6 h-6 mr-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {item}
                    </li>
                  ))}
                </ul>
                <Link href="/login" className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition duration-300">
                  Start Learning Now
                </Link>
              </div>
              <div className="md:w-1/2">
                <Image
                  src="/boy.jpg"
                  alt="AI-powered learning experience"
                  width={600}
                  height={400}
                  className="rounded-lg shadow-xl"
                />
              </div>
            </div>
          </div>
        </section>

        <section className="bg-blue-800 text-white py-16">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
              {[
                { stat: "30%", desc: "Improvement in test scores" },
                { stat: "45%", desc: "Increase in student engagement" },
                { stat: "2x", desc: "Faster learning progress" }
              ].map((item, index) => (
                <div key={index} className="bg-blue-700 p-6 rounded-lg">
                  <div className="text-4xl font-bold mb-2">{item.stat}</div>
                  <div>{item.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-gray-200 py-8">
        <div className="container mx-auto px-4 text-center text-gray-600">
          © {new Date().getFullYear()} FutureLearner.ai. All rights reserved.
        </div>
      </footer>
    </div>
  )
}