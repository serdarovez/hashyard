import React, { useId } from 'react';

/**
 * Parametric front elevation of an ASIC miner.
 *
 * These are drawings, not photographs, and that is deliberate: there are no
 * free-licensed photos of an S21 Pro or an M60S+, and a stock shot of the
 * wrong model under a real SKU reads as fraud to anyone who knows the
 * hardware. A drawing that matches the chassis, fan count and cooling type is
 * honest. When you have licensed photography, render <img> here instead and
 * keep this as the fallback for models you have not shot yet.
 */
const SKINS = {
  bitmain: { body: '#B9BFC4', top: '#DDE1E4', shade: '#8C939A', face: '#2B3036',
             faceHi: '#3B424A', guard: '#8A929A', cap: '#464E56', well1: '#1A1E22', well2: '#07090B' },
  'bitmain-h': { body: '#A6AEB5', top: '#CFD5D9', shade: '#7B838B', face: '#333A42',
             faceHi: '#424B54', guard: '#7E868E', cap: '#3E464E', well1: '#1C2126', well2: '#090C0F' },
  microbt: { body: '#D3D6D8', top: '#F1F2F3', shade: '#A6AAAE', face: '#33383D',
             faceHi: '#424850', guard: '#9BA1A6', cap: '#22262A', well1: '#1B1F23', well2: '#080A0C' },
  'microbt-h': { body: '#C2C6C9', top: '#E6E8EA', shade: '#969BA0', face: '#2E3338',
             faceHi: '#3D434A', guard: '#8F969C', cap: '#22262A', well1: '#1A1E22', well2: '#07090B' }
};

function FanGuard({ cx, s, well }) {
  const rings = [37, 31, 25, 19, 13];
  const spokes = [0, 60, 120];
  return (
    <g>
      <circle cx={cx} cy={76} r={41} fill={`url(#${well})`} />
      <circle cx={cx} cy={76} r={41} fill="none" stroke="#000" strokeWidth={2.4} opacity={0.45} />
      <circle cx={cx} cy={75} r={40} fill="none" stroke="#fff" strokeWidth={1} opacity={0.13} />
      {spokes.map((a) => {
        const r = (a * Math.PI) / 180;
        return (
          <line key={a}
            x1={cx - 40 * Math.cos(r)} y1={76 - 40 * Math.sin(r)}
            x2={cx + 40 * Math.cos(r)} y2={76 + 40 * Math.sin(r)}
            stroke={s.guard} strokeWidth={1.3} opacity={0.5} />
        );
      })}
      {rings.map((r, i) => (
        <circle key={r} cx={cx} cy={76} r={r} fill="none"
          stroke={s.guard} strokeWidth={1.5} opacity={0.9 - i * 0.07} />
      ))}
      <circle cx={cx} cy={76} r={9} fill={s.cap} />
      <circle cx={cx} cy={75.2} r={9} fill="none" stroke="#fff" strokeWidth={0.9} opacity={0.22} />
    </g>
  );
}

function Port({ cx, label, s, well }) {
  return (
    <g>
      <circle cx={cx} cy={76} r={17} fill={`url(#${well})`} />
      <circle cx={cx} cy={76} r={17} fill="none" stroke="#4A6E8A" strokeWidth={3} />
      <circle cx={cx} cy={75.4} r={17} fill="none" stroke="#8FB6D2" strokeWidth={1} opacity={0.5} />
      <circle cx={cx} cy={76} r={9} fill="#16202A" stroke="#4A6E8A" strokeWidth={1.2} />
      <text x={cx} y={108} textAnchor="middle" fill={s.guard}
        fontFamily="IBM Plex Mono, monospace" fontSize={9} letterSpacing={1}>{label}</text>
    </g>
  );
}

export default function RigDrawing({ rig, className = '' }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const s = SKINS[rig.skin] || SKINS.bitmain;
  const hydro = rig.cool === 'Hydro';
  const g = (k) => `${uid}${k}`;

  return (
    <svg viewBox="0 0 240 152" className={className} role="img"
      aria-label={`${rig.model}, ${rig.cool.toLowerCase()}-cooled ASIC miner`}>
      <defs>
        <linearGradient id={g('b')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={s.top} />
          <stop offset=".16" stopColor={s.body} />
          <stop offset=".78" stopColor={s.body} />
          <stop offset="1" stopColor={s.shade} />
        </linearGradient>
        <linearGradient id={g('f')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={s.faceHi} />
          <stop offset="1" stopColor={s.face} />
        </linearGradient>
        <radialGradient id={g('w')} cx=".5" cy=".34" r=".78">
          <stop offset="0" stopColor={s.well1} />
          <stop offset="1" stopColor={s.well2} />
        </radialGradient>
        <linearGradient id={g('s')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".34" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={g('d')} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#000" stopOpacity="0" />
          <stop offset=".5" stopColor="#000" stopOpacity=".3" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </linearGradient>
      </defs>

      <ellipse cx={120} cy={143} rx={104} ry={5.5} fill={`url(#${g('d')})`} />
      <rect x={10} y={14} width={220} height={122} rx={7} fill={`url(#${g('b')})`} />
      <rect x={11} y={15} width={218} height={26} rx={6} fill={`url(#${g('s')})`} />

      {/* extruded aluminium fins: a dark groove with a lit edge beside it */}
      {Array.from({ length: 9 }, (_, i) => 16 + i * 24.2).map((x) => (
        <g key={x}>
          <rect x={x} y={20} width={1.6} height={112} fill="#000" opacity={0.13} />
          <rect x={x + 1.6} y={20} width={1} height={112} fill="#fff" opacity={0.16} />
        </g>
      ))}

      <rect x={18} y={22} width={204} height={108} rx={5} fill={`url(#${g('f')})`} />

      {hydro ? (
        <g>
          {Array.from({ length: 14 }, (_, i) => 106 + i * 5.6).map((x) => (
            <g key={x}>
              <rect x={x} y={52} width={2.4} height={48} fill={s.guard} opacity={0.55} />
              <rect x={x + 2.4} y={52} width={1} height={48} fill="#000" opacity={0.28} />
            </g>
          ))}
          <Port cx={62} label="IN" s={s} well={g('w')} />
          <Port cx={178} label="OUT" s={s} well={g('w')} />
        </g>
      ) : (
        <g>
          <FanGuard cx={70} s={s} well={g('w')} />
          <FanGuard cx={170} s={s} well={g('w')} />
        </g>
      )}

      <rect x={18} y={22} width={204} height={108} rx={5} fill="none" stroke="#000" strokeWidth={1} opacity={0.3} />
      <rect x={10.5} y={14.5} width={219} height={121} rx={6.5} fill="none" stroke="#000" strokeWidth={1} opacity={0.26} />
      <rect x={11.5} y={15.5} width={217} height={119} rx={5.5} fill="none" stroke="#fff" strokeWidth={1} opacity={0.3} />
      <rect x={26} y={118} width={46} height={9} rx={2} fill={s.cap} opacity={0.92} />
      <text x={30} y={125.2} fill={s.body} fontFamily="IBM Plex Mono, monospace"
        fontSize={6.4} letterSpacing={1.1}>{rig.brand.toUpperCase()}</text>
    </svg>
  );
}
