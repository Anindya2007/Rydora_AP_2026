import React from 'react';
import { LiquidGlassPanel } from './ui/LiquidGlassPanel';
import { LiquidGlassButton } from './ui/LiquidGlassButton';
import { IconBriefcase, IconArrowRight } from './Icons';

export const BusinessSection = () => {
  return (
    <section
      className="rs-section"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))',
        gap: 'clamp(16px, 2.5vw, 24px)',
      }}
    >
      {/* Business Card */}
      <LiquidGlassPanel
        radius={28}
        frosted={true}
        interactive={true}
        style={{
          padding: 'clamp(24px, 4vw, 44px) clamp(22px, 3.5vw, 36px)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '14px',
              background: 'rgba(255, 255, 255, 0.06)',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '20px',
            }}
          >
            <IconBriefcase size={24} color="#ffffff" />
          </div>

          <h3
            style={{
              fontSize: 'clamp(22px, 3vw, 28px)',
              fontWeight: 700,
              color: '#ffffff',
              margin: '0 0 12px 0',
              lineHeight: 1.2,
              letterSpacing: '-0.025em',
              textShadow: 'none',
            }}
          >
            The RideShare you know, reimagined for business
          </h3>

          <p
            style={{
              fontSize: '15px',
              lineHeight: 1.6,
              color: 'rgba(255, 255, 255, 0.72)',
              margin: 0,
            }}
          >
            RideShare for Business is a platform for managing corporate rides, university circles, and daily employee commutes for organizations of any size.
          </p>
        </div>

        <div style={{ marginTop: '32px' }}>
          <LiquidGlassButton scale={0.9} style={{ background: 'rgba(255, 255, 255, 0.08)', border: 'none' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              Check out our solutions <IconArrowRight size={15} />
            </span>
          </LiquidGlassButton>
        </div>
      </LiquidGlassPanel>

      {/* Fleet / Vehicle Sharing Card */}
      <LiquidGlassPanel
        radius={28}
        frosted={true}
        interactive={true}
        style={{
          padding: 'clamp(24px, 4vw, 44px) clamp(22px, 3.5vw, 36px)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <span
            style={{
              fontSize: '12px',
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              color: 'rgba(255, 255, 255, 0.6)',
              fontWeight: 600,
              marginBottom: '16px',
              display: 'block',
            }}
          >
            Community Fleet Management
          </span>

          <h3
            style={{
              fontSize: 'clamp(22px, 3vw, 28px)',
              fontWeight: 700,
              color: '#ffffff',
              margin: '0 0 12px 0',
              lineHeight: 1.2,
              letterSpacing: '-0.025em',
              textShadow: 'none',
            }}
          >
            Make money by sharing your vehicle
          </h3>

          <p
            style={{
              fontSize: '15px',
              lineHeight: 1.6,
              color: 'rgba(255, 255, 255, 0.72)',
              margin: 0,
            }}
          >
            Connect with verified campus and workplace drivers. Earn passive income from your vehicle with RideShare’s automated scheduling and safety protocols.
          </p>
        </div>

        <div style={{ marginTop: '32px' }}>
          <LiquidGlassButton scale={0.9} style={{ background: 'rgba(255, 255, 255, 0.06)', border: 'none' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              Get started with fleet <IconArrowRight size={15} />
            </span>
          </LiquidGlassButton>
        </div>
      </LiquidGlassPanel>
    </section>
  );
};

export default BusinessSection;
