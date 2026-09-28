/**
 * Content moderation & prohibited / reserved terms validation
 * Ensures compliance with financial audit guidelines, system roles, payment security,
 * and prevents impersonation or misleading billing tags.
 */

// System-reserved keywords that cannot be used as user-generated tags, participants, or payment names
export const RESERVED_TERMS = [
  'admin',
  'administrator',
  'root',
  'system',
  'splitexact',
  'official',
  'verified',
  'mod',
  'moderator',
  'support',
  'security',
  'null',
  'undefined',
  'bot',
  'api',
] as const;

// Prohibited terms for fraudulent transactions, illicit commerce, payment bypass, or offensive content
export const PROHIBITED_TERMS = [
  'fake receipt',
  'fake tax',
  'stolen card',
  'carding',
  'money laundering',
  'exploit',
  'hacked',
  'bypass fee',
  'chargeback fraud',
  'cvv',
  'ssn',
  'credit card number',
  'password',
  'pin number',
  'counterfeit',
  'illicit',
  'unlawful',
  'pyramid scheme',
  'ponzi',
] as const;

export interface ValidationResult {
  isValid: boolean;
  reason?: string;
  matchedTerm?: string;
  isReserved?: boolean;
  isProhibited?: boolean;
}

/**
 * Checks a string against both reserved and prohibited terms
 */
export function validateTerm(input: string, contextName: string = 'Term'): ValidationResult {
  const normalized = input.trim().toLowerCase();
  if (!normalized) {
    return { isValid: false, reason: `${contextName} cannot be blank.` };
  }

  // Check reserved exact matches or reserved prefix/pattern
  for (const term of RESERVED_TERMS) {
    if (normalized === term || normalized === `@${term}`) {
      return {
        isValid: false,
        reason: `"${input}" is a reserved system identifier and cannot be used for ${contextName.toLowerCase()}s.`,
        matchedTerm: term,
        isReserved: true,
      };
    }
  }

  // Check prohibited terms substring
  for (const term of PROHIBITED_TERMS) {
    if (normalized.includes(term)) {
      return {
        isValid: false,
        reason: `"${input}" contains prohibited or sensitive phrase ("${term}"). Please use standard billing descriptions.`,
        matchedTerm: term,
        isProhibited: true,
      };
    }
  }

  return { isValid: true };
}
