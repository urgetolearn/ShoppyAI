export type ProductId = string;

export interface ProductMetadata {
  category?: string;
  brand?: string;
  retailer?: string;
  tags?: string[];
  [key: string]: unknown;
}

export interface Product {
  id: ProductId;
  title: string;
  description?: string;
  price?: number;
  currency?: string;
  url: string;
  imageUrl?: string;
  metadata?: ProductMetadata;
}
