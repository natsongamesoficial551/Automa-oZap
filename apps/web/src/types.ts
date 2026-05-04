export type UserRole = "owner" | "admin" | "operator" | "viewer";

export interface CompanyMembership {
  companyId: string;
  companyName: string;
  role: UserRole;
}
