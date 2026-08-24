export type Group = {
  id: string;
  academic_year: number;
  group_number: number;
  min_capacity: number;
  max_capacity: number;
  registered_count: number;
  remaining: number;
  is_open: boolean;
};

export type Registration = {
  id: string;
  full_name: string;
  registration_number: string;
  academic_year: number;
  group_number: number;
  created_at: string;
};

export type DashboardData = {
  groups: Group[];
  totalRegistrations: number;
  registrations: Registration[];
};

export type GroupDetails = {
  group: Group;
  students: Registration[];
  history: Array<{
    id: string;
    registration_number: string;
    event_type: 'registered' | 'moved';
    from_group_number: number | null;
    to_group_number: number;
    created_at: string;
  }>;
};
