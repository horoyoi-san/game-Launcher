import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware';


interface SettingState {
    locale: string;
    gamePath: string;
    gameDir: string;
    serverPath: string;
    serverVersion: string;
    serverChoice: "remielle" | "yuzuha";
    patchChoice: "sunbringer" | "kafka";
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
    setServerChoice: (serverChoice: "remielle" | "yuzuha") => void;
    setPatchChoice: (patchChoice: "sunbringer" | "kafka") => void;
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
            patchChoice: "sunbringer",
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
            setServerChoice: (serverChoice: "remielle" | "yuzuha") => set({ serverChoice }),
            setPatchChoice: (patchChoice: "sunbringer" | "kafka") => set({ patchChoice }),
            setPatchInstalledGameDir: (newGameDir: string) => set({ patchInstalledGameDir: newGameDir }),
        }),
        {
            name: 'setting-storage',
            storage: createJSONStorage(() => localStorage),
            merge: (persistedState, currentState) => {
                const persisted = persistedState as Partial<SettingState>;
                const persistedServerChoice = (persistedState as { serverChoice?: unknown } | undefined)?.serverChoice;
                const serverChoice = persistedServerChoice === "eldreda" || persistedServerChoice === "yuzuha"
                    ? "yuzuha"
                    : persistedServerChoice === "remielle"
                        ? "remielle"
                        : currentState.serverChoice;
                return {
                    ...currentState,
                    ...persisted,
                    serverChoice,
                    serverPath: persisted.serverPath === "./server/eldreda"
                        ? "./server/yuzuha"
                        : persisted.serverPath ?? currentState.serverPath,
                    serverVersion: persisted.serverVersion === "eldreda-latest"
                        ? "yuzuha-latest"
                        : persisted.serverVersion ?? currentState.serverVersion,
                    patchChoice: persisted.patchChoice ?? (serverChoice === "yuzuha" ? "kafka" : "sunbringer"),
                };
            },
        }
    )
);

export default useSettingStore;
