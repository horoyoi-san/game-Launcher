import { AppService } from "@bindings/sunbringer-launcher/internal/app-service"
import { toast } from "react-toastify"
import useSettingStore from "@/stores/settingStore"
import { Minus, Power, X } from "lucide-react"

export default function CloseModal({
    isOpen,
    onClose
}: {
    isOpen: boolean
    onClose: () => void
}) {
    if (!isOpen) return null
    const { closingOption, setClosingOption } = useSettingStore()

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
                aria-labelledby="close-dialog-title"
                tabIndex={-1}
                autoFocus
                onKeyDown={(event) => {
                    if (event.key === "Escape") onClose()
                }}
            >
                <header className="sunbringer-dialog__header">
                    <span className="sunbringer-dialog__icon"><Power size={19} /></span>
                    <div>
                        <span className="eyebrow">SUNBRINGER</span>
                        <h2 id="close-dialog-title">Confirm Action</h2>
                    </div>
                    <button
                        type="button"
                        className="sunbringer-dialog__close"
                        onClick={onClose}
                        aria-label="Dismiss close confirmation"
                    >
                        <X size={17} />
                    </button>
                </header>

                <div className="sunbringer-dialog__body">
                    <p>Would you like to minimize the launcher to the system tray or close it completely?</p>

                    <label className="sunbringer-dialog__remember">
                        <input
                            type="checkbox"
                            checked={!closingOption.isAsk}
                            onChange={(event) => setClosingOption({
                                isMinimize: closingOption.isMinimize,
                                isAsk: !event.target.checked
                            })}
                        />
                        <span>Do not ask me again</span>
                    </label>

                    <div className="sunbringer-dialog__actions sunbringer-dialog__actions--split">
                        <button
                            type="button"
                            className="sunbringer-dialog__button sunbringer-dialog__button--primary"
                            onClick={async () => {
                                onClose()
                                const [success, message] = await AppService.HideApp()
                                if (!success) toast.error(message)
                                if (!closingOption.isAsk) {
                                    setClosingOption({ isMinimize: true, isAsk: false })
                                }
                            }}
                        >
                            <Minus size={16} />
                            Minimize
                        </button>
                        <button
                            type="button"
                            className="sunbringer-dialog__button sunbringer-dialog__button--danger"
                            onClick={async () => {
                                onClose()
                                const [success, message] = await AppService.CloseApp()
                                if (!success) toast.error(message)
                                if (!closingOption.isAsk) {
                                    setClosingOption({ isMinimize: false, isAsk: false })
                                }
                            }}
                        >
                            <X size={16} />
                            Close
                        </button>
                    </div>
                </div>
            </section>
        </div>
    )
}
