import { useEffect, useState } from "react";
import { ArrowRight, Check, FileArchive, Folder, HardDrive, Info, LoaderCircle, Play, ShieldCheck, X } from "lucide-react";
import { toast } from "react-toastify";
import { FSService } from "@bindings/SilwerWolf999-launcher/internal/fs-service";
import { DiffService } from "@bindings/SilwerWolf999-launcher/internal/diff-service";
import useSettingStore from "@/stores/settingStore";

export default function ZipPatchPage() {
  const { gameDir, setGameDir } = useSettingStore();
  const [patchFile, setPatchFile] = useState("");
  const [isSelectingFolder, setIsSelectingFolder] = useState(false);
  const [isSelectingPatch, setIsSelectingPatch] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [folderValid, setFolderValid] = useState(Boolean(gameDir));
  const [bgUrl, setBgUrl] = useState("/video3.mp4");
  const [bgType, setBgType] = useState<"video" | "image">("video");

  useEffect(() => {
    const savedUrl = localStorage.getItem("customBgUrl");
    const savedType = localStorage.getItem("customBgType") as "video" | "image" | null;
    if (savedUrl && savedType) {
      setBgUrl(savedUrl);
      setBgType(savedType);
    }

    const handleBackgroundChange = (event: Event) => {
      const detail = (event as CustomEvent<{ url: string; type: "video" | "image" }>).detail;
      if (detail?.url && detail.type) {
        setBgUrl(detail.url);
        setBgType(detail.type);
      }
    };

    window.addEventListener("launcherBgChanged", handleBackgroundChange);
    return () => window.removeEventListener("launcherBgChanged", handleBackgroundChange);
  }, []);

  const pickGameFolder = async () => {
    setIsSelectingFolder(true);
    try {
      const path = await FSService.PickFolder();
      if (!path) return;
      setGameDir(path);
      setFolderValid(true);
    } catch (error: any) {
      setFolderValid(false);
      toast.error(error?.message || "Could not select game folder");
    } finally {
      setIsSelectingFolder(false);
    }
  };

  const pickPatchFile = async () => {
    setIsSelectingPatch(true);
    try {
      const path = await FSService.PickFile("patch");
      if (path) setPatchFile(path);
    } catch (error: any) {
      toast.error(error?.message || "Could not select patch file");
    } finally {
      setIsSelectingPatch(false);
    }
  };

  const applyPatch = async () => {
    if (!gameDir || !patchFile) {
      toast.error("Select a game folder and patch archive first");
      return;
    }

    setIsApplying(true);
    try {
      const [success, message] = await DiffService.ApplyDiffZip(gameDir, patchFile);
      if (!success) {
        toast.error(message || "Patch failed");
        return;
      }
      toast.success(message || "Patch completed");
    } catch (error: any) {
      toast.error(error?.message || "Patch failed");
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-0 overflow-hidden text-white">
      {bgType === "video" ? (
        <video className="absolute inset-0 h-full w-full object-cover" autoPlay loop muted playsInline>
          <source src={bgUrl} type="video/mp4" />
        </video>
      ) : (
        <img src={bgUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
      )}
      <div className="absolute inset-0 bg-gradient-to-br from-[#080c12]/95 via-[#111722]/90 to-[#180d1b]/95" />
      <main className="absolute inset-0 overflow-y-auto pl-20 sm:pl-24">
        <div className="mx-auto w-full max-w-5xl px-5 pb-10 pt-20 sm:px-8 sm:pt-24">
          <header className="mb-7">
            <div className="mb-3 inline-flex items-center gap-2 border-2 border-cyan-400/50 bg-[#101923]/90 px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-[0.18em] text-cyan-200 shadow-[4px_4px_0_rgba(34,211,238,0.16)]">
              <FileArchive size={14} />
              ZIP Patch Utility
            </div>
            <h1 className="font-mono text-3xl font-black uppercase tracking-tight text-white sm:text-4xl">Apply game patch</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/60 sm:text-base">
              Choose the game installation and patch archive to update your local game files.
            </p>
          </header>

          <section className="grid gap-4 lg:grid-cols-2">
            <article className="border-2 border-cyan-400/30 bg-[#111721]/90 p-5 shadow-[6px_6px_0_rgba(0,0,0,0.45)] backdrop-blur-xl sm:p-6">
              <div className="mb-5 flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="grid size-11 place-items-center border-2 border-cyan-400/40 bg-cyan-400/10 text-cyan-200">
                    <Folder size={20} />
                  </span>
                  <div>
                    <p className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-lime-300/80">Step 01</p>
                    <h2 className="mt-1 font-mono text-lg font-bold uppercase">Game installation</h2>
                  </div>
                </div>
                {gameDir && folderValid ? (
                  <span className="inline-flex items-center gap-1.5 border-2 border-lime-300/40 bg-lime-300/10 px-2.5 py-1 font-mono text-xs font-bold uppercase text-lime-200">
                    <Check size={14} /> Selected
                  </span>
                ) : (
                  <span className="border-2 border-white/15 bg-white/5 px-2.5 py-1 font-mono text-xs font-bold uppercase text-white/55">Required</span>
                )}
              </div>
              <p className="mb-4 text-sm leading-relaxed text-white/55">
                Select the main folder where the target game is installed.
              </p>
              <button
                type="button"
                onClick={pickGameFolder}
                disabled={isSelectingFolder || isApplying}
                className="flex w-full items-center justify-center gap-2 border-2 border-cyan-400/45 bg-[#151d28] px-4 py-3 font-mono text-sm font-bold uppercase tracking-wide transition hover:bg-cyan-400/10 hover:shadow-[4px_4px_0_rgba(34,211,238,0.22)] disabled:cursor-wait disabled:opacity-50"
              >
                {isSelectingFolder ? <LoaderCircle size={17} className="animate-spin" /> : <Folder size={17} />}
                {isSelectingFolder ? "Selecting folder..." : gameDir ? "Change game folder" : "Choose game folder"}
              </button>
              <div className={`mt-4 flex min-h-[4.5rem] items-start gap-3 border p-3 ${
                gameDir
                  ? folderValid ? "border-lime-300/40 bg-lime-300/5" : "border-fuchsia-400/40 bg-fuchsia-400/5"
                  : "border-[#394354] bg-[#090d13]"
              }`}>
                <HardDrive size={16} className="mt-0.5 shrink-0 text-cyan-300" />
                <p className="min-w-0 break-all font-mono text-xs leading-relaxed text-white/75">
                  {gameDir || "No game folder selected"}
                </p>
                {gameDir && (folderValid
                  ? <Check size={15} className="mt-0.5 shrink-0 text-lime-300" />
                  : <X size={15} className="mt-0.5 shrink-0 text-fuchsia-300" />)}
              </div>
            </article>

            <article className="border-2 border-fuchsia-400/35 bg-[#111721]/90 p-5 shadow-[6px_6px_0_rgba(0,0,0,0.45)] backdrop-blur-xl sm:p-6">
              <div className="mb-5 flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="grid size-11 place-items-center border-2 border-fuchsia-400/40 bg-fuchsia-400/10 text-fuchsia-200">
                    <FileArchive size={20} />
                  </span>
                  <div>
                    <p className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-fuchsia-300/85">Step 02</p>
                    <h2 className="mt-1 font-mono text-lg font-bold uppercase">Patch archive</h2>
                  </div>
                </div>
                {patchFile ? (
                  <span className="inline-flex items-center gap-1.5 border-2 border-lime-300/40 bg-lime-300/10 px-2.5 py-1 font-mono text-xs font-bold uppercase text-lime-200">
                    <Check size={14} /> Selected
                  </span>
                ) : (
                  <span className="border-2 border-white/15 bg-white/5 px-2.5 py-1 font-mono text-xs font-bold uppercase text-white/55">Required</span>
                )}
              </div>
              <p className="mb-4 text-sm leading-relaxed text-white/55">
                Choose the patch archive you want to apply (.zip, .7z or .rar).
              </p>
              <button
                type="button"
                onClick={pickPatchFile}
                disabled={isSelectingPatch || isApplying}
                className="flex w-full items-center justify-center gap-2 border-2 border-fuchsia-400/45 bg-[#151d28] px-4 py-3 font-mono text-sm font-bold uppercase tracking-wide transition hover:bg-fuchsia-400/10 hover:shadow-[4px_4px_0_rgba(232,121,249,0.22)] disabled:cursor-wait disabled:opacity-50"
              >
                {isSelectingPatch ? <LoaderCircle size={17} className="animate-spin" /> : <FileArchive size={17} />}
                {isSelectingPatch ? "Selecting archive..." : patchFile ? "Change patch archive" : "Choose patch archive"}
              </button>
              <div className={`mt-4 flex min-h-[4.5rem] items-start gap-3 border p-3 ${
                patchFile ? "border-lime-300/40 bg-lime-300/5" : "border-[#394354] bg-[#090d13]"
              }`}>
                <FileArchive size={16} className="mt-0.5 shrink-0 text-fuchsia-300" />
                <p className="min-w-0 break-all font-mono text-xs leading-relaxed text-white/75">
                  {patchFile || "No patch archive selected"}
                </p>
              </div>
            </article>
          </section>

          <section className="mt-4 border-2 border-lime-300/35 bg-[#111721]/95 p-5 shadow-[6px_6px_0_rgba(0,0,0,0.45)] backdrop-blur-xl sm:flex sm:items-center sm:justify-between sm:gap-6 sm:p-6">
            <div className="mb-4 flex items-start gap-3 sm:mb-0">
              <ShieldCheck size={20} className="mt-0.5 shrink-0 text-lime-300" />
              <div>
                <h2 className="font-mono font-bold uppercase">Ready to apply?</h2>
                <p className="mt-1 text-sm text-white/55">Select both the game folder and patch archive to continue.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={applyPatch}
              disabled={!gameDir || !folderValid || !patchFile || isApplying}
              className="flex w-full shrink-0 items-center justify-center gap-2 border-2 border-cyan-200 bg-cyan-300 px-6 py-3.5 font-mono font-black uppercase text-[#081016] shadow-[5px_5px_0_rgba(34,211,238,0.25)] transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
            >
              {isApplying ? <LoaderCircle size={18} className="animate-spin" /> : <Play size={18} />}
              {isApplying ? "Applying patch..." : "Apply patch"}
              {!isApplying && <ArrowRight size={17} />}
            </button>
          </section>

          <aside className="mt-4 flex gap-3 border-2 border-cyan-400/30 bg-[#101923]/90 p-4 text-sm text-cyan-50/85">
            <Info size={18} className="mt-0.5 shrink-0 text-cyan-300" />
            <p className="leading-relaxed">
              Make sure the game is closed and the patch matches your installed version. Keep the launcher open while files are being updated.
            </p>
          </aside>
        </div>
      </main>

      {isApplying && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#070a10]/85 p-4 backdrop-blur-md">
          <section role="status" aria-live="polite" className="w-full max-w-md border-2 border-cyan-400/55 bg-[#101720] p-7 text-center text-white shadow-[8px_8px_0_rgba(34,211,238,0.18)]">
            <span className="mx-auto mb-4 grid size-12 place-items-center border-2 border-cyan-400/40 bg-cyan-400/10 text-cyan-200">
              <LoaderCircle size={24} className="animate-spin" />
            </span>
            <h2 className="font-mono text-xl font-black uppercase">Applying patch</h2>
            <p className="mt-2 text-sm text-white/55">Please keep the launcher open until the operation completes.</p>
          </section>
        </div>
      )}
    </div>
  );
}