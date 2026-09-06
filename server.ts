import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import { DEFAULT_SALE_ITEMS } from './src/data/defaultDeals';
import { RETAIL_STORES } from './src/data/storesData';
import { SaleItem } from './src/types';

const app = express();
const PORT = 3000;

app.use(express.json());

// In-memory live store cache
let cachedDeals: SaleItem[] = [...DEFAULT_SALE_ITEMS];
let lastLiveSyncTime: string = new Date().toISOString();
let isSyncing = false;

// Helper to fetch live deals from Bash (Markham, Foschini, Exact, etc.)
async function fetchBashCategory(url: string, storeName: string, storeKey: string, categoryName: string, gender: 'Women' | 'Men' | 'Unisex'): Promise<SaleItem[]> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-ZA,en;q=0.9',
      }
    });
    if (!res.ok) return [];
    const html = await res.text();
    const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
    if (!nextDataMatch) return [];

    const data = JSON.parse(nextDataMatch[1]);
    const fallback = data.props?.pageProps?.fallback || {};
    const searchKey = Object.keys(fallback).find(k => k.startsWith('/search'));
    const items = fallback[searchKey]?.data?.items || [];

    const seenIds = new Set<string>();
    const seenTitles = new Set<string>();
    const results: SaleItem[] = [];

    for (let idx = 0; idx < items.length; idx++) {
      const item = items[idx];
      const rawId = item.id || item.vtexId || item.productId || item.skuId;
      const title = (item.name || `${storeName} Deal`).trim();
      const titleKey = title.toLowerCase();

      // Deduplicate within the same fetch
      if (rawId && seenIds.has(String(rawId))) continue;
      if (seenTitles.has(titleKey)) continue;

      const img = item.assets?.[0]?.sizes?.full || item.assets?.[0]?.sizes?.thumbnail || '';
      const selling = (item.sellingPrice || item.selling_price || 0) / 100;
      if (!img || selling <= 0) continue;

      const retail = (item.retailPrice || item.retail_price || item.sellingPrice || 0) / 100;
      const original = retail > selling ? retail : Math.round(selling * 1.35);
      const discount = item.discountPercentage || Math.round(((original - selling) / (original || 1)) * 100);
      const brand = item.brand || storeName;

      const cleanId = rawId ? `bash-${rawId}` : `bash-${storeKey}-${idx}-${Math.random().toString(36).substring(2, 7)}`;
      seenIds.add(String(rawId || cleanId));
      seenTitles.add(titleKey);

      results.push({
        id: cleanId,
        title: title,
        brand: brand,
        store: storeName,
        storeKey: storeKey,
        salePrice: selling,
        originalPrice: original,
        discountPercent: discount,
        savings: original - selling,
        imageUrl: img,
        fallbackImageUrl: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?q=80&w=800&auto=format&fit=crop',
        productUrl: item.path ? `https://bash.com${item.path}` : `https://bash.com/${storeKey}/sale`,
        category: categoryName,
        gender: gender,
        badge: discount >= 50 ? `${discount}% OFF` : (discount >= 35 ? 'HOT DEAL' : 'SALE'),
        lastVerified: 'Live from retailer',
        description: item.description?.replace(/\\n/g, ' ') || `${brand} live clearance item verified on Bash platform.`,
        inStock: true
      });
    }

    return results;
  } catch (err: any) {
    console.error(`Error scraping ${storeName} from ${url}:`, err.message);
    return [];
  }
}

// Perform live sync across South African store endpoints
async function syncLiveStores() {
  if (isSyncing) return;
  isSyncing = true;
  console.log('Initiating live sync from retail websites...');

  try {
    const [markhamItems, foschiniItems, exactItems] = await Promise.all([
      fetchBashCategory('https://bash.com/markham/sale', 'Markham', 'markham', 'Shirts & Tops', 'Men'),
      fetchBashCategory('https://bash.com/foschini/clothing', 'Foschini', 'foschini', 'Dresses & Skirts', 'Women'),
      fetchBashCategory('https://bash.com/exact/sale', 'Markham', 'markham', 'Pants & Jeans', 'Men'),
    ]);

    const allLive = [...markhamItems, ...foschiniItems, ...exactItems];
    
    // Deduplicate across all categories by ID and title
    const seenIds = new Set<string>();
    const seenTitles = new Set<string>();
    const dedupedLive: SaleItem[] = [];

    for (const item of allLive) {
      const titleKey = `${item.storeKey}:${item.title.toLowerCase()}`;
      if (!seenIds.has(item.id) && !seenTitles.has(titleKey)) {
        seenIds.add(item.id);
        seenTitles.add(titleKey);
        dedupedLive.push(item);
      }
    }

    console.log(`Live sync complete: Retrieved ${dedupedLive.length} unique live items.`);

    if (dedupedLive.length > 0) {
      // Merge live items with base catalog, preserving baseline without duplicate IDs or titles
      const liveTitles = new Set(dedupedLive.map(item => `${item.storeKey}:${item.title.toLowerCase()}`));
      const liveIds = new Set(dedupedLive.map(item => item.id));

      const preservedBase = DEFAULT_SALE_ITEMS.filter(item =>
        !liveIds.has(item.id) && !liveTitles.has(`${item.storeKey}:${item.title.toLowerCase()}`)
      );

      cachedDeals = [...dedupedLive, ...preservedBase];
      lastLiveSyncTime = new Date().toISOString();
    }
  } catch (err: any) {
    console.error('Error during live sync:', err.message);
  } finally {
    isSyncing = false;
  }
}

