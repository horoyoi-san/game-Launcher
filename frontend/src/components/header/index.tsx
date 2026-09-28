import { Link } from "@tanstack/react-router";
import useModalStore from "@/stores/modalStore";
import { BookOpen, Diff, GitCompareArrows, Home, Images, Minus, Settings, X } from "lucide-react";
import { AppService } from "@bindings/SilwerWolf999-launcher/internal/app-service";
import { motion } from "motion/react";
import usePanelStore from "@/stores/panelStore";

export default function Header() {
    const { setIsOpenSettingModal } = useModalStore();
    const { setActiveUrl, setShowPanel, setIsMinimized } = usePanelStore();


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
            <div className="fixed left-0 top-0 h-full w-18 bg-black/30 backdrop-blur-md shadow-lg z-70 flex flex-col items-center py-6 justify-between">
                <div className="flex flex-col items-center gap-2">
                    <Link to="/" className="flex flex-col items-center hover:scale-105 transition-transform">
                        <img src="/appicon.png" alt="Logo" className="w-14 h-14 rounded-lg z-70" />
                        <h1 className="
                        text-[10px] font-bold 
                        bg-clip-text text-transparent
                        bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500
                        bg-gradient-to-r
                        from-cyan-300 via-blue-400 to-purple-500
                        drop-shadow-[0_0_6px_rgba(0,200,255,0.8)]
                        drop-shadow-[0_0_16px_rgba(120,0,255,0.6)]">SilwerWolf999</h1>
                    </Link>
                </div>

                <div className="flex flex-col items-center gap-5 mt-8 text-white">
                    <Link to="/" className="hover:text-cyan-300"><Home size={30} /></Link>

                    <Link to="/bh3" className="hover:text-cyan-300"><img src="/icon/bh3.png" className="w-7 h-7 object-contain"/></Link>
                    <Link to="/hk4e" className="hover:text-cyan-300"><img src="/icon/hk4e.png" className="w-7 h-7 object-contain"/></Link>
                    <Link to="/hkrpg" className="hover:text-cyan-300"><img src="/icon/hkrpg.png" className="w-7 h-7 object-contain"/></Link>
                    <Link to="/nap" className="hover:text-cyan-300"><img src="/icon/nap.png" className="w-7 h-7 object-contain"/></Link>
                    <Link to="/abc" className="hover:text-cyan-300"><img src="/icon/abc.png" className="w-7 h-7 object-contain"/></Link>
                    <Link to="/hyg" className="hover:text-cyan-300"><img src="/icon/hyg.png" className="w-7 h-7 object-contain"/></Link>
                    <Link to="/kl" title="The Weavers" className="hover:text-cyan-300"><img src="/icon/kl.png" className="w-7 h-7 object-contain"/></Link>
                    <Link to="/diff" title="Diff Update" aria-label="Diff Update" className="hover:text-cyan-300">
                        <Diff size={20} />
                    </Link>
                    <Link to="/legacy-diff" title="Legacy Diff" aria-label="Legacy Diff" className="hover:text-cyan-300">
                        <GitCompareArrows size={20} />
                    </Link>
                    <button
                        onClick={() => {
                            setActiveUrl("https://nanoka.cc");
                            setShowPanel(true);
                            setIsMinimized(false);
                        }}
                        className="hover:scale-110 transition"
                    >
                        <img
                            src="https://nanoka.cc/logo.svg"
                            alt="bg"
                            className="w-7 h-7 object-cover rounded"
                        />
                    </button>

                    <button
                        onClick={() => {
                            setActiveUrl("https://hoyogame-background.vercel.app");
                            setShowPanel(true);
                            setIsMinimized(false);
                        }}
                        className="hover:text-cyan-300"
                    >
                        <Images size={20} />
                    </button>

                    <Link to="/howto" className="hover:text-cyan-300"><BookOpen size={20} /></Link>
                </div>
            </div>

            {/* ปุ่มควบคุมด้านขวาบน */}
            <div className="fixed top-0 right-0 z-50 flex items-center gap-2 px-3 py-2 rounded-bl-xl">
                {controlButtons.map((btn, i) => (
                    <motion.button
                        key={i}
                        whileHover={btn.hover}
                        transition={{ type: "spring" }}
                        onClick={btn.action}
                        className="btn btn-ghost btn-circle bg-transparent border-none flex items-center justify-center"
                        title={btn.tip}
                    >
                        {btn.icon}
                    </motion.button>
                ))}
            </div>
        </>
    );
}
