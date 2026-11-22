import React, { useState } from 'react';
import { HeroSection } from './HeroSection';
import { ExploreSection } from './ExploreSection';
import { AppsSection } from './AppsSection';
import { LiquidGlassPanel } from './ui/LiquidGlassPanel';
import { LiquidGlassButton } from './ui/LiquidGlassButton';
import {
  IconShield,
  IconClock,
  IconCheck,
  IconSliders,
  IconSparkles,
  IconCar,
  IconPhone,
  IconNavigation,
} from './Icons';

export const RidePage = ({ user, onLoginClick, onSignUpClick }) => {
  // Rider comfort preferences state
  const [preferences, setPreferences] = useState({
    quietRide: true,
    acCool: true,
    luggageSpace: false,
    childSeat: false,
  });

  const togglePref = (key) => {
    setPreferences((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const RIDER_PREFERENCES = [
    {
      id: 'quietRide',
      title: 'Quiet Ride',
      badge: 'Rest & Focus',
      description: 'Your driver is notified in advance for a peaceful, conversation-free trip.',
      price: 0,
      isFree: true,
    },
    {
      id: 'acCool',
      title: 'Pre-Cooled AC Cabin',
      badge: 'Comfort',
      description: 'Air conditioning set to a cool 21°C before pickup.',
      price: 15,
      isFree: false,
    },
    {
      id: 'luggageSpace',
      title: 'Reserved Boot Space',
      badge: 'Luggage',
      description: 'Guaranteed empty trunk for suitcases, airport luggage, or sports gear.',
      price: 20,
      isFree: false,
    },
    {
      id: 'childSeat',
      title: 'Family Assist & Child Seat',
      badge: 'Family',
      description: 'Equipped with certified ISOFIX anchor safety points.',
      price: 25,
      isFree: false,
    },
  ];

  const totalAddons = RIDER_PREFERENCES.reduce(
    (acc, p) => (preferences[p.id] ? acc + p.price : acc),
    0
  );
  const activeCount = Object.values(preferences).filter(Boolean).length;

  const safetyFeatures = [
    {
      icon: <IconShield size={26} color="#ffffff" />,
      eyebrow: 'PIN Security',
      title: '4-Digit PIN Verification',
      description:
        'Verify your driver before getting in. The driver cannot start the trip until you share your unique PIN.',
      checks: [
        'Mandatory verification before departure',
        'Zero risk of boarding the wrong vehicle',
      ],
    },
    {
      icon: <IconNavigation size={26} color="#ffffff" />,
      eyebrow: 'Live Telemetry',
      title: 'Live Trip Sharing',
      description:
        'Share your real-time location and expected arrival time with trusted contacts with a single tap.',
      checks: [
        'Real-time GPS corridor & speed tracking',
        'Instant 1-tap alerts to loved ones',
      ],
    },
    {
      icon: <IconPhone size={26} color="#ffffff" />,
      eyebrow: '24/7 Response',
      title: '24/7 Safety Helpline',
      description:
        'Access rapid emergency response assistance and trained safety agents straight from the in-ride shield icon.',
      checks: [
        'Dedicated 24/7 rapid response team',
        'Direct integration with emergency services',
      ],
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(32px, 5vw, 64px)' }}>
      {/* 1. Main Interactive Booking Hero */}
      <HeroSection user={user} onLoginClick={onLoginClick} />

      {/* 2. Explore Ride Options: Ride, Reserve, Bike, XL */}
      <ExploreSection />

      {/* 3. Personalized Ride Preferences & Transparent Fares */}
      <section className="rs-section">
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '20px',
            marginBottom: 'clamp(22px, 3vw, 36px)',
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
              Personalized Comfort
            </span>
            <h2
              style={{
                fontSize: 'clamp(26px, 4vw, 36px)',
                fontWeight: 700,
                color: '#ffffff',
                margin: '0 0 10px 0',
                letterSpacing: '-0.025em',
                lineHeight: 1.15,
              }}
            >
              Ride your way, every time
            </h2>
            <p
              style={{
                fontSize: 'clamp(14.5px, 1.8vw, 16px)',
                color: 'rgba(255, 255, 255, 0.72)',
                margin: 0,
                lineHeight: 1.5,
              }}
            >
              Customize your cabin preferences upfront so every ride feels tailored to your day.
            </p>
          </div>

          {/* Live Preference Pill */}
          <LiquidGlassPanel
            pill={true}
            frosted={true}
            style={{
              padding: '10px clamp(16px, 2.5vw, 22px)',
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              background: 'rgba(255, 255, 255, 0.06)',
            }}
          >
            <div>
              <div
                style={{
                  fontSize: '11px',
                  color: 'rgba(255, 255, 255, 0.6)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}
              >
                Cabin Add-Ons
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: '8px',
                  fontSize: 'clamp(18px, 2.5vw, 22px)',
                  fontWeight: 700,
                  color: '#ffffff',
                  letterSpacing: '-0.02em',
                }}
              >
                <span>{totalAddons > 0 ? `+₹${totalAddons}` : '₹0'}</span>
                <span style={{ fontSize: '12px', fontWeight: 500, color: 'rgba(255, 255, 255, 0.65)' }}>
                  ({activeCount} selected · ₹0 surge)
                </span>
              </div>
            </div>
          </LiquidGlassPanel>
        </div>

        <div className="rs-cards-single-row">
          {RIDER_PREFERENCES.map((pref) => {
            const isSelected = preferences[pref.id];
            return (
              <div
                key={pref.id}
                onClick={() => togglePref(pref.id)}
                style={{
                  cursor: 'pointer',
                  userSelect: 'none',
                  minWidth: 0,
                  height: '100%',
                }}
              >
                <LiquidGlassPanel
                  radius={26}
                  frosted={true}
                  interactive={true}
                  style={{
                    padding: '30px 28px',
                    minHeight: '280px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    boxSizing: 'border-box',
                    background: isSelected
                      ? 'rgba(79, 70, 229, 0.28)'
                      : 'rgba(16, 16, 26, 0.72)',
                    backdropFilter: 'blur(24px)',
                    WebkitBackdropFilter: 'blur(24px)',
                    transition: 'background 0.2s ease, transform 0.2s ease',
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
                          letterSpacing: '0.08em',
                          textTransform: 'uppercase',
                          padding: '5px 12px',
                          borderRadius: '9999px',
                          background: isSelected
                            ? 'rgba(99, 102, 241, 0.35)'
                            : 'rgba(255, 255, 255, 0.08)',
                          color: isSelected ? '#ffffff' : 'rgba(255, 255, 255, 0.75)',
                        }}
                      >
                        {pref.badge}
                      </span>
                      <div
                        style={{
                          width: '26px',
                          height: '26px',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: isSelected ? '#6366f1' : 'rgba(255, 255, 255, 0.08)',
                          color: '#ffffff',
                          transition: 'background 0.2s ease',
                        }}
                      >
                        {isSelected && <IconCheck size={14} color="#ffffff" />}
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
                      {pref.title}
                    </h3>
                    <p
                      style={{
                        fontSize: '14px',
                        lineHeight: 1.55,
                        color: 'rgba(255, 255, 255, 0.7)',
                        margin: 0,
                      }}
                    >
                      {pref.description}
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
                    <span style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.65)' }}>
                      {pref.isFree
                        ? isSelected ? 'Enabled' : 'Click to enable'
                        : isSelected ? 'Added to ride' : 'Click to add'}
                    </span>
                    <span style={{ fontSize: '15px', fontWeight: 700, color: '#ffffff' }}>
                      {pref.isFree ? 'Included' : `+₹${pref.price}`}
                    </span>
                  </div>
                </LiquidGlassPanel>
              </div>
            );
          })}
        </div>
      </section>

      {/* 4. Safety Standards Built for Every Trip */}
      <section className="rs-section">
        <div style={{ marginBottom: 'clamp(22px, 3vw, 36px)', maxWidth: '720px' }}>
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
            Peace of Mind
          </span>
          <h2
            style={{
              fontSize: 'clamp(26px, 4vw, 36px)',
              fontWeight: 700,
              color: '#ffffff',
              margin: '0 0 10px 0',
              letterSpacing: '-0.025em',
              lineHeight: 1.15,
            }}
          >
            Your safety is built into every step
          </h2>
          <p
            style={{
              fontSize: 'clamp(14.5px, 1.8vw, 16px)',
              color: 'rgba(255, 255, 255, 0.72)',
              margin: 0,
              lineHeight: 1.5,
            }}
          >
            From verification before boarding to 24/7 trip tracking, we ensure you always arrive safely.
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))',
            gap: 'clamp(18px, 2.5vw, 28px)',
          }}
        >
          {safetyFeatures.map((item, idx) => (
            <LiquidGlassPanel
              key={idx}
              radius={28}
              frosted={true}
              interactive={true}
              style={{
                padding: '34px 30px',
                minHeight: '340px',
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
                    {item.icon}
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
                    {item.eyebrow}
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
                  {item.title}
                </h3>

                <p
                  style={{
                    fontSize: '14.5px',
                    lineHeight: 1.6,
                    color: 'rgba(255, 255, 255, 0.72)',
                    margin: '0 0 24px 0',
                  }}
                >
                  {item.description}
                </p>
              </div>

              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.04)',
                  borderRadius: '16px',
                  padding: '14px 18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                {item.checks.map((check, cIdx) => (
                  <div
                    key={cIdx}
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
                    <span>{check}</span>
                  </div>
                ))}
              </div>
            </LiquidGlassPanel>
          ))}
        </div>
      </section>

      {/* 5. Download the Rider App */}
      <AppsSection />
    </div>
  );
};

export default RidePage;

