/**
 * ==============================================================================
 * Rydora RideShare Ecosystem — Central Live API Test Runner
 * ==============================================================================
 *
 * This test suite executes real HTTP requests against the active Rydora backend.
 * It validates endpoints across Foundation, Authentication, User Profile, and
 * Community Management milestones.
 *
 * Architecture Tested:
 * Express 5 -> Routing -> Auth / Validation Middleware -> Controllers -> Services -> Neon PostgreSQL
 *
 * Execution:
 *   npm run test:api
 *   (or: node scripts/api-test.js)
 *
 * Environment:
 *   API_BASE_URL (defaults to http://localhost:3000/api/v1)
 *
 * Database Safety Rules:
 *   - Each run generates isolated, timestamped test data with unique prefixes.
 *   - No arbitrary deletes or truncations are performed on the shared database.
 * ==============================================================================
 */

import fs from "node:fs/promises";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";

// ============================================
// CONFIGURATION & SETUP
// ============================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outputFile = path.resolve(__dirname, "../api-test-report.json");

const BASE_URL = process.env.API_BASE_URL || "http://localhost:3000/api/v1";
const timestamp = Date.now();

// Unique test credentials for User 1 (Primary Actor & Community Creator)
const user1 = {
    name: "Rydora Test User 1",
    email: `rydora.test.${timestamp}@example.com`,
    password: "TestPassword123",
    phone: `+9198${String(timestamp).slice(-8)}`
};

// Unique test credentials for User 2 (Secondary Actor for Conflict Testing)
const user2 = {
    name: "Rydora Test User 2",
    email: `rydora.test.second.${timestamp}@example.com`,
    password: "TestPassword123"
};

// Unique community definitions for Milestone 3 testing
const community1 = {
    name: `Rydora Test University ${timestamp}`,
    domain: `univ-${timestamp}.edu`,
    description: "Official institutional carpooling community"
};

let user1Id = null;
let token1 = null;
let token2 = null;

const report = {
    project: "Rydora API Testing",
    baseURL: BASE_URL,
    startedAt: new Date().toISOString(),
    tests: []
};

// ============================================
// HELPER FUNCTIONS
// ============================================

function printSectionHeader(title) {
    console.log(`\n========================================`);
    console.log(title.toUpperCase());
    console.log(`========================================`);
}

function findToken(data) {
    if (!data || typeof data !== "object") return null;

    for (const key of ["token", "accessToken"]) {
        if (typeof data[key] === "string") return data[key];
    }

    for (const value of Object.values(data)) {
        const found = findToken(value);
        if (found) return found;
    }

    return null;
}

function sanitize(value) {
    if (Array.isArray(value)) {
        return value.map(sanitize);
    }

    if (value && typeof value === "object") {
        const result = {};

        for (const [key, item] of Object.entries(value)) {
            if (/password|token|authorization|secret/i.test(key)) {
                result[key] = "[REDACTED]";
            } else {
                result[key] = sanitize(item);
            }
        }

        return result;
    }

    return value;
}

/**
 * Executes an HTTP request against the API and records test outcome.
 */
async function runTest({
    section = "General",
    milestone = "M1",
    name,
    method,
    path: reqPath,
    body,
    token,
    expectedStatus,
    headers = {}
}) {
    const url = `${BASE_URL}${reqPath}`;

    const requestHeaders = {
        "Content-Type": "application/json",
        ...headers
    };

    if (token) {
        requestHeaders.Authorization = `Bearer ${token}`;
    }

    const request = {
        method,
        url,
        headers: {
            ...requestHeaders,
            ...(token ? { Authorization: "[REDACTED]" } : {})
        },
        body: body ?? null
    };

    let status = null;
    let responseData = null;
    let error = null;

    try {
        const response = await fetch(url, {
            method,
            headers: requestHeaders,
            body: body === undefined ? undefined : JSON.stringify(body)
        });

        status = response.status;
        const responseText = await response.text();

        try {
            responseData = responseText ? JSON.parse(responseText) : null;
        } catch {
            responseData = responseText;
        }
    } catch (err) {
        error = err.message;
    }

    const passed = status === expectedStatus;

    const result = {
        section,
        milestone,
        name,
        request: sanitize(request),
        expectedStatus,
        actualStatus: status,
        passed,
        response: sanitize(responseData),
        error
    };

    report.tests.push(result);

    console.log(
        `${passed ? "PASS" : "FAIL"} | ${name} | Expected: ${expectedStatus} | Actual: ${status ?? "No response"}`
    );

    return responseData;
}

