import { TestBed, ComponentFixture } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { ProductForm } from './product-form';
import { ProductService } from '@features/services/product-service';
import { Product } from '@features/models/product';

describe('ProductForm', () => {
  const mockProduct: Product = {
    id: 'p-1',
    name: 'Wireless Mouse',
    price: 24.99,
    createdAtUtc: '2026-10-08T00:00:00Z',
  };

  let productService: jasmine.SpyObj<ProductService>;
  let router: jasmine.SpyObj<Router>;
  let fixture: ComponentFixture<ProductForm>;
  let el: HTMLElement;

  function query<T extends Element>(selector: string): T {
    const element = el.querySelector<T>(selector);
    if (!element) {
      throw new Error(`Element "${selector}" not found`);
    }
    return element;
  }

  function queryAll(selector: string): HTMLElement[] {
    return Array.from(el.querySelectorAll<HTMLElement>(selector));
  }

  function typeInField(selector: string, value: string): void {
    const input = query<HTMLInputElement>(selector);
    input.value = value;
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new Event('blur'));
  }

  beforeEach(async () => {
    productService = jasmine.createSpyObj<ProductService>('ProductService', ['create']);
    router = jasmine.createSpyObj<Router>('Router', ['navigate']);

    TestBed.configureTestingModule({
      imports: [ProductForm],
      providers: [
        { provide: ProductService, useValue: productService },
        { provide: Router, useValue: router },
      ],
    });

    fixture = TestBed.createComponent(ProductForm);
    el = fixture.nativeElement;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  describe('Form Rendering', () => {
    it('should render the header title "Add product"', () => {
      const heading = query<HTMLHeadingElement>('h1');
      expect(heading.textContent?.trim()).toBe('Add product');
    });

    it('should render name and price input fields', () => {
      const nameInput = query<HTMLInputElement>('#name');
      const priceInput = query<HTMLInputElement>('#price');

      expect(nameInput).not.toBeNull();
      expect(priceInput).not.toBeNull();
      expect(priceInput.type).toBe('number');
    });

    it('should disable the Save button when the form is pristine on initial render', () => {
      const saveButton = query<HTMLButtonElement>('button[type="submit"]');
      expect(saveButton.disabled).toBe(true);
    });

    it('should mark Name and Price as required with a visible and accessible indicator', () => {
      const nameInput = query<HTMLInputElement>('#name');
      const priceInput = query<HTMLInputElement>('#price');
      const labels = queryAll('.form-label');

      expect(nameInput.getAttribute('aria-required')).toBe('true');
      expect(priceInput.getAttribute('aria-required')).toBe('true');
      for (const label of labels) {
        expect(label.querySelector('.required-indicator')).not.toBeNull();
        expect(label.textContent).toContain('(required)');
      }
    });
  });

  describe('Form Validation', () => {
    it('should show a required validation message for Name when touched and empty', async () => {
      typeInField('#name', '');
      fixture.detectChanges();
      await fixture.whenStable();

      const errorElement = queryAll('#name-error');
      expect(errorElement.length).toBeGreaterThan(0);
      expect(errorElement[0].textContent?.trim()).toBe('Name is required');
    });

    it('should show a required validation message for Price when touched and zero', async () => {
      typeInField('#price', '0');
      fixture.detectChanges();
      await fixture.whenStable();

      const errorElement = queryAll('#price-error');
      expect(errorElement.length).toBeGreaterThan(0);
      expect(errorElement[0].textContent?.trim()).toBe('Price must be at least 0.01');
    });

    it('should show a validation message for Price when touched and negative', async () => {
      typeInField('#price', '-5');
      fixture.detectChanges();
      await fixture.whenStable();

      const errorElement = queryAll('#price-error');
      expect(errorElement.length).toBeGreaterThan(0);
      expect(errorElement[0].textContent?.trim()).toBe('Price must be at least 0.01');
    });

    it('should enable the Save button once the form becomes dirty, even if invalid', async () => {
      typeInField('#name', 'a');
      typeInField('#name', '');
      fixture.detectChanges();
      await fixture.whenStable();

      const saveButton = query<HTMLButtonElement>('button[type="submit"]');
      expect(fixture.componentInstance.form.invalid).toBe(true);
      expect(saveButton.disabled).toBe(false);
    });
  });

  describe('Form Submission', () => {
    it('should call ProductService.create with the entered values and navigate on success', async () => {
      productService.create.and.returnValue(of(mockProduct));

      typeInField('#name', 'Wireless Mouse');
      typeInField('#price', '24.99');
      fixture.detectChanges();
      await fixture.whenStable();

      query<HTMLButtonElement>('button[type="submit"]').click();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(productService.create).toHaveBeenCalledWith({ name: 'Wireless Mouse', price: 24.99 });
      expect(router.navigate).toHaveBeenCalledWith(['/products']);
    });

    it('should show an error message and not navigate when submission fails', async () => {
      productService.create.and.returnValue(
        throwError(() => ({ error: { message: 'Something went wrong' } })),
      );

      typeInField('#name', 'Wireless Mouse');
      typeInField('#price', '24.99');
      fixture.detectChanges();
      await fixture.whenStable();

      query<HTMLButtonElement>('button[type="submit"]').click();
      fixture.detectChanges();
      await fixture.whenStable();

      const errorBanner = query<HTMLElement>('[role="alert"].error-banner');
      expect(errorBanner.textContent?.trim()).toBe('Something went wrong');
      expect(router.navigate).not.toHaveBeenCalled();
    });

    it('should show the ASP.NET validation title when provided by the server', async () => {
      productService.create.and.returnValue(
        throwError(() => ({ error: { title: 'One or more validation errors occurred.' } })),
      );

      typeInField('#name', 'Wireless Mouse');
      typeInField('#price', '24.99');
      fixture.detectChanges();
      await fixture.whenStable();

      query<HTMLButtonElement>('button[type="submit"]').click();
      fixture.detectChanges();
      await fixture.whenStable();

      const errorBanner = query<HTMLElement>('[role="alert"].error-banner');
      expect(errorBanner.textContent?.trim()).toBe('One or more validation errors occurred.');
    });

    it('should not call ProductService.create when the form is invalid', async () => {
      typeInField('#name', '');
      typeInField('#price', '24.99');
      fixture.detectChanges();
      await fixture.whenStable();

      query<HTMLButtonElement>('button[type="submit"]').click();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(productService.create).not.toHaveBeenCalled();
    });
  });

  describe('Loading State', () => {
    it('should disable the button, show aria-busy and "Saving…" text while saving', async () => {
      const createSubject = new Subject<Product>();
      productService.create.and.returnValue(createSubject);

      typeInField('#name', 'Wireless Mouse');
      typeInField('#price', '24.99');
      fixture.detectChanges();
      await fixture.whenStable();

      query<HTMLButtonElement>('button[type="submit"]').click();
      fixture.detectChanges();

      const saveButton = query<HTMLButtonElement>('button[type="submit"]');
      expect(saveButton.disabled).toBe(true);
      expect(saveButton.getAttribute('aria-busy')).toBe('true');
      expect(saveButton.textContent?.trim()).toBe('Saving…');

      createSubject.next(mockProduct);
      createSubject.complete();
      await fixture.whenStable();
    });
  });

  describe('Navigation', () => {
    it('should navigate to /products when the back button is clicked', () => {
      query<HTMLButtonElement>('.back-button').click();

      expect(router.navigate).toHaveBeenCalledWith(['/products']);
    });
  });

  describe('Memory Leak Prevention', () => {
    it('should not accumulate subscriptions after repeated submissions', async () => {
      productService.create.and.returnValue(of(mockProduct));

      typeInField('#name', 'Wireless Mouse');
      typeInField('#price', '24.99');
      fixture.detectChanges();
      await fixture.whenStable();
      query<HTMLButtonElement>('button[type="submit"]').click();
      fixture.detectChanges();
      await fixture.whenStable();

      const createSpy = productService.create as jasmine.Spy;
      const initialCallCount = createSpy.calls.count();

      typeInField('#name', 'Mechanical Keyboard');
      typeInField('#price', '99.99');
      fixture.detectChanges();
      await fixture.whenStable();
      query<HTMLButtonElement>('button[type="submit"]').click();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(createSpy.calls.count()).toBe(initialCallCount + 1);
      expect(() => fixture.destroy()).not.toThrow();
    });
  });
});
