import { DiagnosticErrorInfo } from "@/stores/modalStore"

/**
 * Diagnoses errors when launching the game.
 */
export function diagnoseGameError(errorStr: string, gamePath?: string): DiagnosticErrorInfo {
    const lower = (errorStr || "").toLowerCase()
    const fileName = gamePath ? gamePath.split(/[\\/]/).pop() : "StarRail.exe / launcher.exe"

    if (lower.includes("cannot find") || lower.includes("not found") || lower.includes("no such file")) {
        return {
            category: "game",
            stage: "Start Game",
            title: "ไม่พบไฟล์เปิดเกม (Game Executable Not Found)",
            reason: `ระบบไม่พบไฟล์เปิดเกม (${fileName}) ในตำแหน่งที่ตั้งค่าไว้ ไฟล์อาจถูกย้าย ลบ หรือชื่อโฟลเดอร์เปลี่ยนไป`,
            items: [
                { label: "ไฟล์ที่พยายามเปิด", value: gamePath || "ไม่ระบุตำแหน่ง", isHighlight: true, icon: "📁" },
                { label: "สถานะ", value: "ไม่พบไฟล์ในดิสก์", icon: "❌" },
            ],
            suggestions: [
                "ตรวจสอบตำแหน่งที่ติดตั้งเกมว่าไฟล์ยังอยู่จริงหรือไม่",
                "คลิกเลือกโฟลเดอร์หรือไฟล์เกมใหม่อีกครั้งผ่านหน้าหลักของ Launcher",
                "ตรวจสอบว่า Windows Defender หรือ Antivirus เผลอลบไฟล์ตัวเกมไปหรือไม่",
            ],
            technical: errorStr,
        }
    }

    if (lower.includes("access is denied") || lower.includes("permission denied")) {
        return {
            category: "game",
            stage: "Start Game",
            title: "สิทธิ์การเข้าถึงไม่เพียงพอ (Permission Denied)",
            reason: "ระบบปฏิบัติการไม่อนุญาตให้เปิดตัวเกม อาจเกิดจากข้อจำกัดสิทธิ์ Administrator หรือไฟล์กำลังถูกโปรแกรมอื่นล็อกไว้",
            items: [
                { label: "ไฟล์เกม", value: gamePath || "Game Executable", isHighlight: true, icon: "🎮" },
                { label: "ข้อผิดพลาด", value: "Access Denied (ถูกปฏิเสธการเข้าถึง)", icon: "🔒" },
            ],
            suggestions: [
                "คลิกขวาที่ตัว Launcher แล้วเลือก 'Run as administrator' (รันในฐานะผู้ดูแลระบบ)",
                "ตรวจสอบว่าตัวเกมไม่ได้เปิดค้างอยู่ใน Task Manager",
                "ตรวจสอบสิทธิ์ของโฟลเดอร์เกมใน Windows Explorer",
            ],
            technical: errorStr,
        }
    }

    return {
        category: "game",
        stage: "Start Game",
        title: "ไม่สามารถเปิดตัวเกมได้ (Failed to Start Game)",
        reason: "เกิดข้อผิดพลาดในการสั่งรันโปรแกรมตัวเกมจากระบบปฏิบัติการ",
        items: [
            { label: "เป้าหมายที่เปิด", value: gamePath || "Game Executable", icon: "🎮" },
        ],
        suggestions: [
            "ลองรันโปรแกรม Launcher ในฐานะผู้ดูแลระบบ (Run as Administrator)",
            "ตรวจสอบว่าเครื่องของคุณติดตั้ง Visual C++ Redistributable และ DirectX ครบถ้วน",
            "ปิดโปรแกรม Antivirus ชั่วคราว หรือเพิ่มโฟลเดอร์เกมเข้าไปในรายการยกเว้น (Exclusion)",
        ],
        technical: errorStr,
    }
}

/**
 * Diagnoses errors when starting Proxy.
 */
