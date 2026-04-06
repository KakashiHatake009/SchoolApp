import { forwardRef } from 'react'
import { clsx } from 'clsx'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className, ...props }, ref) => (
    <div className="flex flex-col gap-1">
      {label && <label className="text-sm text-gray-600">{label}</label>}
      <input
        ref={ref}
        className={clsx(
          'w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-800 placeholder-gray-400',
          'focus:outline-none focus:border-[#1565c0] focus:ring-1 focus:ring-[#1565c0]',
          error && 'border-red-500',
          className,
        )}
        {...props}
      />
      {error?.trim() && <p className="text-xs text-red-500">{error}</p>}
    </div>
  ),
)
Input.displayName = 'Input'
