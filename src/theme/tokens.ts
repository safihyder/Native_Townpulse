export const theme = {
  colors: {
    // Core palette
    brandPrimary: '#F5C116',        // Golden yellow
    brandPrimaryDark: '#D4A510',    // Darker gold
    brandPrimarySoft: 'rgba(245,193,22,0.12)', // Subtle gold tint
    brandAccent: '#F5C116',
    brandAccentSoft: 'rgba(245,193,22,0.08)',
    
    // Backgrounds (Figma uses pure white for cards and backgrounds)
    brandCanvas: '#FFFFFF',         // Pure white background
    brandCanvasDark: '#FAFAFA',     // Slightly darker background
    brandCard: '#FFFFFF',           // White cards
    brandCardLight: '#FFFFFF',      // Card bg
    
    // New Figma semantic colors
    accentOrange: '#F5A623',
    bgSoftPink: '#FFF5F0',
    promoGreen: '#34C759',
    headerYellow: '#F5C116',

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
      elevation: 4,
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
    },
    heavy: {
      elevation: 12,
      shadowColor: '#F5C116',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.25,
      shadowRadius: 16,
    }
  },
} as const;

