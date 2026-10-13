import { useState } from "react"
import { AlertTriangle, Check, ChevronDown, ChevronUp, Copy, FileQuestion, HelpCircle, X } from "lucide-react"

export interface DiffErrorInfo {
    code?: string
    title?: string
    stage?: string
    message: string
    currentGameVersion?: string
    file?: string
    expectedMd5?: string
    actualMd5?: string
    fileSize?: number | string
    reason?: string
    suggestions?: string[]
    raw?: string
}

/**
 * Parses raw error strings or JSON payloads returned from DiffService into a clean, structured DiffErrorInfo.
 */
export function parseDiffError(errorStr: string, stageName?: string, _gameDir?: string): DiffErrorInfo {
    if (!errorStr) {
        return {
            title: "เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ",
            stage: stageName || "Diff Service",
            message: "ไม่พบข้อมูลข้อผิดพลาด",
            reason: "ระบบหยุดทำงานเนื่องจากเกิดข้อผิดพลาดในขั้นตอนการดำเนินการ",
            suggestions: ["กรุณาลองใหม่อีกครั้ง หรือตรวจสอบไฟล์เกม"],
            raw: "",
        }
    }

    // 1. Try parsing JSON payload from Go backend
    try {
        const parsed = JSON.parse(errorStr)
        if (parsed && typeof parsed === "object") {
            return {
                code: parsed.code || "DIFF_ERROR",
                title: parsed.title || "เกิดข้อผิดพลาดในการอัปเดตไฟล์",
                stage: parsed.stage || stageName || "Diff Service",
                message: parsed.message || errorStr,
                currentGameVersion: parsed.currentGameVersion,
                file: parsed.file || "BinaryVersion.bytes",
                expectedMd5: parsed.expectedMd5,
                actualMd5: parsed.actualMd5,
                fileSize: parsed.fileSize,
                reason: parsed.reason || "ข้อมูลไฟล์เกมไม่ตรงกับข้อกำหนดของไฟล์แพตช์",
                suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [
                    "ตรวจสอบว่าไฟล์ Patch อัปเดตจากเวอร์ชันใดไปยังเวอร์ชันใด",
                    "ตรวจสอบว่าเลือกโฟลเดอร์เกมถูกต้องหรือไม่",
                ],
                raw: parsed.message || errorStr,
            }
        }
    } catch {
        // Not a JSON string, fallback to pattern matching
    }

    // 2. Match MD5 mismatch error pattern:
    // "md5 mismatch for <path>: expected <hash>, got <hash>[, size=<size> bytes]"
    const md5Regex = /md5 mismatch for\s+(.*?):\s+expected\s+([a-fA-F0-9]+),\s+got\s+([a-fA-F0-9]+)(?:.*?size=(\d+))?/i
    const match = errorStr.match(md5Regex)

    if (match) {
        const filePath = match[1]
        const expected = match[2]
        const actual = match[3]
        const size = match[4]

        return {
            code: "VERSION_MD5_MISMATCH",
            title: "เวอร์ชันเกมไม่ตรงกับไฟล์แพตช์ (Version Mismatch)",
            stage: stageName || "Version Validate",
            file: filePath.includes("BinaryVersion") ? "StarRail_Data/StreamingAssets/BinaryVersion.bytes" : filePath,
            expectedMd5: expected,
            actualMd5: actual,
            fileSize: size ? `${size} bytes` : undefined,
            message: errorStr,
            reason: "ค่าตรวจสอบความถูกต้อง (MD5) ของไฟล์ระบุเวอร์ชันเกมไม่ตรงกัน หมายความว่าไฟล์แพตช์นี้ไม่ได้ถูกสร้างขึ้นสำหรับเวอร์ชันเกมปัจจุบันที่ติดตั้งในเครื่องของคุณ",
            suggestions: [
                "ตรวจสอบว่าไฟล์ Patch (.7z/.zip) ที่ดาวน์โหลดมา สร้างขึ้นสำหรับอัปเดตจากเวอร์ชันใด",
                "ตรวจสอบว่าเลือกโฟลเดอร์เกมที่ถูกต้องในขั้นตอนที่ 1",
                "หากไฟล์เกมเดิมในเครื่องถูกแก้ไขหรือเสียหาย แนะนำให้ตรวจสอบความสมบูรณ์ของไฟล์เกมเดิมก่อน",
            ],
            raw: errorStr,
        }
    }

    // 3. Match BinaryVersion not found
    if (errorStr.toLowerCase().includes("binaryversion file not found in patch")) {
        return {
            code: "PATCH_BINARY_NOT_FOUND",
            title: "ไฟล์แพตช์ไม่ถูกต้อง หรือไม่พบข้อมูลเวอร์ชัน",
            stage: stageName || "Version Validate",
            message: errorStr,
            reason: "ไม่พบไฟล์ BinaryVersion.bytes หรือ BinaryVersion.bytes.hdiff ภายในไฟล์แพตช์ที่เลือก",
            suggestions: [
                "ตรวจสอบว่าไฟล์ที่เลือกเป็นแพตช์อัปเดตของเกมที่ถูกต้อง (.7z, .zip, .rar)",
                "ตรวจสอบว่าไฟล์ดาวน์โหลดมาครบถ้วนและไม่เสียหาย",
            ],
            raw: errorStr,
        }
    }

    // 4. Fallback general error
    return {
        code: "DIFF_GENERAL_ERROR",
        title: "เกิดข้อผิดพลาดในขั้นตอน " + (stageName || "Patch"),
        stage: stageName || "Diff Service",
        message: errorStr,
        reason: "เกิดข้อผิดพลาดในการประมวลผลไฟล์",
        suggestions: [
            "ตรวจสอบว่ามีพื้นที่ว่างในดิสก์เพียงพอหรือไม่",
            "ปิดโปรแกรมเกมหรือโปรแกรมอื่นที่อาจเปิดใช้งานไฟล์ในโฟลเดอร์เกมอยู่",
            "ลองเปิดโปรแกรม Launcher ด้วยสิทธิ์ Administrator",
        ],
        raw: errorStr,
    }
}

