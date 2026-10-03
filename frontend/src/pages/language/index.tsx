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


    const [bgUrl, setBgUrl] = useState("");
    const [bgType, setBgType] = useState<"video" | "image">("image");

    useEffect(() => {
        // 1️⃣ โหลดค่าจาก localStorage (ค่าที่ Launcher ตั้งไว้ล่าสุด)
        const savedUrl = localStorage.getItem("customBgUrl");
        const savedType = localStorage.getItem("customBgType") as "video" | "image";

        if (savedUrl && savedType) {
            setBgUrl(savedUrl);
            setBgType(savedType);
        } else {
            // ถ้าไม่เคยตั้งค่า ให้ใช้ default ของ Launcher
            setBgUrl("/video2.mp4"); // หรือ videos[0].src ของ Launcher
            setBgType("video");
        }

        // 2️⃣ ฟัง event จาก Launcher
        const handleLauncherBgChange = (event: Event) => {
            const e = event as CustomEvent<{ url: string; type: "video" | "image" }>;
            if (e.detail?.url && e.detail?.type) {
                setBgUrl(e.detail.url);
                setBgType(e.detail.type);
            }
        };

        window.addEventListener("launcherBgChanged", handleLauncherBgChange);
        return () => window.removeEventListener("launcherBgChanged", handleLauncherBgChange);
    }, []);

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
        <>
            {/* 🔥 Background */}
            {bgUrl && (
                bgType === "video" ? (
                    <video
                        className="fixed inset-0 z-0 w-full h-full object-cover"
                        autoPlay
                        loop
                        muted
                        playsInline
                    >
                        <source src={bgUrl} type="video/mp4" />
                    </video>
                ) : (
                    <img
                        src={bgUrl}
                        className="fixed inset-0 z-0 w-full h-full object-cover"
                    />
                )
            )}

            <div className="min-h-screen
w-full

p-4 md:p-6
flex justify-center items-start

bg-gradient-to-br from-purple-900/30 via-black/50 to-indigo-900/30
backdrop-blur-xl

