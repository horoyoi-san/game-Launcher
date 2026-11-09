import { createRootRoute, Outlet, useRouterState } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { Events } from '@wailsio/runtime'
import { ArrowDownToLine, Ban, Download, Pause, Play } from 'lucide-react'
import { ToastContainer, toast } from 'react-toastify'
import { FSService } from '@bindings/SilwerWolf999-launcher/internal/fs-service'
import { useGlobalEvents } from '@/hooks';
import useModalStore from '@/stores/modalStore';;
import SettingModal from '@/components/settingModal';
import CloseModal from '@/components/closeModal';
import Header from '@/components/header';
import { useAutoLauncherUpdate } from '@/hooks/useAutoLauncherUpdate';
import LauncherUpdateNotice from '@/components/launcherUpdateNotice';
import useSophonDownloadStore, { parseSophonDownloadProgress } from '@/stores/sophonDownloadStore'

export const Route = createRootRoute({
    component: RootLayout
})

const pixelTiles = Array.from({ length: 96 }, (_, index) => {
    const column = index % 12
    const row = Math.floor(index / 12)

    return {
        id: index,
        order: Math.round(Math.max(Math.abs(column - 5.5), Math.abs(row - 3.5))),
    }
})

function RootLayout() {
    const { setIsOpenCloseModal, isOpenCloseModal, isOpenSettingModal, setIsOpenSettingModal } = useModalStore()
    const pathname = useRouterState({ select: (state) => state.location.pathname })
    const previousPathname = useRef(pathname)
    const [showPixelTransition, setShowPixelTransition] = useState(false)
    const setDownloadProgress = useSophonDownloadStore((state) => state.setDownloadProgress)
    const setDownloadStatus = useSophonDownloadStore((state) => state.setDownloadStatus)

    useGlobalEvents();
    const launcherUpdate = useAutoLauncherUpdate();

    useEffect(() => {
        const onStarted = () => setDownloadStatus("running")
        const onProgress = (event: { data?: unknown }) => {
            const progress = parseSophonDownloadProgress(event.data)
            if (progress) setDownloadProgress(progress)
        }

        Events.On("download:started", onStarted)
        Events.On("download:progress", onProgress)
        return () => {
            Events.Off("download:started")
            Events.Off("download:progress")
        }
    }, [setDownloadProgress, setDownloadStatus])

    useEffect(() => {
        if (previousPathname.current === pathname) return
        previousPathname.current = pathname
        setShowPixelTransition(true)
        const timeout = window.setTimeout(() => setShowPixelTransition(false), 430)
        return () => window.clearTimeout(timeout)
    }, [pathname])


    return (
        <>
            <div className="arcade-overlay" aria-hidden="true" />
            <Header />
            <LauncherUpdateNotice
                version={launcherUpdate.availableVersion}
                isUpdating={launcherUpdate.isUpdating}
                error={launcherUpdate.updateError}
                onUpdate={() => void launcherUpdate.installUpdate()}
                onDismiss={launcherUpdate.dismissUpdate}
            />

            <div className="min-h-[78vh]">
                <Outlet />
            </div>

            <SophonDownloadNotice />

            {showPixelTransition && (
                <div className="pixel-transition" aria-hidden="true">
                    {pixelTiles.map((tile) => (
                        <span
                            key={tile.id}
                            className="pixel-transition__tile"
                            style={{ animationDelay: `${tile.order * 30}ms` }}
                        />
                    ))}
                </div>
            )}

            <CloseModal isOpen={isOpenCloseModal} onClose={() => setIsOpenCloseModal(false)} />
            <SettingModal isOpen={isOpenSettingModal} onClose={() => setIsOpenSettingModal(false)} />
            <ToastContainer
                theme="dark"
                toastClassName="arcade-frame"
                progressClassName="!bg-cyan-300"
            />
        </>
    )
}

