import React from 'react';
import { IconUser } from './Icons';
import { LiquidGlassPanel } from './ui/LiquidGlassPanel';
import { LiquidGlassButton } from './ui/LiquidGlassButton';

export const AccountBanner = () => {
  return (
    <section
      style={{
        maxWidth: '1280px',
        width: '100%',
        margin: '0 auto',
        padding: '0 48px 64px 48px',
        boxSizing: 'border-box',
      }}
    >
      <LiquidGlassPanel
        radius={28}
        frosted={true}
        style={{
          padding: '36px 44px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '24px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px', maxWidth: '640px' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.06)',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <IconUser size={28} color="#ffffff" />
          </div>

          <div>
            <h3
              style={{
                fontSize: '24px',
                fontWeight: 700,
                color: '#ffffff',
                margin: '0 0 6px 0',
                letterSpacing: '-0.025em',
                textShadow: 'none',
              }}
            >
              Log in to see your account details
            </h3>
            <p
              style={{
                fontSize: '15px',
                lineHeight: 1.5,
                color: 'rgba(255, 255, 255, 0.7)',
                margin: 0,
              }}
            >
              View past trips, tailored commute suggestions, community badges, and more.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <LiquidGlassButton scale={0.92} style={{ background: 'rgba(255, 255, 255, 0.08)', border: 'none' }}>
            Log in to your account
          </LiquidGlassButton>
          <LiquidGlassButton scale={0.92} style={{ background: 'rgba(255, 255, 255, 0.04)', border: 'none' }}>
            Create an account
          </LiquidGlassButton>
        </div>
      </LiquidGlassPanel>
    </section>
  );
};

export default AccountBanner;
