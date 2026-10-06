import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  return (
    <header>
      <Link className="logo" to="/">🌱 EcoSwap</Link>
      <nav>
        <Link to="/marketplace">Browse</Link>
        <Link to="/sell">Sell</Link>
        <Link to="/donate">Donate</Link>
        {user && <><Link to="/dashboard">Dashboard</Link><Link to="/profile">Profile</Link></>}
        {!user && <Link to="/register">Register</Link>}
        {user?.role === 'admin' && <Link to="/admin">Admin</Link>}
      </nav>
      <div>{user
        ? <button onClick={logout}>Sign out</button>
        : <Link className="darkbtn" to="/login">Sign in</Link>}
      </div>
    </header>
  );
}
