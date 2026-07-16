import { Link } from "@tanstack/react-router";
import useModalStore from "@/stores/modalStore";
import { Blend, BookOpen, GitCompareArrows, Home, Info, Images, Languages, Minus, Settings, TrendingUpDown, X } from "lucide-react";
import { AppService } from "@bindings/Cyrene-launcher/internal/app-service";
import { motion } from "motion/react";
import usePanelStore from "@/stores/panelStore";

export default function Header() {
    const { setIsOpenSettingModal } = useModalStore();
    const { setActiveUrl, setShowPanel, setIsMinimized } = usePanelStore();


    const controlButtons = [
        {
            icon: <Settings className="w-5 h-5 text-white" />,
            action: () => setIsOpenSettingModal(true),
            tip: "Settings",
            hover: { rotate: 20, color: "#e343e9" },
        },
        {
            icon: <Minus className="w-5 h-5 text-white" />,
            action: () => AppService.MinimizeApp(),
            tip: "Minimize",
            hover: { rotate: 20, color: "#e343e9" },
        },
        {
            icon: <X className="w-5 h-5 text-white" />,
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
                        <h1 className="font-bold bg-clip-text text-transparent bg-gradient-to-r from-pink-400 via-pink-500 to-pink-500 drop-shadow-[0_0_8px_rgba(255,192,203,0.4)]">Cyrene</h1>
                    </Link>
                </div>

                <div className="flex flex-col items-center gap-5 mt-8 text-white">
                    <Link to="/" className="hover:text-cyan-300"><Home size={20} /></Link>

                    <button
                        onClick={() => {
                            setActiveUrl("https://hoyoplay.hoyoverse.com");
                            setShowPanel(true);
                            setIsMinimized(false);
                        }}
                        className="hover:scale-110 transition"
                    >
                        <img
                            src="https://raw.githubusercontent.com/horoyoi-san/game-Launcher/refs/heads/cyrene-launcher/frontend/public/icon/hoyoverse-icon.png"
                            alt="bg"
                            className="w-5 h-5 object-cover rounded"
                        />
                    </button>

                    <button
                        onClick={() => {
                            setActiveUrl("https://hoyoverse-game.vercel.app");
                            setShowPanel(true);
                            setIsMinimized(false);
                        }}
                        className="hover:scale-110 transition"
                    >
                        <img
                            src="https://raw.githubusercontent.com/horoyoi-san/game-Launcher/refs/heads/cyrene-launcher/frontend/public/icon/hoyo-game-logo.png"
                            alt="bg"
                            className="w-5 h-5 object-cover rounded"
                        />
                    </button>

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
                            className="w-5 h-5 object-cover rounded"
                        />
                    </button>

                    <button
                        onClick={() => {
                            setActiveUrl("https://srtools.neonteam.dev");
                            setShowPanel(true);
                            setIsMinimized(false);
                        }}
                        className="hover:scale-110 transition"
                    >
                        <img
                            src="https://raw.githubusercontent.com/horoyoi-san/game-Launcher/refs/heads/cyrene-launcher/frontend/public/icon/AvatarIcon.webp"
                            alt="bg"
                            className="w-5 h-5 object-cover rounded"
                        />
                    </button>

                    <button
                        onClick={() => {
                            setActiveUrl("https://hoyo-swart.vercel.app");
                            setShowPanel(true);
                            setIsMinimized(false);
                        }}
                        className="hover:scale-110 transition"
                    >
                        <img
                            src="https://raw.githubusercontent.com/horoyoi-san/game-Launcher/refs/heads/cyrene-launcher/frontend/public/icon/pompom.png"
                            alt="bg"
                            className="w-5 h-5 object-cover rounded"
                        />
                    </button>

                    <Link to="/language" className="hover:text-cyan-300"><Languages size={20} /></Link>
                    <Link to="/diff" className="hover:text-cyan-300"><GitCompareArrows size={20} /></Link>
                    <Link to="/analysis" className="hover:text-cyan-300"><TrendingUpDown size={20} /></Link>
                    <Link to="/srtools" className="hover:text-cyan-300"><Blend size={20} /></Link>
                    <Link to="/howto" className="hover:text-cyan-300"><BookOpen size={20} /></Link>
                    <Link to="/about" className="hover:text-cyan-300"><Info size={20} /></Link>

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
