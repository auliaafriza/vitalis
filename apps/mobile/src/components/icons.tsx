import Svg, { Circle, Path, Rect } from 'react-native-svg';

/**
 * Hand-drawn SVG icons.
 *
 * Not emoji: emoji take the platform's own glyph and colour, so they render
 * differently on Android and iOS and stay black on a dark background — the
 * exact bug the barcode button had. These take `color` and obey the theme.
 *
 * Not an icon package either: the set below is the whole set the app needs,
 * and it costs less than the dependency would.
 */

export interface IconProps {
  color: string;
  size?: number;
  /** Line weight. 2 reads well at 22–24px; 1.75 at 18px. */
  weight?: number;
}

function Line({
  color,
  size = 22,
  weight = 2,
  children,
}: IconProps & { children: React.ReactNode }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={weight}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </Svg>
  );
}

export function HomeIcon(props: IconProps) {
  return (
    <Line {...props}>
      <Path d="M3 10.2 12 3.5l9 6.7V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
    </Line>
  );
}

export function LogIcon(props: IconProps) {
  return (
    <Line {...props}>
      <Rect x="4" y="3" width="16" height="18" rx="3" />
      <Path d="M8.5 9h7M8.5 13h7M8.5 17h3.5" />
    </Line>
  );
}

export function ChartIcon(props: IconProps) {
  return (
    <Line {...props}>
      <Path d="M5 20V11M12 20V4M19 20v-6" />
    </Line>
  );
}

export function HeartIcon(props: IconProps) {
  return (
    <Line {...props}>
      <Path d="M12 20s-7.5-4.6-7.5-9.6A4.4 4.4 0 0 1 12 7.4a4.4 4.4 0 0 1 7.5 3C19.5 15.4 12 20 12 20z" />
    </Line>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <Line {...props}>
      <Path d="M12 5v14M5 12h14" />
    </Line>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <Line {...props}>
      <Circle cx="11" cy="11" r="6.5" />
      <Path d="m16 16 4.5 4.5" />
    </Line>
  );
}

/** The scan button: a viewfinder with bars, not a literal barcode. */
export function BarcodeIcon(props: IconProps) {
  return (
    <Line {...props}>
      <Path d="M4 8.5V6a2 2 0 0 1 2-2h2.5M15.5 4H18a2 2 0 0 1 2 2v2.5M20 15.5V18a2 2 0 0 1-2 2h-2.5M8.5 20H6a2 2 0 0 1-2-2v-2.5" />
      <Path d="M8.5 9v6M12 9v6M15.5 9v6" />
    </Line>
  );
}

export function ChevronLeftIcon(props: IconProps) {
  return (
    <Line {...props}>
      <Path d="m14.5 5-6 7 6 7" />
    </Line>
  );
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <Line {...props}>
      <Path d="m9.5 5 6 7-6 7" />
    </Line>
  );
}

export function CalendarIcon(props: IconProps) {
  return (
    <Line {...props}>
      <Rect x="3.5" y="5" width="17" height="16" rx="3" />
      <Path d="M8 3v4M16 3v4M3.5 10h17" />
    </Line>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Line {...props}>
      <Path d="m5 12.5 4.5 4.5L19 7" />
    </Line>
  );
}

export function LockIcon(props: IconProps) {
  return (
    <Line {...props}>
      <Rect x="4" y="10" width="16" height="10" rx="2.5" />
      <Path d="M8 10V7a4 4 0 1 1 8 0v3" />
    </Line>
  );
}

export function SunIcon(props: IconProps) {
  return (
    <Line {...props}>
      <Circle cx="12" cy="12" r="4" />
      <Path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M19.1 4.9l-1.8 1.8M6.7 17.3l-1.8 1.8" />
    </Line>
  );
}

export function MoonIcon(props: IconProps) {
  return (
    <Line {...props}>
      <Path d="M20 14.2A8.2 8.2 0 0 1 9.8 4a8.5 8.5 0 1 0 10.2 10.2z" />
    </Line>
  );
}

export function PhoneIcon(props: IconProps) {
  return (
    <Line {...props}>
      <Rect x="6" y="2.5" width="12" height="19" rx="3" />
      <Path d="M10.5 18.5h3" />
    </Line>
  );
}

export function EyeIcon(props: IconProps) {
  return (
    <Line {...props}>
      <Path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <Circle cx="12" cy="12" r="3" />
    </Line>
  );
}

export function EyeOffIcon(props: IconProps) {
  return (
    <Line {...props}>
      <Path d="M9.9 5.8A9.5 9.5 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-3 3.8M6.5 7.7A17 17 0 0 0 2.5 12S6 18.5 12 18.5c1.2 0 2.3-.2 3.2-.6" />
      <Path d="M10 10a3 3 0 0 0 4 4" />
      <Path d="M3.5 3.5l17 17" />
    </Line>
  );
}

export function UserIcon(props: IconProps) {
  return (
    <Line {...props}>
      <Circle cx="12" cy="8" r="4" />
      <Path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" />
    </Line>
  );
}
