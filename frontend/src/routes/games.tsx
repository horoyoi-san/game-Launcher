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
            <div className="fixed inset-0 bg-gradient-to-br from-slate-950/90 via-slate-950/65 to-indigo-950/70" />

            <div className="relative min-h-full pl-24 pr-8 pt-20 sm:pl-28 sm:pr-12 sm:pt-24">
                <header className="mb-8 max-w-3xl">
                    <div className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.25em] text-cyan-200">
                        <Gamepad2 size={18} />
                        Game Library
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">เลือกเกมที่ต้องการ</h1>
                    <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/65 sm:text-base">
                        รวมเกมทั้งหมดไว้ในหน้าเดียว เลือกเกมเพื่อไปยังหน้าจัดการและดาวน์โหลดของเกมนั้น
                    </p>
                </header>

                <section aria-label="รายการเกม" className="grid grid-cols-1 gap-4 pb-10 sm:grid-cols-2 xl:grid-cols-3">
                    {launcherGames.map((game) => (
                        <Link
                            key={game.id}
                            to={game.route}
                            aria-label={`เปิดหน้า ${game.name}`}
                            className="group relative isolate flex min-h-52 overflow-hidden rounded-2xl border border-white/15 bg-white/5 shadow-xl transition duration-300 hover:-translate-y-1 hover:border-cyan-200/70 hover:shadow-cyan-950/50 sm:min-h-64"
                        >
                            <img
                                src={game.icon}
                                alt=""
                                className="absolute inset-0 -z-20 h-full w-full object-cover opacity-55 transition duration-500 group-hover:scale-105 group-hover:opacity-75"
                            />
                            <div className="absolute inset-0 -z-10 bg-gradient-to-t from-slate-950 via-slate-950/35 to-slate-900/10" />

                            <div className="flex w-full items-end justify-between gap-4 p-5 sm:p-6">
                                <div className="min-w-0">
                                    <div className="mb-3 flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl border border-white/20 bg-black/40 backdrop-blur-sm">
                                        <img src={game.icon} alt="" className="h-full w-full object-cover" />
                                    </div>
                                    <h2 className="text-xl font-bold drop-shadow sm:text-2xl">{game.name}</h2>
                                    <span className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-cyan-100">
                                        <Play size={14} fill="currentColor" />
                                        เปิดหน้าเกม
                                    </span>
                                </div>
                                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/25 bg-black/35 transition group-hover:border-cyan-200 group-hover:bg-cyan-300 group-hover:text-slate-950">
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
