// stores/panelStore.ts
import { create } from "zustand";

type PanelStore = {
    activeUrl?: string;
    showPanel: boolean;
    isMinimized: boolean;
    reloadToken: number;

    setActiveUrl: (url?: string) => void;
    setShowPanel: (show: boolean) => void;
    setIsMinimized: (min: boolean) => void;
    reloadPanel: () => void;
};

const usePanelStore = create<PanelStore>((set) => ({
    activeUrl: undefined,
    showPanel: false,
    isMinimized: false,
    reloadToken: 0,

    setActiveUrl: (url) => set((state) => ({ activeUrl: url, reloadToken: state.reloadToken + 1 })),
    setShowPanel: (show) => set({ showPanel: show }),
    setIsMinimized: (min) => set({ isMinimized: min }),
    reloadPanel: () => set((state) => ({ reloadToken: state.reloadToken + 1 })),
}));

export default usePanelStore;
