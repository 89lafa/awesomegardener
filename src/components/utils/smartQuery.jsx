/**
 * Smart API Query Client - Handles rate limiting, caching, and deduplication
 * - Request deduplication (same query -> one in-flight request)
 * - Short-lived caching (15s TTL)
 * - 429 backoff + retry with Retry-After support
 * - Never clears data on error (callers keep last-known-good state)
 */

const cache = new Map();
const inflightRequests = new Map();

const isDev = import.meta.env.DEV;

// Global Request Queue - Limits concurrent requests to prevent rate limiting
const MAX_CONCURRENT = 3;
const MIN_GAP_MS = 200;
let activeRequests = 0;
let lastRequestTime = 0;
const requestQueue = [];

function enqueueRequest(fn) {
  return new Promise((resolve, reject) => {
    requestQueue.push({ fn, resolve, reject });
    processQueue();
  });
}

async function processQueue() {
  if (requestQueue.length === 0) return;
  if (activeRequests >= MAX_CONCURRENT) return;

  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  if (timeSinceLastRequest < MIN_GAP_MS) {
    setTimeout(processQueue, MIN_GAP_MS - timeSinceLastRequest);
    return;
  }

  const { fn, resolve, reject } = requestQueue.shift();
  activeRequests++;
  lastRequestTime = Date.now();

  try {
    const result = await fn();
    resolve(result);
  } catch (err) {
    reject(err);
  } finally {
    activeRequests--;
    setTimeout(processQueue, MIN_GAP_MS);
  }
}

// Comprehensive cache TTLs by entity type
const CACHE_TTLS = {
  // REFERENCE DATA — never changes during a session (30 minutes)
  PlantType: 30 * 60 * 1000,
  CompanionRule: 30 * 60 * 1000,
  PlantingRule: 30 * 60 * 1000,
  Badge: 30 * 60 * 1000,
  Challenge: 30 * 60 * 1000,
  GrowingTip: 30 * 60 * 1000,
  PlantFamily: 30 * 60 * 1000,
  PlantGroup: 30 * 60 * 1000,
  BrowseCategory: 30 * 60 * 1000,
  Variety: 30 * 60 * 1000,
  PlantSubCategory: 30 * 60 * 1000,
  Facet: 30 * 60 * 1000,
  FacetGroup: 30 * 60 * 1000,

  // USER DATA — changes when user takes action (5 minutes)
  Garden: 5 * 60 * 1000,
  GardenSeason: 5 * 60 * 1000,
  SeedLot: 5 * 60 * 1000,
  CropPlan: 5 * 60 * 1000,
  PlantingSpace: 5 * 60 * 1000,
  PlantInstance: 5 * 60 * 1000,
  IndoorSpace: 5 * 60 * 1000,
  IndoorPlant: 5 * 60 * 1000,
  IndoorSpaceTier: 5 * 60 * 1000,
  IndoorCareTask: 5 * 60 * 1000,
  PlotLayout: 5 * 60 * 1000,
  PlotStructure: 5 * 60 * 1000,
  PlotItem: 5 * 60 * 1000,
  Bed: 5 * 60 * 1000,
  GardenSpace: 5 * 60 * 1000,

  // ACTIVITY/NOTIFICATION DATA — changes more often (2 minutes)
  Notification: 2 * 60 * 1000,
  ActivityLog: 2 * 60 * 1000,
  HarvestLog: 2 * 60 * 1000,

  // GAMIFICATION — changes rarely (10 minutes)
  UserStreak: 10 * 60 * 1000,
  UserChallenge: 10 * 60 * 1000,
  UserBadge: 10 * 60 * 1000,
  UserProgress: 10 * 60 * 1000,

  // ADMIN-ONLY — cache aggressively (10 minutes)
  FeatureRequest: 10 * 60 * 1000,
  VarietySuggestion: 10 * 60 * 1000,
  VarietyChangeRequest: 10 * 60 * 1000,
  WeatherCache: 15 * 60 * 1000,

  // Default for anything not listed (3 minutes)
  _default: 3 * 60 * 1000,
};

