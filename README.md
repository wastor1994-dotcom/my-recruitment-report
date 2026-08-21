# staff-onboarding-checklist

**เช็คลิสต์เอกสารพนักงานเริ่มงาน** — กรอกจากเว็บ บันทึกลง **Google Sheet** (บัญชี siamrajlba@gmail.com)

## หน้าเว็บ

- `/` — หน้าแรก
- `/onboarding` — เช็คลิสต์รอเริ่มงาน / เอกสาร (แท็บ `แจ้งประกัน - แจ้งเข้า`)
- `/interview` — รายชื่อส่งสัมภาษณ์ (แท็บ `ส่งสัมภาษณ์`)

## Env (`.env.local`)

```env
GOOGLE_SERVICE_ACCOUNT_EMAIL=xxx@xxx.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_CHECKLIST_SHEET_ID=
GOOGLE_SHEET_OWNER_EMAIL=siamrajlba@gmail.com
```

## ตั้งค่า Google Cloud (ฟรี)

1. Login [Google Cloud Console](https://console.cloud.google.com/) ด้วย **siamrajlba@gmail.com**
2. สร้างโปรเจกต์ → เปิด **Google Sheets API** และ **Google Drive API**
3. **Credentials → Service Account → Keys → JSON** ดาวน์โหลดแล้วใส่ใน `.env.local`
4. รัน `npm run dev` แล้วสร้าง Sheet:

```powershell
Invoke-RestMethod -Method POST -Uri http://localhost:3000/api/setup -ContentType "application/json" -Body '{"action":"create"}'
```

5. ใส่ `spreadsheetId` ที่ได้ใน `GOOGLE_CHECKLIST_SHEET_ID` แล้ว restart dev server

## ย้ายข้อมูลจาก SharePoint

ไฟล์ต้นทาง: `KPI __ ข้อมูลผ่านกระบวนการ LBA .xlsx`  
แท็บ: `ส่งสัมภาษณ์`, `แจ้งเข้าประกัน`

```powershell
# 1) ตรวจไฟล์ SharePoint
Invoke-RestMethod http://localhost:3000/api/migrate

# 2) ย้ายไป Google Sheet (สร้าง Sheet ใหม่ + แชร์ให้ siamrajlba@gmail.com)
Invoke-RestMethod -Method POST -Uri http://localhost:3000/api/migrate -ContentType "application/json" -Body '{"action":"run","createSheet":true}'
```

ใส่ `spreadsheetId` ที่ได้ใน `GOOGLE_CHECKLIST_SHEET_ID` แล้ว restart

## พัฒนา

```bash
npm install
npm run dev
```

ตรวจเชื่อมต่อ: `GET /api/setup`
