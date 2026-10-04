import { motion } from "motion/react"
import { AppService } from "@bindings/Cyrene-launcher/internal/app-service"
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
        <div className="fixed inset-0 z-50 h-full flex items-center justify-center bg-black/55 backdrop-blur-md">        <div className="app-modal relative w-[90%] max-w-2xl rounded-xl">
            <div className="border-b border-purple-500/30 px-6 py-4 mb-4 flex justify-between items-center">
                <h3 className="font-bold text-xl text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-cyan-600">
                    Confirm Action
                </h3>
                <motion.button
                    whileHover={{ scale: 1.1, rotate: 90 }}
                    transition={{ duration: 0.2 }}
                    className="btn btn-circle btn-md btn-error absolute right-3 top-3"
                    onClick={onClose}
                >
                    ✕
                </motion.button>
            </div>

            <div className="px-6 pt-2 pb-6">
                <p className="mb-4 text-lg">
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
                    <label htmlFor="dontAskAgain" className="text-sm font-semibold text-accent">
                        Do not ask me again
                    </label>
                </div>

                <div className="grid grid-cols-2 justify-end gap-3">
                    <button
                        className="btn btn-warning"
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
                        className="btn btn-error btn-outline"
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