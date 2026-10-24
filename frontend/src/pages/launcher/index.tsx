import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Play, Menu, Minus, FolderOpen, Sparkles, Crown, X, ExternalLink, Server, ImagePlus, Image, RotateCcw, Music2, FileText, Copy, Download } from 'lucide-react';
import { AppService } from '@bindings/sunbringer-launcher/internal/app-service';
import { FSService } from '@bindings/sunbringer-launcher/internal/fs-service';
import { toast } from 'react-toastify';
import path from 'path-browserify'
import useSettingStore from '@/stores/settingStore';
import useModalStore from '@/stores/modalStore';
import useLauncherStore from '@/stores/launcherStore';
import { motion } from 'motion/react';
import { CheckPatchInstalled, CheckUpdateServer, sleep, UpdatePatch, UpdateServer } from '@/helper';
import UpdateModal from '@/components/updateModal';
import usePanelStore from "@/stores/panelStore";
import { findZenlessDataDirectory } from "@/helper/game";

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
    const [isGamePathValid, setIsGamePathValid] = useState(false);

    const [userName, setUserName] = useState<string>(() => {
        // โหลดจาก localStorage หรือ fallback เป็น default
        return localStorage.getItem("userName") || "User Name";
    });
    const [isUserNameDialogOpen, setIsUserNameDialogOpen] = useState(false);
    const [userNameDraft, setUserNameDraft] = useState(userName);
    const [isOffsetsDialogOpen, setIsOffsetsDialogOpen] = useState(false);
    const [offsetsContent, setOffsetsContent] = useState("");
    const [savedOffsetsContent, setSavedOffsetsContent] = useState("");
    const [isLoadingOffsets, setIsLoadingOffsets] = useState(false);
    const [isFetchingOffsets, setIsFetchingOffsets] = useState(false);
    const [isSavingOffsets, setIsSavingOffsets] = useState(false);
    const [offsetsError, setOffsetsError] = useState("");
    const [offsetsRemoteError, setOffsetsRemoteError] = useState("");
    const offsetsFilePath = String.raw`D:\Horoyoisan\PS\nap\CNBetaWin3.3.4\offsets.zon`;
    const [isUIDCustomDialogOpen, setIsUIDCustomDialogOpen] = useState(false);
    const [uidCustomContent, setUIDCustomContent] = useState("");
    const [savedUIDCustomContent, setSavedUIDCustomContent] = useState("");
    const [isLoadingUIDCustom, setIsLoadingUIDCustom] = useState(false);
    const [isSavingUIDCustom, setIsSavingUIDCustom] = useState(false);
    const [uidCustomError, setUIDCustomError] = useState("");
    const uidCustomFilePath = String.raw`D:\Horoyoisan\PS\nap\CNBetaWin3.3.4\uid_custom.txt`;

    const [videoSrc, setVideoSrc] = useState("/video1.mp4");
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
    const launcherDefaultVideos = ["/video1.mp4"];
    const launcherDefaultImages = ["/bg1.jpg"]; // ถ้ามี background เป็น image
    const [defaultIndex] = useState(0); // index ของ default
    const [defaultBgType] = useState<"video" | "image">("video");
    const userColor = "#79dcff";

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

    const loadOffsetsFile = async () => {
        setIsLoadingOffsets(true);
        setOffsetsError("");
        try {
            const content = await FSService.ReadOffsetsFile();
            setOffsetsContent(content);
            setSavedOffsetsContent(content);
        } catch (error: unknown) {
            setOffsetsError(error instanceof Error ? error.message : String(error));
        } finally {
            setIsLoadingOffsets(false);
        }
    };

    const fetchUpstreamOffsets = async () => {
        if (offsetsContent !== savedOffsetsContent && !window.confirm("Replace the unsaved offsets.zon edits with the upstream values?")) return;
        setIsFetchingOffsets(true);
        setOffsetsRemoteError("");
        try {
            const content = await FSService.FetchUpstreamOffsetsFile();
            if (!content.trim()) throw new Error("The upstream offsets.zon file was empty");
            setOffsetsContent(content);
            setOffsetsRemoteError("");
            toast.success("Upstream offsets loaded into the editor. Save changes to apply them.");
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            setOffsetsRemoteError(`Could not fetch upstream offsets.zon: ${message}`);
            toast.error("Could not fetch upstream offsets.zon");
        } finally {
            setIsFetchingOffsets(false);
        }
    };

    const saveOffsetsFile = async () => {
        setIsSavingOffsets(true);
        setOffsetsError("");
        try {
            await FSService.WriteOffsetsFile(offsetsContent);
            setSavedOffsetsContent(offsetsContent);
            toast.success("offsets.zon saved");
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            setOffsetsError(message);
            toast.error(`Could not save offsets.zon: ${message}`);
        } finally {
            setIsSavingOffsets(false);
        }
    };

    const loadUIDCustomFile = async () => {
        setIsLoadingUIDCustom(true);
        setUIDCustomError("");
        try {
            const content = await FSService.ReadUIDCustomFile();
            setUIDCustomContent(content);
            setSavedUIDCustomContent(content);
        } catch (error: unknown) {
            setUIDCustomError(error instanceof Error ? error.message : String(error));
        } finally {
            setIsLoadingUIDCustom(false);
        }
    };

    const saveUIDCustomFile = async () => {
        setIsSavingUIDCustom(true);
        setUIDCustomError("");
        try {
            await FSService.WriteUIDCustomFile(uidCustomContent);
            setSavedUIDCustomContent(uidCustomContent);
            toast.success("uid_custom.txt saved");
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            setUIDCustomError(message);
            toast.error(`Could not save uid_custom.txt: ${message}`);
        } finally {
            setIsSavingUIDCustom(false);
        }
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
        { name: "Sunbringer Galaxy", src: "/video1.mp4", icon: "/appicon.png" },
        { name: "Nebula Drift", src: "/video1.mp4", icon: "/icon.png" },
    ];

    // 🎬 News Video (ไม่มีข้อความ)
    const newsVideos = [
        "https://raw.githubusercontent.com/horoyoi-san/game-Launcher/refs/heads/sunbringer-launcher/frontend/public/video/1.mp4",
        "https://raw.githubusercontent.com/horoyoi-san/game-Launcher/refs/heads/sunbringer-launcher/frontend/public/video/2.mp4",
        "https://raw.githubusercontent.com/horoyoi-san/game-Launcher/refs/heads/sunbringer-launcher/frontend/public/video/3.mp4",
        "https://raw.githubusercontent.com/horoyoi-san/game-Launcher/refs/heads/sunbringer-launcher/frontend/public/video/4.mp4",
        "https://raw.githubusercontent.com/horoyoi-san/game-Launcher/refs/heads/sunbringer-launcher/frontend/public/video/5.mp4",
        "https://raw.githubusercontent.com/horoyoi-san/game-Launcher/refs/heads/sunbringer-launcher/frontend/public/video/6.mp4",
        "https://raw.githubusercontent.com/horoyoi-san/game-Launcher/refs/heads/sunbringer-launcher/frontend/public/video/7.mp4",
        "https://raw.githubusercontent.com/horoyoi-san/game-Launcher/refs/heads/sunbringer-launcher/frontend/public/video/8.mp4",
        "https://raw.githubusercontent.com/horoyoi-san/game-Launcher/refs/heads/sunbringer-launcher/frontend/public/video/9.mp4",
        "https://raw.githubusercontent.com/horoyoi-san/game-Launcher/refs/heads/sunbringer-launcher/frontend/public/video/10.mp4",
    ];

    const [activeNewsIndex, setActiveNewsIndex] = useState(0);
    const activeNews = newsVideos[activeNewsIndex];


    const { gamePath,
        setGamePath,
        setGameDir,
    serverPath,
    serverVersion,
    gameDir,
    patchInstalledGameDir,

    } = useSettingStore()

    const {
        isOpenDownloadDataModal,
        setIsOpenDownloadDataModal
    } = useModalStore()

    const {
        isLoading,
        downloadType,
        serverReady,
        isDownloading,
        serverRunning,
        gameRunning,
        progressDownload,
        downloadSpeed,
        updateData,

        setIsLoading,
        setDownloadType,
        setServerReady,
        setIsDownloading,
        setServerRunning,
        setGameRunning,
        setUpdateData,
    } = useLauncherStore()

    const widgetLinks = [
        {
            tooltip: "Sunbringer Update",
            href: "https://github.com/horoyoi-san/game-Launcher/releases/download/nap/sunbringer-launcher.exe",
            img: "/appicon.png",
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
        const checkStartUp = async (): Promise<void> => {
            const restoreGameSelection = async () => {
                let savedGamePath = ""
                let savedGameDir = ""
                try {
                    [savedGamePath, savedGameDir] = await FSService.GetSavedGameSelection()
                } catch (error: unknown) {
                    toast.error(`Could not read saved game location: ${error instanceof Error ? error.message : String(error)}`)
                }

                const restoredGamePath = !gameSelectionChanged.current ? savedGamePath || gamePath : gamePath
                const restoredGameDir = restoredGamePath
                    ? savedGameDir || gameDir || path.dirname(restoredGamePath.replace(/\\/g, '/'))
                    : ""

                if (!restoredGamePath) {
                    setGamePath("")
                    setGameDir("")
                    setIsGamePathValid(false)
                    return ""
                }

                const normalizedGamePath = restoredGamePath.replace(/\\/g, '/')
                const executableName = path.basename(normalizedGamePath).toLowerCase()
                const validExecutable = executableName === "zenlesszonezerobeta.exe"
                const gameDataExists = Boolean(await findZenlessDataDirectory(restoredGameDir))
                const gameExecutableExists = await FSService.FileExists(restoredGamePath)
                if (!validExecutable || !gameExecutableExists || !gameDataExists) {
                    setGamePath("")
                    setGameDir("")
                    setIsGamePathValid(false)
                    try {
                        await FSService.SaveGameSelection("", "")
                    } catch (error: unknown) {
                        toast.error(`Could not clear invalid saved game location: ${error instanceof Error ? error.message : String(error)}`)
                    }
                    return ""
                }

                setGamePath(restoredGamePath)
                setGameDir(restoredGameDir)
                setIsGamePathValid(true)
                if (savedGamePath !== restoredGamePath || savedGameDir !== restoredGameDir) {
                    await FSService.SaveGameSelection(restoredGamePath, restoredGameDir)
                }
                return restoredGameDir
            }

            let restoredGameDir = gameDir
            try {
                restoredGameDir = await restoreGameSelection() || ""
            } catch (err: unknown) {
                toast.error(`Could not restore saved game location: ${err instanceof Error ? err.message : String(err)}`)
            }

            const serverData = await CheckUpdateServer(serverPath, serverVersion)
            setUpdateData({
                server: serverData,
                launcher: { isUpdate: false, isExists: true, version: "" }
            })
            setServerReady(serverData.isExists && !serverData.isUpdate)
            const patchIsInstalled = !restoredGameDir || await CheckPatchInstalled(restoredGameDir, patchInstalledGameDir)
            if (!serverData.isExists || serverData.isUpdate || !patchIsInstalled) {
                setIsOpenDownloadDataModal(true)
            }
        }
        void checkStartUp().catch((error: unknown) => {
            toast.error(`Could not check NAP files: ${error instanceof Error ? error.message : String(error)}`)
        })
    }, []);

    const handlePickFile = async () => {
        try {
            setIsLoading(true)
            const basePath = await FSService.PickFile("exe")
            if (!basePath) return

            const normalized = basePath.replace(/\\/g, '/')
            const executableName = path.basename(normalized).toLowerCase()
            if (executableName === "zenlesszonezerobeta.exe") {
                const folderPath = path.dirname(normalized)
                const gameDataExists = Boolean(await findZenlessDataDirectory(folderPath))
                if (!gameDataExists) {
                    toast.error('Zenless Zone Zero Beta data folder not found. Select its installation folder.')
                } else {
                    try {
                        await FSService.SaveGameSelection(basePath, folderPath)
                        gameSelectionChanged.current = true
                        setGamePath(basePath)
                        setGameDir(folderPath)
                        setIsGamePathValid(true)
                        toast.success('Game path saved successfully')
                    } catch (err: unknown) {
                        toast.error(`Could not save selected game location: ${err instanceof Error ? err.message : String(err)}`)
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
                setIsGamePathValid(false)
                setGamePath("")
                setGameDir("")
                try {
                    await FSService.SaveGameSelection("", "")
                } catch (error: unknown) {
                    toast.error(`Could not clear missing game location: ${error instanceof Error ? error.message : String(error)}`)
                }
                return
            }

            const serverData = await CheckUpdateServer(serverPath, serverVersion)
            setUpdateData({
                server: serverData,
                launcher: updateData.launcher
            })

            setServerReady(serverData.isExists && !serverData.isUpdate)
            if (!serverData.isExists || serverData.isUpdate) {
                setIsOpenDownloadDataModal(true)
                return
            }

            if (!(await CheckPatchInstalled(gameDir, patchInstalledGameDir))) {
                setIsOpenDownloadDataModal(true)
                return
            }

            if (!serverRunning) {
                const [serverStarted, serverError] = await FSService.StartNAPServer()
                if (!serverStarted) {
                    toast.error(`Failed to start server: ${serverError}`)
                    return
                }
                setServerRunning(true)
            }
            await sleep(2000)
            const patchedLauncher = path.join(gameDir, "Sunbringer.exe")
            const [resultGame, gameError] = await FSService.StartWithConsole(patchedLauncher)
            if (!resultGame) {
                toast.error(`Failed to start patched game: ${gameError}`)
                return
            }
            setGameRunning(true)

        } catch (err: unknown) {
            toast.error(`Start game error: ${err instanceof Error ? err.message : String(err)}`)
        } finally {
            setIsLoading(false)
        }
    }


    const handlerUpdateData = async () => {
        if (isDownloading) return
        setIsDownloading(true)
        const nextUpdateData = { ...updateData }
        try {
            if (!updateData.server.isExists || updateData.server.isUpdate) {
                const serverOk = await UpdateServer()
                if (!serverOk) return
                nextUpdateData.server = { isUpdate: false, isExists: true, version: "remielle-0.1.x" }
                setServerReady(true)
            }

            if (gameDir) {
                if (!(await CheckPatchInstalled(gameDir, patchInstalledGameDir))) {
                    if (!(await UpdatePatch(gameDir))) return
                }
            }

            setIsOpenDownloadDataModal(false)
            setUpdateData(nextUpdateData)
        } catch (error: unknown) {
            toast.error(`Could not prepare NAP: ${error instanceof Error ? error.message : String(error)}`)
        } finally {
            setDownloadType("")
            setIsDownloading(false)
        }
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
        <div className="sunbringer-dashboard relative min-h-fit overflow-hidden">
            <span className="hidden">{activeUrl}</span>

            {bgType === "video" ? (
                <video
                    className="fixed inset-0 z-0 w-full h-full object-cover"
                    autoPlay
                    loop
                    muted
                    playsInline
                    preload="auto"
                    poster="/bg.png"
                    key={videoSrc}
                    onLoadStart={() => setIsVideoLoading(true)}
                    onLoadedData={() => setIsVideoLoading(false)}
                    onCanPlay={() => setIsVideoLoading(false)}
                    onCanPlayThrough={() => setIsVideoLoading(false)}
                    onError={() => {
                        console.log("video load failed");
                        if (videoSrc !== "/video1.mp4") {
                            setVideoSrc("/video1.mp4");
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

            <main className="sunbringer-command-deck" aria-label="Sunbringer command deck">
                <header className="sunbringer-command-deck__masthead">
                    <div className="sunbringer-command-deck__eyebrow"><Sparkles size={13} /> NAP / BETA CLIENT <span>•</span> COMMAND DECK</div>
                    <div className="sunbringer-command-deck__identity">
                        <div><small>WELCOME, {userName.toUpperCase()}</small><h1>Sunbringer<span>.</span></h1></div>
                        <p>Enter New Eridu.</p>
                    </div>
                </header>
                <div className="sunbringer-command-deck__art" aria-hidden="true">
                    <div className="sunbringer-command-deck__halo" />
                    <img src="/sunbringer-character.png" alt="" />
                </div>
                <div className="sunbringer-command-deck__coordinates" aria-hidden="true"><span>01 / NEW ERIDU</span><i /><span>VOID HUNTERS // SUNBRINGER</span></div>
            </main>

            {/* Footer / Version */}
            <div className="sunbringer-statusbar fixed select-none bottom-2 right-10 z-[60] flex max-w-[calc(100vw-7rem)] flex-wrap items-center gap-1 px-3 py-1.5 text-xs text-gray-300">
                <span className="text-cyan-400 font-semibold drop-shadow-[0_0_6px_rgba(0,255,255,0.8)] hover:drop-shadow-[0_0_12px_rgba(0,255,255,1)] transition">
                    ZZZ BETA
                </span>|
                <span className="text-violet-300 font-semibold drop-shadow-[0_0_6px_rgba(153,140,255,0.8)] hover:drop-shadow-[0_0_12px_rgba(153,140,255,1)] transition">
                    Sunbringer Version: {launcherVersion}
                </span>|
                <span className="text-cyan-200 font-semibold drop-shadow-[0_0_6px_rgba(110,205,255,0.8)] hover:drop-shadow-[0_0_12px_rgba(110,205,255,1)] transition">
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


                <div className="sunbringer-command-actions fixed bottom-2 right-0 p-8 z-50">

                    <div className="flex flex-wrap items-center justify-center gap-2">

                        <button
                            // The primary action selects the game before a path is configured.
                            className="sunbringer-primary-action btn btn-secondary btn-xl relative overflow-hidden font-bold"
                            onClick={isGamePathValid ? handleStartGame : handlePickFile}
                            disabled={isLoading || gameRunning}
                            style={{
                                // กำหนดรูปภาพพื้นหลัง
                                //  backgroundImage: "url('https://act-webstatic.hoyoverse.com/puzzle/hk4e/pz_df1bhOOLAB/resource/puzzle/2025/09/22/294b38ce0a4a1cbe94d10dd5082af4fe_5739821151544819626.png')",
                                //  backgroundSize: "cover",
                                // backgroundPosition: "center",

                                // **คำสั่งที่ทำให้เกิดการเรืองแสง (Glow Effect)**
                                boxShadow: "0 0 18px rgba(67, 181, 255, 0.52), 0 0 28px rgba(111, 92, 255, 0.32) inset",

                                // ปรับข้อความให้อ่านง่าย
                                color: "white",
                                textShadow: "0 0 5px rgba(0, 0, 0, 0.93)"
                            }}
                        >
                            {isGamePathValid ? <Play className="w-5 h-5" /> : <FolderOpen className="w-5 h-5" />}
                            {isLoading
                                ? isGamePathValid ? 'Starting...' : 'Selecting...'
                                : gameRunning ? 'Game is running' : isGamePathValid ? 'Start Game' : 'Select Game File'}
                        </button>

                        <div className="dropdown dropdown-top dropdown-end sunbringer-quick-menu">
                            <button
                                type="button"
                                tabIndex={0}
                                aria-label="Open launcher quick menu"
                                aria-haspopup="true"
                                className="sunbringer-quick-menu__trigger btn btn-circle btn-xl m-1"
                            >
                                <Menu className="w-5 h-5 text-white" />
                            </button>

                            <ul tabIndex={0} className="dropdown-content menu sunbringer-quick-menu__panel rounded-box z-50 p-2">
                                <li className="sunbringer-quick-menu__heading">Launcher shortcuts</li>
                                <li>
                                    <button
                                        onClick={() => {
                                            window.open(
                                                "https://github.com/horoyoi-san/game-Launcher/releases/download/nap/sunbringer-launcher.exe",
                                                "_blank"
                                            );
                                        }}
                                    >
                                        <ExternalLink aria-hidden="true" />
                                        Sunbringer Update
                                    </button>
                                </li>

                                <li>
                                    <button
                                        onClick={() => {
                                            window.open(
                                                "https://git.xeondev.com/remielle/remielle/src/branch/0.1.x",
                                                "_blank"
                                            );
                                        }}
                                    >
                                        <Server aria-hidden="true" />
                                        Sunbringer Server
                                    </button>
                                </li>

                                <li className="sunbringer-quick-menu__heading">Background</li>
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

                                <li className="sunbringer-quick-menu__heading">Utilities</li>
                                <li className="sunbringer-quick-menu__heading">Game configuration</li>
                                <li><button onClick={() => {
                                    setIsOffsetsDialogOpen(true);
                                    void loadOffsetsFile();
                                }}><FileText aria-hidden="true" />Edit offsets.zon</button></li>
                                <li><button onClick={() => {
                                    setIsUIDCustomDialogOpen(true);
                                    void loadUIDCustomFile();
                                }}><FileText aria-hidden="true" />Edit UID Custom</button></li>
                                <li>
                                    <button onClick={() => void handlePickFile()}>
                                        <FolderOpen aria-hidden="true" />
                                        {isGamePathValid ? "Change game location" : "Select game location"}
                                    </button>
                                </li>
                                <li><button disabled={!serverPath && !serverReady} onClick={() => {
                                    FSService.OpenFolder("./server")
                                }}><FolderOpen aria-hidden="true" />Open server folder</button></li>
                                <li><button disabled={!gameDir} onClick={async () => {
                                    if (!gameDir) return
                                    const dataDirectory = await findZenlessDataDirectory(gameDir)
                                    if (!dataDirectory) return
                                    const audioPath = path.join(gameDir, dataDirectory, "Persistent", "Audio", "AudioPackage", "Windows")
                                    if (await FSService.DirExists(audioPath)) {
                                        FSService.OpenFolder(audioPath)
                                    } else {
                                        FSService.OpenFolder(path.join(gameDir, dataDirectory))
                                    }
                                }}><Music2 aria-hidden="true" />Open voice folder</button></li>
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



            {/* 🎬 Video News Panel */}
            <section className="sunbringer-news-panel sunbringer-transmission" aria-label="Transmission clips">
                <header className="sunbringer-transmission__heading"><span><i /> FIELD TRANSMISSION</span><b>{String(activeNewsIndex + 1).padStart(2, "0")}<em> / {String(newsVideos.length).padStart(2, "0")}</em></b></header>
                <div className="sunbringer-transmission__screen">
                    <video key={activeNews} src={activeNews} autoPlay muted playsInline onEnded={() => setActiveNewsIndex((prev) => (prev + 1) % newsVideos.length)} />
                    <div className="sunbringer-transmission__screen-label"><span>NOW PLAYING</span><strong>NEW ERIDU // ARCHIVE</strong></div>
                    <span className="sunbringer-transmission__live"><i /> SIGNAL</span>
                </div>
                <div className="sunbringer-transmission__reel" role="group" aria-label="Choose transmission">
                    {newsVideos.map((vid, index) => <button key={index} type="button" onClick={() => setActiveNewsIndex(index)} className={activeNewsIndex === index ? "is-active" : ""} aria-label={`Play transmission ${index + 1}`} aria-pressed={activeNewsIndex === index}><video src={vid} muted playsInline preload="metadata" /><span>{String(index + 1).padStart(2, "0")}</span></button>)}
                </div>
            </section>


            {/* Modal */}
            {isOffsetsDialogOpen && (
                <div className="sunbringer-dialog-overlay" onMouseDown={(event) => {
                    if (event.target === event.currentTarget) setIsOffsetsDialogOpen(false)
                }}>
                    <section className="sunbringer-dialog offsets-dialog" role="dialog" aria-modal="true" aria-labelledby="offsets-dialog-title" onKeyDown={(event) => {
                        if (event.key === "Escape") setIsOffsetsDialogOpen(false)
                    }}>
                        <header className="sunbringer-dialog__header">
                            <span className="sunbringer-dialog__icon"><FileText size={19} /></span>
                            <div><span className="eyebrow">GAME CONFIGURATION / NAP</span><h2 id="offsets-dialog-title">Edit update offsets</h2></div>
                            <button type="button" className="sunbringer-dialog__close" onClick={() => setIsOffsetsDialogOpen(false)} aria-label="Close offsets menu"><X size={17} /></button>
                        </header>
                        <div className="sunbringer-dialog__body">
                            <p>Edit the NAP update offsets here. Save writes your changes directly to the configured game file.</p>
                            <div className="offsets-dialog__path"><span>FILE TARGET</span><code>{offsetsFilePath}</code></div>
                            <p className="offsets-editor__help">ต้องการค่า offsets ล่าสุดใช่ไหม? กด <strong>Fetch upstream</strong> เพื่อดึงค่ามาแสดงในช่องนี้ก่อน การดึงค่าจะยังไม่เปลี่ยนไฟล์เกม ให้ตรวจสอบข้อมูลแล้วกด <strong>Save changes</strong> เมื่อต้องการบันทึกลงไฟล์เกม</p>
                            <div className="offsets-editor__toolbar">
                                <span>{isLoadingOffsets ? "READING FILE…" : offsetsError ? "FILE ERROR" : offsetsContent !== savedOffsetsContent ? "UNSAVED CHANGES" : "FILE LOADED"}</span>
                                <button type="button" onClick={() => void fetchUpstreamOffsets()} disabled={isLoadingOffsets || isFetchingOffsets || isSavingOffsets}><Download size={13} />{isFetchingOffsets ? "Fetching…" : "Fetch upstream"}</button>
                                <button type="button" onClick={() => {
                                    if (offsetsContent !== savedOffsetsContent && !window.confirm("Discard unsaved changes and reload offsets.zon?")) return
                                    void loadOffsetsFile()
                                }} disabled={isLoadingOffsets || isFetchingOffsets || isSavingOffsets}><RotateCcw size={13} />Reload</button>
                            </div>
                            {offsetsError && <div className="offsets-editor__error" role="alert">{offsetsError}</div>}
                            {offsetsRemoteError && <div className="offsets-editor__error" role="alert">{offsetsRemoteError}</div>}
                            <textarea className="offsets-editor__input" spellCheck={false} value={offsetsContent} onChange={(event) => setOffsetsContent(event.target.value)} placeholder={isLoadingOffsets ? "Loading offsets.zon…" : "File contents will appear here"} disabled={isLoadingOffsets || isFetchingOffsets || Boolean(offsetsError)} aria-label="offsets.zon contents" />
                            <div className="sunbringer-dialog__actions offsets-dialog__actions">
                                <button type="button" className="sunbringer-dialog__button sunbringer-dialog__button--outline" onClick={async () => {
                                    try {
                                        await navigator.clipboard.writeText(offsetsFilePath)
                                        toast.success("Offsets path copied")
                                    } catch {
                                        toast.error("Could not copy the offsets path")
                                    }
                                }}><Copy size={15} />Copy path</button>
                                <button type="button" className="sunbringer-dialog__button sunbringer-dialog__button--primary" onClick={async () => {
                                    await saveOffsetsFile()
                                }} disabled={isLoadingOffsets || isFetchingOffsets || isSavingOffsets || Boolean(offsetsError) || offsetsContent === savedOffsetsContent}><FileText size={15} />{isSavingOffsets ? "Saving…" : "Save changes"}</button>
                                <button type="button" className="sunbringer-dialog__button sunbringer-dialog__button--outline" onClick={async () => {
                                    const [ok, message] = await FSService.OpenFolder(await FSService.GetDir(offsetsFilePath))
                                    if (ok) return
                                    else toast.error(message || "Could not open the offsets folder")
                                }}><FolderOpen size={15} />Show folder</button>
                            </div>
                        </div>
                    </section>
                </div>
            )}
            {isUIDCustomDialogOpen && (
                <div className="sunbringer-dialog-overlay" onMouseDown={(event) => {
                    if (event.target === event.currentTarget) setIsUIDCustomDialogOpen(false)
                }}>
                    <section className="sunbringer-dialog offsets-dialog" role="dialog" aria-modal="true" aria-labelledby="uid-custom-dialog-title" onKeyDown={(event) => {
                        if (event.key === "Escape") setIsUIDCustomDialogOpen(false)
                    }}>
                        <header className="sunbringer-dialog__header">
                            <span className="sunbringer-dialog__icon"><FileText size={19} /></span>
                            <div><span className="eyebrow">GAME CONFIGURATION / NAP</span><h2 id="uid-custom-dialog-title">Edit UID Custom</h2></div>
                            <button type="button" className="sunbringer-dialog__close" onClick={() => setIsUIDCustomDialogOpen(false)} aria-label="Close UID Custom editor"><X size={17} /></button>
                        </header>
                        <div className="sunbringer-dialog__body">
                            <p>Edit the custom UID list. Saving writes directly to the selected NAP client configuration file.</p>
                            <div className="offsets-dialog__path"><span>FILE TARGET</span><code>{uidCustomFilePath}</code></div>
                            <div className="offsets-editor__toolbar">
                                <span>{isLoadingUIDCustom ? "READING FILE…" : uidCustomError ? "FILE ERROR" : uidCustomContent !== savedUIDCustomContent ? "UNSAVED CHANGES" : "FILE LOADED"}</span>
                                <button type="button" onClick={() => {
                                    if (uidCustomContent !== savedUIDCustomContent && !window.confirm("Discard unsaved changes and reload uid_custom.txt?")) return
                                    void loadUIDCustomFile()
                                }} disabled={isLoadingUIDCustom || isSavingUIDCustom}><RotateCcw size={13} />Reload</button>
                            </div>
                            {uidCustomError && <div className="offsets-editor__error" role="alert">{uidCustomError}</div>}
                            <textarea className="offsets-editor__input" spellCheck={false} value={uidCustomContent} onChange={(event) => setUIDCustomContent(event.target.value)} placeholder={isLoadingUIDCustom ? "Loading uid_custom.txt…" : "File contents will appear here"} disabled={isLoadingUIDCustom || Boolean(uidCustomError)} aria-label="uid_custom.txt contents" />
                            <div className="sunbringer-dialog__actions offsets-dialog__actions">
                                <button type="button" className="sunbringer-dialog__button sunbringer-dialog__button--outline" onClick={async () => {
                                    try {
                                        await navigator.clipboard.writeText(uidCustomFilePath)
                                        toast.success("UID Custom path copied")
                                    } catch {
                                        toast.error("Could not copy the UID Custom path")
                                    }
                                }}><Copy size={15} />Copy path</button>
                                <button type="button" className="sunbringer-dialog__button sunbringer-dialog__button--primary" onClick={() => void saveUIDCustomFile()} disabled={isLoadingUIDCustom || isSavingUIDCustom || Boolean(uidCustomError) || uidCustomContent === savedUIDCustomContent}><FileText size={15} />{isSavingUIDCustom ? "Saving…" : "Save changes"}</button>
                                <button type="button" className="sunbringer-dialog__button sunbringer-dialog__button--outline" onClick={async () => {
                                    const [ok, message] = await FSService.OpenFolder(await FSService.GetDir(uidCustomFilePath))
                                    if (!ok) toast.error(message || "Could not open the UID Custom folder")
                                }}><FolderOpen size={15} />Show folder</button>
                            </div>
                        </div>
                    </section>
                </div>
            )}
            <UpdateModal
                isOpen={isOpenDownloadDataModal}
                onClose={() => setIsOpenDownloadDataModal(false)}
                title="Prepare NAP"
                message={
                    !updateData.server.isExists
                        ? "The Remielle server source or Zig compiler is missing. Download and build it to continue."
                        : gameDir
                            ? "The NAP patch must be installed in the selected game folder. Existing launcher and DLL files will be backed up."
                            : "Select the game file and folder before installing the NAP patch."
                }
                buttons={[
                    {
                        text: "Install",
                        onClick: handlerUpdateData,
                        variant: "primary",
                        disabled: isDownloading
                    }
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
                        className="profile-dialog profile-dialog--name"
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
                                <span className="eyebrow">OPERATOR PROFILE / IDENTITY</span>
                                <h2 id="profile-dialog-title">Field callsign</h2>
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
                            <div className="profile-dialog__identity">
                                <div className="profile-dialog__avatar"><Sparkles size={29} /></div>
                                <div><span>CALLSIGN PREVIEW</span><strong>{userNameDraft.trim() || "Rookie"}</strong><small>NEW ERIDU / FIELD OPERATIVE</small></div>
                                <div className="profile-dialog__identity-mark">01</div>
                            </div>
                            <div className="profile-dialog__body">
                                <p>Set the callsign displayed in your launcher status and operator profile.</p>
                                <label htmlFor="profile-name" className="profile-dialog__label">OPERATOR CALLSIGN</label>
                                <input
                                    id="profile-name"
                                    autoFocus
                                    maxLength={32}
                                    value={userNameDraft}
                                    onChange={(event) => setUserNameDraft(event.target.value)}
                                    placeholder="Enter callsign"
                                />
                                <div className="profile-dialog__hint">
                                    <span>Visible on your Sunbringer profile</span>
                                    <span>{userNameDraft.length}/32</span>
                                </div>
                            </div>
                            <footer className="profile-dialog__footer">
                                <button type="button" className="profile-dialog__cancel" onClick={() => setIsUserNameDialogOpen(false)}>
                                    Cancel
                                </button>
                                <button type="submit" className="profile-dialog__save" disabled={!userNameDraft.trim()}>
                                    <Sparkles size={15} /> Save callsign
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
