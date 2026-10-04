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
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2.5 py-1 text-xs font-medium text-emerald-200">
                    <Check size={14} /> Verified
                </span>
            )
        }
        if (status === 'error') {
            return (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-300/20 bg-rose-300/10 px-2.5 py-1 text-xs font-medium text-rose-200">
                    <X size={14} /> Invalid
                </span>
            )
        }
        return (
            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/50">
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
            <div className="absolute inset-0 bg-gradient-to-br from-slate-950/90 via-slate-950/75 to-indigo-950/80" />

            <main className="absolute inset-0 overflow-y-auto pl-20 sm:pl-24">
                <div className="mx-auto w-full max-w-5xl px-5 pb-10 pt-20 sm:px-8 sm:pt-24">
                    <header className="mb-7">
                        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-200/20 bg-cyan-200/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100">
                            <Wrench size={14} />
                            Legacy Diff Utility
                        </div>
                        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Update Honkai: Star Rail</h1>
                        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/60 sm:text-base">
                            Apply a local diff archive to your game installation. Select and verify both paths before starting.
                        </p>
                    </header>

                    <section className="grid gap-4 lg:grid-cols-2">
                        <article className="rounded-2xl border border-white/12 bg-slate-950/55 p-5 shadow-xl backdrop-blur-xl sm:p-6">
                            <div className="mb-5 flex items-start justify-between gap-3">
                                <div className="flex items-center gap-3">
                                    <span className="grid size-11 place-items-center rounded-xl border border-cyan-200/15 bg-cyan-200/10 text-cyan-100">
                                        <Folder size={20} />
                                    </span>
                                    <div>
                                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">Step 01</p>
                                        <h2 className="mt-1 text-lg font-semibold">Game installation</h2>
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
                                className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-semibold transition hover:border-cyan-200/40 hover:bg-cyan-200/10 disabled:cursor-wait disabled:opacity-50"
                            >
                                {isLoading.game ? <LoaderCircle size={17} className="animate-spin" /> : <Folder size={17} />}
                                {isLoading.game ? "Selecting folder..." : gameDir ? "Change game folder" : "Choose game folder"}
                            </button>

                            <div className={`mt-4 flex min-h-[4.5rem] items-start gap-3 rounded-xl border p-3 ${
                                folderCheckResult === "success"
                                    ? "border-emerald-300/15 bg-emerald-300/5"
                                    : folderCheckResult === "error"
                                        ? "border-rose-300/15 bg-rose-300/5"
                                        : "border-white/10 bg-black/20"
                            }`}>
                                <HardDrive size={16} className="mt-0.5 shrink-0 text-white/45" />
                                <p className="min-w-0 break-all font-mono text-xs leading-relaxed text-white/70">
                                    {gameDir || "No game folder selected"}
                                </p>
                            </div>
                            {folderCheckResult === "error" && (
                                <p className="mt-2 text-xs text-rose-200">Game directory not found. Select the correct game folder.</p>
                            )}
                        </article>

                        <article className="rounded-2xl border border-white/12 bg-slate-950/55 p-5 shadow-xl backdrop-blur-xl sm:p-6">
                            <div className="mb-5 flex items-start justify-between gap-3">
                                <div className="flex items-center gap-3">
                                    <span className="grid size-11 place-items-center rounded-xl border border-violet-200/15 bg-violet-200/10 text-violet-100">
                                        <FileArchive size={20} />
                                    </span>
                                    <div>
                                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">Step 02</p>
                                        <h2 className="mt-1 text-lg font-semibold">Diff archive</h2>
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
                                className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-semibold transition hover:border-violet-200/40 hover:bg-violet-200/10 disabled:cursor-wait disabled:opacity-50"
                            >
                                {isLoading.diff ? <LoaderCircle size={17} className="animate-spin" /> : <FileArchive size={17} />}
                                {isLoading.diff ? "Selecting archive..." : diffDir ? "Change diff archive" : "Choose diff archive"}
                            </button>

                            <div className={`mt-4 flex min-h-[4.5rem] items-start gap-3 rounded-xl border p-3 ${
                                diffCheckResult === "success"
                                    ? "border-emerald-300/15 bg-emerald-300/5"
                                    : diffCheckResult === "error"
                                        ? "border-rose-300/15 bg-rose-300/5"
                                        : "border-white/10 bg-black/20"
                            }`}>
                                <FileArchive size={16} className="mt-0.5 shrink-0 text-white/45" />
                                <p className="min-w-0 break-all font-mono text-xs leading-relaxed text-white/70">
                                    {diffDir || "No diff archive selected"}
                                </p>
                            </div>
                            {diffCheckResult === "error" && (
                                <p className="mt-2 text-xs text-rose-200">Unsupported archive. Choose a .zip, .7z or .rar file.</p>
                            )}
                        </article>
                    </section>

                    <section className="mt-4 rounded-2xl border border-white/12 bg-slate-950/55 p-5 shadow-xl backdrop-blur-xl sm:flex sm:items-center sm:justify-between sm:gap-6 sm:p-6">
                        <div className="mb-4 flex items-start gap-3 sm:mb-0">
                            <ShieldCheck size={20} className="mt-0.5 shrink-0 text-cyan-200" />
                            <div>
                                <h2 className="font-semibold">Ready to update?</h2>
                                <p className="mt-1 text-sm text-white/55">
                                    Both folders must be selected. The archive will be validated before changes are applied.
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={handleUpdateGame}
                            disabled={!diffDir || !gameDir || isLoading.game || isLoading.diff || isDiffLoading}
                            className="flex w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-300 to-blue-300 px-6 py-3.5 font-bold text-slate-950 shadow-lg shadow-cyan-950/30 transition hover:from-cyan-200 hover:to-blue-200 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
                        >
                            {isDiffLoading ? <LoaderCircle size={18} className="animate-spin" /> : <Wrench size={18} />}
                            {isDiffLoading ? "Updating game..." : "Start update"}
                            {!isDiffLoading && <ArrowRight size={17} />}
                        </button>
                    </section>

                    <aside className="mt-4 flex gap-3 rounded-2xl border border-cyan-100/10 bg-cyan-100/5 p-4 text-sm text-cyan-50/75">
                        <Info size={18} className="mt-0.5 shrink-0 text-cyan-200" />
                        <p className="leading-relaxed">
                            Make sure the game is closed and the diff archive matches your installed version. Do not close the launcher while an update is running.
                        </p>
                    </aside>
                </div>
            </main>

            {isDiffLoading && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-md">
                    <section
                        role="status"
                        aria-live="polite"
                        className="w-full max-w-xl rounded-2xl border border-white/15 bg-slate-950/90 p-6 text-white shadow-2xl backdrop-blur-xl sm:p-8"
                    >
                        <div className="mb-6 flex items-center gap-4">
                            <span className="grid size-12 place-items-center rounded-xl bg-cyan-300/10 text-cyan-200">
                                <LoaderCircle size={23} className="animate-spin" />
                            </span>
                            <div className="min-w-0 flex-1">
                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">Legacy Diff Update</p>
                                <h2 className="mt-1 truncate text-xl font-bold">{stageType || "Preparing update"}</h2>
                            </div>
                            <span className="text-lg font-bold tabular-nums text-cyan-100">{progressPercent.toFixed(0)}%</span>
                        </div>

                        <div
                            role="progressbar"
                            aria-valuenow={progressPercent}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            className="mb-4 h-2 overflow-hidden rounded-full bg-white/10"
                        >
                            <motion.div
                                className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-blue-400"
                                initial={{ width: 0 }}
                                animate={{ width: `${progressPercent}%` }}
                                transition={{ duration: 0.3 }}
                            />
                        </div>

                        <div className="flex min-h-12 items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm">
                            <span className="text-white/55">{stageType === "Cut Data" ? "Current file" : "Stage progress"}</span>
                            <span className="max-w-[65%] truncate text-right font-medium text-white/85">
                                {stageType === "Cut Data"
                                    ? messageUpdate || "Preparing files..."
                                    : `${progressUpdate.toFixed(0)} / ${maxProgressUpdate.toFixed(0)}`}
                            </span>
                        </div>
                        <p className="mt-4 text-center text-xs text-white/45">Please keep the launcher open until the update completes.</p>
                    </section>
                </div>
            )}
        </div>
    )
}