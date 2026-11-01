import type { Resource } from '@/types';
import { SAMPLE_RESOURCES } from '@/data/sampleResources';
import { API_URL, USING_SAMPLE_DATA } from './config';
import { apiGet, settle } from './http';

// Students only ever see published resources. With a real API the server enforces
// this; the filter below only applies to the bundled sample catalogue.
const published = SAMPLE_RESOURCES.filter((r) => r.status === 'published').sort((a, b) =>
  b.publishedAt.localeCompare(a.publishedAt),
);

/** The API returns a site-relative file path; resolve it against wherever the API lives. */
function withAbsoluteFile(resource: Resource): Resource {
  if (!resource.fileUrl) return resource;
  const base = /^https?:\/\//.test(API_URL) ? API_URL : window.location.origin;
  return { ...resource, fileUrl: new URL(resource.fileUrl, base).toString() };
}

export const notesService = {
  async list(): Promise<Resource[]> {
    if (USING_SAMPLE_DATA) return settle(published);
    return (await apiGet<Resource[]>('/resources/')).map(withAbsoluteFile);
  },

  async get(id: string): Promise<Resource | null> {
    if (USING_SAMPLE_DATA) return settle(published.find((r) => r.id === id) ?? null);
    try {
      return withAbsoluteFile(await apiGet<Resource>(`/resources/${encodeURIComponent(id)}/`));
    } catch (error) {
      if ((error as { status?: number }).status === 404) return null;
      throw error;
    }
  },
};

/** Adds the server's "save instead of view" switch to a file link. */
export function downloadUrl(fileUrl: string) {
  const url = new URL(fileUrl);
  url.searchParams.set('download', '1');
  return url.toString();
}
