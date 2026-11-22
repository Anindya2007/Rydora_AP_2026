import React, { useState, useEffect, useRef } from 'react';
import { IconMapPin, IconClock, IconChevronDown, IconNavigation } from './Icons';
import { LiquidGlassPanel } from './ui/LiquidGlassPanel';
import { LiquidGlassButton } from './ui/LiquidGlassButton';
import { GoogleMapView } from './GoogleMapView';

const TypewriterHeadline = React.memo(() => {
  const [displayText, setDisplayText] = useState('');
  const [cursorBlink, setCursorBlink] = useState(true);
  const [showCursor, setShowCursor] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    const typeString = async (startStr, toAppend, speed = 85) => {
      setCursorBlink(false);
      let current = startStr;
      for (const ch of toAppend) {
        if (cancelled) return;
        current += ch;
        setDisplayText(current);
        await sleep(speed);
      }
      setCursorBlink(true);
    };

    const backspaceTo = async (startStr, targetLen, speed = 55) => {
      setCursorBlink(false);
      let current = startStr;
      while (current.length > targetLen) {
        if (cancelled) return;
        current = current.slice(0, -1);
        setDisplayText(current);
        await sleep(speed);
      }
      setCursorBlink(true);
    };

    const runSequence = async () => {
      await sleep(800);
      // 1. Type "Go anywhere" and pause longer
      await typeString('', 'Go anywhere', 85);
      await sleep(2200);
      // 2. Backspace "anywhere" -> leaves "Go "
      await backspaceTo('Go anywhere', 3, 55);
      await sleep(500);
      // 3. Type "safe" -> "Go safe" and pause longer
      await typeString('Go ', 'safe', 95);
      await sleep(2200);
      // 4. Backspace "safe" -> leaves "Go "
      await backspaceTo('Go safe', 3, 60);
      await sleep(500);
      // 5. Type "RideShare" -> final "Go RideShare"
      await typeString('Go ', 'RideShare', 90);
      // Blink 3 full cycles (3 x 1000ms = 3000ms), then vanish cursor
      await sleep(3000);
      if (!cancelled) {
        setShowCursor(false);
      }
    };

    runSequence();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <h1
      style={{
        fontSize: 'clamp(28px, 6vw, 54px)',
        fontWeight: 700,
        letterSpacing: '-0.035em',
        margin: '0 0 20px 0',
        color: '#ffffff',
        lineHeight: 1.15,
        minHeight: 'clamp(36px, 7vw, 62px)',
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        textShadow: 'none',
      }}
    >
      <span>{displayText}</span>
      {showCursor && (
        <span
          aria-hidden="true"
          style={{
            display: 'inline-block',
            width: '3px',
            height: 'clamp(34px, 4.5vw, 48px)',
            backgroundColor: '#ffffff',
            marginLeft: '4px',
            borderRadius: '2px',
            animation: cursorBlink ? 'rideshareCursorBlink 1s infinite' : 'none',
            opacity: 1,
          }}
        />
      )}
    </h1>
  );
});

