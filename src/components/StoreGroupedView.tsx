import React, { useState } from 'react';
import { ExternalLink, ChevronDown, ChevronUp, Sparkles, Tag } from 'lucide-react';
import { SaleItem, StoreInfo } from '../types';
import { ProductCard } from './ProductCard';

interface StoreGroupedViewProps {
  stores: StoreInfo[];
  items: SaleItem[];
  savedItemIds: Set<string>;
  onQuickView: (item: SaleItem) => void;
  onToggleSave: (item: SaleItem) => void;
  selectedCategory: string;
  onSelectCategory: (cat: string) => void;
  searchQuery: string;
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

export const StoreGroupedView: React.FC<StoreGroupedViewProps> = ({
  stores,
  items,
  savedItemIds,
  onQuickView,
  onToggleSave,
  selectedCategory,
  onSelectCategory,
  searchQuery,
}) => {
  // Store expanded states for items beyond the initial 4-8
  const [expandedStores, setExpandedStores] = useState<Record<string, boolean>>({});

  const toggleStoreExpand = (storeKey: string) => {
    setExpandedStores((prev) => ({
      ...prev,
      [storeKey]: !prev[storeKey],
    }));
  };

  // Group items by storeKey
  const itemsByStore = stores.map((store) => {
    let storeItems = items.filter((item) => item.storeKey === store.key);

    if (selectedCategory && selectedCategory !== 'All Categories') {
      storeItems = storeItems.filter(
        (item) => item.category.toLowerCase() === selectedCategory.toLowerCase()
      );
    }

    // Guarantee unique items per store section
    const seenIds = new Set<string>();
    storeItems = storeItems.filter((item) => {
      if (!item || !item.id || seenIds.has(item.id)) return false;
      seenIds.add(item.id);
      return true;
    });

    return {
      store,
      items: storeItems,
      totalCount: storeItems.length,
    };
  });

  const scrollToStore = (storeKey: string) => {
    const el = document.getElementById(`store-section-${storeKey}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div id="store-grouped-view-container" className="space-y-8">
      {/* Category Quick Filter Strip */}
      <div className="border-b border-black pb-4 mb-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2 text-xs font-sans font-bold uppercase tracking-[0.2em] text-stone-500">
            <Tag className="w-3 h-3 text-black" />
            <span>Category Filter:</span>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full no-scrollbar">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                id={`cat-filter-${cat.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
                onClick={() => onSelectCategory(cat)}
                className={`px-3 py-1 text-xs font-sans font-bold uppercase tracking-wider whitespace-nowrap transition-colors border ${
                  selectedCategory === cat || (cat === 'All Categories' && (!selectedCategory || selectedCategory === 'All Categories'))
                    ? 'border-black bg-black text-white'
                    : 'border-stone-300 bg-white text-stone-600 hover:border-black hover:text-black'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Editorial Body: Store Index Sidebar + Store Editorial Sections */}
      <div className="flex flex-col lg:flex-row items-start gap-8 lg:gap-10">
        {/* Left Column: Store Index (Editorial Navigation) */}
        <aside className="w-full lg:w-1/4 lg:sticky lg:top-36 self-start lg:border-r border-black lg:pr-8 pb-6 lg:pb-0 space-y-8">
          <div className="space-y-4">
            <h3 className="text-xs uppercase tracking-[0.25em] font-sans font-bold text-stone-400">
              Retail Directory Index
            </h3>
            <ul className="space-y-3">
              {stores.map((store) => {
                const storeCount = items.filter((i) => i.storeKey === store.key).length;
                return (
                  <li
                    key={store.key}
                    onClick={() => scrollToStore(store.key)}
                    className="group flex justify-between items-baseline cursor-pointer border-b border-stone-100 pb-1.5 hover:border-black transition-colors"
                  >
                    <span className="text-lg font-serif font-bold text-[#1A1A1A] group-hover:text-[#CC0000] transition-colors">
                      {store.name}
                    </span>
                    <span className="text-xs font-sans text-stone-400 group-hover:text-black">
                      ({storeCount})
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="pt-6 border-t border-black hidden lg:block">
            <p className="text-[10px] uppercase leading-relaxed font-sans tracking-tight text-stone-500">
              Live retail dispatch active: Sourced from official South African retail gateways. Real-time markdown pricing verified.
            </p>
          </div>
        </aside>

        {/* Right Column: Grouped Store Markdown Sections */}
        <div className="w-full lg:w-3/4 space-y-16">
          {itemsByStore.map(({ store, items: storeItems, totalCount }) => {
            const isExpanded = !!expandedStores[store.key];
            const displayedItems = isExpanded ? storeItems : storeItems.slice(0, 4);

            return (
              <section
                key={store.key}
                id={`store-section-${store.key}`}
                className="scroll-mt-36 flex flex-col"
              >
                {/* Store Section Editorial Header */}
                <div className="flex flex-col sm:flex-row sm:items-baseline justify-between mb-6 border-b-2 border-black pb-3 gap-3">
                  <div>
                    <h2 className="text-2xl sm:text-4xl font-serif font-bold tracking-tight text-[#1A1A1A] uppercase">
                      {store.name}
                      <span className="text-sm sm:text-base font-serif font-normal italic opacity-60 ml-2 normal-case">
                        {store.activeSalePromo}
                      </span>
                    </h2>
                    <p className="text-xs font-sans text-stone-500 mt-1 uppercase tracking-wide">
                      {totalCount} Verified items on promotion • {store.tagline}
                    </p>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    <span className="text-xs sm:text-sm uppercase tracking-widest font-sans font-bold text-[#CC0000]">
                      Up to {store.maxDiscount}% OFF
                    </span>

                    <a
                      id={`visit-store-${store.key}-link`}
                      href={store.saleUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] font-sans font-bold uppercase tracking-wider underline hover:text-[#CC0000] inline-flex items-center gap-1"
                    >
                      <span>Store Portal</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>

                {/* Store Product Grid */}
                {storeItems.length === 0 ? (
                  <div className="py-12 text-center text-stone-400 border border-stone-200">
                    <p className="text-xs sm:text-sm font-sans uppercase tracking-widest">
                      No current markdowns listed for {store.name} in this classification.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
                      {displayedItems.map((item) => (
                        <ProductCard
                          key={item.id}
                          item={item}
                          onQuickView={onQuickView}
                          onToggleSave={onToggleSave}
                          isSaved={savedItemIds.has(item.id)}
                        />
                      ))}
                    </div>

                    {/* Expand / Show More Items Toggle */}
                    {storeItems.length > 4 && (
                      <div className="mt-8 flex justify-center">
                        <button
                          type="button"
                          id={`toggle-expand-${store.key}`}
                          onClick={() => toggleStoreExpand(store.key)}
                          className="inline-flex items-center gap-2 px-6 py-2.5 border border-black bg-white hover:bg-black hover:text-white text-black text-xs font-sans font-bold uppercase tracking-widest transition-colors"
                        >
                          {isExpanded ? (
                            <>
                              <span>Collapse Archive</span>
                              <ChevronUp className="w-3.5 h-3.5" />
                            </>
                          ) : (
                            <>
                              <span>View Entire Selection ({storeItems.length} Pieces)</span>
                              <ChevronDown className="w-3.5 h-3.5" />
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
};
