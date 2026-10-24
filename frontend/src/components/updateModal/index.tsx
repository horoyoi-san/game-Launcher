import { Download, X } from "lucide-react"

interface UpdateModalProps {
  isOpen: boolean
  title: string
  message: string
  buttons: {
    text: string
    onClick: () => Promise<void> | void
    variant?: "primary" | "error" | "outline"
    disabled?: boolean
  }[]
  onClose: () => void
}

export default function UpdateModal({ isOpen, title, message, buttons, onClose }: UpdateModalProps) {
  if (!isOpen) return null

  return (
    <div
      className="sunbringer-dialog-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        className="sunbringer-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="update-dialog-title"
        aria-describedby="update-dialog-message"
        tabIndex={-1}
        autoFocus
        onKeyDown={(event) => {
          if (event.key === "Escape") onClose()
        }}
      >
        <header className="sunbringer-dialog__header">
          <span className="sunbringer-dialog__icon"><Download size={19} /></span>
          <div>
            <span className="eyebrow">SUNBRINGER</span>
            <h2 id="update-dialog-title">{title}</h2>
          </div>
          <button
            type="button"
            className="sunbringer-dialog__close"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={17} />
          </button>
        </header>

        <div className="sunbringer-dialog__body">
          <p id="update-dialog-message">{message}</p>
          <div className="sunbringer-dialog__actions">
            {buttons.map((btn, index) => (
              <button
                key={`${btn.text}-${index}`}
                type="button"
                disabled={btn.disabled}
                className={`sunbringer-dialog__button ${
                  btn.variant === "primary"
                    ? "sunbringer-dialog__button--primary"
                    : btn.variant === "error"
                      ? "sunbringer-dialog__button--danger"
                      : "sunbringer-dialog__button--outline"
                }`}
                onClick={btn.onClick}
              >
                {btn.text}
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
