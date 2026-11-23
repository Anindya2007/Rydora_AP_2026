import React, { useState, useRef, useEffect } from 'react';
import { refractive, convexCircle } from '@hashintel/refractive';
import { IconGlobe, IconChevronDown } from './Icons';
import { LiquidGlassButton } from './ui/LiquidGlassButton';
import { LiquidGlassPanel } from './ui/LiquidGlassPanel';

export const Navbar = ({
  user,
  activeTab: controlledActiveTab,
  onSelectTab,
  onSignUpClick,
  onLoginClick,
  onSignOutClick,
  onNavigateHome,
}) => {
  const [internalActiveTab, setInternalActiveTab] = useState('ride');
  const activeTab = controlledActiveTab !== undefined ? controlledActiveTab : internalActiveTab;

  const handleTabChange = (tabId) => {
    if (onSelectTab) {
      onSelectTab(tabId);
    } else {
      setInternalActiveTab(tabId);
    }
  };
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth <= 768 : false
  );
  const [isMobileExpanded, setIsMobileExpanded] = useState(false);
  const [pillStyle, setPillStyle] = useState({ left: 0, width: 0, height: 42, opacity: 0, animate: false });
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const navContainerRef = useRef(null);
  const itemRefs = useRef({});
  const userMenuRef = useRef(null);
  const navbarRef = useRef(null);

  const navItems = [
    { id: 'ride', label: 'Ride' },
    { id: 'drive', label: 'Drive' },
    { id: 'about', label: 'About', hasDropdown: true },
  ];

  const updatePill = (shouldAnimate = false) => {
    const currentEl = itemRefs.current[activeTab];
    if (currentEl && currentEl.offsetWidth > 0) {
      setPillStyle({
        left: currentEl.offsetLeft,
        width: currentEl.offsetWidth,
        height: currentEl.offsetHeight,
        opacity: 1,
        animate: shouldAnimate,
      });
    }
  };

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      if (!mobile) setIsMobileExpanded(false);
      updatePill(false);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    // Timeout to allow DOM layout to settle when expanding on mobile
    const timer = setTimeout(() => {
      updatePill(pillStyle.opacity === 1);
    }, 20);
    return () => clearTimeout(timer);
  }, [activeTab, isMobileExpanded]);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setIsUserMenuOpen(false);
      }
      if (navbarRef.current && !navbarRef.current.contains(e.target)) {
        setIsMobileExpanded(false);
      }
    };
    if (isUserMenuOpen || isMobileExpanded) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('touchstart', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [isUserMenuOpen, isMobileExpanded]);

  const pillRadius = Math.round((pillStyle.height || 42) / 2);

  const renderSlidingNav = (compact = false) => (
    <nav
      ref={navContainerRef}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: compact ? '2px' : '6px',
        overflowX: compact ? 'auto' : 'visible',
        scrollbarWidth: 'none',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      {/* Animated Moving Refractive Liquid Glass Pill Indicator */}
      {pillStyle.width > 0 && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            transform: `translate3d(${pillStyle.left}px, 0, 0)`,
            width: `${pillStyle.width}px`,
            height: `${pillStyle.height}px`,
            opacity: pillStyle.opacity,
            pointerEvents: 'none',
            transition: pillStyle.animate
              ? 'transform 0.32s cubic-bezier(0.16, 1, 0.3, 1), width 0.32s cubic-bezier(0.16, 1, 0.3, 1)'
              : 'none',
            willChange: 'transform, width',
            zIndex: 1,
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              width: '100%',
              height: '100%',
              borderRadius: `${pillRadius}px`,
              border: 'none',
              background: 'rgba(255, 255, 255, 0.12)',
              boxShadow: '0 2px 10px rgba(0, 0, 0, 0.25)',
              boxSizing: 'border-box',
            }}
          />
        </div>
      )}

      {navItems.map((item) => {
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            ref={(el) => (itemRefs.current[item.id] = el)}
            onClick={() => {
              handleTabChange(item.id);
              if (isMobile) setIsMobileExpanded(false);
            }}
            type="button"
            style={{
              position: 'relative',
              zIndex: 2,
              background: 'transparent',
              border: 'none',
              height: compact ? '34px' : '42px',
              padding: compact ? '0 10px' : '0 24px',
              boxSizing: 'border-box',
              color: isActive ? '#ffffff' : 'rgba(255, 255, 255, 0.65)',
              fontWeight: isActive ? 600 : 500,
              fontSize: compact ? '13px' : '15px',
              cursor: 'pointer',
              borderRadius: '9999px',
              transition: 'color 0.2s ease',
              display: 'inline-flex',
              alignItems: 'center',
              gap: compact ? '3px' : '5px',
              userSelect: 'none',
              whiteSpace: 'nowrap',
              letterSpacing: '-0.022em',
              fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              if (!isActive) e.currentTarget.style.color = 'rgba(255, 255, 255, 0.95)';
            }}
            onMouseLeave={(e) => {
              if (!isActive) e.currentTarget.style.color = 'rgba(255, 255, 255, 0.65)';
            }}
          >
            {item.label}
            {item.hasDropdown && <IconChevronDown size={compact ? 11 : 13} />}
          </button>
        );
      })}
    </nav>
  );

  return (
    <div className="rs-navbar-wrapper">
      {/* Single Unified Pill-shaped Floating Liquid Glass Navbar Container (Fixed 52px height) */}
      <div
        ref={navbarRef}
        style={{
          width: '100%',
          height: isMobile ? '52px' : '56px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: isMobile ? '0 10px 0 16px' : '0 12px 0 24px',
          boxSizing: 'border-box',
          background: 'rgba(15, 15, 24, 0.72)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderRadius: '9999px',
          border: 'none',
          outline: 'none',
          boxShadow: '0 8px 24px -6px rgba(0, 0, 0, 0.45)',
        }}
      >
        {/* Left: Brand & Mobile/Desktop Nav */}
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '10px' : '24px', minWidth: 0, flex: 1 }}>
          <button
            type="button"
            onClick={() => {
              if (isMobile) {
                setIsMobileExpanded((prev) => !prev);
              } else if (onNavigateHome) {
                onNavigateHome();
              }
            }}
            title={isMobile ? (isMobileExpanded ? 'Close categories' : 'Tap to show menu') : 'RideShare Home'}
            style={{
              background: 'transparent',
              border: 'none',
              padding: 0,
              fontSize: isMobile ? '17.5px' : '23px',
              fontWeight: 700,
              color: '#ffffff',
              letterSpacing: '-0.035em',
              cursor: 'pointer',
              flexShrink: 0,
              display: 'inline-flex',
              alignItems: 'center',
              fontFamily: 'inherit',
            }}
          >
            RideShare
          </button>

          {/* On Mobile: Default to ONLY active page label (WITHOUT pill); clicking RideShare expands all buttons WITH pill */}
          {isMobile ? (
            isMobileExpanded ? (
              renderSlidingNav(true)
            ) : (
              <button
                type="button"
                onClick={() => setIsMobileExpanded(true)}
                title="Tap to switch category"
                style={{
                  background: 'transparent',
                  border: 'none',
                  padding: '4px 6px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  color: 'rgba(255, 255, 255, 0.75)',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  letterSpacing: '-0.015em',
                  transition: 'color 0.2s ease',
                  flexShrink: 0,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#ffffff')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255, 255, 255, 0.75)')}
              >
                <span>{navItems.find((n) => n.id === activeTab)?.label || 'Ride'}</span>
                <span style={{ display: 'inline-flex', opacity: 0.55 }}>
                  <IconChevronDown size={12} />
                </span>
              </button>
            )
          ) : (
            renderSlidingNav(false)
          )}
        </div>

        {/* Right: Utility Links + User Avatar Initial Only */}
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '8px' : '18px', flexShrink: 0 }}>
          <button
            type="button"
            className="rs-nav-utility-hide-tablet"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'rgba(255, 255, 255, 0.8)',
              fontSize: '15px',
              fontWeight: 500,
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              padding: '6px 8px',
              transition: 'color 0.2s ease',
              fontFamily: 'inherit',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#ffffff')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255, 255, 255, 0.8)')}
          >
            <IconGlobe size={15} /> EN
          </button>

          <a
            href="#help"
            className="rs-nav-utility-hide-tablet"
            style={{
              color: 'rgba(255, 255, 255, 0.8)',
              fontSize: '15px',
              fontWeight: 500,
              textDecoration: 'none',
              padding: '6px 8px',
              transition: 'color 0.2s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#ffffff')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255, 255, 255, 0.8)')}
          >
            Help
          </a>

          {user ? (
            <div ref={userMenuRef} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => setIsUserMenuOpen((prev) => !prev)}
                title={`${user.name || 'Atharv'} (Tap to manage)`}
                style={{
                  width: isMobile ? '34px' : '38px',
                  height: isMobile ? '34px' : '38px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: isMobile ? '13px' : '15px',
                  fontWeight: 700,
                  color: '#ffffff',
                  boxShadow: '0 3px 12px rgba(99, 102, 241, 0.45)',
                  border: '1.5px solid rgba(255, 255, 255, 0.3)',
                  cursor: 'pointer',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                  padding: 0,
                  fontFamily: 'inherit',
                  flexShrink: 0,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.06)')}
                onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
              >
                {user.name ? user.name.charAt(0).toUpperCase() : 'A'}
              </button>

              {/* Sleek User Dropdown Menu */}
              {isUserMenuOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 10px)',
                    right: 0,
                    minWidth: '175px',
                    zIndex: 200,
                  }}
                >
                  <LiquidGlassPanel
                    radius={18}
                    frosted={true}
                    blur={16}
                    style={{
                      padding: '12px 14px',
                      background: 'rgba(15, 15, 25, 0.88)',
                      border: '1px solid rgba(255, 255, 255, 0.16)',
                      boxShadow: '0 16px 40px rgba(0, 0, 0, 0.65)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                    }}
                  >
                    <div style={{ paddingBottom: '8px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff' }}>
                        {user.name || 'Atharv'}
                      </div>
                      <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.55)', marginTop: '2px' }}>
                        {user.email || 'Member'}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        if (onSignOutClick) onSignOutClick();
                      }}
                      style={{
                        background: 'rgba(239, 68, 68, 0.12)',
                        border: '1px solid rgba(239, 68, 68, 0.25)',
                        borderRadius: '9999px',
                        padding: '6px 12px',
                        color: '#f87171',
                        fontSize: '12px',
                        fontWeight: 500,
                        cursor: 'pointer',
                        textAlign: 'center',
                        transition: 'all 0.15s ease',
                        fontFamily: 'inherit',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(239, 68, 68, 0.25)';
                        e.currentTarget.style.color = '#ffffff';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(239, 68, 68, 0.12)';
                        e.currentTarget.style.color = '#f87171';
                      }}
                    >
                      Sign out
                    </button>
                  </LiquidGlassPanel>
                </div>
              )}
            </div>
          ) : (
            <>
              <a
                href="#login"
                onClick={(e) => {
                  e.preventDefault();
                  if (onLoginClick) onLoginClick();
                }}
                style={{
                  color: 'rgba(255, 255, 255, 0.8)',
                  fontSize: isMobile ? '13px' : '15px',
                  fontWeight: 500,
                  textDecoration: 'none',
                  padding: isMobile ? '4px 6px' : '6px 8px',
                  whiteSpace: 'nowrap',
                  transition: 'color 0.2s ease',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#ffffff')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255, 255, 255, 0.8)')}
              >
                Log in
              </a>

              <LiquidGlassButton
                scale={isMobile ? 0.8 : 0.85}
                onClick={onSignUpClick}
                style={{
                  height: isMobile ? '34px' : '42px',
                  padding: isMobile ? '0 14px' : '0 24px',
                  fontSize: isMobile ? '13px' : '15px',
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: 'none',
                  whiteSpace: 'nowrap',
                }}
              >
                Sign up
              </LiquidGlassButton>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Navbar;
