import { Link } from '@tanstack/react-router';
import { useEffect, useState } from "react";

export default function HowToPage() {

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
            setBgUrl("/video3.mp4"); // หรือ videos[0].src ของ Launcher
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
    <div className="
      relative z-60
      w-full max-w-6xl
      ml-24 mt-10
      bg-white/10 backdrop-blur-2xl
      shadow-[0_0_40px_rgba(0,0,0,0.6)]
      rounded-3xl
      p-6 md:p-10
      space-y-8
      border border-white/20
      text-white
    ">

      <h1 className="text-4xl font-bold text-center text-purple-300">
        How to Use
      </h1>

{/* 📥 Sophon */}
<div className="bg-indigo-500/10 border border-indigo-400/30 p-6 rounded-xl">
  <h2 className="text-xl font-bold text-indigo-300 mb-4 flex items-center gap-2">
    📥 ดาวน์โหลดไฟล์เกม
  </h2>

      <div className="space-y-2 text-sm text-indigo-200">
        <p>
          1. ดาวน์โหลด{" "}
          <a
            href="https://github.com/horoyoi-san/Hoyo/releases/download/Sophon.Downloader/Sophon.Downloader.zip"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-blue-400 underline hover:text-blue-300"
          >
            Sophon Downloader
          </a>{" "}
          หรือโหลดได้ที่หน้า Home ตรงขีด 3 ขีด
        </p>

        <p>2. แตกไฟล์ลงใน:</p>
        <code className="block bg-black/40 px-2 py-1 rounded text-xs">
          /Sophon ต้องอยู่ด้วยกันกับ Silwerwolf-launcher.exe
        </code>

        <p>ในโฟลเดอร์ควรมี:</p>
        <pre className="block bg-black/40 px-2 py-2 rounded text-xs text-indigo-200">
        {` 
        ├── Silwerwolf-launcher.exe
        └── Sophon
            └── net9.0
                └── sophon.download.exe
        `}
        </pre>

        <p>3. ตรวจสอบไฟล์:</p>
        <code className="block bg-black/40 px-2 py-1 rounded text-xs">
          sophon.downloader.exe
        </code>

        <p>
          4. เปิด Launcher แล้วกด{" "}
          <span className="font-semibold">Download Game</span>
        </p>
      </div>

      <div className="mt-3 text-xs text-indigo-400">
        ⚠️ Sophon ต้องอยู่ด้วยกันกับ Silwerwolf-launcher.exe เท่านั้น
      </div>
    </div>


      {/* 🔙 Back */}
      <div className="text-center pt-4">
        <Link
          to="/"
          className="btn btn-wide bg-black/30 border border-purple-400/30 text-white hover:bg-purple-500/30"
        >
          Back to Home
        </Link>
      </div>

    </div>
  </div>
);
}