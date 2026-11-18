/*
  Warnings:

  - The values [CONFIRMED,NO_SHOW,EXPIRED] on the enum `BookingStatus` will be removed. If these variants are still used in the database, this will fail.
  - The values [ACTIVE] on the enum `RideStatus` will be removed. If these variants are still used in the database, this will fail.
  - The primary key for the `bookings` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `bookingId` on the `bookings` table. All the data in the column will be lost.
  - You are about to drop the column `bookingStatus` on the `bookings` table. All the data in the column will be lost.
  - You are about to drop the column `confirmedAt` on the `bookings` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `bookings` table. All the data in the column will be lost.
  - You are about to drop the column `dropoffAddress` on the `bookings` table. All the data in the column will be lost.
  - You are about to drop the column `dropoffLat` on the `bookings` table. All the data in the column will be lost.
  - You are about to drop the column `dropoffLng` on the `bookings` table. All the data in the column will be lost.
  - You are about to drop the column `fareQuoteId` on the `bookings` table. All the data in the column will be lost.
  - You are about to drop the column `pickupAddress` on the `bookings` table. All the data in the column will be lost.
  - You are about to drop the column `pickupLat` on the `bookings` table. All the data in the column will be lost.
  - You are about to drop the column `pickupLng` on the `bookings` table. All the data in the column will be lost.
  - You are about to drop the column `rideId` on the `bookings` table. All the data in the column will be lost.
  - You are about to drop the column `riderId` on the `bookings` table. All the data in the column will be lost.
  - You are about to drop the column `seatCount` on the `bookings` table. All the data in the column will be lost.
  - You are about to drop the column `totalFare` on the `bookings` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `bookings` table. All the data in the column will be lost.
  - The primary key for the `communities` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `communityId` on the `communities` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `communities` table. All the data in the column will be lost.
  - You are about to drop the column `createdById` on the `communities` table. All the data in the column will be lost.
  - You are about to drop the column `description` on the `communities` table. All the data in the column will be lost.
  - You are about to drop the column `isDiscoverable` on the `communities` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `communities` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `communities` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `communities` table. All the data in the column will be lost.
  - The primary key for the `rides` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `availableSeats` on the `rides` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `rides` table. All the data in the column will be lost.
  - You are about to drop the column `departureTime` on the `rides` table. All the data in the column will be lost.
  - You are about to drop the column `destinationAddress` on the `rides` table. All the data in the column will be lost.
  - You are about to drop the column `destinationLat` on the `rides` table. All the data in the column will be lost.
  - You are about to drop the column `destinationLng` on the `rides` table. All the data in the column will be lost.
  - You are about to drop the column `destinationPlaceId` on the `rides` table. All the data in the column will be lost.
  - You are about to drop the column `driverId` on the `rides` table. All the data in the column will be lost.
  - You are about to drop the column `farePerSeat` on the `rides` table. All the data in the column will be lost.
  - You are about to drop the column `notes` on the `rides` table. All the data in the column will be lost.
  - You are about to drop the column `originAddress` on the `rides` table. All the data in the column will be lost.
  - You are about to drop the column `originLat` on the `rides` table. All the data in the column will be lost.
  - You are about to drop the column `originLng` on the `rides` table. All the data in the column will be lost.
  - You are about to drop the column `originPlaceId` on the `rides` table. All the data in the column will be lost.
  - You are about to drop the column `plannedDistanceKm` on the `rides` table. All the data in the column will be lost.
  - You are about to drop the column `plannedDurationMinutes` on the `rides` table. All the data in the column will be lost.
  - You are about to drop the column `rideId` on the `rides` table. All the data in the column will be lost.
  - You are about to drop the column `rideStatus` on the `rides` table. All the data in the column will be lost.
  - You are about to drop the column `totalSeats` on the `rides` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `rides` table. All the data in the column will be lost.
  - You are about to drop the column `vehicleId` on the `rides` table. All the data in the column will be lost.
  - The primary key for the `users` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `accountStatus` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `deletedAt` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `emailVerifiedAt` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `passwordHash` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `phone` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `phoneVerifiedAt` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `profileImage` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `users` table. All the data in the column will be lost.
  - You are about to drop the `admin_audit_logs` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ai_analysis_logs` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ai_messages` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ai_sessions` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `booking_community_eligibilities` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `calendar_connections` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `calendar_events` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `cancellation_policies` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `cancellations` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `community_domains` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `community_invites` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `community_memberships` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `community_verifications` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `consent_records` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `dispute_cases` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `driver_earnings` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `driver_incentives` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `driver_profiles` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `driver_tier_histories` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `driver_tiers` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `email_verifications` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `emission_estimates` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `fare_line_items` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `fare_policies` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `fare_quotes` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `feedback_analyses` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `feedback_categories` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `financial_accounts` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `green_point_transactions` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ledger_entries` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ledger_transactions` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `moderation_reports` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `no_show_records` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `notification_deliveries` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `notification_preferences` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `notifications` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `password_reset_tokens` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `payments` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `penalty_assessments` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `phone_verifications` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `platform_settings` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ratings` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `refunds` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `reviews` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `reward_redemptions` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `rewards` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ride_communities` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ride_locations` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ride_routes` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ride_stops` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `route_deviation_events` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `safety_evidences` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `safety_incidents` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `sos_alerts` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `trusted_contacts` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `user_preferences` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `user_roles` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `user_sessions` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `vehicle_documents` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `vehicles` table. If the table is not empty, all the data it contains will be lost.
  - The required column `booking_id` was added to the `bookings` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.
  - Added the required column `ride_id` to the `bookings` table without a default value. This is not possible if the table is not empty.
  - Added the required column `seats_booked` to the `bookings` table without a default value. This is not possible if the table is not empty.
  - Added the required column `total_amount` to the `bookings` table without a default value. This is not possible if the table is not empty.
  - Added the required column `user_id` to the `bookings` table without a default value. This is not possible if the table is not empty.
  - The required column `community_id` was added to the `communities` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.
  - Added the required column `domain` to the `communities` table without a default value. This is not possible if the table is not empty.
  - Added the required column `user_id` to the `communities` table without a default value. This is not possible if the table is not empty.
  - Added the required column `available_seats` to the `rides` table without a default value. This is not possible if the table is not empty.
  - Added the required column `community_id` to the `rides` table without a default value. This is not possible if the table is not empty.
  - Added the required column `departure_time` to the `rides` table without a default value. This is not possible if the table is not empty.
  - Added the required column `destination` to the `rides` table without a default value. This is not possible if the table is not empty.
  - Added the required column `driver_id` to the `rides` table without a default value. This is not possible if the table is not empty.
  - Added the required column `fare_per_seat` to the `rides` table without a default value. This is not possible if the table is not empty.
  - The required column `ride_id` was added to the `rides` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.
  - Added the required column `source` to the `rides` table without a default value. This is not possible if the table is not empty.
  - Added the required column `total_seats` to the `rides` table without a default value. This is not possible if the table is not empty.
  - Added the required column `password_hash` to the `users` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `users` table without a default value. This is not possible if the table is not empty.
  - The required column `user_id` was added to the `users` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.

*/
-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'DRIVER');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('PAYMENT', 'REFUND');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- AlterEnum
BEGIN;
CREATE TYPE "BookingStatus_new" AS ENUM ('PENDING', 'COMPLETED', 'CANCELLED');
ALTER TABLE "public"."bookings" ALTER COLUMN "bookingStatus" DROP DEFAULT;
ALTER TABLE "bookings" ALTER COLUMN "status" TYPE "BookingStatus_new" USING ("status"::text::"BookingStatus_new");
ALTER TYPE "BookingStatus" RENAME TO "BookingStatus_old";
ALTER TYPE "BookingStatus_new" RENAME TO "BookingStatus";
DROP TYPE "public"."BookingStatus_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "RideStatus_new" AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELLED');
ALTER TABLE "public"."rides" ALTER COLUMN "rideStatus" DROP DEFAULT;
ALTER TABLE "rides" ALTER COLUMN "status" TYPE "RideStatus_new" USING ("status"::text::"RideStatus_new");
ALTER TYPE "RideStatus" RENAME TO "RideStatus_old";
ALTER TYPE "RideStatus_new" RENAME TO "RideStatus";
DROP TYPE "public"."RideStatus_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "admin_audit_logs" DROP CONSTRAINT "admin_audit_logs_adminId_fkey";

