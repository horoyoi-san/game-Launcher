import { Link } from '@tanstack/react-router';

export default function HowToPage() {

    return (
        <div className="tool-page tool-page--guide">

            {/* 🔥 content */}
            <div className="tool-page__content space-y-8">

                <h1 className="
                text-4xl font-bold text-center
                text-purple-300
                drop-shadow-[0_0_10px_rgba(255,0,150,0.8)]
                drop-shadow-[0_0_20px_rgba(255,0,150,0.6)]
                ">How to Use</h1>

                {/* ส่วนที่ 1: คุณสมบัติของ Launcher */}
                <div className="bg-green-50 border-l-4 border-green-400 p-6 rounded-r-lg">
                    <h2 className="text-2xl font-bold text-green-800 flex items-center gap-2 mb-4">
                        <span>🚀</span>
                        <span>การใช้คุณสมบัติของ Launcher</span>
                    </h2>
                    <div className="space-y-3 text-green-700">
                        <div className="flex items-start gap-3">
                            <div className="text-green-600 text-lg">🔄</div>
                            <p>อัปเดต <span className="font-semibold text-amber-600">Horoyoi-san</span> และเครื่องมือพร็อกซีโดยอัตโนมัติเมื่อเปิดใช้งาน</p>
                        </div>
                        <div className="flex items-start gap-3">
                            <div className="text-green-600 text-lg">🎮</div>

                            <p>เปิดเกมโดยตรงผ่านตัวเรียกใช้งานด้วยพารามิเตอร์และสภาพแวดล้อมรันไทม์ที่ถูกต้อง</p>
                        </div>
                        <div className="flex items-start gap-3">
                            <div className="text-green-600 text-lg">🌐</div>
                            <p>รองรับการเปลี่ยนภาษาในเกม (เช่น EN, JP, ZH, KR, TH) ผ่าน{" "}
                                <a href="/language" className="link link-info font-mono">เครื่องมือภาษา</a>

                            </p>
                        </div>
                        <div className="flex items-start gap-3">
                            <div className="text-green-600 text-2xl">📦</div>
                            <div>
                                <p className="text-green-800 font-semibold">
                                    แพทช์และอัปเดตไฟล์เกม

                                </p>
                                <p className="text-green-700">
                                    ใช้{" "}

                                    <a href="/diff" className="link link-info font-mono">เครื่องมือเปรียบเทียบความแตกต่าง</a>{" "}

                                    (<span className="font-medium">DiffPatch</span>) สำหรับการอัปเดตแบบเพิ่มทีละน้อยที่รวดเร็วและน้ำหนักเบา

                                </p>
                                <p className="text-green-700 mt-1">
                                    รองรับ <span className="font-semibold">Hdiff</span>, <span className="font-semibold">Ldiff</span> และรูปแบบความแตกต่างแบบกำหนดเอง

                                </p>

                            </div>

                        </div>
                    </div>

                </div>


                {/* ส่วนที่ 3: หมายเหตุอื่นๆ */}
                <div className="bg-gray-50 border-l-4 border-gray-400 p-6 rounded-r-lg">
                    <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2 mb-4">
                        <span>📌</span>
                        <span>หมายเหตุอื่นๆ</span>

                    </h2>

                    <div className="space-y-4">
                        {/* หมายเหตุจากผู้ดูแลระบบ */}
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                            <div className="flex items-start gap-3">
                                <div className="text-yellow-600 text-xl">⚠️</div>
                                <div>
                                    <h3 className="font-semibold text-yellow-800 mb-1">สิทธิ์ของผู้ดูแลระบบ</h3>

                                    <p className="text-yellow-700">
                                        เรียกใช้ตัวเรียกใช้งานในฐานะผู้ดูแลระบบเสมอ เพื่อให้สามารถเข้าถึงสิทธิ์ไฟล์ได้

                                    </p>

                                </div>

                            </div>

                        </div>

                        {/* หมายเหตุการสำรองข้อมูล */}
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <div className="flex items-start gap-3">
                                <div className="text-blue-600 text-xl">💾</div>
                                <div>
                                    <h3 className="font-semibold text-blue-800 mb-1">ข้อมูลสำรอง</h3>
                                    <p className="text-blue-700">
                                        สำรองข้อมูล <code className="bg-blue-100 px-1 py-0.5 rounded text-sm">config.json</code> และ {' '}
                                        <code className="bg-blue-100 px-1 py-0.5 rounded text-sm">freesr-data.json</code> เป็นประจำ

                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* หมายเหตุเกี่ยวกับชุดเสียง */}
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                            <div className="flex items-start gap-3">
                                <div className="text-green-600 text-xl">🎵</div>
                                <div className="flex-1">
                                    <h3 className="font-semibold text-green-800 mb-2">เปิดใช้งานชุดเสียงใน Beta Client</h3>
                                    <div className="space-y-3 text-green-700">
                                        <div className="flex items-start gap-2">
                                            <span className="font-medium min-w-[20px] text-green-600">1.</span>
                                            <div>
                                                <p className="mb-1">คัดลอกโฟลเดอร์เสียงที่ต้องการ (เช่น <code className="bg-green-100 px-1 py-0.5 rounded bg-green-100 px-1 py-0.5 rounded text-sm">ภาษาญี่ปุ่น</code>, <code className="bg-green-100 px-1 py-0.5 rounded text-sm">ภาษาอังกฤษ</code>) จาก:</p>
                                                <code className="block bg-green-100 px-2 py-1 rounded text-sm mt-1">
                                                    Star Rail\Games\StarRail_Data\Persistent\Audio\AudioPackage\Windows
                                                </code>
                                                <p className="mt-1">ไปยังโฟลเดอร์เบต้าโดยคลิก <strong>"เปิดโฟลเดอร์เสียง"</strong> บนแท็บหน้าแรก</p>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-2">
                                            <span className="font-medium min-w-[20px] text-green-600">2.</span>
                                            <p>เมื่อเปิดเกมครั้งแรก โฟลเดอร์เสียงอาจถูกลบถ้าเป็นเช่นนั้น ให้ทำซ้ำขั้นตอนที่ 1 เพื่อกู้คืน</p>

                                        </div>

                                    </div>

                                </div>

                            </div>

                        </div>
                    </div>

                </div>
                <div className="text-center pt-4">
                    <Link to="/" className="btn btn-wide bg-black/30 backdrop-blur-md border border-purple-400/30 text-white hover:bg-purple-500/30 hover:shadow-lg hover:shadow-purple-500/40 active:scale-95 transition">Back to Home</Link>
                </div>
            </div>
        </div >
    );
}