text-white
relative z-60">
                <div className="max-w-4xl mx-auto">
                    {/* Header */}
                    <div className="text-center mb-2">
                        <h1 className="text-4xl font-bold mb-2">
                            🎮 Game Language Manager
                        </h1>
                        <p className="">Manage text and voice language settings for your game</p>
                    </div>

                    {/* Main Content */}
                    <div className="rounded-2xl p-2 space-y-4">

                        {/* Folder Selection Section */}
                        <div className="pb-2">
                            <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
                                <Folder className="text-primary" size={24} />
                                Game Directory
                            </h2>

                            <div className="space-y-1">
                                <div className='btn btn-accent btn-xl font-bold bg-white/10 backdrop-blur-sm border border-white/20 hover:bg-pink-400/40 transition'>
                                    <button
                                        onClick={handlePickFolder}
                                        disabled={isLoading}
                                        className="btn bg-black/30 backdrop-blur-md
           border border-purple-400/30 text-white
           hover:bg-purple-500/30 hover:border-purple-300
           transition"

                                    >
                                        <Folder size={20} />
                                        {isLoading ? 'Selecting...' : 'Select Game Folder'}
                                    </button>

                                    {gameDir && (
                                        <div className="rounded-lg p-2">
                                            <p className="font-mono text-sm px-3 py-2 rounded border truncate max-w-full overflow-hidden whitespace-nowrap">
                                                {gameDir}
                                            </p>
                                        </div>
                                    )}
                                </div>
                                {folderCheckResult && (
                                    <div className={`flex items-center gap-2 p-3 rounded-lg ${folderCheckResult === 'success'
                                        ? 'bg-success/5 text-success border border-success'
                                        : 'bg-error/5 text-error border border-error'
                                        }`}>
                                        {folderCheckResult === 'success' ? (
                                            <>
                                                <Check size={20} />
                                                <span>Valid game directory found!</span>
                                            </>
                                        ) : (
                                            <>
                                                <X size={20} />
                                                <span>Game directory not found. Please select the correct folder.</span>
                                            </>
                                        )}
                                    </div>
                                )}
                                {gameDir && (
                                    <div className="mt-2">
                                        <button
                                            type="button"
                                            onClick={handleInstallThaiPatch}
                                            disabled={isInstallingThaiPatch}
                                            className="btn btn-secondary"
                                        >
                                            <Folder size={18} />
                                            {isInstallingThaiPatch ? 'Installing Thai patch...' : 'Install Thai Beta Patch'}
                                        </button>
                                        <p className="mt-1 text-sm opacity-80">
                                            Select the extracted Thai patch package folder containing the assets folder.
                                            Close the game first. Changed files are backed up; Registry and server settings are not changed.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Current Language Display */}
                        {(textLang && voiceLang) && (
                            <div className="pb-2">
                                <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
                                    <Globe className="text-primary" size={24} />
                                    Current Languages
                                </h2>

                                <div className="grid md:grid-cols-2 gap-4">
                                    <div className="bg-success/5 rounded-lg p-2 border border-success/30">
                                        <div className="flex items-center gap-2 mb-1">
                                            <Globe size={20} className="text-success" />
                                            <span className="font-bold text-success">Text Language</span>
                                        </div>
                                        <p className="text-2xl font-bold text-success">
                                            {getLanguageLabel(textLang)}
                                        </p>
                                    </div>

                                    <div className="bg-warning/5 rounded-lg p-2 border border-warning/30">
                                        <div className="flex items-center gap-2 mb-1">
                                            <Mic size={20} className="text-warning" />
                                            <span className="font-bold text-warning">Voice Language</span>
                                        </div>
                                        <p className="text-2xl font-bold text-warning">
                                            {getLanguageLabel(voiceLang)}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Language Selection */}
                        <div className={`transition-opacity duration-300 ${gameDir === "" ? 'opacity-50 pointer-events-none' : ''
                            }`}>
                            <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
                                <Settings className="text-primary" size={24} />
                                Language Settings
                            </h2>

                            <div className="grid md:grid-cols-2 gap-6">
                                {/* Text Language */}
                                <div className="space-y-3">
                                    <label className="flex text-sm font-medium text-success items-center gap-2">
                                        <Globe size={16} />
                                        Text Language
                                    </label>
                                    <select
                                        value={selectedTextLang}
                                        onChange={(e) => setSelectedTextLang(e.target.value)}
                                        className="w-full select select-success"
                                    >
                                        <option value="">Select text language...</option>
                                        {languageOptions.map(lang => (
                                            <option key={lang.value} value={lang.value}>
                                                {lang.flag} {lang.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Voice Language */}
                                <div className="space-y-3">
                                    <label className="flex text-sm font-medium text-warning items-center gap-2">
                                        <Mic size={16} />
                                        Voice Language
                                    </label>
                                    <select
                                        value={selectedVoiceLang}
                                        onChange={(e) => setSelectedVoiceLang(e.target.value)}
                                        className="w-full select select-warning"
                                    >
                                        <option value="">Select voice language...</option>
                                        {languageOptions.filter(lang => lang.value !== 'th').map(lang => (
                                            <option key={lang.value} value={lang.value}>
                                                {lang.flag} {lang.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Apply Button */}
                            <div className="mt-6 flex justify-center">
                                <button
                                    onClick={handleSetLanguage}
                                    disabled={!selectedTextLang || !selectedVoiceLang || isSettingLanguage}
                                    className="bg-gradient-to-r from-indigo-500/70 to-purple-600/70
           backdrop-blur-md
           hover:from-indigo-600/70 hover:to-purple-700/70
           disabled:from-gray-400/50 disabled:to-gray-500/50
           text-white px-8 py-3 rounded-lg font-medium
           transition-all duration-200 flex items-center gap-2
           shadow-lg hover:shadow-xl
           border border-white/20
           disabled:cursor-not-allowed cursor-pointer"
                                >
                                    <Settings size={20} />
                                    {isSettingLanguage ? 'Applying...' : 'Apply Language Settings'}
                                </button>
                            </div>
                        </div>

                        {/* คำแนะนำ */}
                        <div className="bg-info/5 rounded-lg p-4 border border-info/30 mt-6">
                            <h3 className="font-medium text-error mb-2">📋 คำแนะนำ:</h3>
                            <ol className="text-sm text-error space-y-1">
                                <li>1. คลิก "เลือกโฟลเดอร์เกม" และเลือกไดเร็กทอรีหลักของเกม</li>
                                <li>2. รอให้ระบบตรวจสอบความถูกต้องของไดเร็กทอรีเกม</li>
                                <li>3. เลือกภาษาข้อความและเสียงที่คุณต้องการ</li>
                                <li>4. คลิก "ใช้การตั้งค่าภาษา" เพื่อบันทึกการเปลี่ยนแปลงของคุณ</li>
                            </ol>
                        </div>
                    </div>
                </div>
            </div>
        </>
    )
}