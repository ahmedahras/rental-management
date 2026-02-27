export function getToken(): string {
  if (typeof window === 'undefined') {
    return '';
  }
  return localStorage.getItem('admin_token') || '';
}

export function setToken(token: string): void {
  if (typeof window === 'undefined') {
    return;
  }
  localStorage.setItem('admin_token', token);
}

export function clearToken(): void {
  if (typeof window === 'undefined') {
    return;
  }
  localStorage.removeItem('admin_token');
}
