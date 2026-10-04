import { useEffect, useState } from 'react'
import { Folder, Settings, Check, X, Globe, Mic } from 'lucide-react'
import { FSService } from '@bindings/Cyrene-launcher/internal/fs-service'
import { LanguageService } from '@bindings/Cyrene-launcher/internal/language-service'
import { toast } from 'react-toastify'
import useSettingStore from '@/stores/settingStore'

export default function LanguagePage() {
    const { gameDir, setGameDir } = useSettingStore()
    const [folderCheckResult, setFolderCheckResult] = useState<'success' | 'error' | null>(null)

    const [textLang, setTextLang] = useState('')
    const [voiceLang, setVoiceLang] = useState('')

    const [selectedTextLang, setSelectedTextLang] = useState('')
    const [selectedVoiceLang, setSelectedVoiceLang] = useState('')

    const [isLoading, setIsLoading] = useState(false)
    const [isSettingLanguage, setIsSettingLanguage] = useState(false)
    const [isInstallingThaiPatch, setIsInstallingThaiPatch] = useState(false)

    const languageOptions = [
        { value: 'en', label: 'English', flag: '🇺🇸' },
        { value: 'cn', label: 'Chinese', flag: '🇨🇳' },
        { value: 'jp', label: 'Japanese', flag: '🇯🇵' },
        { value: 'kr', label: 'Korean', flag: '🇰🇷' },
        { value: 'th', label: 'Thai', flag: '🇹🇭' }
    ];


    useEffect(() => {
        if (!gameDir) return

        let cancelled = false

        const loadLanguage = async () => {
            const streamingAssetsPath = `${gameDir}/StarRail_Data/StreamingAssets`
            const designDataPath = `${streamingAssetsPath}/DesignData/Windows`
            const exists = await FSService.DirExists(designDataPath)
            if (!exists) {
                if (cancelled) return
                setTextLang("")
                setVoiceLang("")
                setSelectedTextLang("")
                setSelectedVoiceLang("")
                setFolderCheckResult("error")
                setGameDir("")
                return
            }

            if (cancelled) return
            setFolderCheckResult("success")

            try {
                const [ok, textLang, voiceLang, err] = await LanguageService.GetLanguage(streamingAssetsPath)
                if (cancelled) return
                if (!ok) {
                    setTextLang("")
                    setVoiceLang("")
                    setSelectedTextLang("")
                    setSelectedVoiceLang("")
                    toast.error(`Game folder found, but language settings could not be read: ${err}`)
                    return
                }

                setTextLang(textLang)
                setVoiceLang(voiceLang)
                setSelectedTextLang(textLang)
                setSelectedVoiceLang(voiceLang)
            } catch (err: unknown) {
                if (cancelled) return
                setTextLang("")
                setVoiceLang("")
                setSelectedTextLang("")
                setSelectedVoiceLang("")
                toast.error(`Game folder found, but language settings could not be read: ${err instanceof Error ? err.message : String(err)}`)
            }
        }

        loadLanguage().catch((err: unknown) => {
            if (!cancelled) {
                toast.error(`Could not validate game folder: ${err instanceof Error ? err.message : String(err)}`)
                setFolderCheckResult("error")
            }
        })

        return () => {
            cancelled = true
        }
    }, [gameDir])

    const handlePickFolder = async () => {
        try {
            setIsLoading(true)
            const basePath = await FSService.PickFolder()
            if (basePath) {
                const subPath = 'StarRail_Data/StreamingAssets/DesignData/Windows'
                const fullPath = `${basePath}/${subPath}`
                const exists = await FSService.DirExists(fullPath)
                setFolderCheckResult(exists ? 'success' : 'error')
                if (exists) {
                    setGameDir(basePath)
                } else {
                    setGameDir("")
                    toast.error('Game directory not found. Please select the correct folder.')
                }
            } else {
                toast.error('No folder path selected')
                setFolderCheckResult('error')
                setGameDir('')
            }
        } catch (err: unknown) {
            toast.error(`PickFolder error: ${err instanceof Error ? err.message : String(err)}`)
            setFolderCheckResult('error')
        } finally {
            setIsLoading(false)
        }
    }

    const handleSetLanguage = async () => {
        if (!gameDir) {
            toast.error('No folder path selected')
            return
        }
        try {
            setIsSettingLanguage(true)
            const [ok, err] = await LanguageService.SetLanguage(
                `${gameDir}/StarRail_Data/StreamingAssets/DesignData/Windows`,
                selectedTextLang,
                selectedVoiceLang
            )
            if (ok) {
                toast.success('Language set successfully')
                setTextLang(selectedTextLang)
                setVoiceLang(selectedVoiceLang)
            }
            else {
                toast.error(err)
            }

        } catch (err: unknown) {
            toast.error(`SetLanguage error: ${err instanceof Error ? err.message : String(err)}`)
        } finally {
            setIsSettingLanguage(false)
        }
    }

    const handleInstallThaiPatch = async () => {
        if (!gameDir) {
            toast.error('Select the Beta game folder first')
            return
        }
        try {
            setIsInstallingThaiPatch(true)
            const packageDir = await FSService.PickFolder()
            if (!packageDir) {
                toast.error('No Thai patch package folder selected')
                return
            }

            const [ok, message] = await LanguageService.InstallThaiPatch(gameDir, packageDir)
            if (!ok) {
                toast.error(message)
                return
            }

            toast.success(message)
            const streamingAssetsPath = `${gameDir}/StarRail_Data/StreamingAssets`
            const [languageOk, text, voice, error] = await LanguageService.GetLanguage(streamingAssetsPath)
            if (languageOk) {
                setTextLang(text)
                setVoiceLang(voice)
                setSelectedTextLang(current => current || text)
                setSelectedVoiceLang(current => current || voice)
            } else {
                toast.error(`Thai patch installed, but could not reload language settings: ${error}`)
            }
        } catch (err: unknown) {
            toast.error(`Thai patch install error: ${err instanceof Error ? err.message : String(err)}`)
        } finally {
            setIsInstallingThaiPatch(false)
        }
    }

    const getLanguageLabel = (code: string) => {
        const lang = languageOptions.find(l => l.value === code)
        return lang ? `${lang.flag} ${lang.label}` : code
    }

    return (
        <main className="tool-page tool-page--language">
            <div className="tool-page__content">
                <header className="tool-heading">
                    <div className="tool-heading__eyebrow">GAME SETTINGS <span> / </span> LANGUAGE</div>
                    <div className="tool-heading__row">
                        <div>
                            <h1>Language studio</h1>
                            <p>Choose the voice and text language for your game client.</p>
                        </div>
                        <div className={`tool-state ${folderCheckResult === 'success' ? 'is-ready' : ''}`}>
                            <span />
                            {folderCheckResult === 'success' ? 'Game detected' : gameDir ? 'Checking game' : 'Setup required'}
                        </div>
                    </div>
                </header>

                <div className="language-layout">
                    <div className="language-workflow">
                        <section className="studio-panel game-location">
                            <div className="studio-panel__top">
                                <div className="studio-panel__number">01</div>
                                <div>
                                    <h2>Game location</h2>
                                    <p>Connect the launcher to your Star Rail installation.</p>
                                </div>
                            </div>
                            <div className="location-control">
                                <div className={`location-control__icon ${folderCheckResult === 'success' ? 'is-ready' : ''}`}>
                                    {folderCheckResult === 'success' ? <Check size={21} /> : <Folder size={21} />}
                                </div>
                                <div className="location-control__path">
                                    <strong>{gameDir ? 'Game directory selected' : 'No game directory selected'}</strong>
                                    <span title={gameDir}>{gameDir || 'Select the folder that contains StarRail_Data'}</span>
                                </div>
                                <button type="button" onClick={handlePickFolder} disabled={isLoading} className="btn location-control__button">
                                    {isLoading ? 'Selecting…' : gameDir ? 'Change folder' : 'Browse folder'}
                                </button>
                            </div>
                            {folderCheckResult === 'error' && (
                                <div className="inline-status is-error"><X size={16} /> Game directory not found. Select the correct folder.</div>
                            )}
                            {folderCheckResult === 'success' && (
                                <div className="inline-status is-success"><Check size={16} /> Game installation verified</div>
                            )}
                            {gameDir && (
                                <div className="thai-patch">
                                    <div>
                                        <strong>Thai beta patch</strong>
                                        <p>Install the Thai language asset package. Existing changed files are backed up.</p>
                                    </div>
                                    <button type="button" onClick={handleInstallThaiPatch} disabled={isInstallingThaiPatch} className="btn">
                                        {isInstallingThaiPatch ? 'Installing…' : 'Install patch'}
                                    </button>
                                </div>
                            )}
                        </section>

                        <section className={`studio-panel language-choice ${gameDir ? '' : 'is-locked'}`}>
                            <div className="studio-panel__top">
                                <div className="studio-panel__number">02</div>
                                <div>
                                    <h2>Language preferences</h2>
                                    <p>Text and voice can be configured independently.</p>
                                </div>
                            </div>
                            <div className="language-select-grid">
                                <label className="language-select">
                                    <span className="language-select__icon"><Globe size={18} /></span>
                                    <span className="language-select__label">Interface & subtitles</span>
                                    <select
                                        value={selectedTextLang}
                                        onChange={(e) => setSelectedTextLang(e.target.value)}
                                        disabled={!gameDir}
                                    >
                                        <option value="">Choose text language</option>
                                        {languageOptions.map(lang => (
                                            <option key={lang.value} value={lang.value}>{lang.flag} {lang.label}</option>
                                        ))}
                                    </select>
                                </label>
                                <label className="language-select">
                                    <span className="language-select__icon"><Mic size={18} /></span>
                                    <span className="language-select__label">Character voices</span>
                                    <select
                                        value={selectedVoiceLang}
                                        onChange={(e) => setSelectedVoiceLang(e.target.value)}
                                        disabled={!gameDir}
                                    >
                                        <option value="">Choose voice language</option>
                                        {languageOptions.filter(lang => lang.value !== 'th').map(lang => (
                                            <option key={lang.value} value={lang.value}>{lang.flag} {lang.label}</option>
                                        ))}
                                    </select>
                                </label>
                            </div>
                            <div className="language-choice__footer">
                                <span>Voice language requires an available in-game audio package.</span>
                                <button
                                    type="button"
                                    onClick={handleSetLanguage}
                                    disabled={!selectedTextLang || !selectedVoiceLang || isSettingLanguage || !gameDir}
                                    className="btn btn-primary apply-language"
                                >
                                    <Settings size={17} />
                                    {isSettingLanguage ? 'Applying settings…' : 'Apply languages'}
                                </button>
                            </div>
                        </section>
                    </div>

                    <aside className="language-summary">
                        <div className="language-summary__header">
                            <span className="language-summary__orb"><Globe size={20} /></span>
                            <div>
                                <span className="eyebrow">CURRENT CONFIGURATION</span>
                                <h2>Language setup</h2>
                            </div>
                        </div>

                        <div className="language-summary__item">
                            <span>TEXT & UI</span>
                            <strong>{textLang ? getLanguageLabel(textLang) : 'Not detected'}</strong>
                            <small>{textLang ? 'Currently active' : 'Select a game folder to read settings'}</small>
                        </div>
                        <div className="language-summary__item">
                            <span>VOICE OVER</span>
                            <strong>{voiceLang ? getLanguageLabel(voiceLang) : 'Not detected'}</strong>
                            <small>{voiceLang ? 'Currently active' : 'Voice packs are managed by the game'}</small>
                        </div>

                        <div className="language-summary__steps">
                            <span className="eyebrow">QUICK GUIDE</span>
                            <div><b>1</b><span>Select your game directory</span></div>
                            <div><b>2</b><span>Choose text and voice</span></div>
                            <div><b>3</b><span>Apply your preferences</span></div>
                        </div>
                    </aside>
                </div>
            </div>
        </main>
    )
}