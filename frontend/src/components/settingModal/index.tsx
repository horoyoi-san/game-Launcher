import { useState } from "react"
import { AppService } from '@bindings/Cyrene-launcher/internal/app-service'
import useSettingStore from "@/stores/settingStore"
import { Check, Download, Languages, LoaderCircle, Monitor, Power, RefreshCw, X } from "lucide-react"
import i18n from "i18next"
import { CheckUpdateLauncher, UpdateLauncher } from "@/helper"

export default function SettingModal({
    isOpen,
    onClose
}: {
    isOpen: boolean
    onClose: () => void
}) {
    const { closingOption, setClosingOption } = useSettingStore()
    const activeLanguage = i18n.resolvedLanguage ?? i18n.language
    const [isCheckingUpdates, setIsCheckingUpdates] = useState(false)
    const [isInstallingUpdate, setIsInstallingUpdate] = useState(false)
    const [currentLauncherVersion, setCurrentLauncherVersion] = useState("...")
    const [availableLauncherVersion, setAvailableLauncherVersion] = useState("")
    const [updateMessage, setUpdateMessage] = useState("")
    const [updateError, setUpdateError] = useState("")

    if (!isOpen) return null

    const changeLang = (lang: string) => {
        i18n.changeLanguage(lang)
        localStorage.setItem("lang", lang)
        window.location.reload()
    }

    const handleResize = (width: number, height: number) => {
        AppService.SetWindowSize(width, height)
    }

    const checkLauncherVersion = async () => {
        setIsCheckingUpdates(true)
        setAvailableLauncherVersion("")
        setUpdateMessage("")
        setUpdateError("")

        try {
            const [currentOk, currentVersion] = await AppService.GetCurrentLauncherVersion()
            if (!currentOk) {
                throw new Error("Unable to read the current launcher version")
            }
            setCurrentLauncherVersion(currentVersion)

            const update = await CheckUpdateLauncher()
            if (!update.isExists) {
                setUpdateMessage("Updates are disabled in development builds.")
            } else if (update.isUpdate) {
                setAvailableLauncherVersion(update.version)
                setUpdateMessage(`Version ${update.version} is available.`)
            } else {
                setUpdateMessage("You are using the latest version.")
            }
        } catch (error) {
            setUpdateError(error instanceof Error ? error.message : "Unable to check for launcher updates")
        } finally {
            setIsCheckingUpdates(false)
        }
    }

    const installLauncherUpdate = async () => {
        if (!availableLauncherVersion || isInstallingUpdate) return
        setIsInstallingUpdate(true)
        setUpdateError("")
        try {
            await UpdateLauncher(availableLauncherVersion)
        } catch (error) {
            setUpdateError(error instanceof Error ? error.message : "Launcher update failed")
            setIsInstallingUpdate(false)
        }
    }

    return (
        <div className="settings-overlay" onMouseDown={(event) => {
            if (event.target === event.currentTarget) onClose()
        }}>
            <section className="settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title">
                <header className="settings-modal__header">
                    <div className="settings-modal__title-icon"><Monitor size={20} /></div>
                    <div>
                        <span className="eyebrow">PREFERENCES</span>
                        <h2 id="settings-title">Settings</h2>
                    </div>
                    <button type="button" className="settings-modal__close" onClick={onClose} aria-label="Close settings">
                        <X size={18} />
                    </button>
                </header>

                <div className="settings-modal__content">
                    <section className="settings-section">
                        <div className="settings-section__heading">
                            <span className="settings-section__icon"><RefreshCw size={17} /></span>
                            <div>
                                <h3>Launcher updates</h3>
                                <p>Installed version: {currentLauncherVersion}</p>
                            </div>
                        </div>
                        <div className="mt-4 flex flex-wrap items-center gap-3">
                            <button
                                type="button"
                                className="settings-choice !flex min-h-11 flex-1 items-center justify-center gap-2"
                                onClick={() => void checkLauncherVersion()}
                                disabled={isCheckingUpdates || isInstallingUpdate}
                            >
                                {isCheckingUpdates
                                    ? <LoaderCircle size={16} className="animate-spin" />
                                    : <RefreshCw size={16} />}
                                {isCheckingUpdates ? "Checking..." : "Check for updates"}
                            </button>
                            {availableLauncherVersion && (
                                <button
                                    type="button"
                                    className="settings-choice !flex min-h-11 flex-1 items-center justify-center gap-2"
                                    onClick={() => void installLauncherUpdate()}
                                    disabled={isInstallingUpdate}
                                >
                                    {isInstallingUpdate
                                        ? <LoaderCircle size={16} className="animate-spin" />
                                        : <Download size={16} />}
                                    {isInstallingUpdate ? "Updating..." : `Update to v${availableLauncherVersion}`}
                                </button>
                            )}
                        </div>
                        {updateMessage && <p className="mt-3 text-sm text-slate-300">{updateMessage}</p>}
                        {updateError && <p role="alert" className="mt-3 text-sm text-rose-300">{updateError}</p>}
                    </section>

                    <section className="settings-section">
                        <div className="settings-section__heading">
                            <span className="settings-section__icon"><Monitor size={17} /></span>
                            <div>
                                <h3>Window size</h3>
                                <p>Choose a display size for the launcher.</p>
                            </div>
                        </div>
                        <div className="settings-choice-grid">
                            <button type="button" className="settings-choice" onClick={() => handleResize(1280, 720)}>
                                <span>HD</span>
                                <strong>1280 <i>×</i> 720</strong>
                                <small>Compact</small>
                            </button>
                            <button type="button" className="settings-choice" onClick={() => handleResize(1920, 1080)}>
                                <span>FHD</span>
                                <strong>1920 <i>×</i> 1080</strong>
                                <small>Full screen</small>
                            </button>
                        </div>
                    </section>

                    <section className="settings-section">
                        <div className="settings-section__heading">
                            <span className="settings-section__icon"><Languages size={17} /></span>
                            <div>
                                <h3>Language</h3>
                                <p>Select the launcher interface language.</p>
                            </div>
                        </div>
                        <div className="settings-language-options">
                            <button
                                type="button"
                                className={`settings-language ${activeLanguage.startsWith("th") ? "is-selected" : ""}`}
                                onClick={() => changeLang("th")}
                                aria-pressed={activeLanguage.startsWith("th")}
                            >
                                <span className="settings-language__flag">TH</span>
                                <span>ไทย</span>
                                {activeLanguage.startsWith("th") && <Check size={16} />}
                            </button>
                            <button
                                type="button"
                                className={`settings-language ${activeLanguage.startsWith("en") ? "is-selected" : ""}`}
                                onClick={() => changeLang("en")}
                                aria-pressed={activeLanguage.startsWith("en")}
                            >
                                <span className="settings-language__flag">EN</span>
                                <span>English</span>
                                {activeLanguage.startsWith("en") && <Check size={16} />}
                            </button>
                        </div>
                    </section>

                    <section className="settings-section settings-section--closing">
                        <div className="settings-section__heading">
                            <span className="settings-section__icon"><Power size={17} /></span>
                            <div>
                                <h3>When closing the launcher</h3>
                                <p>Choose whether to confirm before closing.</p>
                            </div>
                        </div>
                        <label className="settings-toggle-row">
                            <span className="settings-toggle-row__copy">
                                <strong>Don’t ask me again</strong>
                                <small>
                                    Close directly to {closingOption.isMinimize ? "the system tray" : "the desktop"} next time.
                                </small>
                            </span>
                            <input
                                type="checkbox"
                                className="toggle toggle-primary"
                                checked={!closingOption.isAsk}
                                onChange={(event) => {
                                    setClosingOption({
                                        isMinimize: closingOption.isMinimize,
                                        isAsk: !event.target.checked
                                    })
                                }}
                            />
                        </label>
                    </section>
                </div>

                <footer className="settings-modal__footer">
                    <span>Cyrene Launcher</span>
                    <button type="button" onClick={onClose}>Done</button>
                </footer>
            </section>
        </div>
    )
}
