import React from 'react';
import { RefractiveGlass } from './RefractiveGlass';

export const LiquidGlassPanel = ({
  radius = 28,
  pill = false,
  blur = 6,
  frosted = true,
  interactive = false,
  children,
  style = {},
  className = '',
  ...props
}) => {
  return (
    <RefractiveGlass
      pill={pill}
      radius={radius}
      blur={blur}
      glassThickness={60}
      refractiveIndex={1.46}
      className={className}
      style={{
        border: 'none',
        background: frosted ? 'rgba(16, 16, 26, 0.72)' : 'rgba(255, 255, 255, 0.04)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        boxShadow: '0 20px 48px -10px rgba(0, 0, 0, 0.55)',
        color: '#ffffff',
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", sans-serif',
        transition: interactive ? 'transform 0.2s ease, box-shadow 0.2s ease' : undefined,
        ...style,
      }}
      {...props}
    >
      {children}
    </RefractiveGlass>
  );
};

export default LiquidGlassPanel;