interface DiffErrorModalProps {
    isOpen: boolean
    error: DiffErrorInfo | null
    onClose: () => void
}

export default function DiffErrorModal({ isOpen, error, onClose }: DiffErrorModalProps) {
    const [showTechnical, setShowTechnical] = useState(false)
    const [copied, setCopied] = useState(false)

    if (!isOpen || !error) return null

    const handleCopyTechnicalDetails = () => {
        const textToCopy = `=== Cyrene Launcher Diff Error Report ===
Stage: ${error.stage || "N/A"}
Error Code: ${error.code || "N/A"}
Title: ${error.title || "N/A"}
Current Game Version: ${error.currentGameVersion || "Unknown"}
Target File: ${error.file || "N/A"}
Expected MD5: ${error.expectedMd5 || "N/A"}
Actual MD5: ${error.actualMd5 || "N/A"}
File Size: ${error.fileSize || "N/A"}
Reason: ${error.reason || "N/A"}
Raw Message: ${error.raw || error.message || "N/A"}
========================================`

        navigator.clipboard.writeText(textToCopy).then(() => {
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        })
    }

    return (
        <div
            className="cyrene-dialog-overlay"
            style={{ zIndex: 150 }}
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) onClose()
            }}
        >
            <section
                className="cyrene-dialog cyrene-dialog--wide"
                style={{ width: "min(100%, 620px)", maxHeight: "90vh", display: "flex", flexDirection: "column" }}
                role="dialog"
                aria-modal="true"
                aria-labelledby="diff-error-dialog-title"
                tabIndex={-1}
                autoFocus
                onKeyDown={(event) => {
                    if (event.key === "Escape") onClose()
                }}
            >
                {/* Header */}
                <header className="cyrene-dialog__header" style={{ borderBottomColor: "rgba(244, 63, 94, 0.2)" }}>
                    <span
                        className="cyrene-dialog__icon"
                        style={{
                            borderColor: "rgba(244, 63, 94, 0.4)",
                            background: "linear-gradient(145deg, rgba(244, 63, 94, 0.22), rgba(225, 29, 72, 0.1))",
                            color: "#fb7185",
                        }}
                    >
                        <AlertTriangle size={22} />
                    </span>
                    <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span className="eyebrow" style={{ color: "#fda4af" }}>PATCH DIAGNOSTIC REPORT</span>
                            {error.stage && (
                                <span
                                    style={{
                                        fontSize: "10px",
                                        padding: "1px 8px",
                                        borderRadius: "999px",
                                        background: "rgba(244, 63, 94, 0.18)",
                                        color: "#fecdd3",
                                        border: "1px solid rgba(244, 63, 94, 0.3)",
                                    }}
                                >
                                    Stage: {error.stage}
                                </span>
                            )}
                        </div>
                        <h2 id="diff-error-dialog-title" style={{ color: "#fff1f2", fontSize: "17px" }}>
                            {error.title || "การอัปเดตไฟล์ล้มเหลว"}
                        </h2>
                    </div>
                    <button
                        type="button"
                        className="cyrene-dialog__close"
                        onClick={onClose}
                        aria-label="Close dialog"
                    >
                        <X size={17} />
                    </button>
                </header>

                {/* Body - Scrollable */}
                <div className="cyrene-dialog__body" style={{ overflowY: "auto", flex: 1, padding: "20px 24px" }}>
                    {/* Reason / Explanation Card */}
                    <div
                        style={{
                            background: "rgba(225, 29, 72, 0.08)",
                            border: "1px solid rgba(244, 63, 94, 0.25)",
                            borderRadius: "14px",
                            padding: "14px 16px",
                            marginBottom: "16px",
                        }}
                    >
                        <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                            <div style={{ color: "#fb7185", marginTop: "2px", flexShrink: 0 }}>
                                <FileQuestion size={18} />
                            </div>
                            <div>
                                <strong style={{ color: "#ffe4e6", fontSize: "13px", display: "block", marginBottom: "4px" }}>
                                    สาเหตุที่ระบบตรวจพบ:
                                </strong>
                                <p style={{ margin: 0, color: "#fecdd3", fontSize: "12px", lineHeight: 1.6 }}>
                                    {error.reason || error.message}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Key Diagnostic Grid */}
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                            gap: "12px",
                            marginBottom: "16px",
                        }}
                    >
                        {/* Current Game Version */}
                        <div
                            style={{
                                background: "rgba(255, 255, 255, 0.03)",
                                border: "1px solid rgba(255, 255, 255, 0.08)",
                                borderRadius: "12px",
                                padding: "12px 14px",
                            }}
                        >
                            <span style={{ fontSize: "11px", color: "#a89eb6", display: "flex", alignItems: "center", gap: 6 }}>
                                <span>🎮</span> เวอร์ชันเกมปัจจุบันในเครื่อง
                            </span>
                            <div style={{ marginTop: "6px", fontSize: "14px", fontWeight: 700, color: "#f5d0fe", fontFamily: "monospace" }}>
                                {error.currentGameVersion || "ไม่สามารถระบุเวอร์ชันได้"}
                            </div>
                        </div>

                        {/* File that failed */}
                        <div
                            style={{
                                background: "rgba(255, 255, 255, 0.03)",
                                border: "1px solid rgba(255, 255, 255, 0.08)",
                                borderRadius: "12px",
                                padding: "12px 14px",
                            }}
                        >
                            <span style={{ fontSize: "11px", color: "#a89eb6", display: "flex", alignItems: "center", gap: 6 }}>
                                <span>📦</span> ไฟล์ที่ตรวจสอบความถูกต้อง
                            </span>
                            <div
                                title={error.file}
                                style={{
                                    marginTop: "6px",
                                    fontSize: "12px",
                                    fontWeight: 600,
                                    color: "#e2e8f0",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                    fontFamily: "monospace",
                                }}
                            >
                                {error.file ? error.file.split(/[\\/]/).pop() : "BinaryVersion.bytes"}
                            </div>
                        </div>
                    </div>

                    {/* Suggestions Section */}
                    {error.suggestions && error.suggestions.length > 0 && (
                        <div
                            style={{
                                background: "rgba(242, 217, 155, 0.05)",
                                border: "1px solid rgba(242, 217, 155, 0.2)",
                                borderRadius: "14px",
                                padding: "14px 16px",
                                marginBottom: "16px",
                            }}
                        >
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "10px" }}>
                                <HelpCircle size={16} style={{ color: "var(--cyrene-gold, #f2d99b)" }} />
                                <strong style={{ color: "#fff5fb", fontSize: "13px" }}>วิธีแก้ไขที่แนะนำ:</strong>
                            </div>
                            <ul style={{ margin: 0, paddingLeft: "18px", color: "#e2d9eb", fontSize: "12px", lineHeight: 1.7 }}>
                                {error.suggestions.map((suggestion, index) => (
                                    <li key={index} style={{ marginBottom: "4px" }}>
                                        {suggestion}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Collapsible Technical Details */}
                    <div
                        style={{
                            border: "1px solid rgba(255, 255, 255, 0.08)",
                            borderRadius: "12px",
                            overflow: "hidden",
                            background: "rgba(0, 0, 0, 0.2)",
                        }}
                    >
                        <button
                            type="button"
                            onClick={() => setShowTechnical(!showTechnical)}
                            style={{
                                width: "100%",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                padding: "11px 15px",
                                background: "none",
                                border: "none",
                                color: "#b9a9cb",
                                fontSize: "12px",
                                fontWeight: 600,
                                cursor: "pointer",
                                textAlign: "left",
                            }}
                        >
                            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span>🔍</span> ข้อมูลทางเทคนิค (Technical Details)
                            </span>
                            {showTechnical ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>

                        {showTechnical && (
                            <div style={{ padding: "0 15px 15px", borderTop: "1px solid rgba(255, 255, 255, 0.06)" }}>
                                <div style={{ display: "grid", gap: "8px", marginTop: "10px", fontSize: "11px" }}>
                                    {error.expectedMd5 && (
                                        <div>
                                            <span style={{ color: "#9ca3af", display: "block", marginBottom: "2px" }}>
                                                Expected MD5 (ค่าที่แพตช์ต้องการ):
                                            </span>
                                            <code
                                                style={{
                                                    display: "block",
                                                    padding: "6px 10px",
                                                    background: "rgba(0, 0, 0, 0.4)",
                                                    borderRadius: "6px",
                                                    color: "#34d399",
                                                    wordBreak: "break-all",
                                                    fontFamily: "monospace",
                                                }}
                                            >
                                                {error.expectedMd5}
                                            </code>
                                        </div>
                                    )}

                                    {error.actualMd5 && (
                                        <div>
                                            <span style={{ color: "#9ca3af", display: "block", marginBottom: "2px" }}>
                                                Actual MD5 (ค่าที่ได้จากเครื่องของคุณ):
                                            </span>
                                            <code
                                                style={{
                                                    display: "block",
                                                    padding: "6px 10px",
                                                    background: "rgba(0, 0, 0, 0.4)",
                                                    borderRadius: "6px",
                                                    color: "#f87171",
                                                    wordBreak: "break-all",
                                                    fontFamily: "monospace",
                                                }}
                                            >
                                                {error.actualMd5}
                                            </code>
                                        </div>
                                    )}

                                    {error.fileSize && (
                                        <div style={{ color: "#cbd5e1" }}>
                                            <span style={{ color: "#9ca3af" }}>File Size: </span>
                                            <span style={{ fontFamily: "monospace" }}>{error.fileSize}</span>
                                        </div>
                                    )}

                                    {error.raw && (
                                        <div>
                                            <span style={{ color: "#9ca3af", display: "block", marginBottom: "2px" }}>
                                                Raw Log:
                                            </span>
                                            <pre
                                                style={{
                                                    margin: 0,
                                                    padding: "8px 10px",
                                                    background: "rgba(0, 0, 0, 0.5)",
                                                    borderRadius: "6px",
                                                    color: "#94a3b8",
                                                    fontSize: "11px",
                                                    whiteSpace: "pre-wrap",
                                                    wordBreak: "break-all",
                                                    maxHeight: "100px",
                                                    overflowY: "auto",
                                                }}
                                            >
                                                {error.raw}
                                            </pre>
                                        </div>
                                    )}

                                    <button
                                        type="button"
                                        onClick={handleCopyTechnicalDetails}
                                        style={{
                                            marginTop: "8px",
                                            display: "inline-flex",
                                            alignItems: "center",
                                            gap: "6px",
                                            alignSelf: "flex-start",
                                            padding: "6px 12px",
                                            borderRadius: "8px",
                                            background: "rgba(255, 255, 255, 0.06)",
                                            border: "1px solid rgba(255, 255, 255, 0.12)",
                                            color: copied ? "#86efac" : "#e2d9eb",
                                            fontSize: "11px",
                                            cursor: "pointer",
                                        }}
                                    >
                                        {copied ? <Check size={14} /> : <Copy size={14} />}
                                        {copied ? "คัดลอกข้อมูลแล้ว!" : "คัดลอกข้อมูลทางเทคนิค"}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer Actions */}
                <div
                    className="cyrene-dialog__actions"
                    style={{
                        padding: "16px 24px",
                        borderTop: "1px solid rgba(255, 255, 255, 0.08)",
                        marginTop: 0,
                        justifyContent: "flex-end",
                    }}
                >
                    <button
                        type="button"
                        className="cyrene-dialog__button cyrene-dialog__button--primary"
                        onClick={onClose}
                        style={{ minWidth: "120px" }}
                    >
                        เข้าใจแล้ว
                    </button>
                </div>
            </section>
        </div>
    )
}