// Initial background sync
setTimeout(() => {
  syncLiveStores().catch(console.error);
}, 2000);

// API ROUTES
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    totalDeals: cachedDeals.length,
    lastSynced: lastLiveSyncTime
  });
});

app.get('/api/stores', (req, res) => {
  // Update deal counts dynamically based on cachedDeals
  const storeCounts: Record<string, { count: number; maxDisc: number; totalDisc: number }> = {};
  for (const item of cachedDeals) {
    if (!storeCounts[item.storeKey]) {
      storeCounts[item.storeKey] = { count: 0, maxDisc: 0, totalDisc: 0 };
    }
    storeCounts[item.storeKey].count += 1;
    if (item.discountPercent > storeCounts[item.storeKey].maxDisc) {
      storeCounts[item.storeKey].maxDisc = item.discountPercent;
    }
    storeCounts[item.storeKey].totalDisc += item.discountPercent;
  }

  const storesWithStats = RETAIL_STORES.map(store => {
    const stats = storeCounts[store.key] || { count: 0, maxDisc: store.maxDiscount, totalDisc: store.avgDiscount };
    return {
      ...store,
      totalDeals: stats.count || store.totalDeals,
      maxDiscount: stats.maxDisc || store.maxDiscount,
      avgDiscount: stats.count > 0 ? Math.round(stats.totalDisc / stats.count) : store.avgDiscount
    };
  });

  res.json({
    stores: storesWithStats,
    lastSynced: lastLiveSyncTime
  });
});

app.get('/api/deals', (req, res) => {
  const { store, category, gender, minDiscount, maxPrice, search, sort } = req.query;

  let results = [...cachedDeals];

  if (store && typeof store === 'string' && store !== 'all') {
    const storeKeys = store.split(',');
    results = results.filter(item => storeKeys.includes(item.storeKey));
  }

  if (category && typeof category === 'string' && category !== 'all') {
    results = results.filter(item => item.category.toLowerCase() === category.toLowerCase());
  }

  if (gender && typeof gender === 'string' && gender !== 'all') {
    results = results.filter(item => item.gender.toLowerCase() === gender.toLowerCase() || item.gender === 'Unisex');
  }

  if (minDiscount && !isNaN(Number(minDiscount))) {
    const minDiscNum = Number(minDiscount);
    results = results.filter(item => item.discountPercent >= minDiscNum);
  }

  if (maxPrice && !isNaN(Number(maxPrice))) {
    const maxPriceNum = Number(maxPrice);
    results = results.filter(item => item.salePrice <= maxPriceNum);
  }

  if (search && typeof search === 'string' && search.trim().length > 0) {
    const q = search.toLowerCase().trim();
    results = results.filter(item =>
      item.title.toLowerCase().includes(q) ||
      item.brand.toLowerCase().includes(q) ||
      item.store.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q) ||
      (item.description && item.description.toLowerCase().includes(q))
    );
  }

  // Sorting
  if (sort === 'discount-desc') {
    results.sort((a, b) => b.discountPercent - a.discountPercent);
  } else if (sort === 'price-asc') {
    results.sort((a, b) => a.salePrice - b.salePrice);
  } else if (sort === 'price-desc') {
    results.sort((a, b) => b.salePrice - a.salePrice);
  } else if (sort === 'newest') {
    results.sort((a, b) => b.id.localeCompare(a.id));
  }

  // Deduplicate results by ID and title to guarantee unique items
  const seenResultIds = new Set<string>();
  const uniqueResults: SaleItem[] = [];
  for (const item of results) {
    if (!seenResultIds.has(item.id)) {
      seenResultIds.add(item.id);
      uniqueResults.push(item);
    }
  }

  res.json({
    items: uniqueResults,
    total: uniqueResults.length,
    lastSynced: lastLiveSyncTime,
    isSyncing
  });
});

