import { createRootRoute, Outlet, useRouterState } from '@tanstack/react-router'
import { ToastContainer } from 'react-toastify'
import { useGlobalEvents } from '@/hooks';
import useModalStore from '@/stores/modalStore';;
import SettingModal from '@/components/settingModal';
import CloseModal from '@/components/closeModal';
import Header from '@/components/header';
import PageBackground from '@/components/pageBackground';
import { useAutoLauncherUpdate } from '@/hooks/useAutoLauncherUpdate';
import LauncherUpdateNotice from '@/components/launcherUpdateNotice';

export const Route = createRootRoute({
    component: RootLayout
})

function RootLayout() {
    const { setIsOpenCloseModal, isOpenCloseModal, isOpenSettingModal, setIsOpenSettingModal } = useModalStore()
    const pathname = useRouterState({ select: (state) => state.location.pathname })
    const launcherUpdate = useAutoLauncherUpdate()

    useGlobalEvents();


    return (
        <>
            {pathname !== '/' && <PageBackground />}
            <Header />
            {launcherUpdate.availableVersion && (
                <LauncherUpdateNotice
                    version={launcherUpdate.availableVersion}
                    isUpdating={launcherUpdate.isUpdating}
                    error={launcherUpdate.updateError}
                    onUpdate={() => void launcherUpdate.installUpdate()}
                    onDismiss={launcherUpdate.dismissUpdate}
                />
            )}

            <div className="min-h-[78vh]">
                <Outlet />
            </div>

            <CloseModal isOpen={isOpenCloseModal} onClose={() => setIsOpenCloseModal(false)} />
            <SettingModal isOpen={isOpenSettingModal} onClose={() => setIsOpenSettingModal(false)} />
            <ToastContainer />
        </>
    )
}