'use client'

import { useState, forwardRef } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export const PasswordInput = forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  function PasswordInput({ className, ...props }, ref) {
    const [visivel, setVisivel] = useState(false)
    return (
      <div className="relative">
        <Input
          {...props}
          ref={ref}
          type={visivel ? 'text' : 'password'}
          className={cn('pr-9', className)}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setVisivel(v => !v)}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          title={visivel ? 'Ocultar senha' : 'Mostrar senha'}
        >
          {visivel ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    )
  }
)
