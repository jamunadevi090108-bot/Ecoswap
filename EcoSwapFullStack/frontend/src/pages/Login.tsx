import { FormEvent, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (loading) return;
    setError('');
    setLoading(true);
    try {
      await login(email.trim().toLowerCase(), password);
      const from = (location.state as { from?: unknown } | null)?.from;
      const destination = typeof from === 'string' && from.startsWith('/') && !from.startsWith('//')
        ? from
        : '/dashboard';
      navigate(destination, { replace: true });
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Unable to sign in.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="formpage">
      <form onSubmit={submit}>
        <h1>Welcome back</h1>
        {error && <p className="error" role="alert">{error}</p>}
        <input placeholder="Email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        <input placeholder="Password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
        <button className="darkbtn" disabled={loading}>{loading ? 'Signing in…' : 'Sign in'}</button>
        <p>New to EcoSwap? <Link to="/register">Create an account</Link></p>
      </form>
    </section>
  );
}
