import { useEffect, useState } from "react";
import { ArrowRight, Check, FileArchive, Folder, HardDrive, Info, LoaderCircle, Play, ShieldCheck, X, Zap } from "lucide-react";
import { toast } from "react-toastify";
import { FSService } from "@bindings/sunbringer-launcher/internal/fs-service";
import { DiffService } from "@bindings/sunbringer-launcher/internal/diff-service";
import useSettingStore from "@/stores/settingStore";

export default function ZipPatchPage() {
  const { gameDir, setGameDir } = useSettingStore();
  const [patchFile, setPatchFile] = useState("");
  const [isSelectingFolder, setIsSelectingFolder] = useState(false);
  const [isSelectingPatch, setIsSelectingPatch] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [folderValid, setFolderValid] = useState(Boolean(gameDir));
  const [bgUrl, setBgUrl] = useState("/video1.mp4");
  const [bgType, setBgType] = useState<"video" | "image">("video");

  useEffect(() => {
    const savedUrl = localStorage.getItem("customBgUrl");
    const savedType = localStorage.getItem("customBgType") as "video" | "image" | null;
    if (savedUrl && savedType) {
      setBgUrl(savedUrl);
      setBgType(savedType);
    } else {
      setBgUrl("/video1.mp4");
      setBgType("video");
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
    <div className="zip-patch-page fixed inset-0 z-0 overflow-hidden text-white">
      {bgType === "video" ? (
        <video className="absolute inset-0 h-full w-full object-cover" autoPlay loop muted playsInline>
          <source src={bgUrl} type="video/mp4" />
        </video>
      ) : (
        <img src={bgUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
      )}
      <div className="zip-patch-page__veil absolute inset-0 z-0" />
      <main className="zip-patch-page__scroll absolute inset-0 z-10 overflow-y-auto pl-20 sm:pl-24">
        <div className="zip-patch-page__layout mx-auto w-full max-w-6xl px-5 pb-10 pt-20 sm:px-8 sm:pt-24">
          <header className="zip-patch-header">
            <div className="zip-patch-header__orbit"><FileArchive size={19} /></div>
            <div className="min-w-0 flex-1">
              <div className="zip-patch-eyebrow"><span /> SUNBRINGER // PATCH CONTROL</div>
              <h1>Update your game</h1>
              <p>Choose the install and patch package. We’ll take care of the file update.</p>
            </div>
            <div className="zip-patch-header__serial"><span>UTILITY</span><strong>01</strong><span>ZIP / 7Z / RAR</span></div>
          </header>

          <section className="zip-patch-workflow" aria-label="Patch setup">
            <div className="zip-patch-workflow__rail" aria-hidden="true">
              <span className={gameDir && folderValid ? "is-complete" : "is-current"}>01</span><i />
              <span className={patchFile ? "is-complete" : !gameDir ? "" : "is-current"}>02</span><i />
              <span className={gameDir && folderValid && patchFile ? "is-current" : ""}><Zap size={14} /></span>
            </div>
            <div className="zip-patch-workflow__steps">
              <article className={`zip-patch-step ${gameDir && folderValid ? "is-complete" : "is-current"}`}>
                <div className="zip-patch-step__heading">
                  <span className="zip-patch-step__number">01 <Folder size={17} /></span>
                  <span className={`zip-patch-state ${gameDir && folderValid ? "is-good" : ""}`}>
                    {gameDir && folderValid ? <><Check size={13} /> READY</> : "START HERE"}
                  </span>
                </div>
                <h2>Game installation</h2>
                <p className="zip-patch-step__copy">Point Sunbringer to the game’s main folder.</p>
                <button type="button" onClick={pickGameFolder} disabled={isSelectingFolder || isApplying} className="zip-patch-picker">
                  {isSelectingFolder ? <LoaderCircle size={18} className="animate-spin" /> : <Folder size={18} />}
                  <span><strong>{isSelectingFolder ? "Selecting folder…" : gameDir ? "Change game folder" : "Choose game folder"}</strong><small>Browse to the installation directory</small></span>
                  <ArrowRight size={17} />
                </button>
                <div className={`zip-patch-selection ${gameDir ? folderValid ? "is-valid" : "is-invalid" : "is-empty"}`}>
                  <HardDrive size={16} />
                  <p>{gameDir || "No game folder selected"}</p>
                  {gameDir && (folderValid ? <Check size={16} /> : <X size={16} />)}
                </div>
              </article>

              <article className={`zip-patch-step ${patchFile ? "is-complete" : gameDir ? "is-current" : "is-pending"}`}>
                <div className="zip-patch-step__heading">
                  <span className="zip-patch-step__number">02 <FileArchive size={17} /></span>
                  <span className={`zip-patch-state ${patchFile ? "is-good" : ""}`}>
                    {patchFile ? <><Check size={13} /> READY</> : "PATCH FILE"}
                  </span>
                </div>
                <h2>Patch package</h2>
                <p className="zip-patch-step__copy">Select the archive that matches your installed game version.</p>
                <button type="button" onClick={pickPatchFile} disabled={isSelectingPatch || isApplying} className="zip-patch-picker zip-patch-picker--violet">
                  {isSelectingPatch ? <LoaderCircle size={18} className="animate-spin" /> : <FileArchive size={18} />}
                  <span><strong>{isSelectingPatch ? "Selecting archive…" : patchFile ? "Change patch archive" : "Choose patch archive"}</strong><small>ZIP, 7Z or RAR archive</small></span>
                  <ArrowRight size={17} />
                </button>
                <div className={`zip-patch-selection ${patchFile ? "is-valid" : "is-empty"}`}>
                  <FileArchive size={16} />
                  <p>{patchFile || "No patch archive selected"}</p>
                  {patchFile && <Check size={16} />}
                </div>
              </article>
            </div>
          </section>

          <section className={`zip-patch-launch ${gameDir && folderValid && patchFile ? "is-ready" : ""}`}>
            <div className="zip-patch-launch__copy">
              <span className="zip-patch-launch__icon"><ShieldCheck size={20} /></span>
              <div>
                <span className="zip-patch-eyebrow">FINAL STEP</span>
                <h2>{gameDir && folderValid && patchFile ? "All set for launch" : "Your patch workspace"}</h2>
                <p>{gameDir && folderValid && patchFile ? "Review your selections, then apply the update." : "Choose both items above to enable patching."}</p>
              </div>
            </div>
            <button type="button" onClick={applyPatch} disabled={!gameDir || !folderValid || !patchFile || isApplying} className="zip-patch-apply">
              {isApplying ? <LoaderCircle size={18} className="animate-spin" /> : <Play size={17} />}
              {isApplying ? "Applying patch…" : "Apply patch"}
              {!isApplying && <ArrowRight size={17} />}
            </button>
          </section>

          <aside className="zip-patch-note"><Info size={17} /><p>Close the game before patching. The archive must match your installed version; keep Sunbringer open until the update finishes.</p></aside>
        </div>
      </main>

      {isApplying && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#070a10]/85 p-4 backdrop-blur-md">
          <section role="status" aria-live="polite" className="zip-patch-progress w-full max-w-md p-7 text-center text-white">
            <span className="zip-patch-progress__spinner mx-auto mb-4 grid size-12 place-items-center">
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
