/**
 * Parse a JSON object request body. Returns null for unparseable JSON or a non-object body,
 * so routes can answer 400 instead of falling through to a 500.
 */
export async function readJsonObject(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await req.json();
    return body && typeof body === 'object' && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}
