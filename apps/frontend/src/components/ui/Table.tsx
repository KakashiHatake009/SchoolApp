import { clsx } from 'clsx'

interface Column<T> {
  key: string
  header: string
  render?: (row: T) => React.ReactNode
  className?: string
}

interface TableProps<T> {
  columns: Column<T>[]
  data: T[]
  emptyMessage?: string
  className?: string
}

export function Table<T extends { id: string }>({
  columns,
  data,
  emptyMessage = 'No data available.',
  className,
}: TableProps<T>) {
  return (
    <div className={clsx('w-full overflow-x-auto', className)}>
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-[#cfd8dc] text-gray-700">
            {columns.map((col) => (
              <th
                key={col.key}
                className={clsx('px-4 py-3 text-left font-medium', col.className)}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-6 text-center text-gray-400">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row, i) => (
              <tr
                key={row.id}
                className={clsx('border-b border-gray-100', i % 2 === 0 ? 'bg-white' : 'bg-gray-50')}
              >
                {columns.map((col) => (
                  <td key={col.key} className={clsx('px-4 py-3', col.className)}>
                    {col.render
                      ? col.render(row)
                      : String((row as Record<string, unknown>)[col.key] ?? '')}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
