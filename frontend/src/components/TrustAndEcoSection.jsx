import React from 'react';
import { LiquidGlassPanel } from './ui/LiquidGlassPanel';
import { IconShield, IconZap, IconLeaf, IconCheck } from './Icons';

export const TrustAndEcoSection = () => {
  const pillars = [
    {
      icon: <IconShield size={26} color="#ffffff" />,
      eyebrow: 'Anti-Ghosting',
      title: 'Two-Way Trust Ledger',
      description:
        'Public punctuality streaks and cancellation history visible before booking. Flaky hosts and riders are automatically filtered out.',
      metrics: ['99.2% Host Punctuality', 'Zero Surprise Cancellations'],
    },
    {
      icon: <IconZap size={26} color="#ffffff" />,
      eyebrow: 'EV Native',
      title: 'Live Battery & Route Sync',
      description:
        'Real-time state of charge and pre-scheduled charging stops broadcast to co-riders for exact arrival estimates.',
      metrics: ['Live Battery State (SoC)', 'Synced Fast-Charge Stops'],
    },
    {
      icon: <IconLeaf size={26} color="#ffffff" />,
      eyebrow: 'Impact',
      title: 'Carbon Offset Wallet',
      description:
        'Track verified tailpipe CO₂ saved on every shared commute and earn Green Points redeemable across transit partners.',
      metrics: ['~1.8 kg CO₂ Saved / Ride', 'Redeemable Green Points'],
    },
  ];

  return (
    <section className="rs-section">
      <div style={{ marginBottom: 'clamp(22px, 3vw, 32px)', maxWidth: '720px' }}>
        <span
          style={{
            fontSize: '12px',
            fontWeight: 600,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'rgba(255, 255, 255, 0.6)',
            display: 'block',
            marginBottom: '8px',
          }}
        >
          Trust & Sustainability
        </span>
        <h2
          style={{
            fontSize: 'clamp(26px, 4vw, 36px)',
            fontWeight: 700,
            color: '#ffffff',
            margin: '0 0 10px 0',
            letterSpacing: '-0.025em',
            lineHeight: 1.15,
            textShadow: 'none',
          }}
        >
          Built for reliability and a cleaner city
        </h2>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))',
          gap: 'clamp(16px, 2.5vw, 24px)',
        }}
      >
        {pillars.map((pillar, idx) => (
          <LiquidGlassPanel
            key={idx}
            radius={28}
            frosted={true}
            interactive={true}
            style={{
              padding: '34px 30px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxSizing: 'border-box',
            }}
          >
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '22px',
                }}
              >
                <div
                  style={{
                    width: '52px',
                    height: '52px',
                    borderRadius: '16px',
                    background: 'rgba(255, 255, 255, 0.06)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {pillar.icon}
                </div>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: 'rgba(255, 255, 255, 0.55)',
                  }}
                >
                  {pillar.eyebrow}
                </span>
              </div>

              <h3
                style={{
                  fontSize: '22px',
                  fontWeight: 700,
                  color: '#ffffff',
                  margin: '0 0 12px 0',
                  letterSpacing: '-0.02em',
                  lineHeight: 1.25,
                }}
              >
                {pillar.title}
              </h3>

              <p
                style={{
                  fontSize: '14.5px',
                  lineHeight: 1.6,
                  color: 'rgba(255, 255, 255, 0.72)',
                  margin: '0 0 24px 0',
                }}
              >
                {pillar.description}
              </p>
            </div>

            <div
              style={{
                background: 'rgba(255, 255, 255, 0.04)',
                borderRadius: '16px',
                padding: '14px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              {pillar.metrics.map((m, mIdx) => (
                <div
                  key={mIdx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '13px',
                    fontWeight: 500,
                    color: 'rgba(255, 255, 255, 0.88)',
                  }}
                >
                  <IconCheck size={14} color="#ffffff" />
                  <span>{m}</span>
                </div>
              ))}
            </div>
          </LiquidGlassPanel>
        ))}
      </div>
    </section>
  );
};

export default TrustAndEcoSection;
