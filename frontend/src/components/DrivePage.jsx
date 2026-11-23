import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { LiquidGlassPanel } from './ui/LiquidGlassPanel';
import { LiquidGlassButton } from './ui/LiquidGlassButton';
import {
  IconCar,
  IconClock,
  IconCheck,
  IconShield,
  IconArrowRight,
  IconQrCode,
  IconNavigation,
  IconSliders,
  IconZap,
} from './Icons';

export const DrivePage = ({ user, onSignUpClick, onLoginClick }) => {
  const [weeklyHours, setWeeklyHours] = useState(30);

  // Driver Pipeline & Dashboard State
  const [licenseNumber, setLicenseNumber] = useState('');
  const [licenseExpiry, setLicenseExpiry] = useState('');
  const [verifLoading, setVerifLoading] = useState(false);
  const [verifMessage, setVerifMessage] = useState('');
  const [driverEarnings, setDriverEarnings] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [showVehicleForm, setShowVehicleForm] = useState(false);
  const [vehicleData, setVehicleData] = useState({
    vehicleType: 'Sedan',
    make: 'Hyundai',
    model: 'Verna',
    registrationNumber: '',
    color: 'Silver',
    seatCapacity: 4,
  });

  // Carpool Ride Publishing & Manifest State
  const [driverRides, setDriverRides] = useState([]);
  const [communities, setCommunities] = useState([]);
  const [showRideForm, setShowRideForm] = useState(false);
  const [ridePublishMsg, setRidePublishMsg] = useState('');
  const [ridePublishError, setRidePublishError] = useState('');
  const [rideSubmitting, setRideSubmitting] = useState(false);
  const getInitialDepartureTime = () => {
    const d = new Date(Date.now() + 2 * 3600 * 1000);
    const tzOffset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
  };

  const [newRide, setNewRide] = useState({
    vehicleId: '',
    source: '',
    destination: '',
    departureTime: getInitialDepartureTime(),
    totalSeats: 3,
    farePerSeat: 150,
  });
  const [expandedManifestRideId, setExpandedManifestRideId] = useState(null);
  const [manifestMap, setManifestMap] = useState({});
  const [manifestLoading, setManifestLoading] = useState(false);
  const [manifestActionLoading, setManifestActionLoading] = useState(null);
  const [manifestActionMsg, setManifestActionMsg] = useState('');

  const isDriver = user?.roles?.includes('DRIVER') || user?.driverVerified;

  useEffect(() => {
    if (user && isDriver) {
      api.driver
        .getEarnings()
        .then((data) => setDriverEarnings(data))
        .catch(() => {});
      api.driver
        .getVehicles()
        .then((data) => {
          const list = Array.isArray(data) ? data : (data?.vehicles || []);
          setVehicles(list);
          if (list.length > 0) {
            setNewRide((prev) => ({ ...prev, vehicleId: prev.vehicleId || list[0].vehicleId }));
          }
        })
        .catch(() => {});
      api.rides
        .getDriverRides()
        .then((data) => {
          const list = Array.isArray(data) ? data : (data?.rides || []);
          setDriverRides(list);
        })
        .catch(() => {});
      api.communities
        .list()
        .then((data) => {
          const commList = Array.isArray(data) ? data : (data?.communities || data?.items || []);
          setCommunities(commList);
          if (commList.length > 0) {
            setNewRide((prev) => ({ ...prev, communityId: prev.communityId || commList[0].communityId }));
          }
        })
        .catch(() => {});
    }
  }, [user, isDriver]);

  const handleSubmitVerification = async (e) => {
    e.preventDefault();
    if (!licenseNumber.trim() || !licenseExpiry) return;
    setVerifLoading(true);
    setVerifMessage('');
    try {
      await api.driver.submitVerification(
        licenseNumber.trim(),
        new Date(licenseExpiry).toISOString()
      );
      // Immediately refresh user state to acquire DRIVER role in real time
      const freshUser = await api.auth.getMe();
      if (freshUser) {
        window.location.reload();
      } else {
        setVerifMessage('Driving licence activated successfully! You can now publish carpool rides.');
      }
    } catch (err) {
      setVerifMessage(
        err.response?.data?.error?.message ||
          'Submission failed. Please check licence details and future expiry date.'
      );
    } finally {
      setVerifLoading(false);
    }
  };

  const handleRegisterVehicle = async (e) => {
    e.preventDefault();
    try {
      await api.driver.registerVehicle(vehicleData);
      alert('Vehicle registered successfully!');
      setShowVehicleForm(false);
      const v = await api.driver.getVehicles();
      const list = Array.isArray(v) ? v : (v?.vehicles || []);
      setVehicles(list);
      if (list.length > 0) {
        setNewRide((prev) => ({ ...prev, vehicleId: list[0].vehicleId }));
      }
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Could not register vehicle.');
    }
  };

  const handlePublishRide = async (e) => {
    e.preventDefault();
    if (!newRide.source.trim() || !newRide.destination.trim() || !newRide.departureTime || !newRide.vehicleId) {
      setRidePublishError('Please specify pickup point, destination, departure time, and vehicle.');
      return;
    }

    const depDate = new Date(newRide.departureTime);
    if (isNaN(depDate.getTime()) || depDate.getTime() <= Date.now() - 30000) {
      setRidePublishError('Departure time must be set to a future date and time.');
      return;
    }

    setRideSubmitting(true);
    setRidePublishError('');
    setRidePublishMsg('');
    try {
      await api.rides.publish({
        vehicleId: newRide.vehicleId,
        source: newRide.source.trim(),
        destination: newRide.destination.trim(),
        departureTime: depDate.toISOString(),
        totalSeats: Number(newRide.totalSeats),
        farePerSeat: Number(newRide.farePerSeat),
      });

      setRidePublishMsg('Carpool ride published successfully! Available for riders to book.');
      setShowRideForm(false);
      setNewRide((prev) => ({
        ...prev,
        source: '',
        destination: '',
        departureTime: getInitialDepartureTime(),
      }));
      const updatedRides = await api.rides.getDriverRides();
      setDriverRides(Array.isArray(updatedRides) ? updatedRides : (updatedRides?.rides || []));
    } catch (err) {
      const errMsg =
        err.response?.data?.error?.message ||
        err.response?.data?.error?.details?.[0]?.message ||
        'Could not publish carpool ride.';
      setRidePublishError(errMsg);
    } finally {
      setRideSubmitting(false);
    }
  };

  const handleToggleManifest = async (rideId) => {
    if (expandedManifestRideId === rideId) {
      setExpandedManifestRideId(null);
      return;
    }
    setExpandedManifestRideId(rideId);
    setManifestLoading(true);
    setManifestActionMsg('');
    try {
      const res = await api.bookings.getRideManifest(rideId);
      const bookings = Array.isArray(res) ? res : (res?.bookings || []);
      setManifestMap((prev) => ({ ...prev, [rideId]: bookings }));
    } catch (err) {
      setManifestActionMsg(err.response?.data?.error?.message || 'Could not fetch passenger manifest.');
    } finally {
      setManifestLoading(false);
    }
  };

  const handleApproveBooking = async (rideId, bookingId) => {
    setManifestActionLoading(bookingId);
    setManifestActionMsg('');
    try {
      await api.bookings.approve(bookingId);
      setManifestActionMsg('Passenger booking approved! Seat confirmed.');
      const res = await api.bookings.getRideManifest(rideId);
      const bookings = Array.isArray(res) ? res : (res?.bookings || []);
      setManifestMap((prev) => ({ ...prev, [rideId]: bookings }));
      const updatedRides = await api.rides.getDriverRides();
      setDriverRides(Array.isArray(updatedRides) ? updatedRides : (updatedRides?.rides || []));
    } catch (err) {
      setManifestActionMsg(err.response?.data?.error?.message || 'Failed to approve booking.');
    } finally {
      setManifestActionLoading(null);
    }
  };

  const handleRejectBooking = async (rideId, bookingId) => {
    if (!confirm('Decline this passenger seat reservation?')) return;
    setManifestActionLoading(bookingId);
    setManifestActionMsg('');
    try {
      await api.bookings.reject(bookingId, 'Driver schedule or seat limitation');
      setManifestActionMsg('Passenger reservation declined.');
      const res = await api.bookings.getRideManifest(rideId);
      const bookings = Array.isArray(res) ? res : (res?.bookings || []);
      setManifestMap((prev) => ({ ...prev, [rideId]: bookings }));
      const updatedRides = await api.rides.getDriverRides();
      setDriverRides(Array.isArray(updatedRides) ? updatedRides : (updatedRides?.rides || []));
    } catch (err) {
      setManifestActionMsg(err.response?.data?.error?.message || 'Failed to decline booking.');
    } finally {
      setManifestActionLoading(null);
    }
  };

  const handleCancelDriverRide = async (rideId) => {
    if (!confirm('Are you sure you want to cancel this entire scheduled ride?')) return;
    try {
      await api.rides.cancel(rideId);
      alert('Ride cancelled successfully.');
      const updatedRides = await api.rides.getDriverRides();
      setDriverRides(Array.isArray(updatedRides) ? updatedRides : (updatedRides?.rides || []));
    } catch (err) {
      alert(err.response?.data?.error?.message || 'Could not cancel ride.');
    }
  };

  // Hourly base rate in ₹
  const hourlyRate = 620;
  const estimatedWeekly = weeklyHours * hourlyRate;
  const estimatedMonthly = estimatedWeekly * 4.2;

  const driverPerks = [
    {
      icon: <IconZap size={24} color="#ffffff" />,
      title: 'Daily Instant Payouts',
      description:
        'Transfer your trip earnings to your bank account instantly at any hour. No waiting for weekly payouts.',
    },
    {
      icon: <IconClock size={24} color="#ffffff" />,
      title: 'Total Schedule Freedom',
      description:
        'No fixed shifts, no bosses. Log on when it suits you—drive 2 hours after work or make it full-time.',
    },
    {
      icon: <IconShield size={24} color="#ffffff" />,
      title: 'Active Trip Insurance',
      description:
        'Comprehensive accident cover and 24/7 medical assistance provided on every active trip for you and your vehicle.',
    },
    {
      icon: <IconSliders size={24} color="#ffffff" />,
      title: 'Transparent Platform Fee',
      description:
        'Clear, upfront earnings breakdown with no hidden cuts or surprise deductions on your statements.',
    },
  ];

  const steps = [
    {
      num: '01',
      title: 'Register Online',
      desc: 'Submit your driving license, vehicle registration, and ID proof in under 5 minutes.',
    },
    {
      num: '02',
      title: 'Quick Verification',
      desc: 'Our team verifies your documents and performs a swift vehicle safety check within 24 hours.',
    },
    {
      num: '03',
      title: 'Hit the Road',
      desc: 'Turn on Driver mode in the app, accept your first passenger request, and start earning.',
    },
  ];

  const vehicleCategories = [
    {
      type: 'Sedan & Hatchback',
      badge: 'Most Popular',
      desc: '4 doors, working AC, 2014 or newer. Ideal for daily city trips and airport runs.',
      minEarning: '₹22,000 / week',
    },
    {
      type: 'Premier & XL',
      badge: 'High Fare',
      desc: 'Spacious 6-seaters and premium sedans. Earn higher fares on group & executive bookings.',
      minEarning: '₹34,000 / week',
    },
    {
      type: 'Motorbike & Moto',
      badge: 'Fastest Onboarding',
      desc: 'Valid 2-wheeler license, helmet, and vehicle documents. Zip through traffic easily.',
      minEarning: '₹14,000 / week',
    },
  ];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'clamp(36px, 5vw, 72px)',
        paddingTop: 'clamp(10px, 2vw, 24px)',
      }}
    >
      {/* 1. Drive Hero Section */}
      <section className="rs-section">
        <LiquidGlassPanel
          radius={32}
          frosted={true}
          style={{
            padding: 0,
            overflow: 'hidden',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))',
            alignItems: 'stretch',
          }}
        >
          {/* Left: Copy & Call to Action */}
          <div
            style={{
              padding: 'clamp(28px, 5vw, 56px)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              boxSizing: 'border-box',
            }}
          >
            <span
              style={{
                fontSize: '12px',
                fontWeight: 600,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: 'rgba(255, 255, 255, 0.6)',
                marginBottom: '12px',
                display: 'block',
              }}
            >
              Drive with RideShare
            </span>

            <h1
              style={{
                fontSize: 'clamp(32px, 4.5vw, 52px)',
                fontWeight: 800,
                color: '#ffffff',
                margin: '0 0 16px 0',
                letterSpacing: '-0.03em',
                lineHeight: 1.1,
              }}
            >
              Drive on your schedule. <br />
              <span
                style={{
                  background: 'linear-gradient(135deg, #a78bfa, #c084fc)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                Earn on your terms.
              </span>
            </h1>

            <p
              style={{
                fontSize: 'clamp(15px, 2vw, 17px)',
                color: 'rgba(255, 255, 255, 0.75)',
                margin: '0 0 32px 0',
                lineHeight: 1.55,
                maxWidth: '520px',
              }}
            >
              Whether you want to supplement your income or drive full-time, RideShare gives you
              the freedom to work whenever you choose with daily payouts and round-the-clock support.
            </p>

            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
              {!user ? (
                <LiquidGlassButton
                  variant="primary"
                  scale={1}
                  onClick={onSignUpClick}
                  style={{ padding: '14px 28px', fontSize: '15px' }}
                >
                  Sign up to drive
                </LiquidGlassButton>
              ) : !isDriver ? (
                <a
                  href="#driver-onboarding-section"
                  style={{
                    color: '#ffffff',
                    textDecoration: 'none',
                    fontSize: '15px',
                    fontWeight: 600,
                    padding: '14px 28px',
                    borderRadius: '9999px',
                    background: 'rgba(99, 102, 241, 0.4)',
                    border: '1px solid rgba(129, 140, 248, 0.6)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  Activate Driver Account ↓
                </a>
              ) : (
                <a
                  href="#driver-onboarding-section"
                  style={{
                    color: '#ffffff',
                    textDecoration: 'none',
                    fontSize: '15px',
                    fontWeight: 600,
                    padding: '14px 28px',
                    borderRadius: '9999px',
                    background: 'rgba(34, 197, 94, 0.25)',
                    border: '1px solid rgba(74, 222, 128, 0.45)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  Manage Carpool Rides ↓
                </a>
              )}

              <a
                href="#earnings-calculator"
                style={{
                  color: 'rgba(255, 255, 255, 0.85)',
                  textDecoration: 'none',
                  fontSize: '15px',
                  fontWeight: 500,
                  padding: '12px 18px',
                  borderRadius: '9999px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'background 0.2s ease',
                }}
              >
                Estimate earnings ↓
              </a>
            </div>
          </div>

          {/* Right: Driver Car Visual */}
          <div
            style={{
              minHeight: 'clamp(260px, 35vw, 420px)',
              position: 'relative',
              background: 'linear-gradient(180deg, rgba(15,15,24,0.4), rgba(15,15,24,0.9))',
            }}
          >
            <img
              src="https://cdn-s3.autocarindia.com/Skoda/octavia-rs/101_Skoda_Octavia_RS.jpg"
              alt="Driver in modern car"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block',
              }}
            />
          </div>
        </LiquidGlassPanel>
      </section>

      {/* Driver Onboarding & Management Dashboard */}
      {user && (
        <section id="driver-onboarding-section" className="rs-section">
          <LiquidGlassPanel
            radius={28}
            frosted={true}
            style={{
              padding: 'clamp(24px, 4vw, 40px)',
              boxSizing: 'border-box',
              background: 'rgba(20, 16, 36, 0.65)',
            }}
          >
            {!isDriver ? (
              <div>
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    color: 'rgba(255, 255, 255, 0.6)',
                    display: 'block',
                    marginBottom: '8px',
                  }}
                >
                  Step 1 • Document Verification
                </span>
                <h2
                  style={{
                    fontSize: 'clamp(24px, 3.5vw, 32px)',
                    fontWeight: 700,
                    color: '#ffffff',
                    margin: '0 0 12px 0',
                    letterSpacing: '-0.025em',
                  }}
                >
                  Submit your Driving Licence
                </h2>
                <p
                  style={{
                    fontSize: '15px',
                    color: 'rgba(255, 255, 255, 0.72)',
                    margin: '0 0 24px 0',
                    maxWidth: '560px',
                  }}
                >
                  Enter your official driving licence number and future expiry date to begin verified driver onboarding.
                </p>

                {verifMessage && (
                  <div
                    style={{
                      padding: '12px 18px',
                      borderRadius: '16px',
                      background: verifMessage.includes('successfully')
                        ? 'rgba(34, 197, 94, 0.15)'
                        : 'rgba(239, 68, 68, 0.15)',
                      border: verifMessage.includes('successfully')
                        ? '1px solid rgba(34, 197, 94, 0.35)'
                        : '1px solid rgba(239, 68, 68, 0.35)',
                      color: verifMessage.includes('successfully') ? '#86efac' : '#fca5a5',
                      fontSize: '13.5px',
                      marginBottom: '20px',
                    }}
                  >
                    {verifMessage}
                  </div>
                )}

                <form
                  onSubmit={handleSubmitVerification}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))',
                    gap: '16px',
                    maxWidth: '640px',
                  }}
                >
                  <div>
                    <label style={{ fontSize: '12.5px', color: 'rgba(255, 255, 255, 0.7)', display: 'block', marginBottom: '6px' }}>
                      Licence Number
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. DL-04-2022-0012345"
                      value={licenseNumber}
                      onChange={(e) => setLicenseNumber(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        background: 'rgba(255, 255, 255, 0.08)',
                        border: '1px solid rgba(255, 255, 255, 0.16)',
                        borderRadius: '14px',
                        color: '#ffffff',
                        fontSize: '14.5px',
                        boxSizing: 'border-box',
                        outline: 'none',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '12.5px', color: 'rgba(255, 255, 255, 0.7)', display: 'block', marginBottom: '6px' }}>
                      Licence Expiry Date
                    </label>
                    <input
                      type="date"
                      required
                      value={licenseExpiry}
                      onChange={(e) => setLicenseExpiry(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        background: 'rgba(255, 255, 255, 0.08)',
                        border: '1px solid rgba(255, 255, 255, 0.16)',
                        borderRadius: '14px',
                        color: '#ffffff',
                        fontSize: '14.5px',
                        boxSizing: 'border-box',
                        outline: 'none',
                      }}
                    />
                  </div>

                  <div style={{ gridColumn: '1 / -1', marginTop: '6px' }}>
                    <LiquidGlassButton
                      scale={1}
                      disabled={verifLoading || !licenseNumber.trim() || !licenseExpiry}
                      style={{
                        height: '44px',
                        padding: '0 24px',
                        background: 'rgba(99, 102, 241, 0.35)',
                        border: '1px solid rgba(99, 102, 241, 0.5)',
                        color: '#ffffff',
                      }}
                    >
                      {verifLoading ? 'Submitting...' : 'Submit Licence Details →'}
                    </LiquidGlassButton>
                  </div>
                </form>
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', marginBottom: '24px' }}>
                  <div>
                    <span
                      style={{
                        fontSize: '11.5px',
                        fontWeight: 600,
                        letterSpacing: '0.1em',
                        textTransform: 'uppercase',
                        color: '#34d399',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: 'rgba(52, 211, 153, 0.15)',
                        padding: '4px 10px',
                        borderRadius: '9999px',
                        marginBottom: '8px',
                      }}
                    >
                      ✓ Verified Driver Status
                    </span>
                    <h2
                      style={{
                        fontSize: 'clamp(24px, 3.5vw, 32px)',
                        fontWeight: 700,
                        color: '#ffffff',
                        margin: '0 0 6px 0',
                        letterSpacing: '-0.025em',
                      }}
                    >
                      Driver Portal & Fleet
                    </h2>
                  </div>

                  <LiquidGlassButton
                    scale={0.9}
                    onClick={() => setShowVehicleForm((prev) => !prev)}
                    style={{ background: 'rgba(255, 255, 255, 0.1)' }}
                  >
                    {showVehicleForm ? 'Cancel Vehicle Entry' : '+ Register New Vehicle'}
                  </LiquidGlassButton>
                </div>

                {/* Earnings Summary Cards */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))',
                    gap: '16px',
                    marginBottom: '28px',
                  }}
                >
                  <div
                    style={{
                      background: 'rgba(255, 255, 255, 0.04)',
                      borderRadius: '18px',
                      padding: '20px',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                    }}
                  >
                    <span style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.6)' }}>Total Earnings</span>
                    <div style={{ fontSize: '26px', fontWeight: 800, color: '#ffffff', marginTop: '4px' }}>
                      ₹{driverEarnings?.summary?.netEarnings || '0.00'}
                    </div>
                  </div>

                  <div
                    style={{
                      background: 'rgba(255, 255, 255, 0.04)',
                      borderRadius: '18px',
                      padding: '20px',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                    }}
                  >
                    <span style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.6)' }}>Completed Trips</span>
                    <div style={{ fontSize: '26px', fontWeight: 800, color: '#a78bfa', marginTop: '4px' }}>
                      {driverEarnings?.summary?.completedTrips || 0}
                    </div>
                  </div>

                  <div
                    style={{
                      background: 'rgba(255, 255, 255, 0.04)',
                      borderRadius: '18px',
                      padding: '20px',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                    }}
                  >
                    <span style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.6)' }}>Registered Vehicles</span>
                    <div style={{ fontSize: '26px', fontWeight: 800, color: '#38bdf8', marginTop: '4px' }}>
                      {vehicles.length}
                    </div>
                  </div>
                </div>

                {/* Add Vehicle Form */}
                {showVehicleForm && (
                  <form
                    onSubmit={handleRegisterVehicle}
                    style={{
                      background: 'rgba(0, 0, 0, 0.3)',
                      borderRadius: '20px',
                      padding: '20px',
                      marginBottom: '28px',
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))',
                      gap: '14px',
                    }}
                  >
                    <div>
                      <label style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.7)', display: 'block', marginBottom: '4px' }}>
                        Vehicle Type
                      </label>
                      <select
                        value={vehicleData.vehicleType}
                        onChange={(e) => setVehicleData((prev) => ({ ...prev, vehicleType: e.target.value }))}
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          background: 'rgba(30, 27, 46, 0.95)',
                          border: '1px solid rgba(255, 255, 255, 0.16)',
                          borderRadius: '12px',
                          color: '#ffffff',
                          fontSize: '13.5px',
                          boxSizing: 'border-box',
                        }}
                      >
                        <option value="SEDAN">Sedan</option>
                        <option value="HATCHBACK">Hatchback</option>
                        <option value="SUV">SUV</option>
                        <option value="CAR">Car</option>
                        <option value="BIKE">Bike</option>
                        <option value="VAN">Van</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.7)', display: 'block', marginBottom: '4px' }}>
                        Make (Brand)
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Hyundai, Honda, Maruti"
                        value={vehicleData.make}
                        onChange={(e) => setVehicleData((prev) => ({ ...prev, make: e.target.value }))}
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          background: 'rgba(255, 255, 255, 0.08)',
                          border: '1px solid rgba(255, 255, 255, 0.16)',
                          borderRadius: '12px',
                          color: '#ffffff',
                          fontSize: '13.5px',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.7)', display: 'block', marginBottom: '4px' }}>
                        Model
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Verna, City, Swift"
                        value={vehicleData.model}
                        onChange={(e) => setVehicleData((prev) => ({ ...prev, model: e.target.value }))}
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          background: 'rgba(255, 255, 255, 0.08)',
                          border: '1px solid rgba(255, 255, 255, 0.16)',
                          borderRadius: '12px',
                          color: '#ffffff',
                          fontSize: '13.5px',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.7)', display: 'block', marginBottom: '4px' }}>
                        Registration Number
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. DL-01-AB-1234"
                        value={vehicleData.registrationNumber}
                        onChange={(e) => setVehicleData((prev) => ({ ...prev, registrationNumber: e.target.value.toUpperCase() }))}
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          background: 'rgba(255, 255, 255, 0.08)',
                          border: '1px solid rgba(255, 255, 255, 0.16)',
                          borderRadius: '12px',
                          color: '#ffffff',
                          fontSize: '13.5px',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.7)', display: 'block', marginBottom: '4px' }}>
                        Seat Capacity
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="8"
                        required
                        value={vehicleData.seatCapacity}
                        onChange={(e) => setVehicleData((prev) => ({ ...prev, seatCapacity: Number(e.target.value) }))}
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          background: 'rgba(255, 255, 255, 0.08)',
                          border: '1px solid rgba(255, 255, 255, 0.16)',
                          borderRadius: '12px',
                          color: '#ffffff',
                          fontSize: '13.5px',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>

                    <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
                      <LiquidGlassButton scale={0.9} variant="primary">
                        Save Vehicle to Fleet
                      </LiquidGlassButton>
                    </div>
                  </form>
                )}

                {/* Fleet List */}
                <div>
                  <h4 style={{ fontSize: '16px', fontWeight: 600, color: '#ffffff', margin: '0 0 12px 0' }}>
                    Active Vehicles in Your Fleet ({vehicles.length})
                  </h4>
                  {vehicles.length === 0 ? (
                    <div style={{ fontSize: '13.5px', color: 'rgba(255, 255, 255, 0.6)' }}>
                      No vehicles registered yet. Register your vehicle above to start publishing carpools.
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: '12px' }}>
                      {vehicles.map((vh) => (
                        <div
                          key={vh.vehicleId}
                          style={{
                            background: 'rgba(255, 255, 255, 0.04)',
                            borderRadius: '16px',
                            padding: '14px 18px',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                          }}
                        >
                          <div style={{ fontSize: '15px', fontWeight: 600, color: '#ffffff' }}>
                            {vh.make} {vh.model}
                          </div>
                          <div style={{ fontSize: '12.5px', color: 'rgba(255, 255, 255, 0.65)', marginTop: '2px' }}>
                            {vh.registrationNumber} • {vh.seatCapacity} seats • {vh.color || 'Standard'}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Carpool Ride Publishing Action Header */}
                <div
                  style={{
                    marginTop: '36px',
                    paddingTop: '28px',
                    borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '14px',
                  }}
                >
                  <div>
                    <h4 style={{ fontSize: '18px', fontWeight: 700, color: '#ffffff', margin: '0 0 4px 0' }}>
                      Publish Scheduled Carpool Ride
                    </h4>
                    <span style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.65)' }}>
                      Offer empty vehicle seats to riders within your verified community corridors.
                    </span>
                  </div>

                  <LiquidGlassButton
                    scale={0.9}
                    onClick={() => setShowRideForm((prev) => !prev)}
                    style={{
                      background: showRideForm ? 'rgba(239, 68, 68, 0.2)' : 'rgba(99, 102, 241, 0.35)',
                      border: showRideForm ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(99, 102, 241, 0.5)',
                      color: '#ffffff',
                    }}
                  >
                    {showRideForm ? 'Cancel Publish' : '+ Publish New Ride'}
                  </LiquidGlassButton>
                </div>

                {ridePublishMsg && (
                  <div
                    style={{
                      marginTop: '16px',
                      padding: '12px 18px',
                      borderRadius: '14px',
                      background: 'rgba(34, 197, 94, 0.15)',
                      border: '1px solid rgba(34, 197, 94, 0.35)',
                      color: '#86efac',
                      fontSize: '13.5px',
                    }}
                  >
                    {ridePublishMsg}
                  </div>
                )}

                {ridePublishError && (
                  <div
                    style={{
                      marginTop: '16px',
                      padding: '12px 18px',
                      borderRadius: '14px',
                      background: 'rgba(239, 68, 68, 0.15)',
                      border: '1px solid rgba(239, 68, 68, 0.35)',
                      color: '#fca5a5',
                      fontSize: '13.5px',
                    }}
                  >
                    {ridePublishError}
                  </div>
                )}

                {/* Ride Publishing Form */}
                {showRideForm && (
                  <form
                    onSubmit={handlePublishRide}
                    style={{
                      marginTop: '18px',
                      background: 'rgba(0, 0, 0, 0.35)',
                      borderRadius: '20px',
                      padding: '24px',
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))',
                      gap: '16px',
                    }}
                  >
                    <div>
                      <label style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.7)', display: 'block', marginBottom: '4px' }}>
                        Origin / Pickup Point
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. IIT Delhi, Hauz Khas"
                        value={newRide.source}
                        onChange={(e) => setNewRide((prev) => ({ ...prev, source: e.target.value }))}
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          background: 'rgba(255, 255, 255, 0.08)',
                          border: '1px solid rgba(255, 255, 255, 0.16)',
                          borderRadius: '12px',
                          color: '#ffffff',
                          fontSize: '13.5px',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.7)', display: 'block', marginBottom: '4px' }}>
                        Destination Point
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Cyber Hub, Gurugram"
                        value={newRide.destination}
                        onChange={(e) => setNewRide((prev) => ({ ...prev, destination: e.target.value }))}
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          background: 'rgba(255, 255, 255, 0.08)',
                          border: '1px solid rgba(255, 255, 255, 0.16)',
                          borderRadius: '12px',
                          color: '#ffffff',
                          fontSize: '13.5px',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.7)', display: 'block', marginBottom: '4px' }}>
                        Departure Time (Future)
                      </label>
                      <input
                        type="datetime-local"
                        required
                        min={new Date().toISOString().slice(0, 16)}
                        value={newRide.departureTime}
                        onChange={(e) => setNewRide((prev) => ({ ...prev, departureTime: e.target.value }))}
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          background: 'rgba(255, 255, 255, 0.08)',
                          border: '1px solid rgba(255, 255, 255, 0.16)',
                          borderRadius: '12px',
                          color: '#ffffff',
                          fontSize: '13.5px',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.7)', display: 'block', marginBottom: '4px' }}>
                        Vehicle
                      </label>
                      <select
                        required
                        value={newRide.vehicleId}
                        onChange={(e) => setNewRide((prev) => ({ ...prev, vehicleId: e.target.value }))}
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          background: 'rgba(30, 27, 46, 0.95)',
                          border: '1px solid rgba(255, 255, 255, 0.16)',
                          borderRadius: '12px',
                          color: '#ffffff',
                          fontSize: '13.5px',
                          boxSizing: 'border-box',
                        }}
                      >
                        {vehicles.length === 0 && <option value="">No vehicles registered</option>}
                        {vehicles.map((v) => (
                          <option key={v.vehicleId} value={v.vehicleId}>
                            {v.make} {v.model} ({v.registrationNumber}) - {v.seatCapacity} seats
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.7)', display: 'block', marginBottom: '4px' }}>
                        Available Seats Offered
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="8"
                        required
                        value={newRide.totalSeats}
                        onChange={(e) => setNewRide((prev) => ({ ...prev, totalSeats: Number(e.target.value) }))}
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          background: 'rgba(255, 255, 255, 0.08)',
                          border: '1px solid rgba(255, 255, 255, 0.16)',
                          borderRadius: '12px',
                          color: '#ffffff',
                          fontSize: '13.5px',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.7)', display: 'block', marginBottom: '4px' }}>
                        Fare Per Seat (₹)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="10000"
                        required
                        value={newRide.farePerSeat}
                        onChange={(e) => setNewRide((prev) => ({ ...prev, farePerSeat: Number(e.target.value) }))}
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          background: 'rgba(255, 255, 255, 0.08)',
                          border: '1px solid rgba(255, 255, 255, 0.16)',
                          borderRadius: '12px',
                          color: '#ffffff',
                          fontSize: '13.5px',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>

                    <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
                      <LiquidGlassButton
                        scale={0.92}
                        variant="primary"
                        disabled={rideSubmitting || vehicles.length === 0}
                      >
                        {rideSubmitting ? 'Publishing Ride...' : 'Confirm & Publish Ride'}
                      </LiquidGlassButton>
                    </div>
                  </form>
                )}

                {/* Published Driver Rides & Passenger Manifest Section */}
                <div style={{ marginTop: '36px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                    <h4 style={{ fontSize: '16px', fontWeight: 600, color: '#ffffff', margin: 0 }}>
                      Your Published Carpool Rides ({driverRides.length})
                    </h4>
                    {manifestActionMsg && (
                      <span style={{ fontSize: '12px', color: '#86efac' }}>{manifestActionMsg}</span>
                    )}
                  </div>

                  {driverRides.length === 0 ? (
                    <div style={{ fontSize: '13.5px', color: 'rgba(255, 255, 255, 0.6)' }}>
                      No rides published yet. Publish a carpool above to start accepting riders.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      {driverRides.map((ride) => {
                        const isExpanded = expandedManifestRideId === ride.rideId;
                        const manifest = manifestMap[ride.rideId] || [];
                        return (
                          <div
                            key={ride.rideId}
                            style={{
                              background: 'rgba(255, 255, 255, 0.04)',
                              borderRadius: '18px',
                              padding: '18px 20px',
                              border: '1px solid rgba(255, 255, 255, 0.08)',
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                              <div>
                                <div style={{ fontSize: '15px', fontWeight: 700, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span>{ride.source} → {ride.destination}</span>
                                  <span
                                    style={{
                                      fontSize: '11px',
                                      padding: '2px 8px',
                                      borderRadius: '9999px',
                                      fontWeight: 600,
                                      background:
                                        ride.status === 'SCHEDULED'
                                          ? 'rgba(56, 189, 248, 0.15)'
                                          : ride.status === 'COMPLETED'
                                          ? 'rgba(34, 197, 94, 0.15)'
                                          : 'rgba(239, 68, 68, 0.15)',
                                      color:
                                        ride.status === 'SCHEDULED'
                                          ? '#38bdf8'
                                          : ride.status === 'COMPLETED'
                                          ? '#4ade80'
                                          : '#f87171',
                                    }}
                                  >
                                    {ride.status}
                                  </span>
                                </div>
                                <div style={{ fontSize: '12.5px', color: 'rgba(255, 255, 255, 0.65)', marginTop: '4px' }}>
                                  Departure: {new Date(ride.departureTime).toLocaleString()} • {ride.availableSeats} of {ride.totalSeats} seats open • ₹{ride.farePerSeat}/seat
                                </div>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <LiquidGlassButton
                                  scale={0.84}
                                  onClick={() => handleToggleManifest(ride.rideId)}
                                  style={{
                                    background: isExpanded ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.06)',
                                    color: '#ffffff',
                                    padding: '0 14px',
                                  }}
                                >
                                  {isExpanded ? 'Hide Manifest ▲' : 'Passenger Manifest ▼'}
                                </LiquidGlassButton>

                                {ride.status === 'SCHEDULED' && (
                                  <button
                                    type="button"
                                    onClick={() => handleCancelDriverRide(ride.rideId)}
                                    style={{
                                      background: 'rgba(239, 68, 68, 0.12)',
                                      border: '1px solid rgba(239, 68, 68, 0.25)',
                                      borderRadius: '9999px',
                                      padding: '4px 10px',
                                      color: '#f87171',
                                      fontSize: '11px',
                                      cursor: 'pointer',
                                    }}
                                  >
                                    Cancel Ride
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Passenger Manifest Panel */}
                            {isExpanded && (
                              <div
                                style={{
                                  marginTop: '16px',
                                  paddingTop: '14px',
                                  borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                                }}
                              >
                                <div style={{ fontSize: '13px', fontWeight: 600, color: '#ffffff', marginBottom: '10px' }}>
                                  Passengers & Booking Manifest
                                </div>

                                {manifestLoading ? (
                                  <div style={{ fontSize: '12.5px', color: 'rgba(255, 255, 255, 0.6)' }}>
                                    Loading manifest...
                                  </div>
                                ) : manifest.length === 0 ? (
                                  <div style={{ fontSize: '12.5px', color: 'rgba(255, 255, 255, 0.5)' }}>
                                    No passengers have reserved seats on this ride yet.
                                  </div>
                                ) : (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {manifest.map((b) => (
                                      <div
                                        key={b.bookingId}
                                        style={{
                                          background: 'rgba(0, 0, 0, 0.25)',
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
                                          <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#ffffff' }}>
                                            {b.rider?.name || b.passenger?.name || 'Community Rider'}
                                            {b.rider?.phone && (
                                              <span style={{ fontSize: '12px', fontWeight: 400, color: 'rgba(255, 255, 255, 0.65)', marginLeft: '6px' }}>
                                                ({b.rider.phone})
                                              </span>
                                            )}
                                            <span
                                              style={{
                                                marginLeft: '8px',
                                                fontSize: '10.5px',
                                                padding: '2px 6px',
                                                borderRadius: '9999px',
                                                fontWeight: 600,
                                                background:
                                                  b.status === 'CONFIRMED'
                                                    ? 'rgba(34, 197, 94, 0.2)'
                                                    : b.status === 'PENDING'
                                                    ? 'rgba(234, 179, 8, 0.2)'
                                                    : 'rgba(239, 68, 68, 0.2)',
                                                color:
                                                  b.status === 'CONFIRMED'
                                                    ? '#86efac'
                                                    : b.status === 'PENDING'
                                                    ? '#fde047'
                                                    : '#fca5a5',
                                              }}
                                            >
                                              {b.status}
                                            </span>
                                          </div>
                                          <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.6)', marginTop: '2px' }}>
                                            Seats: {b.seatsBooked} • Total: ₹{b.totalAmount}
                                          </div>
                                        </div>

                                        {b.status === 'PENDING' && (
                                          <div style={{ display: 'flex', gap: '6px' }}>
                                            <button
                                              type="button"
                                              disabled={manifestActionLoading === b.bookingId}
                                              onClick={() => handleApproveBooking(ride.rideId, b.bookingId)}
                                              style={{
                                                background: 'rgba(34, 197, 94, 0.2)',
                                                border: '1px solid rgba(34, 197, 94, 0.4)',
                                                borderRadius: '9999px',
                                                padding: '4px 12px',
                                                color: '#86efac',
                                                fontSize: '11.5px',
                                                fontWeight: 600,
                                                cursor: 'pointer',
                                              }}
                                            >
                                              {manifestActionLoading === b.bookingId ? 'Processing...' : 'Approve'}
                                            </button>
                                            <button
                                              type="button"
                                              disabled={manifestActionLoading === b.bookingId}
                                              onClick={() => handleRejectBooking(ride.rideId, b.bookingId)}
                                              style={{
                                                background: 'rgba(239, 68, 68, 0.15)',
                                                border: '1px solid rgba(239, 68, 68, 0.35)',
                                                borderRadius: '9999px',
                                                padding: '4px 12px',
                                                color: '#fca5a5',
                                                fontSize: '11.5px',
                                                fontWeight: 600,
                                                cursor: 'pointer',
                                              }}
                                            >
                                              Decline
                                            </button>
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
              </div>
            )}
          </LiquidGlassPanel>
        </section>
      )}

      {/* 2. Interactive Earnings Estimator */}
      <section id="earnings-calculator" className="rs-section">
        <LiquidGlassPanel
          radius={28}
          frosted={true}
          style={{
            padding: 'clamp(28px, 4vw, 48px)',
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))',
              gap: 'clamp(24px, 4vw, 48px)',
              alignItems: 'center',
            }}
          >
            {/* Left: Hours Control */}
            <div>
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: 'rgba(255, 255, 255, 0.6)',
                  display: 'block',
                  marginBottom: '8px',
                }}
              >
                Earnings Estimator
              </span>
              <h2
                style={{
                  fontSize: 'clamp(26px, 3.5vw, 36px)',
                  fontWeight: 700,
                  color: '#ffffff',
                  margin: '0 0 12px 0',
                  letterSpacing: '-0.025em',
                  lineHeight: 1.15,
                }}
              >
                See what you could earn
              </h2>
              <p
                style={{
                  fontSize: '15px',
                  color: 'rgba(255, 255, 255, 0.7)',
                  margin: '0 0 28px 0',
                  lineHeight: 1.5,
                }}
              >
                Estimated earnings in Delhi NCR based on actual driver averages across active trips,
                peak hour bonuses, and fuel subsidies.
              </p>

              <div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '10px',
                  }}
                >
                  <span style={{ fontSize: '15px', color: '#ffffff', fontWeight: 500 }}>
                    Hours driving per week:
                  </span>
                  <span
                    style={{
                      fontSize: '18px',
                      fontWeight: 700,
                      color: '#a78bfa',
                    }}
                  >
                    {weeklyHours} hrs / week
                  </span>
                </div>

                <input
                  type="range"
                  min="5"
                  max="60"
                  step="5"
                  value={weeklyHours}
                  onChange={(e) => setWeeklyHours(Number(e.target.value))}
                  style={{
                    width: '100%',
                    height: '6px',
                    borderRadius: '4px',
                    accentColor: '#a78bfa',
                    cursor: 'pointer',
                    outline: 'none',
                  }}
                />

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '12px',
                    color: 'rgba(255, 255, 255, 0.45)',
                    marginTop: '8px',
                  }}
                >
                  <span>Part-time (10 hrs)</span>
                  <span>Regular (30 hrs)</span>
                  <span>Full-time (50+ hrs)</span>
                </div>
              </div>
            </div>

            {/* Right: Projected Figures Display */}
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.04)',
                borderRadius: '24px',
                padding: 'clamp(20px, 3vw, 32px)',
                display: 'flex',
                flexDirection: 'column',
                gap: '20px',
                border: '1px solid rgba(255, 255, 255, 0.06)',
              }}
            >
              <div>
                <span
                  style={{
                    fontSize: '13px',
                    color: 'rgba(255, 255, 255, 0.65)',
                    display: 'block',
                    marginBottom: '4px',
                  }}
                >
                  Estimated Weekly Earnings
                </span>
                <div
                  style={{
                    fontSize: 'clamp(32px, 4vw, 44px)',
                    fontWeight: 800,
                    color: '#ffffff',
                    letterSpacing: '-0.03em',
                  }}
                >
                  ₹{estimatedWeekly.toLocaleString('en-IN')}
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingTop: '16px',
                  borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                }}
              >
                <div>
                  <span style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.6)' }}>
                    Monthly Projection:
                  </span>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: '#c084fc' }}>
                    ~₹{Math.round(estimatedMonthly).toLocaleString('en-IN')}
                  </div>
                </div>
                <LiquidGlassButton scale={0.9} variant="primary" onClick={onSignUpClick}>
                  Get Started
                </LiquidGlassButton>
              </div>
            </div>
          </div>
        </LiquidGlassPanel>
      </section>

      {/* 3. Driver Perks & Benefits */}
      <section className="rs-section">
        <div style={{ marginBottom: 'clamp(20px, 3vw, 32px)', maxWidth: '720px' }}>
          <span
            style={{
              fontSize: '12px',
              fontWeight: 600,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'rgba(255, 255, 255, 0.6)',
              display: 'block',
              marginBottom: '8px',
            }}
          >
            Driver Benefits
          </span>
          <h2
            style={{
              fontSize: 'clamp(26px, 4vw, 36px)',
              fontWeight: 700,
              color: '#ffffff',
              margin: '0 0 10px 0',
              letterSpacing: '-0.025em',
            }}
          >
            Built for drivers, every mile of the way
          </h2>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))',
            gap: 'clamp(16px, 2.5vw, 24px)',
          }}
        >
          {driverPerks.map((perk, idx) => (
            <LiquidGlassPanel
              key={idx}
              radius={24}
              frosted={true}
              interactive={true}
              style={{
                padding: '28px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                boxSizing: 'border-box',
              }}
            >
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  background: 'rgba(255, 255, 255, 0.06)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {perk.icon}
              </div>

              <div>
                <h3
                  style={{
                    fontSize: '18px',
                    fontWeight: 600,
                    color: '#ffffff',
                    margin: '0 0 8px 0',
                    letterSpacing: '-0.015em',
                  }}
                >
                  {perk.title}
                </h3>
                <p
                  style={{
                    fontSize: '14px',
                    color: 'rgba(255, 255, 255, 0.68)',
                    margin: 0,
                    lineHeight: 1.5,
                  }}
                >
                  {perk.description}
                </p>
              </div>
            </LiquidGlassPanel>
          ))}
        </div>
      </section>

      {/* 4. Three Simple Steps to Start */}
      <section className="rs-section">
        <div style={{ marginBottom: 'clamp(20px, 3vw, 32px)', maxWidth: '720px' }}>
          <span
            style={{
              fontSize: '12px',
              fontWeight: 600,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'rgba(255, 255, 255, 0.6)',
              display: 'block',
              marginBottom: '8px',
            }}
          >
            Fast Onboarding
          </span>
          <h2
            style={{
              fontSize: 'clamp(26px, 4vw, 36px)',
              fontWeight: 700,
              color: '#ffffff',
              margin: '0 0 10px 0',
              letterSpacing: '-0.025em',
            }}
          >
            How to get started
          </h2>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))',
            gap: 'clamp(16px, 2.5vw, 24px)',
          }}
        >
          {steps.map((s, idx) => (
            <LiquidGlassPanel
              key={idx}
              radius={24}
              frosted={true}
              style={{
                padding: '28px',
                boxSizing: 'border-box',
                position: 'relative',
              }}
            >
              <span
                style={{
                  fontSize: '32px',
                  fontWeight: 800,
                  color: 'rgba(255, 255, 255, 0.15)',
                  display: 'block',
                  marginBottom: '12px',
                  letterSpacing: '-0.03em',
                }}
              >
                {s.num}
              </span>
              <h3
                style={{
                  fontSize: '18px',
                  fontWeight: 600,
                  color: '#ffffff',
                  margin: '0 0 8px 0',
                }}
              >
                {s.title}
              </h3>
              <p
                style={{
                  fontSize: '14px',
                  color: 'rgba(255, 255, 255, 0.68)',
                  margin: 0,
                  lineHeight: 1.5,
                }}
              >
                {s.desc}
              </p>
            </LiquidGlassPanel>
          ))}
        </div>
      </section>

      {/* 5. Eligible Vehicle Options */}
      <section className="rs-section">
        <div style={{ marginBottom: 'clamp(20px, 3vw, 32px)', maxWidth: '720px' }}>
          <span
            style={{
              fontSize: '12px',
              fontWeight: 600,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'rgba(255, 255, 255, 0.6)',
              display: 'block',
              marginBottom: '8px',
            }}
          >
            Vehicle Categories
          </span>
          <h2
            style={{
              fontSize: 'clamp(26px, 4vw, 36px)',
              fontWeight: 700,
              color: '#ffffff',
              margin: '0 0 10px 0',
              letterSpacing: '-0.025em',
            }}
          >
            What you can drive with us
          </h2>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))',
            gap: 'clamp(16px, 2.5vw, 24px)',
          }}
        >
          {vehicleCategories.map((v, idx) => (
            <LiquidGlassPanel
              key={idx}
              radius={24}
              frosted={true}
              interactive={true}
              style={{
                padding: '28px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                boxSizing: 'border-box',
              }}
            >
              <div>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: '#c084fc',
                    background: 'rgba(192, 132, 252, 0.15)',
                    padding: '4px 8px',
                    borderRadius: '9999px',
                    display: 'inline-block',
                    marginBottom: '14px',
                  }}
                >
                  {v.badge}
                </span>

                <h3
                  style={{
                    fontSize: '19px',
                    fontWeight: 700,
                    color: '#ffffff',
                    margin: '0 0 8px 0',
                  }}
                >
                  {v.type}
                </h3>
                <p
                  style={{
                    fontSize: '14px',
                    color: 'rgba(255, 255, 255, 0.68)',
                    margin: 0,
                    lineHeight: 1.5,
                  }}
                >
                  {v.desc}
                </p>
              </div>

              <div
                style={{
                  marginTop: '24px',
                  paddingTop: '16px',
                  borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.55)' }}>
                  Avg. potential:
                </span>
                <span style={{ fontSize: '15px', fontWeight: 700, color: '#ffffff' }}>
                  {v.minEarning}
                </span>
              </div>
            </LiquidGlassPanel>
          ))}
        </div>
      </section>

      {/* 6. Driver App Download Card */}
      <section className="rs-section">
        <LiquidGlassPanel
          radius={28}
          frosted={true}
          style={{
            padding: 'clamp(24px, 4vw, 40px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '24px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '16px',
                background: 'rgba(255, 255, 255, 0.06)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <IconQrCode size={36} color="#ffffff" />
            </div>

            <div>
              <h3
                style={{
                  fontSize: '20px',
                  fontWeight: 700,
                  color: '#ffffff',
                  margin: '0 0 4px 0',
                }}
              >
                Download the RideShare Driver App
              </h3>
              <p
                style={{
                  fontSize: '14px',
                  color: 'rgba(255, 255, 255, 0.65)',
                  margin: 0,
                }}
              >
                Available for Android and iOS. Scan with your phone camera or click to download.
              </p>
            </div>
          </div>

          <LiquidGlassButton scale={0.95} variant="primary" onClick={onSignUpClick}>
            Get the App →
          </LiquidGlassButton>
        </LiquidGlassPanel>
      </section>
    </div>
  );
};

export default DrivePage;

