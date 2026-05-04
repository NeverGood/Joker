'use client';

import { useEffect } from 'react';

const PAGE_TITLE = 'Joker Bus-Angeles Edition';
const FAVICON_HREF = '/joker-favicon.svg?v=2';

function upsertIconLink(rel, href, type) {
  let link = document.querySelector(`link[rel="${rel}"]`);

  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', rel);
    document.head.appendChild(link);
  }

  link.setAttribute('href', href);

  if (type) {
    link.setAttribute('type', type);
  }
}

export default function PageMetadataClient() {
  useEffect(() => {
    document.title = PAGE_TITLE;
    upsertIconLink('icon', FAVICON_HREF, 'image/svg+xml');
    upsertIconLink('shortcut icon', FAVICON_HREF, 'image/svg+xml');
    upsertIconLink('apple-touch-icon', FAVICON_HREF);
  }, []);

  return null;
}
