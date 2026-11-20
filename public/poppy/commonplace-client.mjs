const discoveryPath = '/.well-known/poppy.json';

export async function discoverEdition(origin, get) {
  const store = new URL(origin);
  if (store.protocol !== 'https:' || store.origin !== origin) throw new Error('Expected an HTTPS Company origin.');
  async function lookup(location) {
    const url = new URL(location, origin);
    if (url.origin !== origin || url.username || url.password || url.hash) {
      throw new Error('The edition endpoint is outside the configured Company.');
    }
    return get(url.href);
  }

  const discovery = await lookup(discoveryPath);
  if (discovery.protocol_version !== '1.0' || discovery.organization?.domain !== store.host) {
    throw new Error('Commonplace discovery did not match this host.');
  }
  const description = discovery.apis?.find(({ type }) => type === 'openapi');
  if (!description?.url) throw new Error('The Company did not advertise an OpenAPI description.');
  const openAPI = await lookup(description.url);
  const path = Object.entries(openAPI.paths ?? {}).find(([, operation]) =>
    operation.get?.operationId === 'getCommonplaceEdition')?.[0];
  if (!path || !path.startsWith('/')) throw new Error('The Company did not advertise an edition operation.');

  const edition = await lookup(path);
  if (edition.store !== 'Commonplace' || edition.storefront !== origin + '/commonplace/' ||
      edition.format !== '5x8' || edition.price !== '0.00' || edition.currency !== 'USD' ||
      typeof edition.id !== 'string' || !/^[a-z0-9-]{1,80}$/.test(edition.id) ||
      typeof edition.title !== 'string' || !edition.title.trim() || edition.title.length > 80 ||
      !Array.isArray(edition.quotes) || !edition.quotes.length || edition.quotes.length > 29 ||
      edition.quotes.some((quote) => !quote || !/^press-[\w-]+$/.test(quote.id) ||
        typeof quote.author !== 'string' || typeof quote.source !== 'string') ||
      new Set(edition.quotes.map(({ id }) => id)).size !== edition.quotes.length) {
    throw new Error('The edition terms did not match a valid free Commonplace draft.');
  }
  return {
    id: edition.id, title: edition.title, store: edition.store, storefront: edition.storefront,
    format: edition.format, currency: edition.currency, price: edition.price,
    quotes: edition.quotes.map(({ id, author, source }) => ({ id, author, source })),
  };
}

export function editionBackup(edition, date = new Date()) {
  return {
    version: 1,
    exported: date.toISOString(),
    state: {
      selected: edition.quotes.map(({ id }) => id), favorites: [], custom: [], ratings: {}, shelf: [],
      book: { title: edition.title, author: '', format: edition.format, theme: 'forest', sources: true },
    },
  };
}
