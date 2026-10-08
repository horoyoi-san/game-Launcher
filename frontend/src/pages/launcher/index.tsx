import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Play, Menu, Minus, FolderOpen, Sparkles, Crown, X, ExternalLink, Server, ImagePlus, Image, RotateCcw, ShieldCheck, Music2 } from 'lucide-react';
import { AppService } from '@bindings/Cyrene-launcher/internal/app-service';
import { FSService } from '@bindings/Cyrene-launcher/internal/fs-service';
import { toast } from 'react-toastify';
import path from 'path-browserify'
import useSettingStore from '@/stores/settingStore';
import useModalStore from '@/stores/modalStore';
import useLauncherStore from '@/stores/launcherStore';
import { motion } from 'motion/react';
import { CheckUpdateProxy, sleep, UpdateProxy } from '@/helper';
import UpdateModal from '@/components/updateModal';
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
    const gameSelectionChanged = useRef(false);
    const [launcherVersion, setLauncherVersion] = useState("...");

    const [userName, setUserName] = useState<string>(() => {
        // โหลดจาก localStorage หรือ fallback เป็น default
        return localStorage.getItem("userName") || "User Name";
    });
    const [isUserNameDialogOpen, setIsUserNameDialogOpen] = useState(false);
    const [userNameDraft, setUserNameDraft] = useState(userName);

    const [videoSrc, setVideoSrc] = useState("/video2.mp4");
    const [isBackgroundDialogOpen, setIsBackgroundDialogOpen] = useState(false);
    const [backgroundUrlDraft, setBackgroundUrlDraft] = useState("");

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
    const userColor = "#f2d99b";

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

    const handleSetUserName = () => {
        setUserNameDraft(userName);
        setIsUserNameDialogOpen(true);
    };

    const saveUserName = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const name = userNameDraft.trim();
        if (!name) {
            toast.error("Please enter a name for your profile");
            return;
        }
        setUserName(name);
        localStorage.setItem("userName", name);
        setIsUserNameDialogOpen(false);
        toast.success(`User name updated: ${name}`);
    };



    const handleSetVideoUrl = () => {
        setBackgroundUrlDraft(localStorage.getItem("customBgUrl") || videoSrc);
        setIsBackgroundDialogOpen(true);
    };

    const saveBackgroundUrl = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const url = backgroundUrlDraft.trim();
        let parsedUrl: URL;

        try {
            parsedUrl = new URL(url);
        } catch {
            toast.error("Enter a valid URL starting with http:// or https://");
            return;
        }

        if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
            toast.error("Background URL must use http:// or https://");
            return;
        }

        const extension = path.extname(parsedUrl.pathname).toLowerCase();
        const type = extension === ".mp4" || extension === ".webm"
            ? "video"
            : [".jpg", ".jpeg", ".png", ".webp"].includes(extension)
                ? "image"
                : null;

        if (!type) {
            toast.error("Supported formats: .mp4, .webm, .jpg, .jpeg, .png, .webp");
            return;
        }

        setIsVideoLoading(true);
        setBgType(type);
        setVideoSrc(url);
        localStorage.setItem("customBgUrl", url);
        localStorage.setItem("customBgType", type);
        setIsVideoLoading(false);
        setIsBackgroundDialogOpen(false);
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
        "https://raw.githubusercontent.com/horoyoi-san/game-Launcher/refs/heads/cyrene-launcher/frontend/public/video/1.mp4",
        "https://raw.githubusercontent.com/horoyoi-san/game-Launcher/refs/heads/cyrene-launcher/frontend/public/video/2.mp4",
        "https://raw.githubusercontent.com/horoyoi-san/game-Launcher/refs/heads/cyrene-launcher/frontend/public/video/3.mp4",
        "https://raw.githubusercontent.com/horoyoi-san/game-Launcher/refs/heads/cyrene-launcher/frontend/public/video/4.mp4",
        "https://raw.githubusercontent.com/horoyoi-san/game-Launcher/refs/heads/cyrene-launcher/frontend/public/video/5.mp4",
        "https://raw.githubusercontent.com/horoyoi-san/game-Launcher/refs/heads/cyrene-launcher/frontend/public/video/6.mp4",
        "https://raw.githubusercontent.com/horoyoi-san/game-Launcher/refs/heads/cyrene-launcher/frontend/public/video/7.mp4",
        "https://raw.githubusercontent.com/horoyoi-san/game-Launcher/refs/heads/cyrene-launcher/frontend/public/video/8.mp4",
        "https://raw.githubusercontent.com/horoyoi-san/game-Launcher/refs/heads/cyrene-launcher/frontend/public/video/9.mp4",
        "https://raw.githubusercontent.com/horoyoi-san/game-Launcher/refs/heads/cyrene-launcher/frontend/public/video/10.mp4",
    ];

    const [activeNewsIndex, setActiveNewsIndex] = useState(0);
    const activeNews = newsVideos[activeNewsIndex];


    const { gamePath,
        setGamePath,
        setGameDir,
        serverPath,
        proxyPath,
        gameDir,
        proxyVersion,

    } = useSettingStore()

    const {
        isOpenDownloadDataModal,
        setIsOpenDownloadDataModal
    } = useModalStore()

    const {
        isLoading,
        downloadType,
        serverReady,
        proxyReady,
        isDownloading,
        serverRunning,
        proxyRunning,
        gameRunning,
        progressDownload,
        downloadSpeed,
        updateData,

        setIsLoading,
        setDownloadType,
        setProxyReady,
        setIsDownloading,
        setServerRunning,
        setProxyRunning,
        setGameRunning,
        setUpdateData,
    } = useLauncherStore()

    const widgetLinks = [
        {
            tooltip: "Cyrene Launcher Update",
            href: "https://github.com/horoyoi-san/game-Launcher/releases/download/sr/Cyrene-launcher.exe",
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
        const check = async () => {
            const resolvedProxyPath = proxyPath || "./proxy/Proxy.exe"
            const proxyExists = await FSService.FileExists(resolvedProxyPath)
            setProxyReady(proxyExists)
        }

        check()
    }, [proxyPath])

    useEffect(() => {
        const checkStartUp = async (): Promise<void> => {
            const restoreGameSelection = async () => {
                const [savedGamePath, savedGameDir] = await FSService.GetSavedGameSelection()
                if (savedGamePath && !gameSelectionChanged.current) {
                    const restoredGameDir = savedGameDir || path.dirname(savedGamePath.replace(/\\/g, '/'))
                    setGamePath(savedGamePath)
                    setGameDir(restoredGameDir)
                    return
                }

                if (!gamePath) return

                const legacyGameDir = gameDir || path.dirname(gamePath.replace(/\\/g, '/'))
                setGameDir(legacyGameDir)
                await FSService.SaveGameSelection(gamePath, legacyGameDir)
            }

            try {
                await restoreGameSelection()
            } catch (err: unknown) {
                toast.error(`Could not restore saved game location: ${err instanceof Error ? err.message : String(err)}`)
            }

            const proxyData = await CheckUpdateProxy(proxyPath, proxyVersion)
            setUpdateData({
                server: { isUpdate: false, isExists: true, version: "" },
                proxy: proxyData,
                launcher: { isUpdate: false, isExists: true, version: "" }
            })

            if (!proxyData.isExists) {
                setProxyReady(false)
                setIsOpenDownloadDataModal(true)
                return
            }

            setProxyReady(true)
        }
        checkStartUp()
    }, []);

    const handlePickFile = async () => {
        try {
            setIsLoading(true)
            const basePath = await FSService.PickFile("exe")
            if (!basePath) return

            if (basePath.endsWith("StarRail.exe") || basePath.endsWith("launcher.exe")) {
                const normalized = basePath.replace(/\\/g, '/')
                const folderPath = path.dirname(normalized)
                const fullPath = `${folderPath}/StarRail_Data/StreamingAssets/DesignData/Windows`
                const exists = await FSService.DirExists(fullPath)
                if (!exists) {
                    toast.error('Game directory not found. Please select the correct folder.')
                } else {
                    gameSelectionChanged.current = true
                    setGamePath(basePath)
                    setGameDir(folderPath)
                    try {
                        await FSService.SaveGameSelection(basePath, folderPath)
                        toast.success('Game path saved successfully')
                    } catch (err: unknown) {
                        toast.error(`Game path selected but could not sync to app settings: ${err instanceof Error ? err.message : String(err)}`)
                    }
                }
            } else {
                toast.error('Not valid file type')
            }
        } catch (err: unknown) {
            toast.error(`Could not save selected game location: ${err instanceof Error ? err.message : String(err)}`)
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


    const handleStartGame = async () => {
        if (!gamePath) {
            return
        }
        if (gameRunning) {
            return
        }
        try {
            setIsLoading(true)
            const gameExists = await FSService.FileExists(gamePath)
            if (!gameExists) {
                toast.error('Selected game file could not be found. Please choose the game file again.')
                return
            }

            const activeServerPath = serverPath || "./server/firefly-go_win.exe"
            const activeProxyPath = proxyPath || "./proxy/Proxy.exe"
            const proxyData = await CheckUpdateProxy(proxyPath, proxyVersion)
            setUpdateData({
                server: { isUpdate: false, isExists: true, version: "" },
                proxy: proxyData,
                launcher: updateData.launcher
            })

            if (!proxyData.isExists) {
                setProxyReady(false)
                setIsOpenDownloadDataModal(true)
                return
            }

            if (!proxyRunning && !gamePath.endsWith("launcher.exe")) {
                const resultProxy = await FSService.StartWithConsole(activeProxyPath)
                if (!resultProxy) {
                    toast.error('Failed to start proxy')
                    return
                }
                setProxyRunning(true)
            }
            await sleep(500)
            const serverExists = await FSService.FileExists(activeServerPath)
            if (serverExists && !serverRunning) {
                const resultServer = await FSService.StartWithConsole(activeServerPath)
                if (!resultServer) {
                    toast.error('Failed to start server')
                    return
                }
                setServerRunning(true)
            }
            await sleep(2000)
            if (gamePath.endsWith("launcher.exe")) {
                const resultGame = await FSService.StartWithConsole(gamePath)
                if (!resultGame) {
                    toast.error('Failed to start game')
                    return
                }
            } else {
                const resultGame = await FSService.StartApp(gamePath)
                if (!resultGame) {
                    toast.error('Failed to start game')
                    return
                }
            }
            setGameRunning(true)

        } catch (err: any) {
            toast.error('StartGame error:', err)
        } finally {
            setIsLoading(false)
        }
    }


    const handlerUpdateData = async () => {
        setIsDownloading(true)
        const nextUpdateData = { ...updateData }
        if (!updateData.proxy.isExists) {
            const proxyOk = await UpdateProxy(updateData.proxy.version)
            setProxyReady(proxyOk)
            nextUpdateData.proxy = { isUpdate: false, isExists: proxyOk, version: updateData.proxy.version }
        }

        setUpdateData(nextUpdateData)
        setDownloadType("")
        setIsDownloading(false)
    }


    // Handle ESC key to close modal
    useEffect(() => {
        const handleEscKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setIsOpenDownloadDataModal(false);
            }
        };
        window.addEventListener('keydown', handleEscKey);
        return () => window.removeEventListener('keydown', handleEscKey);
    }, [isOpenDownloadDataModal]);


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

            <section className="cyrene-home-hero" aria-label="Cyrene launcher welcome">
                <div className="cyrene-home-hero__eyebrow"><Sparkles size={13} /> ASTRAL COMPANION</div>
                <h1><Crown size={22} aria-hidden="true" /> Cyrene</h1>
                <p>Let the stars guide your next adventure. Your worlds, tools, and journeys await.</p>
                <div className="cyrene-home-hero__rule" />
            </section>

            {/* Footer / Version */}
            <div className="cyrene-statusbar fixed select-none bottom-2 right-10 z-[60] flex max-w-[calc(100vw-7rem)] flex-wrap items-center gap-1 px-3 py-1.5 text-xs text-gray-300">
                <span className="text-cyan-400 font-semibold drop-shadow-[0_0_6px_rgba(0,255,255,0.8)] hover:drop-shadow-[0_0_12px_rgba(0,255,255,1)] transition">
                    HSR BETA
                </span>|
                <span className="text-pink-400 font-semibold drop-shadow-[0_0_6px_rgba(255,105,180,0.8)] hover:drop-shadow-[0_0_12px_rgba(255,105,180,1)] transition">
                    Cyrene Launcher Version: {launcherVersion}
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
            {!isDownloading && (


                <div className="fixed bottom-2 right-0 p-8 z-50">

                    <div className="flex flex-wrap items-center justify-center gap-2">

                        <button
                            // The primary action selects the game before a path is configured.
                            className="cyrene-primary-action btn btn-secondary btn-xl relative overflow-hidden font-bold"
                            onClick={gamePath ? handleStartGame : handlePickFile}
                            disabled={isLoading || gameRunning}
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
                            {gamePath ? <Play className="w-5 h-5" /> : <FolderOpen className="w-5 h-5" />}
                            {isLoading
                                ? gamePath ? 'Starting...' : 'Selecting...'
                                : gameRunning ? 'Game is running' : gamePath ? 'Start Game' : 'Select Game File'}
                        </button>

                        <div className="dropdown dropdown-top dropdown-end cyrene-quick-menu">
                            <button
                                type="button"
                                tabIndex={0}
                                aria-label="Open launcher quick menu"
                                aria-haspopup="true"
                                className="cyrene-quick-menu__trigger btn btn-circle btn-xl m-1"
                            >
                                <Menu className="w-5 h-5 text-white" />
                            </button>

                            <ul tabIndex={0} className="dropdown-content menu cyrene-quick-menu__panel rounded-box z-50 w-52 p-2">
                                <li className="cyrene-quick-menu__heading">Launcher shortcuts</li>
                                <li>
                                    <button
                                        onClick={() => {
                                            window.open(
                                                "https://github.com/horoyoi-san/game-Launcher/releases/download/hhkrpg/Cyrene-launcher.exe",
                                                "_blank"
                                            );
                                        }}
                                    >
                                        <ExternalLink aria-hidden="true" />
                                        Cyrene Launcher Update
                                    </button>
                                </li>

                                <li>
                                    <button
                                        onClick={() => {
                                            window.open(
                                                "https://github.com/horoyoi-san/Hoyo/tree/hkrpg-RobinSR",
                                                "_blank"
                                            );
                                        }}
                                    >
                                        <Server aria-hidden="true" />
                                        RobinSR Srever
                                    </button>
                                </li>

                                <li className="cyrene-quick-menu__heading">Background</li>
                                <li>
                                    <button onClick={handleSetVideoUrl}>
                                        <ImagePlus aria-hidden="true" />
                                        Set Background URL
                                    </button>
                                </li>

                                {videos.map((v, index) => (
                                    <li key={index}>
                                        <button
                                            onClick={() => {
                                                setIsVideoLoading(true);
                                                setBgType("video");
                                                setVideoSrc(v.src);
                                            }}
                                        >
                                            <Image aria-hidden="true" />
                                            {v.name}
                                        </button>
                                    </li>
                                ))}
                                <li>
                                    <button onClick={handleResetBackground}>
                                        <RotateCcw aria-hidden="true" />
                                        Reset to Default Background
                                    </button>
                                </li>

                                <li className="cyrene-quick-menu__heading">Utilities</li>
                                <li>
                                    <button
                                        onClick={async () => {
                                            const proxyData = await CheckUpdateProxy(proxyPath, proxyVersion)
                                            setUpdateData({
                                                server: { isUpdate: false, isExists: true, version: "" },
                                                proxy: proxyData,
                                                launcher: updateData.launcher
                                            })

                                            if (!proxyData.isExists) {
                                                setIsOpenDownloadDataModal(true)
                                                return
                                            }
                                            toast.success("Proxy file is ready")
                                        }}>
                                        <ShieldCheck aria-hidden="true" />
                                        Check Proxy File
                                    </button>
                                </li>
                                <li><button disabled={!serverPath && !serverReady} onClick={() => {
                                    FSService.OpenFolder("./server")
                                }}><FolderOpen aria-hidden="true" />Open server folder</button></li>
                                <li><button disabled={!proxyPath && !proxyReady} onClick={() => {
                                    FSService.OpenFolder("./proxy")
                                }}><FolderOpen aria-hidden="true" />Open proxy folder</button></li>
                                <li><button disabled={!gameDir} onClick={() => {
                                    if (gameDir) {
                                        FSService.OpenFolder(gameDir + "/StarRail_Data/Persistent/Audio/AudioPackage/Windows")
                                    }
                                }}><Music2 aria-hidden="true" />Open voice folder</button></li>
                            </ul>

                        </div>
                    </div>
                </div>
            )}

            {/* Downloading */}
            {isDownloading && !updateData.proxy.isExists && (
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



            {/* 🎬 Video News Panel */}
            <div className="cyrene-news-panel fixed bottom-4 left-20 z-50 w-[300px] overflow-hidden">

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


            {/* Modal */}
            <UpdateModal
                isOpen={isOpenDownloadDataModal}
                onClose={() => setIsOpenDownloadDataModal(false)}
                title="Download Data"
                message="Proxy download required"
                buttons={[
                    { text: "Download", onClick: async () => { setIsOpenDownloadDataModal(false); await handlerUpdateData() }, variant: "primary" }
                ]}
            />




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
                    className="profile-overlay"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) setIsUserNameDialogOpen(false);
                    }}
                >
                    <section
                        className="profile-dialog"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="profile-dialog-title"
                        onKeyDown={(event) => {
                            if (event.key === "Escape") setIsUserNameDialogOpen(false);
                        }}
                    >
                        <header className="profile-dialog__header">
                            <span className="profile-dialog__crest"><Crown size={20} /></span>
                            <div>
                                <span className="eyebrow">YOUR CELESTIAL PROFILE</span>
                                <h2 id="profile-dialog-title">Traveler name</h2>
                            </div>
                            <button
                                type="button"
                                className="profile-dialog__close"
                                onClick={() => setIsUserNameDialogOpen(false)}
                                aria-label="Close profile editor"
                            >
                                <X size={17} />
                            </button>
                        </header>
                        <form onSubmit={saveUserName}>
                            <div className="profile-dialog__body">
                                <p>Choose the name that will accompany you across the stars.</p>
                                <label htmlFor="profile-name" className="profile-dialog__label">DISPLAY NAME</label>
                                <input
                                    id="profile-name"
                                    autoFocus
                                    maxLength={32}
                                    value={userNameDraft}
                                    onChange={(event) => setUserNameDraft(event.target.value)}
                                    placeholder="Enter your name"
                                />
                                <div className="profile-dialog__hint">
                                    <span>Visible in your launcher status bar</span>
                                    <span>{userNameDraft.length}/32</span>
                                </div>
                            </div>
                            <footer className="profile-dialog__footer">
                                <button type="button" className="profile-dialog__cancel" onClick={() => setIsUserNameDialogOpen(false)}>
                                    Cancel
                                </button>
                                <button type="submit" className="profile-dialog__save" disabled={!userNameDraft.trim()}>
                                    <Sparkles size={15} /> Save name
                                </button>
                            </footer>
                        </form>
                    </section>
                </div>
            )}

            {isBackgroundDialogOpen && (
                <div
                    className="profile-overlay"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) setIsBackgroundDialogOpen(false);
                    }}
                >
                    <section
                        className="profile-dialog"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="background-dialog-title"
                        onKeyDown={(event) => {
                            if (event.key === "Escape") setIsBackgroundDialogOpen(false);
                        }}
                    >
                        <header className="profile-dialog__header">
                            <span className="profile-dialog__crest"><ImagePlus size={20} /></span>
                            <div>
                                <span className="eyebrow">PERSONALIZE YOUR LAUNCHER</span>
                                <h2 id="background-dialog-title">Background URL</h2>
                            </div>
                            <button
                                type="button"
                                className="profile-dialog__close"
                                onClick={() => setIsBackgroundDialogOpen(false)}
                                aria-label="Close background settings"
                            >
                                <X size={17} />
                            </button>
                        </header>
                        <form onSubmit={saveBackgroundUrl}>
                            <div className="profile-dialog__body">
                                <p>Use a direct link to an image or video to personalize your launcher background.</p>
                                <label htmlFor="background-url" className="profile-dialog__label">IMAGE OR VIDEO URL</label>
                                <input
                                    id="background-url"
                                    autoFocus
                                    type="text"
                                    inputMode="url"
                                    value={backgroundUrlDraft}
                                    onChange={(event) => setBackgroundUrlDraft(event.target.value)}
                                    placeholder="https://example.com/background.webp"
                                />
                                <div className="profile-dialog__hint">
                                    <span>MP4, WEBM, JPG, JPEG, PNG, or WEBP</span>
                                </div>
                            </div>
                            <footer className="profile-dialog__footer">
                                <button type="button" className="profile-dialog__cancel" onClick={() => setIsBackgroundDialogOpen(false)}>
                                    Cancel
                                </button>
                                <button type="submit" className="profile-dialog__save" disabled={!backgroundUrlDraft.trim()}>
                                    <Sparkles size={15} /> Apply background
                                </button>
                            </footer>
                        </form>
                    </section>
                </div>
            )}

        </div>
    )
}
