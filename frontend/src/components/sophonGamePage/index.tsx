import { useEffect, useRef, useState } from "react";
import { Events } from "@wailsio/runtime";
import {
  ArrowDownToLine,
  CheckCircle2,
  Clock3,
  Download,
  FolderOpen,
  HardDrive,
  LoaderCircle,
  Pause,
  Play,
  Ban,
  X,
} from "lucide-react";
import { toast } from "react-toastify";
import { FSService } from "@bindings/SilwerWolf999-launcher/internal/fs-service";
import gameCatalog, { launcherGames } from "@/helper/games";
import SophonBuildSelector, { type SophonBuild } from "@/components/sophonBuildSelector";

type GameConfig = {
  id: string;
  name: string;
  package: string;
  region: string;
  gameIds: Partial<Record<string, string[]>>;
  output: string;
};

type DownloadKind = "game" | "voice";

type DownloadProgress = {
  percent: number;
  downloaded: string;
  total: string;
  speed: string;
  eta: string;
};

type SophonGamePageProps = {
  gameId: string;
};

const unitBytes: Record<string, number> = {
  B: 1,
  KB: 1024,
  MB: 1024 ** 2,
  GB: 1024 ** 3,
  TB: 1024 ** 4,
};

function parseProgress(line: string): DownloadProgress | null {
  const amountMatch = line.match(/([\d.]+)\s*(B|KB|MB|GB|TB)\s*\/\s*([\d.]+)\s*(B|KB|MB|GB|TB)/i);
  if (!amountMatch) return null;

  const downloadedBytes = Number(amountMatch[1]) * unitBytes[amountMatch[2].toUpperCase()];
  const totalBytes = Number(amountMatch[3]) * unitBytes[amountMatch[4].toUpperCase()];
  const speedMatch = line.match(/([\d.]+\s*(?:B|KB|MB|GB|TB)\/s)/i);
  const etaMatch = line.match(/ETA:\s*([\d:]+)/i);

  return {
    percent: totalBytes > 0 ? Math.min(100, Math.round((downloadedBytes / totalBytes) * 100)) : 0,
    downloaded: `${amountMatch[1]} ${amountMatch[2].toUpperCase()}`,
    total: `${amountMatch[3]} ${amountMatch[4].toUpperCase()}`,
    speed: speedMatch?.[1] ?? "",
    eta: etaMatch?.[1] ?? "",
  };
}

