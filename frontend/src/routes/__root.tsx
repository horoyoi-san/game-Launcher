import { createRootRoute, Outlet, useRouterState } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { Events } from '@wailsio/runtime'
import { ToastContainer } from 'react-toastify'
import { useGlobalEvents } from '@/hooks';
import useModalStore from '@/stores/modalStore';;
import SettingModal from '@/components/settingModal';
import CloseModal from '@/components/closeModal';
import Header from '@/components/header';
import { useAutoLauncherUpdate } from '@/hooks/useAutoLauncherUpdate';
import LauncherUpdateNotice from '@/components/launcherUpdateNotice';
import SophonDownloadStatus from '@/components/sophonDownloadStatus';
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
    const isSophonGamePage = ['/hk4e', '/hkrpg', '/bh3', '/hyg', '/abc', '/kl', '/nap', '/varsapura'].includes(pathname)
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

            {!isSophonGamePage && (
                <div className="fixed bottom-12 right-5 z-[90] w-[min(25rem,calc(100vw-6rem))]">
                    <SophonDownloadStatus />
                </div>
            )}

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