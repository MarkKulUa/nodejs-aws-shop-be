export interface ProductRecord {
  id: string;
  title: string;
  description: string;
  price: number;
}

export interface StockRecord {
  product_id: string;
  count: number;
}

export interface AvailableProduct extends ProductRecord {
  count: number;
}
