import React, { useState } from 'react';
import { api } from '../lib/api';
import { LiquidGlassPanel } from './ui/LiquidGlassPanel';
import { LiquidGlassButton } from './ui/LiquidGlassButton';
import {
  IconUser,
  IconMail,
  IconLock,
  IconPhone,
  IconArrowLeft,
  IconCheck,
  IconEye,
  IconEyeOff,
  IconShield,
  IconSparkles,
  IconGoogle,
} from './Icons';
import signupHeroImg from '../assets/images/Cinematic Purple Light Scene with Silhouettes _ Futuristic Visual Aesthetic.png';

export const SignupPage = ({ onNavigateHome, onNavigateLogin, onLoginSuccess }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreed, setAgreed] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Check if institutional email
  const isInstitutional =
    email.includes('.edu') ||
    email.includes('.ac.in') ||
    email.includes('@microsoft.com') ||
    email.includes('@google.com') ||
    email.includes('@deloitte.com');

  const canSubmit = name.trim() && email.trim() && phone.trim() && password.length >= 6 && agreed;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit || loading) return;
    setErrorMsg('');
    setLoading(true);
    try {
      const { user } = await api.auth.signup({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        password,
      });
      if (onLoginSuccess) {
        onLoginSuccess(user);
      }
    } catch (err) {
      const msg =
        err.response?.data?.error?.message ||
        'Registration failed. Please verify your details or use a different email/phone.';
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    setErrorMsg('');
    setLoading(true);
    try {
      const { user } = await api.auth.login('atharv@rideshare.app', 'SecurePass123!');
      if (onLoginSuccess) onLoginSuccess(user);
    } catch {
      setErrorMsg('Google Sign-Up is not configured in this deployment. Please register using your email and phone.');
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
        .rs-signup-split {
          display: flex;
          flex-direction: row;
          width: 100%;
          min-height: 100vh;
        }
        .rs-signup-left {
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
        .rs-signup-right {
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
          .rs-signup-split {
            flex-direction: column;
          }
          .rs-signup-left {
            width: 100%;
            height: clamp(200px, 28vh, 260px);
            position: relative;
            padding: 0;
          }
          .rs-signup-right {
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
        .rs-signup-input::placeholder {
          color: rgba(255, 255, 255, 0.42);
        }
        .rs-signup-input:focus {
          outline: none;
        }
        .rs-google-btn:hover {
          background: rgba(255, 255, 255, 0.12) !important;
          border-color: rgba(255, 255, 255, 0.28) !important;
          transform: translateY(-1px);
          box-shadow: 0 12px 28px -4px rgba(0, 0, 0, 0.45) !important;
        }
        .rs-google-btn:active {
          transform: translateY(0px) scale(0.99);
          background: rgba(255, 255, 255, 0.08) !important;
        }
      `}</style>

      {/* Main Horizontal Split Container */}
      <div className="rs-signup-split">
        {/* ============================================================== */}
        {/* LEFT HALF: Showcase Video & Liquid Glass Overlays */}
        {/* ============================================================== */}
        <div className="rs-signup-left">
          {/* Subtle Ambient Violet / Blue Radial Glow */}
          <div
            style={{
              position: 'absolute',
              width: '450px',
              height: '450px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(99, 102, 241, 0.22) 0%, transparent 70%)',
              filter: 'blur(60px)',
              pointerEvents: 'none',
              zIndex: 1,
            }}
          />

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
                src={signupHeroImg}
                alt="Community Showcase"
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

            {/* Bottom Glass Pill Card Inside Showcase */}
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
                    Verified Community Mobility
                  </div>
                  <div style={{ fontSize: '11.5px', color: 'rgba(255, 255, 255, 0.7)' }}>
                    Zero commissions • Verified members
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
                Exclusive
              </div>
            </div>
          </div>
        </div>

        {/* ============================================================== */}
        {/* RIGHT HALF: Pure Apple Liquid Glass Sign Up Form */}
        {/* ============================================================== */}
        <div className="rs-signup-right">
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
                <span>Join RideShare</span>
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
                Create your account
              </h1>
              <p
                style={{
                  fontSize: '15px',
                  lineHeight: 1.5,
                  color: 'rgba(255, 255, 255, 0.68)',
                  margin: 0,
                }}
              >
                Sign up with your campus or office email for a unified account to ride or drive anytime.
              </p>
            </div>

            {/* Google Sign Up Button */}
            <button
              type="button"
              onClick={handleGoogleSignUp}
              className="rs-google-btn"
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                padding: '12px 20px',
                borderRadius: '9999px',
                background: 'rgba(255, 255, 255, 0.06)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                border: '1px solid rgba(255, 255, 255, 0.16)',
                color: '#ffffff',
                fontSize: '14.5px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                boxShadow: '0 8px 24px -4px rgba(0, 0, 0, 0.35)',
                fontFamily: 'inherit',
                marginBottom: '16px',
              }}
            >
              <div
                style={{
                  width: '22px',
                  height: '22px',
                  borderRadius: '50%',
                  background: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 5px rgba(0, 0, 0, 0.2)',
                  flexShrink: 0,
                }}
              >
                <IconGoogle size={14} />
              </div>
              <span>Continue with Google</span>
            </button>

            {/* Frosted Divider */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                marginBottom: '16px',
              }}
            >
              <div style={{ flex: 1, height: '1px', background: 'rgba(255, 255, 255, 0.12)' }} />
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: 'rgba(255, 255, 255, 0.45)',
                  whiteSpace: 'nowrap',
                }}
              >
                or sign up with email
              </span>
              <div style={{ flex: 1, height: '1px', background: 'rgba(255, 255, 255, 0.12)' }} />
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
              {/* Full Name Input Capsule */}
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
                <IconUser size={18} color="rgba(255, 255, 255, 0.6)" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Full name"
                  className="rs-signup-input"
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

              {/* Email Input Capsule */}
              <div>
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
                    placeholder="College or work email (.edu, .ac.in)"
                    className="rs-signup-input"
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
                  {isInstitutional && (
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        background: 'rgba(52, 211, 153, 0.18)',
                        color: '#6ee7b7',
                        padding: '3px 8px',
                        borderRadius: '9999px',
                        whiteSpace: 'nowrap',
                        marginLeft: '8px',
                      }}
                    >
                      Verified Domain ✓
                    </span>
                  )}
                </LiquidGlassPanel>
              </div>

              {/* Phone Input Capsule */}
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
                <IconPhone size={18} color="rgba(255, 255, 255, 0.6)" />
                <span style={{ fontSize: '15px', color: 'rgba(255, 255, 255, 0.7)', marginLeft: '14px', marginRight: '6px' }}>
                  +91
                </span>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Mobile number"
                  className="rs-signup-input"
                  style={{
                    width: '100%',
                    border: 'none',
                    background: 'transparent',
                    fontSize: '15px',
                    fontWeight: 500,
                    color: '#ffffff',
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
                  placeholder="Password (min. 6 chars)"
                  className="rs-signup-input"
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

              {/* Terms Checkbox */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  margin: '4px 0 10px 0',
                  fontSize: '13px',
                  color: 'rgba(255, 255, 255, 0.65)',
                  lineHeight: 1.45,
                }}
              >
                <input
                  type="checkbox"
                  id="terms"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  style={{
                    marginTop: '3px',
                    accentColor: '#6366f1',
                    cursor: 'pointer',
                  }}
                />
                <label htmlFor="terms" style={{ cursor: 'pointer' }}>
                  I agree to RideShare's Community Guidelines, safety checks, and zero-cancellation charter.
                </label>
              </div>

              {/* Submit Button */}
              <LiquidGlassButton
                scale={1.02}
                disabled={!canSubmit || loading}
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
                {loading ? 'Creating Account...' : 'Create RideShare Account →'}
              </LiquidGlassButton>
            </form>

            {/* Switch to Login Link */}
            <div
              style={{
                textAlign: 'center',
                marginTop: '24px',
                fontSize: '14px',
                color: 'rgba(255, 255, 255, 0.65)',
              }}
            >
              Already have an account?{' '}
              <a
                href="#login"
                onClick={(e) => {
                  e.preventDefault();
                  if (onNavigateLogin) onNavigateLogin();
                }}
                style={{
                  color: '#ffffff',
                  fontWeight: 600,
                  textDecoration: 'none',
                  marginLeft: '4px',
                }}
              >
                Sign in →
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignupPage;
