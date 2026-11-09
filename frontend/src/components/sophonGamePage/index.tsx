import { useEffect, useState } from "react";
import {
  ArrowDownToLine,
  CheckCircle2,
  Download,
  FolderOpen,
  HardDrive,
  Play,
  X,
} from "lucide-react";
import { toast } from "react-toastify";
import { FSService } from "@bindings/SilwerWolf999-launcher/internal/fs-service";
import { launcherGames } from "@/helper/games";
import SophonBuildSelector, { type SophonBuild } from "@/components/sophonBuildSelector";
import useLauncherStore from "@/stores/launcherStore";
import useSophonDownloadStore from "@/stores/sophonDownloadStore";

type GameConfig = {
  id: string;
  name: string;
  package: string;
  region: string;
  gameIds: Partial<Record<string, string[]>>;
  output: string;
  executable: string;
};

type DownloadKind = "game" | "voice";

type SophonGamePageProps = {
  gameId: string;
};

function isAbsolutePath(path: string) {
  return /^[a-zA-Z]:[\\/]/.test(path) || path.startsWith("\\\\") || path.startsWith("/");
}

export default function SophonGamePage({ gameId }: SophonGamePageProps) {
  const { gameRunning, setGameRunning } = useLauncherStore();
  const activeDownload = useSophonDownloadStore((state) => state.activeDownload);
  const startGlobalDownload = useSophonDownloadStore((state) => state.startDownload);
  const clearGlobalDownload = useSophonDownloadStore((state) => state.clearDownload);
  const setGlobalDownloadProgress = useSophonDownloadStore((state) => state.setDownloadProgress);
  const currentDownload = activeDownload?.gameId === gameId ? activeDownload : null;
  const downloading = activeDownload !== null;
  const downloadKind = currentDownload?.kind ?? "game";
  const [game, setGame] = useState<GameConfig | undefined>();
  const [gameConfigError, setGameConfigError] = useState("");
  const gameShortcut = launcherGames.find((item) => item.id === gameId);
  const [selectedBuild, setSelectedBuild] = useState<SophonBuild | null>(null);
  const [voiceLanguage, setVoiceLanguage] = useState("en-us");
  const [pendingDownload, setPendingDownload] = useState<DownloadKind | null>(null);
  const [installPath, setInstallPath] = useState(() => game?.output ?? "");
  const [launchPath, setLaunchPath] = useState("");
  const [launchAvailable, setLaunchAvailable] = useState(false);
  const [launchPathError, setLaunchPathError] = useState("");
  const [selectingFolder, setSelectingFolder] = useState(false);
  const [selectingExecutable, setSelectingExecutable] = useState(false);

  useEffect(() => {
    let active = true;
    setGame(undefined);
    setGameConfigError("");
    FSService.GetGameConfig(gameId)
      .then((config) => {
        if (active) setGame(config as unknown as GameConfig);
      })
      .catch((error: unknown) => {
        if (active) setGameConfigError(error instanceof Error ? error.message : "Could not load game configuration.");
      });
    return () => {
      active = false;
    };
  }, [gameId]);

  useEffect(() => {
    setInstallPath(localStorage.getItem(`installPath:${gameId}`) || game?.output || "");
    setSelectedBuild(null);
    setPendingDownload(null);
  }, [gameId, game?.output]);

  useEffect(() => {
    let active = true;
    setLaunchAvailable(false);
    const resolveLaunchPath = async () => {
      const savedPath = localStorage.getItem(`launchPath:${gameId}`);
      if (savedPath) {
        setLaunchPath(savedPath);
        setLaunchPathError("");
        try {
          const exists = await FSService.FileExists(savedPath);
          if (active) setLaunchAvailable(exists);
        } catch (error) {
          if (active) {
            setLaunchPathError(error instanceof Error ? error.message : "Could not check the game executable");
          }
        }
        return;
      }
      if (!game?.executable || !installPath) {
        setLaunchPath("");
        setLaunchPathError("");
        return;
      }
      try {
        const installRoot = isAbsolutePath(installPath)
          ? installPath
          : await FSService.Join(await FSService.GetLauncherDir(), installPath);
        const executable = await FSService.Join(installRoot, game.executable);
        const exists = await FSService.FileExists(executable);
        if (active) {
          setLaunchPath(executable);
          setLaunchAvailable(exists);
          setLaunchPathError("");
        }
      } catch (error) {
        if (active) {
          setLaunchPath("");
          setLaunchAvailable(false);
          setLaunchPathError(error instanceof Error ? error.message : "Could not resolve the game executable path");
        }
      }
    };
    void resolveLaunchPath();
    return () => {
      active = false;
    };
  }, [gameId, game?.executable, installPath, downloading]);

  const chooseFolder = async () => {
    setSelectingFolder(true);
    try {
      const folder = await FSService.PickFolder();
      if (folder) setInstallPath(folder);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not select an installation folder");
    } finally {
      setSelectingFolder(false);
    }
  };

  const chooseExecutable = async () => {
    setSelectingExecutable(true);
    try {
      const path = await FSService.PickFile("exe");
      if (path) {
        if (!(await FSService.FileExists(path))) {
          toast.error("The selected game executable does not exist");
          return;
        }
        setLaunchPath(path);
        setLaunchAvailable(true);
        setLaunchPathError("");
        localStorage.setItem(`launchPath:${gameId}`, path);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not select the game executable");
    } finally {
      setSelectingExecutable(false);
    }
  };

  const launchGame = async () => {
    if (!launchPath) {
      toast.error("Choose the game executable first");
      return;
    }
    try {
      if (!(await FSService.FileExists(launchPath))) {
        toast.error("Game executable was not found. Select the game executable file.");
        return;
      }
      const [success, message] = await FSService.StartApp(launchPath);
      if (!success) {
        throw new Error(message || "Could not start the game");
      }
      setGameRunning(true);
      toast.success(`Launching ${game?.name ?? "game"}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not launch the game");
    }
  };

  const startDownload = async () => {
    if (useSophonDownloadStore.getState().activeDownload) {
      toast.error("A download is already running. Use the download panel to manage it.");
      return;
    }
    if (!game || !selectedBuild || !pendingDownload) {
      toast.error("No version available. Check the selected region.");
      return;
    }
    const output = installPath.trim();
    if (!output) {
      toast.error("Choose an installation folder first");
      return;
    }

    const kind = pendingDownload;
    const packageName = kind === "voice" ? voiceLanguage : game.package;
    setPendingDownload(null);
    startGlobalDownload({
      gameId,
      gameName: game.name,
      kind,
      status: "starting",
      progress: null,
    });
    localStorage.setItem(`installPath:${gameId}`, output);

    try {
      const success = await FSService.RunDownloader(
        selectedBuild.gameId,
        packageName,
        selectedBuild.version,
        output,
        selectedBuild.region,
        selectedBuild.branch,
        selectedBuild.launcherId
      );
      if (!success) {
        if (useSophonDownloadStore.getState().activeDownload?.status === "canceling") {
          toast.info("Download canceled");
        } else {
          toast.error("Download failed");
        }
        return;
      }

      const progress = useSophonDownloadStore.getState().activeDownload?.progress;
      setGlobalDownloadProgress({
        percent: 100,
        downloaded: progress?.total ?? "",
        total: progress?.total ?? "",
        speed: "",
        eta: "",
        stage: "Complete",
        currentFile: "",
      });
      useSophonDownloadStore.getState().setDownloadStatus("completed");
      toast.success("Download complete");
      await new Promise((resolve) => window.setTimeout(resolve, 1500));
    } catch (error) {
      if (useSophonDownloadStore.getState().activeDownload?.status === "canceling") {
        toast.info("Download canceled");
      } else {
        toast.error(error instanceof Error ? error.message : "Download failed");
      }
    } finally {
      clearGlobalDownload();
    }
  };

  const activeRegion = selectedBuild?.regionLabel ?? selectedBuild?.region ?? game?.region ?? "";
  const regionLabel = activeRegion.endsWith("BETA") ? `${activeRegion.slice(0, -4)} Beta` : activeRegion;
  return (
    <div className="fixed inset-0 z-0 overflow-hidden text-white">
      <video className="absolute inset-0 h-full w-full object-cover" autoPlay loop muted playsInline>
        <source src="/video3.mp4" type="video/mp4" />
      </video>
      <div className="absolute inset-0 bg-gradient-to-r from-[#080a12]/95 via-[#111427]/70 to-[#17102c]/40" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#080a12]/90 via-transparent to-[#111427]/30" />

      <main className="relative z-10 ml-20 flex min-h-full items-center px-6 pb-16 pt-20 sm:ml-24 sm:px-10">
        <section className="arcade-frame w-full max-w-xl p-6 backdrop-blur-xl sm:p-8">
          <div className="mb-6 flex items-center gap-4">
            {gameShortcut && (
              <img src={gameShortcut.icon} alt="" className="h-14 w-14 border-2 border-cyan-200/70 object-cover shadow-[3px_3px_0_rgba(250,77,255,0.45)] [image-rendering:pixelated]" />
            )}
            <div className="min-w-0">
              <p className="arcade-kicker mb-1">{regionLabel} · PLAYER SELECT</p>
              <h1 className="truncate text-2xl font-black uppercase tracking-wide text-white drop-shadow-[3px_3px_0_rgba(250,77,255,0.5)] sm:text-3xl">{game?.name ?? "Game unavailable"}</h1>
            </div>
          </div>

          <div className="arcade-card mb-6 p-4 sm:p-5">
            {game ? (
              <SophonBuildSelector
                key={gameId}
                gameIds={game.gameIds}
                defaultRegion={game.region}
                onChange={(build) => {
                  setSelectedBuild(build);
                }}
              />
            ) : (
              <p className="text-sm text-rose-200">{gameConfigError || "Loading game configuration..."}</p>
            )}
            <label className="mt-4 block text-sm">
              <span className="arcade-kicker mb-2 block">Voice language</span>
              <select
                aria-label="Voice language"
                className="select select-bordered w-full rounded-none border-cyan-200/25 bg-[#090b15] text-white"
                value={voiceLanguage}
                onChange={(event) => setVoiceLanguage(event.target.value)}
                disabled={downloading}
              >
                <option value="zh-cn">Chinese</option>
                <option value="en-us">English</option>
                <option value="ja-jp">Japanese</option>
                <option value="ko-kr">Korean</option>
              </select>
            </label>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => setPendingDownload("game")}
              disabled={!game || downloading || !selectedBuild}
              className="arcade-button arcade-button--primary flex min-h-12 flex-1 items-center justify-center gap-2 px-5 py-3 text-xs disabled:cursor-not-allowed"
            >
              <Download size={18} />
              {downloading && downloadKind === "game" ? "Downloading game..." : "Install / Update / Repair"}
            </button>
            <button
              type="button"
              onClick={() => setPendingDownload("voice")}
              disabled={!game || downloading || !selectedBuild}
              className="arcade-button flex min-h-12 items-center justify-center gap-2 bg-[#16192b] px-5 py-3 text-xs disabled:cursor-not-allowed"
            >
              <ArrowDownToLine size={18} />
              {downloading && downloadKind === "voice" ? "Downloading voice..." : "Voice pack"}
            </button>
          </div>
          <div className="mt-4 flex flex-col gap-2 border-t border-white/10 pt-4 sm:flex-row">
            {launchAvailable && (
              <button
                type="button"
                onClick={launchGame}
                disabled={!game || downloading || gameRunning}
                className="arcade-button flex min-h-11 flex-1 items-center justify-center gap-2 bg-[#16192b] px-4 text-xs disabled:cursor-not-allowed"
              >
                <Play size={16} fill="currentColor" />
                {gameRunning ? "Game is running" : "Open game"}
              </button>
            )}
            {!launchAvailable && (
              <button
                type="button"
                onClick={chooseExecutable}
                disabled={selectingExecutable || downloading}
                className="arcade-button flex min-h-11 flex-1 items-center justify-center gap-2 px-4 text-xs disabled:opacity-50"
              >
                <FolderOpen size={15} />
                {selectingExecutable ? "Selecting..." : "Select game .exe"}
              </button>
            )}
          </div>
          <p className={`mt-2 truncate text-xs ${launchPathError ? "text-rose-200" : "text-white/40"}`} title={launchPathError || launchPath || undefined}>
            {launchPathError || (launchAvailable ? launchPath : `Game not installed · Select its .exe after installation`)}
          </p>
        </section>
      </main>

      {pendingDownload && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="install-dialog-title"
            className="arcade-frame w-full max-w-xl overflow-hidden text-white"
          >
            <header className="flex items-center justify-between border-b border-white/10 px-6 py-5">
              <div>
                <p className="arcade-kicker">Installation setup · Player config</p>
                <h2 id="install-dialog-title" className="mt-1 text-lg font-black uppercase">Choose installation folder</h2>
              </div>
              <button
                type="button"
                onClick={() => setPendingDownload(null)}
                aria-label="Close installation setup"
                className="rounded-lg p-2 text-white/60 transition hover:bg-white/10 hover:text-white"
              >
                <X size={19} />
              </button>
            </header>

            <div className="space-y-5 px-6 py-5">
              <div>
                <label htmlFor="install-path" className="mb-2 block text-sm font-semibold text-white/80">
                  Game installation path
                </label>
                <div className="flex gap-2">
                  <div className="relative min-w-0 flex-1">
                    <HardDrive size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                    <input
                      id="install-path"
                      value={installPath}
                      onChange={(event) => setInstallPath(event.target.value)}
                      disabled={downloading}
                      className="h-11 w-full rounded-none border border-cyan-200/25 bg-black/40 pl-10 pr-3 text-sm outline-none transition placeholder:text-white/35 focus:border-cyan-200"
                      placeholder="Select where game files will be installed"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={chooseFolder}
                    disabled={selectingFolder || downloading}
                    className="arcade-button flex h-11 shrink-0 items-center gap-2 px-3 text-[10px] disabled:opacity-50"
                  >
                    <FolderOpen size={16} />
                    {selectingFolder ? "Opening..." : "Browse"}
                  </button>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-white/45">
                  Choose a folder with enough free space. The launcher will create it if it does not exist.
                </p>
              </div>

              <div className="arcade-card p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-300" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{game?.name} {pendingDownload === "voice" ? `· ${voiceLanguage} voice` : "· Game files"}</p>
                    <p className="mt-1 truncate text-xs text-white/50">
                      {selectedBuild
                        ? `${selectedBuild.version} · ${selectedBuild.branch === "pre_download" ? "Pre-download" : "Main"} · ${regionLabel}`
                        : "No build selected"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <footer className="flex justify-end gap-3 border-t border-white/10 px-6 py-4">
              <button
                type="button"
                onClick={() => setPendingDownload(null)}
                className="border border-white/15 px-4 py-2.5 text-xs font-bold uppercase text-white/65 transition hover:bg-white/5 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={startDownload}
                disabled={!selectedBuild || !installPath.trim() || downloading}
                className="arcade-button arcade-button--primary flex items-center gap-2 px-5 py-2.5 text-[10px] disabled:cursor-not-allowed"
              >
                <Download size={16} />
                Start download
              </button>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
}
