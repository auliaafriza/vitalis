'use client';

/**
 * Trigger a browser download for generated text.
 *
 * The object URL is revoked on the next tick rather than immediately: Safari
 * cancels the download if the URL disappears while the click is still being
 * processed.
 */
export function downloadText(
  filename: string,
  content: string,
  mime = 'text/csv;charset=utf-8',
): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => URL.revokeObjectURL(url), 0);
}
