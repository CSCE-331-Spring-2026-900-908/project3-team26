// Thin wrapper around fetch() that every page uses to talk to the Express backend.
// Reads the backend URL from VITE_API_URL (set per environment) and falls back to
// localhost for local development. Throws on non-2xx responses so callers can
// surface errors to the UI.
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

// Internal helper that adds JSON headers, handles error responses, and parses JSON.
async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `Request failed: ${response.status}`);
  }

  return response.json();
}

// Public API used everywhere in the frontend: api.get/post/patch/delete(path[, body]).
export const api = {
  get: (path) => request(path),
  post: (path, body) =>
    request(path, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  patch: (path, body) =>
    request(path, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  delete: (path) =>
    request(path, {
      method: 'DELETE',
    }),
};

