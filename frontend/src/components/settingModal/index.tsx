import { useState } from "react"
import { AlertTriangle, Check, Languages, LoaderCircle, Monitor, Power, RefreshCw, Settings2, X } from "lucide-react"
import { CheckUpdateLauncher } from "@/helper"
import useSettingStore from "@/stores/settingStore"
import { toast } from "react-toastify"
import { AppService } from "@bindings/SilwerWolf999-launcher/internal/app-service"

type UpdateStatus = "idle" | "checking"

const cardClassName = "arcade-card p-5 transition-colors hover:border-cyan-200/60"
const iconClassName = "grid size-10 shrink-0 place-items-center border border-cyan-200/35 bg-cyan-300/10 text-cyan-100"

export default function SettingModal({
    isOpen,
    onClose
}: {
    isOpen: boolean
    onClose: () => void
}) {
    const { closingOption, setClosingOption } = useSettingStore()
    const [updateStatus, setUpdateStatus] = useState<UpdateStatus>("idle")
    const [updateError, setUpdateError] = useState("")

    if (!isOpen) return null

    const checkUpdate = async () => {
        setUpdateStatus("checking")
        setUpdateError("")
        try {
            const launcherData = await CheckUpdateLauncher()
            if (!launcherData.isUpdate) {
                toast.success("Launcher is already up to date")
                return
            }
            toast.info(`Launcher update ${launcherData.version} is available`)
        } catch (error) {
            const message = error instanceof Error ? error.message : "Unable to check for launcher updates"
            setUpdateError(message.includes("404")
                ? "Update feed is not published yet. The Sophon.Downloader release needs a latest.json asset."
                : message)
        } finally {
            setUpdateStatus("idle")
        }
    }

    const handleResize = (width: number, height: number) => {
        AppService.SetWindowSize(width, height)
    }

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-[#05060c]/85 p-4 backdrop-blur-xl"
            role="presentation"
        >
            <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
                <div className="absolute left-1/2 top-1/2 size-[34rem] -translate-x-1/2 -translate-y-1/2 bg-fuchsia-500/10 blur-[120px]" />
                <div className="absolute left-[18%] top-[12%] size-56 bg-cyan-400/10 blur-[100px]" />
            </div>

            <section
                role="dialog"
                aria-modal="true"
                aria-labelledby="settings-title"
                className="arcade-frame relative my-auto flex max-h-[min(780px,calc(100vh-2rem))] w-full max-w-lg flex-col overflow-hidden text-white"
            >
                <header className="flex shrink-0 items-center justify-between border-b border-white/10 px-6 py-5">
                    <div className="flex items-center gap-3">
                        <div className="grid size-11 place-items-center border border-fuchsia-300/50 bg-gradient-to-br from-fuchsia-400/20 to-cyan-300/15 text-cyan-100 ring-1 ring-white/10">
                            <Settings2 size={21} />
                        </div>
                        <div>
                            <h2 id="settings-title" className="bg-gradient-to-r from-fuchsia-300 to-cyan-200 bg-clip-text text-xl font-extrabold text-transparent">
                                Settings
                            </h2>
                            <p className="mt-0.5 text-xs text-white/45">Customize your launcher experience</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        aria-label="Close settings"
                        onClick={onClose}
                        className="grid size-9 place-items-center border-2 border-rose-200/70 bg-rose-600 text-white shadow-[3px_3px_0_rgba(250,77,255,0.35)] transition hover:scale-105 hover:bg-rose-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-200"
                    >
                        <X size={17} strokeWidth={2.5} />
                    </button>
                </header>

                <div className="min-h-0 space-y-4 overflow-y-auto px-5 py-5 sm:px-6">
                    <section className={cardClassName} aria-labelledby="launcher-update-title">
                        <div className="flex gap-3">
                            <div className={iconClassName}><RefreshCw size={18} /></div>
                            <div className="min-w-0 flex-1">
                                <h3 id="launcher-update-title" className="font-bold">Launcher Update</h3>
                                <p className="mt-1 text-sm leading-relaxed text-white/55">
                                    Check whether you are using the latest launcher version.
                                </p>
                                {updateError && (
                                    <div role="alert" className="mt-3 flex gap-2 border border-rose-300/25 bg-rose-300/10 p-3 text-xs leading-relaxed text-rose-100">
                                        <AlertTriangle size={15} className="mt-0.5 shrink-0 text-rose-200" />
                                        <span>{updateError}</span>
                                    </div>
                                )}
                                <button
                                    type="button"
                                    disabled={updateStatus === "checking"}
                                    onClick={checkUpdate}
                                    className="arcade-button mt-4 inline-flex min-h-10 items-center justify-center gap-2 bg-gradient-to-r from-fuchsia-600 to-cyan-600 px-4 text-xs text-white shadow-lg disabled:cursor-wait disabled:opacity-60"
                                >
                                    {updateStatus === "checking"
                                        ? <><LoaderCircle size={16} className="animate-spin" /> Checking...</>
                                        : "Check for Launcher Updates"}
                                </button>
                            </div>
                        </div>
                    </section>

                    <section className={cardClassName} aria-labelledby="window-size-title">
                        <div className="flex gap-3">
                            <div className={iconClassName}><Monitor size={19} /></div>
                            <div className="min-w-0 flex-1">
                                <h3 id="window-size-title" className="font-bold">Window Size</h3>
                                <p className="mt-1 text-sm text-white/55">Choose a resolution for the launcher window.</p>
                                <div className="mt-4 grid grid-cols-2 gap-2">
                                    {[{ label: "1280 × 720", width: 1280, height: 720 }, { label: "1920 × 1080", width: 1920, height: 1080 }].map((size) => (
                                        <button
                                            key={size.label}
                                            type="button"
                                            onClick={() => handleResize(size.width, size.height)}
                                            className="arcade-button min-h-10 px-3 text-xs text-white/80"
                                        >
                                            {size.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </section>

                    <section className={cardClassName} aria-labelledby="language-title">
                        <div className="flex items-center gap-3">
                            <div className={iconClassName}><Languages size={19} /></div>
                            <div className="min-w-0 flex-1">
                                <h3 id="language-title" className="font-bold">Language</h3>
                                <p className="mt-1 text-sm text-white/55">Application interface language selection.</p>
                            </div>
                            <span className="rounded-full border border-amber-200/15 bg-amber-200/[0.06] px-3 py-1 text-xs font-medium text-amber-100/65">
                                Coming soon
                            </span>
                        </div>
                    </section>

                    <section className={cardClassName} aria-labelledby="closing-options-title">
                        <div className="flex gap-3">
                            <div className={iconClassName}><Power size={19} /></div>
                            <div className="min-w-0 flex-1">
                                <h3 id="closing-options-title" className="font-bold">Closing Options</h3>
                                <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-xl border border-white/[0.07] bg-white/[0.03] p-3 transition hover:bg-white/[0.06]">
                                    <input
                                        type="checkbox"
                                        className="checkbox checkbox-secondary mt-0.5 size-5 shrink-0 rounded-full border-fuchsia-300/70 [--chkbg:#d946ef] [--chkfg:white]"
                                        checked={!closingOption.isAsk}
                                        onChange={(event) => {
                                            setClosingOption({
                                                isMinimize: closingOption.isMinimize,
                                                isAsk: !event.target.checked
                                            })
                                        }}
                                    />
                                    <span className="min-w-0">
                                        <span className="flex items-center gap-2 text-sm font-semibold text-cyan-100">
                                            {!closingOption.isAsk && <Check size={14} />}
                                            Do not ask again
                                        </span>
                                        <span className="mt-1 block text-xs leading-relaxed text-amber-200/75">
                                            The launcher will {closingOption.isMinimize ? "minimize to the system tray" : "quit"} automatically when you close it.
                                        </span>
                                    </span>
                                </label>
                            </div>
                        </div>
                    </section>
                </div>

                <footer className="shrink-0 border-t border-white/10 px-6 py-3 text-center text-[11px] text-white/35">
                    SilwerWolf999 Launcher
                </footer>
            </section>
        </div>
    )
}
