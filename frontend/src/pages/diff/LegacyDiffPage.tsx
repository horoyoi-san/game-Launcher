import useSettingStore from "@/stores/settingStore"
import { Check, Folder, File, X, Settings } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "react-toastify"
import { DiffService } from "@bindings/SilwerWolf999-launcher/internal/diff-service"
import { FSService } from "@bindings/SilwerWolf999-launcher/internal/fs-service"
import { motion } from "motion/react"
import useDiffStore from "@/stores/diffStore"

export default function DiffPage() {
    const { gameDir, setGameDir } = useSettingStore()
    const {
        isLoading,
        setIsLoading,
        folderCheckResult,
        setFolderCheckResult,
        diffDir,
        setDiffDir,
        diffCheckResult,
        setDiffCheckResult,
        isDiffLoading,
        setIsDiffLoading,
        progressUpdate,
        setProgressUpdate,
        maxProgressUpdate,
        setMaxProgressUpdate,
        stageType,
        setStageType,
        messageUpdate,
        setMessageUpdate
    } = useDiffStore()

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
        const getLanguage = async () => {
            if (gameDir) {
                const subPath = 'StarRail_Data/StreamingAssets/DesignData/Windows'
                const fullPath = `${gameDir}/${subPath}`

                const exists = await FSService.DirExists(fullPath)
                if (exists) {
                    setFolderCheckResult('success')
                } else {
                    setFolderCheckResult('error')
                    setGameDir('')
                }
            }
        }
        getLanguage()
    }, [gameDir])

    const handlePickGameFolder = async () => {
        try {
            setIsLoading({ game: true, diff: false })
            const basePath = await FSService.PickFolder()
            if (basePath) {
                setGameDir(basePath)
                const subPath = 'StarRail_Data/StreamingAssets/DesignData/Windows'
                const fullPath = `${basePath}/${subPath}`

                const exists = await FSService.DirExists(fullPath)
                setFolderCheckResult(exists ? 'success' : 'error')
                setGameDir(exists ? basePath : '')
                if (!exists) {
                    toast.error('Game directory not found. Please select the correct folder.')
                }
            } else {
                toast.error('No folder path selected')
                setFolderCheckResult('error')
                setGameDir('')
            }
        } catch (err: any) {
            toast.error('PickFolder error:', err)
            setFolderCheckResult('error')
        } finally {
            setIsLoading({ game: false, diff: false })
        }
    }

    const handlePickDiffFile = async () => {
        try {
            setIsLoading({ game: false, diff: true })
            const basePath = await FSService.PickFile("")
            if (basePath) {
                if (!basePath.endsWith(".7z") && !basePath.endsWith(".zip") && !basePath.endsWith(".rar")) {
                    toast.error('Not valid file type')
                    setDiffCheckResult('error')
                    setDiffDir('')
                    return
                }
                setDiffDir(basePath)
                setDiffCheckResult('success')
            } else {
                toast.error('No file path selected')
                setDiffCheckResult('error')
                setDiffDir('')
            }
        } catch (err: any) {
            toast.error('PickFile error:', err)
            setDiffCheckResult('error')
        } finally {
            setIsLoading({ game: false, diff: false })
        }
    }

    const handleUpdateGame = async () => {
        const handleResult = (ok: boolean, error: string) => {
            if (!ok) {
                toast.error(error)
                return false
            }
            return true
        }

        try {
            setIsDiffLoading(true)

            if (!gameDir || !diffDir) {
                toast.error('Please select game directory and diff file')
                return
            }

            setStageType('Check Type HDiff')
            setProgressUpdate(0)
            setMaxProgressUpdate(1)

            const [isOk, validType, errorType] = await DiffService.CheckTypeHDiff(diffDir)
            if (!handleResult(isOk, errorType)) return
            setProgressUpdate(1)

            if (['hdiffmap.json', 'hdifffiles.txt', 'hdifffiles.json'].includes(validType)) {
                setStageType('Version Validate')
                setProgressUpdate(0)
                setMaxProgressUpdate(1)
                const [validVersion, errorVersion] = await DiffService.VersionValidate(gameDir, diffDir)
                if (!handleResult(validVersion, errorVersion)) return
                setProgressUpdate(1)
            }

            setStageType('Data Extract')
            const [validData, errorData] = await DiffService.DataExtract(gameDir, diffDir)
            if (!handleResult(validData, errorData)) return

            setStageType('Cut Data')
            setMessageUpdate('')
            const [validCut, errorCut] = await DiffService.CutData(gameDir)
            if (!handleResult(validCut, errorCut)) return

            switch (validType) {
                case 'hdifffiles.txt':
                case 'hdiffmap.json':
                case 'hdifffiles.json': {
                    setStageType('Patch Data')
                    const [validPatch, errorPatch] = await DiffService.HDiffPatchData(gameDir)
                    if (!handleResult(validPatch, errorPatch)) return

                    setStageType('Delete old files')
                    const [validDelete, errorDelete] = await DiffService.DeleteFiles(gameDir)
                    if (!handleResult(validDelete, errorDelete)) return
                    break
                }
                case 'manifest': {
                    setStageType('Patch Data')
                    const [validPatch, errorPatch] = await DiffService.LDiffPatchData(gameDir)
                    if (!handleResult(validPatch, errorPatch)) return
                    break
                }
            }

            toast.success('Update game completed')
        } catch (err: any) {
            console.error(err)
            toast.error(`PickFile error: ${err}`)
        } finally {
            setIsDiffLoading(false)
        }
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

            {/* 🔥 ของเดิมทั้งหมด */}
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
                            🎮 Game Update HSR BETA by Hdiffz
                        </h1>
                        <p className="">Help you update game with hdiffz</p>
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
                                        onClick={handlePickGameFolder}
                                        disabled={isLoading.game}
                                        className="btn bg-black/30 backdrop-blur-md
           border border-purple-400/30 text-white
           hover:bg-purple-500/30 hover:border-purple-300
           transition"

                                    >
                                        <Folder size={20} />
                                        {isLoading.game ? 'Selecting...' : 'Select Game Folder'}
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
                            </div>
                        </div>

                        {/* Folder Selection Section */}
                        <div className="pb-2">
                            <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
                                <File className="text-primary" size={24} />
                                Diff file Directory
                            </h2>

                            <div className="space-y-1">
                                <div className='btn btn-accent btn-xl font-bold bg-white/10 backdrop-blur-sm border border-white/20 hover:bg-pink-400/40 transition'>
                                    <button
                                        onClick={handlePickDiffFile}
                                        disabled={isLoading.diff}
                                        className="btn bg-black/30 backdrop-blur-md
           border border-purple-400/30 text-white
           hover:bg-purple-500/30 hover:border-purple-300
           transition"

                                    >
                                        <File size={20} />
                                        {isLoading.diff ? 'Selecting...' : 'Select Diff file Folder'}
                                    </button>

                                    {diffDir && (
                                        <div className="rounded-lg p-2">
                                            <p className="font-mono text-sm px-3 py-2 rounded border truncate max-w-full overflow-hidden whitespace-nowrap">
                                                {diffDir}
                                            </p>
                                        </div>
                                    )}
                                </div>
                                {diffCheckResult && (
                                    <div className={`flex items-center gap-2 p-3 mt-2 rounded-lg ${diffCheckResult === 'success'
                                        ? 'bg-success/5 text-success border border-success'
                                        : 'bg-error/5 text-error border border-error'
                                        }`}>
                                        {diffCheckResult === 'success' ? (
                                            <>
                                                <Check size={20} />
                                                <span>Valid diff file found!</span>
                                            </>
                                        ) : (
                                            <>
                                                <X size={20} />
                                                <span>Diff file not found. Please select the correct file.</span>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Apply Button */}
                            <div className="mt-6 flex justify-center">
                                <button
                                    onClick={handleUpdateGame}
                                    disabled={!diffDir || !gameDir || isLoading.game || isLoading.diff}
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
                                    {isDiffLoading ? 'Updating...' : 'Update Game'}
                                </button>
                            </div>
                        </div>

                        {isDiffLoading && (
                            <div className="fixed inset-0 z-60 h-full flex items-center justify-center bg-black/30 backdrop-blur-md">                            <div className="relative w-[90%] max-w-5xl 
bg-base-100/20 backdrop-blur-lg 
text-base-content 
rounded-xl 
border border-white/20 
shadow-xl shadow-purple-500/10
">
                                <div className="border-b border-purple-500/30 px-6 py-4 mb-4 text-center">
                                    <h3 className="font-bold text-2xl text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-cyan-400">
                                        Update Game
                                    </h3>
                                </div>

                                <div className="px-6 pb-6">
                                    <div className="w-full p-4">
                                        <div className="space-y-3">
                                            <div className="flex justify-center items-center text-sm text-white/80">
                                                <span className="font-bold text-lg text-accent">{stageType}:</span>
                                                <div className="flex items-center gap-4 ml-2">
                                                    {stageType !== 'Cut Data' && <span className="text-white font-bold">{progressUpdate.toFixed(0)} / {maxProgressUpdate.toFixed(0)}</span>}
                                                    {stageType === 'Cut Data' && <span className="text-white font-bold truncate max-w-full overflow-hidden whitespace-nowrap">{messageUpdate}</span>}
                                                </div>
                                            </div>
                                            <div className="w-full bg-white/20 rounded-full h-2 overflow-hidden">
                                                <motion.div
                                                    className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full"
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${(progressUpdate / maxProgressUpdate) * 100}%` }}
                                                    transition={{ duration: 0.3 }}
                                                />
                                            </div>
                                            <div className="text-center text-lg text-white/60">
                                                Please wait...
                                            </div>
                                        </div>
                                    </div>

                                </div>
                            </div>
                            </div>
                        )}

                        {/* คำแนะนำ */}
                        <div className="bg-info/5 rounded-lg p-4 border border-info/30 mt-6">
                            <h3 className="font-medium text-error mb-2">📋 คำแนะนำ:</h3>
                            <ol className="text-sm text-error space-y-1">
                                <li>1. คลิก "เลือกโฟลเดอร์เกม" และเลือกไดเร็กทอรีหลักของเกมของคุณ</li>
                                <li>2. รอให้ระบบตรวจสอบความถูกต้องของไดเร็กทอรีเกม</li>
                                <li>3. คลิก "เลือกโฟลเดอร์ไฟล์ Diff" และเลือกไดเร็กทอรีหลักของไฟล์ Diff ของคุณ</li>
                                <li>4. รอให้ระบบตรวจสอบความถูกต้องของไดเร็กทอรีไฟล์ Diff</li>
                                <li>5. คลิก "อัปเดตเกม" เพื่อบันทึกการเปลี่ยนแปลงของคุณ</li>
                            </ol>
                        </div>
                    </div>
                </div>
            </div>
        </>
    )
}