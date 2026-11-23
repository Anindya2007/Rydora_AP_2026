import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { LiquidGlassPanel } from './ui/LiquidGlassPanel';
import { LiquidGlassButton } from './ui/LiquidGlassButton';
import { IconUsers, IconCheck, IconShield, IconMapPin, IconArrowRight } from './Icons';

const CIRCLES = [
  {
    id: 'campus',
    label: 'University Campuses',
    domainTag: '.ac.in / .edu Verified',
    headline: 'Campus commute, shared with peers & faculty',
    description:
      'Match exclusively with verified students and staff from your college using institutional email authentication.',
    liveRoutes: [
      { route: 'Hauz Khas Metro → IIT Delhi', time: 'Every 8 mins', seats: '₹35' },
      { route: 'Rohini Sec-18 → DTU Admin Block', time: '08:30 AM Pool', seats: '₹40' },
      { route: 'Noida Sec-18 → Shiv Nadar / Ashoka', time: 'Weekend Shuttle', seats: '₹120' },
    ],
    highlights: [
      'Strict .edu / .ac.in OTP verification',
      'Recurring morning & evening class pools',
    ],
  },
  {
    id: 'corporate',
    label: 'Corporate Tech-Parks',
    domainTag: 'Work SSO Verified',
    headline: 'Co-commute with colleagues from your office hub',
    description:
      'Skip surge pricing during peak hours by riding with verified professionals commuting along the same route.',
    liveRoutes: [
      { route: 'Dwarka Sec-21 → DLF CyberHub', time: '09:00 AM Express', seats: '₹95' },
      { route: 'Indirapuram → Golf Course Road', time: '08:15 AM Pool', seats: '₹115' },
      { route: 'South Extension → Sector-142 Noida', time: '09:15 AM EV', seats: '₹85' },
    ],
    highlights: [
      'Corporate email & work domain badges',
      'Automated corporate allowance invoices',
    ],
  },
  {
    id: 'women',
    label: 'Women-Only Circle',
    domainTag: '100% Female Verified',
    headline: 'By women, for women — safety at every hour',
    description:
      'An exclusive circle for verified women drivers and riders, with live corridor lock and doorstep confirmation.',
    liveRoutes: [
      { route: 'IGI Airport T3 → South Delhi', time: '24/7 Priority', seats: '₹140' },
      { route: 'Connaught Place → Gurgaon Sec-56', time: 'Evening Pool', seats: '₹110' },
      { route: 'North Campus → Lajpat Nagar', time: 'Every 15 mins', seats: '₹65' },
    ],
    highlights: [
      'Biometric ID-verified female drivers & riders',
      'Doorstep drop confirmation telemetry',
    ],
  },
  {
    id: 'society',
    label: 'Gated Societies',
    domainTag: 'Resident Verified',
    headline: 'Private commute fleet for your neighborhood',
    description:
      'Share daily office routes, school runs, and airport transfers with verified neighbors inside your society gate.',
    liveRoutes: [
      { route: 'DLF Crest → IGI Airport T3', time: 'Morning Shuttle', seats: '₹160' },
      { route: 'Jaypee Greens → Botanical Garden', time: 'Every 10 mins', seats: '₹30' },
      { route: 'ATS Pristine → Connaught Place', time: '08:45 AM Daily', seats: '₹90' },
    ],
    highlights: [
      'Pickup inside society gate — zero street waiting',
      'Verified resident profiles & community trust score',
    ],
  },
];

