import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowDownToLine,
  CheckCircle2,
  FolderOpen,
  Gamepad2,
  HardDrive,
  Info,
  Pause,
  ShieldCheck,
  Volume2,
} from "lucide-react";

const downloadSteps = [
  {
    icon: Gamepad2,
    title: "Choose a game",
    description: "Open Game Library from the left menu and select the game you want to install or update.",
  },
  {
    icon: ShieldCheck,
    title: "Select region and version",
    description: "Choose a supported region. The launcher checks the available game versions automatically.",
  },
  {
    icon: FolderOpen,
    title: "Choose an install location",
    description: "Press Download, confirm the destination folder, then browse to another folder if needed.",
  },
  {
    icon: ArrowDownToLine,
    title: "Start and track the download",
    description: "The progress panel shows downloaded data and speed. Use Pause/Resume or Cancel when needed.",
  },
];

export default function HowToPage() {
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

  return (
    <div className="fixed inset-0 z-0 overflow-hidden text-white">
      {bgType === "video" ? (
        <video className="absolute inset-0 h-full w-full object-cover" autoPlay loop muted playsInline>
          <source src={bgUrl} type="video/mp4" />
        </video>
      ) : (
        <img src={bgUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
      )}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950/90 via-slate-950/75 to-indigo-950/80" />

      <main className="absolute inset-0 overflow-y-auto pl-20 sm:pl-24">
        <div className="mx-auto w-full max-w-5xl px-5 pb-10 pt-20 sm:px-8 sm:pt-24">
          <header className="mb-7">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-200/20 bg-cyan-200/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100">
              <Info size={14} />
              Launcher Guide
            </div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">How to use the launcher</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/60 sm:text-base">
              Follow these steps to download game files and manage your installation.
            </p>
          </header>

          <section className="rounded-2xl border border-white/12 bg-slate-950/55 p-5 shadow-xl backdrop-blur-xl sm:p-7">
            <div className="mb-6 flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-xl border border-cyan-200/15 bg-cyan-200/10 text-cyan-100">
                <ArrowDownToLine size={20} />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">Game files</p>
                <h2 className="mt-1 text-xl font-semibold">Download or update a game</h2>
              </div>
            </div>

            <ol className="grid gap-3 md:grid-cols-2">
              {downloadSteps.map((step, index) => {
                const StepIcon = step.icon;
                return (
                  <li key={step.title} className="flex gap-4 rounded-xl border border-white/10 bg-black/20 p-4">
                    <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-white/5 text-cyan-100">
                      <StepIcon size={19} />
                    </span>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-cyan-200/75">Step 0{index + 1}</p>
                      <h3 className="mt-1 font-semibold">{step.title}</h3>
                      <p className="mt-1 text-sm leading-relaxed text-white/55">{step.description}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>

          <section className="mt-4 grid gap-4 md:grid-cols-2">
            <article className="rounded-2xl border border-white/12 bg-slate-950/55 p-5 shadow-xl backdrop-blur-xl sm:p-6">
              <span className="mb-4 grid size-10 place-items-center rounded-xl bg-violet-200/10 text-violet-100">
                <Volume2 size={19} />
              </span>
              <h2 className="text-lg font-semibold">Voice packs</h2>
              <p className="mt-2 text-sm leading-relaxed text-white/55">
                Choose a voice language on the game page, press Voice pack, and confirm the destination folder before starting.
              </p>
            </article>

            <article className="rounded-2xl border border-white/12 bg-slate-950/55 p-5 shadow-xl backdrop-blur-xl sm:p-6">
              <span className="mb-4 grid size-10 place-items-center rounded-xl bg-amber-200/10 text-amber-100">
                <Pause size={19} />
              </span>
              <h2 className="text-lg font-semibold">Pause or cancel</h2>
              <p className="mt-2 text-sm leading-relaxed text-white/55">
                Use Pause to temporarily suspend a download and Resume to continue. Cancel stops it; files already downloaded may remain in the selected folder.
              </p>
            </article>
          </section>

          <aside className="mt-4 flex gap-3 rounded-2xl border border-cyan-100/10 bg-cyan-100/5 p-4 text-sm text-cyan-50/75">
            <HardDrive size={18} className="mt-0.5 shrink-0 text-cyan-200" />
            <p className="leading-relaxed">
              Check that the destination drive has enough free space. Keep the launcher open while a download or patch operation is running.
            </p>
          </aside>

          <div className="mt-6 flex justify-center">
            <Link
              to="/games"
              className="inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-200"
            >
              <CheckCircle2 size={18} />
              Open Game Library
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
