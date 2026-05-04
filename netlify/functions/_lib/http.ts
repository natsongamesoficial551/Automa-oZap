export function json(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  };
}

export function correlationId() {
  return `cid_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
