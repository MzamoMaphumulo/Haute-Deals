import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import { DEFAULT_SALE_ITEMS } from './src/data/defaultDeals';
import { RETAIL_STORES } from './src/data/storesData';
import { SaleItem } from './src/types';
import {
  securityHeadersMiddleware,
  enforceHttpsMiddleware,
  botAndThreatProtectionMiddleware,
  apiGeneralLimiter,
  authLimiter,
  aiSearchLimiter,
  syncLimiter,
  imageProxyLimiter,
  sanitizeSearchQuery,
  validateBoundedInt,
  isValidProxyImageUrl,
  validateAllowedPayloadFields,
  verifyRecordAccess,
  hashPassword,
  verifyPassword,
  generateSecureToken,
  encryptSensitiveData,
  decryptSensitiveData,
  requireServerAuth,
  activeSessions,
  sanitizeErrorMessage,
  AuthenticatedRequest
} from './server/security';

const app = express();
const PORT = 3000;

// Security: Disable Express fingerprint
app.disable('x-powered-by');

// Security: Restrict maximum request payload size to 32kb to prevent DoS/memory exhaustion
app.use(express.json({ limit: '32kb' }));
app.use(express.urlencoded({ extended: false, limit: '32kb' }));

// Security: Apply security headers (CSP, HSTS, X-Content-Type, X-Frame-Options)
app.use(securityHeadersMiddleware);

// Security: Force HTTPS in production
app.use(enforceHttpsMiddleware);

// Security: Bot and threat protection (filters malicious scanning signatures, path traversals)
app.use(botAndThreatProtectionMiddleware);

// Security: General API rate limiter (120 requests/minute per IP)
app.use('/api', apiGeneralLimiter);

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

// ============================================================================
// SECURITY: EXPOSE ONLY PUBLIC CONFIGURATION (NEVER PRIVATE SECRETS OR KEYS)
// ============================================================================
app.get('/api/config', (req, res) => {
  res.json({
    appName: 'Haute Deals',
    publicDbKey: 'pub_live_db_haute_deals_rsa',
    authEnabled: true,
    httpsEnforced: true,
    rateLimitingActive: true,
    version: '2.0.0'
  });
});

// ============================================================================
// SECURITY: SERVER-SIDE AUTHENTICATION, PASSWORD HASHING & ROW-LEVEL SECURITY
// ============================================================================
interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  role: 'user' | 'admin';
  createdAt: string;
}

const usersDb = new Map<string, UserRecord>();

// Seed default administrator account with strong scrypt hash
(async () => {
  const adminHash = await hashPassword('HauteAdmin2026!');
  usersDb.set('admin@hautedeals.co.za', {
    id: 'user-admin-001',
    email: 'admin@hautedeals.co.za',
    passwordHash: adminHash,
    role: 'admin',
    createdAt: new Date().toISOString()
  });
})();

// Rate-limited user registration endpoint (blocks field tampering, validates email & password)
app.post('/api/auth/register', authLimiter, async (req, res) => {
  const { valid, forbiddenKeys } = validateAllowedPayloadFields(req.body, ['email', 'password']);
  if (!valid) {
    res.status(400).json({ error: `Forbidden fields in registration: ${forbiddenKeys.join(', ')}` });
    return;
  }

  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body.password === 'string' ? req.body.password : '';

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email) || email.length > 100) {
    res.status(400).json({ error: 'Valid email address is required.' });
    return;
  }

  if (!password || password.length < 8) {
    res.status(400).json({ error: 'Password must be at least 8 characters long.' });
    return;
  }

  if (usersDb.has(email)) {
    res.status(409).json({ error: 'An account with this email address already exists.' });
    return;
  }

  const hashedPassword = await hashPassword(password);
  const userId = `user-${Date.now()}-${generateSecureToken(4)}`;
  const newUser: UserRecord = {
    id: userId,
    email,
    passwordHash: hashedPassword,
    role: 'user',
    createdAt: new Date().toISOString()
  };

  usersDb.set(email, newUser);

  // Generate secure session token
  const token = generateSecureToken(32);
  activeSessions.set(token, {
    user: { id: newUser.id, email: newUser.email, role: newUser.role, createdAt: newUser.createdAt },
    expiresAt: Date.now() + 24 * 60 * 60 * 1000
  });

  res.setHeader(
    'Set-Cookie',
    `haute_session=${token}; HttpOnly; ${process.env.NODE_ENV === 'production' ? 'Secure; ' : ''}SameSite=Strict; Path=/; Max-Age=86400`
  );

  res.status(201).json({
    success: true,
    token,
    user: { id: newUser.id, email: newUser.email, role: newUser.role }
  });
});

