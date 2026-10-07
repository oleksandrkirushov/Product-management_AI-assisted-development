export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  tokenType: string;
  expiresAtUtc: string;
}

export interface AuthState {
  token: string | null;
  isAuthenticated: boolean;
}