-- DropForeignKey
ALTER TABLE "ai_analysis_logs" DROP CONSTRAINT "ai_analysis_logs_sessionId_fkey";

-- DropForeignKey
ALTER TABLE "ai_messages" DROP CONSTRAINT "ai_messages_sessionId_fkey";

-- DropForeignKey
ALTER TABLE "ai_sessions" DROP CONSTRAINT "ai_sessions_userId_fkey";

-- DropForeignKey
ALTER TABLE "booking_community_eligibilities" DROP CONSTRAINT "booking_community_eligibilities_bookingId_fkey";

-- DropForeignKey
ALTER TABLE "booking_community_eligibilities" DROP CONSTRAINT "booking_community_eligibilities_communityId_fkey";

-- DropForeignKey
ALTER TABLE "booking_community_eligibilities" DROP CONSTRAINT "booking_community_eligibilities_membershipId_fkey";

-- DropForeignKey
ALTER TABLE "bookings" DROP CONSTRAINT "bookings_fareQuoteId_fkey";

-- DropForeignKey
ALTER TABLE "bookings" DROP CONSTRAINT "bookings_rideId_fkey";

-- DropForeignKey
ALTER TABLE "bookings" DROP CONSTRAINT "bookings_riderId_fkey";

-- DropForeignKey
ALTER TABLE "calendar_connections" DROP CONSTRAINT "calendar_connections_userId_fkey";

