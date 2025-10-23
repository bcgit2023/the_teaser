import React from 'react'
import { useToast } from "@/components/ui/use-toast"

export interface UserToast {
  id: number;
  title: string;
  description: string;
  variant: 'default' | 'destructive';
}

export function useUserToast() {
  const { toast } = useToast()

  const showToast = (message: string, type: 'default' | 'success' | 'error' = 'default') => {
    toast({
      title: type.charAt(0).toUpperCase() + type.slice(1),
      description: message,
      variant: type === 'error' ? 'destructive' : 'default',
    })
  }

  return { showToast }
}

export function ToastContainer({ toasts, removeToast }: { toasts: UserToast[], removeToast: (id: number) => void }) {
  return (
    <div className="fixed bottom-4 right-4 z-50">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`mb-2 p-4 rounded-md shadow-md ${
            toast.variant === 'destructive' ? 'bg-red-500' : 'bg-green-500'
          } text-white`}
        >
          <div className="flex justify-between items-center">
            <div>
              <h4 className="font-semibold">{toast.title}</h4>
              <p>{toast.description}</p>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="ml-2 text-white hover:text-gray-200"
            >
              ×
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}