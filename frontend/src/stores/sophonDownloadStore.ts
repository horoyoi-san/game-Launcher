import { create } from "zustand";

export type SophonDownloadKind = "game" | "voice";

export type SophonDownloadProgress = {
  percent: number;
  downloaded: string;
  total: string;
  speed: string;
  eta: string;
  stage: string;
  currentFile: string;
};

export type SophonDownloadStatus = "starting" | "running" | "paused" | "canceling" | "completed";

export type ActiveSophonDownload = {
  gameId: string;
  gameName: string;
  kind: SophonDownloadKind;
  status: SophonDownloadStatus;
  progress: SophonDownloadProgress | null;
};

type SophonDownloadState = {
  activeDownload: ActiveSophonDownload | null;
  startDownload: (download: ActiveSophonDownload) => void;
  setDownloadProgress: (progress: SophonDownloadProgress) => void;
  setDownloadStatus: (status: SophonDownloadStatus) => void;
  clearDownload: () => void;
};

export function parseSophonDownloadProgress(value: unknown): SophonDownloadProgress | null {
  if (!value || typeof value !== "object") return null;
  const progress = value as {
    stage?: unknown;
    currentFile?: unknown;
    bytesDone?: unknown;
    bytesTotal?: unknown;
    speedBytesPerSecond?: unknown;
  };
  const done = typeof progress.bytesDone === "number" ? progress.bytesDone : 0;
  const total = typeof progress.bytesTotal === "number" ? progress.bytesTotal : 0;
  const speed = typeof progress.speedBytesPerSecond === "number" ? progress.speedBytesPerSecond : 0;

  return {
    percent: total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0,
    downloaded: formatBytes(done),
    total: formatBytes(total),
    speed: speed > 0 ? `${formatBytes(speed)}/s` : "",
    eta: speed > 0 && total > done ? formatEta((total - done) / speed) : "",
    stage: typeof progress.stage === "string" ? progress.stage : "Downloading game files",
    currentFile: typeof progress.currentFile === "string" ? progress.currentFile : "",
  };
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes;
  let unitIndex = -1;
  do {
    value /= 1024;
    unitIndex += 1;
  } while (value >= 1024 && unitIndex < units.length - 1);
  return `${value.toFixed(1)} ${units[unitIndex]}`;
}

function formatEta(seconds: number) {
  const remaining = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(remaining / 3600);
  const minutes = Math.floor((remaining % 3600) / 60);
  const secs = remaining % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
    : `${minutes}:${String(secs).padStart(2, "0")}`;
}

const useSophonDownloadStore = create<SophonDownloadState>((set) => ({
  activeDownload: null,
  startDownload: (activeDownload) => set({ activeDownload }),
  setDownloadProgress: (progress) =>
    set((state) => state.activeDownload
      ? { activeDownload: { ...state.activeDownload, progress } }
      : state),
  setDownloadStatus: (status) =>
    set((state) => state.activeDownload
      ? { activeDownload: { ...state.activeDownload, status } }
      : state),
  clearDownload: () => set({ activeDownload: null }),
}));

export default useSophonDownloadStore;
