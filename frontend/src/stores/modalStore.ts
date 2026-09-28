
import { create } from 'zustand'

interface ModalState {
    isOpenCloseModal: boolean;
    isOpenSettingModal: boolean;
    isOpenUpdateModal: boolean;
    updateVersion: string;

    setIsOpenCloseModal: (modal: boolean) => void;
    setIsOpenSettingModal: (modal: boolean) => void;
    setIsOpenUpdateModal: (modal: boolean) => void;
    setUpdateVersion: (version: string) => void;
}

const useModalStore = create<ModalState>((set) => ({
    isOpenCloseModal: false,
    isOpenSettingModal: false,
    isOpenUpdateModal: false,
    updateVersion: "",

    setIsOpenCloseModal: (modal: boolean) => set({ isOpenCloseModal: modal }),
    setIsOpenSettingModal: (modal: boolean) => set({ isOpenSettingModal: modal }),
    setIsOpenUpdateModal: (modal: boolean) => set({ isOpenUpdateModal: modal }),
    setUpdateVersion: (version: string) => set({ updateVersion: version }),
}));

export default useModalStore;