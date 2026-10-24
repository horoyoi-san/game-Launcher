import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, FileArchive, Folder, HardDrive, Info, LoaderCircle, Play, ShieldCheck, X, Zap } from "lucide-react";
import { toast } from "react-toastify";
import { Events } from "@wailsio/runtime";
import { FSService } from "@bindings/sunbringer-launcher/internal/fs-service";
import { DiffService } from "@bindings/sunbringer-launcher/internal/diff-service";
import useSettingStore from "@/stores/settingStore";

const formatElapsed = (seconds: number) => `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;

export default function ZipPatchPage() {
  const { gameDir, setGameDir } = useSettingStore();
  const [patchFile, setPatchFile] = useState("");
  const [isSelectingFolder, setIsSelectingFolder] = useState(false);
  const [isSelectingPatch, setIsSelectingPatch] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [folderValid, setFolderValid] = useState(false);
  const [isCheckingFolder, setIsCheckingFolder] = useState(Boolean(gameDir));
  const [ziffProgress, setZiffProgress] = useState<{ message: string; percent: number | null }>({ message: "", percent: null });
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const patchStartedAt = useRef(0);
  const [bgUrl, setBgUrl] = useState("/video1.mp4");
  const [bgType, setBgType] = useState<"video" | "image">("video");
  const isZiffPatch = patchFile.toLowerCase().endsWith(".ziff");
  const canApplyPatch = Boolean(gameDir && folderValid && patchFile);

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

  useEffect(() => {
    let cancelled = false;
    if (!gameDir) {
      setFolderValid(false);
      setIsCheckingFolder(false);
      return;
    }

    setIsCheckingFolder(true);
    FSService.DirExists(gameDir)
      .then((exists) => {
        if (!cancelled) setFolderValid(exists);
      })
      .catch(() => {
        if (!cancelled) setFolderValid(false);
      })
      .finally(() => {
        if (!cancelled) setIsCheckingFolder(false);
      });

    return () => { cancelled = true; };
  }, [gameDir]);

  useEffect(() => {
    const onZiffProgress = (event: any) => {
      const data = event?.data ?? event;
      const rawPercent = Number(data?.percent);
      setZiffProgress({
        message: typeof data?.message === "string" ? data.message : "",
        percent: Number.isFinite(rawPercent) && rawPercent >= 0 && rawPercent <= 100 ? rawPercent : null,
      });
    };

    Events.On("diff:ziff-progress", onZiffProgress);
    return () => Events.Off("diff:ziff-progress");
  }, []);

  useEffect(() => {
    if (!isApplying) return;
    const timer = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - patchStartedAt.current) / 1000));
    }, 500);
    return () => window.clearInterval(timer);
  }, [isApplying]);

  const pickGameFolder = async () => {
    setIsSelectingFolder(true);
    try {
      const path = await FSService.PickFolder();
      if (!path) return;
      setGameDir(path);
      setFolderValid(false);
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
    if (!gameDir || !folderValid || !patchFile) {
      toast.error("Select an existing game folder and patch file first");
      return;
    }

    patchStartedAt.current = Date.now();
    setElapsedSeconds(0);
    setZiffProgress({ message: isZiffPatch ? "Starting Zift…" : "Starting patch updater…", percent: null });
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
              <p>Choose your game folder and a ZIP, 7Z, or Ziff update package.</p>
            </div>
              <div className="zip-patch-header__serial"><span>UTILITY</span><strong>01</strong><span>ZIP / 7Z / ZIFF</span></div>
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
                    {isCheckingFolder ? "CHECKING" : gameDir && folderValid ? <><Check size={13} /> READY</> : gameDir ? "NOT FOUND" : "START HERE"}
                  </span>
                </div>
                <h2>{isZiffPatch ? "Game folder to update" : "Game installation"}</h2>
                <p className="zip-patch-step__copy">{isZiffPatch ? "เลือกโฟลเดอร์เกมเวอร์ชันฐาน ไฟล์จาก Ziff จะถูกนำมาใช้และเขียนลงในโฟลเดอร์นี้โดยตรง" : "Point Sunbringer to the game’s main folder."}</p>
                <button type="button" onClick={pickGameFolder} disabled={isSelectingFolder || isApplying} className="zip-patch-picker">
                  {isSelectingFolder ? <LoaderCircle size={18} className="animate-spin" /> : <Folder size={18} />}
                  <span><strong>{isSelectingFolder ? "Selecting folder…" : gameDir ? "Change game folder" : "Choose game folder"}</strong><small>Browse to the installation directory</small></span>
                  <ArrowRight size={17} />
                </button>
                <div className={`zip-patch-selection ${gameDir ? folderValid ? "is-valid" : isCheckingFolder ? "is-checking" : "is-invalid" : "is-empty"}`}>
                  <HardDrive size={16} />
                  <p>{gameDir || "No game folder selected"}</p>
                  {gameDir && (folderValid ? <Check size={16} /> : !isCheckingFolder && <X size={16} />)}
                </div>
                {gameDir && !folderValid && !isCheckingFolder && <p className="zip-patch-step__validation" role="alert">ไม่พบโฟลเดอร์นี้แล้ว กรุณาเลือกโฟลเดอร์เกมต้นทางที่มีอยู่จริง</p>}
              </article>

              <article className={`zip-patch-step ${patchFile ? "is-complete" : gameDir ? "is-current" : "is-pending"}`}>
                <div className="zip-patch-step__heading">
                  <span className="zip-patch-step__number">02 <FileArchive size={17} /></span>
                  <span className={`zip-patch-state ${patchFile ? "is-good" : ""}`}>
                    {patchFile ? <><Check size={13} /> READY</> : "PATCH FILE"}
                  </span>
                </div>
                <h2>Patch package</h2>
                <p className="zip-patch-step__copy">Select the update package that matches your installed game version.</p>
                <button type="button" onClick={pickPatchFile} disabled={isSelectingPatch || isApplying} className="zip-patch-picker zip-patch-picker--violet">
                  {isSelectingPatch ? <LoaderCircle size={18} className="animate-spin" /> : <FileArchive size={18} />}
                  <span><strong>{isSelectingPatch ? "Selecting patch…" : patchFile ? "Change patch file" : "Choose patch file"}</strong><small>ZIP, 7Z or Ziff delta</small></span>
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

          {isZiffPatch && (
            <section className="ziff-output-panel" aria-labelledby="ziff-output-title">
              <header className="ziff-output-panel__heading">
                <span className="ziff-output-panel__index">03</span>
                <div><span className="zip-patch-eyebrow">Z I F F / DIRECT APPLY</span><h2 id="ziff-output-title">Apply files to the selected folder</h2></div>
                <span className="ziff-output-panel__badge">Ziff delta</span>
              </header>
              <p className="ziff-output-panel__description">Ziff จะใช้ไฟล์เกมในโฟลเดอร์ที่เลือกเป็นฐาน แล้วเขียนไฟล์ที่อัปเดตลงโฟลเดอร์นั้นโดยตรง ไม่มีการคัดลอกไปโฟลเดอร์อื่น กรุณาปิดเกมก่อนเริ่ม และตรวจสอบเวอร์ชันฐานให้ตรงกับแพตช์</p>
            </section>
          )}

          <section className={`zip-patch-launch ${canApplyPatch ? "is-ready" : ""}`}>
            <div className="zip-patch-launch__copy">
              <span className="zip-patch-launch__icon"><ShieldCheck size={20} /></span>
              <div>
                <span className="zip-patch-eyebrow">FINAL STEP</span>
                <h2>{canApplyPatch ? (isZiffPatch ? "Ready to update the selected folder" : "All set for patching") : "Your patch workspace"}</h2>
                <p>{canApplyPatch ? (isZiffPatch ? "Ziff files will be applied directly to the selected game folder." : "Review your selections, then apply the update.") : "Choose an existing game folder and patch file to continue."}</p>
              </div>
            </div>
            <button type="button" onClick={applyPatch} disabled={!canApplyPatch || isApplying} className="zip-patch-apply">
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
            <p className="mt-2 text-sm text-white/55">{isZiffPatch ? "Applying the Ziff delta directly to the selected folder. Do not close the launcher." : "Please keep the launcher open until the operation completes."}</p>
            <div className="zip-patch-progress__meta">
              <strong>{ziffProgress.percent === null ? "กำลังประมวลผล" : `${ziffProgress.percent.toFixed(1)}%`}</strong>
              <span>ใช้เวลา {formatElapsed(elapsedSeconds)}</span>
            </div>
            <div className="zip-patch-progress__track" role="progressbar" aria-label="Patch progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={ziffProgress.percent ?? undefined}>
              <div className={`zip-patch-progress__bar ${ziffProgress.percent === null ? "is-indeterminate" : ""}`} style={ziffProgress.percent === null ? undefined : { width: `${ziffProgress.percent}%` }} />
            </div>
            <p className="zip-patch-progress__message">{ziffProgress.message || "กำลังรอข้อมูลจากตัวอัปเดต…"}</p>
            {isZiffPatch && ziffProgress.percent === null && <small className="zip-patch-progress__hint">เปอร์เซ็นต์จะแสดงเมื่อ Zift ส่งข้อมูลความคืบหน้าออกมา</small>}
          </section>
        </div>
      )}
    </div>
  );
}
