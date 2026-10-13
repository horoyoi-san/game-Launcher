import { useState } from "react"
import {
    AlertTriangle,
    Check,
    ChevronDown,
    ChevronUp,
    Copy,
    FileQuestion,
    Gamepad2,
    HelpCircle,
    Languages,
    Network,
    Server,
    X
} from "lucide-react"
import useModalStore from "@/stores/modalStore"

export default function DiagnosticModal() {
    const { diagnosticError, showDiagnostic } = useModalStore()
    const [showTechnical, setShowTechnical] = useState(false)
    const [copied, setCopied] = useState(false)

    if (!diagnosticError) return null

    const handleClose = () => {
        setShowTechnical(false)
        setCopied(false)
        showDiagnostic(null)
    }

    const handleCopy = () => {
        const textToCopy = `=== Cyrene Launcher Diagnostic Report ===
Category: ${diagnosticError.category || "General"}
Stage: ${diagnosticError.stage || "N/A"}
Title: ${diagnosticError.title}
Reason: ${diagnosticError.reason || diagnosticError.message || "N/A"}
${diagnosticError.items ? diagnosticError.items.map(i => `${i.label}: ${i.value}`).join("\n") : ""}
Suggestions:
${diagnosticError.suggestions ? diagnosticError.suggestions.map((s, idx) => `  ${idx + 1}. ${s}`).join("\n") : "  N/A"}
Technical Log:
${diagnosticError.technical || diagnosticError.message || "N/A"}
========================================`

        navigator.clipboard.writeText(textToCopy).then(() => {
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        })
    }

    // Category styling & icon
    const getCategoryDetails = () => {
        switch (diagnosticError.category) {
            case "game":
                return {
                    icon: <Gamepad2 size={22} />,
                    accentColor: "#ec4899",
                    badgeText: "GAME RUNTIME",
                    eyebrow: "GAME LAUNCH DIAGNOSTIC",
                }
            case "proxy":
                return {
                    icon: <Network size={22} />,
                    accentColor: "#06b6d4",
                    badgeText: "PROXY NETWORK",
                    eyebrow: "PROXY SERVICE DIAGNOSTIC",
                }
            case "server":
                return {
                    icon: <Server size={22} />,
                    accentColor: "#a855f7",
                    badgeText: "LOCAL SERVER",
                    eyebrow: "HKRPG SERVER DIAGNOSTIC",
                }
            case "language":
                return {
                    icon: <Languages size={22} />,
                    accentColor: "#10b981",
                    badgeText: "LOCALIZATION / MOD",
                    eyebrow: "LANGUAGE PATCH DIAGNOSTIC",
                }
            case "diff":
                return {
                    icon: <AlertTriangle size={22} />,
                    accentColor: "#f43f5e",
                    badgeText: "PATCHER SERVICE",
                    eyebrow: "GAME PATCH DIAGNOSTIC",
                }
            default:
                return {
                    icon: <AlertTriangle size={22} />,
                    accentColor: "#f59e0b",
                    badgeText: "SYSTEM",
                    eyebrow: "CYRENE DIAGNOSTIC REPORT",
                }
        }
    }

    const { icon, accentColor, eyebrow } = getCategoryDetails()

    return (
        <div
            className="cyrene-dialog-overlay"
            style={{ zIndex: 160 }}
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) handleClose()
            }}
        >
            <section
                className="cyrene-dialog cyrene-dialog--wide"
                style={{
                    width: "min(100%, 620px)",
                    maxHeight: "90vh",
                    display: "flex",
                    flexDirection: "column",
                }}
                role="dialog"
                aria-modal="true"
                aria-labelledby="diagnostic-dialog-title"
                tabIndex={-1}
                autoFocus
                onKeyDown={(event) => {
                    if (event.key === "Escape") handleClose()
                }}
            >
                {/* Header */}
                <header
                    className="cyrene-dialog__header"
                    style={{ borderBottomColor: "rgba(255, 255, 255, 0.1)" }}
                >
                    <span
                        className="cyrene-dialog__icon"
                        style={{
                            borderColor: `${accentColor}66`,
                            background: `linear-gradient(145deg, ${accentColor}33, ${accentColor}11)`,
                            color: accentColor,
                        }}
                    >
                        {icon}
                    </span>
                    <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span className="eyebrow" style={{ color: accentColor }}>
                                {eyebrow}
                            </span>
                            {diagnosticError.stage && (
                                <span
                                    style={{
                                        fontSize: "10px",
                                        padding: "1px 8px",
                                        borderRadius: "999px",
                                        background: `${accentColor}22`,
                                        color: "#fecdd3",
                                        border: `1px solid ${accentColor}44`,
                                    }}
                                >
                                    {diagnosticError.stage}
                                </span>
                            )}
                        </div>
                        <h2
                            id="diagnostic-dialog-title"
                            style={{ color: "#fff5fb", fontSize: "17px", marginTop: "3px" }}
                        >
                            {diagnosticError.title}
                        </h2>
                    </div>
                    <button
                        type="button"
                        className="cyrene-dialog__close"
                        onClick={handleClose}
                        aria-label="Close dialog"
                    >
                        <X size={17} />
                    </button>
                </header>

                {/* Body */}
                <div
                    className="cyrene-dialog__body"
                    style={{ overflowY: "auto", flex: 1, padding: "20px 24px" }}
                >
                    {/* Reason Highlight Card */}
                    {diagnosticError.reason && (
                        <div
                            style={{
                                background: `${accentColor}14`,
                                border: `1px solid ${accentColor}38`,
                                borderRadius: "14px",
                                padding: "14px 16px",
                                marginBottom: "16px",
                            }}
                        >
                            <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                                <div style={{ color: accentColor, marginTop: "2px", flexShrink: 0 }}>
                                    <FileQuestion size={18} />
                                </div>
                                <div>
                                    <strong
                                        style={{
                                            color: "#fff",
                                            fontSize: "13px",
                                            display: "block",
                                            marginBottom: "4px",
                                        }}
                                    >
                                        สาเหตุที่ตรวจพบ:
                                    </strong>
                                    <p
                                        style={{
                                            margin: 0,
                                            color: "#f3e8ff",
                                            fontSize: "12px",
                                            lineHeight: 1.6,
                                        }}
                                    >
                                        {diagnosticError.reason}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Key Diagnostic Information Grid */}
                    {diagnosticError.items && diagnosticError.items.length > 0 && (
                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                                gap: "12px",
                                marginBottom: "16px",
                            }}
                        >
                            {diagnosticError.items.map((item, index) => (
                                <div
                                    key={index}
                                    style={{
                                        background: "rgba(255, 255, 255, 0.03)",
                                        border: "1px solid rgba(255, 255, 255, 0.08)",
                                        borderRadius: "12px",
                                        padding: "12px 14px",
                                    }}
                                >
                                    <span
                                        style={{
                                            fontSize: "11px",
                                            color: "#a89eb6",
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 6,
                                        }}
                                    >
                                        {item.icon && <span>{item.icon}</span>}
                                        {item.label}
                                    </span>
                                    <div
                                        title={item.value}
                                        style={{
                                            marginTop: "6px",
                                            fontSize: "13px",
                                            fontWeight: 600,
                                            color: item.isHighlight ? "#f5d0fe" : "#e2e8f0",
                                            fontFamily: item.isHighlight ? "monospace" : "inherit",
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                            whiteSpace: "nowrap",
                                        }}
                                    >
                                        {item.value}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Suggestions Section */}
                    {diagnosticError.suggestions && diagnosticError.suggestions.length > 0 && (
                        <div
                            style={{
                                background: "rgba(242, 217, 155, 0.05)",
                                border: "1px solid rgba(242, 217, 155, 0.2)",
                                borderRadius: "14px",
                                padding: "14px 16px",
                                marginBottom: "16px",
                            }}
                        >
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 8,
                                    marginBottom: "10px",
                                }}
                            >
                                <HelpCircle size={16} style={{ color: "var(--cyrene-gold, #f2d99b)" }} />
                                <strong style={{ color: "#fff5fb", fontSize: "13px" }}>
                                    แนวทางแก้ไขที่แนะนำ:
                                </strong>
                            </div>
                            <ul
                                style={{
                                    margin: 0,
                                    paddingLeft: "18px",
                                    color: "#e2d9eb",
                                    fontSize: "12px",
                                    lineHeight: 1.7,
                                }}
                            >
                                {diagnosticError.suggestions.map((suggestion, index) => (
                                    <li key={index} style={{ marginBottom: "4px" }}>
                                        {suggestion}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Technical Details Accordion */}
                    {(diagnosticError.technical || diagnosticError.message) && (
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
                                    <span>🔍</span> ข้อมูลทางเทคนิค (Technical Error Log)
                                </span>
                                {showTechnical ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </button>

                            {showTechnical && (
                                <div
                                    style={{
                                        padding: "0 15px 15px",
                                        borderTop: "1px solid rgba(255, 255, 255, 0.06)",
                                    }}
                                >
                                    <pre
                                        style={{
                                            margin: "10px 0 8px",
                                            padding: "8px 10px",
                                            background: "rgba(0, 0, 0, 0.5)",
                                            borderRadius: "6px",
                                            color: "#94a3b8",
                                            fontSize: "11px",
                                            whiteSpace: "pre-wrap",
                                            wordBreak: "break-all",
                                            maxHeight: "120px",
                                            overflowY: "auto",
                                        }}
                                    >
                                        {diagnosticError.technical || diagnosticError.message}
                                    </pre>

                                    <button
                                        type="button"
                                        onClick={handleCopy}
                                        style={{
                                            display: "inline-flex",
                                            alignItems: "center",
                                            gap: "6px",
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
                            )}
                        </div>
                    )}
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
                        onClick={handleClose}
                        style={{ minWidth: "120px" }}
                    >
                        เข้าใจแล้ว
                    </button>
                </div>
            </section>
        </div>
    )
}
