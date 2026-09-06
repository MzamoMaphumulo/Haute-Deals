import React from 'react';
import { X, Trash2, ExternalLink, BookmarkCheck, ArrowRight } from 'lucide-react';
import { SaleItem } from '../types';

interface SavedDealsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  savedItems: SaleItem[];
  onRemoveItem: (item: SaleItem) => void;
  onClearAll: () => void;
  onQuickView: (item: SaleItem) => void;
}

export const SavedDealsDrawer: React.FC<SavedDealsDrawerProps> = ({
  isOpen,
  onClose,
  savedItems,
  onRemoveItem,
  onClearAll,
  onQuickView,
}) => {
  if (!isOpen) return null;

  const uniqueSavedItems = React.useMemo(() => {
    const seen = new Set<string>();
    return savedItems.filter((item) => {
      if (!item || !item.id || seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  }, [savedItems]);

  const totalSavedValue = uniqueSavedItems.reduce((acc, curr) => acc + curr.savings, 0);
  const totalSaleValue = uniqueSavedItems.reduce((acc, curr) => acc + curr.salePrice, 0);

  return (
    <div
      id="saved-deals-drawer-backdrop"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex justify-end animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        id="saved-deals-drawer-content"
        className="w-full max-w-md bg-white h-full border-l-2 border-black shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="p-4 sm:p-5 border-b-2 border-black flex items-center justify-between bg-white">
          <div className="flex items-center gap-2.5">
            <BookmarkCheck className="w-5 h-5 text-[#CC0000]" />
            <h3 className="font-serif font-bold text-black text-lg uppercase tracking-wide">Archived Selection</h3>
            <span className="px-2 py-0.5 border border-black text-xs font-sans font-bold">
              {savedItems.length}
            </span>
          </div>

          <button
            type="button"
            id="close-saved-drawer-btn"
            onClick={onClose}
            className="p-1 border border-black text-black hover:bg-black hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Savings Summary Banner */}
        {savedItems.length > 0 && (
          <div className="p-4 bg-black text-white border-b border-black flex items-center justify-between text-xs font-sans uppercase">
            <div>
              <p className="font-bold tracking-widest text-stone-300 text-[10px]">Accumulated Savings</p>
              <p className="text-white font-serif text-sm">
                Cart Total: R{totalSaleValue.toLocaleString('en-ZA', { minimumFractionDigits: 0 })}
              </p>
            </div>
            <span className="px-3 py-1 bg-[#CC0000] text-white font-sans font-bold text-xs tracking-wider">
              Save R{Math.round(totalSavedValue).toLocaleString('en-ZA')}
            </span>
          </div>
        )}

        {/* Deals List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {uniqueSavedItems.length === 0 ? (
            <div className="text-center py-16 px-4 border border-dashed border-stone-300 m-2">
              <div className="w-12 h-12 border border-black text-black flex items-center justify-center mx-auto mb-3">
                <BookmarkCheck className="w-5 h-5" />
              </div>
              <h4 className="font-serif font-bold text-base uppercase text-black mb-1">Archive is Empty</h4>
              <p className="text-stone-500 font-sans text-xs max-w-xs mx-auto leading-relaxed">
                Bookmark pieces from Woolworths, Markham, Mr Price, Superbalist, and more to monitor ongoing clearance events.
              </p>
            </div>
          ) : (
            uniqueSavedItems.map((item) => (
              <div
                key={item.id}
                id={`saved-item-${item.id}`}
                className="flex items-center gap-3 p-3 border border-black bg-white group hover:border-[#CC0000] transition-colors"
              >
                <img
                  src={item.imageUrl}
                  alt={item.title}
                  referrerPolicy="no-referrer"
                  className="w-16 h-20 object-cover bg-stone-100 shrink-0 cursor-pointer border border-stone-200"
                  onClick={() => onQuickView(item)}
                />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-sans font-bold uppercase tracking-wider text-[#CC0000]">
                      {item.store}
                    </span>
                    <span className="text-[10px] font-sans font-bold bg-black text-white px-1">
                      -{item.discountPercent}%
                    </span>
                  </div>

                  <h5
                    onClick={() => onQuickView(item)}
                    className="text-xs font-serif font-bold text-black uppercase truncate cursor-pointer hover:text-[#CC0000] transition-colors"
                  >
                    {item.title}
                  </h5>

                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-sm font-serif font-bold text-black">
                      R{item.salePrice.toLocaleString('en-ZA')}
                    </span>
                    {item.originalPrice > item.salePrice && (
                      <span className="text-xs font-serif text-stone-400 line-through">
                        R{item.originalPrice.toLocaleString('en-ZA')}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 mt-2">
                    <a
                      href={item.productUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] font-sans font-bold uppercase tracking-wider text-black underline hover:text-[#CC0000] flex items-center gap-1"
                    >
                      <span>Retail Link</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>
                </div>

                <button
                  type="button"
                  id={`remove-saved-btn-${item.id}`}
                  onClick={() => onRemoveItem(item)}
                  title="Remove from Archive"
                  className="p-1.5 text-stone-400 hover:text-[#CC0000] transition-colors shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Drawer Footer */}
        {savedItems.length > 0 && (
          <div className="p-4 border-t-2 border-black bg-white flex items-center justify-between gap-3">
            <button
              type="button"
              id="clear-all-saved-btn"
              onClick={onClearAll}
              className="text-xs font-sans font-bold uppercase tracking-widest text-[#CC0000] hover:underline"
            >
              Clear Archive
            </button>

            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-2 px-4 py-2 border border-black bg-black hover:bg-white hover:text-black text-white text-xs font-sans font-bold uppercase tracking-widest transition-colors"
            >
              <span>Back to Catalog</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
