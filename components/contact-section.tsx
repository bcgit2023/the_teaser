"use client"

import { ContactForm } from "./contact-form"

export function ContactSection() {
  return (
    <section className="py-16 bg-white">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-start">
          {/* Left Column - Promotional Text */}
          <div className="space-y-8">
            <div className="space-y-4">
              <h2 className="text-3xl font-bold text-gray-900">
                Ready to transform education with AI?
              </h2>
              <p className="text-xl text-gray-600">
                Let's connect to discuss how FutureLearner.ai can help you:
              </p>
            </div>

            <ul className="space-y-6">
              {[
                "Accelerate student learning with AI assistance",
                "Improve educational outcomes with personalized learning",
                "Boost student engagement and participation",
                "Equip students for academic success",
              ].map((benefit, index) => (
                <li key={index} className="flex items-start space-x-3">
                  <svg
                    className="w-6 h-6 text-blue-600 mt-1 flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <span className="text-lg text-gray-700">{benefit}</span>
                </li>
              ))}
            </ul>

            <div className="pt-6">
              <p className="text-lg font-semibold text-blue-600">
                Top institutions develop skills with FutureLearner.ai
              </p>
            </div>
          </div>

          {/* Right Column - Contact Form */}
          <div className="bg-gray-50 p-8 rounded-xl shadow-sm">
            <ContactForm />
          </div>
        </div>
      </div>
    </section>
  )
}
