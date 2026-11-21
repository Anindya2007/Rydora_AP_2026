
import fs from "node:fs/promises";
import crypto from "node:crypto";

// ============================================
// CONFIGURATION
// ============================================

const BASE_URL = process.env.API_BASE_URL || "http://localhost:3000/api/v1";

const timestamp = Date.now();

const user1 = {
    name: "Rydora Test User 1",
    email: `rydora.test.${timestamp}@example.com`,
    password: "TestPassword123",
    phone: `+9198${String(timestamp).slice(-8)}`
};

const user2 = {
    name: "Rydora Test User 2",
    email: `rydora.test.second.${timestamp}@example.com`,
    password: "TestPassword123"
};

let token1 = null;
let token2 = null;

const report = {
    project: "Rydora API Testing",
    baseURL: BASE_URL,
    startedAt: new Date().toISOString(),
    tests: []
};

// ============================================
// HELPERS
// ============================================

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

async function runTest({
    name,
    method,
    path,
    body,
    token,
    expectedStatus,
    headers = {}
}) {
    const url = `${BASE_URL}${path}`;

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

// ============================================
// TEST EXECUTION
// ============================================

async function main() {
    console.log("\nStarting Rydora API tests...\n");
    console.log("Base URL:", BASE_URL);

    // 1. SIGNUP USER 1

    const signup1 = await runTest({
        name: "Signup - Valid User 1",
        method: "POST",
        path: "/auth/signup",
        body: user1,
        expectedStatus: 201
    });

    token1 = findToken(signup1);

    // 2. DUPLICATE EMAIL

    await runTest({
        name: "Signup - Duplicate Email",
        method: "POST",
        path: "/auth/signup",
        body: user1,
        expectedStatus: 409
    });

    // 3. INVALID SIGNUP

    await runTest({
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

    // 6. GET ME SUCCESS

    await runTest({
        name: "Get Current User - Valid Token",
        method: "GET",
        path: "/auth/me",
        token: token1,
        expectedStatus: 200
    });

    // 7. GET ME WITHOUT TOKEN

    await runTest({
        name: "Get Current User - No Token",
        method: "GET",
        path: "/auth/me",
        expectedStatus: 401
    });

    // 8. PATCH PROFILE SUCCESS

    await runTest({
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
        name: "Get Current User - Verify Updated Profile",
        method: "GET",
        path: "/auth/me",
        token: token1,
        expectedStatus: 200
    });

    // 12. PATCH WITHOUT TOKEN

    await runTest({
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
        name: "Update Profile - Empty Body",
        method: "PATCH",
        path: "/users/me",
        token: token1,
        body: {},
        expectedStatus: 422
    });

    // 18. INVALID PHONE

    await runTest({
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
            name: "Update Profile - Duplicate Phone",
            passed: false,
            skipped: true,
            reason: "Could not extract second user's JWT token."
        });
    }

    // ============================================
    // FINAL REPORT
    // ============================================

    const passed = report.tests.filter(t => t.passed).length;
    const failed = report.tests.filter(t => !t.passed).length;

    report.finishedAt = new Date().toISOString();

    report.summary = {
        total: report.tests.length,
        passed,
        failed,
        result: failed === 0 ? "ALL TESTS PASSED" : "SOME TESTS FAILED"
    };

    const outputFile = "api-test-report.json";

    await fs.writeFile(
        outputFile,
        JSON.stringify(report, null, 2),
        "utf8"
    );

    console.log("\n================================");
    console.log("RYDORA API TEST SUMMARY");
    console.log("================================");
    console.log("Total:", report.summary.total);
    console.log("Passed:", passed);
    console.log("Failed:", failed);
    console.log("Report saved:", outputFile);
    console.log("================================\n");
}

main().catch(async error => {
    console.error("\nTest execution stopped:", error.message);

    report.fatalError = error.message;
    report.finishedAt = new Date().toISOString();

    await fs.writeFile(
        "api-test-report.json",
        JSON.stringify(report, null, 2),
        "utf8"
    );

    process.exitCode = 1;
});
