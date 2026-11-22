import React from 'react';

export const FlutedGlassPane = ({ children, className = '', style = {} }) => {
  const glassStyle = {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: '16px',
    padding: '24px',
    border: '1px solid rgba(255, 255, 255, 0.25)',
    boxShadow: `
      0 8px 32px 0 rgba(0, 0, 0, 0.15),
      inset 0 0 12px rgba(255, 255, 255, 0.2)
    `,
    // Step 1: Establish the foundational frosted blur
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    ...style,
  };

  const fluteOverlayStyle = {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'none',
    zIndex: 1,
    opacity: 0.45, // Refraction/ridge intensity
    // Step 2: Cylindrical flute gradient repeating every 14px
    background: `
      repeating-linear-gradient(
        90deg,
        rgba(255, 255, 255, 0) 0px,
        rgba(0, 0, 0, 0.03) 3px,
        rgba(0, 0, 0, 0.08) 5px,
        rgba(255, 255, 255, 0.35) 7px,
        rgba(255, 255, 255, 0.1) 9px,
        rgba(0, 0, 0, 0.03) 12px,
        rgba(255, 255, 255, 0) 14px
      )
    `,
    // Step 3: Mix-blend-mode multiplies shadows and overlays highlights naturally
    mixBlendMode: 'overlay',
  };

  const glowStyle = {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'none',
    zIndex: 2,
    boxShadow: 'inset 0 1px 1px rgba(255, 255, 255, 0.15), inset 0 -1px 1px rgba(0, 0, 0, 0.3)',
  };

  return (
    <div style={glassStyle} className={`fluted-glass-pane ${className}`}>
      {/* Visual FX Layers */}
      <div style={fluteOverlayStyle} aria-hidden="true" />
      <div style={glowStyle} aria-hidden="true" />
      
      {/* Content Layer */}
      <div style={{ position: 'relative', zIndex: 3 }}>
        {children}
      </div>
    </div>
  );
};

export default FlutedGlassPane;
