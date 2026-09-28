import { useEffect, useState } from "react";
import { Events } from "@wailsio/runtime";
import { Download, Volume2 } from "lucide-react";
import { toast } from "react-toastify";
import { FSService } from "@bindings/SilwerWolf999-launcher/internal/fs-service";
import gameCatalog from "@/helper/games";
import SophonBuildSelector, { type SophonBuild } from "@/components/sophonBuildSelector";

type GameConfig = {
  id: string;
  name: string;
  package: string;
  region: string;
  gameIds: Partial<Record<string, string[]>>;
  output: string;
};

type SophonGamePageProps = {
  gameId: string;
};

function parseProgress(line: string) {
  const match = line.match(/([\d.]+)\s*(B|KB|MB|GB|TB)\/([\d.]+)\s*(B|KB|MB|GB|TB)/i);
  if (!match) return null;

  const units: Record<string, number> = { B: 1, KB: 1024, MB: 1024 ** 2, GB: 1024 ** 3, TB: 1024 ** 4 };
  const current = Number(match[1]) * units[match[2].toUpperCase()];
  const total = Number(match[3]) * units[match[4].toUpperCase()];
  return total > 0 ? Math.min(100, Math.round((current / total) * 100)) : null;
}

export default function SophonGamePage({ gameId }: SophonGamePageProps) {
  const game = gameCatalog.games.find((item) => item.id === gameId) as GameConfig | undefined;
  const [selectedBuild, setSelectedBuild] = useState<SophonBuild | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadKind, setDownloadKind] = useState<"game" | "voice">("game");
  const [voiceLanguage, setVoiceLanguage] = useState("en-us");
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const onProgress = (event: any) => {
      const line = typeof event?.data === "string" ? event.data : "";
      const percent = parseProgress(line);
      if (percent !== null) setProgress(percent);
    };

    Events.On("download:progress", onProgress);
    return () => Events.Off("download:progress");
  }, []);

  const startDownload = async (packageName: string, kind: "game" | "voice") => {
    if (!game || !selectedBuild) {
      toast.error("No version available. Check the selected region.");
      return;
    }

    setDownloading(true);
    setDownloadKind(kind);
    setProgress(0);
    try {
      const success = await FSService.RunDownloader(
        selectedBuild.gameId,
        packageName,
        selectedBuild.version,
        game.output,
        selectedBuild.region,
        selectedBuild.branch,
        selectedBuild.launcherId
      );
      if (!success) {
        toast.error("Download failed");
        return;
      }

      setProgress(100);
      toast.success("Download complete");
    } catch (error: any) {
      toast.error(error?.message || "Download failed");
    } finally {
      setDownloading(false);
    }
  };

  const activeRegion = selectedBuild?.region ?? game?.region ?? "";
  const regionLabel = activeRegion.endsWith("BETA") ? `${activeRegion.slice(0, -4)} Beta` : activeRegion;

  return (
    <div className="fixed inset-0 z-0 overflow-hidden text-white">
      <video className="absolute inset-0 h-full w-full object-cover" autoPlay loop muted playsInline>
        <source src="/video2.mp4" type="video/mp4" />
      </video>
      <div className="absolute inset-0 bg-black/65" />
      <main className="relative z-10 ml-24 flex min-h-full flex-col justify-end px-8 pb-10 pt-24">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">{regionLabel}</p>
        <h1 className="mb-6 text-4xl font-bold">{game?.name ?? "Game unavailable"}</h1>
        <section className="w-full max-w-md border border-white/20 bg-black/45 p-5 backdrop-blur-md">
          {game && (
            <SophonBuildSelector
              gameIds={game.gameIds}
              defaultRegion={game.region}
              onChange={(build) => {
                setSelectedBuild(build);
                setProgress(0);
              }}
            />
          )}
          <label className="mb-4 block text-sm text-white">
            <span className="mb-1 block text-white/70">Voice language</span>
            <select
              aria-label="Voice language"
              className="select select-bordered w-full border-white/20 bg-black/50 text-white"
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
          <div className="mb-4 flex items-center justify-between gap-3 text-sm">
            <span className="min-w-0 truncate">
              {downloading
                ? `Downloading ${downloadKind === "voice" ? `${voiceLanguage} voice` : "game files"}`
                : selectedBuild ? `${selectedBuild.version} / ${selectedBuild.branch}` : "Checking version..."}
            </span>
            <span className="shrink-0">{progress}%</span>
          </div>
          <div className="mb-5 h-1.5 w-full bg-white/15">
            <div className="h-full bg-cyan-300 transition-[width] duration-200" style={{ width: `${progress}%` }} />
          </div>
          <button
            type="button"
            onClick={() => game && startDownload(game.package, "game")}
            disabled={!game || downloading || !selectedBuild}
            className="flex w-full items-center justify-center gap-2 bg-cyan-300 px-5 py-3 font-semibold text-black transition-colors hover:bg-cyan-200 disabled:cursor-wait disabled:opacity-60"
          >
            <Download size={18} />
            {downloading && downloadKind === "game" ? "Downloading..." : `Download ${game?.name ?? "Game"}`}
          </button>
          <button
            type="button"
            onClick={() => startDownload(voiceLanguage, "voice")}
            disabled={!game || downloading || !selectedBuild}
            className="mt-2 flex w-full items-center justify-center gap-2 border border-white/25 bg-white/10 px-5 py-3 font-semibold text-white transition-colors hover:bg-white/20 disabled:cursor-wait disabled:opacity-60"
          >
            <Volume2 size={18} />
            {downloading && downloadKind === "voice" ? "Downloading voice..." : `Download ${voiceLanguage} voice`}
          </button>
        </section>
      </main>
    </div>
  );
}