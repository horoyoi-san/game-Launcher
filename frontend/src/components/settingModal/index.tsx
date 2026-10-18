import { useState } from "react"
import { AppService } from '@bindings/Cyrene-launcher/internal/app-service'
import useSettingStore from "@/stores/settingStore"
import useLauncherStore from "@/stores/launcherStore"
import { Check, Download, Languages, LoaderCircle, Monitor, Power, RefreshCw, Server, X } from "lucide-react"
import i18n from "i18next"
import { CheckUpdateLauncher, UpdateLauncher, UpdateServer } from "@/helper"
import { FSService } from "@bindings/Cyrene-launcher/internal/fs-service"
import { GitService } from "@bindings/Cyrene-launcher/internal/git-service"

export default function SettingModal({
    isOpen,
    onClose
}: {
    isOpen: boolean
    onClose: () => void
}) {
    const { closingOption, setClosingOption, connectionMode, setConnectionMode, serverVersion } = useSettingStore()
    const {
        isDownloading: isLauncherDownloading,
        progressDownload,
        downloadType,
        setDownloadSpeed,
        setDownloadType,
        setIsDownloading,
        setProgressDownload,
        setServerReady,
        setUpdateData,
        updateData,
    } = useLauncherStore()
    const activeLanguage = i18n.resolvedLanguage ?? i18n.language
    const [isCheckingUpdates, setIsCheckingUpdates] = useState(false)
    const [isInstallingUpdate, setIsInstallingUpdate] = useState(false)
    const [currentLauncherVersion, setCurrentLauncherVersion] = useState("...")
    const [availableLauncherVersion, setAvailableLauncherVersion] = useState("")
    const [updateMessage, setUpdateMessage] = useState("")
    const [updateError, setUpdateError] = useState("")
    const [isCheckingServerVersion, setIsCheckingServerVersion] = useState(false)
    const [latestServerVersion, setLatestServerVersion] = useState("")
    const [serverVersionMessage, setServerVersionMessage] = useState("")
    const [serverVersionError, setServerVersionError] = useState("")
    const [serverDownloadNeeded, setServerDownloadNeeded] = useState(false)
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

    const checkServerVersion = async () => {
        setIsCheckingServerVersion(true)
        setLatestServerVersion("")
        setServerVersionMessage("")
        setServerVersionError("")
        setServerDownloadNeeded(false)

        try {
            const [latestExists, latestVersion, error] = await GitService.GetLatestHKRPGServerVersion()
            if (!latestExists) {
                throw new Error(error || "Unable to check for server updates")
            }

            setLatestServerVersion(latestVersion)
            const gameServerExists = await FSService.FileExists("./server/gameserver.exe")
            const sdkServerExists = await FSService.FileExists("./server/sdkserver.exe")
            const installed = gameServerExists && sdkServerExists
            const hasKnownInstalledVersion = /^\d+\.\d+\.\d+$/.test(serverVersion)
            setServerDownloadNeeded(!installed || !hasKnownInstalledVersion || serverVersion !== latestVersion)

            if (!installed) {
                setServerVersionMessage(`Server is not installed. Latest version: ${latestVersion}.`)
            } else if (!hasKnownInstalledVersion) {
                setServerVersionMessage(`Installed version is unknown. Latest version: ${latestVersion}.`)
            } else if (serverVersion === latestVersion) {
                setServerVersionMessage(`Server is up to date (version ${latestVersion}).`)
            } else {
                setServerVersionMessage(`Update available: ${serverVersion} → ${latestVersion}.`)
            }
        } catch (error) {
            setServerVersionError(error instanceof Error ? error.message : "Unable to check for server updates")
        } finally {
            setIsCheckingServerVersion(false)
        }
    }

    const downloadServerUpdate = async () => {
        if (isLauncherDownloading || !latestServerVersion) return
        setIsDownloading(true)
        setProgressDownload(0)
        setDownloadSpeed("")
        setServerVersionError("")

        try {
            const updated = await UpdateServer()
            if (!updated) return

            setServerDownloadNeeded(false)
            setServerVersionMessage(`Server is up to date (version ${latestServerVersion}).`)
            setServerReady(true)
            setUpdateData({
                ...updateData,
                server: { isUpdate: false, isExists: true, version: latestServerVersion },
            })
        } catch (error) {
            setServerVersionError(error instanceof Error ? error.message : "Server download failed")
        } finally {
            setDownloadType("")
            setIsDownloading(false)
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
                            <span className="settings-section__icon"><Server size={17} /></span>
                            <div>
                                <h3>Server version</h3>
                                <p>Check the installed server against the latest release.</p>
                            </div>
                        </div>
                        <div className="mt-4 flex flex-wrap items-center gap-3">
                            <button
                                type="button"
                                className="settings-choice !flex min-h-11 flex-1 items-center justify-center gap-2"
                                onClick={() => void checkServerVersion()}
                                disabled={isCheckingServerVersion || isLauncherDownloading}
                            >
                                {isCheckingServerVersion
                                    ? <LoaderCircle size={16} className="animate-spin" />
                                    : <RefreshCw size={16} />}
                                {isCheckingServerVersion ? "Checking..." : "Check server version"}
                            </button>
                        </div>
                        {serverDownloadNeeded && latestServerVersion && (
                            <button
                                type="button"
                                className="settings-choice !mt-3 !flex min-h-11 w-full items-center justify-center gap-2"
                                onClick={() => void downloadServerUpdate()}
                                disabled={isLauncherDownloading}
                            >
                                {isLauncherDownloading
                                    ? <LoaderCircle size={16} className="animate-spin" />
                                    : <Download size={16} />}
                                {isLauncherDownloading ? "Installing..." : `Download and install v${latestServerVersion}`}
                            </button>
                        )}
                        {latestServerVersion && <p className="mt-3 text-sm text-slate-300">Latest version: {latestServerVersion}</p>}
                        {serverVersionMessage && <p className="mt-2 text-sm text-slate-300">{serverVersionMessage}</p>}
                        {serverVersionError && <p role="alert" className="mt-3 text-sm text-rose-300">{serverVersionError}</p>}
                        {isLauncherDownloading && downloadType && (
                            <p className="mt-3 text-sm text-slate-300">{downloadType} {progressDownload.toFixed(1)}%</p>
                        )}
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
                            <span className="settings-section__icon"><Server size={17} /></span>
                            <div>
                                <h3>HKRPG connection method</h3>
                                <p>Choose how the launcher connects the game to the server.</p>
                            </div>
                        </div>
                        <div className="settings-choice-grid">
                            <button
                                type="button"
                                className={`settings-choice ${connectionMode === "proxy" ? "is-selected" : ""}`}
                                onClick={() => setConnectionMode("proxy")}
                                aria-pressed={connectionMode === "proxy"}
                            >
                                <span>RECOMMENDED</span>
                                <strong>Proxy</strong>
                                <small>Run the proxy beside the game</small>
                            </button>
                            <button
                                type="button"
                                className={`settings-choice ${connectionMode === "patch" ? "is-selected" : ""}`}
                                onClick={() => setConnectionMode("patch")}
                                aria-pressed={connectionMode === "patch"}
                            >
                                <span>PATCH</span>
                                <strong>Patched launcher</strong>
                                <small>Install launcher.exe and hkrpg.dll</small>
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
