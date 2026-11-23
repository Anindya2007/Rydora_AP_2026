import axios from 'axios';

// Base API URL: In dev Vite proxies /api to backend port 5000; also supports VITE_API_BASE_URL
const API_BASE_URL = import.meta.env?.VITE_API_BASE_URL || '/api/v1';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach Authorization Bearer token to every outgoing request if available
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('rideshare_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Intercept responses to handle 401s (token expiry)
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear token and user on unrecoverable unauthorized
      const currentToken = localStorage.getItem('rideshare_token');
      if (currentToken && !error.config.url?.includes('/auth/login')) {
        localStorage.removeItem('rideshare_token');
        localStorage.removeItem('rideshare_user');
      }
    }
    return Promise.reject(error);
  }
);

export const api = {
  auth: {
    async login(email, password) {
      const response = await apiClient.post('/auth/login', { email, password });
      const { user, token } = response.data.data;
      localStorage.setItem('rideshare_token', token);
      localStorage.setItem('rideshare_user', JSON.stringify(user));
      return { user, token };
    },

    async signup({ name, email, phone, password }) {
      const payload = {
        name: name.trim(),
        email: email.trim(),
        password,
      };
      if (phone && phone.trim()) {
        const cleanedPhone = phone.trim().startsWith('+91')
          ? phone.trim()
          : `+91${phone.trim().replace(/^0+/, '')}`;
        payload.phone = cleanedPhone;
      }
      const response = await apiClient.post('/auth/signup', payload);
      const { user, token } = response.data.data;
      localStorage.setItem('rideshare_token', token);
      localStorage.setItem('rideshare_user', JSON.stringify(user));
      return { user, token };
    },

    async getMe() {
      const response = await apiClient.get('/auth/me');
      const user = response.data.data;
      localStorage.setItem('rideshare_user', JSON.stringify(user));
      return user;
    },

    logout() {
      localStorage.removeItem('rideshare_token');
      localStorage.removeItem('rideshare_user');
    },

    getToken() {
      return localStorage.getItem('rideshare_token');
    },

    getCurrentUser() {
      try {
        const saved = localStorage.getItem('rideshare_user');
        return saved ? JSON.parse(saved) : null;
      } catch {
        return null;
      }
    },
  },

  rides: {
    async search(params = {}) {
      const response = await apiClient.get('/rides', { params });
      return response.data.data;
    },

    async getById(rideId) {
      const response = await apiClient.get(`/rides/${rideId}`);
      return response.data.data;
    },

    async getDriverRides(params = {}) {
      const response = await apiClient.get('/rides/me', { params });
      return response.data.data;
    },

    async publish(rideData) {
      const response = await apiClient.post('/rides', rideData);
      return response.data.data;
    },

    async cancel(rideId) {
      const response = await apiClient.post(`/rides/${rideId}/cancel`);
      return response.data.data;
    },
  },

  bookings: {
    async create(rideId, seatsBooked = 1) {
      const response = await apiClient.post('/bookings', { rideId, seatsBooked });
      return response.data.data;
    },

    async getMyBookings(params = {}) {
      const response = await apiClient.get('/bookings/me', { params });
      return response.data.data;
    },

    async getById(bookingId) {
      const response = await apiClient.get(`/bookings/${bookingId}`);
      return response.data.data;
    },

    async cancel(bookingId, cancellationReason = '') {
      const response = await apiClient.patch(`/bookings/${bookingId}/cancel`, {
        cancellationReason,
      });
      return response.data.data;
    },

    async approve(bookingId) {
      const response = await apiClient.patch(`/bookings/${bookingId}/approve`);
      return response.data.data;
    },

    async reject(bookingId, reason = '') {
      const response = await apiClient.patch(`/bookings/${bookingId}/reject`, {
        reason,
      });
      return response.data.data;
    },

    async getRideManifest(rideId) {
      const response = await apiClient.get(`/rides/${rideId}/bookings`);
      return response.data.data;
    },

    async requestRefund(bookingId, reason = '') {
      const response = await apiClient.post(`/bookings/${bookingId}/refund`, {
        reason: reason || 'Passenger requested refund for cancelled booking',
      });
      return response.data.data;
    },

    async pay(bookingId, amount, paymentMethod = 'UPI') {
      const response = await apiClient.post(`/bookings/${bookingId}/payments`, {
        bookingId,
        amount: Number(amount),
        currency: 'INR',
        paymentMethod,
      });
      return response.data.data;
    },
  },

  ratings: {
    async submit(bookingId, rating, review = '') {
      const response = await apiClient.post('/ratings', {
        bookingId,
        rating: Number(rating),
        review: review.trim() || undefined,
      });
      return response.data.data;
    },

    async getMyRatings() {
      const response = await apiClient.get('/ratings/me');
      return response.data.data;
    },

    async getUserRatings(userId) {
      const response = await apiClient.get(`/ratings/${userId}`);
      return response.data.data;
    },
  },

  safety: {
    async triggerSOS({ message = 'Emergency assistance requested', latitude = null, longitude = null }) {
      const payload = { message };
      if (latitude !== null && longitude !== null) {
        payload.latitude = Number(latitude);
        payload.longitude = Number(longitude);
      }
      const response = await apiClient.post('/sos', payload);
      return response.data.data;
    },

    async getActiveSOS() {
      const response = await apiClient.get('/sos/active');
      return response.data.data;
    },

    async resolveSOS(alertId, resolutionNotes = 'Resolved safely by user') {
      const response = await apiClient.patch(`/sos/${alertId}/resolve`, {
        resolutionNotes,
      });
      return response.data.data;
    },

    async cancelSOS(alertId) {
      const response = await apiClient.patch(`/sos/${alertId}/cancel`);
      return response.data.data;
    },

    async getEmergencyContacts() {
      const response = await apiClient.get('/emergency-contacts');
      return response.data.data;
    },

    async addEmergencyContact({ name, phone, relationship = 'Family', isPrimary = false }) {
      const response = await apiClient.post('/emergency-contacts', {
        name,
        phone,
        relationship,
        isPrimary,
      });
      return response.data.data;
    },

    async deleteEmergencyContact(contactId) {
      const response = await apiClient.delete(`/emergency-contacts/${contactId}`);
      return response.data.data;
    },
  },

  driver: {
    async submitVerification(licenseNumber, licenseExpiry) {
      const response = await apiClient.post('/users/driver-verification', {
        licenseNumber,
        licenseExpiry,
      });
      return response.data.data;
    },

    async getEarnings(params = {}) {
      const response = await apiClient.get('/payments/driver/earnings', { params });
      return response.data.data;
    },

    async getVehicles() {
      const response = await apiClient.get('/vehicles/me');
      return response.data.data;
    },

    async registerVehicle(vehicleData) {
      const response = await apiClient.post('/vehicles', vehicleData);
      return response.data.data;
    },
  },

  communities: {
    async list(params = {}) {
      const response = await apiClient.get('/communities', { params });
      return response.data.data;
    },

    async getById(communityId) {
      const response = await apiClient.get(`/communities/${communityId}`);
      return response.data.data;
    },

    async join(communityId) {
      const response = await apiClient.post(`/communities/${communityId}/join`);
      return response.data.data;
    },
  },
};
