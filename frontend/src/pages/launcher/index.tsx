import { useEffect, useState } from 'react';
import { Play, Menu, FolderOpen, Minus } from 'lucide-react';
import { AppService } from '@bindings/SilwerWolf999-launcher/internal/app-service';
import { FSService } from '@bindings/SilwerWolf999-launcher/internal/fs-service';
import { toast } from 'react-toastify';
import path from 'path-browserify'
import useSettingStore from '@/stores/settingStore';
import useModalStore from '@/stores/modalStore';
import useLauncherStore from '@/stores/launcherStore';
import { motion } from 'motion/react';
import usePanelStore from "@/stores/panelStore";

type CombinedLink = {
    tooltip: string;
    href: string;
    img: string;
    isVideo: boolean;
    src?: string;
    onClick?: () => void;
};


export default function LauncherPage() {

    const [userName, setUserName] = useState<string>(() => {
        // โหลดจาก localStorage หรือ fallback เป็น default
        return localStorage.getItem("userName") || "User Name";
    });

    const [videoSrc, setVideoSrc] = useState("/video2.mp4");

    const {
        activeUrl,
        showPanel,
        isMinimized,
        setActiveUrl,
        setShowPanel,
        setIsMinimized
    } = usePanelStore();

    const [, setIsVideoLoading] = useState(false);
    const [bgType, setBgType] = useState<"video" | "image">("video");

    // Default ของ Launcher (พื้นหลังที่ Launcher เซ็ตไว้ตอนเปิดครั้งแรก)
    const launcherDefaultVideos = ["/video2.mp4"];
    const launcherDefaultImages = ["/bg1.jpg"]; // ถ้ามี background เป็น image
    const [defaultIndex] = useState(0); // index ของ default
    const [defaultBgType] = useState<"video" | "image">("video");
    const [userColor, setUserColor] = useState<string>(() => getRandomColor());


    const handleSetUserName = () => {
        const name = prompt("Enter your name", userName);
        if (!name) return;

        setUserName(name);
        localStorage.setItem("userName", name);

        const newColor = getRandomColor();
        setUserColor(newColor);

        toast.success(`User name updated: ${name}`);
    };

    function getRandomColor() {
        const letters = '0123456789ABCDEF';
        let color = '#';
        for (let i = 0; i < 6; i++) {
            color += letters[Math.floor(Math.random() * 16)];
        }
        return color;
    }



    const handleSetVideoUrl = () => {
        const url = prompt("Enter video or image URL");
        if (!url) return;

        let type: "video" | "image";

        if (url.endsWith(".mp4") || url.endsWith(".webm")) {
            type = "video";
            setBgType(type);
            setVideoSrc(url);
        } else if (
            url.endsWith(".jpg") ||
            url.endsWith(".png") ||
            url.endsWith(".jpeg") ||
            url.endsWith(".webp")
        ) {
            type = "image";
            setBgType(type);
            setVideoSrc(url);
        } else {
            toast.error("Only .mp4 / .webm / .jpg / .png allowed");
            return;
        }

        localStorage.setItem("customBgUrl", url);
        localStorage.setItem("customBgType", type);

        setIsVideoLoading(false);
        toast.success("Background updated!");
    };


    useEffect(() => {
        const savedUrl = localStorage.getItem("customBgUrl");
        const savedType = localStorage.getItem("customBgType") as "video" | "image";

        if (savedUrl && savedType) {
            setVideoSrc(savedUrl);
            setBgType(savedType);
        } else {
            // ถ้าไม่มีค่า user ให้ใช้ default ของ Launcher
            const url = defaultBgType === "video"
                ? launcherDefaultVideos[defaultIndex]
                : launcherDefaultImages[defaultIndex];

            setVideoSrc(url);
            setBgType(defaultBgType);
        }
    }, []);

    const videos = [
        { name: "Background 1", src: "/video1.mp4", icon: "https://launcher-webstatic.hoyoverse.com/launcher-public/2025/09/22/4cc51f558225dba65cc875ecd642cfe2_6726801704251292131.png" },
        { name: "Background 2", src: "/video2.mp4", icon: "https://raw.githubusercontent.com/horoyoi-san/Hoyo/refs/heads/launcher-sr/frontend/public/icon.png" },
    ];

    // 🎬 News Video (ไม่มีข้อความ)
    const newsVideos = [
        "https://raw.githubusercontent.com/horoyoi-san/game-Launcher/refs/heads/silwerwolf999-launcher/frontend/public/video/1.mp4",
        "https://raw.githubusercontent.com/horoyoi-san/game-Launcher/refs/heads/silwerwolf999-launcher/frontend/public/video/2.mp4",
        "https://raw.githubusercontent.com/horoyoi-san/game-Launcher/refs/heads/silwerwolf999-launcher/frontend/public/video/3.mp4",
        "https://raw.githubusercontent.com/horoyoi-san/game-Launcher/refs/heads/silwerwolf999-launcher/frontend/public/video/4.mp4",
        "https://raw.githubusercontent.com/horoyoi-san/game-Launcher/refs/heads/silwerwolf999-launcher/frontend/public/video/5.mp4",
        "https://raw.githubusercontent.com/horoyoi-san/game-Launcher/refs/heads/silwerwolf999-launcher/frontend/public/video/6.mp4",
        "https://raw.githubusercontent.com/horoyoi-san/game-Launcher/refs/heads/silwerwolf999-launcher/frontend/public/video/7.mp4",
        "https://raw.githubusercontent.com/horoyoi-san/game-Launcher/refs/heads/silwerwolf999-launcher/frontend/public/video/8.mp4",
        "https://raw.githubusercontent.com/horoyoi-san/game-Launcher/refs/heads/silwerwolf999-launcher/frontend/public/video/9.mp4",
        "https://raw.githubusercontent.com/horoyoi-san/game-Launcher/refs/heads/silwerwolf999-launcher/frontend/public/video/10.mp4",
    ];

    const [activeNewsIndex, setActiveNewsIndex] = useState(0);
    const activeNews = newsVideos[activeNewsIndex];


    const { gamePath,
        setGamePath,
        setGameDir,
        gameDir,


    } = useSettingStore()

    const {
    } = useModalStore()

    const {
        isLoading,
        downloadType,

        proxyReady,
        isDownloading,

        gameRunning,
        progressDownload,
        downloadSpeed,


        setIsLoading,
        setGameRunning,
    } = useLauncherStore()

    const widgetLinks = [
        {
            tooltip: "SilwerWolf999 Launcher Update",
            href: "https://github.com/horoyoi-san/Hoyo/releases/download/SR/SilwerWolf999-launcher.exe",
            img: "https://raw.githubusercontent.com/horoyoi-san/Hoyo/refs/heads/launcher-sr/build/appicon.png",
            btnClass: "me-media-icon media-list"
        },
    ]

    // รวมปุ่ม widget + วิดีโอ
    const combinedLinks: CombinedLink[] = [
        ...widgetLinks.map(link => ({
            ...link,
            isVideo: false,
            src: undefined
        })),
        ...videos.map(v => ({
            tooltip: v.name,
            href: "#",
            img: v.icon,
            isVideo: true,
            src: v.src,
            onClick: () => {
                setIsVideoLoading(true);
                setVideoSrc(v.src);
            }
        }))
    ];

    const visibleLinks = combinedLinks.filter(() => false);

    const handleResetBackground = () => {
        const url = defaultBgType === "video"
            ? launcherDefaultVideos[defaultIndex]
            : launcherDefaultImages[defaultIndex];

        setVideoSrc(url);
        setBgType(defaultBgType);

        localStorage.removeItem("customBgUrl");
        localStorage.removeItem("customBgType");

        window.dispatchEvent(new CustomEvent("launcherBgChanged", {
            detail: { url, type: defaultBgType }
        }));

        toast.success("Background reset to default!");
    };

    useEffect(() => {
        const interval = setInterval(() => {
            setUserColor(getRandomColor());
        }, 1000); // เปลี่ยนสีทุก 1.0 วินาที
        return () => clearInterval(interval);
    }, []);

    const GAME_RULES = [
        {
            id: "StarRail",
            exe: "StarRail.exe",
            dataCheck: "StarRail_Data",
        },
        {
            id: "GenshinImpact",
            exe: "GenshinImpact.exe",
            dataCheck: "GenshinImpact_Data",
        },
        {
            id: "ZenlessZoneZero",
            exe: "ZenlessZoneZero.exe",
            dataCheck: "ZenlessZoneZero_Data",
        },
        {
            id: "NexusAnima",
            exe: "NexusAnima.exe",
            dataCheck: "NexusAnima_Data",
        },
        {
            id: "PetitPlanet",
            exe: "PetitPlanet.exe",
            dataCheck: "PetitPlanet_Data",
        },
        {
            id: "ZenlessZoneZeroBeta",
            exe: "ZenlessZoneZeroBeta.exe",
            dataCheck: "ZenlessZoneZeroBeta_Data",
        },
        {
            id: "TheWeavers",
            exe: "TheWeavers.exe",
            dataCheck: "TheWeavers_Data",
        }
    ]

    function detectGame(basePath: string) {
        const fileName = basePath.split(/[\\/]/).pop()

        return GAME_RULES.find(game =>
            fileName?.toLowerCase() === game.exe.toLowerCase()
        )
    }

    const handlePickFile = async () => {
        try {
            setIsLoading(true)

            const basePath = await FSService.PickFile("exe")

            const game = detectGame(basePath)

            if (!game) {
                toast.error("Unsupported game exe")
                return
            }

            const normalized = basePath.replace(/\\/g, '/')
            const folderPath = path.dirname(normalized)

            const fullPath = `${folderPath}/${game.dataCheck}`

            const exists = await FSService.DirExists(fullPath)

            if (!exists) {
                toast.error("Game folder not valid")
                return
            }

            setGamePath(basePath)
            setGameDir(folderPath)

            toast.success(`Loaded: ${game.id}`)

        } catch (err: any) {
            toast.error('PickFolder error:', err)
        } finally {
            setIsLoading(false)
        }
    }

    const handleStartGame = async () => {
        if (!gamePath || gameRunning) return

        try {
            setIsLoading(true)

            const result = await FSService.StartApp(gamePath)

            if (!result) {
                toast.error("Failed to start game")
                return
            }

            setGameRunning(true)

        } catch (err: any) {
            toast.error("StartGame error:", err)
        } finally {
            setIsLoading(false)
        }
    }

    // นับเวลาปัจจุบัน (เรียลไทม์)
    const [time, setTime] = useState<string>("");

    useEffect(() => {
        const updateTime = () => {
            const now = new Date();
            const formatted = now.toLocaleTimeString("th-TH", {
                hour12: false,
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
            });
            setTime(formatted);
        };
        updateTime();
        const interval = setInterval(updateTime, 1000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="relative min-h-fit overflow-hidden">
            <span className="hidden">{activeUrl}</span>

            {bgType === "video" ? (
                <video
                    className="fixed inset-0 z-0 w-full h-full object-cover"
                    autoPlay
                    loop
                    muted
                    playsInline
                    preload="auto"
                    poster="/bg.jpg"
                    key={videoSrc}
                    onLoadStart={() => setIsVideoLoading(true)}
                    onLoadedData={() => setIsVideoLoading(false)}
                    onCanPlay={() => setIsVideoLoading(false)}
                    onCanPlayThrough={() => setIsVideoLoading(false)}
                    onError={() => {
                        console.log("video load failed");
                        if (videoSrc !== "/video2.mp4") {
                            setVideoSrc("/video2.mp4");
                        }
                    }}
                >
                    <source
                        src={videoSrc}
                        type={videoSrc.endsWith(".webm") ? "video/webm" : "video/mp4"}
                    />
                </video>
            ) : (
                <img
                    src={videoSrc}
                    className="fixed inset-0 z-0 w-full h-full object-cover"
                />
            )}




            {/* Footer / Version */}
            <div className="fixed select-none bottom-2 right-10 text-xs text-gray-400 z-60 flex gap-1 backdrop-blur-sm bg-black/30 px-3 py-1.5 rounded-lg shadow-md">
                <span className="text-cyan-400 font-semibold drop-shadow-[0_0_6px_rgba(0,255,255,0.8)] hover:drop-shadow-[0_0_12px_rgba(0,255,255,1)] transition">
                    BETA
                </span>|
                <span className="font-semibold bg-gradient-to-r from-sky-400 via-blue-500 to-purple-500 text-transparent bg-clip-text drop-shadow-[0_0_8px_rgba(99,102,241,0.6)] hover:drop-shadow-[0_0_14px_rgba(168,85,247,0.9)] transition">
                    Silwer Wolf 999 Launcher Version: 1.0.0
                </span>|
                <span className="text-red-500 font-semibold drop-shadow-[0_0_6px_rgba(255,0,0,0.8)] hover:drop-shadow-[0_0_12px_rgba(255,0,0,1)] transition">
                    By Horoyoi-san
                </span>|
                <div className="text-white drop-shadow-[0_0_6px_rgba(255,255,255,0.8)]">{time}</div>|
                <button
                    type="button"
                    onClick={handleSetUserName}
                    className="transition"
                >
                    <span
                        className="font-semibold transition"
                        style={{
                            color: userColor,
                            textShadow: `0 0 6px ${userColor}, 0 0 12px ${userColor}`
                        }}
                    >
                        {userName}
                    </span>
                </button>
            </div>




            {visibleLinks.length > 0 && (
                <div className="fixed top-[90px] right-2 z-50 flex-col space-y-2 bg-white/10 backdrop-blur-md rounded-lg p-3 shadow-md">
                    {visibleLinks.map((link, idx) => (

                        // {combinedLinks
                        //.filter(link => !link.isVideo) // 🔥 ซ่อนเฉพาะ video icons
                        //.filter(() => false)//ซ่อนไอคอน ทั้งหมด ด้านขวา
                        //.map((link, idx) => (
                        <div key={idx} className="tooltip tooltip-left" data-tip={link.tooltip}>
                            <button
                                className={`
                w-8 h-8 rounded-full overflow-hidden transition transform hover:scale-110
                ${'isVideo' in link && link.isVideo && videoSrc === videos.find(v => v.icon === link.img)?.src
                                        ? "border-cyan-400 shadow-lg shadow-cyan-400/40"
                                        : "border-transparent"
                                    }
                `}
                                onClick={() => {
                                    if ('isVideo' in link && link.isVideo) {
                                        link.onClick?.(); // 🔥 เปลี่ยนวิดีโอ
                                    } else {
                                        setActiveUrl(link.href);
                                        setShowPanel(true);
                                        setIsMinimized(false);
                                    }
                                }}


                            >
                                <img src={link.img} alt={link.tooltip} className="w-full h-full object-cover" />
                            </button>
                        </div>
                    ))}
                </div>
            )}


            {/* Bottom Panel */}
            {proxyReady && !isDownloading && (


                <div className="fixed bottom-2 right-0 p-8 z-50">

                    <div className="flex flex-wrap items-center justify-center gap-2">

                        {gamePath === "" ? (

                            <button
                                // ปุ่ม Select Game file: คงเดิม
                                className="btn btn-xl font-bold bg-white/5 backdrop-blur-md border border-sky-400/20 hover:bg-gradient-to-r hover:from-sky-500/20 hover:via-blue-500/20 hover:to-purple-500/20 transition rounded-xl"
                                onClick={handlePickFile}
                            >
                                <FolderOpen className="w-5 h-5" />
                                {isLoading ? 'Selecting...' : 'Select Game file'}
                            </button>

                        ) : (

                            <button
                                // ปุ่ม Start Game: เป็นสี่เหลี่ยมมุมโค้ง มีรูปภาพพื้นหลัง และ **เรืองแสง (Glow)**
                                className="btn btn-secondary btn-xl font-bold relative overflow-hidden"
                                onClick={handleStartGame}
                                style={{
                                    // กำหนดรูปภาพพื้นหลัง
                                    //  backgroundImage: "url('https://act-webstatic.hoyoverse.com/puzzle/hk4e/pz_df1bhOOLAB/resource/puzzle/2025/09/22/294b38ce0a4a1cbe94d10dd5082af4fe_5739821151544819626.png')",
                                    //  backgroundSize: "cover",
                                    // backgroundPosition: "center",

                                    // **คำสั่งที่ทำให้เกิดการเรืองแสง (Glow Effect)**
                                    boxShadow: "0 0 15px rgb(255, 0, 242), 0 0 25px rgb(162, 0, 255) inset", // Glow สีชมพู/ม่วง

                                    // ปรับข้อความให้อ่านง่าย
                                    color: "white",
                                    textShadow: "0 0 5px rgba(0, 0, 0, 0.93)"
                                }}
                            >
                                <Play className="w-5 h-5" />
                                {isLoading ? 'Starting...' : gameRunning ? 'Game is running' : 'Start Game'}
                            </button>

                        )}

                        <div className="dropdown dropdown-top dropdown-end">
                            <div
                                tabIndex={0}
                                role="button"
                                className="btn btn-circle btn-xl m-1 bg-black/30 backdrop-blur-md border border-white/20 hover:bg-black/50 transition"
                            >
                                <Menu className="w-5 h-5 text-white" />
                            </div>



                            <ul tabIndex={0} className="dropdown-content menu rounded-box z-50 w-52 p-2 bg-black/30 backdrop-blur-md shadow-lg border border-white/10">
                                {/* ปุ่ม custom URL */}

                                <li>
                                    <button
                                        onClick={() => {
                                            window.open(
                                                "https://github.com/horoyoi-san/Hoyo/releases/download/SR/SilwerWolf999-launcher.exe",
                                                "_blank"
                                            );
                                        }}
                                    >
                                        SilwerWolf999 Launcher Update
                                    </button>
                                </li>

                                <li>
                                    <button
                                        onClick={() => {
                                            window.open(
                                                "https://github.com/horoyoi-san/Hoyo/releases/download/Sophon.Downloader/Sophon.Downloader.zip",
                                                "_blank"
                                            );
                                        }}
                                    >
                                        Sophon.download Update
                                    </button>
                                </li>

                                {/* ✅ ปุ่ม reset */}
                                <li>
                                    <button onClick={handleSetVideoUrl}>Set Background URL</button>
                                </li>

                                {/* ปุ่ม video list */}
                                {videos.map((v, index) => (
                                    <li key={index}>
                                        <button
                                            onClick={() => {
                                                setIsVideoLoading(true);
                                                setBgType("video");
                                                setVideoSrc(v.src);
                                            }}
                                        >
                                            {v.name}
                                        </button>
                                    </li>
                                ))}
                                {/* ✅ ปุ่ม reset */}
                                <li>
                                    <button onClick={handleResetBackground}>Reset to Default Background</button>
                                </li>

                                <li><button onClick={handlePickFile}>Change Game Path</button></li>

                                <li>

                                </li>
                                <li>

                                </li>
                                <li><button disabled={!gameDir} onClick={() => {
                                    if (gameDir) {
                                        FSService.OpenFolder(gameDir + "/StarRail_Data/Persistent/Audio/AudioPackage/Windows")
                                    }
                                }}>Open voice folder</button></li>
                            </ul>

                        </div>
                    </div>
                </div>
            )}

            {/* Downloading */}
            {isDownloading && (
                <div className="fixed bottom-4 left-1/2  transform -translate-x-1/2 z-60 w-[60vw] bg-black/20 backdrop-blur-sm rounded-lg p-4 shadow-lg">
                    <div className="space-y-3">
                        <div className="flex justify-center items-center text-sm text-white/80">
                            <span>{downloadType}</span>
                            <div className="flex items-center gap-4 ml-4">
                                <span className="text-cyan-400 font-semibold">{downloadSpeed}</span>
                                <span className="text-white font-bold">{progressDownload.toFixed(1)}%</span>
                            </div>
                        </div>
                        <div className="w-full bg-white/20 rounded-full h-2 overflow-hidden">
                            <motion.div
                                className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full"
                                initial={{ width: 0 }}
                                animate={{ width: `${progressDownload}%` }}
                                transition={{ type: "tween", ease: "linear", duration: 0.03 }}
                            />
                        </div>
                        <div className="text-center text-xs text-white/60">
                            {progressDownload < 100 ? 'Please wait...' : 'Complete!'}
                        </div>
                    </div>
                </div>
            )}

            {isDownloading && (
                <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-60 w-[60vw] bg-black/20 backdrop-blur-sm rounded-lg p-4 shadow-lg">
                    <div className="space-y-3 text-sm text-white/80 text-center">
                        {["update:launcher:downloading", "update:launcher:success", "update:launcher:failed"].includes(downloadType) && (
                            <div className="flex justify-center items-center gap-4 ml-4">
                                <span
                                    className={`font-bold ${downloadType === "update:launcher:downloading"
                                        ? "text-yellow-200 text-2xl"
                                        : downloadType === "update:launcher:success"
                                            ? "text-emerald-200 text-xl"
                                            : "text-red-200 text-xl"
                                        }`}
                                >
                                    {downloadType === "update:launcher:downloading" && "Updating launcher"}
                                    {downloadType === "update:launcher:success" && "Launcher updated successfully, auto closing after 5s"}
                                    {downloadType === "update:launcher:failed" && "Launcher update failed, auto closing after 5s"}
                                    <span className="dot-animation ml-1"></span>
                                </span>
                            </div>
                        )}

                        <div className="text-xs text-white/60">
                            {progressDownload < 100 ? "Please wait..." : "Complete!"}
                        </div>
                    </div>

                    <style>{`
                        .dot-animation::after {
                            content: '';
                            animation: dots 1.2s steps(4, end) infinite;
                        }
                        @keyframes dots {
                            0% { content: ''; }
                            25% { content: '.'; }
                            50% { content: '..'; }
                            75% { content: '...'; }
                            100% { content: ''; }
                        }
                        `}
                    </style>
                </div>
            )}

            {/* 🎬 Video News Panel */}
            <div className="fixed bottom-4 left-20 z-50 w-[300px] rounded-xl overflow-hidden bg-black/30 backdrop-blur-md border border-white/10">

                <video
                    key={activeNews}
                    src={activeNews}
                    autoPlay
                    muted
                    playsInline
                    onEnded={() => {
                        setActiveNewsIndex((prev) => (prev + 1) % newsVideos.length);
                    }}
                />

                <div className="flex gap-1 p-1 overflow-x-auto">
                    {newsVideos.map((vid, index) => (
                        <video
                            key={index}
                            src={vid}
                            muted
                            onMouseEnter={(e) => e.currentTarget.play()}
                            onMouseLeave={(e) => {
                                e.currentTarget.pause();
                                e.currentTarget.currentTime = 0;
                            }}
                            onClick={() => setActiveNewsIndex(index)} // ✅ แก้ตรงนี้
                            className={`w-[100px] h-[50px] object-cover rounded cursor-pointer border
            ${activeNewsIndex === index ? "border-cyan-400" : "border-transparent"} // ✅ แก้ตรงนี้
        `}
                        />
                    ))}
                </div>

            </div>


            {showPanel && (
                <div className="fixed inset-0 z-70">

                    {/* 🔥 พื้นหลังเบลอ */}
                    {!isMinimized && (
                        <div
                            className="absolute inset-0 bg-black/40 backdrop-blur-md"
                            onClick={() => setShowPanel(false)}
                        />
                    )}

                    {/* 🔥 ตัว panel */}
                    <div
                        className={`fixed z-70 transition-all duration-300
        ${isMinimized
                                ? "bottom-4 right-4 w-[400px] h-[250px] rounded-xl overflow-hidden shadow-2xl"
                                : "top-0 left-0 w-full h-full"
                            }`}
                    >
                        {/* 🔥 ปุ่มควบคุม */}
                        <div className="absolute top-3 right-5 flex gap-3 z-70">

                            {/* ❌ ลบ createPortal ออกไปแล้ว */}

                            {/* ✅ ปุ่มย่อ */}
                            <button onClick={() => AppService.MinimizeApp()}>
                                <Minus className="w-5 h-5 text-white" />
                            </button>

                            {/* ปุ่มปิด */}
                            <button
                                onClick={() => setShowPanel(false)}
                                className="text-white hover:text-red-400"
                            >
                                ✕
                            </button>

                        </div>

                        {/* iframe */}
                        <iframe
                            src={activeUrl}
                            className="w-full h-full border-none bg-black"
                        />
                    </div>
                </div>
            )}


        </div>
    )
}
