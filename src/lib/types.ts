export type Stage =
  | "Applied"
  | "Screening"
  | "Interview"
  | "Offer"
  | "Hired"
  | "Rejected";

export interface RecruitmentRow {
  candidate_id: string;
  position: string;
  department: string;
  applied_date: string;
  stage: Stage;
  source: string;
  interview_date: string | null;
  offer_date: string | null;
  hired_date: string | null;
}
