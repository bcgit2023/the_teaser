"use client"

import * as Dialog from '@radix-ui/react-dialog'
import { Gift, Star } from 'lucide-react'
import Image from 'next/image'

interface RewardsButtonProps {
  points: number
  maxPoints: number
}

export function RewardsButton({ points, maxPoints }: RewardsButtonProps) {
  const progress = (points / maxPoints) * 100

  const rewardStages = [
    {
      points: 500,
      description: "Did you know? Labubu has exactly nine sharp teeth!",
      icon: Star
    },
    {
      points: 1000,
      description: "Almost there! Labubu is preparing a surprise!",
      icon: Star
    },
    {
      points: 2000,
      description: "Final stretch! Your Labubu is waiting!",
      icon: Star
    }
  ]

  // Find next goal
  const nextGoal = rewardStages.find(stage => stage.points > points) || rewardStages[rewardStages.length - 1]
  const pointsNeeded = Math.max(0, nextGoal.points - points)

  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <button className="p-2 rounded-full bg-[#0066CC] hover:bg-[#0077EE] transition-colors">
          <Gift className="h-6 w-6 text-white" />
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-lg p-6 w-[400px] max-h-[85vh] overflow-y-auto">
          <div className="flex justify-between items-start mb-4">
            <h2 className="text-2xl font-bold text-[#0066CC]">Your Labubu Reward</h2>
            <Dialog.Close className="text-gray-400 hover:text-gray-600">
              ✕
            </Dialog.Close>
          </div>

          <div className="mb-6">
            <Image
              src="/images/la4.jpg"
              alt="Labubu Reward"
              width={300}
              height={300}
              className="mx-auto rounded-lg"
            />
          </div>

          <div className="mb-6">
            <div className="flex justify-between items-baseline mb-3">
              <div>
                <div className="text-sm text-gray-500 mb-1">Current Points</div>
                <div className="text-4xl font-bold text-[#0066CC]">{points.toLocaleString()}</div>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-500 mb-1">Next Goal</div>
                <div className="text-xl font-semibold text-gray-900">+{pointsNeeded.toLocaleString()}</div>
              </div>
            </div>
            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-[#0066CC] transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div className="space-y-4">
            {rewardStages.map((stage) => {
              const isCompleted = points >= stage.points
              
              return (
                <div 
                  key={stage.points}
                  className="p-4 rounded-lg bg-gray-50 border-2 border-gray-200"
                >
                  <div className="flex items-center gap-3 mb-1">
                    <stage.icon
                      className={`h-6 w-6 ${
                        isCompleted ? "text-blue-600" : "text-gray-400"
                      }`}
                    />
                    <div>
                      <span className="font-semibold text-gray-900">
                        {stage.points.toLocaleString()} points
                      </span>
                    </div>
                  </div>
                  <p className="text-gray-600 ml-9">{stage.description}</p>
                </div>
              )
            })}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
