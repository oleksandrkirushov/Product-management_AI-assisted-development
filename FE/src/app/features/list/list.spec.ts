import { TestBed } from '@angular/core/testing';
import { ComponentFixture } from '@angular/core/testing';
import { Observable, Subject, of, throwError } from 'rxjs';
import { ProductService } from '@features/services/product-service';
import { List } from './list';
import { Product } from '@features/models/product';

describe('List', () => {
  const products: Product[] = [
    { id: 'p-1', name: 'Wireless Mouse', price: 24.99 },
    { id: 'p-2', name: '4K Monitor', price: 329 },
  ];

  let productService: jasmine.SpyObj<ProductService>;

  function query<T extends Element>(fixture: ComponentFixture<List>, selector: string): T {
    const element = (fixture.nativeElement as HTMLElement).querySelector<T>(selector);
    if (!element) {
      throw new Error(`Element "${selector}" not found`);
    }
    return element;
  }

  function queryAll(fixture: ComponentFixture<List>, selector: string): HTMLElement[] {
    return Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>(selector));
  }

  async function render(response: Observable<Product[]>): Promise<ComponentFixture<List>> {
    productService.getAll.and.returnValue(response);
    const fixture = TestBed.createComponent(List);
    await fixture.whenStable();
    return fixture;
  }

  beforeEach(() => {
    productService = jasmine.createSpyObj<ProductService>('ProductService', ['getAll']);
    TestBed.configureTestingModule({
      imports: [List],
      providers: [{ provide: ProductService, useValue: productService }],
    });
  });

  it('should render the page heading', async () => {
    const fixture = await render(of([]));

    expect(query<HTMLHeadingElement>(fixture, 'h1').textContent?.trim()).toBe('Product list');
  });

  it('should show a loading status while products are being fetched', () => {
    const response = new Subject<Product[]>();
    productService.getAll.and.returnValue(response);
    const fixture = TestBed.createComponent(List);

    fixture.detectChanges();
    fixture.detectChanges();

    expect(query<HTMLElement>(fixture, '[role="status"]').textContent).toContain('Loading products');
    expect(queryAll(fixture, 'li').length).toBe(0);
    expect(queryAll(fixture, '[role="alert"]').length).toBe(0);
    response.complete();
  });

  it('should replace the loading status with products once they arrive', async () => {
    const response = new Subject<Product[]>();
    productService.getAll.and.returnValue(response);
    const fixture = TestBed.createComponent(List);
    fixture.detectChanges();
    fixture.detectChanges();

    response.next(products);
    response.complete();
    await fixture.whenStable();

    expect(queryAll(fixture, '[role="status"]').length).toBe(0);
    expect(queryAll(fixture, 'li').length).toBe(2);
  });

  it('should request products exactly once on init', async () => {
    await render(of(products));

    expect(productService.getAll).toHaveBeenCalledTimes(1);
  });

  it('should render each product with its name and USD price', async () => {
    const fixture = await render(of(products));

    const items = queryAll(fixture, 'li');
    expect(items.length).toBe(2);
    expect(items[0].querySelector('.product-list__name')?.textContent?.trim()).toBe('Wireless Mouse');
    expect(items[0].querySelector('.product-list__price')?.textContent?.trim()).toBe('$24.99');
    expect(items[1].querySelector('.product-list__name')?.textContent?.trim()).toBe('4K Monitor');
    expect(items[1].querySelector('.product-list__price')?.textContent?.trim()).toBe('$329.00');
  });

  it('should show the empty state when there are no products', async () => {
    const fixture = await render(of([]));

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('No products yet');
    expect(queryAll(fixture, 'ul').length).toBe(0);
    expect(queryAll(fixture, '[role="status"]').length).toBe(0);
    expect(queryAll(fixture, '[role="alert"]').length).toBe(0);
  });

  it('should not show the empty state when products are present', async () => {
    const fixture = await render(of(products));

    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('No products yet');
  });

  it('should show an error alert with a Retry button when loading fails', async () => {
    const fixture = await render(throwError(() => new Error('Network down')));

    const alert = query<HTMLElement>(fixture, '[role="alert"]');
    expect(alert.textContent).toContain('Failed to load products.');
    expect(query<HTMLButtonElement>(fixture, '[role="alert"] button').textContent?.trim()).toBe('Retry');
    expect(queryAll(fixture, 'li').length).toBe(0);
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('No products yet');
  });

  it('should reload products and render them when Retry is clicked after an error', async () => {
    productService.getAll.and.returnValues(throwError(() => new Error('Network down')), of(products));
    const fixture = TestBed.createComponent(List);
    await fixture.whenStable();

    query<HTMLButtonElement>(fixture, '[role="alert"] button').click();
    await fixture.whenStable();

    expect(productService.getAll).toHaveBeenCalledTimes(2);
    expect(queryAll(fixture, '[role="alert"]').length).toBe(0);
    expect(queryAll(fixture, 'li').length).toBe(2);
  });

  it('should keep showing the error when Retry fails again', async () => {
    productService.getAll.and.returnValues(
      throwError(() => new Error('Network down')),
      throwError(() => new Error('Still down')),
    );
    const fixture = TestBed.createComponent(List);
    await fixture.whenStable();

    query<HTMLButtonElement>(fixture, '[role="alert"] button').click();
    await fixture.whenStable();

    expect(productService.getAll).toHaveBeenCalledTimes(2);
    expect(query<HTMLElement>(fixture, '[role="alert"]').textContent).toContain('Failed to load products.');
  });
});
