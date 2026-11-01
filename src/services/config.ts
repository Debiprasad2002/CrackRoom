/** Base URL of the Django REST API, e.g. https://api.crackroom.in/api */
export const API_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

/** True while the app runs on bundled sample data instead of a real server. */
export const USING_SAMPLE_DATA = API_URL === '';

/** OAuth client ID for "Sign in with Google". Public by design; it identifies the app to Google. */
export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '';