export function diagnoseProxyError(errorStr: string, proxyPath?: string): DiagnosticErrorInfo {
    const lower = (errorStr || "").toLowerCase()

    if (lower.includes("port") || lower.includes("address already in use") || lower.includes("bind")) {
        return {
            category: "proxy",
            stage: "Start Proxy",
            title: "พอร์ตเชื่อมต่อถูกใช้งานอยู่ (Port Conflict)",
            reason: "ระบบไม่สามารถเปิด Proxy ได้เนื่องจาก Port เครือข่ายกำลังถูกโปรแกรมอื่น (หรือ Proxy ตัวเก่าที่ค้างอยู่) ใช้งานอยู่",
            items: [
                { label: "บริการ", value: "Proxy Server", icon: "🌐" },
                { label: "สาเหตุ", value: "Port Collision / Already In Use", icon: "⚠️" },
            ],
            suggestions: [
                "เปิด Task Manager แล้วค้นหาโปรแกรม Proxy หรือ mitmproxy เก่าที่อาจค้างอยู่เพื่อ End Task",
                "ปิดโปรแกรม VPN, Fiddler, หรือ Proxy ตัวอื่นที่อาจเปิดใช้งานอยู่",
                "รีสตาร์ทเครื่องคอมพิวเตอร์ของคุณแล้วลองเปิดใหม่อีกครั้ง",
            ],
            technical: errorStr,
        }
    }

    if (lower.includes("not found") || lower.includes("cannot find")) {
        return {
            category: "proxy",
            stage: "Start Proxy",
            title: "ไม่พบไฟล์โปรแกรม Proxy (Proxy File Missing)",
            reason: "ไฟล์โปรแกรม Proxy สูญหายหรือยังไม่ได้ถูกดาวน์โหลดลงมาที่เครื่อง",
            items: [
                { label: "ตำแหน่งที่มองหา", value: proxyPath || "Proxy Directory", icon: "📁" },
            ],
            suggestions: [
                "ไปที่เมนูตั้งค่าหรือหน้าหลักเพื่อดาวน์โหลดคอมโพเนนต์ Proxy ใหม่อีกครั้ง",
                "ตรวจสอบว่าโฟลเดอร์ bin/proxy มีไฟล์ครบถ้วนหรือไม่",
            ],
            technical: errorStr,
        }
    }

    return {
        category: "proxy",
        stage: "Start Proxy",
        title: "ไม่สามารถเริ่มทำงาน Proxy ได้ (Failed to Start Proxy)",
        reason: "เกิดข้อผิดพลาดในการเริ่มต้นเซอร์วิส Proxy สำหรับการเชื่อมต่อ",
        items: [
            { label: "ไฟล์ Proxy", value: proxyPath || "Proxy Executable", icon: "🌐" },
        ],
        suggestions: [
            "รัน Launcher ด้วยสิทธิ์ Administrator",
            "ตรวจสอบการตั้งค่า Windows Firewall หรือ Antivirus",
        ],
        technical: errorStr,
    }
}

/**
 * Diagnoses errors when starting Server.
 */
export function diagnoseServerError(errorStr: string): DiagnosticErrorInfo {
    const lower = (errorStr || "").toLowerCase()

    return {
        category: "server",
        stage: "Start Server",
        title: "ไม่สามารถเปิด HKRPG Server ได้ (Failed to Start Server)",
        reason: lower.includes("port")
            ? "พอร์ตของเซิร์ฟเวอร์ชนกับโปรแกรมอื่น หรือมีเซิร์ฟเวอร์ตัวเดิมเปิดค้างอยู่"
            : "เกิดข้อผิดพลาดในการสั่งทำงานกระบวนการ HKRPG Server",
        items: [
            { label: "บริการ", value: "HKRPG Local Server", icon: "🖥️" },
        ],
        suggestions: [
            "ตรวจสอบใน Task Manager ว่ามีโพรเซส Server เดิมเปิดค้างอยู่หรือไม่",
            "ตรวจสอบว่าไฟล์ของเซิร์ฟเวอร์ในโฟลเดอร์โปรแกรมครบถ้วน",
            "รัน Launcher ด้วยสิทธิ์ Administrator",
        ],
        technical: errorStr,
    }
}

/**
 * Diagnoses errors in Language / Localization page.
 */
export function diagnoseLanguageError(errorStr: string, gameDir?: string, stage?: string): DiagnosticErrorInfo {
    const lower = (errorStr || "").toLowerCase()

    if (lower.includes("not found") || lower.includes("designdata")) {
        return {
            category: "language",
            stage: stage || "Read Language",
            title: "ไม่พบข้อมูลภาษาของตัวเกม (Language Assets Missing)",
            reason: "ระบบไม่พบโฟลเดอร์ StarRail_Data/StreamingAssets/DesignData/Windows ในโฟลเดอร์เกมที่เลือก",
            items: [
                { label: "โฟลเดอร์เกม", value: gameDir || "ไม่ระบุโฟลเดอร์", icon: "📁" },
                { label: "สิ่งที่ค้นหา", value: "DesignData/Windows", icon: "🔍" },
            ],
            suggestions: [
                "ตรวจสอบว่าเลือกโฟลเดอร์เกมหลักที่มีโฟลเดอร์ StarRail_Data อยู่ด้านใน",
                "ตรวจสอบว่าตัวเกมได้ทำการติดตั้งข้อมูล Asset ครบถ้วนแล้วหรือไม่",
            ],
            technical: errorStr,
        }
    }

    return {
        category: "language",
        stage: stage || "Language Mod",
        title: "เกิดข้อผิดพลาดเกี่ยวกับระบบภาษา (Language Setting Error)",
        reason: "ไม่สามารถอ่านหรือปรับเปลี่ยนไฟล์ภาษาของเกมได้",
        items: [
            { label: "โฟลเดอร์เกม", value: gameDir || "Game Directory", icon: "🌐" },
        ],
        suggestions: [
            "ปิดตัวเกมก่อนทำการสลับภาษาหรือติดตั้งแพตช์แปลไทย",
            "ตรวจสอบว่าโฟลเดอร์เกมไม่ได้ถูกตั้งค่าเป็น Read-only",
            "รัน Launcher ด้วยสิทธิ์ Administrator",
        ],
        technical: errorStr,
    }
}
