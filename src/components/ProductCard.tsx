import React, { useState } from 'react';
import { ExternalLink, Eye, Bookmark, CheckCircle2 } from 'lucide-react';
import { SaleItem } from '../types';

interface ProductCardProps {
  item: SaleItem;
  onQuickView: (item: SaleItem) => void;
  onToggleSave: (item: SaleItem) => void;
  isSaved: boolean;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  item,
  onQuickView,
  onToggleSave,
  isSaved,
}) => {
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  // Store brand tag colors
  const storeBadgeStyles: Record<string, string> = {
    woolworths: 'bg-stone-900 text-white',
    markham: 'bg-amber-950 text-amber-200 border-amber-800/40',
    'mr-price': 'bg-red-600 text-white',
    foschini: 'bg-rose-900 text-rose-100 border-rose-800/40',
    superbalist: 'bg-emerald-900 text-emerald-100 border-emerald-800/40',
    truworths: 'bg-indigo-950 text-indigo-200 border-indigo-900/40',
    'cotton-on': 'bg-neutral-800 text-neutral-100',
    'cape-union-mart': 'bg-teal-950 text-teal-200 border-teal-800/40',
  };

  const badgeClass = storeBadgeStyles[item.storeKey] || 'bg-stone-800 text-stone-100';

  const imageSrc = imgError
    ? item.fallbackImageUrl || 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?q=80&w=800&auto=format&fit=crop'
    : item.imageUrl;

  return (
    <div
      id={`product-card-${item.id}`}
      className="group relative flex flex-col bg-white border border-black overflow-hidden transition-all duration-200"
    >
      {/* Product Image Container */}
      <div className="relative aspect-[3/4] w-full bg-[#F5F5F5] border-b border-black overflow-hidden">
        {/* Placeholder skeleton while loading */}
        {!imgLoaded && (
          <div className="absolute inset-0 bg-[#EFEFEF] animate-pulse" />
        )}

        <img
          src={imageSrc}
          alt={item.title}
          referrerPolicy="no-referrer"
          loading="lazy"
          onLoad={() => setImgLoaded(true)}
          onError={() => {
            if (!imgError) {
              setImgError(true);
            }
          }}
          className={`w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500 ease-out ${
            imgLoaded ? 'opacity-100' : 'opacity-0'
          }`}
        />

        {/* Top Badges */}
        <div className="absolute top-2 left-2 right-2 flex items-center justify-between pointer-events-none">
          {/* Discount Pill */}
          <span className="pointer-events-auto inline-flex items-center px-2 py-0.5 text-[10px] font-sans font-bold uppercase tracking-wider bg-[#CC0000] text-white">
            -{item.discountPercent}%
          </span>

          {/* Bookmark Button */}
          <button
            type="button"
            id={`save-btn-${item.id}`}
            onClick={(e) => {
              e.stopPropagation();
              onToggleSave(item);
            }}
            title={isSaved ? 'Remove from saved' : 'Save deal'}
            className={`pointer-events-auto p-1.5 border border-black transition-colors ${
              isSaved
                ? 'bg-[#CC0000] text-white border-[#CC0000]'
                : 'bg-white text-black hover:bg-black hover:text-white'
            }`}
          >
            <Bookmark className={`w-3 h-3 ${isSaved ? 'fill-current' : ''}`} />
          </button>
        </div>

        {/* Bottom Bar: Store Name & Live Tag */}
        <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
          <span className="inline-flex items-center px-2 py-0.5 text-[9px] font-sans font-bold uppercase tracking-widest bg-black text-white">
            {item.store}
          </span>

          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-sans font-bold uppercase tracking-wider bg-white/95 text-black border border-black/40">
            <span className="w-1.5 h-1.5 bg-[#CC0000] inline-block"></span>
            Live
          </span>
        </div>

        {/* Quick View Hover Button */}
        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-4 pointer-events-none">
          <button
            type="button"
            id={`quick-view-btn-${item.id}`}
            onClick={() => onQuickView(item)}
            className="pointer-events-auto inline-flex items-center gap-1.5 px-3.5 py-2 border border-black bg-white hover:bg-black hover:text-white text-black text-xs font-sans font-bold uppercase tracking-widest transition-all"
          >
            <Eye className="w-3.5 h-3.5" />
            Inspect
          </button>
        </div>
      </div>

      {/* Product Content Details */}
      <div className="flex flex-col flex-1 p-3 sm:p-4 bg-white">
        <div className="flex items-center justify-between text-[11px] font-sans text-stone-500 uppercase tracking-wider mb-1">
          <span className="font-semibold truncate max-w-[65%]">{item.brand}</span>
          <span className="text-[10px] text-stone-400 capitalize">{item.category}</span>
        </div>

        <h4
          title={item.title}
          onClick={() => onQuickView(item)}
          className="text-sm font-serif font-bold text-[#1A1A1A] uppercase line-clamp-2 cursor-pointer hover:text-[#CC0000] transition-colors leading-tight mb-3 flex-1"
        >
          {item.title}
        </h4>

        {/* Pricing Block */}
        <div className="mt-auto pt-2.5 border-t border-stone-200">
          <div className="flex items-baseline justify-between gap-1 mb-3">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-lg sm:text-xl font-serif font-bold text-[#CC0000] tracking-tight">
                R{item.salePrice.toLocaleString('en-ZA', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
              </span>
              {item.originalPrice > item.salePrice && (
                <span className="text-xs font-sans text-black line-through opacity-40">
                  R{item.originalPrice.toLocaleString('en-ZA', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                </span>
              )}
            </div>
            {item.savings > 0 && (
              <span className="text-[10px] font-sans font-bold uppercase tracking-wider text-black bg-[#F5F5F5] px-1.5 py-0.5 border border-stone-300">
                -R{Math.round(item.savings)}
              </span>
            )}
          </div>

          {/* Action Row */}
          <div className="flex items-center gap-2">
            <a
              id={`shop-btn-${item.id}`}
              href={item.productUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 border border-black bg-black text-white hover:bg-white hover:text-black uppercase text-[10px] font-sans font-bold tracking-widest transition-colors group/btn"
            >
              <span>Acquire on {item.store}</span>
              <ExternalLink className="w-3 h-3 transition-transform group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
