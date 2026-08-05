# เช็คลิสต์เอกสารพนักงานเริ่มงาน

Next.js app สำหรับกรอก/ติ๊กเช็คลิสต์เอกสารพนักงานรอเริ่มงาน และรายชื่อส่งสัมภาษณ์  
เก็บข้อมูลลง **Google Sheet** (โครงเหมือนชีตอ้างอิง Data LBA)

## หน้าเว็บ

- `/` — หน้าแรก
- `/onboarding` — เช็คลิสต์รอเริ่มงาน / เอกสาร (ชีต `แจ้งประกัน - แจ้งเข้า`)
- `/interview` — รายชื่อส่งสัมภาษณ์ (ชีต `ส่งสัมภาษณ์`)

## Env

```env
GOOGLE_SERVICE_ACCOUNT_EMAIL=
GOOGLE_PRIVATE_KEY=
GOOGLE_CHECKLIST_SHEET_ID=
```

## สร้าง Sheet ใหม่

```bash
curl -X POST http://localhost:3000/api/setup -H "Content-Type: application/json" -d "{\"action\":\"create\"}"
```

คัดลอก `spreadsheetId` ไปใส่ `GOOGLE_CHECKLIST_SHEET_ID` แล้วแชร์ Sheet ให้ Service Account

## พัฒนา

```bash
npm install
npm run dev
```
