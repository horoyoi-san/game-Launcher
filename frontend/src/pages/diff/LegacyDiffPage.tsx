import useSettingStore from "@/stores/settingStore"
import { ArrowRight, Check, FileArchive, Folder, HardDrive, Info, LoaderCircle, ShieldCheck, Wrench, X } from "lucide-react"
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
            setBgUrl("/video3.mp4"); // หรือ videos[0].src ของ Launcher
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



    const progressPercent = maxProgressUpdate > 0
        ? Math.min(100, Math.max(0, (progressUpdate / maxProgressUpdate) * 100))
        : 0

    const renderStatus = (status: 'success' | 'error' | null) => {
        if (status === 'success') {
            return (
                <span className="inline-flex items-center gap-1.5 border-2 border-lime-300/40 bg-lime-300/10 px-2.5 py-1 font-mono text-xs font-bold uppercase text-lime-200">
                    <Check size={14} /> Verified
                </span>
            )
        }
        if (status === 'error') {
            return (
                <span className="inline-flex items-center gap-1.5 border-2 border-fuchsia-400/40 bg-fuchsia-400/10 px-2.5 py-1 font-mono text-xs font-bold uppercase text-fuchsia-200">
                    <X size={14} /> Invalid
                </span>
            )
        }
        return (
            <span className="border-2 border-white/15 bg-white/5 px-2.5 py-1 font-mono text-xs text-white/55">
                Waiting
            </span>
        )
    }

    return (
        <div className="fixed inset-0 z-0 overflow-hidden text-white">
            {bgUrl && (
                bgType === "video" ? (
                    <video className="absolute inset-0 h-full w-full object-cover" autoPlay loop muted playsInline>
                        <source src={bgUrl} type="video/mp4" />
                    </video>
                ) : (
                    <img src={bgUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
                )
            )}
            <div className="absolute inset-0 bg-gradient-to-br from-[#080c12]/95 via-[#111722]/90 to-[#180d1b]/95" />

            <main className="absolute inset-0 overflow-y-auto pl-20 sm:pl-24">
                <div className="mx-auto w-full max-w-5xl px-5 pb-10 pt-20 sm:px-8 sm:pt-24">
                    <header className="mb-7">
                        <div className="mb-3 inline-flex items-center gap-2 border-2 border-cyan-400/50 bg-[#101923]/90 px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-[0.18em] text-cyan-200 shadow-[4px_4px_0_rgba(34,211,238,0.16)]">
                            <Wrench size={14} />
                            Legacy Diff Utility
                        </div>
                        <h1 className="font-mono text-3xl font-black uppercase tracking-tight text-white sm:text-4xl">Update Honkai: Star Rail</h1>
                        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/60 sm:text-base">
                            Apply a local diff archive to your game installation. Select and verify both paths before starting.
                        </p>
                    </header>

                    <section className="grid gap-4 lg:grid-cols-2">
                        <article className="border-2 border-cyan-400/30 bg-[#111721]/90 p-5 shadow-[6px_6px_0_rgba(0,0,0,0.45)] backdrop-blur-xl sm:p-6">
                            <div className="mb-5 flex items-start justify-between gap-3">
                                <div className="flex items-center gap-3">
                                    <span className="grid size-11 place-items-center border-2 border-cyan-400/40 bg-cyan-400/10 text-cyan-200">
                                        <Folder size={20} />
                                    </span>
                                    <div>
                                        <p className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-lime-300/80">Step 01</p>
                                        <h2 className="mt-1 font-mono text-lg font-bold uppercase">Game installation</h2>
                                    </div>
                                </div>
                                {renderStatus(folderCheckResult)}
                            </div>

                            <p className="mb-4 text-sm leading-relaxed text-white/55">
                                Select the main game folder containing the StarRail_Data directory.
                            </p>
                            <button
                                type="button"
                                onClick={handlePickGameFolder}
                                disabled={isLoading.game || isDiffLoading}
                                className="flex w-full items-center justify-center gap-2 border-2 border-cyan-400/45 bg-[#151d28] px-4 py-3 font-mono text-sm font-bold uppercase tracking-wide transition hover:bg-cyan-400/10 hover:shadow-[4px_4px_0_rgba(34,211,238,0.22)] disabled:cursor-wait disabled:opacity-50"
                            >
                                {isLoading.game ? <LoaderCircle size={17} className="animate-spin" /> : <Folder size={17} />}
                                {isLoading.game ? "Selecting folder..." : gameDir ? "Change game folder" : "Choose game folder"}
                            </button>

                            <div className={`mt-4 flex min-h-[4.5rem] items-start gap-3 border p-3 ${
                                folderCheckResult === "success"
                                    ? "border-lime-300/40 bg-lime-300/5"
                                    : folderCheckResult === "error"
                                        ? "border-fuchsia-400/40 bg-fuchsia-400/5"
                                        : "border-[#394354] bg-[#090d13]"
                            }`}>
                                <HardDrive size={16} className="mt-0.5 shrink-0 text-cyan-300" />
                                <p className="min-w-0 break-all font-mono text-xs leading-relaxed text-white/75">
                                    {gameDir || "No game folder selected"}
                                </p>
                            </div>
                            {folderCheckResult === "error" && (
                                <p className="mt-2 font-mono text-xs text-fuchsia-200">Game directory not found. Select the correct game folder.</p>
                            )}
                        </article>

                        <article className="border-2 border-fuchsia-400/35 bg-[#111721]/90 p-5 shadow-[6px_6px_0_rgba(0,0,0,0.45)] backdrop-blur-xl sm:p-6">
                            <div className="mb-5 flex items-start justify-between gap-3">
                                <div className="flex items-center gap-3">
                                    <span className="grid size-11 place-items-center border-2 border-fuchsia-400/40 bg-fuchsia-400/10 text-fuchsia-200">
                                        <FileArchive size={20} />
                                    </span>
                                    <div>
                                        <p className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-fuchsia-300/85">Step 02</p>
                                        <h2 className="mt-1 font-mono text-lg font-bold uppercase">Diff archive</h2>
                                    </div>
                                </div>
                                {renderStatus(diffCheckResult)}
                            </div>

                            <p className="mb-4 text-sm leading-relaxed text-white/55">
                                Choose the diff package provided for your target game version (.zip, .7z or .rar).
                            </p>
                            <button
                                type="button"
                                onClick={handlePickDiffFile}
                                disabled={isLoading.diff || isDiffLoading}
                                className="flex w-full items-center justify-center gap-2 border-2 border-fuchsia-400/45 bg-[#151d28] px-4 py-3 font-mono text-sm font-bold uppercase tracking-wide transition hover:bg-fuchsia-400/10 hover:shadow-[4px_4px_0_rgba(232,121,249,0.22)] disabled:cursor-wait disabled:opacity-50"
                            >
                                {isLoading.diff ? <LoaderCircle size={17} className="animate-spin" /> : <FileArchive size={17} />}
                                {isLoading.diff ? "Selecting archive..." : diffDir ? "Change diff archive" : "Choose diff archive"}
                            </button>

                            <div className={`mt-4 flex min-h-[4.5rem] items-start gap-3 border p-3 ${
                                diffCheckResult === "success"
                                    ? "border-lime-300/40 bg-lime-300/5"
                                    : diffCheckResult === "error"
                                        ? "border-fuchsia-400/40 bg-fuchsia-400/5"
                                        : "border-[#394354] bg-[#090d13]"
                            }`}>
                                <FileArchive size={16} className="mt-0.5 shrink-0 text-fuchsia-300" />
                                <p className="min-w-0 break-all font-mono text-xs leading-relaxed text-white/75">
                                    {diffDir || "No diff archive selected"}
                                </p>
                            </div>
                            {diffCheckResult === "error" && (
                                <p className="mt-2 font-mono text-xs text-fuchsia-200">Unsupported archive. Choose a .zip, .7z or .rar file.</p>
                            )}
                        </article>
                    </section>

                    <section className="mt-4 border-2 border-lime-300/35 bg-[#111721]/95 p-5 shadow-[6px_6px_0_rgba(0,0,0,0.45)] backdrop-blur-xl sm:flex sm:items-center sm:justify-between sm:gap-6 sm:p-6">
                        <div className="mb-4 flex items-start gap-3 sm:mb-0">
                            <ShieldCheck size={20} className="mt-0.5 shrink-0 text-lime-300" />
                            <div>
                                <h2 className="font-mono font-bold uppercase">Ready to update?</h2>
                                <p className="mt-1 text-sm text-white/55">
                                    Both folders must be selected. The archive will be validated before changes are applied.
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={handleUpdateGame}
                            disabled={!diffDir || !gameDir || isLoading.game || isLoading.diff || isDiffLoading}
                            className="flex w-full shrink-0 items-center justify-center gap-2 border-2 border-cyan-200 bg-cyan-300 px-6 py-3.5 font-mono font-black uppercase text-[#081016] shadow-[5px_5px_0_rgba(34,211,238,0.25)] transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
                        >
                            {isDiffLoading ? <LoaderCircle size={18} className="animate-spin" /> : <Wrench size={18} />}
                            {isDiffLoading ? "Updating game..." : "Start update"}
                            {!isDiffLoading && <ArrowRight size={17} />}
                        </button>
                    </section>

                    <aside className="mt-4 flex gap-3 border-2 border-cyan-400/30 bg-[#101923]/90 p-4 text-sm text-cyan-50/85">
                        <Info size={18} className="mt-0.5 shrink-0 text-cyan-300" />
                        <p className="leading-relaxed">
                            Make sure the game is closed and the diff archive matches your installed version. Do not close the launcher while an update is running.
                        </p>
                    </aside>
                </div>
            </main>

            {isDiffLoading && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#070a10]/85 p-4 backdrop-blur-md">
                    <section
                        role="status"
                        aria-live="polite"
                        className="w-full max-w-xl border-2 border-cyan-400/55 bg-[#101720] p-6 text-white shadow-[8px_8px_0_rgba(34,211,238,0.18)] backdrop-blur-xl sm:p-8"
                    >
                        <div className="mb-6 flex items-center gap-4">
                            <span className="grid size-12 place-items-center border-2 border-cyan-400/40 bg-cyan-400/10 text-cyan-200">
                                <LoaderCircle size={23} className="animate-spin" />
                            </span>
                            <div className="min-w-0 flex-1">
                                <p className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-cyan-300">Legacy Diff Update</p>
                                <h2 className="mt-1 truncate font-mono text-xl font-black uppercase">{stageType || "Preparing update"}</h2>
                            </div>
                            <span className="font-mono text-lg font-black tabular-nums text-lime-300">{progressPercent.toFixed(0)}%</span>
                        </div>

                        <div
                            role="progressbar"
                            aria-valuenow={progressPercent}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            className="mb-4 h-3 overflow-hidden border border-[#465064] bg-[#090d13]"
                        >
                            <motion.div
                                className="h-full bg-gradient-to-r from-cyan-300 via-cyan-200 to-lime-300"
                                initial={{ width: 0 }}
                                animate={{ width: `${progressPercent}%` }}
                                transition={{ duration: 0.3 }}
                            />
                        </div>

                        <div className="flex min-h-12 items-center justify-between gap-4 border border-[#465064] bg-[#090d13] px-4 py-3 text-sm">
                            <span className="font-mono text-xs uppercase text-white/60">{stageType === "Cut Data" ? "Current file" : "Stage progress"}</span>
                            <span className="max-w-[65%] truncate text-right font-medium text-white/85">
                                {stageType === "Cut Data"
                                    ? messageUpdate || "Preparing files..."
                                    : `${progressUpdate.toFixed(0)} / ${maxProgressUpdate.toFixed(0)}`}
                            </span>
                        </div>
                        <p className="mt-4 text-center font-mono text-xs text-white/55">Please keep the launcher open until the update completes.</p>
                    </section>
                </div>
            )}
        </div>
    )
}