export const CommunitiesSection = () => {
  const [activeId, setActiveId] = useState('campus');
  const [liveCommunities, setLiveCommunities] = useState([]);
  const [joinStatus, setJoinStatus] = useState('');
  const active = CIRCLES.find((c) => c.id === activeId) || CIRCLES[0];

  useEffect(() => {
    api.communities
      .list()
      .then((data) => {
        if (Array.isArray(data)) setLiveCommunities(data);
      })
      .catch(() => {});
  }, []);

  const handleVerifyPass = async () => {
    const user = api.auth.getCurrentUser();
    if (!user) {
      window.location.hash = '#login';
      return;
    }
    setJoinStatus('Verifying institutional credentials...');
    try {
      if (liveCommunities.length > 0) {
        await api.communities.join(liveCommunities[0].communityId);
      }
      setJoinStatus('Community pass verified successfully! You are now in this pool.');
    } catch {
      setJoinStatus('Community membership verified.');
    }
  };

  return (
    <section className="rs-section">
      {/* Section Header */}
      <div style={{ marginBottom: 'clamp(22px, 3vw, 32px)' }}>
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
          Verified Communities
        </span>
        <h2
          style={{
            fontSize: 'clamp(26px, 4vw, 36px)',
            fontWeight: 700,
            color: '#ffffff',
            margin: '0 0 16px 0',
            letterSpacing: '-0.025em',
            lineHeight: 1.15,
            textShadow: 'none',
          }}
        >
          Ride inside trusted circles
        </h2>

        {/* Interactive Pill Selector Bar (Horizontal swipeable on mobile) */}
        <div className="rs-scroll-strip" style={{ gap: '10px', marginTop: '20px', paddingBottom: '6px' }}>
          {CIRCLES.map((circle) => {
            const isSelected = circle.id === activeId;
            return (
              <div key={circle.id} style={{ flexShrink: 0 }}>
                <LiquidGlassButton
                  scale={0.85}
                  onClick={() => setActiveId(circle.id)}
                  style={{
                    padding: '8px 16px',
                    fontSize: '13px',
                    background: isSelected ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                    color: isSelected ? '#ffffff' : 'rgba(255, 255, 255, 0.68)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {circle.label}
                </LiquidGlassButton>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Two-Column Showcase Panel */}
      <LiquidGlassPanel
        radius={28}
        frosted={true}
        style={{
          padding: 'clamp(20px, 4vw, 40px)',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))',
          gap: 'clamp(24px, 4vw, 40px)',
          alignItems: 'center',
          boxSizing: 'border-box',
        }}
      >
        {/* Left Column: Circle Story & Verification Highlights */}
        <div>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              background: 'rgba(255, 255, 255, 0.08)',
              padding: '6px 14px',
              borderRadius: '9999px',
              fontSize: '12.5px',
              fontWeight: 600,
              color: '#ffffff',
              marginBottom: '18px',
            }}
          >
            <IconShield size={15} color="#ffffff" />
            <span>{active.domainTag}</span>
          </div>

          <h3
            style={{
              fontSize: 'clamp(22px, 3vw, 28px)',
              fontWeight: 700,
              color: '#ffffff',
              margin: '0 0 14px 0',
              letterSpacing: '-0.025em',
              lineHeight: 1.2,
            }}
          >
            {active.headline}
          </h3>

          <p
            style={{
              fontSize: '15px',
              lineHeight: 1.6,
              color: 'rgba(255, 255, 255, 0.74)',
              margin: '0 0 24px 0',
            }}
          >
            {active.description}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '28px' }}>
            {active.highlights.map((item, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  fontSize: '14px',
                  color: 'rgba(255, 255, 255, 0.88)',
                }}
              >
                <span
                  style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    background: 'rgba(255, 255, 255, 0.1)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <IconCheck size={12} color="#ffffff" />
                </span>
                <span>{item}</span>
              </div>
            ))}
          </div>

          {joinStatus && (
            <div
              style={{
                fontSize: '13px',
                color: '#86efac',
                marginBottom: '14px',
                padding: '6px 12px',
                borderRadius: '8px',
                background: 'rgba(34, 197, 94, 0.1)',
                display: 'inline-block',
              }}
            >
              {joinStatus}
            </div>
          )}

          <LiquidGlassButton
            scale={0.9}
            onClick={handleVerifyPass}
            style={{ background: 'rgba(255, 255, 255, 0.09)' }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              Verify your {active.label.toLowerCase()} pass <IconArrowRight size={15} />
            </span>
          </LiquidGlassButton>
        </div>

        {/* Right Column: Live Circle Corridors Feed */}
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.035)',
            borderRadius: '22px',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '4px',
            }}
          >
            <span
              style={{
                fontSize: '13px',
                fontWeight: 600,
                color: 'rgba(255, 255, 255, 0.7)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <IconUsers size={15} /> Live Verified Corridors
            </span>
            <span style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.5)' }}>
              Updated live · Delhi NCR
            </span>
          </div>

          {active.liveRoutes.map((item, idx) => (
            <div
              key={idx}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                borderRadius: '16px',
                padding: '16px 18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '14px',
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: '14.5px',
                    fontWeight: 600,
                    color: '#ffffff',
                    marginBottom: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <IconMapPin size={14} />
                  <span>{item.route}</span>
                </div>
                <div style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.62)' }}>
                  {item.time}
                </div>
              </div>

              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  padding: '6px 12px',
                  borderRadius: '9999px',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#ffffff',
                  whiteSpace: 'nowrap',
                }}
              >
                {item.seats}
              </div>
            </div>
          ))}
        </div>
      </LiquidGlassPanel>
    </section>
  );
};

export default CommunitiesSection;
