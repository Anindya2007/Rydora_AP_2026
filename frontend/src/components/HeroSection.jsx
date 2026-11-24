import React, { useState, useEffect, useRef } from 'react';
import { api } from '../lib/api';
import {
  IconMapPin,
  IconClock,
  IconChevronDown,
  IconNavigation,
  IconShield,
  IconCheck,
  IconSparkles,
  IconCar,
} from './Icons';
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

export const HeroSection = ({ user, onLoginClick, onSelectTab }) => {
  const [pickup, setPickup] = useState('');
  const [dropoff, setDropoff] = useState('');
  const [pickupMode, setPickupMode] = useState('Pickup now');
  const [isPickupDropdownOpen, setIsPickupDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Search & Booking Integration State
  const [rides, setRides] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchMessage, setSearchMessage] = useState('');
  const [myBookings, setMyBookings] = useState([]);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingTab, setBookingTab] = useState('active'); // 'active' | 'past'
  const [ratedBookings, setRatedBookings] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('rydora_rated_bookings') || '{}');
    } catch {
      return {};
    }
  });
  const [ratingBookingId, setRatingBookingId] = useState(null);
  const [ratingScore, setRatingScore] = useState(5);
  const [ratingComment, setRatingComment] = useState('');
  const [ratingStatusMsg, setRatingStatusMsg] = useState('');
  const [activeSOS, setActiveSOS] = useState(null);
  const [sosLoading, setSosLoading] = useState(false);
  const [sosStatusMsg, setSosStatusMsg] = useState('');
  const [guardianAlerts, setGuardianAlerts] = useState([]);

  // Community Filter State
  const [communities, setCommunities] = useState([]);
  const [selectedCommunityId, setSelectedCommunityId] = useState('');

  // Refund & Emergency Contacts State
  const [refundLoadingId, setRefundLoadingId] = useState(null);
  const [refundStatusMsg, setRefundStatusMsg] = useState('');
  const [emergencyContacts, setEmergencyContacts] = useState([]);
  const [showContactsPanel, setShowContactsPanel] = useState(false);
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactRelationship, setContactRelationship] = useState('Family');
  const [contactLoading, setContactLoading] = useState(false);
  const [contactMsg, setContactMsg] = useState('');

  const canSeePrices = pickup.trim().length > 0 && dropoff.trim().length > 0;

  const handleUseCurrentLocation = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setPickup(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
        },
        () => {
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

  useEffect(() => {
    // Load active communities for community-based carpool filtering
    api.communities
      .list()
      .then((data) => {
        const list = Array.isArray(data) ? data : (data?.items || []);
        setCommunities(list);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (user) {
      api.bookings
        .getMyBookings()
        .then((res) => {
          if (Array.isArray(res)) setMyBookings(res);
        })
        .catch(() => {});

      api.safety
        .getEmergencyContacts()
        .then((res) => {
          const list = Array.isArray(res) ? res : (res?.contacts || []);
          setEmergencyContacts(list);
        })
        .catch(() => {});

      const pollAlerts = () => {
        api.safety
          .getActiveSOS()
          .then((alert) => {
            setActiveSOS(alert || null);
          })
          .catch(() => {});

        api.safety
          .getGuardianAlerts()
          .then((res) => {
            const list = Array.isArray(res) ? res : (res?.alerts || []);
            setGuardianAlerts(list);
          })
          .catch(() => {});
      };

      pollAlerts();
      const interval = setInterval(pollAlerts, 5000);
      return () => clearInterval(interval);
    } else {
      setMyBookings([]);
      setActiveSOS(null);
      setGuardianAlerts([]);
      setEmergencyContacts([]);
    }
  }, [user]);

  const handleSearch = async () => {
    if (!canSeePrices || isSearching) return;
    setIsSearching(true);
    setSearchMessage('');
    const pTrim = pickup.trim().toLowerCase();
    const dTrim = dropoff.trim().toLowerCase();

    // Known Delhi NCR coordinates map for instant accurate corridor calculations
    const KNOWN_COORDS = {
      'delhi university north campus': { lat: 28.6894, lng: 77.2104 },
      'north campus': { lat: 28.6894, lng: 77.2104 },
      'connaught place, new delhi': { lat: 28.6304, lng: 77.2177 },
      'connaught place': { lat: 28.6304, lng: 77.2177 },
      'cp': { lat: 28.6304, lng: 77.2177 },
      'iit delhi, hauz khas': { lat: 28.545, lng: 77.1926 },
      'iit delhi': { lat: 28.545, lng: 77.1926 },
      'cyber hub, gurugram': { lat: 28.4986, lng: 77.0878 },
      'cyber hub': { lat: 28.4986, lng: 77.0878 },
      'noida sector 62': { lat: 28.628, lng: 77.3649 },
      'noida sec 62': { lat: 28.628, lng: 77.3649 },
      'indirapuram, ghaziabad': { lat: 28.6415, lng: 77.3714 },
      'indirapuram': { lat: 28.6415, lng: 77.3714 },
      'aiims delhi': { lat: 28.5672, lng: 77.21 },
      'akshardham': { lat: 28.6127, lng: 77.2773 },
    };

    const pCoords = Object.entries(KNOWN_COORDS).find(([k]) => pTrim.includes(k))?.[1];
    const dCoords = Object.entries(KNOWN_COORDS).find(([k]) => dTrim.includes(k))?.[1];

    try {
      const searchParams = {
        source: pickup.trim(),
        destination: dropoff.trim(),
      };

      if (pCoords && dCoords) {
        searchParams.pickupLat = pCoords.lat;
        searchParams.pickupLng = pCoords.lng;
        searchParams.dropoffLat = dCoords.lat;
        searchParams.dropoffLng = dCoords.lng;
      }

      const results = await api.rides.search(searchParams);
      let list = Array.isArray(results) ? results : (results?.rides || []);
      if (selectedCommunityId && list.length > 0) {
        list = [...list].sort((a, b) => {
          const aMatch =
            a.communityId === selectedCommunityId ||
            a.community?.communityId === selectedCommunityId
              ? 1
              : 0;
          const bMatch =
            b.communityId === selectedCommunityId ||
            b.community?.communityId === selectedCommunityId
              ? 1
              : 0;
          return bMatch - aMatch;
        });
      }
      setRides(list);
      setHasSearched(true);
      if (!list || list.length === 0) {
        setSearchMessage('No scheduled rides found for this exact route yet. Check popular corridors or schedule later.');
      }
    } catch {
      setSearchMessage('Ride search service temporary notice: check popular preset corridors below.');
      setRides([]);
      setHasSearched(true);
    } finally {
      setIsSearching(false);
    }
  };

  const handleBook = async (ride) => {
    if (!user) {
      if (onLoginClick) onLoginClick();
      return;
    }
    setBookingLoading(true);
    try {
      const rideId = typeof ride === 'string' ? ride : ride.rideId;
      const bookingOptions = {};

      if (typeof ride === 'object' && ride.routePricing?.riderSubTripDistanceKm) {
        bookingOptions.subTripDistanceKm = ride.routePricing.riderSubTripDistanceKm;
        bookingOptions.passengerPickup = pickup.trim();
        bookingOptions.passengerDropoff = dropoff.trim();
      }

      const newBooking = await api.bookings.create(rideId, 1, bookingOptions);
      try {
        await api.bookings.pay(newBooking.bookingId, newBooking.totalAmount, 'UPI');
      } catch {}
      const updated = await api.bookings.getMyBookings();
      setMyBookings(Array.isArray(updated) ? updated : []);
      alert('Ride booked successfully!');
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Booking could not be created. Please try again.');
    } finally {
      setBookingLoading(false);
    }
  };

  const handleCancelBooking = async (bookingId) => {
    if (!confirm('Are you sure you want to cancel this ride booking? Your reserved seats will be restored.')) return;
    try {
      await api.bookings.cancel(bookingId, 'Passenger requested cancellation');
      const updated = await api.bookings.getMyBookings();
      setMyBookings(Array.isArray(updated) ? updated : []);
      // Refresh available rides so restored seat count appears immediately
      if (hasSearched) {
        handleSearch();
      }
      alert('Booking cancelled successfully.');
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Cancellation failed.');
    }
  };

  const handleSubmitRating = async (bookingId, driverName = 'Driver') => {
    try {
      await api.ratings.submit(bookingId, ratingScore, ratingComment);
      const newRated = {
        ...ratedBookings,
        [bookingId]: { score: ratingScore, comment: ratingComment, ratedAt: new Date().toISOString() },
      };
      setRatedBookings(newRated);
      try {
        localStorage.setItem('rydora_rated_bookings', JSON.stringify(newRated));
      } catch {}
      setRatingStatusMsg(`✓ Rating of ${ratingScore} ★ submitted successfully!`);
      alert(`⭐ Thank you! Your rating of ${ratingScore} ★ for ${driverName} was submitted successfully.`);
      setRatingBookingId(null);
      setRatingComment('');
      const updated = await api.bookings.getMyBookings();
      setMyBookings(Array.isArray(updated) ? updated : []);
    } catch (err) {
      const errMsg = err.response?.data?.error?.message || 'Failed to submit rating.';
      setRatingStatusMsg(errMsg);
      alert(errMsg);
    }
  };

  const handleTriggerSOS = async () => {
    if (!confirm('Activate SOS Emergency alert? Your registered emergency contacts will be notified.')) return;
    setSosLoading(true);
    try {
      const alertData = await api.safety.triggerSOS({
        message: 'Emergency SOS activated from Rydora web portal',
        latitude: 28.6139,
        longitude: 77.209,
      });
      setActiveSOS(alertData);
      setSosStatusMsg('SOS Emergency Alert is active!');
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Could not activate SOS.');
    } finally {
      setSosLoading(false);
    }
  };

  const handleResolveSOS = async (alertId) => {
    try {
      await api.safety.resolveSOS(alertId, 'Resolved safely by guardian or passenger');
      setActiveSOS(null);
      setGuardianAlerts((prev) => prev.filter((g) => (g.alert?.alertId || g.alertId) !== alertId));
      setSosStatusMsg('SOS Alert resolved.');
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Could not resolve SOS alert.');
    }
  };

  const handleRequestRefund = async (bookingId) => {
    setRefundLoadingId(bookingId);
    setRefundStatusMsg('');
    try {
      await api.bookings.requestRefund(bookingId, 'Passenger requested refund on cancelled booking');
      setRefundStatusMsg('Refund request sent to driver for review & approval.');
      const updated = await api.bookings.getMyBookings();
      setMyBookings(Array.isArray(updated) ? updated : []);
    } catch (err) {
      setRefundStatusMsg(err.response?.data?.error?.message || 'Refund request could not be processed.');
    } finally {
      setRefundLoadingId(null);
    }
  };

  const handleAddEmergencyContact = async (e) => {
    e.preventDefault();
    if (!contactName.trim() || !contactPhone.trim()) return;
    setContactLoading(true);
    setContactMsg('');
    try {
      await api.safety.addEmergencyContact({
        name: contactName.trim(),
        phone: contactPhone.trim(),
        relationship: contactRelationship.trim() || 'Family',
      });
      setContactMsg('Emergency contact added successfully!');
      setContactName('');
      setContactPhone('');
      const res = await api.safety.getEmergencyContacts();
      setEmergencyContacts(Array.isArray(res) ? res : (res?.contacts || []));
    } catch (err) {
      setContactMsg(err.response?.data?.error?.message || 'Could not add emergency contact.');
    } finally {
      setContactLoading(false);
    }
  };

  const handleDeleteEmergencyContact = async (contactId) => {
    if (!confirm('Remove this emergency contact?')) return;
    try {
      await api.safety.deleteEmergencyContact(contactId);
      const res = await api.safety.getEmergencyContacts();
      setEmergencyContacts(Array.isArray(res) ? res : (res?.contacts || []));
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Could not delete contact.');
    }
  };

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

        {/* Pickup Time Pill Selector & Community Scope Pill */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '22px' }}>
          <div ref={dropdownRef} style={{ position: 'relative', width: 'fit-content', zIndex: 35 }}>
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

          {/* Community Filter Capsule */}
          {communities.length > 0 && (
            <div style={{ position: 'relative', width: 'fit-content', zIndex: 30 }}>
              <select
                value={selectedCommunityId}
                onChange={(e) => setSelectedCommunityId(e.target.value)}
                style={{
                  height: '36px',
                  borderRadius: '9999px',
                  background: 'rgba(255, 255, 255, 0.08)',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  border: '1px solid rgba(255, 255, 255, 0.16)',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: 600,
                  padding: '0 16px',
                  outline: 'none',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                <option value="" style={{ background: '#181428', color: '#ffffff' }}>
                  🌐 Open Community / All Corridors
                </option>
                {communities.map((c) => (
                  <option key={c.communityId} value={c.communityId} style={{ background: '#181428', color: '#ffffff' }}>
                    🏢 {c.name} ({c.domain})
                  </option>
                ))}
              </select>
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
            disabled={!canSeePrices || isSearching}
            onClick={handleSearch}
            style={{
              background: canSeePrices && !isSearching ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.03)',
              border: 'none',
              padding: '0 24px',
              height: '42px',
            }}
          >
            {isSearching ? 'Searching rides...' : 'See prices'}
          </LiquidGlassButton>

          {user && (
            <LiquidGlassButton
              scale={0.92}
              onClick={handleTriggerSOS}
              disabled={sosLoading}
              style={{
                background: 'rgba(239, 68, 68, 0.18)',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                color: '#fca5a5',
                gap: '6px',
                height: '42px',
                padding: '0 16px',
              }}
            >
              <IconShield size={16} color="#ef4444" />
              <span>{sosLoading ? 'Activating...' : 'SOS Alert'}</span>
            </LiquidGlassButton>
          )}

          {user && (
            <LiquidGlassButton
              scale={0.92}
              onClick={() => setShowContactsPanel((prev) => !prev)}
              style={{
                background: showContactsPanel ? 'rgba(99, 102, 241, 0.3)' : 'rgba(255, 255, 255, 0.08)',
                border: showContactsPanel ? '1px solid rgba(99, 102, 241, 0.5)' : '1px solid rgba(255, 255, 255, 0.15)',
                color: '#ffffff',
                height: '42px',
                padding: '0 16px',
              }}
            >
              <span>Safety Guardians ({emergencyContacts.length})</span>
            </LiquidGlassButton>
          )}

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

        {/* Active Guardian Emergency Alerts (Incoming from protected loved ones) */}
        {guardianAlerts.length > 0 && (
          <div style={{ marginTop: '18px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {guardianAlerts.map((gAlert) => (
              <div
                key={gAlert.alert.alertId}
                style={{
                  padding: '16px 20px',
                  borderRadius: '20px',
                  background: 'rgba(239, 68, 68, 0.28)',
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                  border: '1.5px solid rgba(239, 68, 68, 0.65)',
                  boxShadow: '0 8px 32px rgba(239, 68, 68, 0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '14px',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <IconShield size={24} color="#fca5a5" />
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff', letterSpacing: '-0.01em' }}>
                      🚨 INCOMING EMERGENCY SOS ALERT
                    </div>
                    <div style={{ fontSize: '12.5px', color: '#fecaca', marginTop: '2px' }}>
                      {gAlert.sender?.name || 'A user'} ({gAlert.sender?.phone || 'Emergency Contact'}) has activated an emergency SOS alert.
                      {gAlert.alert.message && ` "${gAlert.alert.message}"`}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleResolveSOS(gAlert.alert.alertId)}
                  style={{
                    background: '#ffffff',
                    border: 'none',
                    color: '#991b1b',
                    padding: '8px 16px',
                    borderRadius: '9999px',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
                  }}
                >
                  Acknowledge & Resolve SOS
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Active SOS Emergency Banner (Raised by user) */}
        {activeSOS && (
          <div
            style={{
              marginTop: '18px',
              padding: '14px 18px',
              borderRadius: '20px',
              background: 'rgba(220, 38, 38, 0.25)',
              border: '1px solid rgba(239, 68, 68, 0.5)',
              boxShadow: '0 8px 24px rgba(220, 38, 38, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <IconShield size={20} color="#fca5a5" />
              <div>
                <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#ffffff' }}>
                  ACTIVE SOS EMERGENCY EVENT
                </div>
                <div style={{ fontSize: '12px', color: '#fecaca' }}>
                  Emergency contacts notified • Live telemetry dispatched
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleResolveSOS(activeSOS.alert?.alertId || activeSOS.alertId)}
              style={{
                background: '#ffffff',
                border: 'none',
                color: '#991b1b',
                padding: '6px 14px',
                borderRadius: '9999px',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Resolve Alert
            </button>
          </div>
        )}

        {/* Emergency Contacts Management Panel */}
        {user && showContactsPanel && (
          <div style={{ marginTop: '18px' }}>
            <LiquidGlassPanel
              radius={24}
              frosted={true}
              style={{
                padding: '20px',
                background: 'rgba(20, 16, 36, 0.75)',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <span style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff' }}>
                  Emergency Contacts & Safety Guardians
                </span>
                <span style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.6)' }}>
                  Notified automatically with GPS telemetry during SOS
                </span>
              </div>

              {contactMsg && (
                <div
                  style={{
                    padding: '8px 14px',
                    borderRadius: '10px',
                    background: contactMsg.includes('success') ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                    color: contactMsg.includes('success') ? '#86efac' : '#fca5a5',
                    fontSize: '12.5px',
                  }}
                >
                  {contactMsg}
                </div>
              )}

              {/* Add Contact Form */}
              <form
                onSubmit={handleAddEmergencyContact}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 140px), 1fr))',
                  gap: '10px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  padding: '12px',
                  borderRadius: '14px',
                }}
              >
                <input
                  type="text"
                  required
                  placeholder="Contact Name"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '10px',
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#ffffff',
                    fontSize: '12.5px',
                    outline: 'none',
                  }}
                />
                <input
                  type="tel"
                  required
                  placeholder="Phone (+91...)"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '10px',
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#ffffff',
                    fontSize: '12.5px',
                    outline: 'none',
                  }}
                />
                <select
                  value={contactRelationship}
                  onChange={(e) => setContactRelationship(e.target.value)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '10px',
                    background: 'rgba(30, 27, 46, 0.95)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#ffffff',
                    fontSize: '12.5px',
                    outline: 'none',
                  }}
                >
                  <option value="Family">Family</option>
                  <option value="Parent">Parent</option>
                  <option value="Spouse">Spouse</option>
                  <option value="Friend">Friend</option>
                  <option value="Colleague">Colleague</option>
                </select>
                <button
                  type="submit"
                  disabled={contactLoading || !contactName.trim() || !contactPhone.trim()}
                  style={{
                    background: '#6366f1',
                    border: 'none',
                    borderRadius: '10px',
                    color: '#ffffff',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    padding: '8px 14px',
                  }}
                >
                  {contactLoading ? 'Adding...' : '+ Add Guardian'}
                </button>
              </form>

              {/* Contacts List */}
              {emergencyContacts.length === 0 ? (
                <div style={{ fontSize: '12.5px', color: 'rgba(255, 255, 255, 0.5)', padding: '6px 0' }}>
                  No safety guardians registered yet. Add at least one contact above for instant SOS dispatch.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {emergencyContacts.map((c) => (
                    <div
                      key={c.contactId}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '8px 12px',
                        background: 'rgba(255, 255, 255, 0.04)',
                        borderRadius: '10px',
                      }}
                    >
                      <div>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff' }}>{c.name}</span>
                        <span style={{ fontSize: '11.5px', color: 'rgba(255, 255, 255, 0.6)', marginLeft: '8px' }}>
                          ({c.relationship || 'Guardian'}) • {c.phone}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteEmergencyContact(c.contactId)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#f87171',
                          fontSize: '11px',
                          cursor: 'pointer',
                        }}
                      >
                        ✕ Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </LiquidGlassPanel>
          </div>
        )}

        {/* Live Search Results Card */}
        {hasSearched && (
          <div style={{ marginTop: '22px' }}>
            <LiquidGlassPanel
              radius={24}
              frosted={true}
              style={{
                padding: '20px',
                background: 'rgba(20, 16, 36, 0.65)',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13.5px', fontWeight: 600, color: '#ffffff' }}>
                  Available Carpool Rides ({rides.length})
                </span>
                <span style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.5)' }}>
                  {pickup} → {dropoff}
                </span>
              </div>

              {rides.length === 0 ? (
                <div style={{ fontSize: '13.5px', color: 'rgba(255, 255, 255, 0.7)', padding: '10px 0' }}>
                  {searchMessage || 'No direct matches found. Try nearby campuses or offices.'}
                </div>
              ) : (
                rides.map((ride) => (
                  <div
                    key={ride.rideId}
                    style={{
                      background: 'rgba(255, 255, 255, 0.05)',
                      borderRadius: '16px',
                      padding: '14px 18px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '14px',
                      flexWrap: 'wrap',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '14.5px', fontWeight: 600, color: '#ffffff' }}>
                          {ride.driver?.name || 'Verified Driver'}
                        </span>
                        <span
                          style={{
                            fontSize: '12px',
                            background: 'rgba(250, 204, 21, 0.15)',
                            color: '#fde047',
                            padding: '2px 8px',
                            borderRadius: '9999px',
                          }}
                        >
                          ★ {ride.driver?.averageRating || '5.0'}
                        </span>
                        {ride.community?.name && (
                          <span
                            style={{
                              fontSize: '11px',
                              background:
                                selectedCommunityId &&
                                (ride.communityId === selectedCommunityId ||
                                  ride.community?.communityId === selectedCommunityId)
                                  ? 'rgba(16, 185, 129, 0.25)'
                                  : 'rgba(99, 102, 241, 0.25)',
                              border:
                                selectedCommunityId &&
                                (ride.communityId === selectedCommunityId ||
                                  ride.community?.communityId === selectedCommunityId)
                                  ? '1px solid rgba(52, 211, 153, 0.5)'
                                  : '1px solid rgba(129, 140, 248, 0.4)',
                              color:
                                selectedCommunityId &&
                                (ride.communityId === selectedCommunityId ||
                                  ride.community?.communityId === selectedCommunityId)
                                  ? '#a7f3d0'
                                  : '#c7d2fe',
                              padding: '2px 8px',
                              borderRadius: '9999px',
                              fontWeight: 600,
                            }}
                          >
                            {selectedCommunityId &&
                            (ride.communityId === selectedCommunityId ||
                              ride.community?.communityId === selectedCommunityId)
                              ? '⭐ '
                              : '🏢 '}
                            {ride.community.name}
                            {selectedCommunityId &&
                            (ride.communityId === selectedCommunityId ||
                              ride.community?.communityId === selectedCommunityId)
                              ? ' (Priority)'
                              : ''}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '12.5px', color: 'rgba(255, 255, 255, 0.65)', marginTop: '4px' }}>
                        {ride.vehicle ? `${ride.vehicle.make} ${ride.vehicle.model} (${ride.vehicle.vehicleType})` : 'Verified Vehicle'} •{' '}
                        {ride.availableSeats} seats left • Departure: {new Date(ride.departureTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      {ride.routePricing?.isEnRouteMatch && (
                        <div style={{ fontSize: '11.5px', color: '#38bdf8', marginTop: '3px' }}>
                          🛣️ En-Route Driver Corridor: <strong>{ride.source} → {ride.destination}</strong> ({ride.routePricing.driverTotalDistanceKm} km)
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff' }}>
                          ₹{ride.routePricing?.calculatedSubTripFare || ride.farePerSeat}
                        </div>
                        <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.5)' }}>
                          {ride.routePricing?.riderSubTripDistanceKm ? (
                            <span style={{ color: '#86efac' }}>
                              ₹{ride.routePricing.ratePerKm}/km ({ride.routePricing.riderSubTripDistanceKm} km)
                            </span>
                          ) : (
                            'per seat'
                          )}
                        </div>
                      </div>

                      {myBookings.some((b) => b.rideId === ride.rideId && ['PENDING', 'CONFIRMED'].includes(b.status)) ? (
                        <LiquidGlassButton
                          scale={0.88}
                          disabled={true}
                          style={{
                            background: 'rgba(255, 255, 255, 0.08)',
                            border: '1px solid rgba(255, 255, 255, 0.2)',
                            color: 'rgba(255, 255, 255, 0.65)',
                            padding: '0 16px',
                            cursor: 'not-allowed',
                          }}
                        >
                          ✓ Already Booked
                        </LiquidGlassButton>
                      ) : (
                        <LiquidGlassButton
                          scale={0.88}
                          disabled={bookingLoading || ride.availableSeats <= 0}
                          onClick={() => handleBook(ride)}
                          style={{
                            background: 'rgba(99, 102, 241, 0.3)',
                            border: '1px solid rgba(99, 102, 241, 0.45)',
                            color: '#ffffff',
                            padding: '0 18px',
                          }}
                        >
                          {ride.availableSeats <= 0 ? 'Full' : 'Request Seat'}
                        </LiquidGlassButton>
                      )}
                    </div>
                  </div>
                ))
              )}
            </LiquidGlassPanel>
          </div>
        )}

        {/* User Active Bookings & Profile Past Rides Link */}
        {user && (() => {
          const activeBookings = myBookings.filter((b) => ['PENDING', 'CONFIRMED'].includes(b.status));
          if (activeBookings.length > 0) {
            return (
              <div style={{ marginTop: '20px' }}>
                <LiquidGlassPanel
                  radius={20}
                  frosted={true}
                  style={{
                    padding: '16px 20px',
                    background: 'rgba(15, 15, 25, 0.7)',
                    border: '1px solid rgba(99, 102, 241, 0.3)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff' }}>
                        🚗 Active Booking ({activeBookings.length})
                      </span>
                      <span style={{ fontSize: '11px', background: 'rgba(99, 102, 241, 0.2)', color: '#818cf8', padding: '2px 8px', borderRadius: '9999px', fontWeight: 600 }}>
                        Scheduled
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (onSelectTab) onSelectTab('profile');
                        else window.location.hash = '#profile';
                      }}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#c7d2fe',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        padding: 0,
                        textDecoration: 'underline',
                      }}
                    >
                      View All & Past Rides in Profile →
                    </button>
                  </div>

                  {activeBookings.map((b) => (
                    <div
                      key={b.bookingId}
                      style={{
                        background: 'rgba(255, 255, 255, 0.04)',
                        borderRadius: '14px',
                        padding: '12px 16px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '10px',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 600, color: '#ffffff' }}>
                          {b.ride?.source || 'Origin'} → {b.ride?.destination || 'Destination'}
                        </div>
                        <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.65)', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span>Driver: <strong style={{ color: '#ffffff' }}>{b.ride?.driver?.name || 'Verified Driver'}</strong></span>
                          <span style={{ background: 'rgba(250, 204, 21, 0.15)', color: '#fde047', padding: '1px 6px', borderRadius: '6px', fontSize: '11px', fontWeight: 600 }}>
                            ★ {Number(b.ride?.driver?.averageRating || 5.0).toFixed(1)}
                          </span>
                          {b.ride?.departureTime && (
                            <span>• {new Date(b.ride.departureTime).toLocaleDateString([], { month: 'short', day: 'numeric' })} at {new Date(b.ride.departureTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '15px', fontWeight: 700, color: '#ffffff' }}>₹{b.totalAmount}</span>
                        <button
                          type="button"
                          onClick={() => handleCancelBooking(b.bookingId)}
                          style={{
                            background: 'rgba(239, 68, 68, 0.12)',
                            border: '1px solid rgba(239, 68, 68, 0.28)',
                            borderRadius: '9999px',
                            padding: '4px 10px',
                            color: '#f87171',
                            fontSize: '11px',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ))}
                </LiquidGlassPanel>
              </div>
            );
          } else if (myBookings.length > 0) {
            return (
              <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => {
                    if (onSelectTab) onSelectTab('profile');
                    else window.location.hash = '#profile';
                  }}
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: '9999px',
                    padding: '6px 14px',
                    color: '#c7d2fe',
                    fontSize: '12px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <span>🕒 View Past Rides ({myBookings.length}) in Profile →</span>
                </button>
              </div>
            );
          }
          return null;
        })()}
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
