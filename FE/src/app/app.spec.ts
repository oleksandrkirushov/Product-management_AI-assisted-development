import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '@features/services/auth.service';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    const authService = jasmine.createSpyObj<AuthService>('AuthService', ['logout'], {
      currentUser: signal(null).asReadonly(),
    });

    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([]), { provide: AuthService, useValue: authService }],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render the router outlet inside main', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('main router-outlet')).not.toBeNull();
  });
});
