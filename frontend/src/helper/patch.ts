import useLauncherStore from "@/stores/launcherStore";
import useSettingStore from "@/stores/settingStore";
import { FSService } from "@bindings/sunbringer-launcher/internal/fs-service";
import { GitService } from "@bindings/sunbringer-launcher/internal/git-service";
import { toast } from "react-toastify";

function normalizedGameDir(gameDir: string): string {
    return gameDir.replace(/[\\/]+$/, "").toLowerCase();
}

export async function CheckPatchInstalled(gameDir: string, installedGameDir: string): Promise<boolean> {
    const { patchChoice } = useSettingStore.getState();
    if (!gameDir || normalizedGameDir(gameDir) !== normalizedGameDir(installedGameDir)) {
        return false;
    }
    const files = patchChoice === "kafka"
        ? ["Kafka.exe", "Unknown_Realm.dll"]
        : ["Sunbringer.exe", "Roscaelifer.dll"];
    const fileResults = await Promise.all(files.map((name) => FSService.FileExists(`${gameDir}/${name}`)));
    if (fileResults.some((exists) => !exists)) return false;

    try {
        const [isCurrent, error] = await GitService.IsNAPPatchCurrent(gameDir, patchChoice);
        if (error) {
            // Preserve playability during a GitHub outage; the next online check can update it.
            console.warn("Could not check for NAP patch updates", error);
            return true;
        }
        return isCurrent;
    } catch (error) {
        // Preserve playability during a GitHub outage; the next online check can update it.
        console.warn("Could not check for NAP patch updates", error);
        return true;
    }
}

export async function UpdatePatch(gameDir: string): Promise<boolean> {
    const { setDownloadType } = useLauncherStore.getState();
    const { patchChoice } = useSettingStore.getState();
    const patchName = patchChoice === "kafka" ? "Kafka" : "Sunbringer";
    if (!gameDir) {
        toast.error("Select a game folder before installing the patch");
        return false;
    }

    setDownloadType(`Downloading ${patchName} patch...`)
    const [downloaded, downloadError] = await GitService.DownloadNAPPatchProgress(patchChoice);
    if (!downloaded) {
        toast.error(downloadError || `Could not download the ${patchName} patch`);
        setDownloadType("Download patch failed");
        return false;
    }

    setDownloadType(`Installing ${patchName} patch...`)
    const [installed, installError] = await GitService.InstallNAPPatch(gameDir, patchChoice);
    if (!installed) {
        toast.error(installError || `Could not install the ${patchName} patch`);
        setDownloadType("Install patch failed");
        return false;
    }

    useSettingStore.getState().setPatchInstalledGameDir(gameDir);
    setDownloadType(`${patchName} patch is ready`);
    return true;
}
