import React from 'react';
import FlutedGlassPane from './FlutedGlassPane';

export { FlutedGlassPane };

export const Hero = ({ children, className = '', style = {} }) => {
  return (
    <div
      className={className}
      style={{
        position: 'relative',
        width: '100%',
        minHeight: '100vh',
        backgroundColor: '#020105',
        ...style,
      }}
    >
      <style>{`
        @keyframes rideshareGradientFlowIn {
          0% {
            transform: translateY(75vh);
            opacity: 0;
            filter: brightness(0.1);
          }
          100% {
            transform: translateY(0px);
            opacity: 1;
            filter: brightness(1);
          }
        }
      `}</style>

      {/* Layer 1: Background Radial Mesh - Dramatic Flow-In from Bottom, Negligible on Frame 0 */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          width: '100%',
          height: '100%',
          zIndex: 0,
          pointerEvents: 'none',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            opacity: 0,
            transform: 'translateY(75vh)',
            background: 'radial-gradient(145% 135% at 50% -10%, #020105 42%, #5227cc 100%)',
            animation: 'rideshareGradientFlowIn 2s cubic-bezier(0.16, 1, 0.3, 1) forwards',
            willChange: 'transform, opacity, filter',
          }}
        />
      </div>
      
      {/* Layer 2: Foundational Frosted Blur */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          width: '100%',
          height: '100%',
          zIndex: 0,
          pointerEvents: 'none',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
        }}
      />

      {/* Layer 3: Cylindrical Flute Ridges (repeating every 14px) */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          width: '100%',
          height: '100%',
          zIndex: 0,
          pointerEvents: 'none',
          opacity: 0.45,
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
          mixBlendMode: 'overlay',
        }}
      />

      
      {/* Content Layer */}
      <div style={{ position: 'relative', zIndex: 1, width: '100%' }}>
        {children}
      </div>
    </div>
  );
};

export default Hero;
