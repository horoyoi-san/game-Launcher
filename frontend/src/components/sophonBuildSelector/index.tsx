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
  const regions = Object.keys(gameIds).filter((region) => Boolean(gameIds[region]?.length));
  const [region, setRegion] = useState(defaultRegion);
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

  return (
    <div className="mb-3 space-y-2 text-sm text-white">
      <label className="block">
        <span className="mb-1 block text-white/70">Region</span>
        <select
          aria-label="Region"
          className="select select-bordered w-full border-white/20 bg-black/50 text-white"
          value={region}
          onChange={(event) => setRegion(event.target.value)}
        >
          {regions.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </label>
      <label className="block">
        <span className="mb-1 block text-white/70">Version / Branch</span>
        <select
          aria-label="Version and branch"
          className="select select-bordered w-full border-white/20 bg-black/50 text-white"
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
              {build.version} / {build.branch === "pre_download" ? "Pre-download" : "Main"} / {build.gameId}
            </option>
          ))}
        </select>
      </label>
      <div className="flex min-h-8 items-center justify-between text-xs text-white/70">
        <span>{loading ? "Checking game versions..." : error || (selectedBuild ? `Checked from ${selectedBuild.launcherId}` : "")}</span>
        <button
          type="button"
          title="Check versions again"
          aria-label="Check versions again"
          disabled={loading}
          onClick={() => setRefreshToken((value) => value + 1)}
          className="grid size-8 place-items-center text-white/80 hover:text-white disabled:opacity-40"
        >
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
        </button>
      </div>
    </div>
  );
}