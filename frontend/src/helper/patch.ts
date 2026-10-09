import useLauncherStore from "@/stores/launcherStore";
import useSettingStore from "@/stores/settingStore";
import { FSService } from "@bindings/Cyrene-launcher/internal/fs-service";
import { GitService } from "@bindings/Cyrene-launcher/internal/git-service";
import { toast } from "react-toastify";

function normalizedGameDir(gameDir: string): string {
    return gameDir.replace(/[\\/]+$/, "").toLowerCase();
}

export async function CheckPatchInstalled(gameDir: string, installedGameDir: string): Promise<boolean> {
    if (!gameDir || normalizedGameDir(gameDir) !== normalizedGameDir(installedGameDir)) {
        return false;
    }
    const launcherExists = await FSService.FileExists(`${gameDir}/launcher.exe`);
    const dllExists = await FSService.FileExists(`${gameDir}/hkrpg.dll`);
    return launcherExists && dllExists;
}

export async function UpdatePatch(gameDir: string): Promise<boolean> {
    const { setDownloadType } = useLauncherStore.getState();
    if (!gameDir) {
        toast.error("Select a game folder before installing the patch");
        return false;
    }

    setDownloadType("Downloading HKRPG patch...")
    const [downloaded, downloadError] = await GitService.DownloadHKRPGPatchProgress();
    if (!downloaded) {
        toast.error(downloadError || "Could not download the HKRPG patch");
        setDownloadType("Download patch failed");
        return false;
    }

    setDownloadType("Installing HKRPG patch...")
    const [installed, installError] = await GitService.InstallHKRPGPatch(gameDir);
    if (!installed) {
        toast.error(installError || "Could not install the HKRPG patch");
        setDownloadType("Install patch failed");
        return false;
    }

    useSettingStore.getState().setPatchInstalledGameDir(gameDir);
    setDownloadType("HKRPG patch is ready");
    return true;
}