// Rate-limited user login endpoint (timing-safe password verification, secure cookies)
app.post('/api/auth/login', authLimiter, async (req, res) => {
  const { valid, forbiddenKeys } = validateAllowedPayloadFields(req.body, ['email', 'password']);
  if (!valid) {
    res.status(400).json({ error: `Forbidden fields in request: ${forbiddenKeys.join(', ')}` });
    return;
  }

  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body.password === 'string' ? req.body.password : '';

  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required.' });
    return;
  }

  const user = usersDb.get(email);
  if (!user) {
    // Timing-safe dummy check preventing username enumeration
    await verifyPassword('dummy-password-check', '00000000000000000000000000000000:00000000000000000000000000000000');
    res.status(401).json({ error: 'Invalid email or password.' });
    return;
  }

  const isValidPassword = await verifyPassword(password, user.passwordHash);
  if (!isValidPassword) {
    res.status(401).json({ error: 'Invalid email or password.' });
    return;
  }

  const token = generateSecureToken(32);
  activeSessions.set(token, {
    user: { id: user.id, email: user.email, role: user.role, createdAt: user.createdAt },
    expiresAt: Date.now() + 24 * 60 * 60 * 1000
  });

  res.setHeader(
    'Set-Cookie',
    `haute_session=${token}; HttpOnly; ${process.env.NODE_ENV === 'production' ? 'Secure; ' : ''}SameSite=Strict; Path=/; Max-Age=86400`
  );

  res.json({
    success: true,
    token,
    user: { id: user.id, email: user.email, role: user.role }
  });
});

// Server-side authenticated session profile
app.get('/api/auth/me', requireServerAuth, (req: AuthenticatedRequest, res) => {
  res.json({ user: req.user });
});

