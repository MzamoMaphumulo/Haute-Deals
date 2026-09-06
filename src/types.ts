export interface SaleItem {
  id: string;
  title: string;
  brand: string;
  store: string;
  storeKey: string;
  salePrice: number;
  originalPrice: number;
  discountPercent: number;
  savings: number;
  imageUrl: string;
  fallbackImageUrl?: string;
  productUrl: string;
  category: string;
  gender: 'Women' | 'Men' | 'Unisex' | 'Kids';
  badge?: string;
  lastVerified: string;
  description?: string;
  inStock?: boolean;
}

export interface StoreInfo {
  key: string;
  name: string;
  websiteUrl: string;
  saleUrl: string;
  badgeBg: string;
  badgeText: string;
  borderColor: string;
  activeSalePromo: string;
  tagline: string;
  totalDeals: number;
  maxDiscount: number;
  avgDiscount: number;
}

export type ViewMode = 'store' | 'product';

export type SortOption = 'discount-desc' | 'price-asc' | 'price-desc' | 'newest';

export interface FilterState {
  viewMode: ViewMode;
  searchQuery: string;
  selectedStores: string[];
  selectedCategory: string;
  selectedGender: string;
  minDiscount: number;
  maxPrice: number;
  sortBy: SortOption;
}
