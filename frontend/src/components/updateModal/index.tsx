import { Download, X } from "lucide-react"
import { motion } from "motion/react"
import useLauncherStore from "@/stores/launcherStore"

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
  const { isDownloading, progressDownload, downloadSpeed, downloadType } = useLauncherStore()

  if (!isOpen) return null

  return (
    <div
      className="cyrene-dialog-overlay"
      onMouseDown={(event) => {
        if (!isDownloading && event.target === event.currentTarget) onClose()
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
          if (!isDownloading && event.key === "Escape") onClose()
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
            disabled={isDownloading}
            style={{ opacity: isDownloading ? 0.4 : 1, cursor: isDownloading ? "not-allowed" : "pointer" }}
            aria-label="Close dialog"
          >
            <X size={17} />
          </button>
        </header>

        <div className="cyrene-dialog__body">
          <p id="update-dialog-message">{message}</p>

          {/* Cyrene Theme Download Progress */}
          {isDownloading && (
            <div
              style={{
                marginTop: "16px",
                padding: "14px 16px",
                borderRadius: "14px",
                background: "rgba(0, 0, 0, 0.28)",
                border: "1px solid rgba(242, 217, 155, 0.25)",
                boxShadow: "inset 0 1px 3px rgba(0, 0, 0, 0.4)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <span style={{ fontSize: "12px", color: "#e2d9eb", display: "flex", alignItems: "center", gap: "7px" }}>
                  <span
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      background: "var(--cyrene-gold, #f2d99b)",
                      boxShadow: "0 0 8px #f2d99b",
                      display: "inline-block",
                    }}
                  />
                  {downloadType || "Downloading package..."}
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  {downloadSpeed && (
                    <span
                      style={{
                        fontSize: "11px",
                        color: "#d0c0f3",
                        fontFamily: "monospace",
                        background: "rgba(255, 255, 255, 0.06)",
                        padding: "1px 6px",
                        borderRadius: "6px",
                        border: "1px solid rgba(255, 255, 255, 0.08)",
                      }}
                    >
                      {downloadSpeed}
                    </span>
                  )}
                  <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--cyrene-gold, #f2d99b)", fontFamily: "monospace" }}>
                    {progressDownload.toFixed(1)}%
                  </span>
                </div>
              </div>

              {/* Progress track */}
              <div
                style={{
                  height: "8px",
                  borderRadius: "99px",
                  background: "rgba(0, 0, 0, 0.55)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  overflow: "hidden",
                  padding: "1px",
                }}
              >
                <motion.div
                  style={{
                    height: "100%",
                    borderRadius: "99px",
                    background: "linear-gradient(90deg, #edc4de, #d0c0f3, #f2d99b)",
                    boxShadow: "0 0 14px rgba(242, 217, 155, 0.5), 0 0 6px rgba(208, 192, 243, 0.7)",
                  }}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, Math.max(0, progressDownload))}%` }}
                  transition={{ type: "tween", ease: "linear", duration: 0.05 }}
                />
              </div>

              <div style={{ marginTop: "8px", fontSize: "11px", color: "#a89eb6", textAlign: "center" }}>
                {progressDownload < 100 ? "กำลังดาวน์โหลดไฟล์ กรุณารอสักครู่..." : "ดาวน์โหลดเสร็จสิ้น!"}
              </div>
            </div>
          )}

          <div className="cyrene-dialog__actions">
            {buttons.map((btn, index) => (
              <button
                key={`${btn.text}-${index}`}
                type="button"
                disabled={btn.disabled || isDownloading}
                className={`cyrene-dialog__button ${
                  btn.variant === "primary"
                    ? "cyrene-dialog__button--primary"
                    : btn.variant === "error"
                      ? "cyrene-dialog__button--danger"
                      : "cyrene-dialog__button--outline"
                }`}
                onClick={btn.onClick}
              >
                {isDownloading && btn.variant === "primary" ? (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                    <span
                      style={{
                        width: "12px",
                        height: "12px",
                        borderRadius: "50%",
                        border: "2px solid rgba(40, 26, 49, 0.3)",
                        borderTopColor: "#281a31",
                        animation: "patch-spin 800ms linear infinite",
                      }}
                    />
                    กำลังดาวน์โหลด ({progressDownload.toFixed(0)}%)
                  </span>
                ) : (
                  btn.text
                )}
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
