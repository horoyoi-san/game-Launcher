import { useEffect, useState } from "react";
import {
  CheckCircle2,
  ChevronRight,
  Download,
  FolderOpen,
  HardDrive,
  Headphones,
  Menu,
  Pause,
  Play,
  X,
} from "lucide-react";
import { toast } from "react-toastify";
import { FSService } from "@bindings/SilverWolf999-launcher/internal/fs-service";
import { launcherGames } from "@/helper/games";
import type { SophonBuild } from "@/components/sophonBuildSelector";
import SophonDownloadStatus from "@/components/sophonDownloadStatus";
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

type SophonGamePageProps = {
  gameId: string;
};

type DownloadKind = "game" | "voice";

type GameIdVersion = {
  build: SophonBuild | null;
  loading: boolean;
  error?: string;
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
  const downloading = activeDownload !== null;
  const [game, setGame] = useState<GameConfig | undefined>();
  const [gameConfigError, setGameConfigError] = useState("");
  const gameShortcut = launcherGames.find((item) => item.id === gameId);
  const [selectedBuild, setSelectedBuild] = useState<SophonBuild | null>(null);
  const [isDownloadMenuOpen, setIsDownloadMenuOpen] = useState(false);
  const [isActionsMenuOpen, setIsActionsMenuOpen] = useState(false);
  const [isDownloadStatusHovered, setIsDownloadStatusHovered] = useState(false);
  const [downloadKind, setDownloadKind] = useState<DownloadKind>("game");
  const [voiceLanguage, setVoiceLanguage] = useState("en-us");
  const [selectingGameId, setSelectingGameId] = useState("");
  const [gameIdVersions, setGameIdVersions] = useState<Record<string, GameIdVersion>>({});
  const [isInstallDialogOpen, setIsInstallDialogOpen] = useState(false);
  const [installPath, setInstallPath] = useState(() => game?.output ?? "");
  const [launchPath, setLaunchPath] = useState("");
  const [launchAvailable, setLaunchAvailable] = useState(false);
  const [launchPathError, setLaunchPathError] = useState("");
  const [selectingFolder, setSelectingFolder] = useState(false);
  const [selectingExecutable, setSelectingExecutable] = useState(false);
  const [isChangingDownloadState, setIsChangingDownloadState] = useState(false);

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
    setIsInstallDialogOpen(false);
    setIsDownloadMenuOpen(false);
    setIsActionsMenuOpen(false);
  }, [gameId, game?.output]);

  useEffect(() => {
    if (!isDownloadMenuOpen || !game) return;

    let active = true;
    const groups = Object.entries(game.gameIds)
      .filter(([regionLabel, ids]) =>
        regionLabel !== "gameid" &&
        /^(OSREL|CNREL|OSBETA|CNBETA)/i.test(regionLabel) &&
        ids?.some((id) => id && id !== "gameid"),
      )
      .map(([regionLabel, ids]) => ({
        regionLabel,
        region: regionLabel.match(/^(OSREL|CNREL|OSBETA|CNBETA)(?:\s|$)/i)?.[1].toUpperCase() ?? "",
        ids: (ids ?? []).filter((id) => id && id !== "gameid"),
      }))
      .filter(({ region, ids }) => region && ids.length > 0);

    const initialVersions: Record<string, GameIdVersion> = {};
    for (const { regionLabel, ids } of groups) {
      for (const id of ids) {
        initialVersions[`${regionLabel}:${id}`] = { build: null, loading: true };
      }
    }
    setGameIdVersions(initialVersions);

    void Promise.all(groups.map(async ({ regionLabel, region, ids }) => {
      try {
        const builds = (await FSService.GetSophonVersions(ids, region)) as unknown as SophonBuild[];
        if (!active) return;
        setGameIdVersions((current) => {
          const next = { ...current };
          for (const id of ids) {
            const candidates = builds.filter((build) => build.gameId === id);
            const build = candidates.find((candidate) => candidate.branch === "main") ?? candidates[0] ?? null;
            next[`${regionLabel}:${id}`] = {
              build: build ? { ...build, regionLabel } : null,
              loading: false,
              ...(build ? {} : { error: "No version available" }),
            };
          }
          return next;
        });
      } catch (error) {
        if (!active) return;
        const message = error instanceof Error ? error.message : "Could not load version";
        setGameIdVersions((current) => {
          const next = { ...current };
          for (const id of ids) {
            next[`${regionLabel}:${id}`] = { build: null, loading: false, error: message };
          }
          return next;
        });
      }
    }));

    return () => {
      active = false;
    };
  }, [game, isDownloadMenuOpen]);

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
      if (folder) {
        setInstallPath(folder);
        localStorage.setItem(`installPath:${gameId}`, folder);
        localStorage.removeItem(`launchPath:${gameId}`);
        setLaunchPath("");
        setLaunchAvailable(false);
        setLaunchPathError("");
        toast.success("Game location updated");
      }
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

  const toggleDownloadPause = async () => {
    const currentDownload = useSophonDownloadStore.getState().activeDownload;
    if (!currentDownload || (currentDownload.status !== "running" && currentDownload.status !== "paused")) {
      return;
    }

    setIsChangingDownloadState(true);
    try {
      const resume = currentDownload.status === "paused";
      const success = resume
        ? await FSService.ResumeDownloader()
        : await FSService.PauseDownloader();
      if (!success) {
        throw new Error(resume ? "Could not resume download" : "Could not pause download");
      }
      useSophonDownloadStore.getState().setDownloadStatus(resume ? "running" : "paused");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not change download state");
    } finally {
      setIsChangingDownloadState(false);
    }
  };

  const chooseGameId = async (id: string, regionLabel: string) => {
    const region = regionLabel.match(/^(OSREL|CNREL|OSBETA|CNBETA)(?:\s|$)/i)?.[1].toUpperCase();
    if (!region) {
      toast.error(`Could not determine the game region for ${regionLabel}`);
      return;
    }

    setSelectingGameId(id);
    try {
      const cachedBuild = gameIdVersions[`${regionLabel}:${id}`]?.build;
      const versions = cachedBuild
        ? [cachedBuild]
        : (await FSService.GetSophonVersions([id], region)) as unknown as SophonBuild[];
      const build = versions.find((item) => item.branch === "main") ?? versions[0];
      if (!build) {
        throw new Error(`No downloadable versions found for game ID ${id}`);
      }

      setSelectedBuild({ ...build, regionLabel });
      setIsDownloadMenuOpen(false);
      setIsInstallDialogOpen(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load versions for this game ID");
    } finally {
      setSelectingGameId("");
    }
  };

  const startDownload = async () => {
    if (useSophonDownloadStore.getState().activeDownload) {
      toast.error("A download is already running. Use the download panel to manage it.");
      return;
    }
    if (!game || !selectedBuild || !isInstallDialogOpen) {
      toast.error("Choose a game ID before downloading.");
      return;
    }
    const output = installPath.trim();
    if (!output) {
      toast.error("Choose an installation folder first");
      return;
    }

    const kind = downloadKind;
    const packageName = kind === "voice" ? voiceLanguage : game.package;
    setIsInstallDialogOpen(false);
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

      if (kind === "game" && game.executable) {
        try {
          const installRoot = isAbsolutePath(output)
            ? output
            : await FSService.Join(await FSService.GetLauncherDir(), output);
          const executable = await FSService.Join(installRoot, game.executable);
          if (await FSService.FileExists(executable)) {
            localStorage.setItem(`launchPath:${gameId}`, executable);
            setLaunchPath(executable);
            setLaunchAvailable(true);
            setLaunchPathError("");
          } else {
            localStorage.removeItem(`launchPath:${gameId}`);
            setLaunchPath("");
            setLaunchAvailable(false);
          }
        } catch (error) {
          localStorage.removeItem(`launchPath:${gameId}`);
          setLaunchPath("");
          setLaunchAvailable(false);
          const message = error instanceof Error ? error.message : "Could not locate the game executable";
          setLaunchPathError(message);
          toast.error(`Game downloaded, but its executable could not be detected: ${message}`);
        }
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

  const regionLabel = selectedBuild?.regionLabel ?? selectedBuild?.region ?? game?.region ?? "";
  const isBetaRegion = /BETA/i.test(regionLabel);
  let downloadButtonLabel = launchAvailable ? (gameRunning ? "Game is running" : "Open game") : "Download game";
  if (downloading) {
    switch (activeDownload?.status) {
      case "paused":
        downloadButtonLabel = "Resume download";
        break;
      case "running":
        downloadButtonLabel = activeDownload.kind === "voice" ? "Pause voice download" : "Pause game download";
        break;
      case "canceling":
        downloadButtonLabel = "Canceling download...";
        break;
      default:
        downloadButtonLabel = "Starting download...";
    }
  }
  const downloadButtonIcon = downloading
    ? activeDownload?.status === "paused"
      ? <Play size={16} fill="currentColor" />
      : <Pause size={16} />
    : launchAvailable
      ? <Play size={16} fill="currentColor" />
      : <Download size={18} />;
  return (
    <div className="fixed inset-0 z-0 overflow-hidden text-white">
      <video className="absolute inset-0 h-full w-full object-cover" autoPlay loop muted playsInline>
        <source src="/video3.mp4" type="video/mp4" />
      </video>
      <div className="absolute inset-0 bg-gradient-to-r from-[#080a12]/95 via-[#111427]/70 to-[#17102c]/40" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#080a12]/90 via-transparent to-[#111427]/30" />

      <header className="fixed left-[calc(76px+1.5rem)] top-20 z-30 flex max-w-[calc(100vw-10rem)] items-center gap-3 sm:left-[calc(76px+2.5rem)] sm:top-24">
        {gameShortcut && (
          <img
            src={gameShortcut.icon}
            alt=""
            className="size-12 shrink-0 border-2 border-cyan-200/70 bg-black/50 object-cover shadow-[3px_3px_0_rgba(250,77,255,0.45)] sm:size-14"
          />
        )}
        <div className="min-w-0">
          <p className="arcade-kicker mb-1 text-[9px] sm:text-[10px]">PLAYER SELECT · {game?.region ?? "GAME"}</p>
          <h1 className="truncate font-black uppercase tracking-wide text-white drop-shadow-[3px_3px_0_rgba(250,77,255,0.5)] sm:text-2xl">
            {game?.name ?? "Game unavailable"}
          </h1>
          {!game && <p className="mt-1 text-xs text-rose-200">{gameConfigError || "Loading game configuration..."}</p>}
        </div>
      </header>

      <div className="fixed bottom-8 right-8 z-40 w-[min(20rem,calc(100vw-7rem))]">
        <div className="flex items-stretch gap-2">
          <div
            className="relative min-w-0 flex-1"
            onMouseEnter={() => setIsDownloadStatusHovered(true)}
            onMouseLeave={() => setIsDownloadStatusHovered(false)}
            onFocusCapture={() => setIsDownloadStatusHovered(true)}
            onBlurCapture={(event) => {
              if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) {
                setIsDownloadStatusHovered(false);
              }
            }}
          >
            {activeDownload && isDownloadStatusHovered && (
              <div className="absolute bottom-full right-0 z-50 w-[min(25rem,calc(100vw-6rem))] animate-[download-menu-pop_180ms_ease-out_both]">
                <SophonDownloadStatus showControls={false} showCancelControl />
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                if (downloading) {
                  void toggleDownloadPause();
                } else if (launchAvailable) {
                  void launchGame();
                } else {
                  setDownloadKind("game");
                  setIsDownloadMenuOpen(true);
                }
              }}
              disabled={
                !game ||
                isChangingDownloadState ||
                (downloading && activeDownload?.status !== "running" && activeDownload?.status !== "paused") ||
                (!downloading && launchAvailable && gameRunning)
              }
              className="arcade-button arcade-button--primary flex min-h-12 w-full items-center justify-center gap-2 px-4 py-3 text-xs disabled:cursor-not-allowed"
            >
              {downloadButtonIcon}
              {downloadButtonLabel}
              {downloading && (
                <span className="ml-1 inline-flex shrink-0 items-center border-l border-black/20 pl-2 font-mono tabular-nums">
                  {activeDownload?.progress?.percent ?? 0}%
                </span>
              )}
            </button>
          </div>
          <button
            type="button"
            aria-label="More game actions"
            aria-haspopup="menu"
            aria-expanded={isActionsMenuOpen}
            onClick={() => setIsActionsMenuOpen((open) => !open)}
            disabled={!game || downloading}
            className="arcade-button grid min-h-12 w-12 shrink-0 place-items-center px-0 disabled:opacity-50"
          >
            <Menu size={20} />
          </button>
        </div>
        {launchPathError && (
          <p className="mt-2 truncate text-right text-[10px] text-rose-200 drop-shadow" title={launchPathError}>
            {launchPathError}
          </p>
        )}
        {isActionsMenuOpen && (
          <>
            <button
              type="button"
              aria-label="Close game actions menu"
              className="fixed inset-0 z-[35] cursor-default"
              onClick={() => setIsActionsMenuOpen(false)}
            />
            <div role="menu" aria-label="Game actions" className="absolute bottom-full right-0 z-50 mb-3 w-full overflow-hidden border border-cyan-200/35 bg-[#080b16]/95 p-2 shadow-[0_12px_36px_rgba(0,0,0,0.65),0_0_24px_rgba(83,246,255,0.08)] backdrop-blur-xl animate-[download-menu-pop_180ms_ease-out_both]">
              <div className="flex items-center justify-between border-b border-white/10 px-3 pb-2.5 pt-1">
                <span className="arcade-kicker text-[9px]">Game options</span>
                <span className="max-w-36 truncate text-[9px] uppercase tracking-wider text-white/40">{game?.name}</span>
              </div>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setDownloadKind("game");
                  setIsActionsMenuOpen(false);
                  setIsDownloadMenuOpen(true);
                }}
                className="group flex w-full items-center gap-3 border-b border-white/5 px-3 py-3 text-left text-xs font-bold text-white/85 transition hover:bg-cyan-200/[0.08] hover:text-cyan-100"
              >
                <span className="grid size-8 shrink-0 place-items-center border border-cyan-200/20 bg-cyan-200/[0.06] text-cyan-100 group-hover:border-cyan-200/50">
                  <Download size={15} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block">Download / update game</span>
                  <span className="mt-1 block text-[10px] font-normal text-white/45">Choose a game ID and version</span>
                </span>
                <ChevronRight size={15} className="text-white/30 transition group-hover:translate-x-0.5 group-hover:text-cyan-100" />
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setDownloadKind("voice");
                  setIsActionsMenuOpen(false);
                  setIsDownloadMenuOpen(true);
                }}
                className="group flex w-full items-center gap-3 border-b border-white/5 px-3 py-3 text-left text-xs font-bold text-white/85 transition hover:bg-cyan-200/[0.08] hover:text-cyan-100"
              >
                <span className="grid size-8 shrink-0 place-items-center border border-cyan-200/20 bg-cyan-200/[0.06] text-cyan-100 group-hover:border-cyan-200/50">
                  <Headphones size={15} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block">Download voice pack</span>
                  <span className="mt-1 block text-[10px] font-normal text-white/45">Select a language and game ID</span>
                </span>
                <ChevronRight size={15} className="text-white/30 transition group-hover:translate-x-0.5 group-hover:text-cyan-100" />
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setIsActionsMenuOpen(false);
                  void chooseFolder();
                }}
                disabled={selectingFolder}
                className="group flex w-full items-center gap-3 px-3 py-3 text-left text-xs font-bold text-white/85 transition hover:bg-cyan-200/[0.08] hover:text-cyan-100 disabled:opacity-50"
              >
                <span className="grid size-8 shrink-0 place-items-center border border-white/10 bg-white/[0.03] text-white/65 group-hover:border-cyan-200/40 group-hover:text-cyan-100">
                  <FolderOpen size={15} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block">{selectingFolder ? "Choosing folder..." : "Change game location"}</span>
                  <span className="mt-1 block truncate text-[10px] font-normal text-white/40">{installPath || "No location selected"}</span>
                </span>
                <ChevronRight size={15} className="text-white/30 transition group-hover:translate-x-0.5 group-hover:text-cyan-100" />
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setIsActionsMenuOpen(false);
                  void chooseExecutable();
                }}
                disabled={selectingExecutable}
                className="group flex w-full items-center gap-3 px-3 py-3 text-left text-xs font-bold text-white/85 transition hover:bg-cyan-200/[0.08] hover:text-cyan-100 disabled:opacity-50"
              >
                <span className="grid size-8 shrink-0 place-items-center border border-white/10 bg-white/[0.03] text-white/65 group-hover:border-cyan-200/40 group-hover:text-cyan-100">
                  <HardDrive size={15} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block">{selectingExecutable ? "Choosing file..." : "Choose game executable"}</span>
                  <span className="mt-1 block truncate text-[10px] font-normal text-white/40">{launchPath || "Set the installed game file"}</span>
                </span>
                <ChevronRight size={15} className="text-white/30 transition group-hover:translate-x-0.5 group-hover:text-cyan-100" />
              </button>
            </div>
          </>
        )}
      </div>

      {isDownloadMenuOpen && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm animate-[download-menu-in_180ms_ease-out_both] motion-reduce:animate-none"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setIsDownloadMenuOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="download-menu-title"
            className="arcade-frame w-full max-w-2xl overflow-hidden text-white animate-[download-menu-pop_320ms_cubic-bezier(0.22,1,0.36,1)_both] motion-reduce:animate-none"
          >
            <header className="relative flex items-center justify-between border-b border-cyan-100/15 bg-gradient-to-r from-cyan-300/[0.08] via-transparent to-fuchsia-300/[0.06] px-5 py-5 sm:px-7">
              <div>
                <p className="arcade-kicker text-[9px]">{downloadKind === "voice" ? "Additional content" : "Game download"} · {game?.name}</p>
                <h2 id="download-menu-title" className="mt-1 text-xl font-black uppercase tracking-wide sm:text-2xl">
                  {downloadKind === "voice" ? "Select voice pack source" : "Choose game ID"}
                </h2>
                <p className="mt-1 text-[11px] text-white/45">Select a region and build source to continue.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsDownloadMenuOpen(false)}
                aria-label="Close game ID selection"
                className="grid size-9 shrink-0 place-items-center border border-white/10 text-white/55 transition hover:border-cyan-200/50 hover:bg-cyan-200/10 hover:text-white"
              >
                <X size={19} />
              </button>
            </header>

            <div className="max-h-[min(65vh,34rem)] space-y-3 overflow-y-auto p-5 sm:p-7">
              {downloadKind === "voice" && (
                <label className="mb-5 block border border-white/10 bg-white/[0.025] p-4 text-sm">
                  <span className="arcade-kicker mb-2 block text-[9px]">Voice language</span>
                  <select
                    aria-label="Voice language"
                    className="select select-bordered h-11 min-h-11 w-full rounded-none border-cyan-200/25 bg-[#090b15] text-white focus:border-cyan-200"
                    value={voiceLanguage}
                    onChange={(event) => setVoiceLanguage(event.target.value)}
                    disabled={Boolean(selectingGameId)}
                  >
                    <option value="zh-cn">Chinese</option>
                    <option value="en-us">English</option>
                    <option value="ja-jp">Japanese</option>
                    <option value="ko-kr">Korean</option>
                  </select>
                </label>
              )}
              {Object.entries(game?.gameIds ?? {})
                .filter(([region]) => region !== "gameid" && /^(OSREL|CNREL|OSBETA|CNBETA)/i.test(region))
                .flatMap(([regionName, ids]) =>
                  (ids ?? [])
                    .filter((id) => id && id !== "gameid")
                    .map((id) => ({ id, regionName })),
                )
                .map(({ id, regionName }) => {
                  const versionInfo = gameIdVersions[`${regionName}:${id}`];
                  return (
                    <button
                      key={`${regionName}:${id}`}
                      type="button"
                      disabled={Boolean(selectingGameId)}
                      onClick={() => void chooseGameId(id, regionName)}
                      className="group relative flex w-full items-center justify-between gap-4 border border-white/10 bg-gradient-to-r from-white/[0.045] to-transparent px-4 py-3.5 text-left transition duration-200 hover:border-cyan-200/55 hover:from-cyan-200/[0.09] hover:to-fuchsia-200/[0.035] disabled:cursor-wait disabled:opacity-55 motion-reduce:duration-0"
                    >
                      <span className="grid size-10 shrink-0 place-items-center border border-cyan-200/20 bg-cyan-200/[0.06] font-mono text-xs font-black text-cyan-100 transition group-hover:border-cyan-200/55">
                        {regionName.slice(0, 2).toUpperCase()}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-sm font-bold text-white">{regionName.replace(/&/g, "and")}</span>
                          <span className={`border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider ${/BETA/i.test(regionName) ? "border-fuchsia-200/25 bg-fuchsia-300/[0.06] text-fuchsia-100/80" : "border-emerald-200/20 bg-emerald-300/[0.05] text-emerald-100/75"}`}>
                            {/BETA/i.test(regionName) ? "Beta" : "Release"}
                          </span>
                        </span>
                        <span className="mt-1 block truncate font-mono text-[10px] text-white/40">{id}</span>
                        <span className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                          <span className="text-[8px] font-bold uppercase tracking-[0.16em] text-white/35">Version</span>
                          {versionInfo?.loading ? (
                            <span className="inline-flex items-center gap-1.5 text-[10px] text-cyan-100/60">
                              <span className="size-2 animate-spin rounded-full border border-cyan-100/30 border-t-cyan-100" />
                              Checking...
                            </span>
                          ) : versionInfo?.build ? (
                            <span className="font-mono text-xs font-bold tracking-wide text-cyan-100">
                              {versionInfo.build.version}
                            </span>
                          ) : (
                            <span className="text-[10px] text-amber-100/55">
                              {versionInfo?.error || "Waiting for version"}
                            </span>
                          )}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-cyan-100">
                        {selectingGameId === id ? "Checking..." : "Select"}
                        {selectingGameId === id
                          ? <span className="size-3 animate-spin rounded-full border border-cyan-100/30 border-t-cyan-100" />
                          : <ChevronRight size={15} className="transition group-hover:translate-x-0.5" />}
                      </span>
                    </button>
                  );
                })}
              {Object.entries(game?.gameIds ?? {}).every(([region, ids]) =>
                region === "gameid" || !/^(OSREL|CNREL|OSBETA|CNBETA)/i.test(region) || !ids?.some((id) => id && id !== "gameid"),
              ) && (
                <p className="border border-amber-200/15 bg-amber-300/[0.04] px-4 py-6 text-center text-sm text-amber-100/70">No game IDs are configured for this game.</p>
              )}
            </div>
          </section>
        </div>
      )}

      {isInstallDialogOpen && (
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
                onClick={() => setIsInstallDialogOpen(false)}
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

              <div className="relative overflow-hidden border border-cyan-200/20 bg-gradient-to-br from-cyan-200/[0.07] via-[#111526] to-fuchsia-200/[0.05] p-4 sm:p-5">
                <div className="absolute right-0 top-0 h-20 w-20 translate-x-1/3 -translate-y-1/3 rounded-full bg-cyan-200/[0.08] blur-2xl" />
                <div className="relative flex items-start gap-3">
                  <span className="grid size-9 shrink-0 place-items-center border border-emerald-200/20 bg-emerald-300/[0.06] text-emerald-200">
                    <CheckCircle2 size={17} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-bold text-white">
                        {game?.name} · {downloadKind === "voice" ? `${voiceLanguage} voice pack` : "Game files"}
                      </p>
                      {selectedBuild && (
                        <span className={`border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider ${isBetaRegion ? "border-fuchsia-200/25 text-fuchsia-100/80" : "border-emerald-200/20 text-emerald-100/75"}`}>
                          {isBetaRegion ? "Beta channel" : "Release channel"}
                        </span>
                      )}
                    </div>
                    <p className="mt-3 text-[9px] font-bold uppercase tracking-[0.18em] text-cyan-100/55">Selected version</p>
                    <p className="mt-1 break-all font-mono text-lg font-black leading-tight text-cyan-50 sm:text-xl">
                      {selectedBuild?.version ?? "No build selected"}
                    </p>
                    {selectedBuild && (
                      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-white/45">
                        <span>{selectedBuild.branch === "pre_download" ? "Pre-download" : "Main branch"}</span>
                        <span>{regionLabel}</span>
                        <span className="font-mono">{selectedBuild.gameId}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <footer className="flex justify-end gap-3 border-t border-white/10 px-6 py-4">
              <button
                type="button"
                onClick={() => setIsInstallDialogOpen(false)}
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
