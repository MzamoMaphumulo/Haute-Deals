import React from 'react';
import { SlidersHorizontal, ArrowUpDown, Tag, X, Check } from 'lucide-react';
import { SaleItem, StoreInfo, SortOption } from '../types';
import { ProductCard } from './ProductCard';

interface ProductGridViewProps {
  items: SaleItem[];
  stores: StoreInfo[];
  savedItemIds: Set<string>;
  onQuickView: (item: SaleItem) => void;
  onToggleSave: (item: SaleItem) => void;
  // Filters
  selectedCategory: string;
  onSelectCategory: (cat: string) => void;
  selectedStores: string[];
  onToggleStore: (storeKey: string) => void;
  selectedGender: string;
  onSelectGender: (gender: string) => void;
  minDiscount: number;
  onSetMinDiscount: (discount: number) => void;
  maxPrice: number;
  onSetMaxPrice: (price: number) => void;
  sortBy: SortOption;
  onSetSortBy: (sort: SortOption) => void;
  onResetFilters: () => void;
}

const CATEGORIES = [
  'All Categories',
  'Dresses & Skirts',
  'Shirts & Tops',
  'Jackets & Outerwear',
  'Pants & Jeans',
  'Footwear & Shoes',
  'Accessories & Bags',
];

const GENDERS = ['All', 'Women', 'Men', 'Unisex'];
const DISCOUNT_TIERS = [0, 30, 40, 50];

