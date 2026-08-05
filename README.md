# staff-onboarding-checklist

**เช็คลิสต์เอกสารพนักงานเริ่มงาน** — กรอกจากเว็บ บันทึกลง **Excel บน SharePoint**

## หน้าเว็บ

- `/` — หน้าแรก
- `/onboarding` — เช็คลิสต์รอเริ่มงาน / เอกสาร (แท็บ `แจ้งประกัน - แจ้งเข้า`)
- `/interview` — รายชื่อส่งสัมภาษณ์ (แท็บ `ส่งสัมภาษณ์`)

## Env

```env
AZURE_TENANT_ID=
AZURE_CLIENT_ID=
AZURE_CLIENT_SECRET=
SHAREPOINT_FILE_URL=https://siamraj-my.sharepoint.com/:x:/p/...
SHAREPOINT_INTERVIEW_SHEET=ส่งสัมภาษณ์
SHAREPOINT_ONBOARDING_SHEET=แจ้งประกัน - แจ้งเข้า
```

## Azure App Registration

1. Azure Portal → App registrations → New
2. Certificates & secrets → New client secret
3. API permissions → Microsoft Graph → Application:
   - `Sites.ReadWrite.All`
   - `Files.ReadWrite.All`
4. Grant admin consent

## พัฒนา

```bash
npm install
npm run dev
```

ตรวจเชื่อมต่อ: `GET /api/setup`
