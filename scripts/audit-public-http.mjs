function requiredEnvironmentValue(name) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Can dat ${name} truoc khi chay audit HTTP public.`);
  }

  return value;
}

function positiveInteger(name, fallback) {
  const value = Number(process.env[name] ?? fallback);

  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${name} phai la so nguyen duong.`);
  }

  return value;
}

function percentile(values, ratio) {
  return values[Math.min(values.length - 1, Math.ceil(values.length * ratio) - 1)];
}

const targetUrl = requiredEnvironmentValue("AUDIT_PUBLIC_URL");
const totalRequests = positiveInteger("AUDIT_PUBLIC_REQUESTS", 40);
const concurrency = positiveInteger("AUDIT_PUBLIC_CONCURRENCY", 8);

async function main() {
  const durations = [];
  let nextRequest = 0;

  async function worker() {
    while (true) {
      const requestNumber = nextRequest;
      nextRequest += 1;
      if (requestNumber >= totalRequests) return;

      const startedAt = performance.now();
      const response = await fetch(targetUrl);
      await response.arrayBuffer();

      if (!response.ok) {
        throw new Error(`Request ${requestNumber + 1} nhan HTTP ${response.status}.`);
      }

      durations.push(performance.now() - startedAt);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, totalRequests) }, worker));
  durations.sort((left, right) => left - right);

  console.log(JSON.stringify({
    concurrency,
    count: durations.length,
    p50Milliseconds: Number(percentile(durations, 0.5).toFixed(1)),
    p95Milliseconds: Number(percentile(durations, 0.95).toFixed(1)),
    targetUrl,
  }));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
