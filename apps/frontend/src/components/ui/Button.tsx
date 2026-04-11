import { forwardRef } from 'react'
import { clsx } from 'clsx'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, children, className, disabled, ...props }, ref) => {
    const base =
      'inline-flex items-center justify-center font-medium rounded transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer'

    const variants = {
      primary: 'bg-[#1565c0] hover:bg-[#0d47a1] text-white focus:ring-[#1565c0]',
      secondary: 'bg-white hover:bg-gray-50 text-[#1565c0] border border-[#1565c0] focus:ring-[#1565c0]',
      danger: 'bg-[#1565c0] hover:bg-[#0d47a1] text-white focus:ring-[#1565c0]',
      ghost: 'bg-transparent hover:bg-gray-100 text-gray-700 focus:ring-gray-300',
    }

    const sizes = {
      sm: 'px-3 py-1.5 text-xs tracking-wide',
      md: 'px-5 py-2 text-xs tracking-widest uppercase',
      lg: 'px-6 py-3 text-sm tracking-widest uppercase',
    }

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={clsx(base, variants[variant], sizes[size], className)}
        {...props}
      >
        {loading ? (
          <span className="mr-2 h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
        ) : null}
        {children}
      </button>
    )
  },
)
Button.displayName = 'Button'
