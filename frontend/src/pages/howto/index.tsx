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
      <div className="absolute inset-0 bg-gradient-to-br from-[#080c12]/95 via-[#111722]/90 to-[#180d1b]/95" />

      <main className="absolute inset-0 overflow-y-auto pl-20 sm:pl-24">
        <div className="mx-auto w-full max-w-5xl px-5 pb-10 pt-20 sm:px-8 sm:pt-24">
          <header className="mb-7">
            <div className="mb-3 inline-flex items-center gap-2 border-2 border-cyan-400/50 bg-[#101923]/90 px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-[0.18em] text-cyan-200 shadow-[4px_4px_0_rgba(34,211,238,0.16)]">
              <Info size={14} />
              Launcher Guide
            </div>
            <h1 className="font-mono text-3xl font-black uppercase tracking-tight text-white sm:text-4xl">How to use the launcher</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/60 sm:text-base">
              Follow these steps to download game files and manage your installation.
            </p>
          </header>

          <section className="border-2 border-cyan-400/35 bg-[#111721]/90 p-5 shadow-[6px_6px_0_rgba(0,0,0,0.45)] backdrop-blur-xl sm:p-7">
            <div className="mb-6 flex items-center gap-3">
              <span className="grid size-11 place-items-center border-2 border-cyan-400/40 bg-cyan-400/10 text-cyan-200">
                <ArrowDownToLine size={20} />
              </span>
              <div>
                <p className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-cyan-300/80">Game files</p>
                <h2 className="mt-1 font-mono text-xl font-bold uppercase">Download or update a game</h2>
              </div>
            </div>

            <ol className="grid gap-3 md:grid-cols-2">
              {downloadSteps.map((step, index) => {
                const StepIcon = step.icon;
                return (
                  <li key={step.title} className="flex gap-4 border border-[#465064] bg-[#090d13]/90 p-4">
                    <span className="grid size-10 shrink-0 place-items-center border border-cyan-400/35 bg-cyan-400/10 text-cyan-200">
                      <StepIcon size={19} />
                    </span>
                    <div>
                      <p className="font-mono text-xs font-bold uppercase tracking-[0.12em] text-lime-300/85">Step 0{index + 1}</p>
                      <h3 className="mt-1 font-mono font-bold uppercase">{step.title}</h3>
                      <p className="mt-1 text-sm leading-relaxed text-white/55">{step.description}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>

          <section className="mt-4 grid gap-4 md:grid-cols-2">
            <article className="border-2 border-fuchsia-400/35 bg-[#111721]/90 p-5 shadow-[6px_6px_0_rgba(0,0,0,0.45)] backdrop-blur-xl sm:p-6">
              <span className="mb-4 grid size-10 place-items-center border-2 border-fuchsia-400/40 bg-fuchsia-400/10 text-fuchsia-200">
                <Volume2 size={19} />
              </span>
              <h2 className="font-mono text-lg font-bold uppercase">Voice packs</h2>
              <p className="mt-2 text-sm leading-relaxed text-white/55">
                Choose a voice language on the game page, press Voice pack, and confirm the destination folder before starting.
              </p>
            </article>

            <article className="border-2 border-lime-300/35 bg-[#111721]/90 p-5 shadow-[6px_6px_0_rgba(0,0,0,0.45)] backdrop-blur-xl sm:p-6">
              <span className="mb-4 grid size-10 place-items-center border-2 border-lime-300/40 bg-lime-300/10 text-lime-200">
                <Pause size={19} />
              </span>
              <h2 className="font-mono text-lg font-bold uppercase">Pause or cancel</h2>
              <p className="mt-2 text-sm leading-relaxed text-white/55">
                Use Pause to temporarily suspend a download and Resume to continue. Cancel stops it; files already downloaded may remain in the selected folder.
              </p>
            </article>
          </section>

          <aside className="mt-4 flex gap-3 border-2 border-cyan-400/30 bg-[#101923]/90 p-4 text-sm text-cyan-50/85">
            <HardDrive size={18} className="mt-0.5 shrink-0 text-cyan-300" />
            <p className="leading-relaxed">
              Check that the destination drive has enough free space. Keep the launcher open while a download or patch operation is running.
            </p>
          </aside>

          <div className="mt-6 flex justify-center">
            <Link
              to="/games"
              className="inline-flex items-center gap-2 border-2 border-cyan-200 bg-cyan-300 px-5 py-3 font-mono font-black uppercase text-[#081016] shadow-[5px_5px_0_rgba(34,211,238,0.25)] transition hover:bg-cyan-200"
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