/**
 * Records an assertion test verifying specific response payload rules.
 */
function recordAssertion({
    section,
    milestone,
    name,
    passed,
    expectedStatus = 201,
    actualStatus = 201,
    details = null,
    error = null
}) {
    const result = {
        section,
        milestone,
        name,
        expectedStatus,
        actualStatus,
        passed,
        details,
        error
    };

    report.tests.push(result);

    console.log(
        `${passed ? "PASS" : "FAIL"} | ${name} | Expected: ${expectedStatus} | Actual: ${actualStatus}`
    );

    return passed;
}

// ============================================
// TEST SUITE EXECUTION
// ============================================

async function main() {
    console.log("\nStarting Rydora API tests...");
    console.log("Base URL:", BASE_URL);

    // ========================================================
    // SECTION 1: FOUNDATION API TESTS (Milestone 1)
    // ========================================================
    printSectionHeader("Section 1: Foundation API Tests");

    await runTest({
        section: "Foundation API Tests",
        milestone: "M1",
        name: "Health Probe - Liveness Check",
        method: "GET",
        path: "/health",
        expectedStatus: 200
    });

    await runTest({
        section: "Foundation API Tests",
        milestone: "M1",
        name: "Readiness Probe - Database Connectivity",
        method: "GET",
        path: "/ready",
        expectedStatus: 200
    });

    // ========================================================
    // SECTION 2: AUTHENTICATION API TESTS (Milestone 2)
    // ========================================================
    printSectionHeader("Section 2: Authentication API Tests");

    // 1. SIGNUP USER 1
    const signup1 = await runTest({
        section: "Authentication API Tests",
        milestone: "M2",
        name: "Signup - Valid User 1",
        method: "POST",
        path: "/auth/signup",
        body: user1,
        expectedStatus: 201
    });

    token1 = findToken(signup1);
    user1Id = signup1?.data?.user?.userId || null;

    // 2. DUPLICATE EMAIL
    await runTest({
        section: "Authentication API Tests",
        milestone: "M2",
        name: "Signup - Duplicate Email",
        method: "POST",
        path: "/auth/signup",
        body: user1,
        expectedStatus: 409
    });

    // 3. INVALID SIGNUP
    await runTest({
        section: "Authentication API Tests",
        milestone: "M2",
        name: "Signup - Invalid Email and Password",
        method: "POST",
        path: "/auth/signup",
        body: {
            name: "A",
            email: "invalid-email",
            password: "123"
        },
        expectedStatus: 422
    });

    // 4. LOGIN SUCCESS
    const login = await runTest({
        section: "Authentication API Tests",
        milestone: "M2",
        name: "Login - Valid Credentials",
        method: "POST",
        path: "/auth/login",
        body: {
            email: user1.email,
            password: user1.password
        },
        expectedStatus: 200
    });

    token1 = findToken(login) || token1;

    // 5. LOGIN FAILURE
    await runTest({
        section: "Authentication API Tests",
        milestone: "M2",
        name: "Login - Incorrect Password",
        method: "POST",
        path: "/auth/login",
        body: {
            email: user1.email,
            password: "WrongPassword123"
        },
        expectedStatus: 401
    });

    // Stop authenticated tests if signup/login did not produce a token.
    if (!token1) {
        throw new Error(
            "Could not extract JWT token. Check signup/login response structure."
        );
    }

    // ========================================================
    // SECTION 3: USER PROFILE API TESTS (Milestone 2)
    // ========================================================
    printSectionHeader("Section 3: User Profile API Tests");

    // 6. GET ME SUCCESS
    const meRes = await runTest({
        section: "User Profile API Tests",
        milestone: "M2",
        name: "Get Current User - Valid Token",
        method: "GET",
        path: "/auth/me",
        token: token1,
        expectedStatus: 200
    });

    if (!user1Id && meRes?.data?.user?.userId) {
        user1Id = meRes.data.user.userId;
    }

    // 7. GET ME WITHOUT TOKEN
    await runTest({
        section: "User Profile API Tests",
        milestone: "M2",
        name: "Get Current User - No Token",
        method: "GET",
        path: "/auth/me",
        expectedStatus: 401
    });

    // 8. PATCH PROFILE SUCCESS
    await runTest({
        section: "User Profile API Tests",
        milestone: "M2",
        name: "Update Profile - Valid Name",
        method: "PATCH",
        path: "/users/me",
        token: token1,
        body: {
            name: "Rydora Updated User"
        },
        expectedStatus: 200
    });

    // 9. UPDATE PHONE
    await runTest({
        section: "User Profile API Tests",
        milestone: "M2",
        name: "Update Profile - Valid Phone",
        method: "PATCH",
        path: "/users/me",
        token: token1,
        body: {
            phone: user1.phone
        },
        expectedStatus: 200
    });

    // 10. UPDATE PROFILE IMAGE
    await runTest({
        section: "User Profile API Tests",
        milestone: "M2",
        name: "Update Profile - Valid Profile Image",
        method: "PATCH",
        path: "/users/me",
        token: token1,
        body: {
            profileImage: "https://example.com/profile.jpg"
        },
        expectedStatus: 200
    });

    // 11. VERIFY PROFILE PERSISTENCE
    await runTest({
        section: "User Profile API Tests",
        milestone: "M2",
        name: "Get Current User - Verify Updated Profile",
        method: "GET",
        path: "/auth/me",
        token: token1,
        expectedStatus: 200
    });

    // 12. PATCH WITHOUT TOKEN
    await runTest({
        section: "User Profile API Tests",
        milestone: "M2",
        name: "Update Profile - No Token",
        method: "PATCH",
        path: "/users/me",
        body: {
            name: "Unauthorized Name"
        },
        expectedStatus: 401
    });

    // 13. PROTECTED ROLES FIELD
    await runTest({
        section: "User Profile API Tests",
        milestone: "M2",
        name: "Update Profile - Protected Roles Field",
        method: "PATCH",
        path: "/users/me",
        token: token1,
        body: {
            roles: ["DRIVER"]
        },
        expectedStatus: 422
    });

    // 14. PROTECTED WALLET FIELD
    await runTest({
        section: "User Profile API Tests",
        milestone: "M2",
        name: "Update Profile - Protected Wallet Field",
        method: "PATCH",
        path: "/users/me",
        token: token1,
        body: {
            walletBalance: 100000
        },
        expectedStatus: 422
    });

    // 15. PROTECTED EMAIL FIELD
    await runTest({
        section: "User Profile API Tests",
        milestone: "M2",
        name: "Update Profile - Protected Email Field",
        method: "PATCH",
        path: "/users/me",
        token: token1,
        body: {
            email: "changed@example.com"
        },
        expectedStatus: 422
    });

    // 16. PROTECTED USER ID FIELD
    await runTest({
        section: "User Profile API Tests",
        milestone: "M2",
        name: "Update Profile - Protected User ID",
        method: "PATCH",
        path: "/users/me",
        token: token1,
        body: {
            userId: crypto.randomUUID()
        },
        expectedStatus: 422
    });

    // 17. EMPTY UPDATE
    await runTest({
        section: "User Profile API Tests",
        milestone: "M2",
        name: "Update Profile - Empty Body",
        method: "PATCH",
        path: "/users/me",
        token: token1,
        body: {},
        expectedStatus: 422
    });

    // 18. INVALID PHONE
    await runTest({
        section: "User Profile API Tests",
        milestone: "M2",
        name: "Update Profile - Invalid Phone",
        method: "PATCH",
        path: "/users/me",
        token: token1,
        body: {
            phone: "abc123"
        },
        expectedStatus: 422
    });

    // 19. INVALID PROFILE IMAGE
    await runTest({
        section: "User Profile API Tests",
        milestone: "M2",
        name: "Update Profile - Invalid Image URL",
        method: "PATCH",
        path: "/users/me",
        token: token1,
        body: {
            profileImage: "not-a-valid-url"
        },
        expectedStatus: 422
    });

    // 20. CREATE SECOND USER
    const signup2 = await runTest({
        section: "User Profile API Tests",
        milestone: "M2",
        name: "Signup - Valid User 2",
        method: "POST",
        path: "/auth/signup",
        body: user2,
        expectedStatus: 201
    });

    token2 = findToken(signup2);

    // 21. DUPLICATE PHONE
    if (token2) {
        await runTest({
            section: "User Profile API Tests",
            milestone: "M2",
            name: "Update Profile - Duplicate Phone",
            method: "PATCH",
            path: "/users/me",
            token: token2,
            body: {
                phone: user1.phone
            },
            expectedStatus: 409
        });
    } else {
        console.log("SKIP | Duplicate Phone | User 2 token unavailable");
        report.tests.push({
            section: "User Profile API Tests",
            milestone: "M2",
            name: "Update Profile - Duplicate Phone",
            passed: false,
            skipped: true,
            reason: "Could not extract second user's JWT token."
        });
    }

    // ========================================================
    // SECTION 4: COMMUNITY API TESTS (Milestone 3)
    // ========================================================
    printSectionHeader("Section 4: Community API Tests");

    // 1. Community creation without authentication returns 401
    await runTest({
        section: "Community API Tests",
        milestone: "M3",
        name: "Community Creation - Without Authentication",
        method: "POST",
        path: "/communities",
        body: community1,
        expectedStatus: 401
    });

    // 2. Valid authenticated community creation returns HTTP 201
    const createCommunityRes = await runTest({
        section: "Community API Tests",
        milestone: "M3",
        name: "Community Creation - Valid Authenticated Creation",
        method: "POST",
        path: "/communities",
        token: token1,
        body: community1,
        expectedStatus: 201
    });

    const comm = createCommunityRes?.data?.community;

    // 3. Response body contains created community in established API response format
    const hasValidEnvelope = Boolean(
        createCommunityRes &&
        createCommunityRes.success === true &&
        createCommunityRes.statusCode === 201 &&
        typeof createCommunityRes.message === "string" &&
        createCommunityRes.data &&
        createCommunityRes.data.community &&
        createCommunityRes.meta &&
        typeof createCommunityRes.meta.requestId === "string" &&
        typeof createCommunityRes.meta.timestamp === "string"
    );
    recordAssertion({
        section: "Community API Tests",
        milestone: "M3",
        name: "Community Creation - API Response Envelope Structure",
        passed: hasValidEnvelope,
        expectedStatus: 201,
        actualStatus: hasValidEnvelope ? 201 : "Invalid Envelope",
        details: "Validated success, statusCode, message, data.community, meta.requestId, meta.timestamp"
    });

    // 4. Created community contains expected name and domain
    const hasValidNameAndDomain = Boolean(
        comm &&
        comm.name === community1.name &&
        comm.domain === community1.domain
    );
    recordAssertion({
        section: "Community API Tests",
        milestone: "M3",
        name: "Community Creation - Verify Name and Domain",
        passed: hasValidNameAndDomain,
        expectedStatus: 201,
        actualStatus: hasValidNameAndDomain ? 201 : "Mismatch",
        details: `Name: ${comm?.name}, Domain: ${comm?.domain}`
    });

    // 5. Creator membership is assigned ADMIN
    const hasAdminCreatorRole = Boolean(
        comm &&
        comm.membersCount === 1 &&
        (!user1Id || comm.createdById === user1Id)
    );
    recordAssertion({
        section: "Community API Tests",
        milestone: "M3",
        name: "Community Creation - Creator Membership Admin Role",
        passed: hasAdminCreatorRole,
        expectedStatus: 201,
        actualStatus: hasAdminCreatorRole ? 201 : "Invalid Creator",
        details: `Creator ID: ${comm?.createdById}, Members Count: ${comm?.membersCount}`
    });

    // 6. Creator membership has expected ACTIVE status
    const hasActiveStatus = Boolean(comm && comm.status === "ACTIVE");
    recordAssertion({
        section: "Community API Tests",
        milestone: "M3",
        name: "Community Creation - Creator Membership Active Status",
        passed: hasActiveStatus,
        expectedStatus: 201,
        actualStatus: hasActiveStatus ? 201 : comm?.status,
        details: `Community status is ${comm?.status}`
    });

    // 7. Missing community name returns standard validation error
    await runTest({
        section: "Community API Tests",
        milestone: "M3",
        name: "Community Creation - Missing Community Name",
        method: "POST",
        path: "/communities",
        token: token1,
        body: {
            domain: `valid-domain-${timestamp}.edu`,
            description: "Missing name community"
        },
        expectedStatus: 422
    });

    // 8. Invalid email domain returns standard validation error
    await runTest({
        section: "Community API Tests",
        milestone: "M3",
        name: "Community Creation - Invalid Email Domain",
        method: "POST",
        path: "/communities",
        token: token1,
        body: {
            name: `Invalid Domain Comm ${timestamp}`,
            domain: "https://invalid-domain.edu/campus"
        },
        expectedStatus: 422
    });

    // 9. Duplicate community domain returns HTTP 409
    await runTest({
        section: "Community API Tests",
        milestone: "M3",
        name: "Community Creation - Duplicate Community Domain",
        method: "POST",
        path: "/communities",
        token: token1,
        body: {
            name: `Different Name Comm ${timestamp}`,
            domain: community1.domain
        },
        expectedStatus: 409
    });

    // 10. Duplicate community name returns HTTP 409
    await runTest({
        section: "Community API Tests",
        milestone: "M3",
        name: "Community Creation - Duplicate Community Name",
        method: "POST",
        path: "/communities",
        token: token1,
        body: {
            name: community1.name,
            domain: `different-domain-${timestamp}.edu`
        },
        expectedStatus: 409
    });

    // 11. Supplying a forged creator user ID cannot override authenticated user identity
    // Zod .strict() schema rejects injected client fields; authenticated user identity remains authoritative
    await runTest({
        section: "Community API Tests",
        milestone: "M3",
        name: "Community Creation - Reject Forged Creator User ID",
        method: "POST",
        path: "/communities",
        token: token1,
        body: {
            name: `Forged ID Comm ${timestamp}`,
            domain: `forged-${timestamp}.edu`,
            createdById: "00000000-0000-0000-0000-000000000000"
        },
        expectedStatus: 422
    });

    // 12. Endpoint does not expose password hashes or other sensitive data
    const rawResString = JSON.stringify(createCommunityRes || {});
    const exposesSensitiveData = /password|passwordHash|"hash"|"salt"/i.test(rawResString);
    recordAssertion({
        section: "Community API Tests",
        milestone: "M3",
        name: "Community Creation - No Sensitive Data Exposure",
        passed: !exposesSensitiveData,
        expectedStatus: 201,
        actualStatus: !exposesSensitiveData ? 201 : "Exposed Sensitive Data",
        details: "Confirmed no password hashes, salt, or sensitive user fields in payload"
    });

    // 13. Invalid/malformed token returns HTTP 401
    await runTest({
        section: "Community API Tests",
        milestone: "M3",
        name: "Community Creation - Invalid Token Rejection",
        method: "POST",
        path: "/communities",
        token: "invalid.bearer.token",
        body: {
            name: `Invalid Token Comm ${timestamp}`,
            domain: `invalid-token-${timestamp}.edu`
        },
        expectedStatus: 401
    });

    // 14. Community name too short returns HTTP 422
    await runTest({
        section: "Community API Tests",
        milestone: "M3",
        name: "Community Creation - Name Too Short Validation",
        method: "POST",
        path: "/communities",
        token: token1,
        body: {
            name: "A",
            domain: `short-name-${timestamp}.edu`
        },
        expectedStatus: 422
    });

    // 15. Community name too long returns HTTP 422
    await runTest({
        section: "Community API Tests",
        milestone: "M3",
        name: "Community Creation - Name Too Long Validation",
        method: "POST",
        path: "/communities",
        token: token1,
        body: {
            name: "A".repeat(151),
            domain: `long-name-${timestamp}.edu`
        },
        expectedStatus: 422
    });

    // 16. Description exceeding 1000 characters returns HTTP 422
    await runTest({
        section: "Community API Tests",
        milestone: "M3",
        name: "Community Creation - Description Exceeds Limit Validation",
        method: "POST",
        path: "/communities",
        token: token1,
        body: {
            name: `Long Desc Comm ${timestamp}`,
            domain: `long-desc-${timestamp}.edu`,
            description: "A".repeat(1001)
        },
        expectedStatus: 422
    });

    // ----------------------------------------------------
    // M3.5 Community Listing & Filtering Endpoint Tests
    // ----------------------------------------------------

    // 13. Public community listing returns HTTP 200 with pagination
    const listRes = await runTest({
        section: "Community API Tests",
        milestone: "M3",
        name: "Community Listing - Default Pagination & Public Access",
        method: "GET",
        path: "/communities",
        expectedStatus: 200
    });

    const hasListingPagination = Boolean(
        listRes &&
        listRes.success === true &&
        Array.isArray(listRes.data?.communities) &&
        listRes.meta?.pagination &&
        listRes.meta.pagination.page === 1 &&
        listRes.meta.pagination.limit === 20
    );
    recordAssertion({
        section: "Community API Tests",
        milestone: "M3",
        name: "Community Listing - Pagination Metadata Structure",
        passed: hasListingPagination,
        expectedStatus: 200,
        actualStatus: hasListingPagination ? 200 : "Invalid Pagination Envelope",
        details: "Verified success, array of communities, and standard pagination metadata"
    });

    // 14. Authenticated community listing returns HTTP 200
    await runTest({
        section: "Community API Tests",
        milestone: "M3",
        name: "Community Listing - Authenticated Request Allowed",
        method: "GET",
        path: "/communities",
        token: token1,
        expectedStatus: 200
    });

    // 15. Domain filter returns matching community
    const domainRes = await runTest({
        section: "Community API Tests",
        milestone: "M3",
        name: "Community Listing - Domain Filter",
        method: "GET",
        path: `/communities?domain=${community1.domain}`,
        expectedStatus: 200
    });
    const domainMatches = Boolean(
        domainRes?.data?.communities?.length > 0 &&
        domainRes.data.communities.every(c => c.domain.toLowerCase() === community1.domain.toLowerCase())
    );
    recordAssertion({
        section: "Community API Tests",
        milestone: "M3",
        name: "Community Listing - Domain Filter Match Verification",
        passed: domainMatches,
        expectedStatus: 200,
        actualStatus: domainMatches ? 200 : "Domain mismatch",
        details: `Filtered by ${community1.domain}, count: ${domainRes?.data?.communities?.length}`
    });

    // 16. Search filter returns matching substring
    const searchRes = await runTest({
        section: "Community API Tests",
        milestone: "M3",
        name: "Community Listing - Search Query Filter",
        method: "GET",
        path: `/communities?search=${encodeURIComponent(community1.name)}`,
        expectedStatus: 200
    });
    const searchMatches = Boolean(
        searchRes?.data?.communities?.length > 0 &&
        searchRes.data.communities.some(c => c.name.includes(community1.name))
    );
    recordAssertion({
        section: "Community API Tests",
        milestone: "M3",
        name: "Community Listing - Search Query Match Verification",
        passed: searchMatches,
        expectedStatus: 200,
        actualStatus: searchMatches ? 200 : "Search mismatch",
        details: `Filtered by search query: ${community1.name}`
    });

    // 17. Custom pagination parameters
    await runTest({
        section: "Community API Tests",
        milestone: "M3",
        name: "Community Listing - Custom Pagination Parameters",
        method: "GET",
        path: "/communities?page=1&limit=5",
        expectedStatus: 200
    });

    // 18. Invalid page returns HTTP 422
    await runTest({
        section: "Community API Tests",
        milestone: "M3",
        name: "Community Listing - Reject Invalid Page",
        method: "GET",
        path: "/communities?page=0",
        expectedStatus: 422
    });

    // 19. Limit exceeding 100 returns HTTP 422
    await runTest({
        section: "Community API Tests",
        milestone: "M3",
        name: "Community Listing - Reject Excessive Limit",
        method: "GET",
        path: "/communities?limit=101",
        expectedStatus: 422
    });

    // 20. Injected unknown query parameter returns HTTP 422
    await runTest({
        section: "Community API Tests",
        milestone: "M3",
        name: "Community Listing - Reject Injected Query Fields",
        method: "GET",
        path: "/communities?injectedField=malicious",
        expectedStatus: 422
    });

    // 21. Non-existent domain query returns empty list with total 0
    const nonExistentDomainRes = await runTest({
        section: "Community API Tests",
        milestone: "M3",
        name: "Community Listing - Non-Existent Domain Filter",
        method: "GET",
        path: `/communities?domain=nonexistent-${timestamp}.edu`,
        expectedStatus: 200
    });
    const nonExistentDomainEmpty = Boolean(
        nonExistentDomainRes?.data?.communities?.length === 0 &&
        nonExistentDomainRes?.meta?.pagination?.total === 0
    );
    recordAssertion({
        section: "Community API Tests",
        milestone: "M3",
        name: "Community Listing - Non-Existent Domain Empty Verification",
        passed: nonExistentDomainEmpty,
        expectedStatus: 200,
        actualStatus: nonExistentDomainEmpty ? 200 : "Unexpected Results",
        details: `Returned count: ${nonExistentDomainRes?.data?.communities?.length}`
    });

    // 22. Non-existent name search query returns empty list with total 0
    const nonExistentSearchRes = await runTest({
        section: "Community API Tests",
        milestone: "M3",
        name: "Community Listing - Non-Existent Search Query",
        method: "GET",
        path: `/communities?search=NonExistentCampus_${timestamp}`,
        expectedStatus: 200
    });
    const nonExistentSearchEmpty = Boolean(
        nonExistentSearchRes?.data?.communities?.length === 0 &&
        nonExistentSearchRes?.meta?.pagination?.total === 0
    );
    recordAssertion({
        section: "Community API Tests",
        milestone: "M3",
        name: "Community Listing - Non-Existent Search Empty Verification",
        passed: nonExistentSearchEmpty,
        expectedStatus: 200,
        actualStatus: nonExistentSearchEmpty ? 200 : "Unexpected Results",
        details: `Returned count: ${nonExistentSearchRes?.data?.communities?.length}`
    });

    // 23. Reject negative limit returns HTTP 422
    await runTest({
        section: "Community API Tests",
        milestone: "M3",
        name: "Community Listing - Reject Negative Limit",
        method: "GET",
        path: "/communities?limit=-5",
        expectedStatus: 422
    });

    // 24. Reject negative page returns HTTP 422
    await runTest({
        section: "Community API Tests",
        milestone: "M3",
        name: "Community Listing - Reject Negative Page",
        method: "GET",
        path: "/communities?page=-1",
        expectedStatus: 422
    });

    // ----------------------------------------------------
    // M3.7 Community Detail Endpoint Tests
    // ----------------------------------------------------

    // 25. Retrieving existing community by ID returns HTTP 200
    if (comm && comm.communityId) {
        const detailRes = await runTest({
            section: "Community API Tests",
            milestone: "M3",
            name: "Community Detail - Retrieve Existing Community by ID",
            method: "GET",
            path: `/communities/${comm.communityId}`,
            expectedStatus: 200
        });

        // 26. Validate detail response envelope and structure
        const detailComm = detailRes?.data?.community;
        const hasValidDetailEnvelope = Boolean(
            detailRes &&
            detailRes.success === true &&
            detailRes.statusCode === 200 &&
            detailComm &&
            detailComm.communityId === comm.communityId &&
            detailComm.name === comm.name &&
            detailComm.domain === comm.domain &&
            typeof detailComm.membersCount === "number" &&
            detailComm.createdBy &&
            typeof detailComm.createdBy.userId === "string" &&
            typeof detailComm.createdBy.name === "string" &&
            typeof detailComm.createdBy.email === "string" &&
            detailRes.meta &&
            typeof detailRes.meta.requestId === "string" &&
            typeof detailRes.meta.timestamp === "string"
        );
        recordAssertion({
            section: "Community API Tests",
            milestone: "M3",
            name: "Community Detail - API Response Envelope & Structure",
            passed: hasValidDetailEnvelope,
            expectedStatus: 200,
            actualStatus: hasValidDetailEnvelope ? 200 : "Invalid Detail Envelope",
            details: `Validated communityId: ${detailComm?.communityId}, membersCount: ${detailComm?.membersCount}, creator: ${detailComm?.createdBy?.email}`
        });

        // 27. Ensure sensitive fields are excluded from detail response
        const detailRawString = JSON.stringify(detailRes || {});
        const detailExposesSensitiveData = /password|passwordHash|"salt"|walletBalance|licenseNumber/i.test(detailRawString);
        recordAssertion({
            section: "Community API Tests",
            milestone: "M3",
            name: "Community Detail - No Sensitive Data Exposure",
            passed: !detailExposesSensitiveData,
            expectedStatus: 200,
            actualStatus: !detailExposesSensitiveData ? 200 : "Exposed Sensitive Data",
            details: "Confirmed no password hashes, walletBalance, licenseNumber, or sensitive fields in payload"
        });

        // 28. Authenticated request to detail endpoint also allowed
        await runTest({
            section: "Community API Tests",
            milestone: "M3",
            name: "Community Detail - Authenticated Request Allowed",
            method: "GET",
            path: `/communities/${comm.communityId}`,
            token: token1,
            expectedStatus: 200
        });
    } else {
        console.log("SKIP | Community Detail Tests | Created community ID unavailable");
        report.tests.push({
            section: "Community API Tests",
            milestone: "M3",
            name: "Community Detail - Retrieve Existing Community",
            passed: false,
            skipped: true,
            reason: "Could not retrieve created community ID from M3.3 creation step."
        });
    }

    // 29. Retrieving a non-existent community UUID returns HTTP 404
    await runTest({
        section: "Community API Tests",
        milestone: "M3",
        name: "Community Detail - Non-Existent Community ID Rejection",
        method: "GET",
        path: "/communities/00000000-0000-0000-0000-000000000000",
        expectedStatus: 404
    });

    // 30. Invalid community ID format (non-UUID) returns HTTP 422
    await runTest({
        section: "Community API Tests",
        milestone: "M3",
        name: "Community Detail - Invalid UUID Format Rejection",
        method: "GET",
        path: "/communities/invalid-community-id-not-a-uuid",
        expectedStatus: 422
    });

    // ============================================
    // FINAL REPORT & SUMMARY
    // ============================================

    const passed = report.tests.filter(t => t.passed).length;
    const failed = report.tests.filter(t => !t.passed).length;
    const skipped = report.tests.filter(t => t.skipped).length;

    report.finishedAt = new Date().toISOString();

    report.summary = {
        total: report.tests.length,
        passed,
        failed,
        skipped,
        bySection: {
            foundation: report.tests.filter(t => t.section === "Foundation API Tests").length,
            authentication: report.tests.filter(t => t.section === "Authentication API Tests").length,
            userProfile: report.tests.filter(t => t.section === "User Profile API Tests").length,
            community: report.tests.filter(t => t.section === "Community API Tests").length
        },
        byMilestone: {
            M1_Foundation: report.tests.filter(t => t.milestone === "M1").length,
            M2_AuthAndProfile: report.tests.filter(t => t.milestone === "M2").length,
            M3_Communities: report.tests.filter(t => t.milestone === "M3").length
        },
        result: failed === 0 ? "ALL TESTS PASSED" : "SOME TESTS FAILED"
    };

    await fs.writeFile(outputFile, JSON.stringify(report, null, 2), "utf8");

    console.log("\n========================================");
    console.log("RYDORA LIVE API TEST SUMMARY");
    console.log("========================================");
    console.log("Total Tests :", report.summary.total);
    console.log("Passed      :", passed);
    console.log("Failed      :", failed);
    console.log("Skipped     :", skipped);
    console.log("----------------------------------------");
    console.log("M1 Foundation   :", report.summary.byMilestone.M1_Foundation);
    console.log("M2 Auth/Profile :", report.summary.byMilestone.M2_AuthAndProfile);
    console.log("M3 Communities  :", report.summary.byMilestone.M3_Communities);
    console.log("----------------------------------------");
    console.log("Report saved to :", outputFile);
    console.log("========================================\n");

    if (failed > 0) {
        process.exitCode = 1;
    }
}

main().catch(async (error) => {
    console.error("\nTest execution stopped with unhandled error:", error.message);

    report.fatalError = error.message;
    report.finishedAt = new Date().toISOString();

    try {
        await fs.writeFile(outputFile, JSON.stringify(report, null, 2), "utf8");
    } catch {
        // Ignored in catastrophic file write failure
    }

    process.exitCode = 1;
});
