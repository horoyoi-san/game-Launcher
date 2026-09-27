
import { create } from 'zustand'

interface ModalState {
    isOpenDownloadDataModal: boolean;
    isOpenCloseModal: boolean;
    isOpenSettingModal: boolean;
    setIsOpenDownloadDataModal: (modal: boolean) => void;
    setIsOpenCloseModal: (modal: boolean) => void;
    setIsOpenSettingModal: (modal: boolean) => void;
}

const useModalStore = create<ModalState>((set, get) => ({
    isOpenDownloadDataModal: false,
    isOpenCloseModal: false,
    isOpenSettingModal: false,
    setIsOpenDownloadDataModal: (modal: boolean) => set({ isOpenDownloadDataModal: modal }),
    setIsOpenCloseModal: (modal: boolean) => set({ isOpenCloseModal: modal }),
    setIsOpenSettingModal: (modal: boolean) => set({ isOpenSettingModal: modal }),
}));

export default useModalStore;