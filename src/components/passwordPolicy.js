// Shared password strength rule, enforced everywhere a password is set:
// signup, the forgot-password reset, and the in-app Change Password page.
// Requirement: at least 8 characters, with at least one letter, one number,
// and one special character.

export const PASSWORD_RULE_TEXT =
  'At least 8 characters, including a letter, a number, and a special character.';

// Returns an error message string if the password is invalid, or '' if it passes.
export function validatePassword(pw) {
  const p = pw || '';
  if (p.length < 8) return 'Password must be at least 8 characters';
  if (!/[A-Za-z]/.test(p)) return 'Password must include a letter';
  if (!/[0-9]/.test(p)) return 'Password must include a number';
  if (!/[^A-Za-z0-9]/.test(p)) return 'Password must include a special character';
  return '';
}
