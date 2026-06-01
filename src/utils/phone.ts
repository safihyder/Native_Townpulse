export function sanitizeIndianPhoneInput(rawPhoneNumber: string): {
  e164Phone: string;
  localNumber: string;
} {
  const digits = rawPhoneNumber.replace(/\D/g, '');

  if (digits.length === 10) {
    return {
      e164Phone: `+91${digits}`,
      localNumber: digits,
    };
  }

  if (digits.length === 12 && digits.startsWith('91')) {
    return {
      e164Phone: `+${digits}`,
      localNumber: digits.slice(2),
    };
  }

  throw new Error('Enter a valid 10-digit Indian mobile number.');
}

export function formatDisplayPhone(phoneNumber: string): string {
  const digits = phoneNumber.replace(/\D/g, '');

  if (digits.length >= 12 && digits.startsWith('91')) {
    const localNumber = digits.slice(2);
    return `+91 ${localNumber.slice(0, 5)} ${localNumber.slice(5)}`;
  }

  if (digits.length === 10) {
    return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  }

  return phoneNumber;
}
