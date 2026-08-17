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
  status: string[];
  customCompareStart?: string;
  customCompareEnd?: string;
}

export interface FunnelData {
  visitors: number;
  visitorsSessions?: number;
  viewItem: number;
  viewItemSessions?: number;
  cart: number;
  cartSessions?: number;
  checkout: number;
  checkoutSessions?: number;
  shipping?: number; // kept for backwards compatibility if needed
  payment?: number; // kept for backwards compatibility if needed
}

