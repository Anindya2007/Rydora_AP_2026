Rydora — Database Reference
Status: preliminary reference, not a verified copy of the current Rydora Prisma schema.

This README documents the earlier nine-table RideShare database design discussed by the team. The newer Rydora implementation prompt refers to additional fare, ledger, SOS, safety, trusted-contact, calendar, and AI-analysis requirements. The actual Rydora repository's schema.prisma, migrations, database audit, and correction plan must be inspected before this document is treated as the final database specification.

1. Project overview
Rydora is a community-based ride-sharing project. The earlier database design supports the basic ride-sharing workflow:
1. A person has a user account.
2. A user can act as a rider, a driver, or both.
3. Users can belong to university or office communities.
4. A driver registers a vehicle and creates a ride.
5. Riders discover rides and create bookings.
6. A booking can be cancelled, with the cancellation recorded.
7. Participants can rate one another after a ride.
The database is relational: separate tables store different kinds of information, and primary/foreign keys connect related records.
2. Earlier nine-table design
The earlier RideShare reference contains these nine tables:
Table	Purpose
users	Stores the basic account information for each person.
user_roles	Stores the roles assigned to a user. A user may be both a rider and a driver.
communities	Stores university and office communities used for community-based matching.
user_communities	Connects users to the communities they belong to.
vehicles	Stores vehicles registered by drivers.
rides	Stores rides created by drivers.
bookings	Stores which rider booked which ride and how many seats were booked.
cancellations	Stores cancellation details for a booking.
ratings	Stores ratings users give to other users in relation to a ride.


2.1 users
Stores the basic information for every person using the application.
Field	Earlier reference type	Key / rule	Meaning
user_id	INTEGER	Primary key	Unique user identifier.
name	VARCHAR(100)	—	User's name.
email	VARCHAR(150)	Unique	User's email address.
phone	VARCHAR(15)	Unique	User's phone number.
password_hash	TEXT	—	Hashed password; never store a plain-text password.
created_at	TIMESTAMP	—	Account creation time.


2.2 user_roles
Stores the role or roles assigned to a user. The same user may have both roles.
Field	Earlier reference type	Key / rule	Meaning
user_id	INTEGER	Primary key part; foreign key to users.user_id	User who has the role.
role	VARCHAR(20)	Primary key part	Role value, such as rider or driver.


The earlier design uses a composite primary key: (user_id, role).
2.3 communities
Stores university or office communities.
Field	Earlier reference type	Key / rule	Meaning
community_id	INTEGER	Primary key	Unique community identifier.
name	VARCHAR(150)	—	Community name.
community_type	VARCHAR(20)	—	Community category, such as university or office.
email_domain	VARCHAR(150)	—	Email domain associated with the community.


2.4 user_communities
A junction table that connects users and communities. It represents community membership without duplicating user or community details.
Field	Earlier reference type	Key / rule	Meaning
user_id	INTEGER	Primary key part; foreign key to users.user_id	User who belongs to the community.
community_id	INTEGER	Primary key part; foreign key to communities.community_id	Community the user belongs to.
joined_at	TIMESTAMP	—	When the user joined.


The earlier design uses a composite primary key: (user_id, community_id).
2.5 vehicles
Stores vehicle information registered by drivers.
Field	Earlier reference type	Key / rule	Meaning
vehicle_id	INTEGER	Primary key	Unique vehicle identifier.
driver_id	INTEGER	Foreign key to users.user_id	User who owns/registers the vehicle as a driver.
vehicle_model	VARCHAR(100)	—	Vehicle model.
registration_no	VARCHAR(30)	Unique	Vehicle registration number.
vehicle_type	VARCHAR(30)	—	Vehicle category.
seat_capacity	INTEGER	—	Vehicle seat capacity.


2.6 rides
Stores the ride offered by a driver.
Field	Earlier reference type	Key / rule	Meaning
ride_id	INTEGER	Primary key	Unique ride identifier.
driver_id	INTEGER	Foreign key to users.user_id	Driver offering the ride.
vehicle_id	INTEGER	Foreign key to vehicles.vehicle_id	Vehicle used for the ride.
community_id	INTEGER	Foreign key to communities.community_id	Community associated with the ride.
source	VARCHAR(150)	—	Starting location.
destination	VARCHAR(150)	—	Destination.
ride_date	DATE	—	Ride date.
departure_time	TIME	—	Departure time.
total_seats	INTEGER	—	Seats offered for the ride.
available_seats	INTEGER	—	Seats still available.
fare_per_seat	NUMERIC(10,2)	—	Fare per seat in the earlier design.
status	VARCHAR(30)	—	Ride status, such as active, completed, or cancelled.


2.7 bookings
Stores each rider's booking for a ride. A ride can have multiple booking records.
Field	Earlier reference type	Key / rule	Meaning
booking_id	INTEGER	Primary key	Unique booking identifier.
ride_id	INTEGER	Foreign key to rides.ride_id	Ride being booked.
rider_id	INTEGER	Foreign key to users.user_id	User making the booking.
seats_booked	INTEGER	—	Number of seats requested.
booking_status	VARCHAR(30)	—	Booking status, such as confirmed or cancelled.
booked_at	TIMESTAMP	—	Booking creation time.


2.8 cancellations
Stores the cancellation information associated with a booking.
Field	Earlier reference type	Key / rule	Meaning
cancellation_id	INTEGER	Primary key	Unique cancellation identifier.
booking_id	INTEGER	Foreign key to bookings.booking_id	Booking being cancelled.
cancelled_by	INTEGER	Foreign key to users.user_id	User who cancelled.
reason	TEXT	—	Cancellation reason.
cancelled_at	TIMESTAMP	—	Cancellation time.
cancellation_fee	NUMERIC(10,2)	—	Cancellation fee recorded by the earlier design.


