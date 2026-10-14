import React from 'react';
import Svg, { Path, Circle, Rect } from 'react-native-svg';

export type IconName = 'home' | 'scan' | 'history' | 'settings' | 'brain' | 'bone' | 'lung' | 'breast' | 'shield' | 'arrow' | 'back' | 'plus' | 'image' | 'camera' | 'chip' | 'check' | 'close' | 'trash' | 'info' | 'search';
export function Icon({ name, size = 24, color = '#142C3B' }: { name: IconName; size?: number; color?: string }) {
  const paths: Partial<Record<IconName, string>> = {
    home: 'M3 10 12 3 21 10 M5 9v12h5v-7h4v7h5V9',
    scan: 'M8 3H3v5 M16 3h5v5 M21 16v5h-5 M8 21H3v-5 M6 12h12',
    history: 'M3 11a9 9 0 1 1 2 7 M3 4v7h7 M12 7v5l3 2',
    settings: 'M4 7h16 M4 17h16 M8 4v6 M16 14v6',
    brain: 'M12 5c-2-4-7-2-7 2-4 1-4 6-1 8-1 5 5 7 8 4 3 3 9 1 8-4 3-2 3-7-1-8 0-4-5-6-7-2v14 M5 7l3 2 M4 15l4-2 M19 7l-3 2 M20 15l-4-2 M8 17l-1 3 M16 17l1 3',
    bone: 'M7 3a3 3 0 0 0-5 3 3 3 0 0 0 4 4l8 8a3 3 0 0 0 4 4 3 3 0 0 0 3-5 3 3 0 0 0-4-3l-7-8a3 3 0 0 0-3-3Z',
    lung: 'M10 5C6 3 2 10 2 17c0 5 8 3 8-1V5Z M14 5c4-2 8 5 8 12 0 5-8 3-8-1V5Z M12 2v7 M8 12l4-3 4 3',
    breast: 'M9 3c-2 4 1 7 4 10l5 7-3 1-6-9C5 7 7 3 9 3h5c3 1 2 5 0 8L7 21l-3-2 10-14 M9 3c1 2 3 2 5 0',
    shield: 'M12 2 21 6v6c0 5-6 9-9 10-3-1-9-5-9-10V6l9-4Z M8 12l3 3 5-6',
    arrow: 'M5 12h14 M14 7l5 5-5 5', back: 'M19 12H5 M10 7l-5 5 5 5',
    plus: 'M12 5v14 M5 12h14', check: 'M5 12l4 4L19 6', close: 'm6 6 12 12 M6 18 18 6',
    image: 'M3 16l5-5 5 5 3-3 5 5', camera: 'M3 6h4l2-3h6l2 3h4v15H3Z',
    chip: 'M8 1v3 M16 1v3 M8 20v3 M16 20v3 M1 8h3 M1 16h3 M20 8h3 M20 16h3',
    trash: 'M3 6h18 M9 6V3h6v3 M5 6l1 15h12l1-15 M10 10v7 M14 10v7',
    info: 'M12 11v6 M12 7v.1', search: 'm16 16 5 5',
  };
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.65} strokeLinecap="round" strokeLinejoin="round">
    <Path d={paths[name]} />
    {name === 'image' && <><Rect x={3} y={3} width={18} height={18} rx={3} /><Circle cx={16} cy={8} r={1} /></>}
    {name === 'camera' && <Circle cx={12} cy={13} r={4} />}
    {name === 'chip' && <><Rect x={4} y={4} width={16} height={16} rx={3} /><Rect x={8} y={8} width={8} height={8} rx={1} /></>}
    {name === 'info' && <Circle cx={12} cy={12} r={10} />}
    {name === 'search' && <Circle cx={10.5} cy={10.5} r={6.5} />}
  </Svg>;
}
