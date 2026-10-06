import { BrowserRouter, Route, Routes } from 'react-router-dom';
import Navbar from './components/Navbar';
import Assistant from './components/Assistant';
import RequireAuth from './components/RequireAuth';
import Home from './pages/Home';
import Marketplace from './pages/Marketplace';
import Login from './pages/Login';
import Register from './pages/Register';
import Sell from './pages/Sell';
import Donate from './pages/Donate';
import Recycle from './pages/Recycle';
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';
import ProductDetails from './pages/ProductDetails';
import Admin from './pages/Admin';
import { AuthProvider } from './context/AuthContext';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Navbar />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/marketplace" element={<Marketplace />} />
          <Route path="/product/:id" element={<ProductDetails />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/sell" element={<RequireAuth><Sell /></RequireAuth>} />
          <Route path="/donate" element={<RequireAuth><Donate /></RequireAuth>} />
          <Route path="/recycle" element={<RequireAuth><Recycle /></RequireAuth>} />
          <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
          <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
          <Route path="/admin" element={<RequireAuth admin><Admin /></RequireAuth>} />
          <Route path="*" element={<section className="section"><h1>Page not found</h1><a href="/marketplace">Browse products</a></section>} />
        </Routes>
        <Assistant />
      </BrowserRouter>
    </AuthProvider>
  );
}
