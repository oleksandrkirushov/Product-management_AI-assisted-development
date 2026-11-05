import { Component, computed, input, linkedSignal } from '@angular/core';

export type AvatarSize = 'sm' | 'md';

function firstLetter(value: string): string {
  const [letter = ''] = [...value.trim()];
  return letter.toLocaleUpperCase();
}

@Component({
  selector: 'app-avatar',
  styleUrl: './avatar.component.scss',
  templateUrl: './avatar.component.html',
  host: {
    class: 'avatar',
    '[class.avatar--sm]': "size() === 'sm'",
    '[class.avatar--md]': "size() === 'md'",
    'aria-hidden': 'true',
  },
})
export class AvatarComponent {
  readonly firstName = input('');
  readonly lastName = input('');
  readonly photoUrl = input<string | null>(null);
  readonly size = input<AvatarSize>('md');

  private readonly imageFailed = linkedSignal({ source: this.photoUrl, computation: () => false });

  protected readonly showPhoto = computed(() => !!this.photoUrl() && !this.imageFailed());

  protected readonly initials = computed(
    () => `${firstLetter(this.firstName())}${firstLetter(this.lastName())}` || '?',
  );

  protected onImageError(): void {
    this.imageFailed.set(true);
  }
}
