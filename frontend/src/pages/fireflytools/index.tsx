import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export default function fireflytoolsPage() {

    // ✅ background state
    const [bgUrl, setBgUrl] = useState("");
    const [bgType, setBgType] = useState<"video" | "image">("image");

    useEffect(() => {
        // 1️⃣ โหลดค่าจาก localStorage (ค่าที่ Launcher ตั้งไว้ล่าสุด)
        const savedUrl = localStorage.getItem("customBgUrl");
        const savedType = localStorage.getItem("customBgType") as "video" | "image";

        if (savedUrl && savedType) {
            setBgUrl(savedUrl);
            setBgType(savedType);
        } else {
            // ถ้าไม่เคยตั้งค่า ให้ใช้ default ของ Launcher
            setBgUrl("/video2.mp4"); // หรือ videos[0].src ของ Launcher
            setBgType("video");
        }

        // 2️⃣ ฟัง event จาก Launcher
        const handleLauncherBgChange = (event: Event) => {
            const e = event as CustomEvent<{ url: string; type: "video" | "image" }>;
            if (e.detail?.url && e.detail?.type) {
                setBgUrl(e.detail.url);
                setBgType(e.detail.type);
            }
        };

        window.addEventListener("launcherBgChanged", handleLauncherBgChange);
        return () => window.removeEventListener("launcherBgChanged", handleLauncherBgChange);
    }, []);

    return (
        <div className="fixed inset-0 z-60 overflow-y-auto">

            {/* 🔥 Background */}
            {bgType === "video" ? (
                <video
                    className="fixed inset-0 z-0 w-full h-full object-cover"
                    autoPlay
                    loop
                    muted
                    playsInline
                >
                    <source src={bgUrl} type="video/mp4" />
                </video>
            ) : (
                <img
                    src={bgUrl}
                    className="fixed inset-0 z-0 w-full h-full object-cover"
                />
            )}

            {/* 🔥 overlay */}
            <div className="fixed inset-0 bg-black/50 backdrop-blur-md z-60" />

            {/* 🔥 content */}
            <div className="  relative z-60
  w-full max-w-6xl
  ml-24
  mt-10
  bg-white/10 backdrop-blur-2xl
  shadow-[0_0_40px_rgba(0,0,0,0.6)]
  rounded-3xl
  p-6 md:p-10
  space-y-8
  border border-white/20
  text-white
  transition-all duration-300">

                <h1 className="
                text-4xl font-bold text-center
                text-purple-300
                drop-shadow-[0_0_10px_rgba(255,0,150,0.8)]
                drop-shadow-[0_0_20px_rgba(255,0,150,0.6)]
                ">Cyrene Tools</h1>

                {/* ส่วนที่ 1: เกี่ยวกับ SR Tools */}
                <div className="bg-blue-50 border-l-4 border-blue-400 p-6 rounded-r-lg">
                    <h2 className="text-2xl font-bold text-blue-800 flex items-center gap-2 mb-4">
                        <span>ℹ️</span>
                        <span>เกี่ยวกับ Cyrene Tools</span>
                    </h2>
                    <div className="space-y-3 text-blue-700">
                        <div className="flex items-start gap-3">
                            <div className="text-blue-600 text-lg">🏠</div>
                            <p>
                                เว็บไซต์นี้เป็นอีกเวอร์ชันหนึ่งของ {" "}
                                <span className="font-semibold text-success">Cyrene Tools {" "}</span>
                                พัฒนาโดย {" "}
                                <span className="font-semibold text-accent">ฉัน {"(Horoyoi-san)"}</span>

                            </p>

                        </div>


                        <div className="flex items-start gap-3">

                            <div className="text-blue-600 text-lg">👨‍💻</div>

                            <p>เครื่องมือต้นฉบับถูกสร้างขึ้นโดยนักพัฒนาภายนอกชื่อ <span className="font-semibold text-accent">Amazing</span> เวอร์ชันนี้สร้างขึ้นโดยตรงจากงานนั้น โดยไม่มีการแก้ไขตรรกะหลัก</p>

                        </div>

                        <div className="flex items-start gap-3">

                            <div className="text-blue-600 text-lg">🔗</div>

                            <p>นอกจากนี้ยังมีเวอร์ชันที่ทันสมัยกว่าโดยผู้เขียนคนเดียวกันที่ {" "}

                                <a
                                    href="https://srtools.neonteam.dev/"
                                    className="link link-accent"
                                    target="_blank"
                                    rel="noopener noreferrer"

                                >
                                    srtools.neonteam.dev

                                </a>
                                {" "}และเวอร์ชันดั้งเดิมที่ {" "}

                                <a
                                    href="https://srtools.pages.dev/"
                                    className="link link-accent"
                                    target="_blank"
                                    rel="noopener noreferrer"

                                >
                                    srtools.pages.dev

                                </a>

                            </p>

                        </div>
                    </div>
                </div>

                {/* ส่วนที่ 2: คุณสมบัติหลัก */}
                <div className="bg-green-50 border-l-4 border-green-400 p-6 rounded-r-lg">

                    <h2 className="text-2xl font-bold text-green-800 flex items-center gap-2 mb-4">
                        <span>🔧</span>
                        <span>คุณสมบัติหลัก</span>

                    </h2>
                    <div className="space-y-3 text-green-700">
                        <div className="flex items-start gap-3">
                            <div className="text-green-600 text-lg">⚙️</div>
                            <p>ตั้งค่าตัวละคร กรวยแสง โบราณวัตถุ ร่องรอย และอีดอลอนได้ง่ายๆ ในเบราว์เซอร์ของคุณ</p>

                        </div>
                        <div className="flex items-start gap-3">
                            <div className="text-green-600 text-lg">🔌</div>

                            <p>ใช้การตั้งค่ากับ <span className="font-semibold text-accent">Cyrene GO Server</span> ได้ทันทีโดยใช้ <span className="font-semibold">Connect PS</span> — ไม่จำเป็นต้องอัปโหลดไฟล์ด้วยตนเอง</p>

                        </div>
                        <div className="flex items-start gap-3">
                            <div className="text-green-600 text-2xl">✨</div>
                            <div>
                                <h4 className="font-semibold text-green-800 text-lg">การตั้งค่าเพิ่มเติม</h4>
                                <p className="text-green-700 mt-1">
                                    เพิ่มประสิทธิภาพประสบการณ์การใช้งาน <span className="font-semibold text-accent">Cyrene GO Server</span> ของคุณด้วยคุณสมบัติพิเศษ:

                                </p>
                                <ul className="list-disc list-inside mt-2 space-y-1 text-green-700">
                                    <li>🎭 <span className="font-medium">ส่วนติดต่อผู้ใช้เกมที่ซ่อนอยู่</span> — ลบส่วนติดต่อผู้ใช้เกมทั้งหมด</li>
                                    <li>🚫 <span className="font-medium">ปิดการเซ็นเซอร์</span> — กำจัดตัวเซ็นเซอร์ Lens Flare 💀</li>
                                    <li>🧪 <span className="font-medium">โหมด Theorycraft</span> — กำหนดค่า HP, รอบการเล่น และอื่นๆ ผ่านทางเว็บ</li>
                                </ul>
                            </div>
                        </div>

                        <div className="flex items-start gap-3">

                            <div className="text-green-600 text-lg">📂</div>

                            <p>ส่งออกและนำเข้าบิลด์ทั้งหมดโดยใช้ <code className="bg-gray-200 px-2 py-1 rounded text-sm">freesr-data.json</code>.</p>
                        </div>
                        <div className="flex items-start gap-3">

                            <div className="text-green-600 text-lg">⚡</div>

                            <p>เวิร์กโฟลว์การทดสอบที่รวดเร็ว — ไม่มีการหน่วงเวลาในการซิงค์ อัปเดตในเกมได้ทันที</p>
                        </div>

                    </div>
                </div>

                {/* ส่วนที่ 3: เริ่มต้นใช้งาน */}
                <div className="bg-purple-50 border-l-4 border-purple-400 p-6 rounded-r-lg">
                    <h2 className="text-2xl font-bold text-purple-800 flex items-center gap-2 mb-4">
                        <span>🚀</span>
                        <span>เริ่มต้นใช้งาน</span>
                    </h2>
                    <div className="space-y-3 text-purple-700">
                        <div className="flex items-start gap-3">
                            <div className="text-purple-600 text-lg">1️⃣</div>
                            <p>เข้าถึงเครื่องมือผ่านเบราว์เซอร์ของคุณบนอินสแตนซ์ที่โฮสต์เอง</p>
                        </div>
                        <div className="flex items-start gap-3">
                            <div className="text-purple-600 text-lg">2️⃣</div>
                            <p>กำหนดค่าตัวละครของคุณสร้างสิ่งก่อสร้างของคุณด้วยอินเทอร์เฟซเว็บที่ใช้งานง่าย</p>

                        </div>

                        <div className="flex items-start gap-3">

                            <div className="text-purple-600 text-lg">3️⃣</div>

                            <p>ใช้ฟีเจอร์ <span className="font-semibold">Connect PS</span> เพื่อซิงค์กับเซิร์ฟเวอร์ส่วนตัวของคุณได้ทันที</p>

                        </div>
                        <div className="flex items-start gap-3">

                            <div className="text-purple-600 text-lg">4️⃣</div>

                            <p>ทดสอบสิ่งก่อสร้างของคุณในเกมด้วยการอัปเดตและการปรับเปลี่ยนแบบเรียลไทม์</p>

                        </div>

                    </div>

                </div>

                <div className="text-center pt-4">
                    <Link to="/" className="btn btn-wide bg-black/30 backdrop-blur-md border border-purple-400/30 text-white hover:bg-purple-500/30 hover:shadow-lg hover:shadow-purple-500/40 active:scale-95 transition">Back to Home</Link>
                </div>
            </div>
        </div>
    );
}