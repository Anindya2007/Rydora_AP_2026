import React from 'react';
import { LiquidGlassPanel } from './ui/LiquidGlassPanel';
import { LiquidGlassButton } from './ui/LiquidGlassButton';
import {
  IconShield,
  IconLeaf,
  IconZap,
  IconUsers,
  IconCheck,
  IconNavigation,
  IconGlobe,
  IconMail,
  IconArrowRight,
} from './Icons';

export const AboutPage = ({ onSignUpClick }) => {
  const stats = [
    { value: '50+', label: 'Cities Across India' },
    { value: '10M+', label: 'Safe Trips Completed' },
    { value: '99.4%', label: 'Rider & Partner Rating' },
    { value: '42%', label: 'Electric & Green Fleet' },
  ];

  const safetyPillars = [
    {
      icon: <IconShield size={26} color="#ffffff" />,
      title: 'Rigorous Partner Vetting',
      description:
        'Every driver undergoes biometric identification, document validation, vehicle fitness checks, and continuous background reviews.',
    },
    {
      icon: <IconNavigation size={26} color="#ffffff" />,
      title: 'Real-Time Ride Telemetry',
      description:
        'Our algorithms monitor active trips. If a vehicle takes an unexplained detour or prolonged stop, automated safety check-ins trigger immediately.',
    },
    {
      icon: <IconUsers size={26} color="#ffffff" />,
      title: '24/7 Response Center',
      description:
        'A dedicated human safety team stands ready 24 hours a day to assist in emergencies or resolve safety concerns in real time.',
    },
  ];

  const sustainabilityPillars = [
    {
      icon: <IconZap size={24} color="#34d399" />,
      title: 'Accelerating EV Adoption',
      description:
        'We offer reduced commission fees and partnered fast-charging access to help drivers transition seamlessly to zero-emission electric vehicles.',
      metric: 'Over 12,000 active EV cabs & bikes',
    },
    {
      icon: <IconLeaf size={24} color="#34d399" />,
      title: 'Verified Carbon Reductions',
      description:
        'Every shared and EV trip displays measured tailpipe CO₂ saved, empowering riders and enterprise partners to track certified ESG impact.',
      metric: '~1.8 kg CO₂ avoided per shared ride',
    },
  ];

  const principles = [
    {
      title: 'Fair & Transparent Pricing',
      description:
        'No hidden surcharges or surprise checkout fees. Riders always see the exact price before confirming their ride.',
    },
    {
      title: 'Driver Autonomy & Respect',
      description:
        'Drivers are essential partners. We support them with daily cashouts, clear platform commissions, and comprehensive accident coverage.',
    },
    {
      title: 'Community Mobility',
      description:
        'We work alongside local transit authorities to connect outer suburbs, university hubs, and business corridors affordably.',
    },
  ];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'clamp(36px, 5vw, 72px)',
        paddingTop: 'clamp(10px, 2vw, 24px)',
      }}
    >
      {/* 1. About Hero Section */}
      <section className="rs-section">
        <LiquidGlassPanel
          radius={32}
          frosted={true}
          style={{
            padding: 'clamp(32px, 5vw, 64px)',
            boxSizing: 'border-box',
            position: 'relative',
          }}
        >
          <div style={{ maxWidth: '820px' }}>
            <span
              style={{
                fontSize: '12px',
                fontWeight: 600,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: 'rgba(255, 255, 255, 0.6)',
                marginBottom: '12px',
                display: 'block',
              }}
            >
              Our Mission
            </span>

            <h1
              style={{
                fontSize: 'clamp(32px, 4.5vw, 54px)',
                fontWeight: 800,
                color: '#ffffff',
                margin: '0 0 16px 0',
                letterSpacing: '-0.03em',
                lineHeight: 1.1,
              }}
            >
              Moving people, cities, <br />
              <span
                style={{
                  background: 'linear-gradient(135deg, #34d399, #60a5fa)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                and communities forward.
              </span>
            </h1>

            <p
              style={{
                fontSize: 'clamp(15px, 2vw, 18px)',
                color: 'rgba(255, 255, 255, 0.75)',
                margin: '0 0 32px 0',
                lineHeight: 1.6,
                maxWidth: '680px',
              }}
            >
              RideShare was founded with a singular purpose: to make daily urban transportation
              reliably safe, environmentally sustainable, and genuinely accessible to everyone.
              Today, our platform connects millions of passengers with trusted driver partners
              across 50+ cities.
            </p>

            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
              <LiquidGlassButton
                variant="primary"
                scale={1}
                onClick={onSignUpClick}
                style={{ padding: '14px 28px', fontSize: '15px' }}
              >
                Join the RideShare Community
              </LiquidGlassButton>

              <a
                href="#safety-charter"
                style={{
                  color: 'rgba(255, 255, 255, 0.85)',
                  textDecoration: 'none',
                  fontSize: '15px',
                  fontWeight: 500,
                  padding: '12px 20px',
                  borderRadius: '9999px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'background 0.2s ease',
                }}
              >
                Explore Safety Charter ↓
              </a>
            </div>
          </div>
        </LiquidGlassPanel>
      </section>

      {/* 2. Key Numbers at a Glance */}
      <section className="rs-section">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))',
            gap: 'clamp(16px, 2.5vw, 24px)',
          }}
        >
          {stats.map((item, idx) => (
            <LiquidGlassPanel
              key={idx}
              radius={24}
              frosted={true}
              style={{
                padding: '28px 24px',
                textAlign: 'center',
                boxSizing: 'border-box',
              }}
            >
              <div
                style={{
                  fontSize: 'clamp(32px, 4vw, 44px)',
                  fontWeight: 800,
                  color: '#ffffff',
                  letterSpacing: '-0.03em',
                  marginBottom: '6px',
                }}
              >
                {item.value}
              </div>
              <div
                style={{
                  fontSize: '13px',
                  color: 'rgba(255, 255, 255, 0.65)',
                  fontWeight: 500,
                }}
              >
                {item.label}
              </div>
            </LiquidGlassPanel>
          ))}
        </div>
      </section>

      {/* 3. Safety Charter */}
      <section id="safety-charter" className="rs-section">
        <div style={{ marginBottom: 'clamp(20px, 3vw, 32px)', maxWidth: '720px' }}>
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
            Safety Charter
          </span>
          <h2
            style={{
              fontSize: 'clamp(26px, 4vw, 36px)',
              fontWeight: 700,
              color: '#ffffff',
              margin: '0 0 10px 0',
              letterSpacing: '-0.025em',
            }}
          >
            Zero compromise on passenger and partner safety
          </h2>
          <p
            style={{
              fontSize: '15px',
              color: 'rgba(255, 255, 255, 0.72)',
              margin: 0,
              lineHeight: 1.5,
            }}
          >
            Every ride is protected by comprehensive pre-trip checks, continuous in-ride tracking,
            and immediate emergency response.
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))',
            gap: 'clamp(16px, 2.5vw, 24px)',
          }}
        >
          {safetyPillars.map((item, idx) => (
            <LiquidGlassPanel
              key={idx}
              radius={24}
              frosted={true}
              interactive={true}
              style={{
                padding: '28px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                boxSizing: 'border-box',
              }}
            >
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '14px',
                  background: 'rgba(255, 255, 255, 0.06)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {item.icon}
              </div>

              <div>
                <h3
                  style={{
                    fontSize: '18px',
                    fontWeight: 600,
                    color: '#ffffff',
                    margin: '0 0 8px 0',
                    letterSpacing: '-0.015em',
                  }}
                >
                  {item.title}
                </h3>
                <p
                  style={{
                    fontSize: '14px',
                    color: 'rgba(255, 255, 255, 0.68)',
                    margin: 0,
                    lineHeight: 1.5,
                  }}
                >
                  {item.description}
                </p>
              </div>
            </LiquidGlassPanel>
          ))}
        </div>
      </section>

      {/* 4. Sustainability & Clean Transit */}
      <section className="rs-section">
        <LiquidGlassPanel
          radius={28}
          frosted={true}
          style={{
            padding: 'clamp(28px, 4vw, 48px)',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ marginBottom: '28px', maxWidth: '640px' }}>
            <span
              style={{
                fontSize: '12px',
                fontWeight: 600,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: '#34d399',
                display: 'block',
                marginBottom: '8px',
              }}
            >
              Clean Mobility
            </span>
            <h2
              style={{
                fontSize: 'clamp(24px, 3.5vw, 34px)',
                fontWeight: 700,
                color: '#ffffff',
                margin: '0 0 10px 0',
                letterSpacing: '-0.025em',
              }}
            >
              Pioneering a cleaner, quieter city
            </h2>
            <p
              style={{
                fontSize: '15px',
                color: 'rgba(255, 255, 255, 0.7)',
                margin: 0,
                lineHeight: 1.5,
              }}
            >
              Transportation shouldn't cost the planet. We are committed to achieving a net-zero
              carbon footprint across our entire vehicle network.
            </p>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))',
              gap: '24px',
            }}
          >
            {sustainabilityPillars.map((item, idx) => (
              <div
                key={idx}
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  borderRadius: '20px',
                  padding: '24px',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
                    <div
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '10px',
                        background: 'rgba(52, 211, 153, 0.12)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {item.icon}
                    </div>
                    <h3
                      style={{
                        fontSize: '17px',
                        fontWeight: 600,
                        color: '#ffffff',
                        margin: 0,
                      }}
                    >
                      {item.title}
                    </h3>
                  </div>
                  <p
                    style={{
                      fontSize: '14px',
                      color: 'rgba(255, 255, 255, 0.68)',
                      margin: 0,
                      lineHeight: 1.5,
                    }}
                  >
                    {item.description}
                  </p>
                </div>

                <div
                  style={{
                    marginTop: '20px',
                    paddingTop: '14px',
                    borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#34d399',
                  }}
                >
                  ✓ {item.metric}
                </div>
              </div>
            ))}
          </div>
        </LiquidGlassPanel>
      </section>

      {/* 5. Core Operating Principles */}
      <section className="rs-section">
        <div style={{ marginBottom: 'clamp(20px, 3vw, 32px)', maxWidth: '720px' }}>
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
            Our Values
          </span>
          <h2
            style={{
              fontSize: 'clamp(26px, 4vw, 36px)',
              fontWeight: 700,
              color: '#ffffff',
              margin: '0 0 10px 0',
              letterSpacing: '-0.025em',
            }}
          >
            The principles that guide every decision
          </h2>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))',
            gap: 'clamp(16px, 2.5vw, 24px)',
          }}
        >
          {principles.map((p, idx) => (
            <LiquidGlassPanel
              key={idx}
              radius={24}
              frosted={true}
              style={{
                padding: '28px',
                boxSizing: 'border-box',
              }}
            >
              <h3
                style={{
                  fontSize: '18px',
                  fontWeight: 600,
                  color: '#ffffff',
                  margin: '0 0 10px 0',
                }}
              >
                {p.title}
              </h3>
              <p
                style={{
                  fontSize: '14px',
                  color: 'rgba(255, 255, 255, 0.68)',
                  margin: 0,
                  lineHeight: 1.55,
                }}
              >
                {p.description}
              </p>
            </LiquidGlassPanel>
          ))}
        </div>
      </section>
    </div>
  );
};

export default AboutPage;

