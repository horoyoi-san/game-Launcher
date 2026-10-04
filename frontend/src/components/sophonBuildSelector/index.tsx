import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { FSService } from "@bindings/SilwerWolf999-launcher/internal/fs-service";

type SophonBuildSelectorProps = {
  gameIds: Partial<Record<string, string[]>>;
  defaultRegion: string;
  onChange: (build: SophonBuild | null) => void;
};

export type SophonBuild = {
  gameId: string;
  launcherId: string;
  region: string;
  version: string;
  branch: string;
};

function buildKey(build: SophonBuild) {
  return [build.gameId, build.launcherId, build.version, build.branch].join(":");
}

export default function SophonBuildSelector({ gameIds, defaultRegion, onChange }: SophonBuildSelectorProps) {
  const onChangeRef = useRef(onChange);
  const configuredRegions = Object.keys(gameIds).filter((region) => Boolean(gameIds[region]?.length));
  const gameRegions = configuredRegions.filter((item) => item !== "gameid");
  const regions = gameRegions.length > 0 ? gameRegions : configuredRegions;
  const initialRegion = regions.includes(defaultRegion) ? defaultRegion : regions[0] ?? defaultRegion;
  const [region, setRegion] = useState(initialRegion);
  const [versions, setVersions] = useState<SophonBuild[]>([]);
  const [selectedKey, setSelectedKey] = useState("");
  const [refreshToken, setRefreshToken] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setVersions([]);
    setSelectedKey("");
    onChangeRef.current(null);

    const ids = gameIds[region] ?? [];
    if (ids.length === 0) {
      setLoading(false);
      setError("No game IDs configured for this region");
      return () => {
        active = false;
      };
    }

    FSService.GetSophonVersions(ids, region)
      .then((result) => {
        if (!active) return;
        const available = result as unknown as SophonBuild[];
        setVersions(available);
        if (available.length === 0) {
          setError("No versions found");
          return;
        }

        const initial = available.find((build) => build.branch === "main") ?? available[0];
        setSelectedKey(buildKey(initial));
        onChangeRef.current(initial);
      })
      .catch((loadError: any) => {
        if (!active) return;
        const message = typeof loadError === "string" ? loadError : loadError?.message;
        setError(message && message !== "Error" ? message : "Live version checks require the desktop launcher.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [gameIds, region, refreshToken]);

  const selectedBuild = versions.find((build) => buildKey(build) === selectedKey);
  const statusMessage = loading
    ? "Checking available versions..."
    : error || (selectedBuild ? `Ready · launcher ${selectedBuild.launcherId}` : "Choose a region to check versions");

  return (
    <div className="space-y-4 text-sm text-white">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-white/50">Region</span>
          <select
            aria-label="Region"
            className="select select-bordered h-11 min-h-11 w-full border-white/12 bg-slate-950/70 text-white transition focus:border-cyan-200/60"
            value={region}
            onChange={(event) => setRegion(event.target.value)}
          >
            {regions.map((item) => <option key={item} value={item}>{item.replace("REL", " Release").replace("BETA", " Beta")}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-white/50">Version / branch</span>
          <select
            aria-label="Version and branch"
            className="select select-bordered h-11 min-h-11 w-full border-white/12 bg-slate-950/70 text-white transition focus:border-cyan-200/60 disabled:text-white/40"
            value={selectedKey}
            disabled={loading || versions.length === 0}
            onChange={(event) => {
              const build = versions.find((item) => buildKey(item) === event.target.value);
              setSelectedKey(event.target.value);
              onChange(build ?? null);
            }}
          >
            {versions.map((build) => (
              <option key={buildKey(build)} value={buildKey(build)}>
                {build.version} · {build.branch === "pre_download" ? "Pre-download" : "Main"}
              </option>
            ))}
            {versions.length === 0 && <option value="">{loading ? "Checking..." : "No version available"}</option>}
          </select>
        </label>
      </div>
      <div className="flex min-h-10 items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className={`size-2 shrink-0 rounded-full ${loading ? "animate-pulse bg-amber-200" : error ? "bg-rose-300" : selectedBuild ? "bg-emerald-300" : "bg-white/30"}`} />
          <span className={`truncate text-xs ${error ? "text-rose-200" : "text-white/55"}`} title={statusMessage}>
            {statusMessage}
          </span>
        </div>
        <button
          type="button"
          title="Check versions again"
          aria-label="Check versions again"
          disabled={loading}
          onClick={() => setRefreshToken((value) => value + 1)}
          className="grid size-8 shrink-0 place-items-center rounded-lg text-white/60 transition hover:bg-white/10 hover:text-white disabled:opacity-40"
        >
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
        </button>
      </div>
    </div>
  );
}