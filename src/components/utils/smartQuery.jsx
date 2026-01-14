/**
 * Smart API Query Client - Handles rate limiting, caching, and deduplication
 * - Request deduplication (same query -> one in-flight request)
 * - Short-lived caching (15s TTL)
 * - 429 backoff + retry with Retry-After support
 * - Never clears data on error (callers keep last-known-good state)
 */

const cache = new Map();
const inflightRequests = new Map();
const TTL_MS = 15000; // 15 seconds

const isDev = import.meta.env.DEV;

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
  
  // Check cache first
  const cached = cache.get(key);
  if (cached && (now - cached.timestamp) < TTL_MS) {
    if (isDev) console.debug('[API] request_cache_hit', { entity: entityName, age: Math.round((now - cached.timestamp) / 1000) + 's' });
    return cached.data;
  }
  
  // Check if request already in flight
  if (inflightRequests.has(key)) {
    if (isDev) console.debug('[API] request_deduped', { entity: entityName });
    return await inflightRequests.get(key);
  }
  
  // Start new request with retry logic
  const requestPromise = executeWithRetry(base44, entityName, query, sort, limit, key);
  inflightRequests.set(key, requestPromise);
  
  try {
    const result = await requestPromise;
    
    // Cache successful result
    cache.set(key, { data: result, timestamp: now });
    
    // Schedule cache cleanup
    setTimeout(() => cache.delete(key), TTL_MS);
    
    return result;
  } finally {
    inflightRequests.delete(key);
  }
}

async function executeWithRetry(base44, entityName, query, sort, limit, key, attempt = 1) {
  const maxAttempts = 5;
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
    // Handle 429 Rate Limit
    if (error.response?.status === 429 || error.status === 429) {
      if (attempt >= maxAttempts) {
        if (isDev) console.error('[API] request_429_max_retries', { entity: entityName, attempt });
        throw { code: 'RATE_LIMIT', message: 'Too many requests. Please wait a moment.', retryInMs: 5000 };
      }
      
      // Check for Retry-After header
      let retryAfterMs = 1000;
      const retryAfter = error.response?.headers?.['retry-after'] || error.headers?.['retry-after'];
      if (retryAfter) {
        retryAfterMs = parseInt(retryAfter) * 1000;
      } else {
        // Exponential backoff with jitter: 500ms, 1s, 2s, 4s, 8s
        retryAfterMs = Math.min(8000, 500 * Math.pow(2, attempt - 1)) + Math.random() * 200;
      }
      
      if (isDev) console.debug('[API] request_429', { entity: entityName, attempt, retryInMs: Math.round(retryAfterMs) });
      
      await sleep(retryAfterMs);
      return executeWithRetry(base44, entityName, query, sort, limit, key, attempt + 1);
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