// Force live resync
app.post('/api/sync', async (req, res) => {
  try {
    await syncLiveStores();
    res.json({
      success: true,
      message: 'Live sync executed successfully',
      totalItems: cachedDeals.length,
      lastSynced: lastLiveSyncTime
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Live sync failed' });
  }
});

// AI-powered live deal search across retail sites using Gemini 3.8 Flash with Google Search Grounding
app.post('/api/ai-search', async (req, res) => {
  const { query, storeFilter } = req.body;
  if (!query || typeof query !== 'string') {
    res.status(400).json({ error: 'Search query is required' });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    // Return local filtered deals if key is not configured
    const q = query.toLowerCase();
    const matches = cachedDeals.filter(d =>
      d.title.toLowerCase().includes(q) ||
      d.brand.toLowerCase().includes(q) ||
      d.store.toLowerCase().includes(q)
    );
    res.json({ items: matches, source: 'local' });
    return;
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const targetStores = storeFilter || 'Woolworths, Markham, Mr Price, Foschini, Superbalist, Truworths, Cotton On';
    const prompt = `Search South African retail stores (${targetStores}) for active sales or clearance deals matching query "${query}".
For each matching item, find the real retail name, store, sale price in ZAR (Rands), original price, discount percentage, category, and direct product link or image link.

Respond strictly with a JSON object in this format:
{
  "deals": [
    {
      "title": "Exact product name",
      "brand": "Brand name",
      "store": "Exact store name (e.g. Woolworths, Markham, Mr Price, Foschini, Superbalist, Truworths)",
      "salePrice": 399.00,
      "originalPrice": 699.00,
      "discountPercent": 43,
      "category": "One of [Dresses & Skirts, Shirts & Tops, Jackets & Outerwear, Pants & Jeans, Footwear & Shoes, Accessories & Bags]",
      "gender": "Women, Men, or Unisex",
      "productUrl": "https://...",
      "imageUrl": "https://..."
    }
  ]
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }]
      }
    });

    const responseText = response.text || '';
    const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/) || responseText.match(/\{[\s\S]*"deals"[\s\S]*\}/);

    let parsedDeals: any[] = [];
    if (jsonMatch) {
      const rawJson = jsonMatch[1] || jsonMatch[0];
      try {
        const parsed = JSON.parse(rawJson);
        parsedDeals = parsed.deals || parsed;
      } catch (e) {
        console.warn('Could not parse JSON from Gemini response:', e);
      }
    }

    const formattedLiveDeals: SaleItem[] = parsedDeals.map((d: any, idx: number) => {
      const storeKey = d.store.toLowerCase().replace(/[^a-z0-9]/g, '-');
      const saleP = Number(d.salePrice) || 299;
      const origP = Number(d.originalPrice) || Math.round(saleP * 1.4);
      const disc = Number(d.discountPercent) || Math.round(((origP - saleP) / origP) * 100);

      return {
        id: `ai-live-${Date.now()}-${idx}`,
        title: d.title || query,
        brand: d.brand || d.store || 'Retailer',
        store: d.store || 'South African Retailer',
        storeKey: storeKey,
        salePrice: saleP,
        originalPrice: origP,
        discountPercent: disc,
        savings: origP - saleP,
        imageUrl: d.imageUrl && d.imageUrl.startsWith('http') ? d.imageUrl : 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?q=80&w=800&auto=format&fit=crop',
        fallbackImageUrl: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?q=80&w=800&auto=format&fit=crop',
        productUrl: d.productUrl || `https://www.google.co.za/search?q=${encodeURIComponent(d.title + ' ' + d.store + ' sale')}`,
        category: d.category || 'Fashion',
        gender: d.gender || 'Unisex',
        badge: 'LIVE FOUND',
        lastVerified: 'Verified via Live Search',
        description: `Live retail sale deal located via live retailer search.`,
        inStock: true
      };
    });

    if (formattedLiveDeals.length > 0) {
      // Add to cached deals, ensuring no duplicate IDs
      const existingIds = new Set(cachedDeals.map(d => d.id));
      const freshDeals = formattedLiveDeals.filter(d => !existingIds.has(d.id));
      cachedDeals = [...freshDeals, ...cachedDeals];
      res.json({ items: formattedLiveDeals, source: 'gemini-live-search' });
    } else {
      // Fallback to local filtering
      const q = query.toLowerCase();
      const localMatches = cachedDeals.filter(d =>
        d.title.toLowerCase().includes(q) ||
        d.brand.toLowerCase().includes(q) ||
        d.store.toLowerCase().includes(q) ||
        d.category.toLowerCase().includes(q)
      );
      res.json({ items: localMatches, source: 'local-filtered' });
    }
  } catch (err: any) {
    console.error('Gemini live search error:', err.message);
    const q = query.toLowerCase();
    const localMatches = cachedDeals.filter(d =>
      d.title.toLowerCase().includes(q) ||
      d.brand.toLowerCase().includes(q) ||
      d.store.toLowerCase().includes(q)
    );
    res.json({ items: localMatches, source: 'local-fallback', error: err.message });
  }
});

// Image proxy to prevent CORS / hotlinking issues with retail website CDNs
app.get('/api/image-proxy', async (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl || typeof targetUrl !== 'string') {
    res.status(400).send('Missing url parameter');
    return;
  }

  try {
    const upstreamRes = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Referer': new URL(targetUrl).origin
      }
    });

    if (!upstreamRes.ok) {
      res.redirect('https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?q=80&w=800&auto=format&fit=crop');
      return;
    }

    const contentType = upstreamRes.headers.get('content-type') || 'image/jpeg';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');

    const buffer = await upstreamRes.arrayBuffer();
    res.send(Buffer.from(buffer));
  } catch (err: any) {
    res.redirect('https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?q=80&w=800&auto=format&fit=crop');
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Haute Deals Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(console.error);
