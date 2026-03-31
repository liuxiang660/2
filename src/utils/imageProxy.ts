const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const ABSOLUTE_URL = /^https?:\/\//i;

export function toDisplayImageUrl(rawUrl?: string | null): string {
  const url = String(rawUrl || '').trim();
  if (!url) return '';

  if (!ABSOLUTE_URL.test(url)) {
    return url;
  }

  return `${API_BASE_URL}/image-proxy?url=${encodeURIComponent(url)}`;
}
