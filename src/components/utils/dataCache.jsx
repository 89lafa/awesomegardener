const cache = new Map();

export function getCached(key) {
  const item = cache.get(key);
  if (!item || Date.now() > item.expiry) return null;
  return item.data;
}

export function setCached(key, data, ttlMs = 300000) {
  cache.set(key, { data, expiry: Date.now() + ttlMs });
}

export async function getPlantTypesCached(fetchFn) {
  const cached = getCached('plantTypes');
  if (cached) return cached;
  const data = await fetchFn();
  setCached('plantTypes', data);
  return data;
}

export async function getSubcategoriesCached(fetchFn) {
  const cached = getCached('subcategories');
  if (cached) return cached;
  const data = await fetchFn();
  setCached('subcategories', data);
  return data;
}