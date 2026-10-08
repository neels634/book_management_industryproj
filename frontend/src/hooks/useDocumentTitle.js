import { useEffect } from 'react';

export function useDocumentTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · Folio` : 'Folio · Library Management';
  }, [title]);
}
