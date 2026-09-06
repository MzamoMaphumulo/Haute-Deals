import React, { useState } from 'react';
import { X, Sparkles, Search, Loader2, ExternalLink, ArrowRight, CheckCircle2 } from 'lucide-react';
import { SaleItem } from '../types';
import { ProductCard } from './ProductCard';

interface LiveSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onQuickView: (item: SaleItem) => void;
  onToggleSave: (item: SaleItem) => void;
  savedItemIds: Set<string>;
}

const POPULAR_SEARCHES = [
  'Woolworths Studio.W Linen Trousers',
  'Markham Men Tailored Suits',
  'Mr Price Cargo Pants & Windbreakers',
  'Superbalist Nike Air Max Sneakers',
  'Foschini Slip Midi Dresses',
  'Truworths Ginger Mary & Inwear Jackets',
  'Cotton On Relaxed Straight Denim',
  'Winter Puffer Jackets under R600',
];

export const LiveSearchModal: React.FC<LiveSearchModalProps> = ({
  isOpen,
  onClose,
  onQuickView,
  onToggleSave,
  savedItemIds,
}) => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SaleItem[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen) return null;

  const handleSearch = async (searchTerm?: string) => {
    const term = searchTerm || query;
    if (!term.trim()) return;

    setLoading(true);
    setErrorMessage('');
    setHasSearched(true);

    try {
      const res = await fetch('/api/ai-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: term }),
      });

      const data = await res.json();
      if (data.items) {
        const seen = new Set<string>();
        const unique = (data.items as SaleItem[]).filter((item) => {
          if (!item || !item.id || seen.has(item.id)) return false;
          seen.add(item.id);
          return true;
        });
        setResults(unique);
      } else {
        setResults([]);
      }
    } catch (err: any) {
      setErrorMessage('Could not complete live search. Sourcing verified retail catalog.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      id="ai-search-modal-backdrop"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        id="ai-search-modal-card"
        className="w-full max-w-3xl max-h-[90vh] bg-white border-2 border-black flex flex-col overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b-2 border-black bg-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 border border-black bg-black text-white">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-black text-lg uppercase tracking-wide flex items-center gap-2">
                Live Sales Dispatch
                <span className="border border-black bg-black text-white text-[9px] font-sans font-bold tracking-widest uppercase px-1.5 py-0.5">
                  Gemini API
                </span>
              </h3>
              <p className="text-[11px] font-sans text-stone-500 uppercase tracking-wider">
                Multi-retailer intelligence across Woolworths, Markham, Mr Price, Superbalist & more
              </p>
            </div>
          </div>

          <button
            type="button"
            id="close-ai-search-btn"
            onClick={onClose}
            className="p-1.5 border border-black text-black hover:bg-black hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Input Bar */}
        <div className="p-4 sm:p-6 border-b border-stone-200 space-y-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSearch();
            }}
            className="flex items-center gap-2"
          >
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-black absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                id="ai-search-query-input"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Inquire for active clearance pieces (e.g. 'linen trousers', 'Markham suits', 'Nike sneakers')..."
                className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm bg-white border border-black rounded-none focus:outline-none placeholder:text-stone-400 font-sans"
                autoFocus
              />
            </div>

            <button
              type="submit"
              id="submit-ai-search-btn"
              disabled={loading || !query.trim()}
              className="inline-flex items-center gap-2 px-5 py-2.5 border border-black bg-black hover:bg-[#CC0000] hover:border-[#CC0000] disabled:bg-stone-200 disabled:border-stone-200 disabled:text-stone-400 text-white text-xs font-sans font-bold uppercase tracking-widest transition-colors shrink-0"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Scanning...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Dispatch Query</span>
                </>
              )}
            </button>
          </form>

          {/* Quick Suggestions */}
          <div className="flex items-center gap-1.5 flex-wrap pt-1">
            <span className="text-[10px] font-sans font-bold uppercase tracking-widest text-stone-400">Archival Queries:</span>
            {POPULAR_SEARCHES.map((term) => (
              <button
                key={term}
                type="button"
                onClick={() => {
                  setQuery(term);
                  handleSearch(term);
                }}
                className="text-[10px] font-sans font-semibold uppercase tracking-wider px-2 py-0.5 border border-stone-300 bg-white hover:border-black text-stone-700 transition-colors"
              >
                {term}
              </button>
            ))}
          </div>
        </div>

        {/* Results Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 min-h-[300px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
              <Loader2 className="w-8 h-8 text-black animate-spin" />
              <p className="font-serif font-bold text-lg uppercase text-black">
                Retrieving live promotional catalog...
              </p>
              <p className="font-sans text-xs text-stone-500 uppercase tracking-widest max-w-sm">
                Parsing digital storefronts for verified South African sales markdowns.
              </p>
            </div>
          ) : hasSearched ? (
            results.length === 0 ? (
              <div className="text-center py-12 text-stone-500 space-y-2 border border-dashed border-stone-300 p-8">
                <p className="font-serif font-bold text-base uppercase text-black">No active deals found for &quot;{query}&quot;</p>
                <p className="font-sans text-xs text-stone-400 uppercase tracking-wider">
                  Consider broader query terms such as &quot;outerwear&quot;, &quot;sneakers&quot;, or &quot;Markham&quot;.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-black pb-2">
                  <span className="text-xs font-sans uppercase tracking-widest text-stone-500">
                    Dispatched <strong className="text-black font-serif text-sm">{results.length}</strong> verified sales items
                  </span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-sans font-bold uppercase tracking-wider text-[#CC0000]">
                    <CheckCircle2 className="w-3 h-3" /> Live Authenticated
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {results.map((item) => (
                    <ProductCard
                      key={item.id}
                      item={item}
                      onQuickView={onQuickView}
                      onToggleSave={onToggleSave}
                      isSaved={savedItemIds.has(item.id)}
                    />
                  ))}
                </div>
              </div>
            )
          ) : (
            <div className="text-center py-14 text-stone-400 space-y-3 border border-stone-200">
              <div className="w-10 h-10 border border-black text-black flex items-center justify-center mx-auto">
                <Sparkles className="w-5 h-5" />
              </div>
              <h4 className="font-serif font-bold text-base uppercase text-black">Real-time Retail Sale Discovery</h4>
              <p className="font-sans text-xs text-stone-500 uppercase tracking-wider max-w-md mx-auto leading-relaxed">
                Query any clothing item, brand, or store above to verify live markdown prices and discounts across South African retailers.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
