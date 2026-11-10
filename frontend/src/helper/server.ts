import useLauncherStore from '@/stores/launcherStore';
import useSettingStore from '@/stores/settingStore';
import { FSService } from '@bindings/sunbringer-launcher/internal/fs-service';
import { GitService } from '@bindings/sunbringer-launcher/internal/git-service';
import { toast } from 'react-toastify';

export type NAPServerChoice = "remielle" | "kafka";

export async function CheckUpdateServer(
    _serverPath: string,
    _serverVersion: string,
    serverChoice: NAPServerChoice = "remielle"
): Promise<{ isUpdate: boolean; isExists: boolean; version: string }> {
    const isKafka = serverChoice === "kafka"
    const resolvedServerPath = isKafka ? "./server/kafka" : "./server/remielle"
    const version = isKafka ? "kafka-latest" : "remielle-0.1.x"
    const serverExists = isKafka
        ? await FSService.FileExists(`${resolvedServerPath}/zig-out/bin/kafka.exe`)
        : await FSService.FileExists(`${resolvedServerPath}/build.zig`)
    const zigExecutable = isKafka
        ? "./server/zig/zig-x86_64-windows-0.17.0/zig.exe"
        : "./server/zig/zig-x86_64-windows-0.16.0/zig.exe"
    const zigExists = await FSService.FileExists(zigExecutable)

    if (serverExists && (isKafka || zigExists)) {
        const { setServerPath, setServerVersion } = useSettingStore.getState()
        const isSameServer = _serverPath.replace(/[\\/]+$/, "").toLowerCase()
            === resolvedServerPath.replace(/[\\/]+$/, "").toLowerCase()
        setServerPath(resolvedServerPath)
        if (!isSameServer) setServerVersion(version)
        return { isUpdate: isSameServer && _serverVersion !== version, isExists: true, version }
    }

    return { isUpdate: false, isExists: false, version: "" }
}


export async function UpdateServer(serverChoice: NAPServerChoice = "remielle"): Promise<boolean> {
    const { setDownloadType, setProgressDownload, setDownloadProgressIndeterminate } = useLauncherStore.getState()
    const { setServerPath, setServerVersion } = useSettingStore.getState()

    const isKafka = serverChoice === "kafka"
    const serverName = isKafka ? "Kafka" : "Remielle"
    const serverVersion = isKafka ? "kafka-latest" : "remielle-0.1.x"

    setDownloadType(`Preparing ${serverName} and Zig ${isKafka ? "0.17.0" : "0.16.0"}...`)
    const [downloaded, downloadError] = isKafka
        ? await GitService.DownloadKafkaServerProgress()
        : await GitService.DownloadNAPServerProgress()
    if (!downloaded) {
        toast.error(downloadError || `Could not prepare the ${serverName} server`)
        setDownloadType("Prepare server failed")
        return false
    }

    setDownloadType(`Building ${serverName} with Zig ${isKafka ? "0.17.0" : "0.16.0"}...`)
    setProgressDownload(0)
    setDownloadProgressIndeterminate(true)
    const [extracted, extractError] = isKafka
        ? await GitService.BuildKafkaServer()
        : await GitService.ExtractNAPServer()
    setDownloadProgressIndeterminate(false)
    if (!extracted) {
        toast.error(extractError || `Could not build the ${serverName} server`)
        setDownloadType("Build server failed")
        return false
    }

    setDownloadType(`${serverName} server is ready`)
    setServerVersion(serverVersion)
    setServerPath(isKafka ? "./server/kafka" : "./server/remielle")
    return true
}
