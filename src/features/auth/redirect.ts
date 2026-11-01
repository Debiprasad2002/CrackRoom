/** Only same-site paths, so a crafted ?next= cannot send students elsewhere. */
export function safeNext(search: string) {
  const next = new URLSearchParams(search).get('next');
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
}
