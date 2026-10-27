# 🚀 PayomboyZ Discord Bot - Quickstart & 24/7 Cloud Setup

คู่มือการตั้งค่าบอท Discord อัจฉริยะสำหรับห้อง `https://discord.com/channels/1549398019970179152/1564763903504818357`

---

## 📌 ขั้นตอนที่ 1: นำ Bot Token มาใส่ใน `.env`

1. เข้าไปที่ **[Discord Developer Portal](https://discord.com/developers/applications)**
2. ล็อกอินด้วยบัญชี Discord ของคุณ
3. กด **New Application** ตั้งชื่อว่า `PayomboyZ AI` หรือตามต้องการ
4. ไปที่เมนู **Bot** ด้านซ้าย:
   - กด **Reset Token** แล้ว **Copy Token** มาเก็บไว้
   - เลื่อนลงมาที่หัวข้อ **Privileged Gateway Intents**:
     - เปิดสวิตช์ ✅ **PRESENCE INTENT**
     - เปิดสวิตช์ ✅ **SERVER MEMBERS INTENT**
     - เปิดสวิตช์ ✅ **MESSAGE CONTENT INTENT**
     - กด **Save Changes**
5. ไปที่เมนู **OAuth2 -> URL Generator**:
   - ติ๊ก `bot` และ `applications.commands`
   - ติ๊ก Permission: `Administrator` (หรือ `Send Messages`, `Embed Links`, `Use External Emojis`, `Read Message History`)
   - ก็อปปี้ลิงก์ Invite ด้านล่างไปเปิดใน Browser เพื่อดึงบอทเข้าเซิร์ฟเวอร์ของคุณ (`1549398019970179152`)
6. เปิดไฟล์ `PayomboyZ-DiscordBot\.env` แล้วนำ Token มาใส่:
   ```env
   DISCORD_TOKEN=วาง_TOKEN_ตรงนี้
   DISCORD_CHANNEL_ID=1564763903504818357
   GEMINI_API_KEY=AQ.Ab8RN6KXLU2Z340OY0o4CeUcUYjt1RYUZaa1YC-K7C1h7qXsKA
   PORT=3000
   ```

---

## ⚡ ขั้นตอนที่ 2: รันบอทบนคอมของคุณ (แบบด่วน)

- ดับเบิ้ลคลิกไฟล์ `start_bot.bat` ได้ทันที
- บอทจะเริ่มทำงาน ตรวจจับไฟล์สคริปต์ในโฟลเดอร์ และโพสต์หน้าสารบัญฟังก์ชั่นลงห้อง `1564763903504818357` อัตโนมัติ

---

## 🌐 ขั้นตอนที่ 3: รันบอทฟรี 24/7 บน Cloud (Render / Koyeb)

บัญชี Google สำหรับสมัคร:
- **Email:** `aslamdunk19@gmail.com`
- **Password:** `aekkie3134`

### ตัวเลือก A: Render.com (ฟรี + เสถียรสุด)
1. เข้าเว็บ **[render.com](https://render.com/)**
2. กด **Get Started** -> เลือก **Sign in with Google** ด้วย `aslamdunk19@gmail.com`
3. นำโฟลเดอร์ `PayomboyZ-DiscordBot` ขึ้น GitHub (สร้าง Private Repo)
4. ใน Render กด **New +** -> เลือก **Web Service** -> ลิงก์กับ GitHub Repo
5. ตั้งค่า:
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `node bot.js`
6. ที่หัวข้อ **Environment Variables** ให้กด Add 3 ตัว:
   - `DISCORD_TOKEN` = (Token ของบอท)
   - `DISCORD_CHANNEL_ID` = `1564763903504818357`
   - `GEMINI_API_KEY` = `AQ.Ab8RN6KXLU2Z340OY0o4CeUcUYjt1RYUZaa1YC-K7C1h7qXsKA`
7. กด **Create Web Service** บอทจะออนไลน์ 24/7 ตลอดเวลา

### ตัวเลือก B: Koyeb.com (ฟรีตลอดชีพ ไม่มี Sleep)
1. เข้าเว็บ **[koyeb.com](https://www.koyeb.com/)**
2. กด **Sign up with Google** ด้วย `aslamdunk19@gmail.com`
3. เลือก **Deploy GitHub Repo** หรือสร้าง Service เป็น Node.js
4. ใส่ Environment Variables เดียวกันกับด้านบน แล้วกด Deploy

---

## 🎯 ฟังก์ชั่นหลักที่บอทจะทำในห้อง
1. **Directory Embed แบบหรูหรา (Obsidian Glass Theme):** แสดงหัวข้อ PayomboyZ Hub พร้อมสถานะ 11 แมพหลัก และมี Select Menu Dropdown ให้สมาชิกกดเลือกดูฟังก์ชั่นรายแมพ
2. **Ephemeral Interactive Response:** เวลามีคนกดเลือกแมพ บอทจะแสดงการ์ดสรุปฟังก์ชั่นเฉพาะคนนั้น (Ephemeral) ไม่รบกวนแชทห้อง ไม่รกตา
3. **AI Realtime Diff Watcher (Gemini 2.5 Flash):** เมื่อมีการแก้ไขสคริปต์ในเครื่องหรือ Backend บอทจะเปรียบเทียบโค้ดเดิมกับโค้ดใหม่ สรุปฟังก์ชั่นที่เพิ่ม/ปรับปรุง แล้วโพสต์ประกาศอัปเดตสวยงามลงห้องทันที