2.9 ratings
Stores ratings between users after a ride.
Field	Earlier reference type	Key / rule	Meaning
rating_id	INTEGER	Primary key	Unique rating identifier.
ride_id	INTEGER	Foreign key to rides.ride_id	Ride related to the rating.
from_user_id	INTEGER	Foreign key to users.user_id	User giving the rating.
to_user_id	INTEGER	Foreign key to users.user_id	User receiving the rating.
rating	INTEGER	Intended range: 1–5	Numeric rating.
review	TEXT	Optional	Written review.
created_at	TIMESTAMP	—	Rating creation time.


3. Relationships in the earlier design
Relationship	Meaning
users → user_roles	One user can have multiple roles.
users ↔ communities through user_communities	Users can belong to communities, and a community can have multiple users.
users → vehicles	A user acting as a driver can register vehicles.
users → rides	A driver can create multiple rides.
vehicles → rides	A vehicle can be used by rides over time.
communities → rides	A community can be associated with multiple rides.
rides → bookings	One ride can have multiple bookings.
users → bookings	A rider can make multiple bookings.
bookings → cancellations	A booking can have cancellation information.
users → ratings as sender	A user can give multiple ratings.
users → ratings as recipient	A user can receive multiple ratings.
rides → ratings	A ride can be associated with ratings.


Conceptual relationship map:
users ───────< user_roles
  │
  ├──────────< user_communities >────────── communities
  │                                           │
  ├──────────< vehicles                       │
  │                 │                         │
  └──────────< rides >────────────────────────┘
                  │
                  └──────────< bookings >──────── users (rider)
                                  │
                                  └────────── cancellations

users ───────────< ratings >────────── users
                      │
                      └────────────── rides
This is a conceptual map of the earlier design. The actual Prisma relation names and cardinalities must be checked against the current schema.
4. Important data-integrity behavior
The earlier design implies the following application rules. These need appropriate backend checks and, where possible, database constraints:
- A user can have rider and driver roles.
- A vehicle must refer to an existing user.
- A ride must refer to an existing driver, vehicle, and community.
- A booking must refer to an existing ride and rider.
- A booking must not reserve more seats than are available.
- Available seats must not become negative or exceed the ride's total seats.
- Booking creation and available-seat updates should succeed or fail together in a database transaction.
- Cancellation status, cancellation history, and seat restoration should be handled consistently.
- Ratings should be within the allowed score range and should relate to a legitimate ride participation.
- Passwords must be stored as secure hashes, never as plain-text values.
These are design intentions, not confirmation that the current Rydora database already enforces them.
5. Rydora-specific requirements that need repository verification
The newer Rydora implementation instructions mention additional database behavior not described by the earlier nine-table reference. The following items must be checked against the actual Rydora audit, correction plan, Prisma schema, and migration files:
Requirement from the newer Rydora prompt	What needs to be verified
FareQuote must not be reused by multiple bookings	Actual FareQuote model, relation cardinality, and relevant uniqueness constraint.
Rebooking after cancellation	Active-booking uniqueness must exclude cancelled bookings, using the actual status values and physical PostgreSQL names.
Seat-count limits	Database constraints and service-level checks must enforce valid seat counts.
SOS without an active ride	The emergency representation must allow a missing ride association when appropriate.
Safety evidence retention	Deleting an incident must not cascade-delete required evidence.
Fare-policy version preservation	The booking/quote must retain the policy version and calculation inputs or snapshot used.
Ledger reversals	Financial records must support reversal entries without deleting or overwriting the original entries.
Booking eligibility and departure-time snapshot	The booking must preserve the agreed community eligibility and departure-time information.
Trusted-contact uniqueness	A user must not have duplicate trusted contacts for the same phone number.
Multiple calendar accounts	Calendar uniqueness must allow legitimate separate accounts for a user.
AI analysis references	Any polymorphic reference must be explicitly documented and validated appropriately.
Cleanup indexes	Each additional index must be justified by query patterns and existing indexes.


Do not infer table names or fields for these requirements from this README. The newer Rydora schema may contain models that are not part of the earlier nine-table design.
6. Scope and limitations of this README
- This document describes the earlier nine-table RideShare reference only.
- It is not a substitute for the current backend/prisma/schema.prisma.
- It does not prove that the current repository contains these exact model names, field names, enum values, PostgreSQL table names, or column names.
- The newer Rydora prompt refers to additional fare, financial-ledger, SOS, safety, trusted-contact, calendar, and AI-analysis behavior that needs separate verification.
- Payment was intentionally left out of the earlier nine-table reference. The newer Rydora requirements mention fare quotes and ledger reversals, so the current financial design must be verified separately.
- No migration should be generated or applied based only on this README.
7. What must be checked before this becomes the final Rydora database README
1. Read the current backend/prisma/schema.prisma.
2. Read the database audit and approved correction plan.
3. Inspect all migration directories and migration SQL.
4. Confirm every Prisma model, field, enum, relation, and referential action.
5. Confirm the physical PostgreSQL table, column, and enum names, including all @map and @@map mappings.
6. Match each approved correction to its actual schema implementation.
7. Update this README only after those checks are complete.
Document status: Preliminary database reference awaiting inspection of the current Rydora repository and database audit.