export const ProductGridView: React.FC<ProductGridViewProps> = ({
  items,
  stores,
  savedItemIds,
  onQuickView,
  onToggleSave,
  selectedCategory,
  onSelectCategory,
  selectedStores,
  onToggleStore,
  selectedGender,
  onSelectGender,
  minDiscount,
  onSetMinDiscount,
  maxPrice,
  onSetMaxPrice,
  sortBy,
  onSetSortBy,
  onResetFilters,
}) => {
  const uniqueItems = React.useMemo(() => {
    const seen = new Set<string>();
    return items.filter((item) => {
      if (!item || !item.id || seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  }, [items]);
  const hasActiveFilters =
    selectedCategory !== 'All Categories' ||
    selectedStores.length > 0 ||
    selectedGender !== 'All' ||
    minDiscount > 0 ||
    maxPrice < 3000;

  return (
    <div id="product-grid-view-container" className="space-y-8">
      {/* Filtering & Sorting Controls Bar */}
      <div className="bg-white border border-black p-4 sm:p-6 space-y-4">
        {/* Row 1: Categories & Genders */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Categories */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                id={`grid-cat-${cat.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
                onClick={() => onSelectCategory(cat)}
                className={`px-3 py-1 text-xs font-sans font-bold uppercase tracking-wider whitespace-nowrap transition-colors border ${
                  selectedCategory === cat || (cat === 'All Categories' && (!selectedCategory || selectedCategory === 'All Categories'))
                    ? 'border-black bg-black text-white'
                    : 'border-stone-300 bg-white text-stone-700 hover:border-black hover:text-black'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Gender Tabs */}
          <div className="flex items-center border border-black p-0.5 bg-white self-start lg:self-auto shrink-0">
            {GENDERS.map((gender) => (
              <button
                key={gender}
                type="button"
                id={`gender-tab-${gender.toLowerCase()}`}
                onClick={() => onSelectGender(gender)}
                className={`px-3 py-1 text-xs font-sans font-bold uppercase tracking-wider transition-colors ${
                  selectedGender === gender
                    ? 'bg-black text-white'
                    : 'text-stone-500 hover:text-black'
                }`}
              >
                {gender}
              </button>
            ))}
          </div>
        </div>

        {/* Row 2: Store Filters & Sort Dropdown */}
        <div className="pt-4 border-t border-stone-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Store Pills Selection */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            <span className="text-[11px] font-sans font-bold uppercase tracking-widest text-stone-400 shrink-0">
              Retailers:
            </span>
            <button
              type="button"
              id="filter-all-stores"
              onClick={() => onToggleStore('all')}
              className={`px-2.5 py-1 text-xs font-sans font-bold uppercase tracking-wider transition-colors shrink-0 border ${
                selectedStores.length === 0
                  ? 'border-black bg-black text-white'
                  : 'border-stone-300 bg-white text-stone-600 hover:border-black hover:text-black'
              }`}
            >
              All Retailers
            </button>

            {stores.map((store) => {
              const isSelected = selectedStores.includes(store.key);
              return (
                <button
                  key={store.key}
                  type="button"
                  id={`filter-store-${store.key}`}
                  onClick={() => onToggleStore(store.key)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-sans font-bold uppercase tracking-wider transition-colors shrink-0 border ${
                    isSelected
                      ? 'border-black bg-black text-white'
                      : 'border-stone-300 bg-white text-stone-600 hover:border-black hover:text-black'
                  }`}
                >
                  {isSelected && <Check className="w-3 h-3" />}
                  <span>{store.name}</span>
                </button>
              );
            })}
          </div>

          {/* Sort Selector & Discount Filter */}
          <div className="flex items-center gap-4 shrink-0 flex-wrap">
            {/* Discount Filter */}
            <div className="flex items-center gap-1.5 text-xs font-sans">
              <span className="text-stone-400 font-bold uppercase text-[10px] tracking-widest">Min Markdown:</span>
              <div className="flex items-center border border-black p-0.5 bg-white">
                {DISCOUNT_TIERS.map((tier) => (
                  <button
                    key={tier}
                    type="button"
                    onClick={() => onSetMinDiscount(tier)}
                    className={`px-2 py-0.5 text-xs font-sans font-bold uppercase transition-colors ${
                      minDiscount === tier
                        ? 'bg-[#CC0000] text-white'
                        : 'text-stone-600 hover:text-black'
                    }`}
                  >
                    {tier === 0 ? 'Any' : `${tier}%+`}
                  </button>
                ))}
              </div>
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-1.5">
              <ArrowUpDown className="w-3.5 h-3.5 text-stone-400" />
              <select
                id="products-sort-select"
                value={sortBy}
                onChange={(e) => onSetSortBy(e.target.value as SortOption)}
                className="text-xs font-sans font-bold uppercase tracking-wider bg-white text-black py-1 px-2.5 border border-black focus:outline-none cursor-pointer"
              >
                <option value="discount-desc">Discount: High to Low</option>
                <option value="price-asc">Price: Low to High</option>
                <option value="price-desc">Price: High to Low</option>
                <option value="newest">Newest Markdowns</option>
              </select>
            </div>
          </div>
        </div>

        {/* Active Filters Summary Bar */}
        {hasActiveFilters && (
          <div className="pt-3 border-t border-black flex items-center justify-between gap-2 flex-wrap text-xs font-sans">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-stone-400 uppercase tracking-widest font-bold text-[10px]">Applied Criteria:</span>
              {selectedCategory !== 'All Categories' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 border border-black bg-[#F5F5F5] text-black uppercase font-bold text-[10px]">
                  {selectedCategory}
                  <button type="button" onClick={() => onSelectCategory('All Categories')}>
                    <X className="w-3 h-3 text-stone-500 hover:text-black" />
                  </button>
                </span>
              )}
              {selectedStores.map((sk) => {
                const storeObj = stores.find((s) => s.key === sk);
                return (
                  <span
                    key={sk}
                    className="inline-flex items-center gap-1 px-2 py-0.5 border border-black bg-[#F5F5F5] text-black uppercase font-bold text-[10px]"
                  >
                    {storeObj?.name || sk}
                    <button type="button" onClick={() => onToggleStore(sk)}>
                      <X className="w-3 h-3 text-stone-500 hover:text-black" />
                    </button>
                  </span>
                );
              })}
              {selectedGender !== 'All' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 border border-black bg-[#F5F5F5] text-black uppercase font-bold text-[10px]">
                  {selectedGender}
                  <button type="button" onClick={() => onSelectGender('All')}>
                    <X className="w-3 h-3 text-stone-500 hover:text-black" />
                  </button>
                </span>
              )}
              {minDiscount > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 border border-black bg-[#F5F5F5] text-black uppercase font-bold text-[10px]">
                  {minDiscount}%+ Off
                  <button type="button" onClick={() => onSetMinDiscount(0)}>
                    <X className="w-3 h-3 text-stone-500 hover:text-black" />
                  </button>
                </span>
              )}
            </div>

            <button
              type="button"
              id="reset-all-filters-btn"
              onClick={onResetFilters}
              className="text-xs font-sans font-bold uppercase tracking-wider text-[#CC0000] hover:underline"
            >
              Clear All Criteria
            </button>
          </div>
        )}
      </div>

      {/* Grid Results Header */}
      <div className="flex items-center justify-between px-1 border-b border-black pb-2">
        <p className="text-xs sm:text-sm font-sans uppercase tracking-[0.15em] text-stone-500">
          Showing <span className="text-black font-bold font-serif">{items.length}</span> Verified Markdown Pieces
        </p>
      </div>

      {/* Product Card Grid */}
      {items.length === 0 ? (
        <div className="bg-white border border-black p-12 text-center">
          <div className="w-12 h-12 border border-black text-black flex items-center justify-center mx-auto mb-3">
            <Tag className="w-5 h-5" />
          </div>
          <h4 className="font-serif font-bold text-lg uppercase text-black mb-1">No items meet current criteria</h4>
          <p className="font-sans text-stone-500 text-xs max-w-sm mx-auto mb-4 leading-relaxed">
            Modify retailer selections, markdown percentages, or category filters to expand the archive.
          </p>
          <button
            type="button"
            onClick={onResetFilters}
            className="inline-flex items-center gap-1.5 px-5 py-2 border border-black bg-black text-white hover:bg-white hover:text-black uppercase text-xs font-sans font-bold tracking-widest transition-colors"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
          {uniqueItems.map((item) => (
            <ProductCard
              key={item.id}
              item={item}
              onQuickView={onQuickView}
              onToggleSave={onToggleSave}
              isSaved={savedItemIds.has(item.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
};
