import { useEffect, useState } from "react"
import { AppService } from '@bindings/sunbringer-launcher/internal/app-service'
import useSettingStore from "@/stores/settingStore"
import { Check, Download, Languages, LoaderCircle, Monitor, Power, RefreshCw, Server, X, Sparkles, ShieldCheck } from "lucide-react"
import i18n from "i18next"
import { CheckUpdateLauncher, UpdateLauncher } from "@/helper"
import { GitService } from "@bindings/sunbringer-launcher/internal/git-service"
import { UpdatePatch } from "@/helper/patch"

export default function SettingModal({
    isOpen,
    onClose
}: {
    isOpen: boolean
    onClose: () => void
}) {
    const { closingOption, setClosingOption, gameDir, serverChoice, setServerChoice } = useSettingStore()
    const activeLanguage = i18n.resolvedLanguage ?? i18n.language
    const [isCheckingUpdates, setIsCheckingUpdates] = useState(false)
    const [isInstallingUpdate, setIsInstallingUpdate] = useState(false)
    const [currentLauncherVersion, setCurrentLauncherVersion] = useState("...")
    const [availableLauncherVersion, setAvailableLauncherVersion] = useState("")
    const [updateMessage, setUpdateMessage] = useState("")
    const [updateError, setUpdateError] = useState("")
    const [isCheckingPatch, setIsCheckingPatch] = useState(false)
    const [isUpdatingPatch, setIsUpdatingPatch] = useState(false)
    const [patchUpdateAvailable, setPatchUpdateAvailable] = useState(false)
    const [patchUpdateMessage, setPatchUpdateMessage] = useState("")
    const [patchUpdateError, setPatchUpdateError] = useState("")
    const [serverGameVersion, setServerGameVersion] = useState("")
    const [serverGameVersionError, setServerGameVersionError] = useState("")
    const [isCheckingServerGameVersion, setIsCheckingServerGameVersion] = useState(false)
    const [activeSection, setActiveSection] = useState("connection")

    useEffect(() => {
        setPatchUpdateAvailable(false)
        setPatchUpdateMessage("")
        setPatchUpdateError("")
    }, [gameDir])

    useEffect(() => {
        if (!isOpen) return
        let cancelled = false
        setServerGameVersion("")
        setServerGameVersionError("")
        void GitService.GetNAPServerGameVersion(serverChoice)
            .then(([version, error]) => {
                if (cancelled) return
                if (error) setServerGameVersionError(error)
                else setServerGameVersion(version)
            })
            .catch((error: unknown) => {
                if (!cancelled) setServerGameVersionError(error instanceof Error ? error.message : "Unable to read server game version")
            })
        return () => { cancelled = true }
    }, [isOpen, serverChoice])

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

    const checkPatchVersion = async () => {
        if (!gameDir) {
            setPatchUpdateError("Select the NAP game folder on the Home screen first.")
            return
        }
        setIsCheckingPatch(true)
        setPatchUpdateAvailable(false)
        setPatchUpdateMessage("")
        setPatchUpdateError("")
        try {
            const [isCurrent, error] = await GitService.IsNAPPatchCurrent(gameDir)
            if (error) throw new Error(error)
            setPatchUpdateAvailable(!isCurrent)
            setPatchUpdateMessage(isCurrent
                ? "The installed NAP patch is up to date."
                : "A newer patch is available, or the patch is not installed yet.")
        } catch (error) {
            setPatchUpdateError(error instanceof Error ? error.message : "Unable to check for NAP patch updates")
        } finally {
            setIsCheckingPatch(false)
        }
    }

    const installPatchUpdate = async () => {
        if (!gameDir || isUpdatingPatch) return
        setIsUpdatingPatch(true)
        setPatchUpdateError("")
        try {
            const installed = await UpdatePatch(gameDir)
            if (!installed) throw new Error("NAP patch update could not be installed. Check the launcher log for details.")
            setPatchUpdateAvailable(false)
            setPatchUpdateMessage("The latest NAP patch has been installed.")
        } catch (error) {
            setPatchUpdateError(error instanceof Error ? error.message : "NAP patch update failed")
        } finally {
            setIsUpdatingPatch(false)
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

                <div className="settings-console">
                    <nav className="settings-console__rail" aria-label="Settings sections">
                        <span className="settings-console__rail-label">SYSTEM</span>
                        {[
                            { id: "connection", label: "Game server", sub: "NAP BACKEND", icon: Server },
                            { id: "display", label: "Display", sub: "WINDOW", icon: Monitor },
                            { id: "language", label: "Language", sub: "INTERFACE", icon: Languages },
                            { id: "updates", label: "Updates", sub: "VERSION", icon: RefreshCw },
                            { id: "closing", label: "Shutdown", sub: "BEHAVIOR", icon: Power },
                        ].map(({ id, label, sub, icon: Icon }) => (
                            <button key={id} type="button" className={`settings-console__nav ${activeSection === id ? "is-active" : ""}`} onClick={() => setActiveSection(id)} aria-current={activeSection === id ? "page" : undefined}>
                                <Icon size={17} /><span><strong>{label}</strong><small>{sub}</small></span><i />
                            </button>
                        ))}
                        <div className="settings-console__signal"><span /><b>LOCAL CONFIG</b><small>SUNBRINGER / NAP</small></div>
                    </nav>
                    <div className="settings-modal__content settings-console__page">
                    <div className="settings-console__page-head"><span>CONTROL NODE / 0{["connection", "display", "language", "updates", "closing"].indexOf(activeSection) + 1}</span><Sparkles size={16} /></div>
                    {activeSection === "updates" && <>
                    <section className="settings-section settings-section--console settings-update-card">
                        <div className="settings-section__heading">
                            <span className="settings-section__icon"><RefreshCw size={17} /></span>
                            <div>
                                <h3>Launcher updates</h3>
                                <p>Installed version: {currentLauncherVersion}</p>
                            </div>
                        </div>
                        <div className="settings-update-card__actions">
                            <button
                                type="button"
                                className="settings-choice settings-update-card__button"
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
                                    className="settings-choice settings-update-card__button"
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
                        {updateMessage && <p aria-live="polite" className="settings-update-card__message">{updateMessage}</p>}
                        {updateError && <p role="alert" className="settings-update-card__message is-error">{updateError}</p>}
                    </section>

                    <section className="settings-section settings-section--console settings-update-card">
                        <div className="settings-section__heading">
                            <span className="settings-section__icon"><ShieldCheck size={17} /></span>
                            <div>
                                <h3>NAP patch updates</h3>
                                <p>Check and install the latest NAP patch for this game folder.</p>
                            </div>
                        </div>
                        <div className="settings-update-card__target">
                            <span>GAME FOLDER</span>
                            <code title={gameDir || undefined}>{gameDir || "No game folder selected"}</code>
                        </div>
                        <div className="settings-update-card__actions">
                            <button
                                type="button"
                                className="settings-choice settings-update-card__button"
                                onClick={() => void checkPatchVersion()}
                                disabled={!gameDir || isCheckingPatch || isUpdatingPatch}
                            >
                                {isCheckingPatch
                                    ? <LoaderCircle size={16} className="animate-spin" />
                                    : <RefreshCw size={16} />}
                                {isCheckingPatch ? "Checking patch…" : "Check patch updates"}
                            </button>
                            {patchUpdateAvailable && (
                                <button
                                    type="button"
                                    className="settings-choice settings-update-card__button"
                                    onClick={() => void installPatchUpdate()}
                                    disabled={isUpdatingPatch || isCheckingPatch}
                                >
                                    {isUpdatingPatch
                                        ? <LoaderCircle size={16} className="animate-spin" />
                                        : <Download size={16} />}
                                    {isUpdatingPatch ? "Updating patch…" : "Update NAP patch"}
                                </button>
                            )}
                        </div>
                        {patchUpdateMessage && <p aria-live="polite" className="settings-update-card__message">{patchUpdateMessage}</p>}
                        {patchUpdateError && <p role="alert" className="settings-update-card__message is-error">{patchUpdateError}</p>}
                    </section>
                    </>}

                    {activeSection === "display" && <section className="settings-section settings-section--console">
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
                    </section>}

                    {activeSection === "connection" && <section className="settings-section settings-section--console">
                        <div className="settings-section__heading">
                            <span className="settings-section__icon"><Server size={17} /></span>
                            <div>
                                <h3>NAP game server</h3>
                                <p>Choose which local server Sunbringer starts with the game.</p>
                            </div>
                        </div>
                        <div className="settings-patch-info">
                            <Check size={18} />
                            <span><strong>Client patch route active</strong><small>The NAP client patch is used with either server option.</small></span>
                        </div>
                        <div className="settings-update-card__target">
                            <span>SUPPORTED GAME VERSION · {serverChoice === "eldreda" ? "ELDREDA" : "REMIELLE"}</span>
                            <code>{serverGameVersion || (serverGameVersionError ? "Version unavailable" : "Checking…")}</code>
                            <button
                                type="button"
                                className="settings-version-check"
                                onClick={async () => {
                                    setIsCheckingServerGameVersion(true)
                                    setServerGameVersion("")
                                    setServerGameVersionError("")
                                    try {
                                        const [version, error] = await GitService.GetNAPServerGameVersion(serverChoice)
                                        if (error) setServerGameVersionError(error)
                                        else setServerGameVersion(version)
                                    } catch (error) {
                                        setServerGameVersionError(error instanceof Error ? error.message : "Unable to read server game version")
                                    } finally {
                                        setIsCheckingServerGameVersion(false)
                                    }
                                }}
                                disabled={isCheckingServerGameVersion}
                            >
                                {isCheckingServerGameVersion
                                    ? <LoaderCircle size={14} className="animate-spin" />
                                    : <RefreshCw size={14} />}
                                {isCheckingServerGameVersion ? "Checking…" : "Check version"}
                            </button>
                            {serverGameVersionError && <small className="settings-update-card__message is-error">{serverGameVersionError}</small>}
                        </div>
                        <div className="settings-choice-grid settings-server-options">
                            <button type="button" className={`settings-choice ${serverChoice === "remielle" ? "is-selected" : ""}`} onClick={() => setServerChoice("remielle")} aria-pressed={serverChoice === "remielle"}>
                                <span>SERVER 01 · ZIG 0.16.0</span>
                                <strong>Remielle</strong>
                                <small>Current server option</small>
                                {serverChoice === "remielle" && <Check size={15} />}
                            </button>
                            <button type="button" className={`settings-choice ${serverChoice === "eldreda" ? "is-selected" : ""}`} onClick={() => setServerChoice("eldreda")} aria-pressed={serverChoice === "eldreda"}>
                                <span>SERVER 02 · ZIG 0.17.0</span>
                                <strong>Eldreda</strong>
                                <small>Builds from Eldreda source</small>
                                {serverChoice === "eldreda" && <Check size={15} />}
                            </button>
                        </div>
                    </section>}

                    {activeSection === "language" && <section className="settings-section settings-section--console">
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
                    </section>}

                    {activeSection === "closing" && <section className="settings-section settings-section--console settings-section--closing">
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
                    </section>}
                    </div>
                </div>

                <footer className="settings-modal__footer">
                    <span>Sunbringer</span>
                    <button type="button" onClick={onClose}>Done</button>
                </footer>
            </section>
        </div>
    )
}
