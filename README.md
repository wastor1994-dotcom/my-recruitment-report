# staff-onboarding-checklist

**เช็คลิสต์เอกสารพนักงานเริ่มงาน**

Next.js app สำหรับกรอก/ติ๊กเช็คลิสต์เอกสารพนักงานรอเริ่มงาน และรายชื่อส่งสัมภาษณ์  
เก็บข้อมูลลง Google Sheet

## หน้าเว็บ

- `/` — หน้าแรก
- `/onboarding` — เช็คลิสต์รอเริ่มงาน / เอกสาร
- `/interview` — รายชื่อส่งสัมภาษณ์

## Env (Vercel / `.env.local`)

```env
GOOGLE_SERVICE_ACCOUNT_EMAIL=
GOOGLE_PRIVATE_KEY=
GOOGLE_CHECKLIST_SHEET_ID=
```

## สร้าง Sheet ใหม่

```bash
curl -X POST https://YOUR-VERCEL-URL/api/setup -H "Content-Type: application/json" -d "{\"action\":\"create\"}"
```

ใส่ `spreadsheetId` ใน `GOOGLE_CHECKLIST_SHEET_ID` แล้วแชร์ Sheet ให้ Service Account (Editor)

## พัฒนา

```bash
npm install
npm run dev
```
