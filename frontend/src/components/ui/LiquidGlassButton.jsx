import React, { useState } from 'react';
import { RefractiveGlass } from './RefractiveGlass';

export const LiquidGlassButton = ({
  scale = 1.0,
  disabled = false,
  children,
  style = {},
  onClick,
  ...props
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isActive, setIsActive] = useState(false);

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', width: 'fit-content' }}>
      <RefractiveGlass
        pill={true}
        blur={4}
        glassThickness={65}
        refractiveIndex={1.46}
        onClick={(e) => {
          if (!disabled && onClick) onClick(e);
        }}
        onMouseEnter={() => {
          if (!disabled) setIsHovered(true);
        }}
        onMouseLeave={() => {
          setIsHovered(false);
          setIsActive(false);
        }}
        onMouseDown={() => {
          if (!disabled) setIsActive(true);
        }}
        onMouseUp={() => setIsActive(false)}
        aria-disabled={disabled}
        style={{
          display: 'inline-flex',
          width: 'fit-content',
          minWidth: 'fit-content',
          alignItems: 'center',
          justifyContent: 'center',
          boxSizing: 'border-box',
          padding: `${Math.round(14 * scale)}px ${Math.round(24 * scale)}px`,
          border: 'none',
          background: disabled
            ? 'rgba(255, 255, 255, 0.03)'
            : isActive
            ? 'rgba(255, 255, 255, 0.12)'
            : isHovered
            ? 'rgba(255, 255, 255, 0.08)'
            : 'rgba(255, 255, 255, 0.04)',
          boxShadow: disabled
            ? `0 ${Math.round(8 * scale)}px ${Math.round(20 * scale)}px -6px rgba(0, 0, 0, 0.3)`
            : isHovered
            ? `0 ${Math.round(16 * scale)}px ${Math.round(36 * scale)}px -6px rgba(0, 0, 0, 0.6)`
            : `0 ${Math.round(12 * scale)}px ${Math.round(30 * scale)}px -6px rgba(0, 0, 0, 0.45)`,
          transform: disabled
            ? 'translateZ(0) scale(1.0)'
            : isActive
            ? 'translateZ(0) scale(0.97)'
            : isHovered
            ? 'translateZ(0) scale(1.02)'
            : 'translateZ(0) scale(1.0)',
          transition: 'transform 0.15s cubic-bezier(0.16, 1, 0.3, 1), background 0.15s ease, opacity 0.2s ease',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.42 : 1,
          userSelect: 'none',
          color: disabled ? 'rgba(255, 255, 255, 0.5)' : '#ffffff',
          fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", sans-serif',
          fontWeight: 600,
          letterSpacing: '-0.022em',
          textShadow: 'none',
          ...style,
        }}
        {...props}
      >
        {children}
      </RefractiveGlass>
    </div>
  );
};

export default LiquidGlassButton;
