export type UserRole = 'admin' | 'dispatcher' | 'pilot';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface RefreshRequest {
  refreshToken: string;
}

export type UserStatus = 'active' | 'suspended' | 'deleted';

export interface UserProfile {
  id: number;
  email: string;
  callsign: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  rank: string;
  hoursTotal: number;
  createdAt: string;
  simbriefUsername?: string;
  status: UserStatus | string;
  lastLogin: string | null;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: UserProfile;
}

export interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
}

export interface AuthPayload {
  userId: number;
  email: string;
  callsign: string;
  role: UserRole;
}

export interface CreateUserRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  rank?: string;
}
