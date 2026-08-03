export interface GA4DataRow {
  date: string;
  sessions: number;
  conversions: number;
  revenue: number;
}

export interface VTEXOrder {
  orderId: string;
  creationDate: string;
  clientName: string;
  totalValue: number;
  status: string;
  items: Array<{
    id: string;
    name: string;
    price: number;
    quantity: number;
    categoryId?: string;
  }>;
}

export interface DashboardFilter {
  startDate: string;
  endDate: string;
  category: string;
  minConversionRate: number;
  status: string;
}

export interface FunnelData {
  visitors: number;
  viewItem: number;
  cart: number;
  shipping: number;
  payment: number;
}

