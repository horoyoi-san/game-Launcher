import { Link } from "@tanstack/react-router";
import useModalStore from "@/stores/modalStore";
import { BookOpen, Diff, Home, Image, Info, Languages, Minus, Settings, X } from "lucide-react";
import { AppService } from "@bindings/Cyrene-launcher/internal/app-service";
import { motion } from "motion/react";
import usePanelStore from "@/stores/panelStore";

const webLinks = [
    {
        label: "HoYoLAB",
        url: "https://hoyoplay.hoyoverse.com",
        image: "https://raw.githubusercontent.com/horoyoi-san/game-Launcher/refs/heads/cyrene-launcher/frontend/public/icon/hoyoverse-icon.png",
    },
    {
        label: "HoYoverse Games",
        url: "https://hoyoverse-game.vercel.app",
        image: "https://raw.githubusercontent.com/horoyoi-san/game-Launcher/refs/heads/cyrene-launcher/frontend/public/icon/hoyo-game-logo.png",
    },
    { label: "Nanoka", url: "https://nanoka.cc", image: "https://nanoka.cc/logo.svg" },
    {
        label: "SR Tools",
        url: "https://srtools.neonteam.dev",
        image: "https://raw.githubusercontent.com/horoyoi-san/game-Launcher/refs/heads/cyrene-launcher/frontend/public/icon/AvatarIcon.webp",
    },
];

export default function Header() {
    const { setIsOpenSettingModal } = useModalStore();
    const { setActiveUrl, setShowPanel, setIsMinimized } = usePanelStore();

    const openWebPanel = (url: string) => {
        setActiveUrl(url);
        setShowPanel(true);
        setIsMinimized(false);
    };

    const controlButtons = [
        {
            icon: <Settings className="h-4 w-4" />,
            action: () => setIsOpenSettingModal(true),
            tip: "Settings",
        },
        {
            icon: <Minus className="h-4 w-4" />,
            action: () => AppService.MinimizeApp(),
            tip: "Minimize",
        },
        {
            icon: <X className="h-4 w-4" />,
            action: () => AppService.CloseApp(),
            tip: "Close",
        },
    ];

    return (
        <>
            <aside className="app-sidebar">
                <Link to="/" className="app-sidebar__brand" activeOptions={{ exact: true }} title="Cyrene Launcher">
                    <img src="/appicon.png" alt="Cyrene Launcher" className="h-11 w-11 rounded-xl" />
                    <div className="app-sidebar__brand-name">
                        <div className="text-[15px] font-bold tracking-wide text-white">CYRENE</div>
                        <div className="mt-0.5 text-[10px] tracking-[0.16em] text-violet-200/60">GAME LAUNCHER</div>
                    </div>
                </Link>

                <nav className="app-sidebar__nav" aria-label="Main navigation">
                    <div className="app-sidebar__label">Library</div>
                    <Link
                        to="/"
                        activeOptions={{ exact: true }}
                        className="sidebar-link"
                        activeProps={{ className: "sidebar-link is-active" }}
                        title="Home"
                        aria-label="Home"
                    >
                        <Home size={18} />
                        <span>Home</span>
                    </Link>

                    <div className="app-sidebar__label">Tools</div>
                    <Link to="/language" className="sidebar-link" activeProps={{ className: "sidebar-link is-active" }} title="Language" aria-label="Language">
                        <Languages size={18} />
                        <span>Language</span>
                    </Link>
                    <Link to="/diff" className="sidebar-link" activeProps={{ className: "sidebar-link is-active" }} title="Diff Update" aria-label="Diff Update">
                        <Diff size={18} />
                        <span>Diff Update</span>
                    </Link>
                    <Link to="/howto" className="sidebar-link" activeProps={{ className: "sidebar-link is-active" }} title="Guides" aria-label="Guides">
                        <BookOpen size={18} />
                        <span>Guides</span>
                    </Link>
                    <Link to="/about" className="sidebar-link" activeProps={{ className: "sidebar-link is-active" }} title="About" aria-label="About">
                        <Info size={18} />
                        <span>About</span>
                    </Link>

                    <div className="app-sidebar__label">Web shortcuts</div>
                    {webLinks.map((item) => (
                        <button
                            key={item.label}
                            type="button"
                            className="sidebar-link w-full text-left"
                            onClick={() => openWebPanel(item.url)}
                            title={item.label}
                            aria-label={item.label}
                        >
                            <img src={item.image} alt="" />
                            <span>{item.label}</span>
                        </button>
                    ))}
                    <button
                        type="button"
                        className="sidebar-link w-full text-left"
                        onClick={() => openWebPanel("https://hoyogame-background.vercel.app")}
                        title="Background Gallery"
                        aria-label="Background Gallery"
                    >
                        <Image size={18} />
                        <span>Background Gallery</span>
                    </button>
                </nav>
            </aside>

            <div className="app-window-controls">
                {controlButtons.map((btn) => (
                    <motion.button
                        key={btn.tip}
                        type="button"
                        whileHover={{ scale: 1.08 }}
                        whileTap={{ scale: 0.94 }}
                        onClick={btn.action}
                        className="btn btn-ghost btn-circle border-none"
                        title={btn.tip}
                        aria-label={btn.tip}
                    >
                        {btn.icon}
                    </motion.button>
                ))}
            </div>
        </>
    );
}
