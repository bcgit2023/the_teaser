import Image from 'next/image'
import Link from 'next/link'
import { Button } from "@/components/ui/button"

export default function HomePage() {
  return (
    <div className="flex flex-col w-full">
      <header className="bg-blue-600 text-white py-4 w-full">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold">FutureLearner.ai</h1>
            <div className="flex items-center space-x-8">
              <nav className="flex space-x-6">
                <Link href="#" className="hover:underline">For Students</Link>
                <Link href="#" className="hover:underline">For Teachers</Link>
                <Link href="#" className="hover:underline">How It Works</Link>
              </nav>
              <Link href="/login" passHref>
                <Button className="bg-white text-blue-600 hover:bg-blue-100">
                  Login / Sign Up
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="w-full">
        <section className="bg-gray-100 py-20 w-full">
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
                <Link href="/login" passHref>
                  <Button className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition duration-300">
                    Start Learning Now
                  </Button>
                </Link>
              </div>
              <div className="md:w-1/2 pl-19">
                <Image
                  src="/boy.jpg"
                  alt="Young boy learning with AI-powered platform"
                  width={600}
                  height={400}
                  className="rounded-lg shadow-xl object-cover"
                />
              </div>
            </div>
          </div>
        </section>

        <section className="bg-black text-white py-16 w-full">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
              {[
                { stat: "30%", desc: "Improvement in test scores" },
                { stat: "45%", desc: "Increase in student engagement" },
                { stat: "2x", desc: "Faster learning progress" }
              ].map((item, index) => (
                <div key={index} className="bg-gray-800 p-6 rounded-lg">
                  <div className="text-4xl font-bold mb-2">{item.stat}</div>
                  <div>{item.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}