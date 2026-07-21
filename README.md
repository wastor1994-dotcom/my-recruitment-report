# Employee Checklist

ระบบเช็คลิสต์พนักงานรอเริ่มงาน เอกสารติดตามสถานะ และรายชื่อส่งสัมภาษณ์  
Frontend → API → Google Sheets

## หน้าเว็บ

- `/` — หน้าแรก
- `/interview` — รายชื่อส่งสัมภาษณ์
- `/onboarding` — รอเริ่มงาน + เช็คลิสต์เอกสาร

## สร้าง Google Sheet ใหม่ (โครงเหมือนอ้างอิง)

1. สร้าง Service Account บน Google Cloud แล้วเปิด **Google Sheets API** + **Google Drive API**
2. ใส่ค่าใน `.env.local`:

```env
GOOGLE_SERVICE_ACCOUNT_EMAIL=...
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

3. รันแอปแล้วเรียกสร้าง Sheet:

```bash
curl -X POST http://localhost:3000/api/setup -H "Content-Type: application/json" -d "{\"action\":\"create\"}"
```

4. คัดลอก `spreadsheetId` จาก response ไปใส่ `GOOGLE_CHECKLIST_SHEET_ID`
5. แชร์ Sheet ให้ Service Account เป็น **Editor**
6. Restart `npm run dev`

แท็บที่จะถูกสร้าง:
- `ส่งสัมภาษณ์`
- `แจ้งประกัน - แจ้งเข้า`

## รันบนเครื่อง

```bash
npm install
npm run dev
```

เปิด http://localhost:3000
