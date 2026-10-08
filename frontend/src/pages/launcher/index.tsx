import { useEffect, useState, type FormEvent } from 'react';
import { Play, Menu, FolderOpen, Minus, UserRound, X } from 'lucide-react';
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

    const [launcherVersion, setLauncherVersion] = useState("...");
    const [userName, setUserName] = useState<string>(() => {
        // โหลดจาก localStorage หรือ fallback เป็น default
        return localStorage.getItem("userName") || "User Name";
    });
    const [isUserNameDialogOpen, setIsUserNameDialogOpen] = useState(false);
    const [userNameDraft, setUserNameDraft] = useState(userName);

    const [videoSrc, setVideoSrc] = useState("/video3.mp4");

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
    const launcherDefaultVideos = ["/video3.mp4"];
    const launcherDefaultImages = ["/bg1.jpg"]; // ถ้ามี background เป็น image
    const [defaultIndex] = useState(0); // index ของ default
    const [defaultBgType] = useState<"video" | "image">("video");
    const [userColor, setUserColor] = useState<string>(() => getRandomColor());


    const handleSetUserName = () => {
        setUserNameDraft(userName);
        setIsUserNameDialogOpen(true);
    };

    const saveUserName = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const name = userNameDraft.trim();
        if (!name) {
            toast.error("Enter a user name first");
            return;
        }
        setUserName(name);
        localStorage.setItem("userName", name);
        const newColor = getRandomColor();
        setUserColor(newColor);
        setIsUserNameDialogOpen(false);
        toast.success(`User name updated: ${name}`);
    };

    useEffect(() => {
        let active = true;
        AppService.GetCurrentLauncherVersion()
            .then(([ok, version]) => {
                if (active) setLauncherVersion(ok ? version : "Unknown");
            })
            .catch((error) => {
                console.error("Could not read launcher version", error);
                if (active) setLauncherVersion("Unknown");
            });

        return () => {
            active = false;
        };
    }, []);

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
        { name: "Background 3", src: "/video3.mp4", icon: "https://raw.githubusercontent.com/horoyoi-san/Hoyo/refs/heads/launcher-sr/frontend/public/icon.png" },
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
            href: "https://github.com/horoyoi-san/Hoyo/releases/download/Sophon.Downloader/SilwerWolf999-launcher.exe",
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
                        if (videoSrc !== "/video3.mp4") {
                            setVideoSrc("/video3.mp4");
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
            <div className="arcade-frame fixed bottom-2 right-3 z-[60] flex max-w-[calc(100vw-6rem)] select-none flex-wrap items-center gap-1 px-2 py-1 text-[9px] text-gray-300 sm:right-10 sm:gap-2 sm:px-3 sm:text-[10px]">
                <span className="font-black text-cyan-300">
                    BETA
                </span>|
                <span className="font-bold text-fuchsia-200">
                    Silwer Wolf 999 Launcher Version: {launcherVersion}
                </span>|
                <span className="font-bold text-rose-300">
                    By Horoyoi-san
                </span>|
                <div className="font-bold tabular-nums text-white">{time}</div>|
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




            <div className="arcade-frame fixed left-[90px] top-5 z-[30] max-w-[min(390px,calc(100vw-7rem))] px-4 py-3">
                <div className="arcade-kicker mb-1 text-[9px]">Silver Wolf System · Online</div>
                <div className="flex items-baseline gap-2">
                    <span className="text-xs font-black uppercase tracking-[0.18em] text-white">PLAYER</span>
                    <span className="text-lg font-black uppercase text-fuchsia-200 drop-shadow-[2px_2px_0_rgba(83,246,255,0.45)]">Silver Wolf</span>
                    <span className="ml-auto border border-lime-300/40 bg-lime-300/10 px-1.5 py-0.5 text-[9px] font-black text-lime-200">LV.999</span>
                </div>
            </div>

            {visibleLinks.length > 0 && (
                <div className="arcade-frame fixed right-2 top-[90px] z-50 flex-col space-y-2 p-3">
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


                <div className="fixed bottom-10 right-0 z-50 p-5 sm:bottom-2 sm:p-8">

                    <div className="flex flex-wrap items-center justify-center gap-2">

                        {gamePath === "" ? (

                            <button
                                // ปุ่ม Select Game file: คงเดิม
                                className="arcade-button btn btn-xl font-bold"
                                onClick={handlePickFile}
                            >
                                <FolderOpen className="w-5 h-5" />
                                {isLoading ? 'Selecting...' : 'Select Game file'}
                            </button>

                        ) : (

                            <button
                                // ปุ่ม Start Game: เป็นสี่เหลี่ยมมุมโค้ง มีรูปภาพพื้นหลัง และ **เรืองแสง (Glow)**
                                className="arcade-button btn btn-xl relative overflow-hidden border-fuchsia-300/70 bg-fuchsia-500/20 font-black text-white"
                                onClick={handleStartGame}
                                style={{
                                    // กำหนดรูปภาพพื้นหลัง
                                    //  backgroundImage: "url('https://act-webstatic.hoyoverse.com/puzzle/hk4e/pz_df1bhOOLAB/resource/puzzle/2025/09/22/294b38ce0a4a1cbe94d10dd5082af4fe_5739821151544819626.png')",
                                    //  backgroundSize: "cover",
                                    // backgroundPosition: "center",

                                    // **คำสั่งที่ทำให้เกิดการเรืองแสง (Glow Effect)**
                                    boxShadow: "4px 4px 0 rgba(250, 77, 255, 0.45), 0 0 20px rgba(250, 77, 255, 0.2)",

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
                                className="arcade-button btn btn-xl m-1"
                            >
                                <Menu className="w-5 h-5 text-white" />
                            </div>



                            <ul tabIndex={0} className="arcade-frame dropdown-content menu z-50 w-56 p-2">
                                {/* ปุ่ม custom URL */}

                                <li>
                                    <button
                                        onClick={() => {
                                            window.open(
                                                "https://github.com/horoyoi-san/Hoyo/releases/download/Sophon.Downloader/SilwerWolf999-launcher.exe",
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
                <div className="arcade-frame fixed bottom-4 left-1/2 z-[60] w-[min(60vw,48rem)] -translate-x-1/2 p-4">
                    <div className="space-y-3">
                        <div className="flex justify-center items-center text-sm text-white/80">
                            <span>{downloadType}</span>
                            <div className="flex items-center gap-4 ml-4">
                                <span className="text-cyan-400 font-semibold">{downloadSpeed}</span>
                                <span className="text-white font-bold">{progressDownload.toFixed(1)}%</span>
                            </div>
                        </div>
                        <div className="h-2 w-full overflow-hidden border border-cyan-100/25 bg-black/70">
                            <motion.div
                                className="h-full bg-gradient-to-r from-cyan-300 via-blue-400 to-fuchsia-400"
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
                <div className="arcade-frame fixed bottom-4 left-1/2 z-[60] w-[min(60vw,48rem)] -translate-x-1/2 p-4">
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
            <div className="arcade-frame fixed bottom-4 left-[90px] z-50 w-[min(300px,calc(100vw-7rem))] overflow-hidden">

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
                            className={`h-[50px] w-[100px] cursor-pointer border-2 object-cover
            ${activeNewsIndex === index ? "border-cyan-300" : "border-transparent"}
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

            {isUserNameDialogOpen && (
                <div
                    className="fixed inset-0 z-[120] flex items-center justify-center bg-[#05060c]/85 p-4 backdrop-blur-md"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) setIsUserNameDialogOpen(false);
                    }}
                >
                    <section
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="user-name-dialog-title"
                        aria-describedby="user-name-dialog-description"
                        className="arcade-frame w-full max-w-md overflow-hidden text-white"
                        onKeyDown={(event) => {
                            if (event.key === "Escape") setIsUserNameDialogOpen(false);
                        }}
                    >
                        <header className="flex items-center justify-between border-b border-cyan-300/25 px-5 py-4">
                            <div className="flex items-center gap-3">
                                <div className="grid size-11 place-items-center border border-fuchsia-300/50 bg-fuchsia-400/10 text-fuchsia-200 shadow-[3px_3px_0_rgba(83,246,255,0.2)]">
                                    <UserRound size={21} />
                                </div>
                                <div>
                                    <p className="arcade-kicker text-[9px]">Player profile · Lv.999</p>
                                    <h2 id="user-name-dialog-title" className="mt-1 text-base font-black uppercase tracking-wider">
                                        Edit user name
                                    </h2>
                                </div>
                            </div>
                            <button
                                type="button"
                                aria-label="Close user name dialog"
                                onClick={() => setIsUserNameDialogOpen(false)}
                                className="grid size-8 place-items-center border border-white/15 text-white/60 transition hover:border-rose-300/60 hover:bg-rose-400/10 hover:text-rose-100"
                            >
                                <X size={16} />
                            </button>
                        </header>

                        <form onSubmit={saveUserName}>
                            <div className="space-y-4 px-5 py-5">
                                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-lime-200">
                                    <span className="size-2 animate-pulse bg-lime-300" />
                                    Profile data unlocked
                                </div>
                                <div>
                                    <label htmlFor="user-name-input" className="arcade-kicker mb-2 block text-[10px]">
                                        Enter your name
                                    </label>
                                    <input
                                        id="user-name-input"
                                        autoFocus
                                        maxLength={32}
                                        value={userNameDraft}
                                        onChange={(event) => setUserNameDraft(event.target.value)}
                                        placeholder="Type a player name..."
                                        className="h-12 w-full border-2 border-cyan-300/35 bg-[#070912] px-3 text-sm font-bold text-white outline-none placeholder:font-normal placeholder:text-white/30 focus:border-cyan-200 focus:shadow-[0_0_14px_rgba(83,246,255,0.16)]"
                                    />
                                    <div className="mt-2 flex items-center justify-between gap-3">
                                        <p id="user-name-dialog-description" className="text-[10px] leading-relaxed text-white/45">
                                            This name appears in your launcher status bar.
                                        </p>
                                        <span className="shrink-0 text-[10px] tabular-nums text-white/35">
                                            {userNameDraft.length}/32
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <footer className="flex justify-end gap-2 border-t border-white/10 bg-black/20 px-5 py-4">
                                <button
                                    type="button"
                                    onClick={() => setIsUserNameDialogOpen(false)}
                                    className="min-h-10 border border-white/15 px-4 text-[10px] font-black uppercase tracking-wider text-white/65 transition hover:bg-white/5 hover:text-white"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={!userNameDraft.trim()}
                                    className="arcade-button arcade-button--primary min-h-10 px-4 text-[10px] disabled:cursor-not-allowed"
                                >
                                    Save profile
                                </button>
                            </footer>
                        </form>
                    </section>
                </div>
            )}

        </div>
    )
}
