import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { LiquidGlassPanel } from './ui/LiquidGlassPanel';
import { LiquidGlassButton } from './ui/LiquidGlassButton';
import {
  IconCar,
  IconClock,
  IconShield,
  IconCheck,
  IconZap,
} from './Icons';

export const ProfilePage = ({ user, onLoginClick, onSignUpClick, onSelectTab }) => {
  // Role Mode: 'driver' | 'passenger'
  const isDriver = Boolean(user && (user.roles?.includes('DRIVER') || user.driverVerified));
  const [profileViewMode, setProfileViewMode] = useState(() => (isDriver ? 'driver' : 'passenger'));

  // Passenger Bookings State
  const [bookings, setBookings] = useState([]);
  const [activePassengerTab, setActivePassengerTab] = useState('all'); // 'all' | 'active' | 'completed' | 'cancelled'

  // Driver Rides State
  const [driverRides, setDriverRides] = useState([]);
  const [driverEarnings, setDriverEarnings] = useState(null);
  const [activeDriverTab, setActiveDriverTab] = useState('all'); // 'all' | 'scheduled' | 'completed' | 'cancelled'
  const [expandedManifestRideId, setExpandedManifestRideId] = useState(null);
  const [manifestMap, setManifestMap] = useState({});
  const [manifestLoading, setManifestLoading] = useState(false);

  // General State
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState('');

  // Rating State (Passenger -> Driver)
  const [ratingBookingId, setRatingBookingId] = useState(null);
  const [ratingScore, setRatingScore] = useState(5);
  const [ratingComment, setRatingComment] = useState('');
  const [submittingRating, setSubmittingRating] = useState(false);
  const [ratedBookings, setRatedBookings] = useState({});

  // Rating State (Driver -> Passenger)
  const [driverRatedPassengers, setDriverRatedPassengers] = useState({});
  const [driverRatingBookingId, setDriverRatingBookingId] = useState(null);
  const [driverRatingScore, setDriverRatingScore] = useState(5);
  const [driverRatingComment, setDriverRatingComment] = useState('');

  // Emergency Contacts State
  const [contacts, setContacts] = useState([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [showAddContact, setShowAddContact] = useState(false);
  const [newContact, setNewContact] = useState({
    name: '',
    phone: '',
    relationship: 'Family',
  });
  const [contactMsg, setContactMsg] = useState('');

  // Auto-switch viewMode if user has driver rides but wasn't marked isDriver
  useEffect(() => {
    if (driverRides.length > 0 && bookings.length === 0) {
      setProfileViewMode('driver');
    }
  }, [driverRides.length, bookings.length]);

  const fetchAllData = async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);

      // Fetch passenger bookings
      const bookingFn = api.bookings?.getMyBookings || api.rides?.getMyBookings;
      if (bookingFn) {
        try {
          const res = await bookingFn();
          const list = Array.isArray(res) ? res : (res?.bookings || []);
          setBookings(list);
        } catch {}
      }

      // Fetch driver rides
      const driverRideFn = api.rides?.getDriverRides;
      if (driverRideFn) {
        try {
          const res = await driverRideFn();
          const list = Array.isArray(res) ? res : (res?.rides || []);
          setDriverRides(list);
        } catch {}
      }

      // Fetch driver earnings
      if (api.driver?.getEarnings) {
        try {
          const earningsRes = await api.driver.getEarnings();
          setDriverEarnings(earningsRes);
        } catch {}
      }

      // Fetch emergency contacts
      const contactFn = api.safety?.getEmergencyContacts || api.sos?.getEmergencyContacts;
      if (contactFn) {
        try {
          const contactsRes = await contactFn();
          const list = Array.isArray(contactsRes) ? contactsRes : (contactsRes?.contacts || []);
          setContacts(list);
        } catch {}
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();

    if (user) {
      // 5-second real-time polling to keep all driver and passenger rides synchronized with the DB
      const poll = setInterval(() => {
        const bookingFn = api.bookings?.getMyBookings || api.rides?.getMyBookings;
        if (bookingFn) {
          bookingFn()
            .then((res) => {
              const list = Array.isArray(res) ? res : (res?.bookings || []);
              setBookings(list);
            })
            .catch(() => {});
        }

        const driverRideFn = api.rides?.getDriverRides;
        if (driverRideFn) {
          driverRideFn()
            .then((res) => {
              const list = Array.isArray(res) ? res : (res?.rides || []);
              setDriverRides(list);
            })
            .catch(() => {});
        }

        if (api.driver?.getEarnings) {
          api.driver.getEarnings()
            .then((res) => setDriverEarnings(res))
            .catch(() => {});
        }

        // If a manifest is currently open, refresh it as well
        if (expandedManifestRideId) {
          api.bookings.getRideManifest(expandedManifestRideId)
            .then((res) => {
              const list = Array.isArray(res) ? res : (res?.bookings || []);
              setManifestMap((prev) => ({ ...prev, [expandedManifestRideId]: list }));
            })
            .catch(() => {});
        }
      }, 5000);

      return () => clearInterval(poll);
    }
  }, [user, expandedManifestRideId]);

  // Manifest Toggle
  const handleToggleManifest = async (rideId) => {
    if (expandedManifestRideId === rideId) {
      setExpandedManifestRideId(null);
      return;
    }
    setExpandedManifestRideId(rideId);
    if (!manifestMap[rideId]) {
      setManifestLoading(true);
      try {
        const res = await api.bookings.getRideManifest(rideId);
        const list = Array.isArray(res) ? res : (res?.bookings || []);
        setManifestMap((prev) => ({ ...prev, [rideId]: list }));
      } catch {
        setManifestMap((prev) => ({ ...prev, [rideId]: [] }));
      } finally {
        setManifestLoading(false);
      }
    }
  };

  // Driver Trip Actions
  const handleCompleteDriverRide = async (rideId) => {
    if (!window.confirm('Mark this entire ride and all passenger trips as completed?')) return;
    try {
      setActionMsg('Completing ride and processing earnings...');
      await api.rides.complete(rideId);
      setActionMsg('✓ Ride marked as completed! Driver earnings recorded.');
      setTimeout(() => setActionMsg(''), 4500);
      fetchAllData();
    } catch (err) {
      setActionMsg(err.message || 'Failed to complete ride.');
      setTimeout(() => setActionMsg(''), 4500);
    }
  };

  const handleCancelDriverRide = async (rideId) => {
    if (!window.confirm('Are you sure you want to cancel this scheduled ride? Booked passengers will be notified.')) return;
    try {
      setActionMsg('Cancelling scheduled ride...');
      await api.rides.cancel(rideId);
      setActionMsg('Ride cancelled.');
      setTimeout(() => setActionMsg(''), 4000);
      fetchAllData();
    } catch (err) {
      setActionMsg(err.message || 'Failed to cancel ride.');
      setTimeout(() => setActionMsg(''), 4500);
    }
  };

  // Driver Rating Passenger
  const handleSubmitDriverRating = async (bookingId, riderName) => {
    if (!bookingId) return;
    try {
      await api.ratings.submit(bookingId, driverRatingScore, driverRatingComment);
      const updated = {
        ...driverRatedPassengers,
        [bookingId]: { score: driverRatingScore, comment: driverRatingComment, at: new Date().toISOString() },
      };
      setDriverRatedPassengers(updated);
      setDriverRatingBookingId(null);
      setDriverRatingComment('');
      setActionMsg(`✓ Thank you! Rated passenger ${riderName || ''} ★ ${driverRatingScore}.`);
      setTimeout(() => setActionMsg(''), 4500);
    } catch (err) {
      setActionMsg(err.message || 'Failed to submit rating.');
      setTimeout(() => setActionMsg(''), 4500);
    }
  };

  // Passenger Actions
  const handleCancelBooking = async (bookingId) => {
    if (!window.confirm('Are you sure you want to cancel this booking?')) return;
    try {
      setActionMsg('Cancelling booking...');
      const cancelFn = api.bookings?.cancel || api.rides?.cancelBooking;
      await cancelFn(bookingId, 'Passenger requested cancellation');
      setActionMsg('Booking cancelled successfully.');
      setTimeout(() => setActionMsg(''), 4000);
      fetchAllData();
    } catch (err) {
      setActionMsg(err.message || 'Failed to cancel booking.');
      setTimeout(() => setActionMsg(''), 5000);
    }
  };

  const handleRequestRefund = async (bookingId) => {
    try {
      setActionMsg('Submitting refund request...');
      const refundFn = api.bookings?.requestRefund || api.rides?.requestRefund;
      await refundFn(bookingId, 'Passenger requested refund');
      setActionMsg('Refund request submitted to driver for approval.');
      setTimeout(() => setActionMsg(''), 4000);
      fetchAllData();
    } catch (err) {
      setActionMsg(err.message || 'Failed to submit refund request.');
      setTimeout(() => setActionMsg(''), 5000);
    }
  };

  const handleSubmitRating = async (bookingId, driverName) => {
    if (!bookingId) return;
    try {
      setSubmittingRating(true);
      await api.ratings.submit(bookingId, ratingScore, ratingComment);

      const updated = {
        ...ratedBookings,
        [bookingId]: { score: ratingScore, comment: ratingComment, at: new Date().toISOString() },
      };
      setRatedBookings(updated);

      setRatingBookingId(null);
      setRatingComment('');
      setActionMsg(`Thank you! Your ${ratingScore}-star review for ${driverName || 'driver'} was recorded.`);
      setTimeout(() => setActionMsg(''), 4500);
    } catch (err) {
      setActionMsg(err.message || 'Could not submit rating. Please try again.');
      setTimeout(() => setActionMsg(''), 4500);
    } finally {
      setSubmittingRating(false);
    }
  };

  // Contacts
  const handleAddContact = async (e) => {
    e.preventDefault();
    if (!newContact.name.trim() || !newContact.phone.trim()) return;
    try {
      setContactMsg('Adding contact...');
      const addFn = api.safety?.addEmergencyContact || api.sos?.addEmergencyContact;
      await addFn(newContact);
      setNewContact({ name: '', phone: '', relationship: 'Family' });
      setShowAddContact(false);
      setContactMsg('Emergency contact added.');
      setTimeout(() => setContactMsg(''), 3500);
      fetchAllData();
    } catch (err) {
      setContactMsg(err.message || 'Failed to add emergency contact.');
      setTimeout(() => setContactMsg(''), 4000);
    }
  };

  const handleDeleteContact = async (contactId) => {
    try {
      const delFn = api.safety?.deleteEmergencyContact || api.sos?.deleteEmergencyContact;
      await delFn(contactId);
      setContacts((prev) => prev.filter((c) => c.contactId !== contactId));
      setContactMsg('Emergency contact removed.');
      setTimeout(() => setContactMsg(''), 3000);
    } catch (err) {
      setContactMsg(err.message || 'Failed to delete contact.');
      setTimeout(() => setContactMsg(''), 3500);
    }
  };

  // Filter passenger bookings
  const activeBookings = bookings.filter((b) => ['PENDING', 'CONFIRMED'].includes(b.status));
  const completedBookings = bookings.filter((b) => b.status === 'COMPLETED');
  const cancelledBookings = bookings.filter((b) => b.status === 'CANCELLED');

  let filteredBookings = bookings;
  if (activePassengerTab === 'active') filteredBookings = activeBookings;
  else if (activePassengerTab === 'completed') filteredBookings = completedBookings;
  else if (activePassengerTab === 'cancelled') filteredBookings = cancelledBookings;

  // Filter driver rides
  const scheduledDrives = driverRides.filter((r) => r.status === 'SCHEDULED');
  const completedDrives = driverRides.filter((r) => r.status === 'COMPLETED');
  const cancelledDrives = driverRides.filter((r) => r.status === 'CANCELLED');

  let filteredDrives = driverRides;
  if (activeDriverTab === 'scheduled') filteredDrives = scheduledDrives;
  else if (activeDriverTab === 'completed') filteredDrives = completedDrives;
  else if (activeDriverTab === 'cancelled') filteredDrives = cancelledDrives;

  if (!user) {
    return (
      <div className="rs-page-container" style={{ padding: 'clamp(32px, 6vw, 64px) 20px', minHeight: '80vh' }}>
        <div style={{ maxWidth: '600px', margin: '0 auto', textAlign: 'center' }}>
          <LiquidGlassPanel
            radius={28}
            frosted={true}
            style={{
              padding: 'clamp(32px, 5vw, 56px)',
              background: 'rgba(20, 16, 36, 0.7)',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
            }}
          >
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 20px',
                color: '#ffffff',
                boxShadow: '0 10px 25px rgba(99, 102, 241, 0.4)',
              }}
            >
              <IconShield size={32} />
            </div>
            <h2 style={{ fontSize: '26px', fontWeight: 700, color: '#ffffff', marginBottom: '10px' }}>
              Sign in to view your profile
            </h2>
            <p style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '15px', lineHeight: 1.6, marginBottom: '28px' }}>
              Access your complete ride history, check driver earnings & ratings, manage wallet balance, and update safety contacts.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <LiquidGlassButton
                variant="primary"
                scale={1}
                onClick={onLoginClick}
                style={{ padding: '12px 28px', fontSize: '15px' }}
              >
                Log In
              </LiquidGlassButton>
              <LiquidGlassButton
                scale={1}
                onClick={onSignUpClick}
                style={{ padding: '12px 28px', fontSize: '15px', background: 'rgba(255, 255, 255, 0.1)' }}
              >
                Create Account
              </LiquidGlassButton>
            </div>
          </LiquidGlassPanel>
        </div>
      </div>
    );
  }

  const userRating = Number(user.averageRating || 5.0).toFixed(1);
  const userRatingCount = user.ratingCount ?? 0;
  const hasDriverRides = driverRides.length > 0 || isDriver;

  return (
    <div className="rs-page-container" style={{ padding: 'clamp(28px, 4vw, 56px) 20px', maxWidth: '1100px', margin: '0 auto' }}>
      {/* 1. Profile Header Card */}
      <LiquidGlassPanel
        radius={28}
        frosted={true}
        style={{
          padding: 'clamp(24px, 4vw, 36px)',
          background: 'rgba(18, 16, 32, 0.75)',
          boxShadow: '0 18px 48px rgba(0, 0, 0, 0.45)',
          marginBottom: '28px',
          border: '1px solid rgba(255, 255, 255, 0.12)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '20px' }}>
          {/* Left: User Avatar & Details */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
            <div
              style={{
                width: '68px',
                height: '68px',
                borderRadius: '50%',
                background: isDriver
                  ? 'linear-gradient(135deg, #10b981, #6366f1)'
                  : 'linear-gradient(135deg, #6366f1, #a855f7)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '26px',
                fontWeight: 700,
                color: '#ffffff',
                boxShadow: isDriver ? '0 8px 24px rgba(16, 185, 129, 0.4)' : '0 8px 24px rgba(99, 102, 241, 0.4)',
                border: '2px solid rgba(255, 255, 255, 0.25)',
                flexShrink: 0,
              }}
            >
              {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <h1 style={{ fontSize: 'clamp(22px, 3vw, 28px)', fontWeight: 700, color: '#ffffff', margin: 0, letterSpacing: '-0.02em' }}>
                  {user.name || 'Community Member'}
                </h1>
                <span
                  style={{
                    fontSize: '11.5px',
                    fontWeight: 600,
                    padding: '3px 10px',
                    borderRadius: '9999px',
                    background: isDriver ? 'rgba(52, 211, 153, 0.18)' : 'rgba(99, 102, 241, 0.18)',
                    color: isDriver ? '#6ee7b7' : '#c7d2fe',
                    border: isDriver ? '1px solid rgba(52, 211, 153, 0.35)' : '1px solid rgba(99, 102, 241, 0.35)',
                  }}
                >
                  {isDriver ? '✓ Verified Driver' : 'Passenger Member'}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '6px', fontSize: '13.5px', color: 'rgba(255, 255, 255, 0.65)', flexWrap: 'wrap' }}>
                <span>{user.email}</span>
                {user.phone && <span>• {user.phone}</span>}
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(250, 204, 21, 0.15)', color: '#fde047', padding: '1px 8px', borderRadius: '6px', fontWeight: 600, fontSize: '12px' }}>
                  ★ {userRating} {userRatingCount > 0 ? `(${userRatingCount} reviews)` : '(Community Trust)'}
                </span>
              </div>
            </div>
          </div>

          {/* Right: Driver Earnings / Wallet & Quick Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
            {isDriver && (
              <div
                style={{
                  background: 'rgba(52, 211, 153, 0.08)',
                  border: '1px solid rgba(52, 211, 153, 0.25)',
                  borderRadius: '16px',
                  padding: '12px 18px',
                  textAlign: 'right',
                  minWidth: '130px',
                }}
              >
                <div style={{ fontSize: '11px', color: '#6ee7b7', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                  Driver Earnings
                </div>
                <div style={{ fontSize: '22px', fontWeight: 800, color: '#34d399', marginTop: '2px' }}>
                  ₹{driverEarnings?.summary?.totalNetEarnings || driverEarnings?.summary?.netEarnings || '0.00'}
                </div>
              </div>
            )}

            <div
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '16px',
                padding: '12px 18px',
                textAlign: 'right',
                minWidth: '120px',
              }}
            >
              <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.55)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Wallet Balance
              </div>
              <div style={{ fontSize: '22px', fontWeight: 800, color: '#86efac', marginTop: '2px' }}>
                ₹{user.walletBalance || '0.00'}
              </div>
            </div>

            {!isDriver && onSelectTab && (
              <LiquidGlassButton
                scale={0.92}
                onClick={() => onSelectTab('drive')}
                style={{
                  background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.4), rgba(168, 85, 247, 0.4))',
                  border: '1px solid rgba(168, 85, 247, 0.4)',
                  color: '#ffffff',
                  padding: '10px 18px',
                  fontSize: '13.5px',
                  fontWeight: 600,
                }}
              >
                Become a Driver →
              </LiquidGlassButton>
            )}
          </div>
        </div>
      </LiquidGlassPanel>

      {/* Global Action / Status Notifications */}
      {actionMsg && (
        <div
          style={{
            padding: '12px 18px',
            borderRadius: '14px',
            marginBottom: '20px',
            background: actionMsg.includes('Thank you') || actionMsg.includes('successfully') || actionMsg.includes('✓')
              ? 'rgba(34, 197, 94, 0.15)'
              : 'rgba(99, 102, 241, 0.15)',
            border: actionMsg.includes('Thank you') || actionMsg.includes('successfully') || actionMsg.includes('✓')
              ? '1px solid rgba(34, 197, 94, 0.35)'
              : '1px solid rgba(99, 102, 241, 0.35)',
            color: actionMsg.includes('Thank you') || actionMsg.includes('successfully') || actionMsg.includes('✓') ? '#86efac' : '#c7d2fe',
            fontSize: '13.5px',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <IconCheck size={16} />
          {actionMsg}
        </div>
      )}

      {/* 2. Main Two-Column Layout: Rides History (Left) + Safety Contacts (Right) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', gap: '24px', alignItems: 'start' }}>
        {/* Left Column: Full Rides History for BOTH Driver & Passenger */}
        <div style={{ minWidth: 0, gridColumn: 'span 2' }}>
          <LiquidGlassPanel
            radius={24}
            frosted={true}
            style={{
              padding: 'clamp(20px, 3.5vw, 28px)',
              background: 'rgba(18, 16, 32, 0.7)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}
          >
            {/* Header: Driver vs Passenger Mode Switcher */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', marginBottom: '20px' }}>
              <div>
                <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#ffffff', margin: '0 0 4px 0' }}>
                  Ride & Drive Records
                </h2>
                <p style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.6)', margin: 0 }}>
                  View scheduled, active, and completed journeys for both driving and riding.
                </p>
              </div>

              {/* View Selector: Driver Drives vs Passenger Bookings */}
              {hasDriverRides && (
                <div style={{ display: 'flex', background: 'rgba(0, 0, 0, 0.35)', borderRadius: '14px', padding: '4px', gap: '6px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                  <button
                    type="button"
                    onClick={() => setProfileViewMode('driver')}
                    style={{
                      background: profileViewMode === 'driver' ? 'rgba(52, 211, 153, 0.25)' : 'transparent',
                      border: profileViewMode === 'driver' ? '1px solid rgba(52, 211, 153, 0.5)' : '1px solid transparent',
                      borderRadius: '10px',
                      padding: '7px 14px',
                      color: profileViewMode === 'driver' ? '#6ee7b7' : 'rgba(255, 255, 255, 0.65)',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    🚗 My Drives ({driverRides.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setProfileViewMode('passenger')}
                    style={{
                      background: profileViewMode === 'passenger' ? 'rgba(99, 102, 241, 0.35)' : 'transparent',
                      border: profileViewMode === 'passenger' ? '1px solid rgba(129, 140, 248, 0.5)' : '1px solid transparent',
                      borderRadius: '10px',
                      padding: '7px 14px',
                      color: profileViewMode === 'passenger' ? '#ffffff' : 'rgba(255, 255, 255, 0.65)',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    🎫 My Passenger Rides ({bookings.length})
                  </button>
                </div>
              )}
            </div>

            {/* A. DRIVER SECTION */}
            {profileViewMode === 'driver' && hasDriverRides && (
              <div>
                {/* Driver Sub-tabs */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '18px' }}>
                  <div style={{ display: 'flex', background: 'rgba(255, 255, 255, 0.06)', borderRadius: '12px', padding: '3px', gap: '4px' }}>
                    {[
                      { id: 'all', label: `All Drives (${driverRides.length})` },
                      { id: 'scheduled', label: `Active / Scheduled (${scheduledDrives.length})` },
                      { id: 'completed', label: `Completed (${completedDrives.length})` },
                      { id: 'cancelled', label: `Cancelled (${cancelledDrives.length})` },
                    ].map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setActiveDriverTab(t.id)}
                        style={{
                          background: activeDriverTab === t.id ? 'rgba(52, 211, 153, 0.25)' : 'transparent',
                          border: activeDriverTab === t.id ? '1px solid rgba(52, 211, 153, 0.45)' : 'none',
                          borderRadius: '9px',
                          padding: '6px 12px',
                          color: activeDriverTab === t.id ? '#6ee7b7' : 'rgba(255, 255, 255, 0.65)',
                          fontSize: '12.5px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>

                  {onSelectTab && (
                    <LiquidGlassButton
                      scale={0.88}
                      onClick={() => onSelectTab('drive')}
                      style={{ background: 'rgba(52, 211, 153, 0.15)', color: '#6ee7b7', border: '1px solid rgba(52, 211, 153, 0.3)' }}
                    >
                      + Publish New Carpool →
                    </LiquidGlassButton>
                  )}
                </div>

                {/* Driver Rides List */}
                {loading ? (
                  <div style={{ textAlign: 'center', padding: '36px 0', color: 'rgba(255, 255, 255, 0.6)', fontSize: '14px' }}>
                    Loading your driver routes...
                  </div>
                ) : filteredDrives.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 16px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '16px', border: '1px dashed rgba(255, 255, 255, 0.12)' }}>
                    <div style={{ fontSize: '32px', marginBottom: '8px' }}>🚗</div>
                    <div style={{ fontSize: '15px', fontWeight: 600, color: '#ffffff', marginBottom: '4px' }}>
                      No {activeDriverTab !== 'all' ? activeDriverTab : ''} drives found
                    </div>
                    <p style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.55)', maxWidth: '400px', margin: '0 auto 16px' }}>
                      You haven't published any carpool routes in this category yet.
                    </p>
                    {onSelectTab && (
                      <LiquidGlassButton
                        scale={0.9}
                        onClick={() => onSelectTab('drive')}
                        style={{ background: 'rgba(52, 211, 153, 0.3)', color: '#ffffff' }}
                      >
                        Publish a Route Now →
                      </LiquidGlassButton>
                    )}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {filteredDrives.map((ride) => {
                      const isExpanded = expandedManifestRideId === ride.rideId;
                      const manifest = manifestMap[ride.rideId] || [];
                      const departureDateStr = ride.departureTime
                        ? new Date(ride.departureTime).toLocaleDateString([], {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })
                        : 'Scheduled Date';
                      const departureTimeStr = ride.departureTime
                        ? new Date(ride.departureTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : '';

                      return (
                        <div
                          key={ride.rideId}
                          style={{
                            background: 'rgba(255, 255, 255, 0.035)',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            borderRadius: '16px',
                            padding: '16px 20px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '12px',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '15.5px', fontWeight: 700, color: '#ffffff' }}>
                                  {ride.source} → {ride.destination}
                                </span>
                                <span
                                  style={{
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    padding: '2px 9px',
                                    borderRadius: '9999px',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.04em',
                                    background:
                                      ride.status === 'COMPLETED'
                                        ? 'rgba(34, 197, 94, 0.15)'
                                        : ride.status === 'CANCELLED'
                                        ? 'rgba(239, 68, 68, 0.15)'
                                        : 'rgba(56, 189, 248, 0.15)',
                                    color:
                                      ride.status === 'COMPLETED'
                                        ? '#4ade80'
                                        : ride.status === 'CANCELLED'
                                        ? '#f87171'
                                        : '#38bdf8',
                                    border:
                                      ride.status === 'COMPLETED'
                                        ? '1px solid rgba(34, 197, 94, 0.3)'
                                        : ride.status === 'CANCELLED'
                                        ? '1px solid rgba(239, 68, 68, 0.3)'
                                        : '1px solid rgba(56, 189, 248, 0.3)',
                                  }}
                                >
                                  {ride.status}
                                </span>
                              </div>

                              <div style={{ fontSize: '12.5px', color: 'rgba(255, 255, 255, 0.65)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                <span>🕒 {departureDateStr} at {departureTimeStr}</span>
                                <span>• {ride.availableSeats} of {ride.totalSeats} seats open</span>
                                {ride.vehicle?.model && <span>• Vehicle: {ride.vehicle.make} {ride.vehicle.model} ({ride.vehicle.registrationNumber})</span>}
                              </div>
                            </div>

                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: '18px', fontWeight: 800, color: '#34d399' }}>
                                ₹{ride.farePerSeat} <span style={{ fontSize: '12px', fontWeight: 400, color: 'rgba(255, 255, 255, 0.5)' }}>/ seat</span>
                              </div>
                            </div>
                          </div>

                          {/* Action Bar: Manifest & Trip Lifecycle */}
                          <div
                            style={{
                              background: 'rgba(0, 0, 0, 0.25)',
                              borderRadius: '12px',
                              padding: '10px 14px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              flexWrap: 'wrap',
                              gap: '10px',
                            }}
                          >
                            <LiquidGlassButton
                              scale={0.84}
                              onClick={() => handleToggleManifest(ride.rideId)}
                              style={{
                                background: isExpanded ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.06)',
                                color: '#ffffff',
                                padding: '0 14px',
                              }}
                            >
                              {isExpanded ? '▲ Hide Passenger Manifest' : '▼ Passenger Manifest & Bookings'}
                            </LiquidGlassButton>

                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                              {ride.status === 'SCHEDULED' && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleCompleteDriverRide(ride.rideId)}
                                    style={{
                                      background: 'rgba(34, 197, 94, 0.15)',
                                      border: '1px solid rgba(34, 197, 94, 0.35)',
                                      borderRadius: '9999px',
                                      padding: '5px 12px',
                                      color: '#86efac',
                                      fontSize: '11.5px',
                                      fontWeight: 600,
                                      cursor: 'pointer',
                                    }}
                                  >
                                    ✓ Complete Trip
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleCancelDriverRide(ride.rideId)}
                                    style={{
                                      background: 'rgba(239, 68, 68, 0.12)',
                                      border: '1px solid rgba(239, 68, 68, 0.25)',
                                      borderRadius: '9999px',
                                      padding: '5px 12px',
                                      color: '#f87171',
                                      fontSize: '11.5px',
                                      cursor: 'pointer',
                                    }}
                                  >
                                    Cancel Drive
                                  </button>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Expandable Manifest Panel */}
                          {isExpanded && (
                            <div
                              style={{
                                marginTop: '12px',
                                paddingTop: '14px',
                                borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                              }}
                            >
                              <div style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff', marginBottom: '10px' }}>
                                Booked Passengers ({manifest.length})
                              </div>

                              {manifestLoading ? (
                                <div style={{ fontSize: '12.5px', color: 'rgba(255, 255, 255, 0.6)' }}>
                                  Loading passenger manifest...
                                </div>
                              ) : manifest.length === 0 ? (
                                <div style={{ fontSize: '12.5px', color: 'rgba(255, 255, 255, 0.5)' }}>
                                  No passengers have booked seats on this route yet.
                                </div>
                              ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                  {manifest.map((b) => (
                                    <div
                                      key={b.bookingId}
                                      style={{
                                        background: 'rgba(0, 0, 0, 0.3)',
                                        borderRadius: '12px',
                                        padding: '10px 14px',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        flexWrap: 'wrap',
                                        gap: '8px',
                                      }}
                                    >
                                      <div>
                                        <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                          <span>{b.rider?.name || 'Community Passenger'}</span>
                                          <span style={{ fontSize: '11px', background: 'rgba(250, 204, 21, 0.15)', color: '#fde047', padding: '1px 6px', borderRadius: '6px' }}>
                                            ★ {Number(b.rider?.averageRating || 5.0).toFixed(1)}
                                          </span>
                                        </div>
                                        <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.6)', marginTop: '2px' }}>
                                          {b.seatsBooked || 1} seat(s) • Total: ₹{b.totalAmount} • Status: <strong style={{ color: '#86efac' }}>{b.status}</strong>
                                          {b.rider?.phone && <span> • Contact: {b.rider.phone}</span>}
                                        </div>
                                      </div>

                                      {/* Driver Rate Passenger Option */}
                                      {b.status === 'COMPLETED' && (
                                        <div>
                                          {driverRatedPassengers[b.bookingId] ? (
                                            <span style={{ fontSize: '11px', color: '#86efac', background: 'rgba(34, 197, 94, 0.15)', padding: '3px 10px', borderRadius: '9999px', fontWeight: 600 }}>
                                              ✓ Rated ★ {driverRatedPassengers[b.bookingId].score || 5}
                                            </span>
                                          ) : driverRatingBookingId !== b.bookingId ? (
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setDriverRatingBookingId(b.bookingId);
                                                setDriverRatingScore(5);
                                                setDriverRatingComment('');
                                              }}
                                              style={{
                                                background: 'rgba(250, 204, 21, 0.15)',
                                                border: '1px solid rgba(250, 204, 21, 0.35)',
                                                borderRadius: '9999px',
                                                padding: '4px 12px',
                                                color: '#fde047',
                                                fontSize: '11.5px',
                                                fontWeight: 600,
                                                cursor: 'pointer',
                                              }}
                                            >
                                              Rate Passenger ★
                                            </button>
                                          ) : null}
                                        </div>
                                      )}

                                      {/* Driver Rating Passenger Inline Form */}
                                      {b.status === 'COMPLETED' && driverRatingBookingId === b.bookingId && !driverRatedPassengers[b.bookingId] && (
                                        <div
                                          style={{
                                            width: '100%',
                                            marginTop: '8px',
                                            padding: '10px 14px',
                                            background: 'rgba(0, 0, 0, 0.4)',
                                            borderRadius: '10px',
                                            border: '1px solid rgba(250, 204, 21, 0.25)',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '8px',
                                          }}
                                        >
                                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontSize: '12px', color: '#fde047', fontWeight: 600 }}>
                                              Rate {b.rider?.name || 'Passenger'}:
                                            </span>
                                            <div style={{ display: 'flex', gap: '3px' }}>
                                              {[1, 2, 3, 4, 5].map((star) => (
                                                <button
                                                  key={star}
                                                  type="button"
                                                  onClick={() => setDriverRatingScore(star)}
                                                  style={{
                                                    background: 'transparent',
                                                    border: 'none',
                                                    color: star <= driverRatingScore ? '#fde047' : 'rgba(255, 255, 255, 0.2)',
                                                    fontSize: '17px',
                                                    cursor: 'pointer',
                                                    padding: '2px',
                                                    lineHeight: 1,
                                                  }}
                                                >
                                                  ★
                                                </button>
                                              ))}
                                            </div>
                                          </div>
                                          <input
                                            type="text"
                                            placeholder="Optional note (e.g. Courteous, on time)..."
                                            value={driverRatingComment}
                                            onChange={(e) => setDriverRatingComment(e.target.value)}
                                            style={{
                                              background: 'rgba(255, 255, 255, 0.08)',
                                              border: '1px solid rgba(255, 255, 255, 0.15)',
                                              borderRadius: '8px',
                                              padding: '6px 10px',
                                              color: '#ffffff',
                                              fontSize: '12px',
                                              outline: 'none',
                                            }}
                                          />
                                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                            <button
                                              type="button"
                                              onClick={() => setDriverRatingBookingId(null)}
                                              style={{ background: 'transparent', border: 'none', color: 'rgba(255, 255, 255, 0.6)', fontSize: '11px', cursor: 'pointer' }}
                                            >
                                              Cancel
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => handleSubmitDriverRating(b.bookingId, b.rider?.name)}
                                              style={{
                                                background: 'linear-gradient(135deg, #10b981, #059669)',
                                                border: 'none',
                                                color: '#ffffff',
                                                borderRadius: '9999px',
                                                padding: '4px 12px',
                                                fontSize: '11.5px',
                                                fontWeight: 600,
                                                cursor: 'pointer',
                                              }}
                                            >
                                              Submit Rating
                                            </button>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* B. PASSENGER SECTION */}
            {(profileViewMode === 'passenger' || !hasDriverRides) && (
              <div>
                {/* Passenger Filter Tabs */}
                <div style={{ display: 'flex', background: 'rgba(255, 255, 255, 0.06)', borderRadius: '12px', padding: '3px', gap: '4px', marginBottom: '18px', width: 'fit-content' }}>
                  {[
                    { id: 'all', label: `All Rides (${bookings.length})` },
                    { id: 'active', label: `Active (${activeBookings.length})` },
                    { id: 'completed', label: `Past (${completedBookings.length})` },
                    { id: 'cancelled', label: `Cancelled (${cancelledBookings.length})` },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setActivePassengerTab(t.id)}
                      style={{
                        background: activePassengerTab === t.id ? 'rgba(99, 102, 241, 0.4)' : 'transparent',
                        border: activePassengerTab === t.id ? '1px solid rgba(129, 140, 248, 0.4)' : 'none',
                        borderRadius: '9px',
                        padding: '6px 12px',
                        color: activePassengerTab === t.id ? '#ffffff' : 'rgba(255, 255, 255, 0.65)',
                        fontSize: '12.5px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                {/* Passenger Bookings List */}
                {loading ? (
                  <div style={{ textAlign: 'center', padding: '36px 0', color: 'rgba(255, 255, 255, 0.6)', fontSize: '14px' }}>
                    Loading your ride history...
                  </div>
                ) : filteredBookings.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 16px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '16px', border: '1px dashed rgba(255, 255, 255, 0.12)' }}>
                    <div style={{ fontSize: '32px', marginBottom: '8px' }}>🚗</div>
                    <div style={{ fontSize: '15px', fontWeight: 600, color: '#ffffff', marginBottom: '4px' }}>
                      No {activePassengerTab !== 'all' ? activePassengerTab : ''} passenger rides found
                    </div>
                    <p style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.55)', maxWidth: '400px', margin: '0 auto 16px' }}>
                      {activePassengerTab === 'active'
                        ? "You don't have any upcoming trips scheduled. Book a carpool from the Ride page anytime!"
                        : activePassengerTab === 'completed'
                        ? "No completed trips yet. When you take a ride, you can rate your driver and view trip summaries here."
                        : "No trips recorded in this category."}
                    </p>
                    {onSelectTab && (
                      <LiquidGlassButton
                        scale={0.9}
                        onClick={() => onSelectTab('ride')}
                        style={{ background: 'rgba(99, 102, 241, 0.35)', color: '#ffffff' }}
                      >
                        Find a Carpool Ride →
                      </LiquidGlassButton>
                    )}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {filteredBookings.map((b) => {
                      const driverRating = Number(b.ride?.driver?.averageRating || 5.0).toFixed(1);
                      const driverRatingCount = b.ride?.driver?.ratingCount ?? 0;
                      const isRated = ratedBookings[b.bookingId];
                      const departureDateStr = b.ride?.departureTime
                        ? new Date(b.ride.departureTime).toLocaleDateString([], {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })
                        : 'Scheduled Date';
                      const departureTimeStr = b.ride?.departureTime
                        ? new Date(b.ride.departureTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : '';

                      return (
                        <div
                          key={b.bookingId}
                          style={{
                            background: 'rgba(255, 255, 255, 0.035)',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            borderRadius: '16px',
                            padding: '16px 20px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '12px',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '15px', fontWeight: 700, color: '#ffffff' }}>
                                  {b.ride?.source || 'Origin'} → {b.ride?.destination || 'Destination'}
                                </span>
                                <span
                                  style={{
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    padding: '2px 9px',
                                    borderRadius: '9999px',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.04em',
                                    background:
                                      b.status === 'COMPLETED'
                                        ? 'rgba(34, 197, 94, 0.15)'
                                        : b.status === 'CANCELLED'
                                        ? 'rgba(239, 68, 68, 0.15)'
                                        : b.status === 'CONFIRMED'
                                        ? 'rgba(99, 102, 241, 0.15)'
                                        : 'rgba(250, 204, 21, 0.15)',
                                    color:
                                      b.status === 'COMPLETED'
                                        ? '#4ade80'
                                        : b.status === 'CANCELLED'
                                        ? '#f87171'
                                        : b.status === 'CONFIRMED'
                                        ? '#818cf8'
                                        : '#fde047',
                                    border:
                                      b.status === 'COMPLETED'
                                        ? '1px solid rgba(34, 197, 94, 0.3)'
                                        : b.status === 'CANCELLED'
                                        ? '1px solid rgba(239, 68, 68, 0.3)'
                                        : '1px solid rgba(99, 102, 241, 0.3)',
                                  }}
                                >
                                  {b.status}
                                </span>
                              </div>

                              <div style={{ fontSize: '12.5px', color: 'rgba(255, 255, 255, 0.65)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                <span>🕒 {departureDateStr} {departureTimeStr && `at ${departureTimeStr}`}</span>
                                <span>• {b.seatsBooked || 1} seat{b.seatsBooked > 1 ? 's' : ''}</span>
                                {b.pickupPoint && <span>• Pickup: {b.pickupPoint}</span>}
                              </div>
                            </div>

                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: '18px', fontWeight: 800, color: '#ffffff' }}>
                                ₹{b.totalAmount}
                              </div>
                              <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.45)' }}>
                                {b.paymentStatus || 'Payment Verified'}
                              </div>
                            </div>
                          </div>

                          {/* Driver Info & Actions */}
                          <div
                            style={{
                              background: 'rgba(0, 0, 0, 0.25)',
                              borderRadius: '12px',
                              padding: '10px 14px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              flexWrap: 'wrap',
                              gap: '10px',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <div
                                style={{
                                  width: '32px',
                                  height: '32px',
                                  borderRadius: '50%',
                                  background: 'rgba(99, 102, 241, 0.3)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: '#ffffff',
                                  fontSize: '13px',
                                  fontWeight: 600,
                                }}
                              >
                                {b.ride?.driver?.name ? b.ride.driver.name.charAt(0).toUpperCase() : 'D'}
                              </div>
                              <div>
                                <div style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span>Driver: {b.ride?.driver?.name || 'Verified Rydora Driver'}</span>
                                  <span
                                    style={{
                                      background: 'rgba(250, 204, 21, 0.15)',
                                      color: '#fde047',
                                      padding: '1px 6px',
                                      borderRadius: '6px',
                                      fontSize: '11px',
                                      fontWeight: 600,
                                    }}
                                  >
                                    ★ {driverRating} {driverRatingCount > 0 ? `(${driverRatingCount})` : ''}
                                  </span>
                                </div>
                                {b.ride?.driver?.phone && (
                                  <div style={{ fontSize: '11.5px', color: 'rgba(255, 255, 255, 0.55)', marginTop: '2px' }}>
                                    Contact: {b.ride.driver.phone}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Ride Action Controls */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              {['PENDING', 'CONFIRMED'].includes(b.status) && (
                                <button
                                  type="button"
                                  onClick={() => handleCancelBooking(b.bookingId)}
                                  style={{
                                    background: 'rgba(239, 68, 68, 0.12)',
                                    border: '1px solid rgba(239, 68, 68, 0.28)',
                                    borderRadius: '9999px',
                                    padding: '5px 12px',
                                    color: '#f87171',
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                  }}
                                >
                                  Cancel Booking
                                </button>
                              )}

                              {b.status === 'CANCELLED' && (
                                <button
                                  type="button"
                                  onClick={() => handleRequestRefund(b.bookingId)}
                                  style={{
                                    background: 'rgba(56, 189, 248, 0.15)',
                                    border: '1px solid rgba(56, 189, 248, 0.35)',
                                    borderRadius: '9999px',
                                    padding: '5px 12px',
                                    color: '#38bdf8',
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                  }}
                                >
                                  Request Refund
                                </button>
                              )}

                              {b.status === 'COMPLETED' && (
                                <>
                                  {isRated ? (
                                    <span
                                      style={{
                                        background: 'rgba(34, 197, 94, 0.15)',
                                        border: '1px solid rgba(34, 197, 94, 0.35)',
                                        color: '#86efac',
                                        fontSize: '11.5px',
                                        fontWeight: 600,
                                        padding: '4px 10px',
                                        borderRadius: '9999px',
                                      }}
                                    >
                                      ✓ You Rated ★ {isRated.score || 5}
                                    </span>
                                  ) : ratingBookingId !== b.bookingId ? (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setRatingBookingId(b.bookingId);
                                        setRatingScore(5);
                                        setRatingComment('');
                                      }}
                                      style={{
                                        background: 'rgba(250, 204, 21, 0.15)',
                                        border: '1px solid rgba(250, 204, 21, 0.35)',
                                        borderRadius: '9999px',
                                        padding: '5px 12px',
                                        color: '#fde047',
                                        fontSize: '12px',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                      }}
                                    >
                                      Rate Driver ★
                                    </button>
                                  ) : null}
                                </>
                              )}
                            </div>
                          </div>

                          {/* Interactive Rating Form for Completed Ride */}
                          {b.status === 'COMPLETED' && ratingBookingId === b.bookingId && !isRated && (
                            <div
                              style={{
                                background: 'rgba(0, 0, 0, 0.35)',
                                borderRadius: '14px',
                                border: '1px solid rgba(250, 204, 21, 0.25)',
                                padding: '14px 16px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '10px',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                                <span style={{ fontSize: '13px', fontWeight: 600, color: '#fde047' }}>
                                  Rate your experience with {b.ride?.driver?.name || 'the driver'}:
                                </span>
                                <div style={{ display: 'flex', gap: '4px' }}>
                                  {[1, 2, 3, 4, 5].map((star) => (
                                    <button
                                      key={star}
                                      type="button"
                                      onClick={() => setRatingScore(star)}
                                      style={{
                                        background: 'transparent',
                                        border: 'none',
                                        color: star <= ratingScore ? '#fde047' : 'rgba(255, 255, 255, 0.2)',
                                        fontSize: '22px',
                                        cursor: 'pointer',
                                        padding: '0 2px',
                                        lineHeight: 1,
                                      }}
                                    >
                                      ★
                                    </button>
                                  ))}
                                </div>
                              </div>

                              <input
                                type="text"
                                placeholder="Optional review comment (e.g., Safe driver, smooth carpool trip)..."
                                value={ratingComment}
                                onChange={(e) => setRatingComment(e.target.value)}
                                style={{
                                  background: 'rgba(255, 255, 255, 0.08)',
                                  border: '1px solid rgba(255, 255, 255, 0.16)',
                                  borderRadius: '10px',
                                  padding: '8px 12px',
                                  color: '#ffffff',
                                  fontSize: '13px',
                                  outline: 'none',
                                }}
                              />

                              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
                                <button
                                  type="button"
                                  onClick={() => setRatingBookingId(null)}
                                  style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'rgba(255, 255, 255, 0.6)',
                                    fontSize: '12px',
                                    cursor: 'pointer',
                                    padding: '6px 12px',
                                  }}
                                >
                                  Cancel
                                </button>
                                <LiquidGlassButton
                                  scale={0.88}
                                  disabled={submittingRating}
                                  onClick={() => handleSubmitRating(b.bookingId, b.ride?.driver?.name)}
                                  style={{
                                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                                    color: '#ffffff',
                                    border: 'none',
                                  }}
                                >
                                  {submittingRating ? 'Saving...' : 'Submit Rating'}
                                </LiquidGlassButton>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </LiquidGlassPanel>
        </div>

        {/* Right Column: Safety & Emergency Contacts */}
        <div style={{ minWidth: 0 }}>
          <LiquidGlassPanel
            radius={24}
            frosted={true}
            style={{
              padding: 'clamp(20px, 3.5vw, 24px)',
              background: 'rgba(18, 16, 32, 0.7)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div>
                <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#ffffff', margin: '0 0 2px 0' }}>
                  Emergency Contacts
                </h3>
                <p style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.6)', margin: 0 }}>
                  Notified automatically when SOS is activated.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowAddContact((prev) => !prev)}
                style={{
                  background: 'rgba(99, 102, 241, 0.25)',
                  border: '1px solid rgba(99, 102, 241, 0.4)',
                  borderRadius: '9999px',
                  color: '#c7d2fe',
                  fontSize: '11.5px',
                  fontWeight: 600,
                  padding: '4px 10px',
                  cursor: 'pointer',
                }}
              >
                {showAddContact ? 'Cancel' : '+ Add Contact'}
              </button>
            </div>

            {contactMsg && (
              <div style={{ fontSize: '12px', color: '#86efac', marginBottom: '12px' }}>
                {contactMsg}
              </div>
            )}

            {/* Add Contact Form */}
            {showAddContact && (
              <form
                onSubmit={handleAddContact}
                style={{
                  background: 'rgba(0, 0, 0, 0.25)',
                  padding: '12px',
                  borderRadius: '12px',
                  marginBottom: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <input
                  type="text"
                  required
                  placeholder="Full Name (e.g. Rahul Sharma)"
                  value={newContact.name}
                  onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                  style={{
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '8px',
                    padding: '8px 10px',
                    color: '#ffffff',
                    fontSize: '12.5px',
                    outline: 'none',
                  }}
                />
                <input
                  type="tel"
                  required
                  placeholder="Phone (e.g. +91 9876543210)"
                  value={newContact.phone}
                  onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                  style={{
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '8px',
                    padding: '8px 10px',
                    color: '#ffffff',
                    fontSize: '12.5px',
                    outline: 'none',
                  }}
                />
                <select
                  value={newContact.relationship}
                  onChange={(e) => setNewContact({ ...newContact, relationship: e.target.value })}
                  style={{
                    background: 'rgba(30, 27, 50, 0.9)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '8px',
                    padding: '8px 10px',
                    color: '#ffffff',
                    fontSize: '12.5px',
                    outline: 'none',
                  }}
                >
                  <option value="Family">Family Member</option>
                  <option value="Parent">Parent</option>
                  <option value="Spouse">Spouse</option>
                  <option value="Friend">Friend</option>
                  <option value="Colleague">Colleague</option>
                </select>
                <button
                  type="submit"
                  style={{
                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#ffffff',
                    padding: '8px',
                    fontSize: '12.5px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Save Emergency Contact
                </button>
              </form>
            )}

            {/* Contacts List */}
            {loadingContacts ? (
              <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.5)' }}>Loading contacts...</div>
            ) : contacts.length === 0 ? (
              <div style={{ fontSize: '12.5px', color: 'rgba(255, 255, 255, 0.55)', padding: '12px 0' }}>
                No emergency contacts added yet. Add trusted contacts so they can be notified in an emergency.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {contacts.map((c) => (
                  <div
                    key={c.contactId}
                    style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      borderRadius: '10px',
                      padding: '10px 12px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff' }}>
                        {c.name}
                        <span style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.5)', marginLeft: '6px' }}>
                          ({c.relationship})
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.7)', marginTop: '2px' }}>
                        {c.phone}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteContact(c.contactId)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#f87171',
                        fontSize: '13px',
                        cursor: 'pointer',
                        padding: '4px',
                      }}
                      title="Remove contact"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </LiquidGlassPanel>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
