import React from 'react';
import Svg, { Path, Circle, G, Rect } from 'react-native-svg';

type IconProps = {
  size?: number;
  color?: string;
  strokeWidth?: string | number;
};

// ── Search Icon ──────────────────────────────────────────────────────────────
export function SearchIcon({ size = 20, color = '#9CA3AF' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="11" cy="11" r="7" stroke={color} strokeWidth="2" />
      <Path d="M16.5 16.5L21 21" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}

// ── Location Pin Icon ────────────────────────────────────────────────────────
export function LocationPinIcon({ size = 24, color = '#F5A623' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
        fill={color}
      />
      <Circle cx="12" cy="9" r="2.5" fill="#FFF" />
    </Svg>
  );
}

// ── Cart / Bag Icon ──────────────────────────────────────────────────────────
export function CartIcon({ size = 24, color = '#1C2434' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4H6zM3 6h18"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M16 10a4 4 0 01-8 0"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// ── Profile / Person Icon ────────────────────────────────────────────────────
export function ProfileIcon({ size = 24, color = '#1C2434' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="8" r="4" stroke={color} strokeWidth="2" />
      <Path
        d="M20 21a8 8 0 10-16 0"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </Svg>
  );
}

// ── Chevron Down ─────────────────────────────────────────────────────────────
export function ChevronDownIcon({ size = 16, color = '#F5A623' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6 9l6 6 6-6"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// ── Star Icon ────────────────────────────────────────────────────────────────
export function StarIcon({ size = 14, color = '#F5A623' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </Svg>
  );
}

// ── Hamburger / Menu Icon ────────────────────────────────────────────────────
export function MenuIcon({ size = 24, color = '#1C2434' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M3 12h18M3 6h18M3 18h18" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}

// ── Filter Icon ──────────────────────────────────────────────────────────────
export function FilterIcon({ size = 20, color = '#1C2434' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 21V14M4 10V3M12 21V12M12 8V3M20 21V16M20 12V3" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Path d="M1 14h6M9 8h6M17 16h6" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}

// ── Arrow Right Icon ─────────────────────────────────────────────────────────
export function ArrowRightIcon({ size = 20, color = '#6B7280' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M9 18l6-6-6-6" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// ── Clock Icon ───────────────────────────────────────────────────────────────
export function ClockIcon({ size = 16, color = '#6B7280' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2" />
      <Path d="M12 6v6l4 2" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}

// ── Distance / Map Pin Small ─────────────────────────────────────────────────
export function DistanceIcon({ size = 16, color = '#6B7280' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="10" r="3" stroke={color} strokeWidth="2" />
      <Path d="M12 2a8 8 0 00-8 8c0 5.4 8 12 8 12s8-6.6 8-12a8 8 0 00-8-8z" stroke={color} strokeWidth="2" />
    </Svg>
  );
}

// ── Category Icons ───────────────────────────────────────────────────────────

export function VoucherCategoryIcon({ size = 28, color = '#F5A623' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="2" y="5" width="20" height="14" rx="3" stroke={color} strokeWidth="2" />
      <Path d="M2 10h20" stroke={color} strokeWidth="2" />
      <Path d="M7 14h4" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}

export function RiceCategoryIcon({ size = 28, color = '#F5A623' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M3 15c0 4 4.5 6 9 6s9-2 9-6" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Path d="M3 15c0-2.5 2-5 5-6.5M21 15c0-2.5-2-5-5-6.5M12 3v5" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Circle cx="12" cy="10" r="2" fill={color} />
    </Svg>
  );
}

export function DrinkCategoryIcon({ size = 28, color = '#4CAFEB' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M8 2h8l-1 10H9L8 2z" stroke={color} strokeWidth="2" strokeLinejoin="round" />
      <Path d="M9 12l-1 8h8l-1-8" stroke={color} strokeWidth="2" strokeLinejoin="round" />
      <Path d="M7 20h10" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}

export function FastFoodCategoryIcon({ size = 28, color = '#F5A623' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M3 14h18" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Path d="M4 14c0-5 3.5-9 8-9s8 4 8 9" stroke={color} strokeWidth="2" />
      <Path d="M5 17h14a2 2 0 010 4H5a2 2 0 010-4z" stroke={color} strokeWidth="2" />
    </Svg>
  );
}

export function BreadCategoryIcon({ size = 28, color = '#D4915E' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M5 10c0-3 2-5 7-5s7 2 7 5c0 2-1 3-2 4v6a2 2 0 01-2 2H9a2 2 0 01-2-2v-6c-1-1-2-2-2-4z"
        stroke={color}
        strokeWidth="2"
      />
      <Path d="M9 15h6" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}

// ── Info Icon (circled i) ────────────────────────────────────────────────────
export function InfoIcon({ size = 24, color = '#FFF' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2" />
      <Path d="M12 16v-4" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Circle cx="12" cy="8" r="1" fill={color} />
    </Svg>
  );
}

// ── Receipt Icon ─────────────────────────────────────────────────────────────
export function ReceiptIcon({ size = 24, color = '#1C2434' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M9 14h6M9 10h6M5 8V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2v16l-3-2-3 2-3-2-3 2-3-2V8z"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// ── Briefcase Icon ───────────────────────────────────────────────────────────
export function BriefcaseIcon({ size = 24, color = '#1C2434' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M20 7H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2zM16 7V5c0-1.1-.9-2-2-2h-4c-1.1 0-2 .9-2 2v2"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M12 12v.01" stroke={color} strokeWidth="3" strokeLinecap="round" />
    </Svg>
  );
}

// ── Home Icon ────────────────────────────────────────────────────────────────
export function HomeIcon({ size = 24, color = '#1C2434', strokeWidth = 2 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M9 22V12h6v10" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// ── Wallet Icon ──────────────────────────────────────────────────────────────
export function WalletIcon({ size = 24, color = '#1C2434', strokeWidth = 2 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M21 12V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2h14a2 2 0 002-2v-5M21 12H13a2 2 0 000 4h8" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx="16" cy="14" r="1" fill={color} />
    </Svg>
  );
}

// ── Chart Icon ───────────────────────────────────────────────────────────────
export function ChartIcon({ size = 24, color = '#1C2434', strokeWidth = 2 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M18 20V10M12 20V4M6 20v-6" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M3 20h18" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// ── Settings Icon ────────────────────────────────────────────────────────────
export function SettingsIcon({ size = 24, color = '#1C2434', strokeWidth = 2 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="3" stroke={color} strokeWidth={strokeWidth} />
      <Path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9c.26.6.8.96 1.41.96H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// ── Package Icon ─────────────────────────────────────────────────────────────
export function PackageIcon({ size = 24, color = '#1C2434' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M3.27 6.96L12 12l8.73-5.04M12 22.08V12" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// ── Call / Phone Icon ────────────────────────────────────────────────────────
export function PhoneIcon({ size = 24, color = '#1C2434' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// ── Check Circle Icon ────────────────────────────────────────────────────────
export function CheckCircleIcon({ size = 24, color = '#22C55E' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M22 11.08V12a10 10 0 11-5.93-9.14" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M22 4L12 14.01l-3-3" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// ── Arrow Right Circle Icon ──────────────────────────────────────────────────
export function ArrowRightCircleIcon({ size = 24, color = '#1C2434' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2" />
      <Path d="M12 16l4-4-4-4M8 12h8" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// ── Scooter / Delivery Icon ──────────────────────────────────────────────────
export function ScooterIcon({ size = 24, color = '#1C2434' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="5" cy="18" r="3" stroke={color} strokeWidth="2" />
      <Circle cx="19" cy="18" r="3" stroke={color} strokeWidth="2" />
      <Path d="M16 8v3l-5 4H8l-3.5-3.5L3 13" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M10 12l2-4h4M12 6h7a2 2 0 012 2v3M9 14h6" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// ── Document Text Icon ───────────────────────────────────────────────────────
export function DocumentTextIcon({ size = 24, color = '#1C2434' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// ── Currency / Money Icon ────────────────────────────────────────────────────
export function MoneyIcon({ size = 24, color = '#1C2434' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="2" y="6" width="20" height="12" rx="2" stroke={color} strokeWidth="2" />
      <Circle cx="12" cy="12" r="3" stroke={color} strokeWidth="2" />
      <Path d="M6 12h.01M18 12h.01" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}

// ── Adjustments / Tools Icon ─────────────────────────────────────────────────
export function AdjustmentsIcon({ size = 24, color = '#1C2434' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M1 14h6M9 8h6M17 16h6" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// ── Bank Icon ────────────────────────────────────────────────────────────────
export function BankIcon({ size = 24, color = '#1C2434' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v3M12 14v3M16 14v3" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// ── Warning Icon ─────────────────────────────────────────────────────────────
export function WarningIcon({ size = 24, color = '#1C2434' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M12 9v4M12 17h.01" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// ── Badge Check Icon ─────────────────────────────────────────────────────────
export function BadgeCheckIcon({ size = 24, color = '#3B82F6' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M9 12l2 2 4-4" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M12 2l3.09 3.09L22 6.18l-1.09 4.18L22 14.54l-1.09 4.18-4.18 1.09L12 22l-4.73-2.18-4.18-1.09L2 14.54l1.09-4.18L2 6.18l4.18-1.09L12 2z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// ── Menu Book Icon (open book) ───────────────────────────────────────────────
export function MenuBookIcon({ size = 24, color = '#1C2434', strokeWidth = 2 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2V3z" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7V3z" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// ── Bell Icon (notification) ─────────────────────────────────────────────────
export function BellIcon({ size = 24, color = '#1C2434', strokeWidth = 2 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9z" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M13.73 21a2 2 0 01-3.46 0" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// ── Store Icon ───────────────────────────────────────────────────────────────
export function StoreIcon({ size = 24, color = '#1C2434', strokeWidth = 2 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M9 22V12h6v10" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
