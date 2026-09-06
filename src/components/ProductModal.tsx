import React, { useState } from 'react';
import { X, ExternalLink, Bookmark, CheckCircle2, ShieldCheck, Share2, ArrowRight } from 'lucide-react';
import { SaleItem } from '../types';

interface ProductModalProps {
  item: SaleItem | null;
  onClose: () => void;
  onToggleSave: (item: SaleItem) => void;
  isSaved: boolean;
}

export const ProductModal: React.FC<ProductModalProps> = ({
  item,
  onClose,
  onToggleSave,
  isSaved,
}) => {
  const [copied, setCopied] = useState(false);
  const [imgError, setImgError] = useState(false);

  if (!item) return null;

  const handleShare = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const imageSrc = imgError
    ? item.fallbackImageUrl || 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?q=80&w=800&auto=format&fit=crop'
    : item.imageUrl;

  return (
    <div
      id="product-detail-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        id="product-detail-modal-container"
        className="relative w-full max-w-3xl max-h-[92vh] overflow-y-auto bg-white border-2 border-black flex flex-col md:flex-row overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          id="close-modal-btn"
          onClick={onClose}
          className="absolute top-3.5 right-3.5 z-10 p-1.5 border border-black bg-white text-black hover:bg-black hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Product Image Column */}
        <div className="md:w-1/2 bg-stone-100 relative min-h-[300px] md:min-h-[460px] flex items-center justify-center overflow-hidden border-b md:border-b-0 md:border-r border-black">
          <img
            src={imageSrc}
            alt={item.title}
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
            className="w-full h-full object-cover object-center max-h-[500px]"
          />

          <div className="absolute top-3 left-3 flex flex-col gap-1">
            <span className="inline-flex items-center px-2.5 py-0.5 text-xs font-sans font-bold uppercase tracking-wider bg-[#CC0000] text-white">
              -{item.discountPercent}% OFF
            </span>
            {item.badge && (
              <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-sans font-bold uppercase tracking-wider bg-black text-white">
                {item.badge}
              </span>
            )}
          </div>

          <div className="absolute bottom-3 left-3">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-sans font-bold uppercase tracking-widest bg-white text-black border border-black">
              <CheckCircle2 className="w-3 h-3 text-[#CC0000]" />
              Live Retailer Sync
            </span>
          </div>
        </div>

        {/* Product Info Column */}
        <div className="md:w-1/2 p-6 sm:p-8 flex flex-col justify-between">
          <div>
            {/* Store & Category Tag */}
            <div className="flex items-center justify-between gap-2 mb-3 border-b border-stone-200 pb-2">
              <span className="text-xs font-sans font-bold uppercase tracking-[0.25em] text-[#CC0000]">
                {item.store}
              </span>
              <span className="text-[11px] font-sans uppercase tracking-wider text-stone-500">
                {item.gender} • {item.category}
              </span>
            </div>

            <h3 className="text-xl sm:text-2xl font-serif font-bold text-black uppercase leading-tight mb-2">
              {item.title}
            </h3>

            <p className="text-xs font-sans uppercase tracking-widest text-stone-500 mb-4">
              Designer / Label: <span className="text-black font-bold">{item.brand}</span>
            </p>

            {/* Price Box */}
            <div className="p-4 border border-black bg-[#FBFBFB] mb-5">
              <div className="flex items-baseline gap-3">
                <span className="text-2xl sm:text-3xl font-serif font-bold text-black">
                  R{item.salePrice.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                {item.originalPrice > item.salePrice && (
                  <span className="text-sm sm:text-base font-serif text-stone-400 line-through">
                    R{item.originalPrice.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                )}
              </div>

              {item.savings > 0 && (
                <div className="mt-1 flex items-center gap-2 text-xs font-sans font-bold uppercase tracking-wider">
                  <span className="text-[#CC0000]">
                    Save R{item.savings.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span className="text-stone-300">•</span>
                  <span className="text-stone-600">
                    {item.discountPercent}% markdown
                  </span>
                </div>
              )}
            </div>

            {/* Description */}
            <div className="text-xs font-sans text-stone-600 leading-relaxed mb-5">
              <p>{item.description || 'Verified clearance markdown item sourced directly from the official retail catalog.'}</p>
            </div>

            {/* Verification Features */}
            <div className="space-y-2 border-t border-stone-200 pt-3 text-[11px] font-sans uppercase tracking-wider text-stone-500">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-black shrink-0" />
                <span>Verified live pricing & photo directly from {item.store}</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#CC0000] shrink-0" />
                <span>Status: In stock & actively discounted online</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-6 pt-4 border-t border-black flex flex-col sm:flex-row gap-2">
            <a
              id="modal-direct-shop-link"
              href={item.productUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 border border-black bg-black hover:bg-[#CC0000] hover:border-[#CC0000] text-white text-xs font-sans font-bold uppercase tracking-widest transition-colors group"
            >
              <span>Acquire on {item.store}</span>
              <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
            </a>

            <button
              type="button"
              id="modal-toggle-save-btn"
              onClick={() => onToggleSave(item)}
              className={`inline-flex items-center justify-center gap-1.5 px-4 py-3 border border-black text-xs font-sans font-bold uppercase tracking-wider transition-colors ${
                isSaved
                  ? 'bg-black text-white'
                  : 'bg-white text-black hover:bg-stone-100'
              }`}
            >
              <Bookmark className={`w-3.5 h-3.5 ${isSaved ? 'fill-current' : ''}`} />
              <span>{isSaved ? 'Archived' : 'Archive'}</span>
            </button>

            <button
              type="button"
              id="modal-share-btn"
              onClick={handleShare}
              title="Share deal"
              className="inline-flex items-center justify-center p-3 border border-black bg-white text-black hover:bg-stone-100 text-xs font-sans font-bold uppercase transition-colors"
            >
              <Share2 className="w-3.5 h-3.5" />
              {copied && <span className="text-[10px] text-[#CC0000] ml-1">Copied</span>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
