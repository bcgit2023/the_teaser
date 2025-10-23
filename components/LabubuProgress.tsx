'use client'

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import Image from 'next/image'
import { Star } from 'lucide-react'

const milestones = [
  {
    points: 100,
    fact: "Did you know? Labubu has exactly nine sharp teeth!",
    feature: "Keep going to see Labubu's special dance!"
  },
  {
    points: 250,
    fact: "Fun fact: Labubu was inspired by Nordic folklore!",
    feature: "Almost there! Labubu is preparing a surprise!"
  },
  {
    points: 500,
    fact: "Wow! Labubu became famous after Blackpink's Lisa showed their collection!",
    feature: "Final stretch! Your Labubu is waiting!"
  }
]

export default function LabubuProgress() {
  const currentPoints = 180 // This would be dynamic in the real implementation
  const targetPoints = 500
  const progress = (currentPoints / targetPoints) * 100

  return (
    <Card className="bg-white shadow-lg">
      <CardHeader>
        <CardTitle className="text-lg text-[#0066CC]">Your Labubu Reward</CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        {/* Preview Image */}
        <div className="relative w-40 h-40 mx-auto mb-4">
          <Image
            src="/images/la1.jpg"
            alt="Selected Labubu"
            fill
            className="object-cover rounded-lg"
          />
          {progress >= 90 && (
            <div className="absolute inset-0 animate-pulse">
              <div className="absolute inset-0 bg-yellow-400 opacity-20 rounded-lg"></div>
              <Star className="absolute top-0 right-0 w-6 h-6 text-yellow-400 animate-spin" />
            </div>
          )}
        </div>

        {/* Progress Section */}
        <div className="mb-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="font-medium">Progress to Labubu</span>
            <span className="text-[#0066CC]">{currentPoints}/{targetPoints}</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Milestones */}
        <div className="space-y-3">
          {milestones.map((milestone, index) => (
            <div 
              key={index}
              className={`p-3 rounded-lg text-sm ${
                currentPoints >= milestone.points 
                  ? 'bg-blue-50 text-blue-800' 
                  : 'bg-gray-50 text-gray-500'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <div className={`w-2 h-2 rounded-full ${
                  currentPoints >= milestone.points 
                    ? 'bg-blue-500' 
                    : 'bg-gray-300'
                }`}></div>
                <span className="font-medium">{milestone.points} points</span>
              </div>
              <p className="ml-4">
                {currentPoints >= milestone.points ? milestone.fact : milestone.feature}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
