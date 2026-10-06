import { Injectable } from '@angular/core';
import { Observable, delay, of } from 'rxjs';
import { Product } from '@features/models/product';
import { MOCK_PRODUCTS } from './mocks/mock-products';

/** Simulated network latency for mock data, in milliseconds. */
const MOCK_DELAY_MS = 500;

@Injectable({ providedIn: 'root' })
export class ProductService {
  getAll(): Observable<Product[]> {
    return of(MOCK_PRODUCTS.map((product) => ({ ...product }))).pipe(delay(MOCK_DELAY_MS));
  }
}
