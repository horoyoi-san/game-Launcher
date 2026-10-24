import { useEffect, useState } from 'react'
import { Folder, Settings, Globe, AudioLines, Radio, HardDrive, ChevronRight } from 'lucide-react'
import { FSService } from '@bindings/sunbringer-launcher/internal/fs-service'
import { LanguageService } from '@bindings/sunbringer-launcher/internal/language-service'
import { toast } from 'react-toastify'
import useSettingStore from '@/stores/settingStore'
import { findZenlessDataDirectory } from '@/helper/game'

export default function LanguagePage() {
    const { gameDir, setGameDir } = useSettingStore()
    const [folderCheckResult, setFolderCheckResult] = useState<'success' | 'error' | null>(null)

    const [textLang, setTextLang] = useState('')
    const [voiceLang, setVoiceLang] = useState('')

    const [selectedVoiceLang, setSelectedVoiceLang] = useState('')

    const [isLoading, setIsLoading] = useState(false)
    const [isSettingLanguage, setIsSettingLanguage] = useState(false)
    const [dataDirectory, setDataDirectory] = useState('')

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
            const detectedDataDirectory = await findZenlessDataDirectory(gameDir)
            const streamingAssetsPath = detectedDataDirectory ? `${gameDir}/${detectedDataDirectory}/StreamingAssets` : ''
            if (!detectedDataDirectory) {
                if (cancelled) return
                setTextLang("")
                setVoiceLang("")
                setSelectedVoiceLang("")
                setDataDirectory('')
                setFolderCheckResult("error")
                return
            }

            if (cancelled) return
            setDataDirectory(detectedDataDirectory)
            setFolderCheckResult("success")

            try {
                const [ok, textLang, voiceLang, err] = await LanguageService.GetLanguage(streamingAssetsPath)
                if (cancelled) return
                if (!ok) {
                    setTextLang("")
                    setVoiceLang("")
                    setSelectedVoiceLang("")
                    toast.error(`Game folder found, but language settings could not be read: ${err}`)
                    return
                }

                setTextLang(textLang)
                setVoiceLang(voiceLang)
                setSelectedVoiceLang(voiceLang)
            } catch (err: unknown) {
                if (cancelled) return
                setTextLang("")
                setVoiceLang("")
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
                const detectedDataDirectory = await findZenlessDataDirectory(basePath)
                const exists = Boolean(detectedDataDirectory)
                setFolderCheckResult(exists ? 'success' : 'error')
                if (exists) {
                    setDataDirectory(detectedDataDirectory)
                    setGameDir(basePath)
                } else {
                    setGameDir("")
                    toast.error('Zenless Zone Zero Beta data folder was not found. Select the installation folder.')
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
                `${gameDir}/${dataDirectory}/StreamingAssets/DesignData/Windows`,
                textLang,
                selectedVoiceLang
            )
            if (ok) {
                toast.success('Language set successfully')
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

    const getLanguageLabel = (code: string) => {
        const lang = languageOptions.find(l => l.value === code)
        return lang ? `${lang.flag} ${lang.label}` : code
    }

    return (
        <main className="tool-page tool-page--language">
            <div className="tool-page__content">
                <header className="voice-deck__header">
                    <div><span>NAP / CLIENT CONFIGURATION</span><h1>Audio console</h1><p>Route the in-game voice pack used by your Zenless Zone Zero client.</p></div>
                    <div className={`voice-deck__status ${folderCheckResult === 'success' ? 'is-ready' : ''}`}><i />{folderCheckResult === 'success' ? 'CLIENT LINKED' : gameDir ? 'SCANNING CLIENT' : 'NO CLIENT LINK'}</div>
                </header>
                <div className="voice-deck">
                    <section className="voice-deck__main">
                        <div className="voice-deck__eyebrow"><Radio size={15} /> VOICE ROUTING <span>01 / 02</span></div>
                        <div className="voice-deck__now"><div className="voice-deck__disc"><AudioLines size={34} /></div><div><small>ACTIVE VOICE PACK</small><strong>{voiceLang ? getLanguageLabel(voiceLang) : 'No voice pack detected'}</strong><span>{voiceLang ? 'Currently routed to game client' : 'Link the game folder to inspect audio settings'}</span></div></div>
                        <div className="voice-deck__options" role="group" aria-label="Choose voice language">
                            {languageOptions.filter(lang => lang.value !== 'th').map((lang, index) => <button key={lang.value} type="button" disabled={!gameDir} aria-pressed={selectedVoiceLang === lang.value} className={selectedVoiceLang === lang.value ? 'is-selected' : ''} onClick={() => setSelectedVoiceLang(lang.value)}><span className="voice-deck__option-index">0{index + 1}</span><span className="voice-deck__flag">{lang.flag}</span><strong>{lang.label}</strong><ChevronRight size={16} /></button>)}
                        </div>
                        <footer className="voice-deck__footer"><span>Voice packs must already be installed by the game.</span><button type="button" onClick={handleSetLanguage} disabled={!selectedVoiceLang || isSettingLanguage || !gameDir} className="btn btn-primary apply-language"><Settings size={17} />{isSettingLanguage ? 'Applying…' : 'Apply voice route'}</button></footer>
                    </section>
                    <aside className="voice-deck__side">
                        <div className="voice-deck__side-head"><span><HardDrive size={17} /></span><div><small>INSTALLATION NODE</small><strong>Zenless Zone Zero Beta</strong></div></div>
                        <p className="voice-deck__path" title={gameDir}>{gameDir || 'No game folder linked'}</p>
                        <button type="button" className="voice-deck__browse" onClick={handlePickFolder} disabled={isLoading}><Folder size={16} />{isLoading ? 'Selecting…' : gameDir ? 'Change install folder' : 'Link game folder'}<ChevronRight size={15} /></button>
                        <div className={`voice-deck__integrity ${folderCheckResult === 'success' ? 'is-ready' : folderCheckResult === 'error' ? 'is-error' : ''}`}><i />{folderCheckResult === 'success' ? 'Game files detected' : folderCheckResult === 'error' ? 'Game data folder not found' : 'Waiting for client path'}</div>
                        <div className="voice-deck__text"><Globe size={16} /><span><small>TEXT & SUBTITLES</small><strong>{textLang ? getLanguageLabel(textLang) : 'Managed by the game'}</strong><em>Change interface language in game settings.</em></span></div>
                    </aside>
                </div>
            </div>
        </main>
    )
}
