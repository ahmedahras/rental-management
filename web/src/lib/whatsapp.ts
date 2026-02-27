export function buildWaLink(phone: string, message: string): string {
  const digits = phone.replace(/[^0-9]/g, '');
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export function openWhatsApp(link: string): void {
  window.open(link, '_blank', 'noopener,noreferrer');
}
