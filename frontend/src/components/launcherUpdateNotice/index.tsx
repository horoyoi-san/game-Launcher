import { ArrowDownToLine, Clock3, LoaderCircle, Sparkles, X } from "lucide-react";

type LauncherUpdateNoticeProps = {
  version: string;
  isUpdating: boolean;
  error: string;
  onUpdate: () => void;
  onDismiss: () => void;
};

export default function LauncherUpdateNotice({
  version,
  isUpdating,
  error,
  onUpdate,
  onDismiss,
}: LauncherUpdateNoticeProps) {
  if (!version) return null;

  return (
    <aside
      aria-label="Launcher update available"
      aria-live="polite"
      className="fixed right-5 top-24 z-[90] w-[min(24rem,calc(100vw-6rem))] animate-[fade-in_180ms_ease-out]"
    >
      <div className="arcade-frame relative overflow-hidden p-4 text-white shadow-[0_18px_60px_rgba(0,0,0,0.55)] sm:p-5">
        <div className="pointer-events-none absolute -right-12 -top-16 size-44 rounded-full bg-cyan-300/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-10 size-40 rounded-full bg-fuchsia-400/15 blur-3xl" />

        <div className="relative">
          <div className="flex items-start gap-3">
            <div className="grid size-11 shrink-0 place-items-center border border-cyan-200/40 bg-cyan-300/10 text-cyan-100 shadow-[0_0_24px_rgba(83,246,255,0.12)]">
              <ArrowDownToLine size={21} />
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="mb-1 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200">
                <Sparkles size={12} />
                Launcher update
              </div>
              <h2 className="text-base font-black leading-tight text-white sm:text-lg">A new version is ready</h2>
              <p className="mt-1 text-xs leading-relaxed text-white/60">
                Update now to get the latest improvements.
              </p>
            </div>
            <button
              type="button"
              aria-label="Remind me later"
              title="Remind me later"
              onClick={onDismiss}
              disabled={isUpdating}
              className="grid size-7 shrink-0 place-items-center border border-white/10 text-white/50 transition hover:border-white/30 hover:bg-white/10 hover:text-white disabled:opacity-40"
            >
              <X size={15} />
            </button>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3 border border-white/10 bg-black/25 px-3 py-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-white/45">New version</span>
            <span className="border border-fuchsia-200/25 bg-fuchsia-300/10 px-2 py-1 font-mono text-xs font-bold text-fuchsia-100">
              v{version}
            </span>
          </div>

          {error && (
            <p role="alert" className="mt-3 border-l-2 border-rose-300 bg-rose-300/10 px-3 py-2 text-xs leading-relaxed text-rose-100">
              {error}
            </p>
          )}

          <div className="mt-4 flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 text-[10px] text-white/45">
              <Clock3 size={12} />
              {isUpdating ? "Preparing update..." : "You can update now or later"}
            </span>
            <button
              type="button"
              onClick={onUpdate}
              disabled={isUpdating}
              className="arcade-button arcade-button--primary inline-flex min-h-10 items-center justify-center gap-2 px-3 text-[10px] disabled:cursor-wait"
            >
              {isUpdating ? <LoaderCircle size={14} className="animate-spin" /> : <ArrowDownToLine size={14} />}
              {isUpdating ? "Updating" : "Update now"}
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
