import React from 'react';
import { LiquidGlassPanel } from './ui/LiquidGlassPanel';
import { IconQrCode, IconArrowRight } from './Icons';

export const AppsSection = () => {
  return (
    <section className="rs-section">
      <h2
        style={{
          fontSize: 'clamp(26px, 4vw, 36px)',
          fontWeight: 700,
          color: '#ffffff',
          marginBottom: 'clamp(20px, 3vw, 32px)',
          letterSpacing: '-0.025em',
          textShadow: 'none',
        }}
      >
        It’s easier in the apps
      </h2>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))',
          gap: 'clamp(16px, 2.5vw, 24px)',
        }}
      >
        {/* Rider App Download Card */}
        <LiquidGlassPanel
          radius={24}
          frosted={true}
          interactive={true}
          style={{
            padding: 'clamp(20px, 3vw, 28px) clamp(20px, 3vw, 32px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            cursor: 'pointer',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '16px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <IconQrCode size={36} color="#ffffff" />
            </div>

            <div>
              <h3
                style={{
                  fontSize: '18px',
                  fontWeight: 600,
                  color: '#ffffff',
                  margin: '0 0 4px 0',
                  letterSpacing: '-0.02em',
                }}
              >
                Download the RideShare app
              </h3>
              <span style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.65)' }}>
                Scan to download for iOS & Android
              </span>
            </div>
          </div>

          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.05)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <IconArrowRight size={18} color="#ffffff" />
          </div>
        </LiquidGlassPanel>

        {/* Driver App Download Card */}
        <LiquidGlassPanel
          radius={24}
          frosted={true}
          interactive={true}
          style={{
            padding: '28px 32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '20px',
            cursor: 'pointer',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '16px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <IconQrCode size={36} color="#ffffff" />
            </div>

            <div>
              <h3
                style={{
                  fontSize: '18px',
                  fontWeight: 600,
                  color: '#ffffff',
                  margin: '0 0 4px 0',
                  letterSpacing: '-0.02em',
                }}
              >
                Download the Driver app
              </h3>
              <span style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.65)' }}>
                Scan to manage rides, routes & earnings
              </span>
            </div>
          </div>

          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.05)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <IconArrowRight size={18} color="#ffffff" />
          </div>
        </LiquidGlassPanel>
      </div>
    </section>
  );
};

export default AppsSection;
