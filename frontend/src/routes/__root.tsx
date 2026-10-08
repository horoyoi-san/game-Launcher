import { createRootRoute, Outlet } from '@tanstack/react-router'
import { ToastContainer } from 'react-toastify'
import { useGlobalEvents } from '@/hooks';
import useModalStore from '@/stores/modalStore';;
import SettingModal from '@/components/settingModal';
import CloseModal from '@/components/closeModal';
import Header from '@/components/header';

export const Route = createRootRoute({
    component: RootLayout
})

function RootLayout() {
    const { setIsOpenCloseModal, isOpenCloseModal, isOpenSettingModal, setIsOpenSettingModal } = useModalStore()

    useGlobalEvents();


    return (
        <>
            <div className="arcade-overlay" aria-hidden="true" />
            <Header />

            <div className="min-h-[78vh]">
                <Outlet />
            </div>

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