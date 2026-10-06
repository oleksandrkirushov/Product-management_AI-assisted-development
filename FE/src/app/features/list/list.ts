import { CurrencyPipe } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { ProductService } from '@features/services/product-service';

@Component({
  selector: 'app-list',
  imports: [CurrencyPipe],
  templateUrl: './list.html',
  styleUrl: './list.scss',
})
export class List {
  private readonly productService = inject(ProductService);

  protected readonly products = rxResource({
    stream: () => this.productService.getAll(),
  });

  protected readonly items = computed(() => this.products.value() ?? []);
}
