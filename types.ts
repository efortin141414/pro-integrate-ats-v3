export type AppRole = 'recruiter' | 'recruitment_manager' | 'sales' | 'executive' | 'admin';

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  role: AppRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type Client = {
  id: string;
  name: string;
  industry: string | null;
  contact_person: string | null;
  contact_email: string | null;
  status: string;
  owner_id: string | null;
  created_at: string;
  updated_at: string;
};

export type Requirement = {
  id: string;
  client_id: string | null;
  title: string;
  headcount: number;
  status: 'Open' | 'On Hold' | 'Closed' | 'Cancelled';
  priority: string | null;
  budget_min: number | null;
  budget_max: number | null;
  placement_fee_pct: number;
  admin_fee_pct: number;
  expected_start_date: string | null;
  jd_storage_path: string | null;
  jd_text: string | null;
  created_by: string | null;
  assigned_recruiter: string | null;
  created_at: string;
  updated_at: string;
  clients?: Client | null;
};

export type CandidateStage = 'New' | 'Screening' | 'Endorsed' | 'L1 Interview' | 'L2 Interview' | 'Final Interview' | 'Offered' | 'Hired' | 'Rejected' | 'Backout' | 'On Hold';

export type Candidate = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  location: string | null;
  current_salary: number | null;
  expected_salary: number | null;
  source: string | null;
  stage: CandidateStage;
  client_id: string | null;
  requirement_id: string | null;
  recruiter_id: string | null;
  cv_storage_path: string | null;
  parsed_cv_text: string | null;
  duplicate_of: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  clients?: Client | null;
  requirements?: Requirement | null;
  profiles?: Profile | null;
};

export type SalesForecast = {
  id: string;
  client_id: string | null;
  requirement_id: string | null;
  forecast_month: string;
  probability_pct: number;
  expected_revenue: number;
  actual_revenue: number;
  owner_id: string | null;
  created_at: string;
  updated_at: string;
  clients?: Client | null;
  requirements?: Requirement | null;
};

export type Placement = {
  id: string;
  candidate_id: string | null;
  client_id: string | null;
  requirement_id: string | null;
  placement_date: string;
  salary: number;
  placement_fee_pct: number;
  admin_fee_pct: number;
  actual_revenue: number;
  status: string;
  created_by: string | null;
  created_at: string;
};

export const STAGES: CandidateStage[] = ['New', 'Screening', 'Endorsed', 'L1 Interview', 'L2 Interview', 'Final Interview', 'Offered', 'Hired', 'Rejected', 'Backout', 'On Hold'];
