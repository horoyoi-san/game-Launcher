import { Download, LoaderCircle, X } from "lucide-react";

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
    return (
        <aside className="fixed right-5 top-20 z-[90] w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-pink-200/30 bg-slate-950/90 p-5 text-white shadow-2xl shadow-fuchsia-950/40 backdrop-blur-xl">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-pink-200 to-transparent" />
            <button
                type="button"
                onClick={onDismiss}
                disabled={isUpdating}
                aria-label="Dismiss launcher update"
                className="absolute right-3 top-3 grid size-8 place-items-center rounded-lg border border-white/10 text-white/60 transition hover:border-pink-200/40 hover:text-white disabled:opacity-40"
            >
                <X size={16} />
            </button>
            <div className="flex items-start gap-3 pr-8">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-pink-200/30 bg-pink-300/10 text-pink-100">
                    <Download size={19} />
                </span>
                <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-pink-200/80">Cyrene Launcher Update</p>
                    <h2 className="mt-1 text-lg font-semibold leading-tight">A new version is ready</h2>
                    <p className="mt-1 text-sm text-slate-300">Update now to get the latest improvements.</p>
                </div>
            </div>
            <div className="mt-4 flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">New version</span>
                <span className="rounded-md border border-pink-200/30 bg-pink-300/10 px-2 py-1 font-mono text-xs font-bold text-pink-100">v{version}</span>
            </div>
            {error && <p role="alert" className="mt-3 text-sm text-rose-300">{error}</p>}
            <button
                type="button"
                onClick={onUpdate}
                disabled={isUpdating}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-pink-100/50 bg-gradient-to-r from-pink-200 to-fuchsia-200 px-4 py-3 text-sm font-extrabold uppercase tracking-wide text-slate-950 shadow-lg shadow-fuchsia-950/30 transition hover:brightness-110 disabled:cursor-wait disabled:opacity-70"
            >
                {isUpdating ? <LoaderCircle size={16} className="animate-spin" /> : <Download size={16} />}
                {isUpdating ? "Updating..." : "Update now"}
            </button>
            <p className="mt-3 text-center text-[11px] text-slate-400">The launcher will close when the update is ready.</p>
        </aside>
    );
}
