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
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'active' | 'completed' | 'cancelled'
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [actionMsg, setActionMsg] = useState('');

  // Rating State
  const [ratingBookingId, setRatingBookingId] = useState(null);
  const [ratingScore, setRatingScore] = useState(5);
  const [ratingComment, setRatingComment] = useState('');
  const [submittingRating, setSubmittingRating] = useState(false);
  const [ratedBookings, setRatedBookings] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('rydora_rated_bookings') || '{}');
    } catch {
      return {};
    }
  });

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

  const isDriver = Boolean(user && (user.roles?.includes('DRIVER') || user.driverVerified));

  const fetchBookings = async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setErrorMsg('');
      const apiFn = api.bookings?.getMyBookings || api.rides?.getMyBookings;
      const res = await apiFn();
      const list = Array.isArray(res) ? res : (res?.bookings || []);
      setBookings(list);
    } catch (err) {
      setErrorMsg(err.message || 'Unable to load your ride history.');
    } finally {
      setLoading(false);
    }
  };

  const fetchContacts = async () => {
    if (!user) return;
    try {
      setLoadingContacts(true);
      const apiFn = api.safety?.getEmergencyContacts || api.sos?.getEmergencyContacts;
      const res = await apiFn();
      const list = Array.isArray(res) ? res : (res?.contacts || []);
      setContacts(list);
    } catch {
      // Non-blocking
    } finally {
      setLoadingContacts(false);
    }
  };

  useEffect(() => {
    fetchBookings();
    fetchContacts();

    if (user) {
      // Poll every 5s so bookings and ratings stay in sync with the database in real time
      const pollInterval = setInterval(() => {
        const apiFn = api.bookings?.getMyBookings || api.rides?.getMyBookings;
        if (apiFn) {
          apiFn()
            .then((res) => {
              const list = Array.isArray(res) ? res : (res?.bookings || []);
              setBookings(list);
            })
            .catch(() => {});
        }
      }, 5000);

      return () => clearInterval(pollInterval);
    }
  }, [user]);

  const handleCancelBooking = async (bookingId) => {
    if (!window.confirm('Are you sure you want to cancel this booking?')) return;
    try {
      setActionMsg('Cancelling booking...');
      const cancelFn = api.bookings?.cancel || api.rides?.cancelBooking;
      await cancelFn(bookingId, 'Passenger requested cancellation');
      setActionMsg('Booking cancelled successfully.');
      setTimeout(() => setActionMsg(''), 4000);
      fetchBookings();
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
      fetchBookings();
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
      try {
        localStorage.setItem('rydora_rated_bookings', JSON.stringify(updated));
      } catch {}

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

  const handleAddContact = async (e) => {
    e.preventDefault();
    if (!newContact.name.trim() || !newContact.phone.trim()) return;
    try {
      setContactMsg('Adding contact...');
      await api.sos.addEmergencyContact(newContact);
      setNewContact({ name: '', phone: '', relationship: 'Family' });
      setShowAddContact(false);
      setContactMsg('Emergency contact added.');
      setTimeout(() => setContactMsg(''), 3500);
      fetchContacts();
    } catch (err) {
      setContactMsg(err.message || 'Failed to add emergency contact.');
      setTimeout(() => setContactMsg(''), 4000);
    }
  };

  const handleDeleteContact = async (contactId) => {
    try {
      await api.sos.deleteEmergencyContact(contactId);
      setContacts((prev) => prev.filter((c) => c.contactId !== contactId));
      setContactMsg('Emergency contact removed.');
      setTimeout(() => setContactMsg(''), 3000);
    } catch (err) {
      setContactMsg(err.message || 'Failed to delete contact.');
      setTimeout(() => setContactMsg(''), 3500);
    }
  };

  // Filter bookings according to activeTab
  const activeBookings = bookings.filter((b) => ['PENDING', 'CONFIRMED'].includes(b.status));
  const completedBookings = bookings.filter((b) => b.status === 'COMPLETED');
  const cancelledBookings = bookings.filter((b) => b.status === 'CANCELLED');

  let filteredBookings = bookings;
  if (activeTab === 'active') filteredBookings = activeBookings;
  else if (activeTab === 'completed') filteredBookings = completedBookings;
  else if (activeTab === 'cancelled') filteredBookings = cancelledBookings;

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
              Access your complete ride history, check driver ratings, manage wallet balance, and update safety contacts.
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
                background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '26px',
                fontWeight: 700,
                color: '#ffffff',
                boxShadow: '0 8px 24px rgba(99, 102, 241, 0.4)',
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
                  ★ {userRating} {userRatingCount > 0 ? `(${userRatingCount} reviews)` : '(New)'}
                </span>
              </div>
            </div>
          </div>

          {/* Right: Wallet Balance & Quick Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '16px',
                padding: '12px 18px',
                textAlign: 'right',
                minWidth: '130px',
              }}
            >
              <div style={{ fontSize: '11.5px', color: 'rgba(255, 255, 255, 0.55)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
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
            background: actionMsg.includes('Thank you') || actionMsg.includes('successfully')
              ? 'rgba(34, 197, 94, 0.15)'
              : 'rgba(99, 102, 241, 0.15)',
            border: actionMsg.includes('Thank you') || actionMsg.includes('successfully')
              ? '1px solid rgba(34, 197, 94, 0.35)'
              : '1px solid rgba(99, 102, 241, 0.35)',
            color: actionMsg.includes('Thank you') || actionMsg.includes('successfully') ? '#86efac' : '#c7d2fe',
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

      {/* 2. Main Two-Column Layout: Rides History (Left 65%) + Safety Contacts (Right 35%) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', gap: '24px', alignItems: 'start' }}>
        {/* Left Column: Full Rides History & Rate Management */}
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
            {/* Header & Tabs */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', marginBottom: '20px' }}>
              <div>
                <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#ffffff', margin: '0 0 4px 0' }}>
                  Ride History & Reviews
                </h2>
                <p style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.6)', margin: 0 }}>
                  View all scheduled, past, and cancelled carpools along with driver ratings.
                </p>
              </div>

              {/* Filter Tabs */}
              <div style={{ display: 'flex', background: 'rgba(255, 255, 255, 0.06)', borderRadius: '12px', padding: '3px', gap: '4px' }}>
                {[
                  { id: 'all', label: `All (${bookings.length})` },
                  { id: 'active', label: `Active (${activeBookings.length})` },
                  { id: 'completed', label: `Past (${completedBookings.length})` },
                  { id: 'cancelled', label: `Cancelled (${cancelledBookings.length})` },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setActiveTab(t.id)}
                    style={{
                      background: activeTab === t.id ? 'rgba(99, 102, 241, 0.4)' : 'transparent',
                      border: activeTab === t.id ? '1px solid rgba(129, 140, 248, 0.4)' : 'none',
                      borderRadius: '9px',
                      padding: '6px 12px',
                      color: activeTab === t.id ? '#ffffff' : 'rgba(255, 255, 255, 0.65)',
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
            </div>

            {/* Bookings List */}
            {loading ? (
              <div style={{ textAlign: 'center', padding: '36px 0', color: 'rgba(255, 255, 255, 0.6)', fontSize: '14px' }}>
                Loading your ride history...
              </div>
            ) : filteredBookings.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 16px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '16px', border: '1px dashed rgba(255, 255, 255, 0.12)' }}>
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>🚗</div>
                <div style={{ fontSize: '15px', fontWeight: 600, color: '#ffffff', marginBottom: '4px' }}>
                  No {activeTab !== 'all' ? activeTab : ''} rides found
                </div>
                <p style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.55)', maxWidth: '400px', margin: '0 auto 16px' }}>
                  {activeTab === 'active'
                    ? "You don't have any upcoming trips scheduled. Book a carpool from the Ride page anytime!"
                    : activeTab === 'completed'
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
                        transition: 'border-color 0.2s ease',
                      }}
                    >
                      {/* Top Row: Route, Status, Price */}
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

                      {/* Middle Row: Driver Info with Driver Rating */}
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
                          {/* Cancel button for active bookings */}
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
                                transition: 'all 0.15s ease',
                              }}
                            >
                              Cancel Booking
                            </button>
                          )}

                          {/* Request Refund button for cancelled bookings */}
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

                          {/* Rate Driver button for completed bookings */}
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
                                    transition: 'all 0.15s ease',
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
                                    transition: 'transform 0.1s ease',
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
