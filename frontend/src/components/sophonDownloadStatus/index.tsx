import { ArrowDownToLine, Ban, Download, Pause, Play } from "lucide-react";
import { toast } from "react-toastify";
import { FSService } from "@bindings/SilwerWolf999-launcher/internal/fs-service";
import useSophonDownloadStore from "@/stores/sophonDownloadStore";

type SophonDownloadStatusProps = {
  showControls?: boolean;
  showCancelControl?: boolean;
};

export default function SophonDownloadStatus({
  showControls = true,
  showCancelControl = false,
}: SophonDownloadStatusProps) {
  const activeDownload = useSophonDownloadStore((state) => state.activeDownload);
  const setDownloadStatus = useSophonDownloadStore((state) => state.setDownloadStatus);

  if (!activeDownload) return null;

  const progress = activeDownload.progress;
  const percent = progress?.percent ?? 0;
  const isPaused = activeDownload.status === "paused";
  const isCanceling = activeDownload.status === "canceling";
  const controlsReady = activeDownload.status === "running" || isPaused;

  const togglePause = async () => {
    try {
      const success = isPaused
        ? await FSService.ResumeDownloader()
        : await FSService.PauseDownloader();
      if (!success) throw new Error("Could not change download state");
      setDownloadStatus(isPaused ? "running" : "paused");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not change download state");
    }
  };

  const cancelDownload = async () => {
    setDownloadStatus("canceling");
    try {
      if (!(await FSService.CancelDownloader())) {
        throw new Error("Could not cancel download");
      }
    } catch (error) {
      setDownloadStatus("running");
      toast.error(error instanceof Error ? error.message : "Could not cancel download");
    }
  };

  return (
    <aside
      aria-live="polite"
      aria-label="Download progress"
      className="arcade-frame w-full p-4 text-white backdrop-blur-xl"
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid size-9 shrink-0 place-items-center border border-cyan-300/40 bg-cyan-300/10 text-cyan-200">
            <Download size={17} className={isPaused ? "" : "animate-bounce"} />
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-bold">
              {isCanceling
                ? "Canceling download..."
                : isPaused
                  ? "Download paused"
                  : `${activeDownload.gameName} · ${activeDownload.kind === "voice" ? "Voice pack" : "Game"}`}
            </p>
            <p className="mt-0.5 truncate text-[10px] text-white/55">
              {activeDownload.status === "completed" ? "Download complete" : progress?.stage ?? "Starting native downloader..."}
            </p>
          </div>
        </div>
        <span className="text-sm font-black tabular-nums text-lime-200">{percent}%</span>
      </div>

      <div
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        className="mb-3 h-2.5 overflow-hidden border border-cyan-100/20 bg-black/60"
      >
        <div
          className="h-full bg-gradient-to-r from-cyan-300 via-blue-400 to-fuchsia-400 transition-[width] duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>

      <div className="flex items-center justify-between gap-3 text-[10px] text-white/65">
        <span className="truncate">
          {progress?.downloaded && progress.total
            ? `${progress.downloaded} / ${progress.total}`
            : "Preparing files..."}
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          <ArrowDownToLine size={12} />
          {progress?.speed || "Calculating speed..."}
        </span>
      </div>
      {progress?.currentFile && (
        <p className="mt-2 truncate text-[10px] text-white/40" title={progress.currentFile}>
          {progress.currentFile}
        </p>
      )}
      {(showControls || showCancelControl) && activeDownload.status !== "completed" && (
        <div className="mt-3 flex gap-2 border-t border-white/10 pt-3">
          {showControls && (
            <button
              type="button"
              onClick={() => void togglePause()}
              disabled={!controlsReady}
              className="arcade-button flex min-h-9 flex-1 items-center justify-center gap-2 px-2 py-1.5 text-[10px] disabled:cursor-not-allowed"
            >
              {isPaused ? <Play size={13} /> : <Pause size={13} />}
              {isPaused ? "Resume" : "Pause"}
            </button>
          )}
          {(showControls || showCancelControl) && (
          <button
            type="button"
            onClick={() => void cancelDownload()}
            disabled={!controlsReady}
            className="arcade-button arcade-button--danger flex min-h-9 flex-1 items-center justify-center gap-2 px-2 py-1.5 text-[10px] disabled:cursor-not-allowed"
          >
            <Ban size={13} />
            {isCanceling ? "Canceling..." : "Cancel"}
          </button>
          )}
        </div>
      )}
    </aside>
  );
}
