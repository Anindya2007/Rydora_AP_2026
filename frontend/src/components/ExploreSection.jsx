import React from 'react';
import { IconCar, IconCalendar, IconBike } from './Icons';
import { LiquidGlassPanel } from './ui/LiquidGlassPanel';
import { LiquidGlassButton } from './ui/LiquidGlassButton';

export const ExploreSection = () => {
  const cards = [
    {
      title: 'Ride',
      description: 'Go anywhere with RideShare. Request a ride, hop in, and go.',
      icon: <IconCar size={42} color="#ffffff" />,
      btnText: 'Details',
    },
    {
      title: 'Reserve',
      description: 'Reserve your ride in advance so you can relax on the day of your trip.',
      icon: <IconCalendar size={42} color="#ffffff" />,
      btnText: 'Details',
    },
    {
      title: 'Bike',
      description: 'Get affordable motorbike rides in minutes at your doorstep.',
      icon: <IconBike size={42} color="#ffffff" />,
      btnText: 'Details',
    },
  ];

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
        Explore what you can do with RideShare
      </h2>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))',
          gap: 'clamp(16px, 2.5vw, 24px)',
        }}
      >
        {cards.map((card, index) => (
          <LiquidGlassPanel
            key={index}
            radius={24}
            frosted={true}
            interactive={true}
            style={{
              padding: '28px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              minHeight: '210px',
              boxSizing: 'border-box',
            }}
          >
            {/* Top Content & Graphic */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
              <div style={{ maxWidth: '70%' }}>
                <h3
                  style={{
                    fontSize: '20px',
                    fontWeight: 600,
                    color: '#ffffff',
                    margin: '0 0 10px 0',
                    letterSpacing: '-0.02em',
                  }}
                >
                  {card.title}
                </h3>
                <p
                  style={{
                    fontSize: '14px',
                    lineHeight: 1.5,
                    color: 'rgba(255, 255, 255, 0.75)',
                    margin: 0,
                  }}
                >
                  {card.description}
                </p>
              </div>

              {/* Frosted Glass Icon Bubble */}
              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: 'none',
                  borderRadius: '16px',
                  padding: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  backdropFilter: 'blur(12px)',
                }}
              >
                {card.icon}
              </div>
            </div>

            {/* Bottom Button - Liquid Glass Pill */}
            <div style={{ marginTop: '24px' }}>
              <LiquidGlassButton
                scale={0.8}
                style={{
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: 'none',
                }}
              >
                {card.btnText}
              </LiquidGlassButton>
            </div>
          </LiquidGlassPanel>
        ))}
      </div>
    </section>
  );
};

export default ExploreSection;
