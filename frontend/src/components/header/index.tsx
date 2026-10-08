import { Link, useRouterState } from "@tanstack/react-router";
import useModalStore from "@/stores/modalStore";
import { BookOpen, Diff, GitCompareArrows, Grid2X2, Home, Images, Minus, Settings, X } from "lucide-react";
import { AppService } from "@bindings/SilwerWolf999-launcher/internal/app-service";
import { motion } from "motion/react";
import usePanelStore from "@/stores/panelStore";

export default function Header() {
    const { setIsOpenSettingModal } = useModalStore();
    const { setActiveUrl, setShowPanel, setIsMinimized } = usePanelStore();
    const pathname = useRouterState({ select: (state) => state.location.pathname });

    const controlButtons = [
        {
            icon: <Settings className="w-7 h-7 text-white" />,
            action: () => setIsOpenSettingModal(true),
            tip: "Settings",
            hover: { rotate: 20, color: "#e343e9" },
        },
        {
            icon: <Minus className="w-7 h-7 text-white" />,
            action: () => AppService.MinimizeApp(),
            tip: "Minimize",
            hover: { rotate: 20, color: "#e343e9" },
        },
        {
            icon: <X className="w-7 h-7 text-white" />,
            action: () => AppService.CloseApp(),
            tip: "Close",
            hover: { color: "#e343e9", rotate: -10 },
        },
    ];

    return (
        <>
            {/* Sidebar ด้านซ้าย */}
            <div className="fixed left-0 top-0 z-[70] flex h-full w-[76px] flex-col items-center justify-between border-r-2 border-cyan-300/40 bg-[#090b15]/95 py-5 shadow-[4px_0_0_rgba(250,77,255,0.12),0_0_28px_rgba(0,0,0,0.65)] backdrop-blur-xl">
                <div className="flex flex-col items-center gap-2">
                    <Link to="/" className="flex flex-col items-center gap-1 transition-transform hover:-translate-y-0.5">
                        <img src="/appicon.png" alt="Logo" className="z-[70] h-12 w-12 border-2 border-fuchsia-300/70 bg-black object-cover [image-rendering:pixelated]" />
                        <h1 className="text-center text-[8px] font-black leading-tight tracking-[0.08em] text-cyan-200 drop-shadow-[2px_2px_0_rgba(250,77,255,0.65)]">SILVER<br />WOLF 999</h1>
                    </Link>
                </div>

                <div className="mt-8 flex flex-col items-center gap-3 text-white">
                    <Link to="/" title="Home" aria-label="Home" className={`grid size-11 place-items-center border transition-colors ${pathname === "/" ? "border-cyan-200 bg-cyan-300/15 text-cyan-100 shadow-[2px_2px_0_rgba(250,77,255,0.45)]" : "border-transparent text-white/65 hover:border-white/20 hover:bg-white/5 hover:text-cyan-200"}`}><Home size={22} /></Link>

                    <Link
                        to="/games"
                        title="Game library"
                        aria-label="Game library"
                        className={`grid size-11 place-items-center border transition-colors ${pathname === "/games" ? "border-cyan-200 bg-cyan-300/15 text-cyan-100 shadow-[2px_2px_0_rgba(250,77,255,0.45)]" : "border-transparent text-white/65 hover:border-white/20 hover:bg-white/5 hover:text-cyan-200"}`}
                    >
                        <Grid2X2 size={24} />
                    </Link>
                    <Link to="/diff" title="Diff Update" aria-label="Diff Update" className={`grid size-11 place-items-center border transition-colors ${pathname === "/diff" ? "border-cyan-200 bg-cyan-300/15 text-cyan-100 shadow-[2px_2px_0_rgba(250,77,255,0.45)]" : "border-transparent text-white/65 hover:border-white/20 hover:bg-white/5 hover:text-cyan-200"}`}>
                        <Diff size={20} />
                    </Link>
                    <Link to="/legacy-diff" title="Legacy Diff" aria-label="Legacy Diff" className={`grid size-11 place-items-center border transition-colors ${pathname === "/legacy-diff" ? "border-cyan-200 bg-cyan-300/15 text-cyan-100 shadow-[2px_2px_0_rgba(250,77,255,0.45)]" : "border-transparent text-white/65 hover:border-white/20 hover:bg-white/5 hover:text-cyan-200"}`}>
                        <GitCompareArrows size={20} />
                    </Link>
                    <button
                        onClick={() => {
                            setActiveUrl("https://nanoka.cc");
                            setShowPanel(true);
                            setIsMinimized(false);
                        }}
                        title="Nanoka"
                        aria-label="Nanoka"
                        className="grid size-11 place-items-center border border-transparent transition hover:border-white/20 hover:bg-white/5 hover:text-cyan-200"
                    >
                        <img
                            src="https://nanoka.cc/logo.svg"
                            alt="bg"
                            className="h-6 w-6 border border-fuchsia-200/30 object-cover"
                        />
                    </button>

                    <button
                        onClick={() => {
                            setActiveUrl("https://hoyogame-background.vercel.app");
                            setShowPanel(true);
                            setIsMinimized(false);
                        }}
                        title="Background gallery"
                        aria-label="Background gallery"
                        className="grid size-11 place-items-center border border-transparent text-white/65 transition hover:border-white/20 hover:bg-white/5 hover:text-cyan-200"
                    >
                        <Images size={20} />
                    </button>

                    <Link to="/howto" title="How to" aria-label="How to" className={`grid size-11 place-items-center border transition-colors ${pathname === "/howto" ? "border-cyan-200 bg-cyan-300/15 text-cyan-100 shadow-[2px_2px_0_rgba(250,77,255,0.45)]" : "border-transparent text-white/65 hover:border-white/20 hover:bg-white/5 hover:text-cyan-200"}`}><BookOpen size={20} /></Link>
                </div>
            </div>

            {/* ปุ่มควบคุมด้านขวาบน */}
            <div className="fixed right-0 top-0 z-[70] flex items-center gap-1 border-b-2 border-l-2 border-cyan-300/40 bg-[#090b15]/90 px-2 py-1.5 shadow-[-3px_3px_0_rgba(250,77,255,0.12)] backdrop-blur-xl">
                {controlButtons.map((btn, i) => (
                    <motion.button
                        key={i}
                        whileHover={btn.hover}
                        transition={{ type: "spring" }}
                        onClick={btn.action}
                        className="grid size-9 place-items-center border border-transparent bg-transparent transition hover:border-fuchsia-300/50 hover:bg-fuchsia-300/10"
                        title={btn.tip}
                    >
                        {btn.icon}
                    </motion.button>
                ))}
            </div>
        </>
    );
}