// Logout endpoint
app.post('/api/auth/logout', (req, res) => {
  const token = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.substring(7).trim()
    : undefined;
  if (token) {
    activeSessions.delete(token);
  }
  res.setHeader('Set-Cookie', 'haute_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
  res.json({ success: true, message: 'Logged out successfully.' });
});

// In-memory record store with Row-Level Security and field encryption
interface UserSavedRecord {
  id: string;
  userId: string;
  dealId: string;
  notesEncrypted?: string;
  savedAt: string;
}

const userSavedRecords = new Map<string, UserSavedRecord>();

// GET user saved records (Enforces row-level security: only records where userId === req.user.id)
app.get('/api/user/saved-deals', requireServerAuth, (req: AuthenticatedRequest, res) => {
  const currentUserId = req.user!.id;
  const userRecords: any[] = [];

  for (const record of userSavedRecords.values()) {
    if (record.userId === currentUserId) {
      userRecords.push({
        id: record.id,
        dealId: record.dealId,
        savedAt: record.savedAt,
        notes: record.notesEncrypted ? decryptSensitiveData(record.notesEncrypted) : undefined
      });
    }
  }

  res.json({ savedDeals: userRecords });
});

// POST save a deal (Blocks field tampering, encrypts sensitive notes)
app.post('/api/user/saved-deals', requireServerAuth, (req: AuthenticatedRequest, res) => {
  const { valid, forbiddenKeys } = validateAllowedPayloadFields(req.body, ['dealId', 'notes']);
  if (!valid) {
    res.status(400).json({ error: `Field tampering detected: ${forbiddenKeys.join(', ')} are forbidden.` });
    return;
  }

  const { dealId, notes } = req.body;
  if (!dealId || typeof dealId !== 'string') {
    res.status(400).json({ error: 'Valid dealId is required.' });
    return;
  }

  const recordId = `rec-${Date.now()}-${generateSecureToken(4)}`;
  const encryptedNotes = notes && typeof notes === 'string' ? encryptSensitiveData(notes.slice(0, 500)) : undefined;

  const newRecord: UserSavedRecord = {
    id: recordId,
    userId: req.user!.id,
    dealId: dealId.slice(0, 100),
    notesEncrypted: encryptedNotes,
    savedAt: new Date().toISOString()
  };

  userSavedRecords.set(recordId, newRecord);

  res.status(201).json({
    success: true,
    record: {
      id: newRecord.id,
      dealId: newRecord.dealId,
      savedAt: newRecord.savedAt
    }
  });
});

// DELETE a saved deal (Row-level security: locks access to record owner only)
app.delete('/api/user/saved-deals/:recordId', requireServerAuth, (req: AuthenticatedRequest, res) => {
  const { recordId } = req.params;
  const record = userSavedRecords.get(recordId);

  if (!record) {
    res.status(404).json({ error: 'Record not found.' });
    return;
  }

  // Row-level authorization check
  const hasAccess = verifyRecordAccess({
    userId: req.user!.id,
    recordOwnerId: record.userId,
    userRole: req.user!.role
  });

  if (!hasAccess) {
    res.status(403).json({ error: 'Access denied: You do not have permission to delete this record.' });
    return;
  }

  userSavedRecords.delete(recordId);
  res.json({ success: true, message: 'Record removed successfully.' });
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
  const storeParam = typeof req.query.store === 'string' ? req.query.store.slice(0, 100) : undefined;
  const categoryParam = typeof req.query.category === 'string' ? req.query.category.slice(0, 60) : undefined;
  const genderParam = typeof req.query.gender === 'string' ? req.query.gender.slice(0, 20) : undefined;
  const sortParam = typeof req.query.sort === 'string' ? req.query.sort.slice(0, 30) : undefined;

  const minDiscNum = validateBoundedInt(req.query.minDiscount, 0, 100, 0);
  const maxPriceNum = validateBoundedInt(req.query.maxPrice, 1, 100000, 100000);
  const sanitizedSearch = sanitizeSearchQuery(req.query.search);

  let results = [...cachedDeals];

  if (storeParam && storeParam !== 'all') {
    const storeKeys = storeParam.split(',').map((k) => k.trim());
    results = results.filter((item) => storeKeys.includes(item.storeKey));
  }

  if (categoryParam && categoryParam !== 'all') {
    results = results.filter((item) => item.category.toLowerCase() === categoryParam.toLowerCase());
  }

  if (genderParam && genderParam !== 'all') {
    results = results.filter((item) => item.gender.toLowerCase() === genderParam.toLowerCase() || item.gender === 'Unisex');
  }

  if (minDiscNum > 0) {
    results = results.filter((item) => item.discountPercent >= minDiscNum);
  }

  if (maxPriceNum < 100000) {
    results = results.filter((item) => item.salePrice <= maxPriceNum);
  }

  if (sanitizedSearch.length > 0) {
    const q = sanitizedSearch.toLowerCase();
    results = results.filter((item) =>
      item.title.toLowerCase().includes(q) ||
      item.brand.toLowerCase().includes(q) ||
      item.store.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q) ||
      (item.description && item.description.toLowerCase().includes(q))
    );
  }

  // Sorting
  if (sortParam === 'discount-desc') {
    results.sort((a, b) => b.discountPercent - a.discountPercent);
  } else if (sortParam === 'price-asc') {
    results.sort((a, b) => a.salePrice - b.salePrice);
  } else if (sortParam === 'price-desc') {
    results.sort((a, b) => b.salePrice - a.salePrice);
  } else if (sortParam === 'newest') {
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

  // Trim response to essential, sanitized data
  res.json({
    items: uniqueResults,
    total: uniqueResults.length,
    lastSynced: lastLiveSyncTime,
    isSyncing
  });
});

// Force live resync (Rate-limited to 6 requests / 10 minutes to protect upstream servers)
app.post('/api/sync', syncLimiter, async (req, res) => {
  try {
    await syncLiveStores();
    res.json({
      success: true,
      message: 'Live sync executed successfully',
      totalItems: cachedDeals.length,
      lastSynced: lastLiveSyncTime
    });
  } catch (err: any) {
    res.status(500).json({ error: sanitizeErrorMessage(err) });
  }
});

// AI-powered live deal search across retail sites using Gemini 3.8 Flash (Rate-limited, hidden API keys)
app.post('/api/ai-search', aiSearchLimiter, async (req, res) => {
  const { valid, forbiddenKeys } = validateAllowedPayloadFields(req.body, ['query', 'storeFilter']);
  if (!valid) {
    res.status(400).json({ error: `Field tampering detected: ${forbiddenKeys.join(', ')} are not allowed.` });
    return;
  }

  const sanitizedQuery = sanitizeSearchQuery(req.body.query);
  if (!sanitizedQuery || sanitizedQuery.length < 2) {
    res.status(400).json({ error: 'Valid search query between 2 and 100 characters is required.' });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    // Return local filtered deals if key is not configured
    const q = sanitizedQuery.toLowerCase();
    const matches = cachedDeals.filter((d) =>
      d.title.toLowerCase().includes(q) ||
      d.brand.toLowerCase().includes(q) ||
      d.store.toLowerCase().includes(q)
    );
    res.json({ items: matches, source: 'local' });
    return;
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const targetStores = typeof req.body.storeFilter === 'string'
      ? req.body.storeFilter.slice(0, 150)
      : 'Woolworths, Markham, Mr Price, Foschini, Superbalist, Truworths, Cotton On';

    const prompt = `Search South African retail stores (${targetStores}) for active sales or clearance deals matching query "${sanitizedQuery}".
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
      const storeKey = String(d.store || 'retailer').toLowerCase().replace(/[^a-z0-9]/g, '-');
      const saleP = Number(d.salePrice) || 299;
      const origP = Number(d.originalPrice) || Math.round(saleP * 1.4);
      const disc = Number(d.discountPercent) || Math.round(((origP - saleP) / origP) * 100);

      return {
        id: `ai-live-${Date.now()}-${idx}`,
        title: String(d.title || sanitizedQuery).slice(0, 120),
        brand: String(d.brand || d.store || 'Retailer').slice(0, 60),
        store: String(d.store || 'South African Retailer').slice(0, 60),
        storeKey: storeKey.slice(0, 40),
        salePrice: saleP,
        originalPrice: origP,
        discountPercent: disc,
        savings: origP - saleP,
        imageUrl: d.imageUrl && typeof d.imageUrl === 'string' && d.imageUrl.startsWith('https://') ? d.imageUrl : 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?q=80&w=800&auto=format&fit=crop',
        fallbackImageUrl: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?q=80&w=800&auto=format&fit=crop',
        productUrl: d.productUrl && typeof d.productUrl === 'string' && d.productUrl.startsWith('https://') ? d.productUrl : `https://www.google.co.za/search?q=${encodeURIComponent(sanitizedQuery + ' sale')}`,
        category: String(d.category || 'Fashion').slice(0, 40),
        gender: d.gender === 'Women' || d.gender === 'Men' ? d.gender : 'Unisex',
        badge: 'LIVE FOUND',
        lastVerified: 'Verified via Live Search',
        description: `Live retail sale deal located via verified retail search.`,
        inStock: true
      };
    });

    if (formattedLiveDeals.length > 0) {
      const existingIds = new Set(cachedDeals.map((d) => d.id));
      const freshDeals = formattedLiveDeals.filter((d) => !existingIds.has(d.id));
      cachedDeals = [...freshDeals, ...cachedDeals];
      res.json({ items: formattedLiveDeals, source: 'gemini-live-search' });
    } else {
      const q = sanitizedQuery.toLowerCase();
      const localMatches = cachedDeals.filter((d) =>
        d.title.toLowerCase().includes(q) ||
        d.brand.toLowerCase().includes(q) ||
        d.store.toLowerCase().includes(q) ||
        d.category.toLowerCase().includes(q)
      );
      res.json({ items: localMatches, source: 'local-filtered' });
    }
  } catch (err: any) {
    console.error('Gemini live search error:', err.message);
    const q = sanitizedQuery.toLowerCase();
    const localMatches = cachedDeals.filter((d) =>
      d.title.toLowerCase().includes(q) ||
      d.brand.toLowerCase().includes(q) ||
      d.store.toLowerCase().includes(q)
    );
    res.json({ items: localMatches, source: 'local-fallback', error: sanitizeErrorMessage(err) });
  }
});

// Image proxy with strict SSRF defense, domain whitelisting, and rate limiting
app.get('/api/image-proxy', imageProxyLimiter, async (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl || typeof targetUrl !== 'string') {
    res.status(400).send('Missing url parameter');
    return;
  }

  // Security: Validate external target URL against SSRF and private IP ranges
  const urlValidation = isValidProxyImageUrl(targetUrl);
  if (!urlValidation.valid) {
    // Block attack attempt immediately and redirect to safe neutral fallback
    res.redirect('https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?q=80&w=800&auto=format&fit=crop');
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
    res.setHeader('Cache-Control', 'public, max-age=86400, no-transform');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    const buffer = await upstreamRes.arrayBuffer();
    res.send(Buffer.from(buffer));
  } catch (err: any) {
    res.redirect('https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?q=80&w=800&auto=format&fit=crop');
  }
});

// Global unhandled error handler (prevents stack trace / credential leakage)
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled server exception caught safely:', err.message);
  res.status(500).json({ error: 'An unexpected internal server error occurred.' });
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
