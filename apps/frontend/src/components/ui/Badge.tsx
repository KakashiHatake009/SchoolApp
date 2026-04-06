import { clsx } from 'clsx'

interface BadgeProps {
  variant?: 'draft' | 'published' | 'booked' | 'not_booked' | 'active' | 'inactive' | 'trial'
  children: React.ReactNode
  className?: string
}

const styles: Record<string, string> = {
  draft: 'border border-gray-400 text-gray-600 bg-white',
  published: 'border border-[#1565c0] text-[#1565c0] bg-white',
  booked: 'bg-green-100 text-green-700',
  not_booked: 'bg-gray-100 text-gray-600',
  active: 'bg-green-100 text-green-700',
  inactive: 'bg-red-100 text-red-700',
  trial: 'bg-yellow-100 text-yellow-700',
}

export function Badge({ variant = 'draft', children, className }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded px-2 py-0.5 text-xs font-medium',
        styles[variant],
        className,
      )}
    >
      {children}
    </span>
  )
}
