'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Info, ShoppingBag } from 'lucide-react'
import Image from 'next/image'

const labubuItems = [
  {
    title: "Original Labubu",
    series: "The Monsters",
    cover: "/images/la1.jpg",
    description: "The classic Labubu design with pointy ears and nine sharp teeth, created by Kasing Lung in 2015.",
    type: "Plush Toy",
    size: "30cm"
  },
  {
    title: "Blackpink Lisa Edition Labubu",
    series: "Special Collection",
    cover: "/images/la2.jpg",
    description: "Special edition Labubu featured in Lisa's social media, with unique styling and accessories.",
    type: "Collectible Figure",
    size: "15cm"
  },
  {
    title: "Nordic Labubu",
    series: "Heritage Collection",
    cover: "/images/la3.jpg",
    description: "Inspired by Nordic folklore, featuring traditional Nordic patterns and colors.",
    type: "Vinyl Figure",
    size: "20cm"
  },
  {
    title: "Zimomo & Labubu Set",
    series: "The Monsters Family",
    cover: "/images/la4.jpg",
    description: "Special duo set featuring Labubu with their Monster tribe friend Zimomo.",
    type: "Plush Set",
    size: "25cm each"
  },
  {
    title: "Labubu Keychain",
    series: "Accessories",
    cover: "/images/la1.jpg",
    description: "Portable Labubu keychain perfect for bags and keys, featuring the classic mischievous grin.",
    type: "Keychain",
    size: "8cm"
  }
]

interface LabubuCollectionProps {
  onClose?: () => void
}

export default function LabubuCollection({ onClose }: LabubuCollectionProps) {
  const [selectedItem, setSelectedItem] = useState<number | null>(null)

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold text-[#0066CC]">Labubu Collection</h2>
            <p className="text-gray-600 mt-1">Created by Kasing Lung</p>
          </div>
          <Button variant="ghost" onClick={onClose}>✕</Button>
        </div>

        <div className="mb-6 p-4 bg-blue-50 rounded-lg">
          <h3 className="font-bold mb-2">About Labubu</h3>
          <p className="text-sm text-gray-700">
            Labubu is a beloved character from The Monsters series, created by Hong Kong artist Kasing Lung in 2015. 
            This furry elf with a playful grin and sharp teeth was inspired by Nordic folklore. 
            Labubu gained worldwide popularity after partnering with Pop Mart and received additional recognition when 
            Blackpink's Lisa showcased the collection in 2024.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {labubuItems.map((item, index) => (
            <Card key={index} className={`hover:shadow-lg transition-shadow ${selectedItem === index ? 'ring-2 ring-[#0066CC]' : ''}`}>
              <CardHeader className="p-4">
                <div className="aspect-square relative mb-4">
                  <Image
                    src={item.cover}
                    alt={item.title}
                    fill
                    className="object-cover rounded-md"
                  />
                </div>
                <CardTitle className="text-lg">{item.title}</CardTitle>
                <CardDescription>{item.series}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-4">{item.description}</p>
                <div className="flex justify-between items-center text-sm text-gray-500 mb-4">
                  <span className="flex items-center">
                    <Info className="w-4 h-4 mr-1" />
                    {item.type}
                  </span>
                  <span className="px-2 py-1 rounded-full bg-blue-100 text-blue-800 text-xs">
                    {item.size}
                  </span>
                </div>
                <Button 
                  className="w-full"
                  onClick={() => setSelectedItem(index)}
                >
                  <ShoppingBag className="w-4 h-4 mr-2" />
                  Select Item
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
