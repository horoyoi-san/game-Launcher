import { motion } from "motion/react"
import { AppService } from "@bindings/SilwerWolf999-launcher/internal/app-service"
import { toast } from "react-toastify"
import useSettingStore from "@/stores/settingStore"

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
        <div className="fixed inset-0 z-[100] flex h-full items-center justify-center bg-[#05060c]/85 p-4 backdrop-blur-md">
            <div className="arcade-frame relative w-[90%] max-w-2xl text-white">
            <div className="mb-4 flex items-center justify-between border-b border-cyan-300/25 px-6 py-4">
                <h3 className="font-black uppercase tracking-wider text-cyan-100">
                    Confirm Action
                </h3>
                <motion.button
                    whileHover={{ scale: 1.1, rotate: 90 }}
                    transition={{ duration: 0.2 }}
                    aria-label="Close confirmation"
                    className="arcade-button arcade-button--danger grid size-9 place-items-center"
                    onClick={onClose}
                >
                    ✕
                </motion.button>
            </div>

            <div className="px-6 pb-6 pt-2">
                <p className="mb-4 text-base leading-relaxed text-white/80">
                    Do you want to minimize the application to the system tray or close the application?
                </p>

                <div className="flex items-center mb-4">
                    <input
                        id="dontAskAgain"
                        type="checkbox"
                        className="checkbox checkbox-sm mr-2"
                        checked={!closingOption.isAsk}
                        onChange={(e) => setClosingOption({ isMinimize: closingOption.isMinimize, isAsk: !e.target.checked })}
                    />
                    <label htmlFor="dontAskAgain" className="text-sm font-semibold text-cyan-100">
                        Do not ask me again
                    </label>
                </div>

                <div className="grid grid-cols-2 justify-end gap-3">
                    <button
                        className="arcade-button arcade-button--primary min-h-11 px-4 text-xs"
                        onClick={async () => {
                            onClose()
                            const [success, message] = await AppService.HideApp()
                            if (!success) toast.error(message)
                            if (!closingOption.isAsk) {
                                setClosingOption({ isMinimize: true, isAsk: false })
                            }
                        }}
                    >
                        Minimize
                    </button>
                    <button
                        className="arcade-button arcade-button--danger min-h-11 px-4 text-xs"
                        onClick={async () => {
                            onClose()
                            const [success, message] = await AppService.CloseApp()
                            if (!success) toast.error(message)
                            if (!closingOption.isAsk) {
                                setClosingOption({ isMinimize: false, isAsk: false })
                            }
                        }}
                    >
                        Close
                    </button>
                    </div>
                </div>
        </div>
    </div>
    )
}