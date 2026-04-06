import { forwardRef } from 'react'
import { clsx } from 'clsx'

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  options: { value: string; label: string }[]
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, className, ...props }, ref) => (
    <div className="flex flex-col gap-1">
      {label && <label className="text-sm text-gray-600">{label}</label>}
      <select
        ref={ref}
        className={clsx(
          'w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-800 bg-white',
          'focus:outline-none focus:border-[#1565c0] focus:ring-1 focus:ring-[#1565c0]',
          error && 'border-red-500',
          className,
        )}
        {...props}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error?.trim() && <p className="text-xs text-red-500">{error}</p>}
    </div>
  ),
)
Select.displayName = 'Select'
