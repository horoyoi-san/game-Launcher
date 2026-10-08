import { AppService } from "@bindings/Cyrene-launcher/internal/app-service"
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
            className="cyrene-dialog-overlay"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) onClose()
            }}
        >
            <section
                className="cyrene-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="close-dialog-title"
                tabIndex={-1}
                autoFocus
                onKeyDown={(event) => {
                    if (event.key === "Escape") onClose()
                }}
            >
                <header className="cyrene-dialog__header">
                    <span className="cyrene-dialog__icon"><Power size={19} /></span>
                    <div>
                        <span className="eyebrow">CYRENE LAUNCHER</span>
                        <h2 id="close-dialog-title">Confirm Action</h2>
                    </div>
                    <button
                        type="button"
                        className="cyrene-dialog__close"
                        onClick={onClose}
                        aria-label="Dismiss close confirmation"
                    >
                        <X size={17} />
                    </button>
                </header>

                <div className="cyrene-dialog__body">
                    <p>Would you like to minimize the launcher to the system tray or close it completely?</p>

                    <label className="cyrene-dialog__remember">
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

                    <div className="cyrene-dialog__actions cyrene-dialog__actions--split">
                        <button
                            type="button"
                            className="cyrene-dialog__button cyrene-dialog__button--primary"
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
                            className="cyrene-dialog__button cyrene-dialog__button--danger"
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