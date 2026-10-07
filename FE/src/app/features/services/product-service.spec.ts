import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '@env/environment';
import { Product, CreateProductRequest, UpdateProductRequest } from '@features/models/product';
import { ProductService } from './product-service';

describe('ProductService', () => {
  let service: ProductService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ProductService, provideHttpClientTesting()],
    });
    service = TestBed.inject(ProductService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  describe('getAll', () => {
    it('should fetch all products from the API', () => {
      const mockProducts: Product[] = [
        { id: '1', name: 'Product 1', price: 10, createdAtUtc: '2024-01-01T00:00:00Z' },
        { id: '2', name: 'Product 2', price: 20, createdAtUtc: '2024-01-02T00:00:00Z' },
      ];

      service.getAll().subscribe((products) => {
        expect(products).toEqual(mockProducts);
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/products`);
      expect(req.request.method).toBe('GET');
      req.flush(mockProducts);
    });

    it('should return empty array when no products exist', () => {
      service.getAll().subscribe((products) => {
        expect(products).toEqual([]);
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/products`);
      req.flush([]);
    });
  });

  describe('getById', () => {
    it('should fetch a single product by ID', () => {
      const productId = '1';
      const mockProduct: Product = {
        id: productId,
        name: 'Test Product',
        price: 15,
        createdAtUtc: '2024-01-01T00:00:00Z',
      };

      service.getById(productId).subscribe((product) => {
        expect(product).toEqual(mockProduct);
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/products/${productId}`);
      expect(req.request.method).toBe('GET');
      req.flush(mockProduct);
    });
  });

  describe('create', () => {
    it('should create a new product', () => {
      const createRequest: CreateProductRequest = { name: 'New Product', price: 25 };
      const mockResponse: Product = {
        id: '3',
        name: 'New Product',
        price: 25,
        createdAtUtc: '2024-01-03T00:00:00Z',
      };

      service.create(createRequest).subscribe((product) => {
        expect(product).toEqual(mockResponse);
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/products`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(createRequest);
      req.flush(mockResponse);
    });
  });

  describe('update', () => {
    it('should update an existing product', () => {
      const productId = '1';
      const updateRequest: UpdateProductRequest = { name: 'Updated', price: 30 };
      const mockResponse: Product = {
        id: productId,
        name: 'Updated',
        price: 30,
        createdAtUtc: '2024-01-01T00:00:00Z',
      };

      service.update(productId, updateRequest).subscribe((product) => {
        expect(product).toEqual(mockResponse);
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/products/${productId}`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual(updateRequest);
      req.flush(mockResponse);
    });
  });
});
