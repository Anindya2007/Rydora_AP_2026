import React, { useState } from 'react';
import { LiquidGlassPanel } from './ui/LiquidGlassPanel';
import { LiquidGlassButton } from './ui/LiquidGlassButton';
import {
  IconBriefcase,
  IconShield,
  IconUsers,
  IconClock,
  IconCheck,
  IconSparkles,
  IconArrowRight,
  IconMail,
  IconZap,
} from './Icons';

export const BusinessPage = ({ onSignUpClick }) => {
  const [formData, setFormData] = useState({
    companyName: '',
    workEmail: '',
    teamSize: '50-250',
    city: 'Delhi NCR',
  });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.companyName || !formData.workEmail) return;
    setSubmitted(true);
  };

  const solutions = [
    {
      icon: <IconUsers size={26} color="#ffffff" />,
      title: 'Daily Employee Commute',
      description:
        'Scheduled, reliable pickups and safe late-night drops for shift workers with door-to-door confirmation.',
    },
    {
      icon: <IconSparkles size={26} color="#ffffff" />,
      title: 'Executive & Client Travel',
      description:
        'High-rated Premier sedans for visiting clients, VIP guests, board members, and off-site meetings.',
    },
    {
      icon: <IconClock size={26} color="#ffffff" />,
      title: 'Airport & Event Transfers',
      description:
        'Coordinated group transit with flight tracking and pre-scheduled driver arrivals for large corporate events.',
    },
    {
      icon: <IconZap size={26} color="#ffffff" />,
      title: 'Digital Ride Vouchers',
      description:
        'Distribute branded trip credits directly to employees, customers, or job candidates with custom budgets.',
    },
  ];

  const adminFeatures = [
    {
      title: 'Consolidated Monthly Billing',
      desc: 'One monthly GST-compliant invoice for your entire company. No more collecting and reimbursing paper receipts.',
    },
    {
      title: 'Custom Travel Policies',
      desc: 'Define spending limits, allowable hours, and office geofencing rules so team members stay within policy automatically.',
    },
    {
      title: 'Real-Time Analytics & ESG',
      desc: 'Monitor travel spend by department, optimize popular transit routes, and measure verified EV carbon savings.',
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
      {/* 1. Business Hero Section */}
      <section className="rs-section">
        <LiquidGlassPanel
          radius={32}
          frosted={true}
          style={{
            padding: 'clamp(32px, 5vw, 64px)',
            boxSizing: 'border-box',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div style={{ maxWidth: '780px' }}>
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
              RideShare for Business
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
              Smart corporate travel, <br />
              <span
                style={{
                  background: 'linear-gradient(135deg, #60a5fa, #a78bfa)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                managed in one dashboard.
              </span>
            </h1>

            <p
              style={{
                fontSize: 'clamp(15px, 2vw, 18px)',
                color: 'rgba(255, 255, 255, 0.75)',
                margin: '0 0 36px 0',
                lineHeight: 1.55,
                maxWidth: '620px',
              }}
            >
              Streamline employee commutes, eliminate tedious expense reimbursements, and ensure
              duty-of-care safety with enterprise-grade controls.
            </p>

            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
              <LiquidGlassButton
                variant="primary"
                scale={1}
                onClick={onSignUpClick}
                style={{ padding: '14px 28px', fontSize: '15px' }}
              >
                Create business account
              </LiquidGlassButton>

              <a
                href="#demo-request"
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
                Request a demo ↓
              </a>
            </div>
          </div>
        </LiquidGlassPanel>
      </section>

      {/* 2. Key Business Solutions */}
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
            Tailored Solutions
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
            How businesses move with RideShare
          </h2>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))',
            gap: 'clamp(16px, 2.5vw, 24px)',
          }}
        >
          {solutions.map((item, idx) => (
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

      {/* 3. Enterprise Admin Dashboard Controls */}
      <section className="rs-section">
        <LiquidGlassPanel
          radius={28}
          frosted={true}
          style={{
            padding: 'clamp(28px, 4vw, 48px)',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ marginBottom: '32px', maxWidth: '640px' }}>
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
              Enterprise Admin Hub
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
              Complete financial visibility and control
            </h2>
            <p
              style={{
                fontSize: '15px',
                color: 'rgba(255, 255, 255, 0.7)',
                margin: 0,
                lineHeight: 1.5,
              }}
            >
              Designed for HR managers, travel coordinators, and CFOs who need complete oversight
              without manual administrative overhead.
            </p>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))',
              gap: '20px',
            }}
          >
            {adminFeatures.map((feat, idx) => (
              <div
                key={idx}
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  borderRadius: '20px',
                  padding: '24px',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                }}
              >
                <div
                  style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    background: '#60a5fa',
                    marginBottom: '14px',
                  }}
                />
                <h3
                  style={{
                    fontSize: '17px',
                    fontWeight: 600,
                    color: '#ffffff',
                    margin: '0 0 8px 0',
                  }}
                >
                  {feat.title}
                </h3>
                <p
                  style={{
                    fontSize: '14px',
                    color: 'rgba(255, 255, 255, 0.65)',
                    margin: 0,
                    lineHeight: 1.5,
                  }}
                >
                  {feat.desc}
                </p>
              </div>
            ))}
          </div>
        </LiquidGlassPanel>
      </section>

      {/* 4. Enterprise Consultation / Demo Request Form */}
      <section id="demo-request" className="rs-section">
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
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))',
              gap: 'clamp(24px, 4vw, 48px)',
              alignItems: 'center',
            }}
          >
            {/* Left Column: Context */}
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
                Enterprise Advisory
              </span>
              <h2
                style={{
                  fontSize: 'clamp(26px, 3.5vw, 36px)',
                  fontWeight: 700,
                  color: '#ffffff',
                  margin: '0 0 12px 0',
                  letterSpacing: '-0.025em',
                }}
              >
                Ready to transform your company travel?
              </h2>
              <p
                style={{
                  fontSize: '15px',
                  color: 'rgba(255, 255, 255, 0.7)',
                  margin: '0 0 24px 0',
                  lineHeight: 1.55,
                }}
              >
                Talk to our enterprise mobility experts to configure custom corporate billing,
                employee commute fleets, and volume discounts.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <IconCheck size={16} color="#60a5fa" />
                  <span style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.8)' }}>
                    Dedicated enterprise account manager
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <IconCheck size={16} color="#60a5fa" />
                  <span style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.8)' }}>
                    99.8% on-time fulfillment rate & priority support
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <IconCheck size={16} color="#60a5fa" />
                  <span style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.8)' }}>
                    Zero setup charges or long-term lock-in
                  </span>
                </div>
              </div>
            </div>

            {/* Right Column: Interactive Form */}
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                borderRadius: '24px',
                padding: 'clamp(24px, 3.5vw, 36px)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
              }}
            >
              {submitted ? (
                <div style={{ textAlign: 'center', padding: '24px 12px' }}>
                  <div
                    style={{
                      width: '56px',
                      height: '56px',
                      borderRadius: '50%',
                      background: 'rgba(96, 165, 250, 0.15)',
                      color: '#60a5fa',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 16px auto',
                    }}
                  >
                    <IconCheck size={28} color="#60a5fa" />
                  </div>
                  <h3
                    style={{
                      fontSize: '20px',
                      fontWeight: 700,
                      color: '#ffffff',
                      margin: '0 0 8px 0',
                    }}
                  >
                    Request received!
                  </h3>
                  <p
                    style={{
                      fontSize: '14px',
                      color: 'rgba(255, 255, 255, 0.7)',
                      margin: '0 0 20px 0',
                      lineHeight: 1.5,
                    }}
                  >
                    A RideShare enterprise specialist will contact{' '}
                    <strong style={{ color: '#ffffff' }}>{formData.workEmail}</strong> within 1
                    business day.
                  </p>
                  <LiquidGlassButton
                    scale={0.9}
                    onClick={() => {
                      setSubmitted(false);
                      setFormData({ companyName: '', workEmail: '', teamSize: '50-250', city: 'Delhi NCR' });
                    }}
                  >
                    Submit another response
                  </LiquidGlassButton>
                </div>
              ) : (
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '13px',
                        fontWeight: 500,
                        color: 'rgba(255, 255, 255, 0.75)',
                        marginBottom: '6px',
                      }}
                    >
                      Company Name
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Acme Technologies"
                      value={formData.companyName}
                      onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                      style={{
                        width: '100%',
                        height: '46px',
                        borderRadius: '12px',
                        background: 'rgba(255, 255, 255, 0.06)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        padding: '0 14px',
                        color: '#ffffff',
                        fontSize: '14px',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '13px',
                        fontWeight: 500,
                        color: 'rgba(255, 255, 255, 0.75)',
                        marginBottom: '6px',
                      }}
                    >
                      Work Email
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="alex@acmecorp.com"
                      value={formData.workEmail}
                      onChange={(e) => setFormData({ ...formData, workEmail: e.target.value })}
                      style={{
                        width: '100%',
                        height: '46px',
                        borderRadius: '12px',
                        background: 'rgba(255, 255, 255, 0.06)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        padding: '0 14px',
                        color: '#ffffff',
                        fontSize: '14px',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label
                        style={{
                          display: 'block',
                          fontSize: '13px',
                          fontWeight: 500,
                          color: 'rgba(255, 255, 255, 0.75)',
                          marginBottom: '6px',
                        }}
                      >
                        Team Size
                      </label>
                      <select
                        value={formData.teamSize}
                        onChange={(e) => setFormData({ ...formData, teamSize: e.target.value })}
                        style={{
                          width: '100%',
                          height: '46px',
                          borderRadius: '12px',
                          background: '#161622',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          padding: '0 12px',
                          color: '#ffffff',
                          fontSize: '14px',
                          outline: 'none',
                          boxSizing: 'border-box',
                        }}
                      >
                        <option value="10-50">10 - 50</option>
                        <option value="50-250">50 - 250</option>
                        <option value="250-1000">250 - 1,000</option>
                        <option value="1000+">1,000+</option>
                      </select>
                    </div>

                    <div>
                      <label
                        style={{
                          display: 'block',
                          fontSize: '13px',
                          fontWeight: 500,
                          color: 'rgba(255, 255, 255, 0.75)',
                          marginBottom: '6px',
                        }}
                      >
                        Primary City
                      </label>
                      <select
                        value={formData.city}
                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                        style={{
                          width: '100%',
                          height: '46px',
                          borderRadius: '12px',
                          background: '#161622',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          padding: '0 12px',
                          color: '#ffffff',
                          fontSize: '14px',
                          outline: 'none',
                          boxSizing: 'border-box',
                        }}
                      >
                        <option value="Delhi NCR">Delhi NCR</option>
                        <option value="Bengaluru">Bengaluru</option>
                        <option value="Mumbai">Mumbai</option>
                        <option value="Hyderabad">Hyderabad</option>
                        <option value="Pune">Pune</option>
                      </select>
                    </div>
                  </div>

                  <LiquidGlassButton
                    type="submit"
                    variant="primary"
                    scale={1}
                    style={{ width: '100%', marginTop: '6px' }}
                  >
                    Schedule Consultation →
                  </LiquidGlassButton>
                </form>
              )}
            </div>
          </div>
        </LiquidGlassPanel>
      </section>
    </div>
  );
};

export default BusinessPage;

