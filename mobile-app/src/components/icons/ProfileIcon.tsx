import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

interface ProfileIconProps {
  size?: number;
  color?: string;
}

export default function ProfileIcon({ size = 24, color = '#fbbf24' }: ProfileIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Outer circle */}
      <Circle
        cx="12"
        cy="12"
        r="10"
        stroke={color}
        strokeWidth="1.5"
        fill="none"
      />
      {/* Head */}
      <Circle
        cx="12"
        cy="9"
        r="3"
        fill={color}
      />
      {/* Body/shoulders */}
      <Path
        d="M12 14c-3.5 0-6 2-6 4.5V19c0 0.5 0.5 1 1 1h10c0.5 0 1-0.5 1-1v-0.5c0-2.5-2.5-4.5-6-4.5z"
        fill={color}
        clipPath="url(#clip)"
      />
      {/* Clip to keep body within circle */}
      <Circle
        cx="12"
        cy="12"
        r="10"
        fill="none"
        stroke="none"
      />
    </Svg>
  );
}
