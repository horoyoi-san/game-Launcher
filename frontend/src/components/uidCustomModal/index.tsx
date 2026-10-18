import { useEffect, useState, type FormEvent } from "react"
import { Check, LoaderCircle, Palette, Save, X } from "lucide-react"
import { FSService } from "@bindings/Cyrene-launcher/internal/fs-service"

export default function UIDCustomModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    const [draft, setDraft] = useState({ betaText: "", versionText: "" })
    const [isLoading, setIsLoading] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [message, setMessage] = useState("")
    const [error, setError] = useState("")

    useEffect(() => {
        if (!isOpen) return
        let cancelled = false
        setIsLoading(true)
        setMessage("")
        setError("")
        FSService.ReadUIDCustom()
            .then((config) => {
                if (!cancelled) setDraft({ betaText: config.beta_text, versionText: config.version_text })
            })
            .catch((reason) => {
                if (!cancelled) setError(reason instanceof Error ? reason.message : "Could not load UID custom text")
            })
            .finally(() => { if (!cancelled) setIsLoading(false) })
        return () => { cancelled = true }
    }, [isOpen])

    if (!isOpen) return null

    const save = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        setIsSaving(true)
        setMessage("")
        setError("")
        try {
            await FSService.SaveUIDCustom({ beta_text: draft.betaText, version_text: draft.versionText })
            setMessage("Saved to server/UID_Custom.json. Changes apply on the next game heartbeat.")
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : "Could not save UID custom text")
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <div className="settings-overlay uid-custom-overlay" onMouseDown={(event) => {
            if (event.target === event.currentTarget) onClose()
        }}>
            <section className="settings-modal uid-custom-modal" role="dialog" aria-modal="true" aria-labelledby="uid-custom-title">
                <header className="settings-modal__header">
                    <div className="settings-modal__title-icon"><Palette size={20} /></div>
                    <div><span className="eyebrow">GAME PERSONALIZATION</span><h2 id="uid-custom-title">UID Custom Text</h2></div>
                    <button type="button" className="settings-modal__close" onClick={onClose} aria-label="Close UID custom editor"><X size={18} /></button>
                </header>
                <div className="uid-custom-modal__content">
                    <p className="uid-custom-modal__intro">กำหนดข้อความด้านบนและด้านล่างที่แสดงในเกม โดยไม่ต้องเปิดหรือแก้ไฟล์เอง</p>
                    <form className="uid-custom-editor" onSubmit={(event) => void save(event)}>
                        <label className="uid-custom-editor__field">
                            <span>ข้อความด้านบน · Beta hint</span>
                            <textarea value={draft.betaText} onChange={(event) => setDraft({ ...draft, betaText: event.target.value })} disabled={isLoading || isSaving} rows={3} />
                        </label>
                        <label className="uid-custom-editor__field">
                            <span>ข้อความด้านล่าง · Version label</span>
                            <textarea value={draft.versionText} onChange={(event) => setDraft({ ...draft, versionText: event.target.value })} disabled={isLoading || isSaving} rows={4} />
                        </label>
                        <p className="uid-custom-editor__hint">ใช้แท็กสีได้ เช่น &lt;color=#ff0000&gt;ข้อความ&lt;/color&gt;</p>
                        {message && <p className="uid-custom-editor__success"><Check size={14} />{message}</p>}
                        {error && <p role="alert" className="uid-custom-editor__error">{error}</p>}
                        <div className="uid-custom-modal__actions">
                            <button type="button" className="uid-custom-modal__cancel" onClick={onClose}>ปิด</button>
                            <button type="submit" className="uid-custom-modal__save" disabled={isLoading || isSaving}>
                                {isLoading || isSaving ? <LoaderCircle size={16} className="animate-spin" /> : <Save size={16} />}
                                {isLoading ? "กำลังโหลด..." : isSaving ? "กำลังบันทึก..." : "บันทึกข้อความ"}
                            </button>
                        </div>
                    </form>
                </div>
            </section>
        </div>
    )
}