-- DropForeignKey
ALTER TABLE "calendar_events" DROP CONSTRAINT "calendar_events_connectionId_fkey";

-- DropForeignKey
ALTER TABLE "calendar_events" DROP CONSTRAINT "calendar_events_suggestedRideId_fkey";

-- DropForeignKey
ALTER TABLE "cancellations" DROP CONSTRAINT "cancellations_bookingId_fkey";

-- DropForeignKey
ALTER TABLE "cancellations" DROP CONSTRAINT "cancellations_cancelledById_fkey";

-- DropForeignKey
ALTER TABLE "cancellations" DROP CONSTRAINT "cancellations_policyId_fkey";

-- DropForeignKey
ALTER TABLE "communities" DROP CONSTRAINT "communities_createdById_fkey";

-- DropForeignKey
ALTER TABLE "community_domains" DROP CONSTRAINT "community_domains_communityId_fkey";

-- DropForeignKey
ALTER TABLE "community_invites" DROP CONSTRAINT "community_invites_communityId_fkey";

-- DropForeignKey
ALTER TABLE "community_invites" DROP CONSTRAINT "community_invites_createdById_fkey";

-- DropForeignKey
ALTER TABLE "community_memberships" DROP CONSTRAINT "community_memberships_communityId_fkey";

-- DropForeignKey
ALTER TABLE "community_memberships" DROP CONSTRAINT "community_memberships_userId_fkey";

-- DropForeignKey
ALTER TABLE "community_verifications" DROP CONSTRAINT "community_verifications_membershipId_fkey";

-- DropForeignKey
ALTER TABLE "community_verifications" DROP CONSTRAINT "community_verifications_reviewerId_fkey";

-- DropForeignKey
ALTER TABLE "consent_records" DROP CONSTRAINT "consent_records_userId_fkey";

-- DropForeignKey
ALTER TABLE "dispute_cases" DROP CONSTRAINT "dispute_cases_bookingId_fkey";

-- DropForeignKey
ALTER TABLE "dispute_cases" DROP CONSTRAINT "dispute_cases_reviewerId_fkey";

-- DropForeignKey
ALTER TABLE "dispute_cases" DROP CONSTRAINT "dispute_cases_submittedById_fkey";

-- DropForeignKey
ALTER TABLE "driver_earnings" DROP CONSTRAINT "driver_earnings_bookingId_fkey";

-- DropForeignKey
ALTER TABLE "driver_earnings" DROP CONSTRAINT "driver_earnings_driverId_fkey";

-- DropForeignKey
ALTER TABLE "driver_earnings" DROP CONSTRAINT "driver_earnings_rideId_fkey";

-- DropForeignKey
ALTER TABLE "driver_incentives" DROP CONSTRAINT "driver_incentives_driverId_fkey";

-- DropForeignKey
ALTER TABLE "driver_profiles" DROP CONSTRAINT "driver_profiles_userId_fkey";

-- DropForeignKey
ALTER TABLE "driver_tier_histories" DROP CONSTRAINT "driver_tier_histories_driverId_fkey";

