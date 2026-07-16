import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export default function AboutPage() {

  // ✅ ต้องอยู่ใน component
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


  const socials = [
    {
      tooltip: "YouTude",
      href: "https://www.youtube.com/@hroyoi-san",
      img: "https://static.vecteezy.com/system/resources/previews/023/986/704/non_2x/youtube-logo-youtube-logo-transparent-youtube-icon-transparent-free-free-png.png",
      btnClass: "me-media-icon media-list"
    },
    {
      tooltip: "TikTok",
      href: "https://www.tiktok.com/@horoyoi.san2",
      img: "https://static.vecteezy.com/system/resources/previews/018/930/463/non_2x/tiktok-logo-tikok-icon-transparent-tikok-app-logo-free-png.png",
      btnClass: "me-media-icon media-list"
    },
    {
      tooltip: "discord",
      href: "https://discord.gg/gwCwxTB9Du",
      img: "https://images-eds-ssl.xboxlive.com/image?url=4rt9.lXDC4H_93laV1_eHHFT949fUipzkiFOBH3fAiZZUCdYojwUyX2aTonS1aIwMrx6NUIsHfUHSLzjGJFxxsG72wAo9EWJR4yQWyJJaDaK1XdUso6cUMpI9hAdPUU_FNs11cY1X284vsHrnWtRw7oqRpN1m9YAg21d_aNKnIo-&format=source&h=210",
      btnClass: "me-media-icon media-list"
    },
    {
      tooltip: "GitHub Horoyoi-san",
      href: "https://github.com/horoyoi-san",
      img: "https://raw.githubusercontent.com/horoyoi-san/game-Launcher/refs/heads/cyrene-launcher/frontend/public/icon/github-white-icon.webp",
      btnClass: "me-media-icon media-list"
    }
  ];

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
                ">About</h1>

                <div className="space-y-4 text-white">

                <p className="text-lg leading-relaxed">
                สวัสดีครับ! ผมคือ <span className="font-semibold text-error">Horoyoi-san</span> นักพัฒนาที่หลงใหลในการสร้างเครื่องมือที่มีประโยชน์และปรับปรุงประสบการณ์ผู้ใช้

                </p>
                <p className="text-lg leading-relaxed">
                ผมได้สร้าง <span className="font-semibold text-success">Game Launcher</span> ที่มีน้ำหนักเบาและทันสมัย ​​เพื่อช่วยให้ผู้ใช้สามารถเปิดและจัดการเกมของตนได้ง่ายขึ้น ด้วยประสิทธิภาพและความเรียบง่ายที่ดียิ่งขึ้น

                </p>
                <p className="text-lg leading-relaxed">
                ตัวเปิดเกมนี้สร้างขึ้นโดยใช้ <span className="font-mono text-info">Go + Wails3</span> พร้อมด้วยอินเทอร์เฟซที่สะอาดตาและตอบสนองได้ดี ซึ่งตกแต่งด้วย <span className="text-accent">Tailwind CSS</span> และ <span className="text-accent">DaisyUI</span>

                </p>

                <p className="text-lg leading-relaxed">
                เป้าหมายของฉันคือการสร้างเครื่องมือที่รวดเร็ว มีประสิทธิภาพ และใช้งานได้อย่างเพลิดเพลิน และตัวเรียกใช้งานนี้เป็นเพียงจุดเริ่มต้นเท่านั้น

                </p>

                </div>

        {/* Social */}
        <div className="flex justify-center gap-4 pt-4">
          {socials.map((item, index) => (
            <a
              key={index}
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              className={item.btnClass}
            >
              <img src={item.img} className="w-8 h-8" />
            </a>
          ))}
        </div>

        <div className="text-center pt-4">
          <Link to="/" className="btn btn-wide bg-black/30 backdrop-blur-md text-white">
            Back to Home
          </Link>
        </div>

      </div>
    </div>
  );
}
