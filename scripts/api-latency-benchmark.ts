import "dotenv/config";
import { performance } from "node:perf_hooks";
import { prisma } from "@/db/prisma";

type BenchmarkResult = {
  name: string;
  method: string;
  path: string;
  runs: number[];
  avg: number;
  slowest: number;
  passFail: string;
};

type AuthResponse = {
  success: boolean;
  accessToken?: string;
  user?: {
    id: string;
    email?: string | null;
    role?: string;
    tenantId?: string;
    shopId?: string | null;
  };
};

const BASE_URL = process.env.API_BASE_URL ?? `http://localhost:${process.env.PORT ?? 8000}`;
const LOGIN_PASSWORD = process.env.BENCHMARK_PASSWORD ?? "DefaultPass123!";

async function requestJson(url: string, init: RequestInit = {}) {
  const start = performance.now();
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const text = await response.text();
  const end = performance.now();
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { response, body, ms: end - start };
}

async function loginAsSeededAdmin() {
  const admins = await prisma.user.findMany({
    where: {
      role: "ADMIN",
      shopId: { not: null },
      email: { not: null },
    },
    select: {
      email: true,
      shopId: true,
      tenantId: true,
    },
    orderBy: {
      createdAt: "asc",
    },
    take: 50,
  });

  for (const admin of admins) {
    if (!admin.email || !admin.shopId || !admin.tenantId) {
      continue;
    }

    const loginUrl = `${BASE_URL}/api/v1/auth/login`;
    const { response, body } = await requestJson(loginUrl, {
      method: "POST",
      body: JSON.stringify({
        email: admin.email,
        password: LOGIN_PASSWORD,
      }),
    });

    const payload = body as AuthResponse;
    if (!response.ok || !payload?.accessToken) {
      continue;
    }

    const authHeaders = {
      Authorization: `Bearer ${payload.accessToken}`,
    };

    const [repairsRes, customersRes, inventoryRes, staffRes] = await Promise.all([
      requestJson(`${BASE_URL}/api/v1/repairs?page=1&limit=1`, { headers: authHeaders }),
      requestJson(`${BASE_URL}/api/v1/customers?page=1&limit=1`, { headers: authHeaders }),
      requestJson(`${BASE_URL}/api/v1/inventory?page=1&limit=1`, { headers: authHeaders }),
      requestJson(`${BASE_URL}/api/v1/staff`, { headers: authHeaders }),
    ]);

    const repairRow = Array.isArray(repairsRes.body?.data) ? repairsRes.body.data[0] : repairsRes.body?.data?.[0];
    const repairId = repairRow?.id;
    const deviceId = repairRow?.deviceId ?? repairRow?.device?.id;
    const customerId = Array.isArray(customersRes.body?.customers) ? customersRes.body.customers[0]?.id : customersRes.body?.customers?.[0]?.id;
    const inventoryId = Array.isArray(inventoryRes.body?.items) ? inventoryRes.body.items[0]?.id : inventoryRes.body?.items?.[0]?.id;
    const staffId = Array.isArray(staffRes.body?.staff) ? staffRes.body.staff[0]?.id : staffRes.body?.staff?.[0]?.id;

    if (repairId && deviceId && customerId && inventoryId && staffId) {
      return {
        accessToken: payload.accessToken,
        shopId: admin.shopId,
        tenantId: admin.tenantId,
        email: admin.email,
        repairId,
        deviceId,
        customerId,
        inventoryId,
        staffId,
      } as any;
    }
  }

  throw new Error("No seeded admin with complete data was found. Run the seed again or inspect the dataset.");
}

