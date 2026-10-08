import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import { CheckUpdateLauncher, UpdateLauncher } from "@/helper/launcher";

const launcherUpdateCheckInterval = 60_000;

export function useAutoLauncherUpdate() {
    const [availableVersion, setAvailableVersion] = useState("");
    const [isUpdating, setIsUpdating] = useState(false);
    const [updateError, setUpdateError] = useState("");
    const updatingRef = useRef(false);
    const dismissedVersionRef = useRef("");

    useEffect(() => {
        let active = true;
        let checking = false;
        let notifiedVersion = "";
        let reportedInitialError = false;

        const checkForUpdate = async () => {
            if (checking || updatingRef.current) return;
            checking = true;

            try {
                const update = await CheckUpdateLauncher();
                if (!active) return;
                if (!update.isUpdate) {
                    setAvailableVersion("");
                    return;
                }

                if (update.version === notifiedVersion || update.version === dismissedVersionRef.current) return;
                notifiedVersion = update.version;
                setUpdateError("");
                setAvailableVersion(update.version);
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

    const dismissUpdate = useCallback(() => {
        dismissedVersionRef.current = availableVersion;
        setAvailableVersion("");
    }, [availableVersion]);

    const installUpdate = useCallback(async () => {
        if (!availableVersion || updatingRef.current) return;
        updatingRef.current = true;
        setIsUpdating(true);
        setUpdateError("");

        try {
            await UpdateLauncher(availableVersion);
        } catch (error) {
            const message = error instanceof Error ? error.message : "Launcher update failed";
            setUpdateError(message);
            toast.error(message);
        } finally {
            updatingRef.current = false;
            setIsUpdating(false);
        }
    }, [availableVersion]);

    return { availableVersion, dismissUpdate, installUpdate, isUpdating, updateError };
}
