import React, { useState } from 'react';
import { api } from '../lib/api';
import { LiquidGlassPanel } from './ui/LiquidGlassPanel';
import { LiquidGlassButton } from './ui/LiquidGlassButton';
import {
  IconMail,
  IconLock,
  IconArrowLeft,
  IconEye,
  IconEyeOff,
  IconSparkles,
} from './Icons';
import loginHeroImg from '../assets/images/Cinematic Purple Light Scene with Silhouettes _ Futuristic Visual Aesthetic.png';

export const LoginPage = ({ onNavigateHome, onNavigateSignup, onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const canSubmit = email.trim() && password.length >= 8;

  const handleSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (loading) return;

    if (!email.trim() || !email.includes('@')) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }
    if (!password) {
      setErrorMsg('Please enter your password.');
      return;
    }

    setErrorMsg('');
    setLoading(true);
    try {
      const { user } = await api.auth.login(email.trim(), password);
      if (onLoginSuccess) {
        onLoginSuccess(user);
      }
    } catch (err) {
      const msg =
        err.response?.data?.error?.message ||
        err.response?.data?.message ||
        (err.response?.status === 403 || err.response?.status === 502 || err.response?.status === 504 || !err.response
          ? 'Unable to connect to backend server. Please ensure the backend is running.'
          : 'Login failed. Please check your credentials and try again.');
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'relative',
        minHeight: '100vh',
        width: '100%',
        display: 'flex',
        alignItems: 'stretch',
        background: 'transparent',
        color: '#ffffff',
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", sans-serif',
      }}
    >
      <style>{`
        .rs-login-split {
          display: flex;
          flex-direction: row;
          width: 100%;
          min-height: 100vh;
        }
        .rs-login-left {
          width: 50%;
          position: sticky;
          top: 0;
          height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0;
          box-sizing: border-box;
          overflow: hidden;
        }
        .rs-login-right {
          width: 50%;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: clamp(32px, 5vw, 64px) clamp(20px, 4vw, 48px);
          box-sizing: border-box;
          z-index: 2;
        }
        .rs-auth-hero-mask {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          -webkit-mask-image: linear-gradient(to right, rgba(0, 0, 0, 1) 60%, rgba(0, 0, 0, 0) 100%);
          mask-image: linear-gradient(to right, rgba(0, 0, 0, 1) 60%, rgba(0, 0, 0, 0) 100%);
        }
        .rs-auth-back-btn {
          position: absolute;
          top: clamp(20px, 2.5vw, 32px);
          left: clamp(20px, 2.5vw, 32px);
          z-index: 10;
        }
        .rs-auth-left-bottom-card {
          position: absolute;
          bottom: clamp(20px, 2.5vw, 32px);
          left: clamp(20px, 2.5vw, 32px);
          right: clamp(20px, 2.5vw, 32px);
          padding: 14px 18px;
          border-radius: 20px;
          background: rgba(15, 15, 25, 0.45);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.15);
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.35);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          pointer-events: none;
        }
        @media (max-width: 960px) {
          .rs-login-split {
            flex-direction: column;
          }
          .rs-login-left {
            width: 100%;
            height: clamp(200px, 28vh, 260px);
            position: relative;
            padding: 0;
          }
          .rs-login-right {
            width: 100%;
            min-height: auto;
            padding: 20px 16px 48px 16px;
          }
          .rs-auth-hero-mask {
            -webkit-mask-image: linear-gradient(to bottom, rgba(0, 0, 0, 1) 45%, rgba(0, 0, 0, 0) 100%) !important;
            mask-image: linear-gradient(to bottom, rgba(0, 0, 0, 1) 45%, rgba(0, 0, 0, 0) 100%) !important;
          }
          .rs-auth-back-btn {
            top: max(14px, env(safe-area-inset-top, 14px));
            left: max(14px, env(safe-area-inset-left, 14px));
          }
          .rs-auth-left-bottom-card {
            display: none !important;
          }
        }
        .rs-login-input::placeholder {
          color: rgba(255, 255, 255, 0.42);
        }
        .rs-login-input:focus {
          outline: none;
        }
      `}</style>

      {/* Main Horizontal Split Container */}
      <div className="rs-login-split">
        {/* ============================================================== */}
        {/* LEFT HALF: Edge-to-Edge Image with Right Fade */}
        {/* ============================================================== */}
        <div className="rs-login-left">
          {/* Edge-to-Edge Image Showcase Container */}
          <div
            style={{
              position: 'relative',
              width: '100%',
              height: '100%',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 2,
            }}
          >
            {/* Floating Top Back Pill Button */}
            <div className="rs-auth-back-btn">
              <LiquidGlassButton
                scale={0.82}
                onClick={onNavigateHome}
                style={{
                  height: '38px',
                  padding: '0 18px',
                  fontSize: '13.5px',
                  background: 'rgba(15, 15, 22, 0.45)',
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  gap: '8px',
                }}
              >
                <IconArrowLeft size={16} />
                <span>Back to RideShare</span>
              </LiquidGlassButton>
            </div>

            {/* Hero Showcase Image with Right-Edge Opacity Fade to 0 (fades bottom on mobile) */}
            <div className="rs-auth-hero-mask">
              <img
                src={loginHeroImg}
                alt="RideShare community login showcase"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: 'block',
                  filter: 'brightness(0.88)',
                }}
              />

              {/* Gentle top/bottom vertical vignette, fades with the image mask */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background:
                    'linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0) 24%, rgba(0,0,0,0) 65%, rgba(0,0,0,0.6) 100%)',
                  pointerEvents: 'none',
                }}
              />
            </div>

            {/* Bottom Glass Pill Card */}
            <div className="rs-auth-left-bottom-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: 'rgba(255, 255, 255, 0.14)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <IconSparkles size={16} color="#ffffff" />
                </div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff' }}>
                    End-to-End Encrypted Access
                  </div>
                  <div style={{ fontSize: '11.5px', color: 'rgba(255, 255, 255, 0.7)' }}>
                    Verified campus & company ride pools
                  </div>
                </div>
              </div>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  padding: '4px 10px',
                  borderRadius: '9999px',
                  background: 'rgba(255, 255, 255, 0.12)',
                  color: '#ffffff',
                  whiteSpace: 'nowrap',
                }}
              >
                Secure
              </div>
            </div>
          </div>
        </div>

        {/* ============================================================== */}
        {/* RIGHT HALF: Pure Apple Liquid Glass Login Form */}
        {/* ============================================================== */}
        <div className="rs-login-right">
          <div style={{ width: '100%', maxWidth: '440px' }}>
            {/* Header */}
            <div style={{ marginBottom: '26px' }}>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '5px 12px',
                  borderRadius: '9999px',
                  background: 'rgba(255, 255, 255, 0.08)',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'rgba(255, 255, 255, 0.85)',
                  marginBottom: '14px',
                }}
              >
                <IconSparkles size={13} color="#ffffff" />
                <span>RideShare Member Portal</span>
              </div>

              <h1
                style={{
                  fontSize: 'clamp(28px, 3.5vw, 36px)',
                  fontWeight: 700,
                  color: '#ffffff',
                  margin: '0 0 10px 0',
                  letterSpacing: '-0.03em',
                  lineHeight: 1.15,
                }}
              >
                Welcome back
              </h1>
              <p
                style={{
                  fontSize: '15px',
                  lineHeight: 1.5,
                  color: 'rgba(255, 255, 255, 0.68)',
                  margin: 0,
                }}
              >
                Sign in to your unified account to ride, drive, and access your community ride pools.
              </p>
            </div>

            {/* Form Fields */}
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {errorMsg && (
                <div
                  style={{
                    padding: '10px 16px',
                    borderRadius: '14px',
                    background: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid rgba(239, 68, 68, 0.35)',
                    color: '#fca5a5',
                    fontSize: '13.5px',
                    lineHeight: 1.4,
                  }}
                >
                  {errorMsg}
                </div>
              )}
              {/* Email Input Capsule */}
              <LiquidGlassPanel
                pill={true}
                frosted={true}
                blur={6}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '12px 20px',
                  width: '100%',
                  boxSizing: 'border-box',
                }}
              >
                <IconMail size={18} color="rgba(255, 255, 255, 0.6)" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Campus or office email"
                  className="rs-login-input"
                  style={{
                    width: '100%',
                    border: 'none',
                    background: 'transparent',
                    fontSize: '15px',
                    fontWeight: 500,
                    color: '#ffffff',
                    marginLeft: '14px',
                    fontFamily: 'inherit',
                  }}
                />
              </LiquidGlassPanel>

              {/* Password Input Capsule with Toggle */}
              <LiquidGlassPanel
                pill={true}
                frosted={true}
                blur={6}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '12px 20px',
                  width: '100%',
                  boxSizing: 'border-box',
                }}
              >
                <IconLock size={18} color="rgba(255, 255, 255, 0.6)" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="rs-login-input"
                  style={{
                    width: '100%',
                    border: 'none',
                    background: 'transparent',
                    fontSize: '15px',
                    fontWeight: 500,
                    color: '#ffffff',
                    marginLeft: '14px',
                    fontFamily: 'inherit',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'rgba(255, 255, 255, 0.6)',
                    cursor: 'pointer',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {showPassword ? <IconEyeOff size={18} /> : <IconEye size={18} />}
                </button>
              </LiquidGlassPanel>

              {/* Remember Me & Forgot Password Row */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  margin: '2px 0 6px 0',
                  fontSize: '13px',
                }}
              >
                <label
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    color: 'rgba(255, 255, 255, 0.7)',
                    cursor: 'pointer',
                    userSelect: 'none',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    style={{
                      accentColor: '#6366f1',
                      cursor: 'pointer',
                    }}
                  />
                  <span>Keep me signed in</span>
                </label>

                <a
                  href="#forgot"
                  onClick={(e) => {
                    e.preventDefault();
                    alert('Password reset link will be sent to your verified email.');
                  }}
                  style={{
                    color: 'rgba(255, 255, 255, 0.65)',
                    textDecoration: 'none',
                    transition: 'color 0.2s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = '#ffffff')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255, 255, 255, 0.65)')}
                >
                  Forgot password?
                </a>
              </div>

              {/* Submit Button */}
              <LiquidGlassButton
                scale={1.02}
                disabled={loading}
                onClick={handleSubmit}
                style={{
                  height: '48px',
                  width: '100%',
                  fontSize: '15px',
                  fontWeight: 600,
                  background: canSubmit && !loading ? 'rgba(255, 255, 255, 0.14)' : 'rgba(255, 255, 255, 0.04)',
                  border: 'none',
                  justifyContent: 'center',
                  marginTop: '6px',
                  opacity: loading ? 0.7 : 1,
                }}
              >
                {loading ? 'Signing In...' : 'Sign In to RideShare →'}
              </LiquidGlassButton>
            </form>

            {/* Switch to Signup Link */}
            <div
              style={{
                textAlign: 'center',
                marginTop: '24px',
                fontSize: '14px',
                color: 'rgba(255, 255, 255, 0.65)',
              }}
            >
              Don't have an account yet?{' '}
              <a
                href="#signup"
                onClick={(e) => {
                  e.preventDefault();
                  if (onNavigateSignup) onNavigateSignup();
                }}
                style={{
                  color: '#ffffff',
                  fontWeight: 600,
                  textDecoration: 'none',
                  marginLeft: '4px',
                }}
              >
                Create one now →
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;

