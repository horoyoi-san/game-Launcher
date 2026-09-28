import { useEffect, useState } from "react";
import { Check, FileArchive, Folder, LoaderCircle, Play, X } from "lucide-react";
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
  const [bgUrl, setBgUrl] = useState("/video2.mp4");
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
      <div className="absolute inset-0 bg-black/70" />
      <main className="relative z-10 ml-24 flex min-h-full flex-col justify-end px-8 pb-10 pt-24">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">Patch utility</p>
        <h1 className="mb-6 text-4xl font-bold">Apply game diff</h1>

        <section className="w-full max-w-xl space-y-5 border border-white/20 bg-black/45 p-5 backdrop-blur-md">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <Folder size={18} className="text-cyan-200" />
              Game folder
            </div>
            <button
              type="button"
              onClick={pickGameFolder}
              disabled={isSelectingFolder || isApplying}
              className="flex w-full items-center justify-center gap-2 border border-white/25 bg-white/10 px-4 py-3 text-sm hover:bg-white/20 disabled:opacity-50"
            >
              {isSelectingFolder ? <LoaderCircle size={17} className="animate-spin" /> : <Folder size={17} />}
              {isSelectingFolder ? "Selecting folder..." : "Choose game folder"}
            </button>
            {gameDir && (
              <div className="mt-2 flex items-center gap-2 text-xs text-white/75">
                {folderValid ? <Check size={15} className="shrink-0 text-emerald-300" /> : <X size={15} className="shrink-0 text-red-300" />}
                <span className="truncate" title={gameDir}>{gameDir}</span>
              </div>
            )}
          </div>

          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <FileArchive size={18} className="text-cyan-200" />
              Diff patch archive
            </div>
            <button
              type="button"
              onClick={pickPatchFile}
              disabled={isSelectingPatch || isApplying}
              className="flex w-full items-center justify-center gap-2 border border-white/25 bg-white/10 px-4 py-3 text-sm hover:bg-white/20 disabled:opacity-50"
            >
              {isSelectingPatch ? <LoaderCircle size={17} className="animate-spin" /> : <FileArchive size={17} />}
              {isSelectingPatch ? "Selecting patch..." : "Choose .zip or .7z patch"}
            </button>
            {patchFile && <p className="mt-2 truncate text-xs text-white/75" title={patchFile}>{patchFile}</p>}
          </div>

          <button
            type="button"
            onClick={applyPatch}
            disabled={!gameDir || !patchFile || isApplying}
            className="flex w-full items-center justify-center gap-2 bg-cyan-300 px-5 py-3 font-semibold text-black transition-colors hover:bg-cyan-200 disabled:cursor-wait disabled:opacity-50"
          >
            {isApplying ? <LoaderCircle size={18} className="animate-spin" /> : <Play size={18} />}
            {isApplying ? "Applying patch..." : "Apply diff patch"}
          </button>
        </section>
      </main>
    </div>
  );
}