function SophonDownloadNotice() {
    const activeDownload = useSophonDownloadStore((state) => state.activeDownload)
    const setDownloadStatus = useSophonDownloadStore((state) => state.setDownloadStatus)

    if (!activeDownload) return null

    const progress = activeDownload.progress
    const percent = progress?.percent ?? 0
    const isPaused = activeDownload.status === "paused"
    const isCanceling = activeDownload.status === "canceling"
    const controlsReady = activeDownload.status === "running" || isPaused

    const togglePause = async () => {
        try {
            const success = isPaused
                ? await FSService.ResumeDownloader()
                : await FSService.PauseDownloader()
            if (!success) throw new Error("Could not change download state")
            setDownloadStatus(isPaused ? "running" : "paused")
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Could not change download state")
        }
    }

    const cancelDownload = async () => {
        setDownloadStatus("canceling")
        try {
            if (!(await FSService.CancelDownloader())) {
                throw new Error("Could not cancel download")
            }
        } catch (error) {
            setDownloadStatus("running")
            toast.error(error instanceof Error ? error.message : "Could not cancel download")
        }
    }

    return (
        <aside
            aria-live="polite"
            aria-label="Download progress"
            className="arcade-frame fixed bottom-12 right-5 z-[90] w-[min(25rem,calc(100vw-6rem))] p-5 text-white backdrop-blur-xl"
        >
            <div className="mb-4 flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center border border-cyan-300/40 bg-cyan-300/10 text-cyan-200">
                        <Download size={19} className={isPaused ? "" : "animate-bounce"} />
                    </div>
                    <div className="min-w-0">
                        <p className="truncate text-sm font-bold">
                            {isCanceling
                                ? "Canceling download..."
                                : isPaused
                                    ? "Download paused"
                                    : `${activeDownload.gameName} · ${activeDownload.kind === "voice" ? "Voice pack" : "Game"}`}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-white/55">
                            {activeDownload.status === "completed" ? "Download complete" : progress?.stage ?? "Starting native downloader..."}
                        </p>
                    </div>
                </div>
                <span className="text-lg font-black tabular-nums text-lime-200">{percent}%</span>
            </div>

            <div
                role="progressbar"
                aria-valuenow={percent}
                aria-valuemin={0}
                aria-valuemax={100}
                className="mb-4 h-3 overflow-hidden border border-cyan-100/20 bg-black/60"
            >
                <div
                    className="h-full bg-gradient-to-r from-cyan-300 via-blue-400 to-fuchsia-400 transition-[width] duration-300"
                    style={{ width: `${percent}%` }}
                />
            </div>

            <div className="flex items-center justify-between gap-3 text-xs text-white/65">
                <span className="truncate">
                    {progress?.downloaded && progress.total
                        ? `${progress.downloaded} / ${progress.total}`
                        : "Preparing files..."}
                </span>
                <span className="flex shrink-0 items-center gap-1.5">
                    <ArrowDownToLine size={13} />
                    {progress?.speed || "Calculating speed..."}
                </span>
            </div>
            {progress?.currentFile && (
                <p className="mt-2 truncate text-xs text-white/40" title={progress.currentFile}>
                    {progress.currentFile}
                </p>
            )}
            {activeDownload.status !== "completed" && (
                <div className="mt-4 flex gap-2 border-t border-white/10 pt-4">
                    <button
                        type="button"
                        onClick={() => void togglePause()}
                        disabled={!controlsReady}
                        className="arcade-button flex flex-1 items-center justify-center gap-2 px-3 py-2 text-xs disabled:cursor-not-allowed"
                    >
                        {isPaused ? <Play size={15} /> : <Pause size={15} />}
                        {isPaused ? "Resume" : "Pause"}
                    </button>
                    <button
                        type="button"
                        onClick={() => void cancelDownload()}
                        disabled={!controlsReady}
                        className="arcade-button arcade-button--danger flex flex-1 items-center justify-center gap-2 px-3 py-2 text-xs disabled:cursor-not-allowed"
                    >
                        <Ban size={15} />
                        {isCanceling ? "Canceling..." : "Cancel"}
                    </button>
                </div>
            )}
        </aside>
    )
}