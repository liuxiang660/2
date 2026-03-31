export function downloadTextFile(fileName: string, content: string, mimeType = 'text/plain;charset=utf-8'): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function downloadCsvFile(fileName: string, headers: string[], rows: Array<Array<string | number>>): void {
  const escapedHeaders = headers.map((value) => escapeCsvCell(value));
  const escapedRows = rows.map((row) => row.map((cell) => escapeCsvCell(cell)).join(','));
  downloadTextFile(fileName, [escapedHeaders.join(','), ...escapedRows].join('\n'), 'text/csv;charset=utf-8');
}

export function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text);
  }

  return new Promise((resolve, reject) => {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(textarea);
      if (!successful) {
        reject(new Error('copy failed'));
        return;
      }
      resolve();
    } catch (error) {
      reject(error);
    }
  });
}

export async function shareText(title: string, text: string): Promise<'shared' | 'copied'> {
  if (navigator.share) {
    await navigator.share({ title, text });
    return 'shared';
  }

  await copyToClipboard(text);
  return 'copied';
}

export function openMailTo(email: string, subject: string, body: string): void {
  const href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  window.location.href = href;
}

function escapeCsvCell(value: string | number): string {
  const raw = String(value ?? '');
  if (!/[",\n]/.test(raw)) {
    return raw;
  }
  return `"${raw.replace(/"/g, '""')}"`;
}