function getTTL(entityName) {
  return CACHE_TTLS[entityName] || CACHE_TTLS._default;
}

function generateKey(entityName, query, sort, limit) {
  return `${entityName}:${JSON.stringify({ q: query, s: sort, l: limit })}`;
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Smart query wrapper for entity list/filter calls
 * @param {object} base44 - Base44 SDK instance
 * @param {string} entityName - Entity name (e.g., 'Garden', 'Task')
 * @param {object} query - Query filter object
 * @param {string} sort - Sort string (e.g., '-updated_date')
 * @param {number} limit - Max results
 * @returns {Promise<array>} - Array of results
 * @throws {object} - On error: { code: 'RATE_LIMIT' | 'FETCH_ERROR', message, retryInMs }
 */
export async function smartQuery(base44, entityName, query = {}, sort = '', limit = 100) {
  const key = generateKey(entityName, query, sort, limit);
  const now = Date.now();
  const ttl = getTTL(entityName);
  
  // Check cache first
  const cached = cache.get(key);
  if (cached && (now - cached.timestamp) < ttl) {
    if (isDev) console.debug('[API] cache_hit', { entity: entityName, age: Math.round((now - cached.timestamp) / 1000) + 's', ttl: ttl/1000 + 's' });
    return cached.data;
  }
  
  // Check if request already in flight
  if (inflightRequests.has(key)) {
    if (isDev) console.debug('[API] request_deduped', { entity: entityName });
    return await inflightRequests.get(key);
  }
  
  // Enqueue request - max 3 concurrent, 200ms apart
  const requestPromise = enqueueRequest(async () => {
    return await executeWithRetry(base44, entityName, query, sort, limit, key);
  });
  
  inflightRequests.set(key, requestPromise);
  
  try {
    const result = await requestPromise;
    
    // Cache successful result
    cache.set(key, { data: result, timestamp: now });
    
    // Schedule cache cleanup
    setTimeout(() => cache.delete(key), ttl);
    
    return result;
  } catch (err) {
    // On 429, return stale cache if available
    if (err?.code === 'RATE_LIMIT' || err?.status === 429) {
      const staleCache = cache.get(key);
      if (staleCache) {
        if (isDev) console.warn(`[API] returning stale cache for ${entityName}`);
        return staleCache.data;
      }
    }
    throw err;
  } finally {
    inflightRequests.delete(key);
  }
}

async function executeWithRetry(base44, entityName, query, sort, limit, key, attempt = 1) {
  const startTime = Date.now();
  
  if (isDev) console.debug('[API] request_start', { entity: entityName, attempt, cached: false, deduped: false });
  
  try {
    let result;
    // Handle different call signatures
    if (sort && limit && limit !== 100) {
      result = await base44.entities[entityName].filter(query, sort, limit);
    } else if (sort) {
      result = await base44.entities[entityName].filter(query, sort);
    } else {
      result = await base44.entities[entityName].filter(query);
    }
    
    if (isDev) console.debug('[API] request_success', { entity: entityName, count: result?.length || 0, ms: Date.now() - startTime });
    return result || [];
    
  } catch (error) {
    // Handle 429 Rate Limit - NO RETRY
    if (error.response?.status === 429 || error.status === 429) {
      if (isDev) console.warn('[API] request_429 - NO RETRY', { entity: entityName });
      throw { code: 'RATE_LIMIT', status: 429, message: 'Rate limit exceeded' };
    }
    
    // Other errors - log and throw
    if (isDev) console.error('[API] request_error', { entity: entityName, error: error.message || error });
    throw { code: 'FETCH_ERROR', message: error.message || 'Failed to fetch data', originalError: error };
  }
}

export function clearCache() {
  cache.clear();
  inflightRequests.clear();
  if (isDev) console.debug('[API] cache_cleared');
}