export const HeroSection = ({ user, onLoginClick }) => {
  const [pickup, setPickup] = useState('');
  const [dropoff, setDropoff] = useState('');
  const [pickupMode, setPickupMode] = useState('Pickup now');
  const [isPickupDropdownOpen, setIsPickupDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const canSeePrices = pickup.trim().length > 0 && dropoff.trim().length > 0;

  const handleUseCurrentLocation = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setPickup(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
        },
        () => {
          // Default location fallback in Delhi NCR
          setPickup('Connaught Place, New Delhi');
        }
      );
    } else {
      setPickup('Connaught Place, New Delhi');
    }
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsPickupDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <section className="rs-hero-section">
      <style>{`
        @keyframes rideshareCursorBlink {
          0%, 49% { opacity: 1; }
          50%, 100% { opacity: 0; }
        }
      `}</style>
      {/* Left Column: Ride Search & Booking Form */}
      <div>
        {/* City Indicator */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '14px',
            color: 'rgba(255, 255, 255, 0.9)',
            marginBottom: '16px',
            fontWeight: 500,
          }}
        >
          <IconMapPin size={16} />
          <span>Delhi NCR, IN</span>
          <a
            href="#change-city"
            style={{
              color: 'rgba(255, 255, 255, 0.75)',
              textDecoration: 'none',
              marginLeft: '6px',
              fontSize: '13px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              transition: 'color 0.2s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#ffffff')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255, 255, 255, 0.75)')}
          >
            Change city →
          </a>
        </div>

        {/* Isolated Animated Typewriter Headline */}
        <TypewriterHeadline />

        {/* Pickup Time Pill Selector + Liquid Glass Dropdown */}
        <div ref={dropdownRef} style={{ position: 'relative', marginBottom: '22px', width: 'fit-content', zIndex: 35 }}>
          <LiquidGlassButton
            scale={0.84}
            onClick={() => setIsPickupDropdownOpen((prev) => !prev)}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <IconClock size={16} />
              <span>{pickupMode}</span>
              <span
                style={{
                  display: 'inline-flex',
                  transition: 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                  transform: isPickupDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                }}
              >
                <IconChevronDown size={14} />
              </span>
            </span>
          </LiquidGlassButton>

          {/* Liquid Glass Dropdown Menu */}
          {isPickupDropdownOpen && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 10px)',
                left: 0,
                minWidth: '210px',
                zIndex: 45,
              }}
            >
              <LiquidGlassPanel
                radius={22}
                frosted={true}
                blur={10}
                style={{
                  padding: '6px',
                  background: 'rgba(20, 16, 36, 0.55)',
                  border: 'none',
                  boxShadow: '0 20px 44px -8px rgba(0, 0, 0, 0.65)',
                }}
              >
                {['Pickup now', 'Schedule later'].map((option, idx) => {
                  const isSelected = pickupMode === option;
                  return (
                    <React.Fragment key={option}>
                      {idx > 0 && (
                        <div
                          style={{
                            height: '1px',
                            background: 'rgba(255, 255, 255, 0.08)',
                            margin: '2px 12px',
                          }}
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setPickupMode(option);
                          setIsPickupDropdownOpen(false);
                        }}
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          padding: '14px 18px',
                          background: isSelected ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                          border: 'none',
                          borderRadius: '16px',
                          color: isSelected ? '#ffffff' : 'rgba(255, 255, 255, 0.78)',
                          fontSize: '15px',
                          fontWeight: isSelected ? 600 : 500,
                          fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
                          letterSpacing: '-0.02em',
                          cursor: 'pointer',
                          transition: 'background 0.15s ease, color 0.15s ease',
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) {
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                            e.currentTarget.style.color = '#ffffff';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.color = 'rgba(255, 255, 255, 0.78)';
                          }
                        }}
                      >
                        {option}
                      </button>
                    </React.Fragment>
                  );
                })}
              </LiquidGlassPanel>
            </div>
          )}
        </div>

        {/* Connected Pill-Shaped Liquid Glass Inputs Container */}
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: 'clamp(16px, 2.5vw, 24px)' }}>
          {/* Vertical connecting line */}
          <div
            style={{
              position: 'absolute',
              left: '26px',
              top: '26px',
              bottom: '26px',
              width: '2px',
              background: 'rgba(255, 255, 255, 0.25)',
              zIndex: 10,
              pointerEvents: 'none',
            }}
          />

          {/* Pickup Input Pill-Shaped Liquid Glass */}
          <LiquidGlassPanel
            pill={true}
            frosted={true}
            blur={6}
            style={{
              height: '52px',
              display: 'flex',
              alignItems: 'center',
              padding: '0 clamp(14px, 2.5vw, 20px)',
              boxSizing: 'border-box',
              width: '100%',
            }}
          >
            {/* Circle icon */}
            <div
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: '#ffffff',
                boxShadow: '0 0 8px rgba(255, 255, 255, 0.5)',
                marginRight: '14px',
                flexShrink: 0,
                zIndex: 3,
              }}
            />
            <input
              type="text"
              value={pickup}
              onChange={(e) => setPickup(e.target.value)}
              placeholder="Pickup location"
              style={{
                flex: 1,
                minWidth: 0,
                border: 'none',
                background: 'transparent',
                outline: 'none',
                fontSize: '15px',
                fontWeight: 500,
                color: '#ffffff',
                fontFamily: 'inherit',
                letterSpacing: '-0.01em',
              }}
            />
            <button
              type="button"
              onClick={handleUseCurrentLocation}
              title="Use current location"
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'rgba(255, 255, 255, 0.75)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '36px',
                height: '36px',
                padding: '0',
                borderRadius: '50%',
                transition: 'all 0.2s ease',
                flexShrink: 0,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#a78bfa';
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'rgba(255, 255, 255, 0.75)';
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <IconNavigation size={18} />
            </button>
          </LiquidGlassPanel>

          {/* Dropoff Input Pill-Shaped Liquid Glass */}
          <LiquidGlassPanel
            pill={true}
            frosted={true}
            blur={6}
            style={{
              height: '52px',
              display: 'flex',
              alignItems: 'center',
              padding: '0 clamp(14px, 2.5vw, 20px)',
              boxSizing: 'border-box',
              width: '100%',
            }}
          >
            {/* Square icon */}
            <div
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '2px',
                background: 'rgba(255, 255, 255, 0.9)',
                marginRight: '14px',
                flexShrink: 0,
                zIndex: 3,
              }}
            />
            <input
              type="text"
              value={dropoff}
              onChange={(e) => setDropoff(e.target.value)}
              placeholder="Dropoff location"
              style={{
                flex: 1,
                minWidth: 0,
                border: 'none',
                background: 'transparent',
                outline: 'none',
                fontSize: '15px',
                fontWeight: 500,
                color: '#ffffff',
                fontFamily: 'inherit',
                letterSpacing: '-0.01em',
              }}
            />
            {dropoff ? (
              <button
                type="button"
                onClick={() => setDropoff('')}
                title="Clear dropoff location"
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'rgba(255, 255, 255, 0.6)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '36px',
                  height: '36px',
                  padding: '0',
                  borderRadius: '50%',
                  transition: 'all 0.2s ease',
                  flexShrink: 0,
                  fontSize: '14px',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#ffffff';
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'rgba(255, 255, 255, 0.6)';
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                ✕
              </button>
            ) : (
              <div style={{ width: '36px', height: '36px', flexShrink: 0 }} />
            )}
          </LiquidGlassPanel>
        </div>

        {/* Popular Community Routes Quick Preset Chips (Wrap cleanly so nothing gets cut off) */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '8px',
            marginBottom: 'clamp(16px, 2.5vw, 22px)',
          }}
        >
          <span style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.55)', alignSelf: 'center', marginRight: '2px', flexShrink: 0 }}>
            Popular:
          </span>
          {[
            { label: 'IIT Delhi → Cyber Hub', from: 'IIT Delhi, Hauz Khas', to: 'Cyber Hub, Gurugram' },
            { label: 'North Campus → CP', from: 'Delhi University North Campus', to: 'Connaught Place, New Delhi' },
            { label: 'Noida Sec 62 → Indirapuram', from: 'Noida Sector 62', to: 'Indirapuram, Ghaziabad' },
          ].map((preset, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setPickup(preset.from);
                setDropoff(preset.to);
              }}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '9999px',
                padding: '6px 12px',
                fontSize: '12px',
                color: 'rgba(255, 255, 255, 0.85)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                fontFamily: 'inherit',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.25)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)';
              }}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* Action Row - Pure Liquid Glass Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <LiquidGlassButton
            scale={1}
            disabled={!canSeePrices}
            style={{
              background: canSeePrices ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.03)',
              border: 'none',
              padding: '0 24px',
              height: '42px',
            }}
          >
            See prices
          </LiquidGlassButton>

          {!user && (
            <a
              href="#login"
              onClick={(e) => {
                e.preventDefault();
                if (onLoginClick) onLoginClick();
              }}
              style={{
                color: 'rgba(255, 255, 255, 0.8)',
                fontSize: '13.5px',
                fontWeight: 500,
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                transition: 'color 0.2s ease',
                cursor: 'pointer',
                lineHeight: 1.3,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#ffffff')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255, 255, 255, 0.8)')}
            >
              Log in to check your activity →
            </a>
          )}
        </div>
      </div>

      {/* Right Column: Interactive Google Map */}
      <div style={{ position: 'relative', width: '100%' }}>
        <GoogleMapView
          pickup={pickup}
          dropoff={dropoff}
          city="Delhi NCR, India"
        />
      </div>
    </section>
  );
};

export default HeroSection;