-- DropForeignKey
ALTER TABLE "driver_tier_histories" DROP CONSTRAINT "driver_tier_histories_tierId_fkey";

-- DropForeignKey
ALTER TABLE "email_verifications" DROP CONSTRAINT "email_verifications_userId_fkey";

-- DropForeignKey
ALTER TABLE "emission_estimates" DROP CONSTRAINT "emission_estimates_bookingId_fkey";

-- DropForeignKey
ALTER TABLE "emission_estimates" DROP CONSTRAINT "emission_estimates_rideId_fkey";

-- DropForeignKey
ALTER TABLE "fare_line_items" DROP CONSTRAINT "fare_line_items_fareQuoteId_fkey";

-- DropForeignKey
ALTER TABLE "fare_quotes" DROP CONSTRAINT "fare_quotes_farePolicyId_fkey";

-- DropForeignKey
ALTER TABLE "fare_quotes" DROP CONSTRAINT "fare_quotes_rideId_fkey";

-- DropForeignKey
ALTER TABLE "fare_quotes" DROP CONSTRAINT "fare_quotes_riderId_fkey";

-- DropForeignKey
ALTER TABLE "feedback_analyses" DROP CONSTRAINT "feedback_analyses_reviewId_fkey";

-- DropForeignKey
ALTER TABLE "financial_accounts" DROP CONSTRAINT "financial_accounts_userId_fkey";

-- DropForeignKey
ALTER TABLE "green_point_transactions" DROP CONSTRAINT "green_point_transactions_userId_fkey";

-- DropForeignKey
ALTER TABLE "ledger_entries" DROP CONSTRAINT "ledger_entries_accountId_fkey";

-- DropForeignKey
ALTER TABLE "ledger_entries" DROP CONSTRAINT "ledger_entries_transactionId_fkey";

-- DropForeignKey
ALTER TABLE "moderation_reports" DROP CONSTRAINT "moderation_reports_moderatorId_fkey";

-- DropForeignKey
ALTER TABLE "moderation_reports" DROP CONSTRAINT "moderation_reports_reporterId_fkey";

-- DropForeignKey
ALTER TABLE "no_show_records" DROP CONSTRAINT "no_show_records_bookingId_fkey";

-- DropForeignKey
ALTER TABLE "no_show_records" DROP CONSTRAINT "no_show_records_reportedById_fkey";

-- DropForeignKey
ALTER TABLE "notification_deliveries" DROP CONSTRAINT "notification_deliveries_notificationId_fkey";

-- DropForeignKey
ALTER TABLE "notification_preferences" DROP CONSTRAINT "notification_preferences_userId_fkey";

-- DropForeignKey
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_userId_fkey";

-- DropForeignKey
ALTER TABLE "password_reset_tokens" DROP CONSTRAINT "password_reset_tokens_userId_fkey";

-- DropForeignKey
ALTER TABLE "payments" DROP CONSTRAINT "payments_bookingId_fkey";

-- DropForeignKey
ALTER TABLE "payments" DROP CONSTRAINT "payments_payerId_fkey";

-- DropForeignKey
ALTER TABLE "penalty_assessments" DROP CONSTRAINT "penalty_assessments_bookingId_fkey";

-- DropForeignKey
ALTER TABLE "penalty_assessments" DROP CONSTRAINT "penalty_assessments_cancellationId_fkey";

-- DropForeignKey
ALTER TABLE "penalty_assessments" DROP CONSTRAINT "penalty_assessments_noShowId_fkey";

-- DropForeignKey
ALTER TABLE "penalty_assessments" DROP CONSTRAINT "penalty_assessments_policyId_fkey";

-- DropForeignKey
ALTER TABLE "phone_verifications" DROP CONSTRAINT "phone_verifications_userId_fkey";

-- DropForeignKey
ALTER TABLE "platform_settings" DROP CONSTRAINT "platform_settings_updatedById_fkey";

-- DropForeignKey
ALTER TABLE "ratings" DROP CONSTRAINT "ratings_bookingId_fkey";

-- DropForeignKey
ALTER TABLE "ratings" DROP CONSTRAINT "ratings_rateeId_fkey";

-- DropForeignKey
ALTER TABLE "ratings" DROP CONSTRAINT "ratings_raterId_fkey";

-- DropForeignKey
ALTER TABLE "ratings" DROP CONSTRAINT "ratings_rideId_fkey";

