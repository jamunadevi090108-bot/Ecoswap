import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Address, useAuth } from '../context/AuthContext';

const emptyAddress: Address = { addressLine: '', city: '', state: '', pinCode: '', country: '' };

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [address, setAddress] = useState<Address>(emptyAddress);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  function validate() {
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = 'Full Name is required.';
    if (!email.trim()) next.email = 'Email is required.';
    else if (!/^\S+@\S+\.\S+$/.test(email)) next.email = 'Enter a valid email.';
    if (!phoneNumber.trim()) next.phoneNumber = 'Phone Number is required.';
    if (password.length < 8) next.password = 'Password must be at least 8 characters.';
    if (!confirmPassword) next.confirmPassword = 'Confirm Password is required.';
    else if (password !== confirmPassword) next.confirmPassword = 'Passwords must match.';
    for (const [field, value] of Object.entries(address)) {
      if (!value.trim()) next[field] = `${field === 'addressLine' ? 'Address Line' : field === 'pinCode' ? 'PIN Code' : field[0].toUpperCase() + field.slice(1)} is required.`;
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    if (loading || !validate()) return;
    setLoading(true);
    try {
      await register({ name, email, phoneNumber, password, address });
      navigate('/dashboard', { replace: true });
    } catch (registerError) {
      setError(registerError instanceof Error ? registerError.message : 'Unable to create your account.');
    } finally {
      setLoading(false);
    }
  }

  function fieldError(field: string) {
    return errors[field] ? <p className="error">{errors[field]}</p> : null;
  }

  return (
    <section className="formpage">
      <form onSubmit={submit}>
        <h1>Create account</h1>
        {error && <p className="error" role="alert">{error}</p>}
        <input placeholder="Full Name" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} required />
        {fieldError('name')}
        <input placeholder="Email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        {fieldError('email')}
        <input placeholder="Phone Number" type="tel" autoComplete="tel" value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} required />
        {fieldError('phoneNumber')}
        <input placeholder="Password (at least 8 characters)" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required />
        {fieldError('password')}
        <input placeholder="Confirm Password" type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required />
        {fieldError('confirmPassword')}
        <h2>Delivery Address</h2>
        <input className="address-full" placeholder="Address Line" value={address.addressLine} onChange={(event) => setAddress((current) => ({ ...current, addressLine: event.target.value }))} required />
        {fieldError('addressLine')}
        <div className="address-grid">
          {(['city', 'state', 'pinCode', 'country'] as const).map((field) => (
            <div key={field}>
              <input placeholder={field === 'pinCode' ? 'PIN Code' : field[0].toUpperCase() + field.slice(1)} value={address[field]} onChange={(event) => setAddress((current) => ({ ...current, [field]: event.target.value }))} required />
              {fieldError(field)}
            </div>
          ))}
        </div>
        <button className="darkbtn" disabled={loading}>{loading ? 'Creating account…' : 'Register'}</button>
      </form>
    </section>
  );
}
