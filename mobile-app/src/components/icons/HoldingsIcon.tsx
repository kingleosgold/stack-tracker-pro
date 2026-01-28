import React from 'react';
import Svg, { Rect, Ellipse } from 'react-native-svg';

interface HoldingsIconProps {
  size?: number;
  color?: string;
}

export default function HoldingsIcon({ size = 24, color = '#fbbf24' }: HoldingsIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Stack of coins/bars */}
      <Rect x="4" y="16" width="16" height="4" rx="2" fill={color} />
      <Rect x="5" y="11" width="14" height="4" rx="2" fill={color} opacity={0.85} />
      <Rect x="6" y="6" width="12" height="4" rx="2" fill={color} opacity={0.7} />
      <Rect x="7" y="2" width="10" height="3" rx="1.5" fill={color} opacity={0.55} />
    </Svg>
  );
}
