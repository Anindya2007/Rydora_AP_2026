import React, { useState } from 'react';
import { LiquidGlassPanel } from './ui/LiquidGlassPanel';
import { LiquidGlassButton } from './ui/LiquidGlassButton';
import { IconSliders, IconCheck, IconSparkles } from './Icons';

const ADDONS = [
  {
    id: 'middleSeatLock',
    title: '2-in-Back Comfort Lock',
    badge: 'Popular',
    description:
      'Lock the middle seat so only 2 passengers share the back cabin with full armrest & legroom.',
    price: 35,
  },
  {
    id: 'quietPod',
    title: 'Quiet Focus Pod',
    badge: 'Silent',
    description:
      'No-call, silent cabin agreed by all co-riders—ideal for reading, work, or resting.',
    price: 15,
  },
  {
    id: 'trunkBay',
    title: 'Guaranteed Trunk Slot',
    badge: 'Luggage',
    description:
      'Reserved boot space for large suitcases, gear, or sports kits with zero pickup surprises.',
    price: 25,
  },
  {
    id: 'climateControl',
    title: 'Pre-Cooled AC Filter',
    badge: 'Climate',
    description:
      'Guaranteed pre-chilled AC settings and pet-welcoming host filter.',
    price: 20,
  },
];

export const CabinAddonsSection = () => {
  const [selected, setSelected] = useState({
    middleSeatLock: true,
    quietPod: true,
    trunkBay: false,
    climateControl: false,
  });

  const toggle = (id) => {
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const baseShare = 90;
  const tollShare = 15;
  const addonCost = ADDONS.reduce((acc, item) => (selected[item.id] ? acc + item.price : acc), 0);
  const total = baseShare + tollShare + addonCost;

  return (
    <section className="rs-section">
      {/* Section Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '20px',
          marginBottom: 'clamp(22px, 3vw, 32px)',
        }}
      >
        <div style={{ maxWidth: '640px' }}>
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
            Cabin Experience
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
            Customize your seat & cabin vibe
          </h2>
          <p style={{ fontSize: '15px', lineHeight: 1.5, color: 'rgba(255, 255, 255, 0.72)', margin: 0 }}>
            Select your preferred comfort add-ons with transparent seat-split pricing.
          </p>
        </div>

        {/* Live Interactive Fare Pill Summary */}
        <LiquidGlassPanel
          pill={true}
          frosted={true}
          blur={8}
          style={{
            padding: '10px clamp(16px, 2.5vw, 22px)',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            background: 'rgba(255, 255, 255, 0.07)',
            maxWidth: '100%',
          }}
        >
          <div>
            <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.6)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Live Seat Split
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: '6px 8px', fontSize: 'clamp(18px, 2.5vw, 22px)', fontWeight: 700, color: '#ffffff', letterSpacing: '-0.02em' }}>
              <span>₹{total}</span>
              <span style={{ fontSize: '12px', fontWeight: 500, color: 'rgba(255, 255, 255, 0.65)' }}>
                (₹{baseShare} base + ₹{addonCost} add-ons · ₹0 surge)
              </span>
            </div>
          </div>
        </LiquidGlassPanel>
      </div>

      {/* 4 Interactive Add-On Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))',
          gap: '20px',
        }}
      >
        {ADDONS.map((addon) => {
          const isActive = !!selected[addon.id];
          return (
            <LiquidGlassPanel
              key={addon.id}
              radius={24}
              frosted={true}
              interactive={true}
              onClick={() => toggle(addon.id)}
              style={{
                padding: '28px',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                background: isActive ? 'rgba(255, 255, 255, 0.09)' : 'rgba(255, 255, 255, 0.035)',
                boxSizing: 'border-box',
                userSelect: 'none',
              }}
            >
              <div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '18px',
                  }}
                >
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      color: '#ffffff',
                      background: 'rgba(255, 255, 255, 0.08)',
                      padding: '5px 11px',
                      borderRadius: '9999px',
                    }}
                  >
                    {addon.badge}
                  </span>

                  <div
                    style={{
                      width: '26px',
                      height: '26px',
                      borderRadius: '50%',
                      background: isActive ? 'rgba(255, 255, 255, 0.25)' : 'rgba(255, 255, 255, 0.06)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'background 0.2s ease',
                    }}
                  >
                    {isActive && <IconCheck size={14} color="#ffffff" />}
                  </div>
                </div>

                <h3
                  style={{
                    fontSize: '20px',
                    fontWeight: 600,
                    color: '#ffffff',
                    margin: '0 0 10px 0',
                    letterSpacing: '-0.02em',
                    lineHeight: 1.25,
                  }}
                >
                  {addon.title}
                </h3>

                <p
                  style={{
                    fontSize: '14px',
                    lineHeight: 1.55,
                    color: 'rgba(255, 255, 255, 0.72)',
                    margin: 0,
                  }}
                >
                  {addon.description}
                </p>
              </div>

              <div
                style={{
                  marginTop: '24px',
                  paddingTop: '16px',
                  borderTop: '1px solid rgba(255, 255, 255, 0.07)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.65)' }}>
                  {isActive ? 'Added to seat' : 'Click to add'}
                </span>
                <span style={{ fontSize: '15px', fontWeight: 700, color: '#ffffff' }}>
                  +₹{addon.price} / seat
                </span>
              </div>
            </LiquidGlassPanel>
          );
        })}
      </div>
    </section>
  );
};

export default CabinAddonsSection;
