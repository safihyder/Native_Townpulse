import {
  formatDisplayPhone,
  sanitizeIndianPhoneInput,
} from '../src/utils/phone';

test('sanitizes local Indian mobile numbers into Firebase-ready format', () => {
  expect(sanitizeIndianPhoneInput('98765 43210')).toEqual({
    e164Phone: '+919876543210',
    localNumber: '9876543210',
  });
});

test('formats verified phone numbers for display', () => {
  expect(formatDisplayPhone('+919876543210')).toBe('+91 98765 43210');
});
