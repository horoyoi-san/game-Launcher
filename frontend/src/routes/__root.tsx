import { createRootRoute, Outlet, useRouterState } from '@tanstack/react-router'
import { ToastContainer } from 'react-toastify'
import { useGlobalEvents } from '@/hooks';
import useModalStore from '@/stores/modalStore';;
import SettingModal from '@/components/settingModal';
import CloseModal from '@/components/closeModal';
import Header from '@/components/header';
import PageBackground from '@/components/pageBackground';

export const Route = createRootRoute({
    component: RootLayout
})

function RootLayout() {
    const { setIsOpenCloseModal, isOpenCloseModal, isOpenSettingModal, setIsOpenSettingModal } = useModalStore()
    const pathname = useRouterState({ select: (state) => state.location.pathname })

    useGlobalEvents();


    return (
        <>
            {pathname !== '/' && <PageBackground />}
            <Header />

            <div className="min-h-[78vh]">
                <Outlet />
            </div>

            <CloseModal isOpen={isOpenCloseModal} onClose={() => setIsOpenCloseModal(false)} />
            <SettingModal isOpen={isOpenSettingModal} onClose={() => setIsOpenSettingModal(false)} />
            <ToastContainer />
        </>
    )
}