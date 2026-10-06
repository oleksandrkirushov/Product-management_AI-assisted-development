import { TestBed } from '@angular/core/testing';
import { Product } from '@features/models/product';
import { MOCK_PRODUCTS } from './mocks/mock-products';
import { ProductService } from './product-service';

describe('ProductService', () => {
  let service: ProductService;

  beforeEach(() => {
    jasmine.clock().install();
    jasmine.clock().mockDate();
    service = TestBed.inject(ProductService);
  });

  afterEach(() => jasmine.clock().uninstall());

  function collect(): { values: Product[][]; completed: () => boolean } {
    const values: Product[][] = [];
    let isCompleted = false;
    service.getAll().subscribe({
      next: (value) => values.push(value),
      complete: () => (isCompleted = true),
    });
    return { values, completed: () => isCompleted };
  }

  it('should not emit before the 500ms simulated latency elapses', () => {
    const result = collect();

    jasmine.clock().tick(499);

    expect(result.values).toEqual([]);
    expect(result.completed()).toBeFalse();
  });

  it('should emit all mock products once after 500ms and complete', () => {
    const result = collect();

    jasmine.clock().tick(500);

    expect(result.values.length).toBe(1);
    expect(result.values[0]).toEqual([...MOCK_PRODUCTS]);
    expect(result.completed()).toBeTrue();
  });

  it('should return copies so that mutating the result does not affect the mock data', () => {
    const originalName = MOCK_PRODUCTS[0].name;
    const result = collect();
    jasmine.clock().tick(500);

    const [first] = result.values[0];
    first.name = 'Mutated';
    result.values[0].pop();

    expect(first).not.toBe(MOCK_PRODUCTS[0]);
    expect(MOCK_PRODUCTS[0].name).toBe(originalName);
    expect(MOCK_PRODUCTS.length).toBe(6);
  });

  it('should return fresh copies on every call', () => {
    const firstCall = collect();
    const secondCall = collect();
    jasmine.clock().tick(500);

    expect(firstCall.values[0]).toEqual(secondCall.values[0]);
    expect(firstCall.values[0][0]).not.toBe(secondCall.values[0][0]);
  });
});
