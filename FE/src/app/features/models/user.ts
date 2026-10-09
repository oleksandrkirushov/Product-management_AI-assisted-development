export interface User {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
  permissions: string[];
  createdAtUtc: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  password: string;
}

export interface RegisterResponse {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  createdAtUtc: string;
}
