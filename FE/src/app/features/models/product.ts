export interface Product {
  id: string;
  name: string;
  price: number;
  createdAtUtc: string;
}

export interface CreateProductRequest {
  name: string;
  price: number;
}

export interface UpdateProductRequest {
  name: string;
  price: number;
}
