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
      <div className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-950/55 to-slate-950/25" />
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-slate-950/20" />

      <main className="relative z-10 ml-20 flex min-h-full items-center px-6 pb-16 pt-20 sm:ml-24 sm:px-10">
        <section className="w-full max-w-xl rounded-3xl border border-white/15 bg-slate-950/55 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
          <div className="mb-6 flex items-center gap-4">
            {gameShortcut && (
              <img src={gameShortcut.icon} alt="" className="h-14 w-14 rounded-2xl border border-white/20 object-cover shadow-lg" />
            )}
            <div className="min-w-0">
              <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">{regionLabel}</p>
              <h1 className="truncate text-3xl font-bold sm:text-4xl">{game?.name ?? "Game unavailable"}</h1>
            </div>
          </div>

          <div className="mb-6 rounded-2xl border border-white/10 bg-black/25 p-4 sm:p-5">
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
              <span className="mb-2 block text-white/70">Voice language</span>
              <select
                aria-label="Voice language"
                className="select select-bordered w-full border-white/15 bg-slate-950/70 text-white"
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
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-amber-300 px-5 py-3.5 font-bold text-slate-950 shadow-lg shadow-amber-950/30 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download size={18} />
              {downloading && downloadKind === "game" ? "Downloading game..." : `Download ${game?.name ?? "Game"}`}
            </button>
            <button
              type="button"
              onClick={() => setPendingDownload("voice")}
              disabled={!game || downloading || !selectedBuild}
              className="flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-5 py-3.5 font-semibold transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
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
          className="fixed bottom-5 right-5 z-50 w-[min(25rem,calc(100vw-6rem))] rounded-2xl border border-white/15 bg-slate-950/85 p-5 text-white shadow-2xl backdrop-blur-xl"
        >
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-300/15 text-amber-200">
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
            <span className="text-lg font-bold tabular-nums text-amber-200">{progressPercent}%</span>
          </div>

          <div
            role="progressbar"
            aria-valuenow={progressPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            className="mb-4 h-2 overflow-hidden rounded-full bg-white/10"
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-300 to-yellow-100 transition-[width] duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-lg bg-white/5 p-3">
              <span className="mb-1 flex items-center gap-1.5 text-white/50"><HardDrive size={13} /> Downloaded</span>
              <span className="font-semibold tabular-nums">
                {downloadProgress?.downloaded && downloadProgress.total
                  ? `${downloadProgress.downloaded} / ${downloadProgress.total}`
                  : "Preparing files..."}
              </span>
            </div>
            <div className="rounded-lg bg-white/5 p-3">
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
              className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-semibold transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {downloadPaused ? <Play size={15} /> : <Pause size={15} />}
              {downloadPaused ? "Resume" : "Pause"}
            </button>
            <button
              type="button"
              onClick={cancelDownload}
              disabled={!downloadProcessReady || cancelingDownload}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-rose-300/20 bg-rose-400/10 px-3 py-2 text-sm font-semibold text-rose-100 transition hover:bg-rose-400/20 disabled:cursor-not-allowed disabled:opacity-40"
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
            className="w-full max-w-xl overflow-hidden rounded-2xl border border-white/15 bg-[#171b20] text-white shadow-2xl"
          >
            <header className="flex items-center justify-between border-b border-white/10 px-6 py-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-200">Installation setup</p>
                <h2 id="install-dialog-title" className="mt-1 text-xl font-bold">Choose installation folder</h2>
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
                      className="h-11 w-full rounded-lg border border-white/15 bg-black/25 pl-10 pr-3 text-sm outline-none transition placeholder:text-white/35 focus:border-amber-200/70"
                      placeholder="Select where game files will be installed"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={chooseFolder}
                    disabled={selectingFolder || downloading}
                    className="flex h-11 shrink-0 items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3 text-sm font-semibold transition hover:bg-white/10 disabled:opacity-50"
                  >
                    <FolderOpen size={16} />
                    {selectingFolder ? "Opening..." : "Browse"}
                  </button>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-white/45">
                  Choose a folder with enough free space. The launcher will create it if it does not exist.
                </p>
              </div>

              <div className="rounded-xl border border-white/10 bg-black/20 p-4">
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
                className="rounded-lg px-4 py-2.5 text-sm font-semibold text-white/65 transition hover:bg-white/5 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={startDownload}
                disabled={!selectedBuild || !installPath.trim() || downloading}
                className="flex items-center gap-2 rounded-lg bg-amber-300 px-5 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-45"
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
