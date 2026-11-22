import React from 'react';
import { IconGlobe, IconMapPin } from './Icons';
import { LiquidGlassPanel } from './ui/LiquidGlassPanel';
import { LiquidGlassButton } from './ui/LiquidGlassButton';

export const Footer = ({ onSelectTab }) => {
  const getTabTarget = (text) => {
    const lower = text.toLowerCase();
    if (lower.includes('about') || lower.includes('safety') || lower.includes('sustainability')) return 'about';
    if (lower.includes('business')) return 'business';
    if (lower.includes('drive')) return 'drive';
    if (lower.includes('ride') || lower.includes('reserve')) return 'ride';
    return null;
  };
  const columns = [
    {
      title: 'Company',
      links: ['About us', 'Our offerings', 'Newsroom', 'Investors', 'Blog', 'Careers'],
    },
    {
      title: 'Products',
      links: ['Ride', 'Drive', 'RideShare for Business', 'Reserve', 'Campus Commutes'],
    },
    {
      title: 'Global citizenship',
      links: ['Safety standards', 'Sustainability & Green points', 'Two-way trust'],
    },
    {
      title: 'Travel',
      links: ['Airports', 'Hotels', 'Delhi NCR', 'Bangalore', 'Mumbai', 'All Cities'],
    },
  ];

  return (
    <footer style={{ padding: '0 clamp(12px, 3vw, 32px) clamp(20px, 3vw, 32px) clamp(12px, 3vw, 32px)', boxSizing: 'border-box' }}>
      <LiquidGlassPanel
        radius={32}
        frosted={true}
        style={{
          padding: 'clamp(32px, 5vw, 56px) clamp(20px, 4vw, 48px) clamp(24px, 3.5vw, 36px) clamp(20px, 4vw, 48px)',
          boxSizing: 'border-box',
          width: '100%',
        }}
      >
        {/* Top: Brand & Help Center */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingBottom: '36px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            marginBottom: '44px',
            flexWrap: 'wrap',
            gap: '16px',
          }}
        >
          <a
            href="#ride"
            onClick={(e) => {
              e.preventDefault();
              if (onSelectTab) onSelectTab('ride');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            style={{
              fontSize: '24px',
              fontWeight: 700,
              color: '#ffffff',
              textDecoration: 'none',
              letterSpacing: '-0.03em',
              cursor: 'pointer',
            }}
          >
            RideShare
          </a>

          <a
            href="#help"
            style={{
              color: 'rgba(255, 255, 255, 0.8)',
              fontSize: '15px',
              fontWeight: 500,
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              transition: 'color 0.2s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#ffffff')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255, 255, 255, 0.8)')}
          >
            Visit Help Center →
          </a>
        </div>

        {/* 4 Directory Columns */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 140px), 1fr))',
            gap: 'clamp(24px, 4vw, 36px)',
            marginBottom: '48px',
          }}
        >
          {columns.map((col, idx) => (
            <div key={idx}>
              <h4
                style={{
                  fontSize: '16px',
                  fontWeight: 600,
                  color: '#ffffff',
                  margin: '0 0 16px 0',
                  letterSpacing: '-0.01em',
                }}
              >
                {col.title}
              </h4>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {col.links.map((link, lIdx) => {
                  const targetTab = getTabTarget(link);
                  return (
                    <li key={lIdx}>
                      <a
                        href={targetTab ? `#${targetTab}` : `#${link.toLowerCase().replace(/\s+/g, '-')}`}
                        onClick={(e) => {
                          if (targetTab && onSelectTab) {
                            e.preventDefault();
                            onSelectTab(targetTab);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }
                        }}
                        style={{
                          color: 'rgba(255, 255, 255, 0.65)',
                          fontSize: '14px',
                          textDecoration: 'none',
                          transition: 'color 0.15s ease',
                          cursor: 'pointer',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = '#ffffff')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255, 255, 255, 0.65)')}
                      >
                        {link}
                      </a>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom Utility Row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: '28px',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            flexWrap: 'wrap',
            gap: '20px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <LiquidGlassButton scale={0.76} style={{ padding: '6px 14px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <IconGlobe size={14} /> English
              </span>
            </LiquidGlassButton>

            <LiquidGlassButton scale={0.76} style={{ padding: '6px 14px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <IconMapPin size={14} /> Delhi NCR
              </span>
            </LiquidGlassButton>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.5)' }}>
              © 2026 RideShare Technologies Inc.
            </span>
            <a href="#privacy" style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.6)', textDecoration: 'none' }}>
              Privacy
            </a>
            <a href="#accessibility" style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.6)', textDecoration: 'none' }}>
              Accessibility
            </a>
            <a href="#terms" style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.6)', textDecoration: 'none' }}>
              Terms
            </a>
          </div>
        </div>
      </LiquidGlassPanel>
    </footer>
  );
};

export default Footer;
