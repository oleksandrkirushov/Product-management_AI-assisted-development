import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AvatarComponent, AvatarSize } from './avatar.component';

// Inline 1x1 GIF: loads without a network request.
const photoUrl = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

type AvatarInputs = Partial<{
  firstName: string;
  lastName: string;
  photoUrl: string | null;
  size: AvatarSize;
}>;

describe('AvatarComponent', () => {
  let fixture: ComponentFixture<AvatarComponent>;

  function initials(): string | null {
    return fixture.nativeElement.querySelector('.avatar__initials')?.textContent?.trim() ?? null;
  }

  function photo(): HTMLImageElement | null {
    return fixture.nativeElement.querySelector('img');
  }

  function requirePhoto(): HTMLImageElement {
    const img = photo();
    if (!img) {
      throw new Error('Photo not found');
    }
    return img;
  }

  async function render(inputs: AvatarInputs): Promise<void> {
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    await fixture.whenStable();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AvatarComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AvatarComponent);
  });

  it('should show the initials of the first and last name', async () => {
    await render({ firstName: 'John', lastName: 'Doe' });

    expect(initials()).toBe('JD');
  });

  it('should uppercase lowercase names', async () => {
    await render({ firstName: 'john', lastName: 'doe' });

    expect(initials()).toBe('JD');
  });

  it('should show a single letter when there is no last name', async () => {
    await render({ firstName: 'John', lastName: '' });

    expect(initials()).toBe('J');
  });

  it('should show "?" when both names are empty', async () => {
    await render({ firstName: ' ', lastName: '' });

    expect(initials()).toBe('?');
  });

  it('should handle Cyrillic names', async () => {
    await render({ firstName: 'іван', lastName: 'петренко' });

    expect(initials()).toBe('ІП');
  });

  it('should not split characters made of several code units', async () => {
    await render({ firstName: '𝒜lice', lastName: 'Doe' });

    expect(initials()).toBe('𝒜D');
  });

  it('should be hidden from assistive technologies', async () => {
    await render({ firstName: 'John', lastName: 'Doe' });

    expect(fixture.nativeElement.getAttribute('aria-hidden')).toBe('true');
  });

  it('should render a decorative photo instead of initials when photoUrl is set', async () => {
    await render({ firstName: 'John', lastName: 'Doe', photoUrl });

    expect(photo()?.getAttribute('src')).toBe(photoUrl);
    expect(photo()?.getAttribute('alt')).toBe('');
    expect(initials()).toBeNull();
  });

  it('should fall back to initials when the photo fails to load', async () => {
    await render({ firstName: 'John', lastName: 'Doe', photoUrl });

    requirePhoto().dispatchEvent(new Event('error'));
    await fixture.whenStable();

    expect(photo()).toBeNull();
    expect(initials()).toBe('JD');
  });

  it('should try the photo again when photoUrl changes after a load error', async () => {
    const otherPhotoUrl = `${photoUrl}#retry`;
    await render({ firstName: 'John', lastName: 'Doe', photoUrl });
    requirePhoto().dispatchEvent(new Event('error'));
    await fixture.whenStable();
    expect(photo()).toBeNull();

    await render({ photoUrl: otherPhotoUrl });

    expect(photo()?.getAttribute('src')).toBe(otherPhotoUrl);
    expect(initials()).toBeNull();
  });

  it('should show the initials when photoUrl is an empty string', async () => {
    await render({ firstName: 'John', lastName: 'Doe', photoUrl: '' });

    expect(photo()).toBeNull();
    expect(initials()).toBe('JD');
  });

  it('should switch back to the initials when photoUrl is cleared', async () => {
    await render({ firstName: 'John', lastName: 'Doe', photoUrl });

    await render({ photoUrl: null });

    expect(photo()).toBeNull();
    expect(initials()).toBe('JD');
  });

  it('should use the md size by default', async () => {
    await render({ firstName: 'John', lastName: 'Doe' });

    const host: HTMLElement = fixture.nativeElement;
    expect(host.classList).toContain('avatar--md');
    expect(host.classList).not.toContain('avatar--sm');
  });

  it('should apply the sm size class when size is sm', async () => {
    await render({ firstName: 'John', lastName: 'Doe', size: 'sm' });

    const host: HTMLElement = fixture.nativeElement;
    expect(host.classList).toContain('avatar--sm');
    expect(host.classList).not.toContain('avatar--md');
  });
});
