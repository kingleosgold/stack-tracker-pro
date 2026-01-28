import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface SortIconProps {
  size?: number;
  color?: string;
}

export default function SortIcon({ size = 24, color = '#fbbf24' }: SortIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Up/down arrows for sorting */}
      <Path
        d="M7 4L7 20M7 4L3 8M7 4L11 8"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M17 20L17 4M17 20L13 16M17 20L21 16"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
