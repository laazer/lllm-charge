import React from 'react'
import { cn } from '@/lib/utils'

interface TestComponentProps {
  className?: string
}

export function TestComponent({
  className = ''
}: TestComponentProps) {
  return (
    <main className={cn('', className)}>
      {/* TestComponent UI component */}
    </main>
  )
}
