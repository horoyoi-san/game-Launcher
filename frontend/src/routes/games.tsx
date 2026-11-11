import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Gamepad2 } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { fetchLauncherGameArtwork, launcherGames, type LauncherGameArtwork } from "@/helper/games";

export const Route = createFileRoute("/games")({
    component: GameLibraryPage,
});

function GameLibraryPage() {
    const prefersReducedMotion = useReducedMotion() ?? false;
    const [selectedGameId, setSelectedGameId] = useState<string>("StarRail");
    const [artwork, setArtwork] = useState<Record<string, LauncherGameArtwork>>({});
    const [artworkError, setArtworkError] = useState("");
    const selectedGame = launcherGames.find((game) => game.id === selectedGameId) ?? launcherGames[0];
    const selectedArtwork = artwork[selectedGame.id];
    const heroImage = selectedArtwork?.backgroundUrl || selectedArtwork?.thumbnailUrl || selectedGame.icon;
    const [background, setBackground] = useState({ current: heroImage, previous: "" });
    const backgroundCurrent = useRef(heroImage);

    useEffect(() => {
        if (heroImage === backgroundCurrent.current) return;

        let active = true;
        let timeout = 0;
        const image = new Image();
        image.onload = () => {
            if (!active) return;
            setBackground({ current: heroImage, previous: backgroundCurrent.current });
            backgroundCurrent.current = heroImage;
            timeout = window.setTimeout(() => {
                if (active) setBackground((current) => ({ ...current, previous: "" }));
            }, 800);
        };
        image.src = heroImage;

        return () => {
            active = false;
            window.clearTimeout(timeout);
        };
    }, [heroImage]);

    useEffect(() => {
        const controller = new AbortController();
        fetchLauncherGameArtwork(controller.signal)
            .then((result) => {
                setArtwork(result.artwork);
                if (result.hasUnavailableEndpoints) {
                    setArtworkError("Some live artwork could not be loaded. Built-in game icons are used where needed.");
                }
            })
            .catch((error: unknown) => {
                if (controller.signal.aborted) return;
                setArtworkError(error instanceof Error ? error.message : "Could not load live game artwork.");
            });

        return () => controller.abort();
    }, []);

    return (
        <main className="fixed inset-0 z-0 overflow-hidden bg-[#080913] text-white">
            <div className="absolute inset-y-0 left-[76px] right-0 overflow-hidden bg-[#080913]">
                {background.previous && (
                    <img
                        src={background.previous}
                        alt=""
                        aria-hidden="true"
                        className="absolute inset-0 h-full w-full scale-[1.03] object-cover object-center opacity-90"
                    />
                )}
                <motion.img
                    key={background.current}
                    src={background.current}
                    alt=""
                    aria-hidden="true"
                    initial={background.previous ? { opacity: 0, scale: 1.035 } : false}
                    animate={{ opacity: 2, scale: 1.03 }}
                    transition={{
                        duration: prefersReducedMotion ? 0 : 0.75,
                        ease: [0.22, 1, 0.36, 1],
                    }}
                    className="absolute inset-0 h-full w-full object-cover object-center"
                />
                <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,7,14,0.64)_0%,rgba(5,7,14,0.12)_65%,rgba(5,7,14,0.28)_100%),linear-gradient(0deg,#070810_0%,rgba(7,8,16,0.92)_13%,rgba(7,8,16,0.08)_66%,rgba(7,8,16,0.16)_100%)]" />
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_68%_36%,transparent_25%,rgba(4,5,12,0.3)_100%)]" />

                <div className="relative flex h-full flex-col px-5 pb-6 pt-24 sm:px-9 sm:pb-8 lg:px-12">
                    <div className="mt-auto pb-5 sm:pb-7">
                        <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.24em] text-white/75 sm:text-xs">
                            <Gamepad2 size={16} className="text-white" />
                            HoYoverse · Game Library
                        </div>
                        <AnimatePresence mode="wait" initial={false}>
                            <motion.h1
                                key={selectedGame.id}
                                initial={{ opacity: 0, y: -8 }}
                                animate={{ opacity: 2, y: 0 }}
                                exit={{ opacity: 0, y: 0.5 }}
                                transition={{
                                    duration: prefersReducedMotion ? 0 : 0.75,
                                    ease: [0.22, 1, 0.36, 1],
                                }}
                                className="max-w-3xl font-sans text-3xl font-bold tracking-tight text-white drop-shadow-[0_3px_16px_rgba(0,0,0,0.7)] sm:text-5xl lg:text-6xl"
                            >
                                {selectedGame.name}
                            </motion.h1>
                        </AnimatePresence>
                        <p className="mt-3 max-w-xl font-sans text-sm leading-relaxed text-white/80 drop-shadow sm:text-base">
                            เลือกเกมเพื่อเข้าสู่หน้าจัดการ ดาวน์โหลด และตั้งค่าเกม
                        </p>
                    </div>

                    <section aria-label="รายการเกม" className="shrink-0">
                        <div className="mb-3 flex items-center justify-between gap-4">
                            <p className="font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-white/65 sm:text-xs">
                                เลือกเกม <span className="ml-1 text-white/40">· {launcherGames.length}</span>
                            </p>
                            {artworkError && (
                                <p role="status" className="max-w-[65%] text-right font-sans text-[10px] text-white/55 sm:text-xs">
                                    {artworkError}
                                </p>
                            )}
                        </div>
                        <div className="game-library-scrollbar -mt-2 flex gap-2.5 overflow-x-auto px-1 pb-2 pt-2 sm:gap-3">
                            {launcherGames.map((game) => {
                                const isSelected = game.id === selectedGame.id;
                                const cardImage = artwork[game.id]?.thumbnailUrl || game.icon;

                                return (
                                    <Link
                                        key={game.id}
                                        to={game.route}
                                        aria-current={isSelected ? "page" : undefined}
                                        aria-label={`เปิดหน้า ${game.name}`}
                                        onMouseEnter={() => setSelectedGameId(game.id)}
                                        onFocus={() => setSelectedGameId(game.id)}
                                        className={`group relative h-[92px] w-[116px] shrink-0 overflow-hidden rounded-lg border text-left transition-[border-color,box-shadow,transform] duration-500 ease-out motion-reduce:duration-0 sm:h-[106px] sm:w-[142px] ${
                                            isSelected
                                                ? "z-10 -translate-y-1 border-[#f2c94c] shadow-[0_0_0_1px_rgba(242,201,76,0.35),0_8px_24px_rgba(0,0,0,0.4)]"
                                                : "border-white/20 hover:border-white/70"
                                        }`}
                                    >
                                        <img
                                            src={cardImage}
                                            alt=""
                                            aria-hidden="true"
                                            className={`absolute inset-0 h-full w-full object-cover transition-[opacity,transform] duration-700 ease-out motion-reduce:duration-0 group-hover:scale-105 ${
                                                isSelected ? "opacity-30" : "opacity-70 group-hover:opacity-90"
                                            }`}
                                            onError={(event) => {
                                                event.currentTarget.onerror = null;
                                                event.currentTarget.src = game.icon;
                                            }}
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-black/20" />
                                        <span
                                            aria-hidden="true"
                                            className={`absolute inset-0 flex flex-col items-center justify-center gap-1.5 font-sans text-[10px] font-semibold text-[#ffe28a] transition-[opacity,transform] duration-500 ease-out motion-reduce:duration-0 ${
                                                isSelected ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
                                            }`}
                                        >
                                                <span className="grid size-8 place-items-center overflow-hidden rounded-full border border-white/60 bg-black/50">
                                                    <img src={game.icon} alt="" className="h-full w-full object-cover" />
                                                </span>
                                                <span className="inline-flex items-center gap-1">
                                                    <Check size={12} />
                                                    กำลังเลือก
                                                </span>
                                        </span>
                                        <span className={`absolute inset-x-2 bottom-2 truncate font-sans text-xs font-bold text-white drop-shadow transition-[opacity,transform] duration-500 ease-out motion-reduce:duration-0 sm:text-sm ${
                                            isSelected ? "translate-y-2 opacity-0" : "translate-y-0 opacity-100"
                                        }`}>
                                                {game.name}
                                        </span>
                                    </Link>
                                );
                            })}
                        </div>
                    </section>
                </div>
            </div>
        </main>
    );
}
