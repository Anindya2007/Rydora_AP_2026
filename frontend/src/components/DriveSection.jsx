import React from 'react';
import { LiquidGlassPanel } from './ui/LiquidGlassPanel';
import { LiquidGlassButton } from './ui/LiquidGlassButton';
import { IconArrowRight } from './Icons';

export const DriveSection = ({ user, onLoginClick, onSignUpClick }) => {
  return (
    <section className="rs-section">
      <LiquidGlassPanel
        radius={28}
        frosted={true}
        style={{
          padding: '0',
          overflow: 'hidden',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))',
          alignItems: 'stretch',
        }}
      >
        {/* Left Column: Image */}
        <div style={{ minHeight: 'clamp(220px, 32vw, 360px)', position: 'relative' }}>
          <img
            src="https://cdn-s3.autocarindia.com/Skoda/octavia-rs/101_Skoda_Octavia_RS.jpg"
            alt="Drive with RideShare"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
            }}
          />
        </div>

        {/* Right Column: Copy & Actions */}
        <div
          style={{
            padding: 'clamp(24px, 4vw, 48px)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            boxSizing: 'border-box',
          }}
        >
          <span
            style={{
              fontSize: '13px',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              color: 'rgba(255, 255, 255, 0.6)',
              fontWeight: 600,
              marginBottom: '12px',
            }}
          >
            Driver Opportunities
          </span>

          <h2
            style={{
              fontSize: 'clamp(28px, 4vw, 40px)',
              fontWeight: 700,
              color: '#ffffff',
              margin: '0 0 16px 0',
              lineHeight: 1.15,
              letterSpacing: '-0.03em',
              textShadow: 'none',
            }}
          >
            Drive when you want,
            <br />make what you need
          </h2>

          <p
            style={{
              fontSize: '16px',
              lineHeight: 1.6,
              color: 'rgba(255, 255, 255, 0.75)',
              margin: '0 0 32px 0',
            }}
          >
            Make money on your schedule by offering empty seats on your daily commute or driving full-time. Choose your university, office, or public circles with transparent platform fees.
          </p>

          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
            <LiquidGlassButton
              scale={0.95}
              onClick={onSignUpClick}
              style={{ background: 'rgba(255, 255, 255, 0.1)' }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                Get started <IconArrowRight size={16} />
              </span>
            </LiquidGlassButton>

            {!user && (
              <a
                href="#login"
                onClick={(e) => {
                  e.preventDefault();
                  if (onLoginClick) onLoginClick();
                }}
                style={{
                  color: 'rgba(255, 255, 255, 0.8)',
                  fontSize: '14px',
                  fontWeight: 500,
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  transition: 'color 0.2s ease',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#ffffff')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255, 255, 255, 0.8)')}
              >
                Already have an account? Sign in →
              </a>
            )}
          </div>
        </div>
      </LiquidGlassPanel>
    </section>
  );
};

export default DriveSection;
