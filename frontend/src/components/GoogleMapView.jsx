import React, { useState, useMemo } from 'react';
import { LiquidGlassPanel } from './ui/LiquidGlassPanel';
import { LiquidGlassButton } from './ui/LiquidGlassButton';
import { IconMapPin, IconNavigation, IconSparkles } from './Icons';

export const GoogleMapView = ({
  pickup = '',
  dropoff = '',
  city = 'Delhi NCR, India',
  className = '',
  style = {},
  onSelectRoutePreset,
}) => {
  const [mapType, setMapType] = useState('roadmap'); // 'roadmap' | 'satellite'
  const [isExpanded, setIsExpanded] = useState(false);

  // Determine Google Maps query based on pickup & dropoff
  const mapUrl = useMemo(() => {
    const apiKey = import.meta.env?.VITE_GOOGLE_MAPS_API_KEY;

    const trimmedPickup = pickup.trim();
    const trimmedDropoff = dropoff.trim();

    // If both pickup & dropoff are present, render directions route
    if (trimmedPickup && trimmedDropoff) {
      if (apiKey) {
        return `https://www.google.com/maps/embed/v1/directions?key=${apiKey}&origin=${encodeURIComponent(
          trimmedPickup
        )}&destination=${encodeURIComponent(trimmedDropoff)}&mode=driving`;
      }
      return `https://www.google.com/maps?saddr=${encodeURIComponent(
        trimmedPickup
      )}&daddr=${encodeURIComponent(trimmedDropoff)}&t=${mapType === 'satellite' ? 'k' : 'm'}&output=embed`;
    }

    // If only pickup is present, center on pickup
    if (trimmedPickup) {
      if (apiKey) {
        return `https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=${encodeURIComponent(
          trimmedPickup
        )}`;
      }
      return `https://www.google.com/maps?q=${encodeURIComponent(
        trimmedPickup
      )}&z=14&t=${mapType === 'satellite' ? 'k' : 'm'}&output=embed`;
    }

    // Default: Center on the platform's active city
    if (apiKey) {
      return `https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=${encodeURIComponent(
        city
      )}`;
    }
    return `https://www.google.com/maps?q=${encodeURIComponent(
      city
    )}&z=12&t=${mapType === 'satellite' ? 'k' : 'm'}&output=embed`;
  }, [pickup, dropoff, city, mapType]);

  const hasRoute = Boolean(pickup.trim() && dropoff.trim());

  return (
    <div
      className={className}
      style={{
        position: 'relative',
        width: '100%',
        borderRadius: '24px',
        overflow: 'hidden',
        boxShadow: '0 24px 50px -12px rgba(0, 0, 0, 0.7), inset 0 1px 0 rgba(255, 255, 255, 0.12)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        background: '#020105',
        transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        ...(isExpanded
          ? {
              position: 'fixed',
              top: 'max(12px, env(safe-area-inset-top, 12px))',
              left: 'max(12px, env(safe-area-inset-left, 12px))',
              right: 'max(12px, env(safe-area-inset-right, 12px))',
              bottom: 'max(12px, env(safe-area-inset-bottom, 12px))',
              width: 'calc(100% - 24px)',
              height: 'calc(100dvh - 24px)',
              zIndex: 99999,
              boxShadow: '0 32px 80px rgba(0, 0, 0, 0.9)',
            }
          : {
              height: 'clamp(260px, 36vw, 440px)',
            }),
        ...style,
      }}
    >
      {/* Background Ambience / Map Container */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          overflow: 'hidden',
        }}
      >
        <iframe
          title="RideShare Google Maps"
          src={mapUrl}
          loading="lazy"
          allowFullScreen
          referrerPolicy="no-referrer-when-downgrade"
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            display: 'block',
            // Elegant dark-tint filter so default Google Maps blends into our dark violet theme
            filter:
              mapType === 'roadmap'
                ? 'invert(90%) hue-rotate(180deg) contrast(1.15) brightness(0.88)'
                : 'contrast(1.1) brightness(0.85)',
            transform: 'scale(1.02)', // Avoid sub-pixel white seams at edges
            transformOrigin: 'center center',
          }}
        />

        {/* Ambient Dark-Glass Vignette Edge Mask */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            background:
              'radial-gradient(ellipse at center, rgba(2, 1, 5, 0) 55%, rgba(2, 1, 5, 0.5) 85%, rgba(2, 1, 5, 0.85) 100%)',
            boxShadow: 'inset 0 0 40px rgba(2, 1, 5, 0.6)',
          }}
        />
      </div>

      {/* Top Floating Glass Controls Bar */}
      <div
        style={{
          position: 'absolute',
          top: '12px',
          left: '12px',
          right: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          zIndex: 10,
          pointerEvents: 'none',
        }}
      >
        {/* Live Status Badge */}
        <div
          style={{
            pointerEvents: 'auto',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '5px 12px',
            borderRadius: '9999px',
            background: 'rgba(15, 15, 25, 0.65)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.16)',
            boxShadow: '0 6px 20px rgba(0, 0, 0, 0.35)',
            fontSize: '11.5px',
            fontWeight: 600,
            color: '#ffffff',
          }}
        >
          <span
            style={{
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              background: '#34d399',
              boxShadow: '0 0 8px #34d399',
              display: 'inline-block',
              animation: 'rsPulse 2s infinite ease-in-out',
            }}
          />
          <style>{`
            @keyframes rsPulse {
              0%, 100% { opacity: 1; transform: scale(1); }
              50% { opacity: 0.5; transform: scale(1.2); }
            }
          `}</style>
          <span>Maps Live</span>
          {hasRoute && (
            <span
              style={{
                fontSize: '10.5px',
                color: '#a78bfa',
                background: 'rgba(139, 92, 246, 0.2)',
                padding: '1px 6px',
                borderRadius: '9999px',
              }}
            >
              Route
            </span>
          )}
        </div>

        {/* Action Controls: Map Type Toggle & Expand Toggle */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', pointerEvents: 'auto' }}>
          {/* Satellite / Default Toggle */}
          <button
            type="button"
            onClick={() => setMapType((prev) => (prev === 'roadmap' ? 'satellite' : 'roadmap'))}
            style={{
              padding: '5px 10px',
              borderRadius: '9999px',
              background: 'rgba(15, 15, 25, 0.65)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: '1px solid rgba(255, 255, 255, 0.16)',
              boxShadow: '0 6px 20px rgba(0, 0, 0, 0.35)',
              color: '#ffffff',
              fontSize: '11.5px',
              fontWeight: 500,
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(15, 15, 25, 0.65)')}
          >
            {mapType === 'roadmap' ? '🛰️ Sat' : '🗺️ Map'}
          </button>

          {/* Expand / Minimize Toggle */}
          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            title={isExpanded ? 'Minimize map' : 'Expand full view'}
            style={{
              padding: '5px 9px',
              borderRadius: '9999px',
              background: 'rgba(15, 15, 25, 0.65)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: '1px solid rgba(255, 255, 255, 0.16)',
              boxShadow: '0 6px 20px rgba(0, 0, 0, 0.35)',
              color: '#ffffff',
              fontSize: '11.5px',
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(15, 15, 25, 0.65)')}
          >
            {isExpanded ? '✕ Close' : '⤢ Expand'}
          </button>
        </div>
      </div>

      {/* Bottom Floating Glass Route Banner Overlay */}
      <div
        style={{
          position: 'absolute',
          left: 'clamp(12px, 3vw, 24px)',
          right: 'clamp(12px, 3vw, 24px)',
          bottom: 'clamp(12px, 2.5vw, 20px)',
          zIndex: 10,
        }}
      >
        <LiquidGlassPanel
          pill={true}
          frosted={true}
          blur={10}
          style={{
            padding: '8px 10px 8px clamp(14px, 2.5vw, 22px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            background: 'rgba(15, 15, 25, 0.65)',
            border: '1px solid rgba(255, 255, 255, 0.16)',
            boxShadow: '0 12px 32px rgba(0, 0, 0, 0.55)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
            <div
              style={{
                width: '30px',
                height: '30px',
                borderRadius: '50%',
                background: hasRoute
                  ? 'linear-gradient(135deg, #10b981, #059669)'
                  : 'rgba(255, 255, 255, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {hasRoute ? <IconNavigation size={15} color="#ffffff" /> : <IconMapPin size={15} color="#ffffff" />}
            </div>
            <div style={{ overflow: 'hidden' }}>
              <div
                style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#ffffff',
                  whiteSpace: 'nowrap',
                  textOverflow: 'ellipsis',
                  overflow: 'hidden',
                }}
              >
                {hasRoute ? `${pickup} → ${dropoff}` : 'Live Navigation Preview'}
              </div>
              <div
                style={{
                  fontSize: '11px',
                  color: 'rgba(255, 255, 255, 0.65)',
                  whiteSpace: 'nowrap',
                  textOverflow: 'ellipsis',
                  overflow: 'hidden',
                }}
              >
                {hasRoute ? 'Dynamic route loaded on Google Maps' : 'Enter pickup & destination to map route'}
              </div>
            </div>
          </div>

          <LiquidGlassButton
            scale={0.75}
            onClick={() => {
              // Open in official Google Maps web/app in a new tab
              const targetUrl = hasRoute
                ? `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(
                    pickup
                  )}&destination=${encodeURIComponent(dropoff)}`
                : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(city)}`;
              window.open(targetUrl, '_blank', 'noopener,noreferrer');
            }}
            style={{
              height: '36px',
              padding: '0 16px',
              background: 'rgba(255, 255, 255, 0.14)',
              fontSize: '12.5px',
              whiteSpace: 'nowrap',
              gap: '6px',
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <span>Open in Maps</span>
              <span style={{ fontSize: '11px' }}>↗</span>
            </span>
          </LiquidGlassButton>
        </LiquidGlassPanel>
      </div>
    </div>
  );
};

export default GoogleMapView;

