import { Product } from '@features/models/product';

export const MOCK_PRODUCTS: readonly Product[] = [
  { id: 'p-001', name: 'Wireless Mouse', price: 24.99, createdAtUtc: '2024-01-01T10:00:00Z' },
  { id: 'p-002', name: 'Mechanical Keyboard', price: 89.5, createdAtUtc: '2024-01-02T11:00:00Z' },
  { id: 'p-003', name: '27" 4K Monitor', price: 329, createdAtUtc: '2024-01-03T12:00:00Z' },
  { id: 'p-004', name: 'USB-C Hub', price: 39.95, createdAtUtc: '2024-01-04T13:00:00Z' },
  { id: 'p-005', name: 'Noise-Cancelling Headphones', price: 199.99, createdAtUtc: '2024-01-05T14:00:00Z' },
  { id: 'p-006', name: 'Laptop Stand', price: 45, createdAtUtc: '2024-01-06T15:00:00Z' },
];
