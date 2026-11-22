import React, { useState } from 'react';
import { LiquidGlassPanel } from './ui/LiquidGlassPanel';
import { LiquidGlassButton } from './ui/LiquidGlassButton';
import {
  IconCar,
  IconClock,
  IconCheck,
  IconShield,
  IconArrowRight,
  IconQrCode,
  IconNavigation,
  IconSliders,
  IconZap,
} from './Icons';

export const DrivePage = ({ user, onSignUpClick, onLoginClick }) => {
  const [weeklyHours, setWeeklyHours] = useState(30);

  // Hourly base rate in ₹
  const hourlyRate = 620;
  const estimatedWeekly = weeklyHours * hourlyRate;
  const estimatedMonthly = estimatedWeekly * 4.2;

  const driverPerks = [
    {
      icon: <IconZap size={24} color="#ffffff" />,
      title: 'Daily Instant Payouts',
      description:
        'Transfer your trip earnings to your bank account instantly at any hour. No waiting for weekly payouts.',
    },
    {
      icon: <IconClock size={24} color="#ffffff" />,
      title: 'Total Schedule Freedom',
      description:
        'No fixed shifts, no bosses. Log on when it suits you—drive 2 hours after work or make it full-time.',
    },
    {
      icon: <IconShield size={24} color="#ffffff" />,
      title: 'Active Trip Insurance',
      description:
        'Comprehensive accident cover and 24/7 medical assistance provided on every active trip for you and your vehicle.',
    },
    {
      icon: <IconSliders size={24} color="#ffffff" />,
      title: 'Transparent Platform Fee',
      description:
        'Clear, upfront earnings breakdown with no hidden cuts or surprise deductions on your statements.',
    },
  ];

  const steps = [
    {
      num: '01',
      title: 'Register Online',
      desc: 'Submit your driving license, vehicle registration, and ID proof in under 5 minutes.',
    },
    {
      num: '02',
      title: 'Quick Verification',
      desc: 'Our team verifies your documents and performs a swift vehicle safety check within 24 hours.',
    },
    {
      num: '03',
      title: 'Hit the Road',
      desc: 'Turn on Driver mode in the app, accept your first passenger request, and start earning.',
    },
  ];

  const vehicleCategories = [
    {
      type: 'Sedan & Hatchback',
      badge: 'Most Popular',
      desc: '4 doors, working AC, 2014 or newer. Ideal for daily city trips and airport runs.',
      minEarning: '₹22,000 / week',
    },
    {
      type: 'Premier & XL',
      badge: 'High Fare',
      desc: 'Spacious 6-seaters and premium sedans. Earn higher fares on group & executive bookings.',
      minEarning: '₹34,000 / week',
    },
    {
      type: 'Motorbike & Moto',
      badge: 'Fastest Onboarding',
      desc: 'Valid 2-wheeler license, helmet, and vehicle documents. Zip through traffic easily.',
      minEarning: '₹14,000 / week',
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
      {/* 1. Drive Hero Section */}
      <section className="rs-section">
        <LiquidGlassPanel
          radius={32}
          frosted={true}
          style={{
            padding: 0,
            overflow: 'hidden',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))',
            alignItems: 'stretch',
          }}
        >
          {/* Left: Copy & Call to Action */}
          <div
            style={{
              padding: 'clamp(28px, 5vw, 56px)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              boxSizing: 'border-box',
            }}
          >
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
              Drive with RideShare
            </span>

            <h1
              style={{
                fontSize: 'clamp(32px, 4.5vw, 52px)',
                fontWeight: 800,
                color: '#ffffff',
                margin: '0 0 16px 0',
                letterSpacing: '-0.03em',
                lineHeight: 1.1,
              }}
            >
              Drive on your schedule. <br />
              <span
                style={{
                  background: 'linear-gradient(135deg, #a78bfa, #c084fc)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                Earn on your terms.
              </span>
            </h1>

            <p
              style={{
                fontSize: 'clamp(15px, 2vw, 17px)',
                color: 'rgba(255, 255, 255, 0.75)',
                margin: '0 0 32px 0',
                lineHeight: 1.55,
                maxWidth: '520px',
              }}
            >
              Whether you want to supplement your income or drive full-time, RideShare gives you
              the freedom to work whenever you choose with daily payouts and round-the-clock support.
            </p>

            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
              <LiquidGlassButton
                variant="primary"
                scale={1}
                onClick={onSignUpClick}
                style={{ padding: '14px 28px', fontSize: '15px' }}
              >
                Sign up to drive
              </LiquidGlassButton>

              <a
                href="#earnings-calculator"
                style={{
                  color: 'rgba(255, 255, 255, 0.85)',
                  textDecoration: 'none',
                  fontSize: '15px',
                  fontWeight: 500,
                  padding: '12px 18px',
                  borderRadius: '9999px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'background 0.2s ease',
                }}
              >
                Estimate earnings ↓
              </a>
            </div>
          </div>

          {/* Right: Driver Car Visual */}
          <div
            style={{
              minHeight: 'clamp(260px, 35vw, 420px)',
              position: 'relative',
              background: 'linear-gradient(180deg, rgba(15,15,24,0.4), rgba(15,15,24,0.9))',
            }}
          >
            <img
              src="https://cdn-s3.autocarindia.com/Skoda/octavia-rs/101_Skoda_Octavia_RS.jpg"
              alt="Driver in modern car"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block',
              }}
            />
          </div>
        </LiquidGlassPanel>
      </section>

      {/* 2. Interactive Earnings Estimator */}
      <section id="earnings-calculator" className="rs-section">
        <LiquidGlassPanel
          radius={28}
          frosted={true}
          style={{
            padding: 'clamp(28px, 4vw, 48px)',
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))',
              gap: 'clamp(24px, 4vw, 48px)',
              alignItems: 'center',
            }}
          >
            {/* Left: Hours Control */}
            <div>
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
                Earnings Estimator
              </span>
              <h2
                style={{
                  fontSize: 'clamp(26px, 3.5vw, 36px)',
                  fontWeight: 700,
                  color: '#ffffff',
                  margin: '0 0 12px 0',
                  letterSpacing: '-0.025em',
                  lineHeight: 1.15,
                }}
              >
                See what you could earn
              </h2>
              <p
                style={{
                  fontSize: '15px',
                  color: 'rgba(255, 255, 255, 0.7)',
                  margin: '0 0 28px 0',
                  lineHeight: 1.5,
                }}
              >
                Estimated earnings in Delhi NCR based on actual driver averages across active trips,
                peak hour bonuses, and fuel subsidies.
              </p>

              <div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '10px',
                  }}
                >
                  <span style={{ fontSize: '15px', color: '#ffffff', fontWeight: 500 }}>
                    Hours driving per week:
                  </span>
                  <span
                    style={{
                      fontSize: '18px',
                      fontWeight: 700,
                      color: '#a78bfa',
                    }}
                  >
                    {weeklyHours} hrs / week
                  </span>
                </div>

                <input
                  type="range"
                  min="5"
                  max="60"
                  step="5"
                  value={weeklyHours}
                  onChange={(e) => setWeeklyHours(Number(e.target.value))}
                  style={{
                    width: '100%',
                    height: '6px',
                    borderRadius: '4px',
                    accentColor: '#a78bfa',
                    cursor: 'pointer',
                    outline: 'none',
                  }}
                />

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '12px',
                    color: 'rgba(255, 255, 255, 0.45)',
                    marginTop: '8px',
                  }}
                >
                  <span>Part-time (10 hrs)</span>
                  <span>Regular (30 hrs)</span>
                  <span>Full-time (50+ hrs)</span>
                </div>
              </div>
            </div>

            {/* Right: Projected Figures Display */}
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.04)',
                borderRadius: '24px',
                padding: 'clamp(20px, 3vw, 32px)',
                display: 'flex',
                flexDirection: 'column',
                gap: '20px',
                border: '1px solid rgba(255, 255, 255, 0.06)',
              }}
            >
              <div>
                <span
                  style={{
                    fontSize: '13px',
                    color: 'rgba(255, 255, 255, 0.65)',
                    display: 'block',
                    marginBottom: '4px',
                  }}
                >
                  Estimated Weekly Earnings
                </span>
                <div
                  style={{
                    fontSize: 'clamp(32px, 4vw, 44px)',
                    fontWeight: 800,
                    color: '#ffffff',
                    letterSpacing: '-0.03em',
                  }}
                >
                  ₹{estimatedWeekly.toLocaleString('en-IN')}
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingTop: '16px',
                  borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                }}
              >
                <div>
                  <span style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.6)' }}>
                    Monthly Projection:
                  </span>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: '#c084fc' }}>
                    ~₹{Math.round(estimatedMonthly).toLocaleString('en-IN')}
                  </div>
                </div>
                <LiquidGlassButton scale={0.9} variant="primary" onClick={onSignUpClick}>
                  Get Started
                </LiquidGlassButton>
              </div>
            </div>
          </div>
        </LiquidGlassPanel>
      </section>

      {/* 3. Driver Perks & Benefits */}
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
            Driver Benefits
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
            Built for drivers, every mile of the way
          </h2>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))',
            gap: 'clamp(16px, 2.5vw, 24px)',
          }}
        >
          {driverPerks.map((perk, idx) => (
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
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  background: 'rgba(255, 255, 255, 0.06)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {perk.icon}
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
                  {perk.title}
                </h3>
                <p
                  style={{
                    fontSize: '14px',
                    color: 'rgba(255, 255, 255, 0.68)',
                    margin: 0,
                    lineHeight: 1.5,
                  }}
                >
                  {perk.description}
                </p>
              </div>
            </LiquidGlassPanel>
          ))}
        </div>
      </section>

      {/* 4. Three Simple Steps to Start */}
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
            Fast Onboarding
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
            How to get started
          </h2>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))',
            gap: 'clamp(16px, 2.5vw, 24px)',
          }}
        >
          {steps.map((s, idx) => (
            <LiquidGlassPanel
              key={idx}
              radius={24}
              frosted={true}
              style={{
                padding: '28px',
                boxSizing: 'border-box',
                position: 'relative',
              }}
            >
              <span
                style={{
                  fontSize: '32px',
                  fontWeight: 800,
                  color: 'rgba(255, 255, 255, 0.15)',
                  display: 'block',
                  marginBottom: '12px',
                  letterSpacing: '-0.03em',
                }}
              >
                {s.num}
              </span>
              <h3
                style={{
                  fontSize: '18px',
                  fontWeight: 600,
                  color: '#ffffff',
                  margin: '0 0 8px 0',
                }}
              >
                {s.title}
              </h3>
              <p
                style={{
                  fontSize: '14px',
                  color: 'rgba(255, 255, 255, 0.68)',
                  margin: 0,
                  lineHeight: 1.5,
                }}
              >
                {s.desc}
              </p>
            </LiquidGlassPanel>
          ))}
        </div>
      </section>

      {/* 5. Eligible Vehicle Options */}
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
            Vehicle Categories
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
            What you can drive with us
          </h2>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))',
            gap: 'clamp(16px, 2.5vw, 24px)',
          }}
        >
          {vehicleCategories.map((v, idx) => (
            <LiquidGlassPanel
              key={idx}
              radius={24}
              frosted={true}
              interactive={true}
              style={{
                padding: '28px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                boxSizing: 'border-box',
              }}
            >
              <div>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: '#c084fc',
                    background: 'rgba(192, 132, 252, 0.15)',
                    padding: '4px 8px',
                    borderRadius: '9999px',
                    display: 'inline-block',
                    marginBottom: '14px',
                  }}
                >
                  {v.badge}
                </span>

                <h3
                  style={{
                    fontSize: '19px',
                    fontWeight: 700,
                    color: '#ffffff',
                    margin: '0 0 8px 0',
                  }}
                >
                  {v.type}
                </h3>
                <p
                  style={{
                    fontSize: '14px',
                    color: 'rgba(255, 255, 255, 0.68)',
                    margin: 0,
                    lineHeight: 1.5,
                  }}
                >
                  {v.desc}
                </p>
              </div>

              <div
                style={{
                  marginTop: '24px',
                  paddingTop: '16px',
                  borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.55)' }}>
                  Avg. potential:
                </span>
                <span style={{ fontSize: '15px', fontWeight: 700, color: '#ffffff' }}>
                  {v.minEarning}
                </span>
              </div>
            </LiquidGlassPanel>
          ))}
        </div>
      </section>

      {/* 6. Driver App Download Card */}
      <section className="rs-section">
        <LiquidGlassPanel
          radius={28}
          frosted={true}
          style={{
            padding: 'clamp(24px, 4vw, 40px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '24px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '16px',
                background: 'rgba(255, 255, 255, 0.06)',
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
                  fontSize: '20px',
                  fontWeight: 700,
                  color: '#ffffff',
                  margin: '0 0 4px 0',
                }}
              >
                Download the RideShare Driver App
              </h3>
              <p
                style={{
                  fontSize: '14px',
                  color: 'rgba(255, 255, 255, 0.65)',
                  margin: 0,
                }}
              >
                Available for Android and iOS. Scan with your phone camera or click to download.
              </p>
            </div>
          </div>

          <LiquidGlassButton scale={0.95} variant="primary" onClick={onSignUpClick}>
            Get the App →
          </LiquidGlassButton>
        </LiquidGlassPanel>
      </section>
    </div>
  );
};

export default DrivePage;

