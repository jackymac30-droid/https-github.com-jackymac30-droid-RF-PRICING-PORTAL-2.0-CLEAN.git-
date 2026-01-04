import React, { useState, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import { LogIn, Shield, Users, TrendingUp, Zap, Sparkles, ArrowRight, CheckCircle2, Eye, EyeOff, Lock, Key, Brain, BarChart3, Target, Activity, Award, DollarSign, Package, Clock, Globe } from 'lucide-react';
import { fetchSuppliers } from '../utils/database';
import { supabase } from '../utils/supabase';
import { seedDatabase } from '../utils/seedDatabase';
import type { Supplier } from '../types';

export function Login() {
  const { login } = useApp();
  const [selectedUser, setSelectedUser] = useState('');
  const [password, setPassword] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(true);
  const [accessGranted, setAccessGranted] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [seedMessage, setSeedMessage] = useState('');
  
  // Check if running in development mode (localhost or dev environment OR if VITE_DEV_MODE is explicitly true)
  const isDevMode = (import.meta.env.DEV || 
                    window.location.hostname === 'localhost' || 
                    window.location.hostname === '127.0.0.1' ||
                    import.meta.env.VITE_DEV_MODE === 'true') &&
                    import.meta.env.VITE_DEV_MODE !== 'false';
  
  // In dev mode, password is optional (for easy testing)
  const requirePassword = !isDevMode;
  
  // Protection code - required before login (set in .env or use default)
  const requiredAccessCode = import.meta.env.VITE_ACCESS_CODE || 'RF2024';
  const requireAccessCode = !isDevMode; // Skip access code in dev mode

  useEffect(() => {
    // Check if access was already granted this session
    const storedAccess = sessionStorage.getItem('app_access_granted');
    if (storedAccess === 'true') {
      setAccessGranted(true);
    } else if (isDevMode) {
      // Auto-grant in dev mode
      setAccessGranted(true);
    }
  }, [isDevMode]);

  useEffect(() => {
    async function loadSuppliers() {
      try {
        const suppliersData = await fetchSuppliers();
        setSuppliers(suppliersData);
      } catch (err) {
        console.error('Failed to load suppliers:', err);
      } finally {
        setLoadingSuppliers(false);
      }
    }
    loadSuppliers();
  }, []);

  const handleAccessCode = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!accessCode) {
      setError('Please enter the access code');
      return;
    }

    if (accessCode === requiredAccessCode) {
      setAccessGranted(true);
      sessionStorage.setItem('app_access_granted', 'true');
      setError('');
    } else {
      setError('Invalid access code. Please try again.');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!selectedUser) {
      setError('Please select a user');
      setLoading(false);
      return;
    }

    // Only require password in production
    if (requirePassword && !password) {
      setError('Please enter your password');
      setLoading(false);
      return;
    }

    try {
      if (selectedUser === 'rf') {
        // RF Manager login - check password (skip in dev mode)
        if (requirePassword) {
          const rfPassword = import.meta.env.VITE_RF_PASSWORD || 'rf2024!secure';
          if (password !== rfPassword) {
            setError('Invalid password. Please try again.');
            setLoading(false);
            return;
          }
        }
        login('rf-user', 'RF Manager', 'rf');
      } else {
        // Supplier login - authenticate with Supabase
        const supplier = suppliers.find(s => s.id === selectedUser);
        if (!supplier) {
          setError('Selected supplier not found');
          setLoading(false);
          return;
        }

        // In production, require password authentication
        if (requirePassword) {
          // Try Supabase Auth first (if email-based auth is set up)
          if (supplier.email) {
            const { data, error: authError } = await supabase.auth.signInWithPassword({
              email: supplier.email,
              password: password,
            });

            if (authError) {
              // Fallback to simple password check if Supabase Auth fails
              const supplierPassword = import.meta.env.VITE_SUPPLIER_PASSWORD || 'supplier2024!secure';
              if (password !== supplierPassword) {
                setError('Invalid password. Please try again.');
                setLoading(false);
                return;
              }
            } else if (data?.user) {
              // Successfully authenticated with Supabase
              login(supplier.id, supplier.name, 'supplier', supplier.id);
              setLoading(false);
              return;
            }
          } else {
            // Fallback password check for suppliers without email
            const supplierPassword = import.meta.env.VITE_SUPPLIER_PASSWORD || 'supplier2024!secure';
            if (password !== supplierPassword) {
              setError('Invalid password. Please try again.');
              setLoading(false);
              return;
            }
          }
        }
        // In dev mode, skip password check for easy testing
        login(supplier.id, supplier.name, 'supplier', supplier.id);
      }
    } catch (err) {
      setError('Login failed. Please try again.');
      console.error('Login error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Show protection screen before login (in production only)
  if (requireAccessCode && !accessGranted) {
    return (
      <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-slate-900 via-emerald-900 to-slate-900 flex items-center justify-center px-6">
        <div className="w-full max-w-md">
          <div className="bg-white/10 backdrop-blur-2xl rounded-3xl shadow-2xl border border-white/20 p-8 lg:p-10 space-y-6 relative overflow-hidden">
            <div className="absolute -top-40 -right-40 w-80 h-80 bg-emerald-500/20 rounded-full blur-3xl"></div>
            <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-lime-500/20 rounded-full blur-3xl"></div>

            <div className="relative z-10 text-center">
              <div className="flex justify-center mb-6">
                <div className="p-4 bg-gradient-to-br from-emerald-500 to-lime-500 rounded-xl shadow-lg">
                  <Key className="w-8 h-8 text-white" />
                </div>
              </div>
              <h2 className="text-3xl font-bold text-white mb-2">Protected Access</h2>
              <p className="text-emerald-200 text-sm mb-6">
                This application requires an access code to continue.
              </p>

              <form onSubmit={handleAccessCode} className="space-y-4">
                <div>
                  <label htmlFor="accessCode" className="block text-sm font-bold text-white mb-3 flex items-center justify-center gap-2">
                    <Lock className="w-4 h-4 text-emerald-300" />
                    Access Code
                  </label>
                  <input
                    id="accessCode"
                    type="text"
                    value={accessCode}
                    onChange={e => {
                      setAccessCode(e.target.value);
                      setError('');
                    }}
                    className="w-full px-5 py-4 text-base border-2 border-white/20 bg-white/10 backdrop-blur-sm rounded-xl focus:outline-none focus:ring-4 focus:ring-emerald-500/50 focus:border-emerald-400 transition-all text-white font-medium placeholder-white/40 shadow-lg text-center text-2xl tracking-widest"
                    placeholder="Enter code"
                    required
                    autoFocus
                    autoComplete="off"
                  />
                </div>

                {error && (
                  <div className="bg-red-500/20 backdrop-blur-sm border-2 border-red-400/50 text-red-100 px-5 py-4 rounded-xl text-sm font-medium flex items-center gap-2">
                    <Shield className="w-5 h-5 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full bg-gradient-to-r from-emerald-500 via-emerald-600 to-lime-500 text-white py-5 rounded-xl font-bold text-lg hover:from-emerald-600 hover:via-emerald-700 hover:to-lime-600 transition-all duration-300 shadow-2xl hover:shadow-emerald-500/50 transform hover:scale-[1.02] flex items-center justify-center gap-3"
                >
                  <Key className="w-5 h-5" />
                  Verify Access Code
                </button>
              </form>

              <div className="mt-6 pt-6 border-t border-white/10">
                <div className="flex items-center justify-center gap-2 text-emerald-300 text-xs font-semibold">
                  <Shield className="w-4 h-4" />
                  <span>Protected Access • Contact Administrator</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900">
      {/* Enhanced animated gradient orbs with movement */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-emerald-500/30 rounded-full blur-3xl animate-pulse"></div>
      <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-lime-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-emerald-400/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
      <div className="absolute top-1/3 right-1/3 w-[400px] h-[400px] bg-blue-500/15 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '0.5s' }}></div>

      {/* Enhanced grid pattern with depth */}
      <div 
        className="absolute inset-0 bg-[linear-gradient(rgba(16,185,129,0.15)_1px,transparent_1px),linear-gradient(90deg,rgba(16,185,129,0.15)_1px,transparent_1px)] bg-[size:3rem_3rem]"
        style={{
          maskImage: 'radial-gradient(ellipse 100% 60% at 50% 0%, #000 60%, transparent 120%)'
        }}
      ></div>

      {/* Enhanced animated particles with more variety */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(30)].map((_, i) => (
          <div
            key={i}
            className={`absolute rounded-full animate-float ${
              i % 3 === 0 ? 'w-1 h-1 bg-emerald-400/50' :
              i % 3 === 1 ? 'w-1.5 h-1.5 bg-lime-400/40' :
              'w-0.5 h-0.5 bg-white/30'
            }`}
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 4}s`,
              animationDuration: `${4 + Math.random() * 3}s`
            }}
          />
        ))}
      </div>

      {/* Floating geometric shapes */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-32 h-32 border border-emerald-500/20 rounded-lg rotate-45 animate-float" style={{ animationDelay: '0s', animationDuration: '6s' }}></div>
        <div className="absolute bottom-32 right-20 w-24 h-24 border border-lime-500/20 rounded-full animate-float" style={{ animationDelay: '2s', animationDuration: '8s' }}></div>
        <div className="absolute top-1/2 right-10 w-16 h-16 border border-emerald-400/30 rounded-lg rotate-12 animate-float" style={{ animationDelay: '1s', animationDuration: '7s' }}></div>
      </div>

      <div className="relative z-10 flex items-center justify-center min-h-screen px-6 py-16">
        <div className="w-full max-w-7xl grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* Left Side - Enhanced Branding & Features */}
          <div className="hidden lg:flex flex-col space-y-8 text-white">
            {/* Logo Section - Enhanced */}
            <div className="relative mb-6">
              <div className="relative">
                <div className="relative z-10 flex items-center justify-center">
                  <img
                    src="/image.png"
                    alt="Robinson Fresh Logo"
                    className="h-72 w-auto max-w-2xl drop-shadow-2xl object-contain transform hover:scale-105 transition-transform duration-500"
                    style={{ 
                      filter: 'drop-shadow(0 0 50px rgba(16, 185, 129, 0.6)) drop-shadow(0 0 100px rgba(132, 204, 22, 0.4))',
                      imageRendering: 'auto'
                    }}
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      const fallback = document.getElementById('logo-fallback-desktop');
                      if (fallback) fallback.style.display = 'flex';
                    }}
                  />
                  <div id="logo-fallback-desktop" className="hidden flex-col items-center justify-center h-72">
                    <div className="text-9xl font-black mb-4 bg-gradient-to-r from-white via-emerald-100 to-lime-100 bg-clip-text text-transparent leading-none">
                      Robinson
                    </div>
                    <div className="text-7xl font-black bg-gradient-to-r from-emerald-300 to-lime-300 bg-clip-text text-transparent">
                      FRESH
                    </div>
                    <div className="mt-3 text-emerald-300 text-lg font-semibold tracking-widest">™</div>
                  </div>
                </div>
                <div className="absolute inset-0 bg-emerald-500/50 rounded-full blur-3xl animate-pulse -z-10 scale-110"></div>
                <div className="absolute inset-0 bg-lime-500/40 rounded-full blur-3xl -z-20 scale-125"></div>
                <div className="absolute inset-0 bg-emerald-400/30 rounded-full blur-3xl -z-30 scale-150"></div>
              </div>
            </div>

            {/* Status Badge - Enhanced */}
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="relative">
                <div className="w-4 h-4 bg-emerald-400 rounded-full animate-pulse shadow-lg shadow-emerald-400/50"></div>
                <div className="absolute inset-0 w-4 h-4 bg-emerald-400 rounded-full animate-ping opacity-75"></div>
              </div>
              <span className="text-lg font-black tracking-widest uppercase bg-gradient-to-r from-emerald-300 to-lime-300 bg-clip-text text-transparent">
                Live Production System
              </span>
            </div>

            {/* Hero Text - Enhanced */}
            <div className="text-center space-y-4">
              <h1 className="text-5xl lg:text-6xl font-black mb-3 bg-gradient-to-r from-white via-emerald-100 to-lime-100 bg-clip-text text-transparent leading-tight">
                Volume & Pricing
                <br />
                <span className="bg-gradient-to-r from-emerald-300 to-lime-300 bg-clip-text text-transparent">Management</span>
              </h1>
              <p className="text-emerald-100 text-xl lg:text-2xl leading-relaxed max-w-xl mx-auto font-medium">
                AI-powered platform for intelligent pricing, seamless collaboration, and strategic volume allocation.
              </p>
            </div>

            {/* Enhanced Feature Grid */}
            <div className="grid grid-cols-2 gap-4 mt-10">
              <div className="group relative bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-md rounded-2xl p-6 border border-white/20 hover:border-emerald-400/50 hover:bg-white/15 transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-emerald-500/20">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/0 to-emerald-500/10 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-3 bg-gradient-to-br from-emerald-500/30 to-emerald-600/20 rounded-xl group-hover:scale-110 transition-transform">
                      <Brain className="w-6 h-6 text-emerald-300" />
                    </div>
                    <h3 className="font-bold text-white text-lg">AI Intelligence</h3>
                  </div>
                  <p className="text-sm text-emerald-100 leading-relaxed">Smart pricing insights & predictions</p>
                </div>
              </div>

              <div className="group relative bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-md rounded-2xl p-6 border border-white/20 hover:border-emerald-400/50 hover:bg-white/15 transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-emerald-500/20">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/0 to-emerald-500/10 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-3 bg-gradient-to-br from-blue-500/30 to-blue-600/20 rounded-xl group-hover:scale-110 transition-transform">
                      <BarChart3 className="w-6 h-6 text-blue-300" />
                    </div>
                    <h3 className="font-bold text-white text-lg">Analytics</h3>
                  </div>
                  <p className="text-sm text-emerald-100 leading-relaxed">Advanced insights & reporting</p>
                </div>
              </div>

              <div className="group relative bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-md rounded-2xl p-6 border border-white/20 hover:border-emerald-400/50 hover:bg-white/15 transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-emerald-500/20">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/0 to-emerald-500/10 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-3 bg-gradient-to-br from-purple-500/30 to-purple-600/20 rounded-xl group-hover:scale-110 transition-transform">
                      <Zap className="w-6 h-6 text-purple-300" />
                    </div>
                    <h3 className="font-bold text-white text-lg">Real-Time</h3>
                  </div>
                  <p className="text-sm text-emerald-100 leading-relaxed">Live updates & collaboration</p>
                </div>
              </div>

              <div className="group relative bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-md rounded-2xl p-6 border border-white/20 hover:border-emerald-400/50 hover:bg-white/15 transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-emerald-500/20">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/0 to-emerald-500/10 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-3 bg-gradient-to-br from-orange-500/30 to-orange-600/20 rounded-xl group-hover:scale-110 transition-transform">
                      <Target className="w-6 h-6 text-orange-300" />
                    </div>
                    <h3 className="font-bold text-white text-lg">Strategic</h3>
                  </div>
                  <p className="text-sm text-emerald-100 leading-relaxed">Executive dashboards & KPIs</p>
                </div>
              </div>
            </div>

            {/* Enhanced Stats Section */}
            <div className="mt-10 pt-8 border-t border-white/10">
              <div className="grid grid-cols-3 gap-6">
                <div className="text-center group">
                  <div className="text-4xl font-black bg-gradient-to-r from-emerald-300 to-lime-300 bg-clip-text text-transparent mb-1 group-hover:scale-110 transition-transform">
                    AI
                  </div>
                  <div className="text-sm text-emerald-200 font-semibold">Powered</div>
                </div>
                <div className="text-center group">
                  <div className="text-4xl font-black bg-gradient-to-r from-emerald-300 to-lime-300 bg-clip-text text-transparent mb-1 group-hover:scale-110 transition-transform">
                    100%
                  </div>
                  <div className="text-sm text-emerald-200 font-semibold">Real-Time</div>
                </div>
                <div className="text-center group">
                  <div className="text-4xl font-black bg-gradient-to-r from-emerald-300 to-lime-300 bg-clip-text text-transparent mb-1 group-hover:scale-110 transition-transform">
                    24/7
                  </div>
                  <div className="text-sm text-emerald-200 font-semibold">Available</div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Side - Enhanced Login Card */}
          <div className="w-full">
            <div className="bg-gradient-to-br from-white/15 via-white/10 to-white/5 backdrop-blur-2xl rounded-3xl shadow-2xl border-2 border-white/30 p-8 lg:p-10 space-y-6 relative overflow-hidden group">
              {/* Enhanced glow effects */}
              <div className="absolute -top-40 -right-40 w-96 h-96 bg-emerald-500/25 rounded-full blur-3xl group-hover:bg-emerald-500/35 transition-colors duration-1000"></div>
              <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-lime-500/25 rounded-full blur-3xl group-hover:bg-lime-500/35 transition-colors duration-1000"></div>
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-blue-500/15 rounded-full blur-3xl"></div>
              
              {/* Subtle animated border */}
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-emerald-500/20 via-transparent to-lime-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

              <div className="relative z-10">
                {/* Mobile Logo - Enhanced */}
                <div className="lg:hidden text-center mb-10">
                  <div className="relative flex justify-center items-center mb-6">
                    <div className="relative">
                      <div className="relative z-10">
                        <img
                          src="/image.png"
                          alt="Robinson Fresh Logo"
                          className="h-56 w-auto max-w-full drop-shadow-2xl object-contain"
                          style={{ 
                            filter: 'drop-shadow(0 0 40px rgba(16, 185, 129, 0.6)) drop-shadow(0 0 80px rgba(132, 204, 22, 0.4))',
                            imageRendering: 'auto',
                            display: 'block'
                          }}
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            const fallback = target.nextElementSibling as HTMLElement;
                            if (fallback) fallback.style.display = 'flex';
                          }}
                        />
                        <div className="hidden items-center justify-center h-56">
                          <div className="text-center">
                            <div className="text-6xl font-black text-white mb-2 bg-gradient-to-r from-white via-emerald-100 to-lime-100 bg-clip-text text-transparent">
                              Robinson
                            </div>
                            <div className="text-3xl font-black bg-gradient-to-r from-emerald-300 to-lime-300 bg-clip-text text-transparent">
                              FRESH
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="absolute inset-0 bg-emerald-500/50 rounded-full blur-3xl animate-pulse -z-10 scale-110"></div>
                      <div className="absolute inset-0 bg-lime-500/40 rounded-full blur-3xl -z-20 scale-125"></div>
                    </div>
                  </div>
                  <div className="flex items-center justify-center gap-2 text-emerald-300 mb-4">
                    <div className="relative">
                      <div className="w-3 h-3 bg-emerald-400 rounded-full animate-pulse"></div>
                      <div className="absolute inset-0 w-3 h-3 bg-emerald-400 rounded-full animate-ping opacity-75"></div>
                    </div>
                    <span className="text-sm font-black tracking-wider uppercase">Live Production System</span>
                  </div>
                  <h2 className="text-3xl font-black mb-2 bg-gradient-to-r from-white via-emerald-100 to-lime-100 bg-clip-text text-transparent">
                    Volume & Pricing Management
                  </h2>
                  <p className="text-emerald-200 text-base font-medium">AI-powered enterprise platform</p>
                </div>

                <div className="flex items-center gap-4 mb-8">
                  <div className="relative p-4 bg-gradient-to-br from-emerald-500 via-emerald-600 to-lime-500 rounded-2xl shadow-xl group-hover:scale-110 transition-transform duration-300">
                    <LogIn className="w-7 h-7 text-white" />
                    <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent rounded-2xl"></div>
                  </div>
                  <div>
                    <h2 className="text-3xl font-black text-white mb-1">Sign In</h2>
                    <p className="text-emerald-200 text-base font-medium">
                      {isDevMode ? 'Development Mode - Password Optional' : 'Access your enterprise account'}
                    </p>
                  </div>
                </div>
                
                {/* Dev Mode Indicator - Enhanced */}
                {isDevMode && (
                  <div className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border-2 border-yellow-400/50 text-yellow-200 px-5 py-4 rounded-xl text-sm font-semibold flex items-center gap-3 backdrop-blur-sm shadow-lg">
                    <div className="p-2 bg-yellow-500/30 rounded-lg">
                      <Shield className="w-5 h-5" />
                    </div>
                    <span>🔧 Development Mode: Password not required for testing</span>
                  </div>
                )}

                <form onSubmit={handleLogin} className="space-y-6">
                  <div>
                    <label htmlFor="user" className="block text-sm font-bold text-white mb-3 flex items-center gap-2">
                      <Users className="w-4 h-4 text-emerald-300" />
                      Select Your Account
                    </label>
                    <div className="relative group">
                      <select
                        id="user"
                        value={selectedUser}
                        onChange={e => {
                          setSelectedUser(e.target.value);
                          setError('');
                        }}
                        className="w-full px-5 py-4 text-base border-2 border-white/20 bg-white/10 backdrop-blur-sm rounded-xl focus:outline-none focus:ring-4 focus:ring-emerald-500/50 focus:border-emerald-400 transition-all text-white font-semibold appearance-none cursor-pointer hover:bg-white/15 hover:border-white/30 shadow-lg hover:shadow-xl"
                        required
                        style={{
                          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%2310b981' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
                          backgroundRepeat: 'no-repeat',
                          backgroundPosition: 'right 1.25rem center',
                          backgroundSize: '20px'
                        }}
                      >
                        <option value="" className="bg-slate-900 text-white">Choose a user...</option>
                        <optgroup label="RF Internal" className="bg-slate-900">
                          <option value="rf" className="bg-slate-900 text-white">RF Manager</option>
                        </optgroup>
                        <optgroup label="Suppliers" className="bg-slate-900">
                          {loadingSuppliers ? (
                            <option disabled className="bg-slate-900 text-white">Loading suppliers...</option>
                          ) : suppliers.length === 0 ? (
                            <option disabled className="bg-slate-900 text-white">No suppliers available</option>
                          ) : (
                            suppliers.map(s => (
                              <option key={s.id} value={s.id} className="bg-slate-900 text-white">
                                {s.name}
                              </option>
                            ))
                          )}
                        </optgroup>
                      </select>
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none opacity-50 group-hover:opacity-100 transition-opacity">
                        <ArrowRight className="w-5 h-5 text-emerald-400 rotate-90" />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="password" className="block text-sm font-bold text-white mb-3 flex items-center gap-2">
                      <Lock className="w-4 h-4 text-emerald-300" />
                      Password {!requirePassword && <span className="text-emerald-300/70 text-xs font-normal">(Optional in Dev Mode)</span>}
                    </label>
                    <div className="relative group">
                      <input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={e => {
                          setPassword(e.target.value);
                          setError('');
                        }}
                        className="w-full px-5 py-4 text-base border-2 border-white/20 bg-white/10 backdrop-blur-sm rounded-xl focus:outline-none focus:ring-4 focus:ring-emerald-500/50 focus:border-emerald-400 transition-all text-white font-semibold placeholder-white/40 shadow-lg pr-12 hover:bg-white/15 hover:border-white/30 hover:shadow-xl"
                        placeholder={requirePassword ? "Enter your password" : "Enter password (optional in dev mode)"}
                        required={requirePassword}
                        autoComplete="current-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-300 hover:text-emerald-200 transition-colors"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  {error && (
                    <div className="bg-red-500/20 backdrop-blur-sm border-2 border-red-400/50 text-red-100 px-5 py-4 rounded-xl text-sm font-medium flex items-center gap-2 animate-shake">
                      <Shield className="w-5 h-5 flex-shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-emerald-500 via-emerald-600 to-lime-500 text-white py-6 rounded-xl font-black text-lg hover:from-emerald-600 hover:via-emerald-700 hover:to-lime-600 transition-all duration-300 shadow-2xl hover:shadow-emerald-500/50 transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-3 group relative overflow-hidden border-2 border-emerald-400/30"
                  >
                    <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/30 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></span>
                    <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    {loading ? (
                      <>
                        <div className="animate-spin w-6 h-6 border-3 border-white border-t-transparent rounded-full relative z-10"></div>
                        <span className="relative z-10">Authenticating...</span>
                      </>
                    ) : (
                      <>
                        <LogIn className="w-6 h-6 relative z-10 group-hover:translate-x-1 transition-transform" />
                        <span className="relative z-10">Access Platform</span>
                        <ArrowRight className="w-5 h-5 relative z-10 group-hover:translate-x-1 transition-transform opacity-0 group-hover:opacity-100" />
                      </>
                    )}
                  </button>
                </form>

                {/* Seed Database Button (Dev Mode) */}
                {isDevMode && (
                  <div className="mt-6 pt-6 border-t border-white/10">
                    <button
                      type="button"
                      onClick={async () => {
                        setSeeding(true);
                        setSeedMessage('');
                        try {
                          const result = await seedDatabase();
                          setSeedMessage(result.message);
                          if (result.success) {
                            // Reload suppliers after seeding
                            const updatedSuppliers = await fetchSuppliers();
                            setSuppliers(updatedSuppliers);
                          }
                        } catch (err: any) {
                          setSeedMessage(`Error: ${err.message}`);
                        } finally {
                          setSeeding(false);
                        }
                      }}
                      disabled={seeding}
                      className="w-full bg-blue-500/20 hover:bg-blue-500/30 border-2 border-blue-400/50 text-blue-200 py-3 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {seeding ? (
                        <>
                          <div className="animate-spin w-4 h-4 border-2 border-blue-200 border-t-transparent rounded-full"></div>
                          <span>Seeding Database...</span>
                        </>
                      ) : (
                        <>
                          <Package className="w-4 h-4" />
                          <span>Seed Database (Add Suppliers & Data)</span>
                        </>
                      )}
                    </button>
                    {seedMessage && (
                      <div className={`mt-3 px-4 py-2 rounded-lg text-xs font-medium ${
                        seedMessage.includes('Success') 
                          ? 'bg-green-500/20 text-green-200 border border-green-400/50' 
                          : 'bg-red-500/20 text-red-200 border border-red-400/50'
                      }`}>
                        {seedMessage}
                      </div>
                    )}
                  </div>
                )}

                {/* Enhanced Security badge */}
                <div className="mt-8 pt-6 border-t border-white/10">
                  <div className="flex items-center justify-center gap-3 text-emerald-300 text-xs font-bold">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4" />
                      <span>Enterprise Security</span>
                    </div>
                    <span className="text-white/30">•</span>
                    <div className="flex items-center gap-2">
                      <Lock className="w-4 h-4" />
                      <span>Encrypted</span>
                    </div>
                    <span className="text-white/30">•</span>
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4" />
                      <span>Protected</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-8 text-center">
              <p className="text-xs text-emerald-300/60 font-medium">
                © {new Date().getFullYear()} Robinson Fresh. All rights reserved.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
