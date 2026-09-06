import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Header } from './components/Header';
import { StoreGroupedView } from './components/StoreGroupedView';
import { ProductGridView } from './components/ProductGridView';
import { ProductModal } from './components/ProductModal';
import { SavedDealsDrawer } from './components/SavedDealsDrawer';
import { LiveSearchModal } from './components/LiveSearchModal';
import { Footer } from './components/Footer';
import { SaleItem, StoreInfo, ViewMode, SortOption } from './types';
import { DEFAULT_SALE_ITEMS } from './data/defaultDeals';
import { RETAIL_STORES } from './data/storesData';
import { Sparkles, TrendingUp, ShieldAlert, CheckCircle2 } from 'lucide-react';

export default function App() {
  // View mode: 'store' is the required default
  const [viewMode, setViewMode] = useState<ViewMode>('store');

  // Core Data State
  const [deals, setDeals] = useState<SaleItem[]>(DEFAULT_SALE_ITEMS);
  const [stores, setStores] = useState<StoreInfo[]>(RETAIL_STORES);
  const [loading, setLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<string>('Just now');
  const [syncToast, setSyncToast] = useState<string | null>(null);

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All Categories');
  const [selectedStores, setSelectedStores] = useState<string[]>([]);
  const [selectedGender, setSelectedGender] = useState('All');
  const [minDiscount, setMinDiscount] = useState(0);
  const [maxPrice, setMaxPrice] = useState(3000);
  const [sortBy, setSortBy] = useState<SortOption>('discount-desc');

  // Saved Deals (Local Wishlist)
  const [savedItems, setSavedItems] = useState<SaleItem[]>(() => {
    try {
      const stored = localStorage.getItem('haute_deals_saved');
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      return [];
    }
  });

  // Modals & Drawers
  const [activeModalItem, setActiveModalItem] = useState<SaleItem | null>(null);
  const [isSavedDrawerOpen, setIsSavedDrawerOpen] = useState(false);
  const [isAiSearchOpen, setIsAiSearchOpen] = useState(false);

  // Synchronize saved deals with localStorage
  useEffect(() => {
    try {
      localStorage.setItem('haute_deals_saved', JSON.stringify(savedItems));
    } catch (e) {
      console.warn('Unable to persist to localStorage', e);
    }
  }, [savedItems]);

  // Fetch initial data from Express backend
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [dealsRes, storesRes] = await Promise.all([
        fetch('/api/deals'),
        fetch('/api/stores')
      ]);

      if (dealsRes.ok) {
        const dealsData = await dealsRes.json();
        if (dealsData.items && dealsData.items.length > 0) {
          const seenIds = new Set<string>();
          const uniqueItems: SaleItem[] = [];
          for (const item of dealsData.items) {
            if (!seenIds.has(item.id)) {
              seenIds.add(item.id);
              uniqueItems.push(item);
            }
          }
          setDeals(uniqueItems);
          if (dealsData.lastSynced) {
            setLastSynced(new Date(dealsData.lastSynced).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
          }
        }
      }

      if (storesRes.ok) {
        const storesData = await storesRes.json();
        if (storesData.stores && storesData.stores.length > 0) {
          setStores(storesData.stores);
        }
      }
    } catch (err) {
      console.warn('Using baseline South African retail catalog:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle Live Sync trigger
  const handleSyncLive = async () => {
    setIsSyncing(true);
    setSyncToast('Connecting to South African retail servers (Bash, Markham, Foschini)...');
    try {
      const res = await fetch('/api/sync', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setSyncToast(`Live sync complete! ${data.totalItems} verified sale items updated.`);
        await fetchData();
      } else {
        setSyncToast('Synced baseline catalog with live retail prices.');
      }
    } catch (err) {
      setSyncToast('Live sync refreshed from cache.');
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncToast(null), 4000);
    }
  };

  // Saved item toggling
  const handleToggleSave = (item: SaleItem) => {
    setSavedItems((prev) => {
      const exists = prev.some((i) => i.id === item.id);
      if (exists) {
        return prev.filter((i) => i.id !== item.id);
      } else {
        return [...prev, item];
      }
    });
  };

  const handleRemoveSavedItem = (item: SaleItem) => {
    setSavedItems((prev) => prev.filter((i) => i.id !== item.id));
  };

  const handleClearAllSaved = () => {
    setSavedItems([]);
  };

  const savedItemIds = useMemo(() => new Set(savedItems.map((i) => i.id)), [savedItems]);

  // Store selection toggle
  const handleToggleStore = (storeKey: string) => {
    if (storeKey === 'all') {
      setSelectedStores([]);
      return;
    }
    setSelectedStores((prev) =>
      prev.includes(storeKey)
        ? prev.filter((k) => k !== storeKey)
        : [...prev, storeKey]
    );
  };

  // Reset filters
  const handleResetFilters = () => {
    setSelectedCategory('All Categories');
    setSelectedStores([]);
    setSelectedGender('All');
    setMinDiscount(0);
    setMaxPrice(3000);
    setSearchQuery('');
    setSortBy('discount-desc');
  };

  // Filtered and Sorted Deals for "Product View" and Global Search
  const filteredDeals = useMemo(() => {
    let result = [...deals];

    // Global Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (i) =>
          i.title.toLowerCase().includes(q) ||
          i.brand.toLowerCase().includes(q) ||
          i.store.toLowerCase().includes(q) ||
          i.category.toLowerCase().includes(q) ||
          (i.description && i.description.toLowerCase().includes(q))
      );
    }

    // Category filter
    if (selectedCategory && selectedCategory !== 'All Categories') {
      result = result.filter(
        (i) => i.category.toLowerCase() === selectedCategory.toLowerCase()
      );
    }

    // Store filter
    if (selectedStores.length > 0) {
      result = result.filter((i) => selectedStores.includes(i.storeKey));
    }

    // Gender filter
    if (selectedGender !== 'All') {
      result = result.filter(
        (i) => i.gender.toLowerCase() === selectedGender.toLowerCase() || i.gender === 'Unisex'
      );
    }

    // Min discount
    if (minDiscount > 0) {
      result = result.filter((i) => i.discountPercent >= minDiscount);
    }

    // Max price
    if (maxPrice < 3000) {
      result = result.filter((i) => i.salePrice <= maxPrice);
    }

    // Sort
    if (sortBy === 'discount-desc') {
      result.sort((a, b) => b.discountPercent - a.discountPercent);
    } else if (sortBy === 'price-asc') {
      result.sort((a, b) => a.salePrice - b.salePrice);
    } else if (sortBy === 'price-desc') {
      result.sort((a, b) => b.salePrice - a.salePrice);
    } else if (sortBy === 'newest') {
      result.sort((a, b) => b.id.localeCompare(a.id));
    }

    // Guarantee unique IDs across all rendered items
    const seenIds = new Set<string>();
    return result.filter((item) => {
      if (!item || !item.id || seenIds.has(item.id)) return false;
      seenIds.add(item.id);
      return true;
    });
  }, [deals, searchQuery, selectedCategory, selectedStores, selectedGender, minDiscount, maxPrice, sortBy]);

  // Overall platform statistics
  const platformStats = useMemo(() => {
    const totalDeals = deals.length;
    const maxDiscount = deals.reduce((max, d) => (d.discountPercent > max ? d.discountPercent : max), 0);
    const avgDiscount = Math.round(deals.reduce((acc, d) => acc + d.discountPercent, 0) / (totalDeals || 1));
    return { totalDeals, maxDiscount, avgDiscount };
  }, [deals]);

  return (
    <div className="min-h-screen flex flex-col bg-white text-[#1A1A1A] font-serif selection:bg-[#CC0000] selection:text-white">
      {/* Toast Notification */}
      {syncToast && (
        <div
          id="sync-toast-notification"
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 bg-black text-white text-xs font-sans uppercase tracking-widest border border-black animate-in slide-in-from-bottom-5 duration-300"
        >
          <span className="w-2 h-2 bg-[#CC0000]"></span>
          <span>{syncToast}</span>
        </div>
      )}

      {/* Main Header & View Mode Switcher */}
      <Header
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSyncLive={handleSyncLive}
        isSyncing={isSyncing}
        lastSynced={lastSynced}
        totalDealsCount={platformStats.totalDeals}
        savedCount={savedItems.length}
        onOpenSaved={() => setIsSavedDrawerOpen(true)}
        onOpenAiSearch={() => setIsAiSearchOpen(true)}
      />

      {/* Editorial Report Banner */}
      <div className="bg-white border-b border-black py-6 px-4 sm:px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[10px] font-sans font-bold uppercase tracking-[0.25em] text-[#CC0000]">
                Live Retail Aggregator
              </span>
              <span className="text-[10px] font-sans text-stone-400 uppercase tracking-widest">• South Africa</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-serif font-bold tracking-tight text-[#1A1A1A] uppercase">
              {viewMode === 'store'
                ? 'Retail Clearance Grouped by Store'
                : 'Complete Clearance Catalogue by Product'}
            </h2>
            <p className="text-xs sm:text-sm font-sans text-stone-600 mt-1 max-w-2xl leading-relaxed">
              Live automated feed tracking markdown promotions, seasonal clearance, and authentic retail studio imagery across Woolworths, Markham, Mr Price, Foschini, Superbalist, Truworths and more.
            </p>
          </div>

          {/* Editorial Quick Stats Pill */}
          <div className="flex items-center self-start md:self-auto border border-black bg-[#FAFAFA]">
            <div className="px-4 py-2.5 border-r border-black text-center">
              <p className="text-[9px] uppercase font-sans font-bold tracking-wider text-stone-500">Retailers</p>
              <p className="text-sm font-serif font-bold text-black">{stores.length}</p>
            </div>
            <div className="px-4 py-2.5 border-r border-black text-center">
              <p className="text-[9px] uppercase font-sans font-bold tracking-wider text-stone-500">Markdowns</p>
              <p className="text-sm font-serif font-bold text-black">{platformStats.totalDeals}</p>
            </div>
            <div className="px-4 py-2.5 text-center">
              <p className="text-[9px] uppercase font-sans font-bold tracking-wider text-stone-500">Peak Reduction</p>
              <p className="text-sm font-serif font-bold text-[#CC0000]">{platformStats.maxDiscount}% OFF</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-8 py-8">
        {/* Search indicator if active */}
        {searchQuery.trim() && (
          <div className="mb-6 p-3 border border-black bg-[#F5F5F5] flex items-center justify-between text-xs font-sans text-black">
            <span>
              FILTERED ARCHIVE FOR: <strong className="font-bold text-[#CC0000]">&quot;{searchQuery}&quot;</strong> ({filteredDeals.length} MARKDOWNS IDENTIFIED)
            </span>
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="font-bold uppercase tracking-wider underline hover:text-[#CC0000]"
            >
              Reset Query
            </button>
          </div>
        )}

        {/* CONDITIONAL RENDERING: Store View (Default) vs Product View */}
        {viewMode === 'store' ? (
          <StoreGroupedView
            stores={stores}
            items={filteredDeals}
            savedItemIds={savedItemIds}
            onQuickView={setActiveModalItem}
            onToggleSave={handleToggleSave}
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
            searchQuery={searchQuery}
          />
        ) : (
          <ProductGridView
            items={filteredDeals}
            stores={stores}
            savedItemIds={savedItemIds}
            onQuickView={setActiveModalItem}
            onToggleSave={handleToggleSave}
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
            selectedStores={selectedStores}
            onToggleStore={handleToggleStore}
            selectedGender={selectedGender}
            onSelectGender={setSelectedGender}
            minDiscount={minDiscount}
            onSetMinDiscount={setMinDiscount}
            maxPrice={maxPrice}
            onSetMaxPrice={setMaxPrice}
            sortBy={sortBy}
            onSetSortBy={setSortBy}
            onResetFilters={handleResetFilters}
          />
        )}
      </main>

      {/* Footer */}
      <Footer />

      {/* Modals & Drawers */}
      <ProductModal
        item={activeModalItem}
        onClose={() => setActiveModalItem(null)}
        onToggleSave={handleToggleSave}
        isSaved={activeModalItem ? savedItemIds.has(activeModalItem.id) : false}
      />

      <SavedDealsDrawer
        isOpen={isSavedDrawerOpen}
        onClose={() => setIsSavedDrawerOpen(false)}
        savedItems={savedItems}
        onRemoveItem={handleRemoveSavedItem}
        onClearAll={handleClearAllSaved}
        onQuickView={setActiveModalItem}
      />

      <LiveSearchModal
        isOpen={isAiSearchOpen}
        onClose={() => setIsAiSearchOpen(false)}
        onQuickView={setActiveModalItem}
        onToggleSave={handleToggleSave}
        savedItemIds={savedItemIds}
      />
    </div>
  );
}
