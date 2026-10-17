# INC WorkTracker

ระบบติดตามงาน เวลา และ KPI ของทีม creative — React + Supabase, deploy บน GitHub Pages

🔗 https://productive-inc-studio.github.io/Inc-Tracker/

## ฟีเจอร์

- **Login ด้วย Google** + สิทธิ์ 3 ระดับ (บังคับที่ฐานข้อมูลด้วย Row Level Security)
  - **Admin** — เห็น/แก้ทุกอย่าง เชิญและจัดการสมาชิก
  - **Lead** — เห็นงานทั้งทีม มอบหมายงานให้คนอื่น ดู KPI ทีม จัดการโปรเจกต์/ประเภทงาน
  - **Member** — เห็นเฉพาะงานที่ตัวเองรับผิดชอบหรือสร้าง และ KPI ตัวเอง
- **หน้าแรกของแต่ละคน** งานวันนี้ งานใกล้ถึงกำหนดส่ง 7 วัน และปฏิทิน widget (แตะวันเพื่อดูงานวันนั้น)
- **งาน** แบบ Board (ลากวาง) / List (จัดกลุ่มตามสถานะ คนทำ โปรเจกต์) / ปฏิทิน
- **ข้อย่อย** แยกงานเป็นข้อย่อย แต่ละข้อมีสถานะ ผู้รับผิดชอบ และกำหนดส่งของตัวเอง คนที่ได้ข้อย่อยจะเห็นงานหลักและอัปเดตสถานะข้อของตัวเองได้
- **ตัวกรอง** ค้นหา คนทำ สถานะ กำหนดส่ง โปรเจกต์ ประเภท ความสำคัญ — จำค่าไว้ให้แต่ละคน
- **จับเวลา** กด ▶ ที่งาน (จับได้ทีละงาน) หรือเพิ่มเวลาย้อนหลังเอง + ประมาณเวลาไว้ล่วงหน้าเพื่อเทียบกับเวลาจริง
- **Dashboard รายเดือน** งานที่ปิดได้ % ส่งตรงเวลา ชั่วโมงทำงาน เวลาจริง vs ประมาณ แยกตามประเภท/โปรเจกต์ และตารางผลงานรายคน
- **แจ้งเตือนในระบบ** เมื่อมีคนมอบหมายงานหรือข้อย่อยให้ คอมเมนต์ในงานของคุณ ส่งงานให้ตรวจ หรือปิดงานที่คุณสร้าง (กระดิ่งมีตัวเลขแสดงจำนวนที่ยังไม่อ่าน และเด้งแจ้งเมื่อมีรายการใหม่)
- **คอมเมนต์** ในแต่ละงาน, อัปเดตแบบ real-time เมื่อเพื่อนในทีมแก้งาน
- **แจ้งเตือน LINE** (Admin/Lead) — ส่งสรุปประจำวัน หรือแจ้งงานรายชิ้นเข้ากลุ่ม
- รองรับมือถือเต็มรูปแบบ + โหมดมืด

## ตั้งค่าครั้งแรก (ต้องทำเองใน dashboard ของแต่ละบริการ)

### 1. เปิด Google Login
1. ไปที่ [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials) → **Create credentials → OAuth client ID** → เลือก **Web application**
   - (ถ้าถูกถาม ให้ตั้งค่า OAuth consent screen แบบ External ก่อน)
   - **Authorized redirect URIs:** `https://jsywdxdhycfjdbhgogjs.supabase.co/auth/v1/callback`
2. คัดลอก Client ID และ Client secret
3. Supabase Dashboard → **Authentication → Sign In / Providers → Google** → เปิดใช้ แล้ววาง Client ID / secret
4. Supabase Dashboard → **Authentication → URL Configuration**
   - **Site URL:** `https://productive-inc-studio.github.io/Inc-Tracker/`
   - **Redirect URLs:** เพิ่ม `https://productive-inc-studio.github.io/Inc-Tracker/` และ `http://127.0.0.1:5173/Inc-Tracker/` (สำหรับทดสอบในเครื่อง)

### 2. เปิด GitHub Pages แบบ Actions
GitHub repo → **Settings → Pages → Build and deployment → Source: GitHub Actions**
หลังจากนั้นทุกครั้งที่ push เข้า `main` เว็บจะ build และ deploy ให้อัตโนมัติ

### 3. ตั้งค่า LINE (ถ้าต้องการแจ้งเตือน)
> ⚠️ โทเคน LINE ตัวเก่าเคยอยู่ใน `index.html` ที่เปิดสาธารณะ — ให้ **ออกโทเคนใหม่** ก่อน

1. [LINE Developers Console](https://developers.line.biz/console/) → channel ของบอท → Messaging API → **Channel access token → Reissue**
2. Supabase Dashboard → **Edge Functions → Secrets** เพิ่ม `LINE_CHANNEL_TOKEN` = โทเคนใหม่
3. หา Group ID: ในแท็บ Messaging API ตั้ง **Webhook URL** เป็น
   `https://jsywdxdhycfjdbhgogjs.supabase.co/functions/v1/wt-line-webhook` แล้วเปิด **Use webhook**
   จากนั้นเชิญบอทเข้ากลุ่ม (หรือพิมพ์ `groupid` ในกลุ่มที่บอทอยู่แล้ว) บอทจะตอบ Group ID กลับมา
4. เพิ่ม secret `LINE_GROUP_ID` = ค่าที่บอทตอบ (ขึ้นต้นด้วย `C...`)
   (ไม่บังคับ) เพิ่ม `LINE_CHANNEL_SECRET` = Channel secret จากแท็บ Basic settings เพื่อให้ webhook ตรวจลายเซ็นของ LINE

### 4. เข้าใช้งานครั้งแรก
- Login ด้วย **productive.inc.studio@gmail.com** → จะได้สิทธิ์ Admin อัตโนมัติ
- ไปที่ **ทีม → เชิญสมาชิกใหม่** ใส่อีเมล Google ของแต่ละคนพร้อมสิทธิ์
- คนที่ login โดยไม่ได้รับเชิญจะอยู่ในสถานะ "รออนุมัติ" จนกว่า Admin จะอนุมัติ

## พัฒนาในเครื่อง

```bash
npm install
npm run dev
```

- เปิด `http://127.0.0.1:5173/Inc-Tracker/` → ใช้ข้อมูลจริง (ต้อง login)
- เปิด `http://127.0.0.1:5173/Inc-Tracker/?demo` → **โหมด demo** ข้อมูลตัวอย่างในหน่วยความจำ สลับผู้ใช้/สิทธิ์ได้จากเมนูโปรไฟล์ (ใช้ได้เฉพาะตอน dev)

## โครงสร้าง

```
src/
  data/       api.ts (interface) · supabase.ts (ของจริง) · demo.ts (ข้อมูลตัวอย่าง) · hooks.ts (React Query)
  pages/      Home · Tasks (Board/List/Calendar) · Dashboard · Team · Login
  components/ Layout · TaskDrawer · NewTaskModal · Filters · fields · ui
supabase/
  migrations/ schema + RLS (ตารางทั้งหมดขึ้นต้นด้วย wt_ เพราะฐานข้อมูลใช้ร่วมกับแอปอื่น)
  functions/  wt-line-notify (ส่งข้อความ LINE)
```
