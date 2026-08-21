import "server-only";

import {
  createChecklistSpreadsheet,
  replaceAllInterviewCandidates,
  replaceAllOnboardingEmployees,
} from "./sheets";
import { probeSharePointFile, readInterviewFromSharePoint, readOnboardingFromSharePoint } from "./sharepoint";

export async function migrateSharePointToGoogle(options?: { createSheet?: boolean }) {
  const source = await probeSharePointFile();
  const interviews = await readInterviewFromSharePoint();
  const onboarding = await readOnboardingFromSharePoint();

  let sheetInfo: Awaited<ReturnType<typeof createChecklistSpreadsheet>> | null = null;
  if (options?.createSheet || !process.env.GOOGLE_CHECKLIST_SHEET_ID?.trim()) {
    sheetInfo = await createChecklistSpreadsheet();
    process.env.GOOGLE_CHECKLIST_SHEET_ID = sheetInfo.spreadsheetId;
  }

  await replaceAllInterviewCandidates(interviews);
  await replaceAllOnboardingEmployees(onboarding);

  return {
    source: {
      name: source.name,
      webUrl: source.webUrl,
      worksheets: source.worksheets,
    },
    destination: sheetInfo ?? {
      spreadsheetId: process.env.GOOGLE_CHECKLIST_SHEET_ID,
      url: `https://docs.google.com/spreadsheets/d/${process.env.GOOGLE_CHECKLIST_SHEET_ID}/edit`,
      ownerEmail: process.env.GOOGLE_SHEET_OWNER_EMAIL ?? "siamrajlba@gmail.com",
    },
    counts: {
      interview: interviews.length,
      onboarding: onboarding.length,
    },
  };
}
