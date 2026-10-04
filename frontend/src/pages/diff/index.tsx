import useSettingStore from "@/stores/settingStore"
import { Check, Folder, File, X, Settings } from "lucide-react"
import { useEffect } from "react"
import { toast } from "react-toastify"
import { DiffService } from "@bindings/Cyrene-launcher/internal/diff-service"
import { FSService } from "@bindings/Cyrene-launcher/internal/fs-service"
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
        <main className="tool-page tool-page--patch">
            <div className="tool-page__content">
                <header className="tool-heading">
                    <div className="tool-heading__eyebrow">GAME TOOLS <span> / </span> PATCH CENTER</div>
                    <div className="tool-heading__row">
                        <div>
                            <h1>Game patcher</h1>
                            <p>Apply an update archive to your local game installation.</p>
                        </div>
                        <div className="tool-state"><span /> HDIFFPATCH</div>
                    </div>
                </header>

                <div className="patch-layout">
                    <div className="patch-workflow">
                        <section className="studio-panel patch-step">
                            <div className="patch-step__index">01</div>
                            <div className="patch-step__body">
                                <div className="patch-step__heading">
                                    <div>
                                        <span className="eyebrow">TARGET INSTALLATION</span>
                                        <h2>Choose your game folder</h2>
                                    </div>
                                    <Folder size={20} />
                                </div>
                                <p>Pick the main directory containing the game data.</p>
                                <div className="file-picker-row">
                                    <div className="file-picker-row__value">
                                        <span className="file-picker-row__icon"><Folder size={18} /></span>
                                        <span title={gameDir}>{gameDir || 'No game folder selected'}</span>
                                    </div>
                                    <button type="button" onClick={handlePickGameFolder} disabled={isLoading.game} className="btn">
                                        {isLoading.game ? 'Selecting…' : 'Browse'}
                                    </button>
                                </div>
                                {folderCheckResult && (
                                    <div className={`inline-status ${folderCheckResult === 'success' ? 'is-success' : 'is-error'}`}>
                                        {folderCheckResult === 'success' ? <Check size={16} /> : <X size={16} />}
                                        {folderCheckResult === 'success' ? 'Game folder verified' : 'Game directory not found'}
                                    </div>
                                )}
                            </div>
                        </section>

                        <div className="patch-connector"><span /></div>

                        <section className="studio-panel patch-step">
                            <div className="patch-step__index">02</div>
                            <div className="patch-step__body">
                                <div className="patch-step__heading">
                                    <div>
                                        <span className="eyebrow">UPDATE ARCHIVE</span>
                                        <h2>Select patch package</h2>
                                    </div>
                                    <File size={20} />
                                </div>
                                <p>Supported packages: .7z, .zip, and .rar.</p>
                                <button
                                    type="button"
                                    onClick={handlePickDiffFile}
                                    disabled={isLoading.diff}
                                    className={`archive-drop ${diffDir ? 'has-file' : ''}`}
                                >
                                    <span className="archive-drop__icon"><File size={23} /></span>
                                    <span className="archive-drop__text">
                                        <strong>{diffDir ? 'Patch archive selected' : 'Browse for a patch archive'}</strong>
                                        <small title={diffDir}>{diffDir || 'Choose an update file from your computer'}</small>
                                    </span>
                                    <span className="archive-drop__action">{isLoading.diff ? 'Opening…' : 'Browse files'}</span>
                                </button>
                                {diffCheckResult && (
                                    <div className={`inline-status ${diffCheckResult === 'success' ? 'is-success' : 'is-error'}`}>
                                        {diffCheckResult === 'success' ? <Check size={16} /> : <X size={16} />}
                                        {diffCheckResult === 'success' ? 'Patch archive selected' : 'Unsupported or missing patch archive'}
                                    </div>
                                )}
                            </div>
                        </section>

                        <div className="patch-apply">
                            <div>
                                <span className="eyebrow">READY TO PATCH?</span>
                                <p>{gameDir && diffDir ? 'Both required files are ready.' : 'Select a game folder and patch archive to continue.'}</p>
                            </div>
                            <button
                                type="button"
                                onClick={handleUpdateGame}
                                disabled={!diffDir || !gameDir || isLoading.game || isLoading.diff || isDiffLoading}
                                className="btn btn-primary"
                            >
                                <Settings size={18} />
                                {isDiffLoading ? 'Patching…' : 'Start update'}
                            </button>
                        </div>
                    </div>

                    <aside className="patch-aside">
                        <div className="patch-aside__art"><File size={32} /></div>
                        <span className="eyebrow">SAFE UPDATE FLOW</span>
                        <h2>Patch your game</h2>
                        <p>Choose the target installation and update archive. The launcher validates the patch type and game version before applying changes.</p>
                        <div className="patch-aside__checklist">
                            <div><span className={gameDir ? 'is-complete' : ''}>{gameDir ? <Check size={13} /> : '1'}</span>Game directory</div>
                            <div><span className={diffDir ? 'is-complete' : ''}>{diffDir ? <Check size={13} /> : '2'}</span>Patch archive</div>
                            <div><span className={gameDir && diffDir ? 'is-complete' : ''}>{gameDir && diffDir ? <Check size={13} /> : '3'}</span>Apply update</div>
                        </div>
                        <div className="patch-aside__note">Do not close the launcher while the patch is being applied.</div>
                    </aside>
                </div>

                {isDiffLoading && (
                    <div className="patch-progress-overlay">
                        <section className="patch-progress">
                            <div className="patch-progress__header">
                                <span className="patch-progress__spinner" />
                                <div>
                                    <span className="eyebrow">UPDATE IN PROGRESS</span>
                                    <h2>{stageType || 'Preparing update'}</h2>
                                </div>
                            </div>
                            <div className="patch-progress__detail">
                                {stageType === 'Cut Data' ? messageUpdate : `${progressUpdate.toFixed(0)} / ${maxProgressUpdate.toFixed(0)}`}
                            </div>
                            <div className="patch-progress__track">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${Math.min(100, Math.max(0, (progressUpdate / maxProgressUpdate) * 100))}%` }}
                                    transition={{ duration: 0.3 }}
                                />
                            </div>
                            <p>Please keep the launcher open until the update finishes.</p>
                        </section>
                    </div>
                )}
            </div>
        </main>
    )
}