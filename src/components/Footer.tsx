import React from 'react';
import { ExternalLink, ShieldCheck } from 'lucide-react';
import { RETAIL_STORES } from '../data/storesData';

export const Footer: React.FC = () => {
  return (
    <footer className="mt-20 border-t-2 border-black bg-white text-[#1A1A1A]">
      {/* Top Stores Directory Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-10 border-b border-black">
        <div className="flex items-center justify-between mb-6 pb-2 border-b border-stone-200">
          <span className="text-xs font-sans font-bold uppercase tracking-[0.25em] text-stone-400">
            Featured Fashion Portals
          </span>
          <span className="text-[10px] font-sans uppercase tracking-widest text-stone-500">
            South Africa Directory
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-8">
          {RETAIL_STORES.map((store) => (
            <div key={store.key} className="space-y-1.5">
              <a
                href={store.saleUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-serif font-bold text-base text-black hover:text-[#CC0000] uppercase tracking-wide transition-colors inline-flex items-center gap-1.5"
              >
                <span>{store.name}</span>
                <ExternalLink className="w-3 h-3 text-stone-400" />
              </a>
              <p className="text-xs font-sans text-stone-500 leading-snug">{store.activeSalePromo}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Main Footer Bottom Strip */}
      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-6 flex flex-col md:flex-row items-center justify-between gap-4 text-[11px] font-sans uppercase font-bold tracking-[0.2em]">
        <div className="flex items-center gap-3">
          <span className="font-serif font-bold tracking-widest text-sm text-black">
            HAUTE DEALS
          </span>
          <span className="text-stone-300">|</span>
          <span className="text-stone-500 font-normal tracking-wider">
            Established 2023 © All Rights Reserved
          </span>
        </div>

        <div className="flex items-center gap-6 text-stone-600 flex-wrap justify-center">
          <span>Price Matching: Verified</span>
          <span>Stock Status: Real-time</span>
          <span>Curation: Editorial</span>
        </div>
      </div>
    </footer>
  );
};

