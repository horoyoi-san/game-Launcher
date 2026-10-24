import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware';


interface SettingState {
    locale: string;
    gamePath: string;
    gameDir: string;
    serverPath: string;
    serverVersion: string;
    serverChoice: "remielle" | "eldreda";
    patchInstalledGameDir: string;
    closingOption: {
        isMinimize: boolean;
        isAsk: boolean;
    }
    background: string;
    extraBackgrounds: string[];
    setExtraBackgrounds: (newExtraBackgrounds: string[]) => void;
    setBackground: (newBackground: string) => void;
    setClosingOption: (newClosingOption: { isMinimize: boolean; isAsk: boolean }) => void;
    setLocale: (newLocale: string) => void;
    setGamePath: (newGamePath: string) => void;
    setGameDir: (newGameDir: string) => void;
    setServerPath: (newServerPath: string) => void;
    setServerVersion: (newServerVersion: string) => void;
    setServerChoice: (serverChoice: "remielle" | "eldreda") => void;
    setPatchInstalledGameDir: (newGameDir: string) => void;
}

const useSettingStore = create<SettingState>()(
    persist(
        (set) => ({
            locale: "en",
            gamePath: "",
            gameDir: "",
            serverPath: "",
            serverVersion: "",
            serverChoice: "remielle",
            patchInstalledGameDir: "",
            closingOption: {
                isMinimize: false,
                isAsk: true,
            },
            background: "bg-12.jpg",
            extraBackgrounds: [],
            setExtraBackgrounds: (newExtraBackgrounds: string[]) => set({ extraBackgrounds: newExtraBackgrounds }),
            setBackground: (newBackground: string) => set({ background: newBackground }),
            setClosingOption: (newClosingOption: { isMinimize: boolean; isAsk: boolean }) => set({ closingOption: newClosingOption }),
            setLocale: (newLocale: string) => set({ locale: newLocale }),
            setGamePath: (newGamePath: string) => set({ gamePath: newGamePath }),
            setGameDir: (newGameDir: string) => set({ gameDir: newGameDir }),
            setServerPath: (newServerPath: string) => set({ serverPath: newServerPath }),
            setServerVersion: (newServerVersion: string) => set({ serverVersion: newServerVersion }),
            setServerChoice: (serverChoice: "remielle" | "eldreda") => set({ serverChoice }),
            setPatchInstalledGameDir: (newGameDir: string) => set({ patchInstalledGameDir: newGameDir }),
        }),
        {
            name: 'setting-storage',
            storage: createJSONStorage(() => localStorage),
        }
    )
);

export default useSettingStore;
