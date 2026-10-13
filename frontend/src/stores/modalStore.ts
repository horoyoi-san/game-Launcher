
import { create } from 'zustand'

export interface DiagnosticItem {
    label: string
    value: string
    isHighlight?: boolean
    icon?: string
}

export interface DiagnosticErrorInfo {
    code?: string
    title: string
    stage?: string
    category?: 'game' | 'proxy' | 'server' | 'language' | 'diff' | 'download' | 'general'
    message?: string
    reason?: string
    items?: DiagnosticItem[]
    suggestions?: string[]
    technical?: string
}

interface ModalState {
    isOpenDownloadDataModal: boolean
    isOpenCloseModal: boolean
    isOpenSettingModal: boolean
    diagnosticError: DiagnosticErrorInfo | null
    setIsOpenDownloadDataModal: (modal: boolean) => void
    setIsOpenCloseModal: (modal: boolean) => void
    setIsOpenSettingModal: (modal: boolean) => void
    showDiagnostic: (error: DiagnosticErrorInfo | null) => void
}

const useModalStore = create<ModalState>((set) => ({
    isOpenDownloadDataModal: false,
    isOpenCloseModal: false,
    isOpenSettingModal: false,
    diagnosticError: null,
    setIsOpenDownloadDataModal: (modal: boolean) => set({ isOpenDownloadDataModal: modal }),
    setIsOpenCloseModal: (modal: boolean) => set({ isOpenCloseModal: modal }),
    setIsOpenSettingModal: (modal: boolean) => set({ isOpenSettingModal: modal }),
    showDiagnostic: (error: DiagnosticErrorInfo | null) => set({ diagnosticError: error }),
}))

export default useModalStore