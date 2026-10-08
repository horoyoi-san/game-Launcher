import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Gamepad2, Play } from "lucide-react";
import { launcherGames } from "@/helper/games";

export const Route = createFileRoute("/games")({
    component: GameLibraryPage,
});

function GameLibraryPage() {
    return (
        <main className="fixed inset-0 z-0 overflow-y-auto bg-slate-950 text-white">
            <video
                className="fixed inset-0 h-full w-full object-cover"
                src="/video3.mp4"
                autoPlay
                loop
                muted
                playsInline
                aria-hidden="true"
            />
            <div className="fixed inset-0 bg-gradient-to-br from-[#080a12]/95 via-[#101323]/75 to-[#1a1030]/75" />

            <div className="relative min-h-full pl-24 pr-8 pt-20 sm:pl-28 sm:pr-12 sm:pt-24">
                <header className="arcade-frame mb-8 max-w-3xl p-5 sm:p-7">
                    <div className="arcade-kicker mb-3 flex items-center gap-2">
                        <Gamepad2 size={18} />
                        Silver Wolf Arcade · Player Select
                    </div>
                    <h1 className="text-2xl font-black uppercase tracking-[0.08em] text-white drop-shadow-[3px_3px_0_rgba(250,77,255,0.55)] sm:text-4xl">Game Library <span className="text-cyan-200">/</span> เลือกเกม</h1>
                    <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/65 sm:text-base">
                        รวมเกมทั้งหมดไว้ในหน้าเดียว เลือกเกมเพื่อไปยังหน้าจัดการและดาวน์โหลดของเกมนั้น
                    </p>
                    <div className="mt-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-lime-200/80">
                        <span className="size-2 animate-pulse bg-lime-300" />
                        Player 1 · LV.999 · Select a world
                    </div>
                </header>

                <section aria-label="รายการเกม" className="grid grid-cols-1 gap-4 pb-10 sm:grid-cols-2 xl:grid-cols-3">
                    {launcherGames.map((game) => (
                        <Link
                            key={game.id}
                            to={game.route}
                            aria-label={`เปิดหน้า ${game.name}`}
                            className="group relative isolate flex min-h-52 overflow-hidden border-2 border-white/20 bg-[#101323] shadow-[5px_5px_0_rgba(0,0,0,0.7)] transition duration-150 hover:-translate-y-1 hover:border-cyan-200 hover:shadow-[5px_5px_0_rgba(250,77,255,0.5)] sm:min-h-64"
                        >
                            <img
                                src={game.icon}
                                alt=""
                                className="absolute inset-0 -z-20 h-full w-full object-cover opacity-55 transition duration-500 group-hover:scale-105 group-hover:opacity-75"
                            />
                            <div className="absolute inset-0 -z-10 bg-gradient-to-t from-[#080a12] via-[#080a12]/45 to-[#101323]/10" />

                            <div className="flex w-full items-end justify-between gap-4 p-5 sm:p-6">
                                <div className="min-w-0">
                                    <div className="mb-3 flex h-11 w-11 items-center justify-center overflow-hidden border-2 border-cyan-200/60 bg-black/70">
                                        <img src={game.icon} alt="" className="h-full w-full object-cover [image-rendering:pixelated]" />
                                    </div>
                                    <h2 className="text-lg font-black uppercase tracking-wide drop-shadow sm:text-xl">{game.name}</h2>
                                    <span className="mt-2 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-cyan-100">
                                        <Play size={14} fill="currentColor" />
                                        Start game
                                    </span>
                                </div>
                                <span className="flex h-10 w-10 shrink-0 items-center justify-center border-2 border-white/25 bg-black/60 transition group-hover:border-cyan-200 group-hover:bg-cyan-300 group-hover:text-slate-950">
                                    <ArrowRight size={18} />
                                </span>
                            </div>
                        </Link>
                    ))}
                </section>
            </div>
        </main>
    );
}
