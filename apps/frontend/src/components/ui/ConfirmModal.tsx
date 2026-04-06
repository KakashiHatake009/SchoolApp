import { useState } from 'react'
import { Modal } from './Modal'
import { Button } from './Button'

interface ConfirmModalProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void | Promise<void>
  title: string
  message: string
  confirmLabel?: string
  requireCheckbox?: boolean
  loading?: boolean
}

export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'DELETE',
  requireCheckbox = false,
  loading = false,
}: ConfirmModalProps) {
  const [checked, setChecked] = useState(false)

  const handleClose = () => {
    setChecked(false)
    onClose()
  }

  const canConfirm = !requireCheckbox || checked

  return (
    <Modal open={open} onClose={handleClose} title={title}>
      <p className="text-sm text-gray-600 text-center mb-4">{message}</p>
      {requireCheckbox && (
        <label className="flex items-center gap-2 text-sm text-gray-600 mb-4 cursor-pointer">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="accent-[#1565c0]"
          />
          Select checkbox to confirm decision.
        </label>
      )}
      <div className="flex justify-center gap-3">
        <Button variant="secondary" onClick={handleClose}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={onConfirm}
          disabled={!canConfirm || loading}
          loading={loading}
        >
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  )
}
