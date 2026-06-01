export const theme = {
  colors: {
    // Core palette
    brandPrimary: '#F5C116',        // Golden yellow
    brandPrimaryDark: '#D4A510',    // Darker gold
    brandPrimarySoft: 'rgba(245,193,22,0.12)', // Subtle gold tint
    brandAccent: '#F5C116',
    brandAccentSoft: 'rgba(245,193,22,0.08)',
    brandCanvas: '#FFFBF0',         // Creamy warm white (10% yellow + 90% white)
    brandCanvasDark: '#F3EFE6',     // Slightly darker creamy
    brandCard: '#FAE08B',           // 30% yellow + 70% white
    brandCardLight: '#FAE08B',      // Card bg

    // Text
    ink900: '#111827',              // Primary text (dark on light)
    ink700: '#374151',              // Secondary text
    ink500: '#6B7280',              // Muted text
    inkDark: '#121212',             // Dark text

    // Semantic
    success: '#15803D',
    danger: '#E53935',
    accentRed: '#E53935',
    line: '#E5E7EB',                // Border/separator
    lineLight: '#F3F4F6',           // Light border
    white: '#FFFFFF',
    black: '#121212',
  },
  spacing: {
    xs: 8,
    sm: 12,
    md: 16,
    lg: 20,
    xl: 24,
    xxl: 32,
    hero: 40,
  },
  radius: {
    sm: 12,
    md: 18,
    lg: 24,
    xl: 32,
    pill: 999,
  },
  typography: {
    hero: 34,
    h1: 28,
    h2: 22,
    body: 16,
    small: 13,
    micro: 11,
  },
  shadow: {
    card: {
      elevation: 8,
      shadowColor: '#F5C116',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.15,
      shadowRadius: 16,
    },
  },
} as const;