-- DropForeignKey
ALTER TABLE "refunds" DROP CONSTRAINT "refunds_paymentId_fkey";

-- DropForeignKey
ALTER TABLE "refunds" DROP CONSTRAINT "refunds_requestedById_fkey";

-- DropForeignKey
ALTER TABLE "reviews" DROP CONSTRAINT "reviews_ratingId_fkey";

-- DropForeignKey
ALTER TABLE "reward_redemptions" DROP CONSTRAINT "reward_redemptions_rewardId_fkey";

-- DropForeignKey
ALTER TABLE "reward_redemptions" DROP CONSTRAINT "reward_redemptions_userId_fkey";

-- DropForeignKey
ALTER TABLE "ride_communities" DROP CONSTRAINT "ride_communities_communityId_fkey";

-- DropForeignKey
ALTER TABLE "ride_communities" DROP CONSTRAINT "ride_communities_rideId_fkey";

-- DropForeignKey
ALTER TABLE "ride_locations" DROP CONSTRAINT "ride_locations_rideId_fkey";

-- DropForeignKey
ALTER TABLE "ride_routes" DROP CONSTRAINT "ride_routes_rideId_fkey";

-- DropForeignKey
ALTER TABLE "ride_stops" DROP CONSTRAINT "ride_stops_rideId_fkey";

-- DropForeignKey
ALTER TABLE "rides" DROP CONSTRAINT "rides_driverId_fkey";

-- DropForeignKey
ALTER TABLE "rides" DROP CONSTRAINT "rides_vehicleId_fkey";

-- DropForeignKey
ALTER TABLE "route_deviation_events" DROP CONSTRAINT "route_deviation_events_rideId_fkey";

-- DropForeignKey
ALTER TABLE "safety_evidences" DROP CONSTRAINT "safety_evidences_incidentId_fkey";

-- DropForeignKey
ALTER TABLE "safety_evidences" DROP CONSTRAINT "safety_evidences_uploadedById_fkey";

-- DropForeignKey
ALTER TABLE "safety_incidents" DROP CONSTRAINT "safety_incidents_reportedUserId_fkey";

-- DropForeignKey
ALTER TABLE "safety_incidents" DROP CONSTRAINT "safety_incidents_reporterId_fkey";

-- DropForeignKey
ALTER TABLE "safety_incidents" DROP CONSTRAINT "safety_incidents_resolvedById_fkey";

-- DropForeignKey
ALTER TABLE "safety_incidents" DROP CONSTRAINT "safety_incidents_rideId_fkey";

-- DropForeignKey
ALTER TABLE "sos_alerts" DROP CONSTRAINT "sos_alerts_resolvedById_fkey";

-- DropForeignKey
ALTER TABLE "sos_alerts" DROP CONSTRAINT "sos_alerts_rideId_fkey";

-- DropForeignKey
ALTER TABLE "sos_alerts" DROP CONSTRAINT "sos_alerts_userId_fkey";

-- DropForeignKey
ALTER TABLE "trusted_contacts" DROP CONSTRAINT "trusted_contacts_userId_fkey";

-- DropForeignKey
ALTER TABLE "user_preferences" DROP CONSTRAINT "user_preferences_userId_fkey";

-- DropForeignKey
ALTER TABLE "user_roles" DROP CONSTRAINT "user_roles_userId_fkey";

-- DropForeignKey
ALTER TABLE "user_sessions" DROP CONSTRAINT "user_sessions_userId_fkey";

-- DropForeignKey
ALTER TABLE "vehicle_documents" DROP CONSTRAINT "vehicle_documents_reviewedById_fkey";

-- DropForeignKey
ALTER TABLE "vehicle_documents" DROP CONSTRAINT "vehicle_documents_vehicleId_fkey";

-- DropForeignKey
ALTER TABLE "vehicles" DROP CONSTRAINT "vehicles_ownerId_fkey";

-- DropIndex
DROP INDEX "bookings_bookingStatus_idx";

-- DropIndex
DROP INDEX "bookings_fareQuoteId_key";

-- DropIndex
DROP INDEX "bookings_rideId_idx";

-- DropIndex
DROP INDEX "bookings_riderId_idx";

-- DropIndex
DROP INDEX "communities_createdById_idx";

-- DropIndex
DROP INDEX "communities_type_status_idx";

