import { useEffect } from "react";
import { toast } from "react-toastify";
import { CheckUpdateLauncher, UpdateLauncher } from "@/helper/launcher";

const launcherUpdateCheckInterval = 60_000;

export function useAutoLauncherUpdate() {
    useEffect(() => {
        let active = true;
        let checking = false;
        let updating = false;
        let notifiedVersion = "";
        let reportedInitialError = false;

        const checkForUpdate = async () => {
            if (checking || updating) return;
            checking = true;

            try {
                const update = await CheckUpdateLauncher();
                if (!active || !update.isUpdate) return;

                const toastId = `launcher-update-${update.version}`;
                if (update.version === notifiedVersion && toast.isActive(toastId)) return;
                notifiedVersion = update.version;

                toast.info(
                    <div className="space-y-3">
                        <p>Launcher update {update.version} is available.</p>
                        <button
                            type="button"
                            className="arcade-button min-h-9 px-3 text-xs"
                            onClick={() => {
                                if (updating) return;
                                updating = true;
                                toast.dismiss(toastId);
                                void UpdateLauncher(update.version)
                                    .catch((error: unknown) => {
                                        notifiedVersion = "";
                                        toast.error(error instanceof Error ? error.message : "Launcher update failed");
                                    })
                                    .finally(() => {
                                        updating = false;
                                    });
                            }}
                        >
                            Update now
                        </button>
                    </div>,
                    {
                        toastId,
                        autoClose: false,
                        closeOnClick: false,
                    },
                );
            } catch (error) {
                if (!reportedInitialError) {
                    console.warn("Could not check for launcher updates", error);
                    reportedInitialError = true;
                }
            } finally {
                checking = false;
            }
        };

        void checkForUpdate();
        const intervalId = window.setInterval(() => {
            void checkForUpdate();
        }, launcherUpdateCheckInterval);

        return () => {
            active = false;
            window.clearInterval(intervalId);
        };
    }, []);
}
