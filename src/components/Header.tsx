import React from 'react';
import {
  Search,
  RefreshCw,
  Bookmark,
  Sparkles,
  SlidersHorizontal,
} from 'lucide-react';
import { ViewMode } from '../types';

interface HeaderProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSyncLive: () => void;
  isSyncing: boolean;
  lastSynced: string;
  totalDealsCount: number;
  savedCount: number;
  onOpenSaved: () => void;
  onOpenAiSearch: () => void;
  onToggleMobileFilters?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  viewMode,
  onViewModeChange,
  searchQuery,
  onSearchChange,
  onSyncLive,
  isSyncing,
  lastSynced,
  totalDealsCount,
  savedCount,
  onOpenSaved,
  onOpenAiSearch,
  onToggleMobileFilters,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-white border-b-2 border-black">
      {/* Top Editorial Dispatch Bar */}
      <div className="bg-black text-white text-[10px] sm:text-[11px] font-sans font-bold uppercase tracking-[0.25em] py-1.5 px-4 sm:px-8 border-b border-black">
        <div className="max-w-7xl mx-auto flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-block w-1.5 h-1.5 bg-[#CC0000]"></span>
            <span>Live Retail Dispatch:</span>
            <span className="text-stone-300 font-normal tracking-[0.15em]">
              Woolworths • Markham • Mr Price • Foschini • Superbalist • Truworths
            </span>
          </div>

          <div className="flex items-center gap-4 text-stone-400">
            <span>{totalDealsCount} Verified Markdowns</span>
            <span className="hidden sm:inline">|</span>
            <span className="hidden sm:inline">Currency: ZAR (R)</span>
          </div>
        </div>
      </div>

      {/* Main Editorial Masthead */}
      <div className="max-w-7xl mx-auto px-4 sm:px-8 pt-4 pb-4">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-stone-200">
          {/* Masthead Branding */}
          <div className="flex flex-col">
            <span className="text-[10px] sm:text-xs uppercase tracking-[0.3em] font-sans font-bold text-stone-500 mb-1">
              Vol. 14 — Verified Clearance Index
            </span>
            <a href="/" className="group inline-block">
              <h1 className="text-4xl sm:text-6xl md:text-7xl font-black leading-none tracking-tighter uppercase font-serif text-[#1A1A1A]">
                Haute Deals
              </h1>
            </a>
          </div>

          {/* Right: Editorial View Mode Switch & Tagline */}
          <div className="flex flex-col md:items-end gap-2">
            <div className="flex items-center gap-6">
              <button
                type="button"
                id="view-mode-store-btn"
                onClick={() => onViewModeChange('store')}
                className={`text-xs sm:text-sm uppercase tracking-widest font-sans font-bold pb-1 transition-all ${
                  viewMode === 'store'
                    ? 'border-b-2 border-black text-black'
                    : 'text-stone-400 opacity-40 hover:opacity-100'
                }`}
              >
                By Store
              </button>

              <button
                type="button"
                id="view-mode-product-btn"
                onClick={() => onViewModeChange('product')}
                className={`text-xs sm:text-sm uppercase tracking-widest font-sans font-bold pb-1 transition-all ${
                  viewMode === 'product'
                    ? 'border-b-2 border-black text-black'
                    : 'text-stone-400 opacity-40 hover:opacity-100'
                }`}
              >
                By Product
              </button>
            </div>

            <p className="text-xs font-sans text-stone-500 md:text-right italic max-w-[280px] leading-relaxed">
              Curating the finest markdowns across South Africa&apos;s leading fashion houses.
            </p>
          </div>
        </div>

        {/* Editorial Utility & Search Strip */}
        <div className="pt-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search Bar */}
          <div className="relative flex-1 max-w-xl">
            <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              id="global-deals-search-input"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search by silhouette, designer, or retailer..."
              className="w-full pl-8 pr-8 py-2 text-xs font-sans bg-[#FBFBFB] hover:bg-white focus:bg-white border border-black focus:outline-none placeholder:text-stone-400 tracking-wide"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-black text-xs font-sans font-bold"
              >
                ✕
              </button>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap justify-end">
            {/* Mobile Filters Trigger */}
            {onToggleMobileFilters && (
              <button
                type="button"
                id="mobile-filters-trigger"
                onClick={onToggleMobileFilters}
                className="p-2 border border-black bg-white text-black sm:hidden"
                title="Filter deals"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
              </button>
            )}

            {/* AI Finder */}
            <button
              type="button"
              id="ai-deal-finder-btn"
              onClick={onOpenAiSearch}
              className="inline-flex items-center gap-1.5 px-3 py-2 border border-black bg-white hover:bg-black hover:text-white text-black text-[11px] font-sans font-bold uppercase tracking-wider transition-colors"
              title="Search South African stores live with AI"
            >
              <Sparkles className="w-3 h-3 text-[#CC0000]" />
              <span>AI Finder</span>
            </button>

            {/* Sync Live */}
            <button
              type="button"
              id="sync-live-deals-btn"
              onClick={onSyncLive}
              disabled={isSyncing}
              className="inline-flex items-center gap-1.5 px-3 py-2 border border-black bg-white hover:bg-black hover:text-white disabled:bg-stone-100 disabled:text-stone-400 text-black text-[11px] font-sans font-bold uppercase tracking-wider transition-colors"
              title="Sync live retail prices"
            >
              <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin text-[#CC0000]' : ''}`} />
              <span>{isSyncing ? 'Syncing...' : 'Sync'}</span>
            </button>

            {/* Saved Wishlist */}
            <button
              type="button"
              id="desktop-saved-btn"
              onClick={onOpenSaved}
              className="inline-flex items-center gap-1.5 px-3 py-2 border border-black bg-black text-white hover:bg-stone-800 text-[11px] font-sans font-bold uppercase tracking-wider transition-colors relative"
              title="Saved editorial pieces"
            >
              <Bookmark className={`w-3 h-3 ${savedCount > 0 ? 'fill-[#CC0000] text-[#CC0000]' : 'text-white'}`} />
              <span>Saved</span>
              {savedCount > 0 && (
                <span className="ml-0.5 px-1.5 py-0.2 text-[10px] font-bold bg-[#CC0000] text-white">
                  {savedCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

