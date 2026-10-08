import { Download, X } from "lucide-react"

interface UpdateModalProps {
  isOpen: boolean
  title: string
  message: string
  buttons: {
    text: string
    onClick: () => Promise<void> | void
    variant?: "primary" | "error" | "outline"
  }[]
  onClose: () => void
}

export default function UpdateModal({ isOpen, title, message, buttons, onClose }: UpdateModalProps) {
  if (!isOpen) return null

  return (
    <div
      className="cyrene-dialog-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        className="cyrene-dialog"
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
        <header className="cyrene-dialog__header">
          <span className="cyrene-dialog__icon"><Download size={19} /></span>
          <div>
            <span className="eyebrow">CYRENE LAUNCHER</span>
            <h2 id="update-dialog-title">{title}</h2>
          </div>
          <button
            type="button"
            className="cyrene-dialog__close"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={17} />
          </button>
        </header>

        <div className="cyrene-dialog__body">
          <p id="update-dialog-message">{message}</p>
          <div className="cyrene-dialog__actions">
            {buttons.map((btn, index) => (
              <button
                key={`${btn.text}-${index}`}
                type="button"
                className={`cyrene-dialog__button ${
                  btn.variant === "primary"
                    ? "cyrene-dialog__button--primary"
                    : btn.variant === "error"
                      ? "cyrene-dialog__button--danger"
                      : "cyrene-dialog__button--outline"
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
