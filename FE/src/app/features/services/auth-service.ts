import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, of, switchMap, tap } from 'rxjs';
import { environment } from '@env/environment';
import { LoginRequest, LoginResponse } from '@features/models/auth';
import { RegisterRequest, RegisterResponse, User } from '@features/models/user';
import { UserService } from '@features/services/user-service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly userService = inject(UserService);
  private readonly apiUrl = environment.apiUrl;
  private readonly tokenKey = 'auth_token';

  private readonly currentUserState = signal<User | null>(null);
  readonly currentUser = this.currentUserState.asReadonly();
  readonly permissions = computed(() => this.currentUserState()?.permissions ?? []);

  login(username: string, password: string): Observable<LoginResponse> {
    const request: LoginRequest = { username, password };
    return this.http.post<LoginResponse>(`${this.apiUrl}/auth/login`, request).pipe(
      tap((response) => this.setToken(response.accessToken)),
      switchMap((response) =>
        this.userService.getMe().pipe(
          tap((user) => this.currentUserState.set(user)),
          map(() => response)
        )
      )
    );
  }

  register(request: RegisterRequest): Observable<RegisterResponse> {
    return this.http.post<RegisterResponse>(`${this.apiUrl}/auth/register`, request);
  }

  /**
   * Rehydrates the current user profile from the stored token on app startup.
   * If the token is invalid (profile request fails), the token is cleared.
   */
  rehydrate(): Observable<void> {
    const token = this.getToken();
    if (token === null) {
      return of(undefined);
    }

    return this.userService.getMe().pipe(
      tap((user) => this.currentUserState.set(user)),
      map(() => undefined),
      catchError(() => {
        this.logout();
        return of(undefined);
      })
    );
  }

  hasPermission(permission: string): boolean {
    const granted = this.permissions();
    if (granted.includes('*')) {
      return true;
    }

    const [resource] = permission.split(':');
    return granted.includes(permission) || granted.includes(`${resource}:*`);
  }

  logout(): void {
    localStorage.removeItem(this.tokenKey);
    this.currentUserState.set(null);
  }

  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  setToken(token: string): void {
    localStorage.setItem(this.tokenKey, token);
  }

  isAuthenticated(): boolean {
    return this.currentUserState() !== null;
  }
}
