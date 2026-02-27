'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '../../lib/api';
import { setToken } from '../../lib/auth';

type LoginResponse = {
  access_token: string;
};

export default function LoginPage(): JSX.Element {
  const router = useRouter();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('Admin@2026#Ahras');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const data = await apiFetch<LoginResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      setToken(data.access_token);
      router.push('/dashboard');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <div className='card' style={{ maxWidth: 420, margin: '40px auto' }}>
        <h1>Admin Login</h1>
        <p className='muted'>Single admin authentication for web and mobile apps.</p>
        <form onSubmit={onSubmit} className='grid'>
          <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder='Username' />
          <input
            type='password'
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder='Password'
          />
          <button disabled={loading}>{loading ? 'Signing in...' : 'Sign In'}</button>
          {error ? <div className='error'>{error}</div> : null}
        </form>
      </div>
    </main>
  );
}

