export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  barcode: string;
  categoryId: string;
  price: number;
  cost: number;
  stock: number;
  minStock: number;
  unit: string;
  active: boolean;
  image?: string;
}

export interface ProductVariant {
  id: string;
  productId: string;
  name: string;
  sku: string;
  priceDelta: number;
  stock: number;
  active: boolean;
}
