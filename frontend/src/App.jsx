import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Hero } from '@/components/ui/tailwind-css-background-snippet';
import { Navbar } from '@/components/Navbar';
import { RidePage } from '@/components/RidePage';
import { DrivePage } from '@/components/DrivePage';
import { AboutPage } from '@/components/AboutPage';
import { Footer } from '@/components/Footer';
import { SignupPage } from '@/components/SignupPage';
import { LoginPage } from '@/components/LoginPage';

export default function App() {
  const [entranceComplete, setEntranceComplete] = useState(false);
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('rideshare_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [currentView, setCurrentView] = useState(() => {
    if (window.location.hash === '#signup') return 'signup';
    if (window.location.hash === '#login') return 'login';
    return 'home';
  });

  const [activeTab, setActiveTab] = useState(() => {
    const hash = window.location.hash.replace('#', '');
    if (['ride', 'drive', 'about'].includes(hash)) return hash;
    return 'ride';
  });

  const handleLoginSuccess = (userData) => {
    if (!userData) return;
    setUser(userData);
    try {
      localStorage.setItem('rideshare_user', JSON.stringify(userData));
    } catch {}
    window.location.hash = `#${activeTab}`;
    setCurrentView('home');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSignOut = () => {
    setUser(null);
    api.auth.logout();
  };

  useEffect(() => {
    const token = api.auth.getToken();
    if (token) {
      api.auth
        .getMe()
        .then((freshUser) => {
          if (freshUser) setUser(freshUser);
        })
        .catch(() => {
          api.auth.logout();
          setUser(null);
        });
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setEntranceComplete(true);
    }, 1300);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash === 'signup') {
        setCurrentView('signup');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else if (hash === 'login') {
        setCurrentView('login');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        setCurrentView('home');
        if (['ride', 'drive', 'about'].includes(hash)) {
          setActiveTab(hash);
        }
      }
    };
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  const handleSelectTab = (tabId) => {
    setActiveTab(tabId);
    window.location.hash = `#${tabId}`;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navigateToSignup = () => {
    window.location.hash = '#signup';
    setCurrentView('signup');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navigateToLogin = () => {
    window.location.hash = '#login';
    setCurrentView('login');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navigateToHome = () => {
    window.location.hash = `#${activeTab}`;
    setCurrentView('home');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <Hero>
      <style>{`
        @keyframes ridesharePageBlurIn {
          0% {
            filter: blur(24px);
            opacity: 0;
          }
          100% {
            filter: blur(0px);
            opacity: 1;
          }
        }
        @keyframes rideshareBackdropCurtainFade {
          0% {
            backdrop-filter: blur(24px);
            -webkit-backdrop-filter: blur(24px);
            opacity: 1;
          }
          100% {
            backdrop-filter: blur(0px);
            -webkit-backdrop-filter: blur(0px);
            opacity: 0;
          }
        }
      `}</style>

      {/* Full-viewport blur curtain that unblurs continuously and unmounts after completion */}
      {!entranceComplete && (
        <div
          aria-hidden="true"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            pointerEvents: 'none',
            animation: 'rideshareBackdropCurtainFade 1.25s ease-out forwards',
          }}
        />
      )}

      {currentView === 'signup' ? (
        <SignupPage
          onNavigateHome={navigateToHome}
          onNavigateLogin={navigateToLogin}
          onLoginSuccess={handleLoginSuccess}
        />
      ) : currentView === 'login' ? (
        <LoginPage
          onNavigateHome={navigateToHome}
          onNavigateSignup={navigateToSignup}
          onLoginSuccess={handleLoginSuccess}
        />
      ) : (
        <>
          {/* Pinned Top Liquid Glass Navbar */}
          <Navbar
            user={user}
            activeTab={activeTab}
            onSelectTab={handleSelectTab}
            onSignUpClick={navigateToSignup}
            onLoginClick={navigateToLogin}
            onSignOutClick={handleSignOut}
            onNavigateHome={() => handleSelectTab('ride')}
          />

          <div
            onAnimationEnd={(e) => {
              if (e.animationName === 'ridesharePageBlurIn') {
                setEntranceComplete(true);
              }
            }}
            style={{
              minHeight: '100vh',
              display: 'flex',
              flexDirection: 'column',
              animation: entranceComplete
                ? 'none'
                : 'ridesharePageBlurIn 1.25s ease-out forwards',
            }}
          >
            <div className="rs-navbar-spacer" />
            <main
              key={activeTab}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                animation: 'ridesharePageBlurIn 0.35s ease-out forwards',
              }}
            >
              {activeTab === 'ride' && (
                <RidePage
                  user={user}
                  onLoginClick={navigateToLogin}
                  onSignUpClick={navigateToSignup}
                />
              )}
              {activeTab === 'drive' && (
                <DrivePage
                  user={user}
                  onSignUpClick={navigateToSignup}
                  onLoginClick={navigateToLogin}
                />
              )}
              {activeTab === 'about' && (
                <AboutPage onSignUpClick={navigateToSignup} />
              )}
            </main>
            <Footer onSelectTab={handleSelectTab} />
          </div>
        </>
      )}
    </Hero>
  );
}