-- DropIndex
DROP INDEX "rides_departureTime_rideStatus_idx";

-- DropIndex
DROP INDEX "rides_driverId_idx";

-- DropIndex
DROP INDEX "rides_rideStatus_idx";

-- DropIndex
DROP INDEX "rides_vehicleId_idx";

-- DropIndex
DROP INDEX "users_phone_key";

-- AlterTable
ALTER TABLE "bookings" DROP CONSTRAINT "bookings_pkey",
DROP COLUMN "bookingId",
DROP COLUMN "bookingStatus",
DROP COLUMN "confirmedAt",
DROP COLUMN "createdAt",
DROP COLUMN "dropoffAddress",
DROP COLUMN "dropoffLat",
DROP COLUMN "dropoffLng",
DROP COLUMN "fareQuoteId",
DROP COLUMN "pickupAddress",
DROP COLUMN "pickupLat",
DROP COLUMN "pickupLng",
DROP COLUMN "rideId",
DROP COLUMN "riderId",
DROP COLUMN "seatCount",
DROP COLUMN "totalFare",
DROP COLUMN "updatedAt",
ADD COLUMN     "booked_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "booking_id" UUID NOT NULL,
ADD COLUMN     "ride_id" UUID NOT NULL,
ADD COLUMN     "seats_booked" INTEGER NOT NULL,
ADD COLUMN     "status" "BookingStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "total_amount" DECIMAL(10,2) NOT NULL,
ADD COLUMN     "user_id" UUID NOT NULL,
ADD CONSTRAINT "bookings_pkey" PRIMARY KEY ("booking_id");

-- AlterTable
ALTER TABLE "communities" DROP CONSTRAINT "communities_pkey",
DROP COLUMN "communityId",
DROP COLUMN "createdAt",
DROP COLUMN "createdById",
DROP COLUMN "description",
DROP COLUMN "isDiscoverable",
DROP COLUMN "status",
DROP COLUMN "type",
DROP COLUMN "updatedAt",
ADD COLUMN     "community_id" UUID NOT NULL,
ADD COLUMN     "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "domain" VARCHAR(255) NOT NULL,
ADD COLUMN     "user_id" UUID NOT NULL,
ADD CONSTRAINT "communities_pkey" PRIMARY KEY ("community_id");

-- AlterTable
ALTER TABLE "rides" DROP CONSTRAINT "rides_pkey",
DROP COLUMN "availableSeats",
DROP COLUMN "createdAt",
DROP COLUMN "departureTime",
DROP COLUMN "destinationAddress",
DROP COLUMN "destinationLat",
DROP COLUMN "destinationLng",
DROP COLUMN "destinationPlaceId",
DROP COLUMN "driverId",
DROP COLUMN "farePerSeat",
DROP COLUMN "notes",
DROP COLUMN "originAddress",
DROP COLUMN "originLat",
DROP COLUMN "originLng",
DROP COLUMN "originPlaceId",
DROP COLUMN "plannedDistanceKm",
DROP COLUMN "plannedDurationMinutes",
DROP COLUMN "rideId",
DROP COLUMN "rideStatus",
DROP COLUMN "totalSeats",
DROP COLUMN "updatedAt",
DROP COLUMN "vehicleId",
ADD COLUMN     "available_seats" INTEGER NOT NULL,
ADD COLUMN     "community_id" UUID NOT NULL,
ADD COLUMN     "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "departure_time" TIMESTAMPTZ(6) NOT NULL,
ADD COLUMN     "destination" VARCHAR(255) NOT NULL,
ADD COLUMN     "driver_id" UUID NOT NULL,
ADD COLUMN     "fare_per_seat" DECIMAL(10,2) NOT NULL,
ADD COLUMN     "ride_id" UUID NOT NULL,
ADD COLUMN     "source" VARCHAR(255) NOT NULL,
ADD COLUMN     "status" "RideStatus" NOT NULL DEFAULT 'SCHEDULED',
ADD COLUMN     "total_seats" INTEGER NOT NULL,
ADD CONSTRAINT "rides_pkey" PRIMARY KEY ("ride_id");

