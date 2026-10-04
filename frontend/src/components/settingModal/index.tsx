import { AppService } from '@bindings/Cyrene-launcher/internal/app-service'
import useSettingStore from "@/stores/settingStore"
import { Check, Languages, Monitor, Power, X } from "lucide-react"
import i18n from "i18next"

export default function SettingModal({
    isOpen,
    onClose
}: {
    isOpen: boolean
    onClose: () => void
}) {
    const { closingOption, setClosingOption } = useSettingStore()
    const activeLanguage = i18n.resolvedLanguage ?? i18n.language

    if (!isOpen) return null

    const changeLang = (lang: string) => {
        i18n.changeLanguage(lang)
        localStorage.setItem("lang", lang)
        window.location.reload()
    }

    const handleResize = (width: number, height: number) => {
        AppService.SetWindowSize(width, height)
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
