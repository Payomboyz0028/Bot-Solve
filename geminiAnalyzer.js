const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const apiKey = process.env.GEMINI_API_KEY || "AQ.Ab8RN6KXLU2Z340OY0o4CeUcUYjt1RYUZaa1YC-K7C1h7qXsKA";
const genAI = new GoogleGenerativeAI(apiKey);

// Using Gemini 2.0 Flash / 1.5 Flash for high speed & massive context
const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.2
    }
});

/**
 * วิเคราะห์ความเปลี่ยนแปลงเมื่อมีการอัปเดตสคริปต์
 */
async function analyzeUpdateDiff(mapName, oldCode, newCode) {
    const prompt = `
คุณเป็น AI ผู้เชี่ยวชาญด้านวิเคราะห์สคริปต์ Roblox ประจำทีม "PAYOMBØYZ HUB"
ภารกิจ: สแกนโค้ด Luau ของแมพ "${mapName}" เพื่อดูว่าผู้พัฒนาได้อัปเดตฟังก์ชั่นอะไรใหม่ หรือแก้ไขส่วนไหนไปบ้าง

[สคริปต์เวอร์ชันก่อนหน้า]:
\`\`\`lua
${(oldCode || "").slice(0, 15000)}
\`\`\`

[สคริปต์เวอร์ชันล่าสุด]:
\`\`\`lua
${(newCode || "").slice(0, 30000)}
\`\`\`

จงส่งผลลัพธ์กลับมาเป็น JSON ตามโครงสร้างนี้เท่านั้น (ห้ามใส่ Markdown ครอบ):
{
  "map_name": "${mapName}",
  "has_changes": true,
  "summary_th": "สรุปสั้นๆ เท่ๆ สไตล์ PayomboyZ ว่าอัปเดตนี้มีอะไรเด่น",
  "new_features": [
    "ชื่อฟังก์ชั่นใหม่ 1 พร้อมคำอธิบายสั้นๆ",
    "ชื่อฟังก์ชั่นใหม่ 2 พร้อมคำอธิบายสั้นๆ"
  ],
  "improvements": [
    "ส่วนที่ปรับปรุง เช่น ความเร็ว, แก้บั๊ก, หรือ bypass"
  ],
  "tier_requirement": "VIP หรือ VVIP",
  "tips": "ทริคการใช้งานสั้นๆ 1 บรรทัด"
}
`;

    try {
        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        return JSON.parse(responseText.trim());
    } catch (err) {
        console.error("[Gemini Error]", err);
        return {
            map_name: mapName,
            has_changes: true,
            summary_th: "ตรวจพบการอัปเดตสคริปต์ล่าสุดในระบบ PayomboyZ Hub",
            new_features: ["อัปเดตประสิทธิภาพและปรับปรุงโค้ดภายใน"],
            improvements: ["Bypass Optimization & Bug Fixes"],
            tier_requirement: "VIP",
            tips: "รีสตาร์ตสคริปต์ในตัวรันเพื่อรับเวอร์ชันล่าสุด"
        };
    }
}

/**
 * วิเคราะห์ไฟล์สคริปต์เดี่ยวเพื่อดึงฟังก์ชั่นทั้งหมด
 */
async function analyzeSingleScript(mapName, code) {
    const prompt = `
คุณเป็น AI ผู้เชี่ยวชาญด้านสคริปต์ Roblox ประจำ "PAYOMBØYZ HUB"
ภารกิจ: สแกนโค้ด Luau ของแมพ "${mapName}" ด้านล่าง แล้วถอดรายการฟังก์ชั่นทั้งหมดออกมา

[โค้ดสคริปต์]:
\`\`\`lua
${(code || "").slice(0, 35000)}
\`\`\`

ตอบกลับเป็น JSON Format (ห้ามใส่ markdown block):
{
  "map_name": "${mapName}",
  "category": "หมวดหมู่ของเกม เช่น RPG, Simulator, Action, Mining",
  "features": [
    "ฟังก์ชั่นที่ 1",
    "ฟังก์ชั่นที่ 2",
    "ฟังก์ชั่นที่ 3"
  ],
  "controls": "ปุ่มลัดหรือวิธีเปิดใช้งาน",
  "tier": "VIP หรือ VVIP"
}
`;

    try {
        const result = await model.generateContent(prompt);
        return JSON.parse(result.response.text().trim());
    } catch (err) {
        console.error("[Gemini Single Error]", err);
        return null;
    }
}

/**
 * ตอบคำถามสมาชิกเกี่ยวกับฟังก์ชั่นสคริปต์ของแต่ละแมพ
 */
async function answerScriptQuestion(userQuestion, mapsList) {
    const textModel = genAI.getGenerativeModel({
        model: "gemini-2.5-flash",
        generationConfig: {
            temperature: 0.3
        }
    });

    const contextData = JSON.stringify(mapsList.map(m => ({
        name: m.name,
        category: m.category,
        tier: m.tier,
        hotkey: m.hotkey,
        features: m.features
    })), null, 2);

    const prompt = `
คุณเป็น AI ผู้ช่วยประจำ "PAYOMBØYZ HUB" ใน Discord
หน้าที่: ตอบคำถามสมาชิกเกี่ยวกับฟังก์ชั่นสคริปต์ในแต่ละแมพของ PayomboyZ Hub

[ข้อมูลสคริปต์ในระบบ]:
${contextData}

[คำถามของสมาชิก]:
"${userQuestion}"

แนวทางตอบ:
- ตอบภาษาไทย กระชับ เท่ ชัดเจน ตรงประเด็น
- บอกว่าแมพนี้มีฟังก์ชั่นอะไรเด่นบ้าง, ปุ่มเปิดปิดคืออะไร, เป็น VIP หรือ VVIP
- จัดข้อความเป็น Bullet points ให้อ่านง่ายใน Discord
`;

    try {
        const result = await textModel.generateContent(prompt);
        return result.response.text();
    } catch (err) {
        console.error("[Gemini Q&A Error]", err);
        return null;
    }
}

module.exports = { analyzeUpdateDiff, analyzeSingleScript, answerScriptQuestion };