export default function SophonGamePage({ gameId }: SophonGamePageProps) {
  const game = gameCatalog.games.find((item) => item.id === gameId) as GameConfig | undefined;
  const gameShortcut = launcherGames.find((item) => item.id === gameId);
  const [selectedBuild, setSelectedBuild] = useState<SophonBuild | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadKind, setDownloadKind] = useState<DownloadKind>("game");
  const [voiceLanguage, setVoiceLanguage] = useState("en-us");
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
  const [pendingDownload, setPendingDownload] = useState<DownloadKind | null>(null);
  const [installPath, setInstallPath] = useState(() => game?.output ?? "");
  const [selectingFolder, setSelectingFolder] = useState(false);
  const [downloadPaused, setDownloadPaused] = useState(false);
  const [downloadProcessReady, setDownloadProcessReady] = useState(false);
  const [cancelingDownload, setCancelingDownload] = useState(false);
  const cancelRequested = useRef(false);

  useEffect(() => {
    setInstallPath(localStorage.getItem(`installPath:${gameId}`) || game?.output || "");
    setSelectedBuild(null);
    setDownloadProgress(null);
    setPendingDownload(null);
    setDownloadPaused(false);
    setDownloadProcessReady(false);
  }, [gameId, game?.output]);

  useEffect(() => {
    const onStarted = () => setDownloadProcessReady(true);
    const onProgress = (event: { data?: unknown }) => {
      const line = typeof event.data === "string" ? event.data : "";
      const nextProgress = parseProgress(line);
      if (nextProgress) setDownloadProgress(nextProgress);
    };

    Events.On("download:started", onStarted);
    Events.On("download:progress", onProgress);
    return () => {
      Events.Off("download:started");
      Events.Off("download:progress");
    };
  }, []);

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

  const startDownload = async () => {
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
    setDownloading(true);
    setDownloadKind(kind);
    setDownloadProgress(null);
    setDownloadPaused(false);
    setDownloadProcessReady(false);
    setCancelingDownload(false);
    cancelRequested.current = false;
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
        if (cancelRequested.current) {
          toast.info("Download canceled");
        } else {
          toast.error("Download failed");
        }
        return;
      }

      setDownloadProgress({
        percent: 100,
        downloaded: downloadProgress?.total ?? "",
        total: downloadProgress?.total ?? "",
        speed: "",
        eta: "",
      });
      toast.success("Download complete");
    } catch (error) {
      if (cancelRequested.current) {
        toast.info("Download canceled");
      } else {
        toast.error(error instanceof Error ? error.message : "Download failed");
      }
    } finally {
      setDownloading(false);
      setDownloadPaused(false);
      setDownloadProcessReady(false);
      setCancelingDownload(false);
      cancelRequested.current = false;
    }
  };

  const toggleDownloadPause = async () => {
    try {
      const success = downloadPaused
        ? await FSService.ResumeDownloader()
        : await FSService.PauseDownloader();
      if (success) setDownloadPaused(!downloadPaused);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not change download state");
    }
  };

  const cancelDownload = async () => {
    cancelRequested.current = true;
    setCancelingDownload(true);
    try {
      const success = await FSService.CancelDownloader();
      if (!success) {
        cancelRequested.current = false;
        setCancelingDownload(false);
        toast.error("Could not cancel download");
      }
    } catch (error) {
      cancelRequested.current = false;
      setCancelingDownload(false);
      toast.error(error instanceof Error ? error.message : "Could not cancel download");
    }
  };

  const activeRegion = selectedBuild?.region ?? game?.region ?? "";
  const regionLabel = activeRegion.endsWith("BETA") ? `${activeRegion.slice(0, -4)} Beta` : activeRegion;
  const progressPercent = downloadProgress?.percent ?? 0;

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
                  setDownloadProgress(null);
                }}
              />
            ) : (
              <p className="text-sm text-rose-200">Game configuration could not be found.</p>
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
              {downloading && downloadKind === "game" ? "Downloading game..." : `Download ${game?.name ?? "Game"}`}
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
        </section>
      </main>

      {downloading && (
        <aside
          aria-live="polite"
          aria-label="Download progress"
          className="arcade-frame fixed bottom-5 right-5 z-50 w-[min(25rem,calc(100vw-6rem))] p-5 text-white backdrop-blur-xl"
        >
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center border border-cyan-300/40 bg-cyan-300/10 text-cyan-200">
                <Download size={19} className="animate-bounce" />
              </div>
              <div>
                <p className="text-sm font-bold">
                  {cancelingDownload
                    ? "Canceling download..."
                    : downloadPaused
                      ? "Download paused"
                      : downloadKind === "voice" ? "Voice pack download" : "Game download"}
                </p>
                <p className="mt-0.5 text-xs text-white/55">
                  {downloadProcessReady ? game?.name : "Preparing downloader..."}
                </p>
              </div>
            </div>
            <span className="text-lg font-black tabular-nums text-lime-200">{progressPercent}%</span>
          </div>

          <div
            role="progressbar"
            aria-valuenow={progressPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            className="mb-4 h-3 overflow-hidden border border-cyan-100/20 bg-black/60"
          >
            <div
              className="h-full bg-gradient-to-r from-cyan-300 via-blue-400 to-fuchsia-400 transition-[width] duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="border border-white/10 bg-white/[0.04] p-3">
              <span className="mb-1 flex items-center gap-1.5 text-white/50"><HardDrive size={13} /> Downloaded</span>
              <span className="font-semibold tabular-nums">
                {downloadProgress?.downloaded && downloadProgress.total
                  ? `${downloadProgress.downloaded} / ${downloadProgress.total}`
                  : "Preparing files..."}
              </span>
            </div>
            <div className="border border-white/10 bg-white/[0.04] p-3">
              <span className="mb-1 flex items-center gap-1.5 text-white/50"><ArrowDownToLine size={13} /> Speed</span>
              <span className="font-semibold tabular-nums">{downloadProgress?.speed || "Calculating..."}</span>
            </div>
          </div>
          {downloadProgress?.eta && (
            <p className="mt-3 flex items-center gap-2 text-xs text-white/65">
              <Clock3 size={14} /> Estimated time remaining: {downloadProgress.eta}
            </p>
          )}
          <div className="mt-4 flex gap-2 border-t border-white/10 pt-4">
            <button
              type="button"
              onClick={toggleDownloadPause}
              disabled={!downloadProcessReady || cancelingDownload}
              className="arcade-button flex flex-1 items-center justify-center gap-2 px-3 py-2 text-xs disabled:cursor-not-allowed"
            >
              {downloadPaused ? <Play size={15} /> : <Pause size={15} />}
              {downloadPaused ? "Resume" : "Pause"}
            </button>
            <button
              type="button"
              onClick={cancelDownload}
              disabled={!downloadProcessReady || cancelingDownload}
              className="arcade-button arcade-button--danger flex flex-1 items-center justify-center gap-2 px-3 py-2 text-xs disabled:cursor-not-allowed"
            >
              {cancelingDownload ? <LoaderCircle size={15} className="animate-spin" /> : <Ban size={15} />}
              {cancelingDownload ? "Canceling..." : "Cancel"}
            </button>
          </div>
        </aside>
      )}

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
