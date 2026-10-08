import { motion } from "framer-motion"

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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#05060c]/85 p-4 backdrop-blur-sm">
      <div className="arcade-frame relative max-h-[90vh] w-[90%] max-w-5xl overflow-y-auto text-white">
        <motion.button
          whileHover={{ scale: 1.1, rotate: 90 }}
          transition={{ duration: 0.2 }}
          aria-label="Close"
          className="arcade-button arcade-button--danger absolute right-3 top-3 grid size-9 place-items-center"
          onClick={onClose}
        >
          ✕
        </motion.button>

        <div className="mb-4 border-b border-cyan-300/25 px-6 py-4">
          <h3 className="font-black uppercase tracking-wider text-cyan-100">
            {title}
          </h3>
        </div>

        <div className="px-6 pb-6">
          <div className="mb-6">
            <p className="text-base leading-relaxed text-white/75">{message}</p>
          </div>

          <div className="flex justify-end gap-3">
            {buttons.map((btn, idx) => (
              <motion.button
                key={idx}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`arcade-button min-h-10 px-4 text-xs ${btn.variant === "primary"
                    ? "arcade-button--primary"
                    : btn.variant === "error"
                      ? "arcade-button--danger"
                      : "bg-[#101322] text-white/80"
                  }`}
                onClick={btn.onClick}
              >
                {btn.text}
              </motion.button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