-- AlterTable
ALTER TABLE "users" DROP CONSTRAINT "users_pkey",
DROP COLUMN "accountStatus",
DROP COLUMN "createdAt",
DROP COLUMN "deletedAt",
DROP COLUMN "emailVerifiedAt",
DROP COLUMN "passwordHash",
DROP COLUMN "phone",
DROP COLUMN "phoneVerifiedAt",
DROP COLUMN "profileImage",
DROP COLUMN "updatedAt",
DROP COLUMN "userId",
ADD COLUMN     "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "password_hash" TEXT NOT NULL,
ADD COLUMN     "roles" "UserRole"[] DEFAULT ARRAY['USER']::"UserRole"[],
ADD COLUMN     "updated_at" TIMESTAMPTZ(6) NOT NULL,
ADD COLUMN     "user_id" UUID NOT NULL,
ADD CONSTRAINT "users_pkey" PRIMARY KEY ("user_id");

-- DropTable
DROP TABLE "admin_audit_logs";

-- DropTable
DROP TABLE "ai_analysis_logs";

-- DropTable
DROP TABLE "ai_messages";

-- DropTable
DROP TABLE "ai_sessions";

-- DropTable
DROP TABLE "booking_community_eligibilities";

-- DropTable
DROP TABLE "calendar_connections";

-- DropTable
DROP TABLE "calendar_events";

-- DropTable
DROP TABLE "cancellation_policies";

-- DropTable
DROP TABLE "cancellations";

-- DropTable
DROP TABLE "community_domains";

-- DropTable
DROP TABLE "community_invites";

-- DropTable
DROP TABLE "community_memberships";

-- DropTable
DROP TABLE "community_verifications";

-- DropTable
DROP TABLE "consent_records";

-- DropTable
DROP TABLE "dispute_cases";

-- DropTable
DROP TABLE "driver_earnings";

-- DropTable
DROP TABLE "driver_incentives";

-- DropTable
DROP TABLE "driver_profiles";

-- DropTable
DROP TABLE "driver_tier_histories";

-- DropTable
DROP TABLE "driver_tiers";

-- DropTable
DROP TABLE "email_verifications";

-- DropTable
DROP TABLE "emission_estimates";

-- DropTable
DROP TABLE "fare_line_items";

-- DropTable
DROP TABLE "fare_policies";

-- DropTable
DROP TABLE "fare_quotes";

-- DropTable
DROP TABLE "feedback_analyses";

-- DropTable
DROP TABLE "feedback_categories";

-- DropTable
DROP TABLE "financial_accounts";

-- DropTable
DROP TABLE "green_point_transactions";

-- DropTable
DROP TABLE "ledger_entries";

-- DropTable
DROP TABLE "ledger_transactions";

-- DropTable
DROP TABLE "moderation_reports";

-- DropTable
DROP TABLE "no_show_records";

-- DropTable
DROP TABLE "notification_deliveries";

-- DropTable
DROP TABLE "notification_preferences";

-- DropTable
DROP TABLE "notifications";

-- DropTable
DROP TABLE "password_reset_tokens";

-- DropTable
DROP TABLE "payments";

-- DropTable
DROP TABLE "penalty_assessments";

-- DropTable
DROP TABLE "phone_verifications";

-- DropTable
DROP TABLE "platform_settings";

-- DropTable
DROP TABLE "ratings";

-- DropTable
DROP TABLE "refunds";

-- DropTable
DROP TABLE "reviews";

-- DropTable
DROP TABLE "reward_redemptions";

-- DropTable
DROP TABLE "rewards";

-- DropTable
DROP TABLE "ride_communities";

-- DropTable
DROP TABLE "ride_locations";

-- DropTable
DROP TABLE "ride_routes";

-- DropTable
DROP TABLE "ride_stops";

-- DropTable
DROP TABLE "route_deviation_events";

-- DropTable
DROP TABLE "safety_evidences";

-- DropTable
DROP TABLE "safety_incidents";

-- DropTable
DROP TABLE "sos_alerts";

-- DropTable
DROP TABLE "trusted_contacts";

-- DropTable
DROP TABLE "user_preferences";

-- DropTable
DROP TABLE "user_roles";

-- DropTable
DROP TABLE "user_sessions";

-- DropTable
DROP TABLE "vehicle_documents";

-- DropTable
DROP TABLE "vehicles";

-- DropEnum
DROP TYPE "AIMessageRole";

-- DropEnum
DROP TYPE "AISessionType";

-- DropEnum
DROP TYPE "AccountStatus";

-- DropEnum
DROP TYPE "CalendarProvider";

