import React from 'react';
import Svg, { Rect } from 'react-native-svg';

interface DashboardIconProps {
  size?: number;
  color?: string;
}

export default function DashboardIcon({ size = 24, color = '#fbbf24' }: DashboardIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Bar chart - three vertical bars */}
      <Rect x="3" y="12" width="5" height="9" rx="1" fill={color} />
      <Rect x="10" y="6" width="5" height="15" rx="1" fill={color} />
      <Rect x="17" y="3" width="5" height="18" rx="1" fill={color} />
    </Svg>
  );
}
