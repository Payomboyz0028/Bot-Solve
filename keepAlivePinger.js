const https = require('https');
const http = require('http');

/**
 * PayomboyZ Discord Bot — Anti-Sleep Keep-Alive Pinger
 * ยิง HTTP Heartbeat เข้าหาตัวเองทุก 4 นาที ป้องกันไม่ให้ Render Cloud หลับ (24/7 Uptime)
 */
function startKeepAlivePinger(customUrl = null) {
    const rawUrl = customUrl || process.env.PING_URL || process.env.RENDER_EXTERNAL_URL;
    if (!rawUrl) {
        console.log("ℹ️ [Anti-Sleep Pinger] กำลังรอ URL (PING_URL / RENDER_EXTERNAL_URL)...");
        return;
    }

    const targetUrl = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`;
    console.log(`🛡️ [Anti-Sleep Pinger Active] ระบบยิง Ping กันหลับเริ่มทำงาน -> เป้าหมาย: ${targetUrl}`);

    const sendPing = () => {
        try {
            const reqClient = targetUrl.startsWith('https') ? https : http;
            const req = reqClient.get(targetUrl, (res) => {
                console.log(`⚡ [Anti-Sleep Heartbeat] ยิง Ping สำเร็จ -> HTTP ${res.statusCode} (${new Date().toLocaleTimeString('th-TH')})`);
            });

            req.on('error', (err) => {
                console.warn(`⚠️ [Anti-Sleep Warning] ปิงไม่สำเร็จ (เครือข่ายชั่วคราว): ${err.message}`);
            });

            req.setTimeout(15000, () => {
                req.destroy();
            });
        } catch (e) {
            console.warn(`⚠️ [Anti-Sleep Error]`, e.message);
        }
    };

    // ยิงครั้งแรกหลังเปิดระบบ 20 วินาที
    setTimeout(sendPing, 20 * 1000);

    // ยิงวนลูปทุกๆ 4 นาที (240,000 ms) ป้องกันระบบ Render ตัด Timeout 15 นาที
    setInterval(sendPing, 4 * 60 * 1000);
}

module.exports = { startKeepAlivePinger };