-- DropEnum
DROP TYPE "CommunityRole";

-- DropEnum
DROP TYPE "CommunityStatus";

-- DropEnum
DROP TYPE "CommunityType";

-- DropEnum
DROP TYPE "ConsentType";

-- DropEnum
DROP TYPE "DeliveryStatus";

-- DropEnum
DROP TYPE "DeviationStatus";

-- DropEnum
DROP TYPE "DisputeStatus";

-- DropEnum
DROP TYPE "DocumentVerificationStatus";

-- DropEnum
DROP TYPE "DriverEarningStatus";

-- DropEnum
DROP TYPE "DriverEligibilityStatus";

-- DropEnum
DROP TYPE "FareLineItemType";

-- DropEnum
DROP TYPE "FareQuoteStatus";

-- DropEnum
DROP TYPE "FinancialAccountStatus";

-- DropEnum
DROP TYPE "FinancialAccountType";

-- DropEnum
DROP TYPE "GreenPointType";

-- DropEnum
DROP TYPE "IncentiveStatus";

-- DropEnum
DROP TYPE "IncidentCategory";

-- DropEnum
DROP TYPE "IncidentSeverity";

-- DropEnum
DROP TYPE "IncidentStatus";

-- DropEnum
DROP TYPE "LedgerEntryType";

-- DropEnum
DROP TYPE "LedgerTransactionType";

-- DropEnum
DROP TYPE "MembershipStatus";

-- DropEnum
DROP TYPE "ModerationStatus";

-- DropEnum
DROP TYPE "ModerationTargetType";

-- DropEnum
DROP TYPE "NoShowStatus";

-- DropEnum
DROP TYPE "NotificationChannel";

-- DropEnum
DROP TYPE "NotificationType";

-- DropEnum
DROP TYPE "PaymentMethod";

-- DropEnum
DROP TYPE "PaymentStatus";

-- DropEnum
DROP TYPE "PenaltyAssessmentStatus";

-- DropEnum
DROP TYPE "RedemptionStatus";

-- DropEnum
DROP TYPE "RefundStatus";

-- DropEnum
DROP TYPE "ResponsibleParty";

-- DropEnum
DROP TYPE "RoleType";

-- DropEnum
DROP TYPE "SOSAlertStatus";

-- DropEnum
DROP TYPE "SentimentLabel";

-- DropEnum
DROP TYPE "StopType";

-- DropEnum
DROP TYPE "ThemeType";

-- DropEnum
DROP TYPE "VehicleDocumentType";

-- DropEnum
DROP TYPE "VehicleType";

-- DropEnum
DROP TYPE "VerificationAttemptStatus";

-- DropEnum
DROP TYPE "VerificationMethod";

-- DropEnum
DROP TYPE "VerificationStatus";

-- CreateTable
CREATE TABLE "transactions" (
    "transaction_id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "type" "TransactionType" NOT NULL,
    "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("transaction_id")
);

-- CreateIndex
CREATE INDEX "transactions_booking_id_idx" ON "transactions"("booking_id");

-- CreateIndex
CREATE INDEX "transactions_status_idx" ON "transactions"("status");

-- CreateIndex
CREATE INDEX "bookings_ride_id_idx" ON "bookings"("ride_id");

-- CreateIndex
CREATE INDEX "bookings_user_id_idx" ON "bookings"("user_id");

-- CreateIndex
CREATE INDEX "bookings_status_idx" ON "bookings"("status");

-- CreateIndex
CREATE INDEX "communities_user_id_idx" ON "communities"("user_id");

-- CreateIndex
CREATE INDEX "rides_driver_id_idx" ON "rides"("driver_id");

-- CreateIndex
CREATE INDEX "rides_community_id_idx" ON "rides"("community_id");

-- CreateIndex
CREATE INDEX "rides_departure_time_idx" ON "rides"("departure_time");

-- CreateIndex
CREATE INDEX "rides_status_idx" ON "rides"("status");

-- AddForeignKey
ALTER TABLE "communities" ADD CONSTRAINT "communities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rides" ADD CONSTRAINT "rides_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rides" ADD CONSTRAINT "rides_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "communities"("community_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_ride_id_fkey" FOREIGN KEY ("ride_id") REFERENCES "rides"("ride_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("booking_id") ON DELETE RESTRICT ON UPDATE CASCADE;
