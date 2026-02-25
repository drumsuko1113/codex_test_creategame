import { createHmac, timingSafeEqual } from "node:crypto";

function getSecret(): string | null {
  const secret = process.env.MANAGED_AUTH_SHARED_SECRET;
  return secret && secret.length > 0 ? secret : null;
}

function signValue(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("hex");
}

export function issueManagedAuthToken(subject: string): string | null {
  const secret = getSecret();
  if (!secret) {
    return null;
  }
  return `${subject}.${signValue(subject, secret)}`;
}

export function verifyManagedAuthToken(token: string): { subject: string } | null {
  const secret = getSecret();
  if (!secret) {
    return null;
  }

  const [subject, signature] = token.split(".");
  if (!subject || !signature) {
    return null;
  }

  const expected = signValue(subject, secret);
  if (signature.length !== expected.length) {
    return null;
  }
  const isValid = timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  if (!isValid) {
    return null;
  }

  return { subject };
}
