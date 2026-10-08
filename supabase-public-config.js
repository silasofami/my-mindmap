// Public client configuration for anonymous /share/{share_id} previews.
// Supabase anon keys are designed for browser use; never put a service_role key here.
// Fill these values for a deployed public site. The app also falls back to this browser's saved settings.
window.SHINIAN_PUBLIC_SUPABASE = window.SHINIAN_PUBLIC_SUPABASE || { url: '', anonKey: '' };
