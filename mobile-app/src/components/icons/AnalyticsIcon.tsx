import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';

interface AnalyticsIconProps {
  size?: number;
  color?: string;
}

export default function AnalyticsIcon({ size = 24, color = '#fbbf24' }: AnalyticsIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Line chart with upward trend */}
      <Path
        d="M3 18L8 13L12 16L21 7"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Arrow head pointing up-right */}
      <Path
        d="M16 7H21V12"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}