async function runEndpoint(
  name: string,
  method: string,
  path: string,
  token: string,
  body?: unknown
): Promise<BenchmarkResult> {
  const runs: number[] = [];

  for (let i = 0; i < 3; i++) {
    const { response, ms } = await requestJson(`${BASE_URL}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    runs.push(ms);

    if (!response.ok && response.status >= 400) {
      console.log(`[WARN] ${method} ${path} returned ${response.status}`);
    }
  }

  const avg = runs.reduce((sum, value) => sum + value, 0) / runs.length;
  const slowest = Math.max(...runs);
  const passFail = avg <= 600 ? "✅ Pass" : slowest >= 2000 ? "❌ Critical" : "❌ Fail";

  return {
    name,
    method,
    path,
    runs,
    avg,
    slowest,
    passFail,
  };
}

function formatMs(value: number) {
  return `${Math.round(value)}ms`;
}

async function main() {
  const auth = await loginAsSeededAdmin();
  const token = auth.accessToken;

  const benchmarks: Array<Promise<BenchmarkResult>> = [
    runEndpoint("Repairs list", "GET", "/api/v1/repairs", token),
    runEndpoint("Repair by id", "GET", `/api/v1/repairs/${(auth as any).repairId}`, token),
    runEndpoint("Create repair", "POST", "/api/v1/repairs", token, {
      shopId: auth.shopId,
      customerId: (auth as any).customerId,
      deviceId: (auth as any).deviceId,
      issue: "Benchmark repair creation",
      priority: "MEDIUM",
      estimatedCost: 5000,
    }),
    runEndpoint("Update repair status", "PATCH", `/api/v1/repairs/${(auth as any).repairId}`, token, {
      status: "IN_PROGRESS",
    }),
    runEndpoint("Customers list", "GET", "/api/v1/customers", token),
    runEndpoint("Customer detail", "GET", `/api/v1/customers/${(auth as any).customerId}`, token),
    runEndpoint("Inventory list", "GET", "/api/v1/inventory", token),
    runEndpoint("Inventory summary", "GET", "/api/v1/inventory/summary", token),
    runEndpoint("Staff list", "GET", "/api/v1/staff", token),
    runEndpoint("Dashboard analytics", "GET", "/api/v1/dashboard/analytics", token),
    runEndpoint("Dashboard today repairs", "GET", "/api/v1/dashboard/today-repairs", token),
    runEndpoint("Dashboard pending repairs", "GET", "/api/v1/dashboard/pending-repairs", token),
    runEndpoint("Reports repairs", "GET", "/api/v1/reports/repairs", token),
    runEndpoint("Reports customers", "GET", "/api/v1/reports/customers", token),
    runEndpoint("Reports inventory", "GET", "/api/v1/reports/inventory", token),
    runEndpoint("Notifications mark-read", "PATCH", "/api/v1/dashboard/notifications/mark-read", token, {
      notificationId: null,
    }),
    runEndpoint("Notifications clear", "PATCH", "/api/v1/dashboard/notifications/clear", token, {
      notificationId: null,
    }),
    runEndpoint("Staff me", "GET", "/api/v1/staff/me", token),
    runEndpoint("Staff roles", "GET", "/api/v1/staff/roles", token),
    runEndpoint("Search", "GET", "/api/v1/search?q=screen", token),
  ];

  const results = await Promise.all(benchmarks);

  console.log("\nEndpoint                           | Method | Run 1  | Run 2  | Run 3  | Avg    | Slowest | Pass/Fail");
  console.log("-----------------------------------|--------|--------|--------|--------|--------|---------|----------");

  for (const result of results) {
    const [run1, run2, run3] = result.runs.map(formatMs);
    const avg = formatMs(result.avg);
    const slowest = formatMs(result.slowest);
    console.log(
      `${result.name.padEnd(35)}| ${result.method.padEnd(6)} | ${run1.padEnd(6)} | ${run2.padEnd(6)} | ${run3.padEnd(6)} | ${avg.padEnd(6)} | ${slowest.padEnd(7)} | ${result.passFail}`
    );
  }

  const summary = results.map((result) => ({
    endpoint: result.path,
    method: result.method,
    avgMs: Math.round(result.avg),
    slowestMs: Math.round(result.slowest),
    passFail: result.passFail,
  }));

  console.log("\nJSON_SUMMARY_START");
  console.log(JSON.stringify(summary, null, 2));
  console.log("JSON_SUMMARY_END");
}

main()
  .catch((error) => {
    console.error("Benchmark failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
