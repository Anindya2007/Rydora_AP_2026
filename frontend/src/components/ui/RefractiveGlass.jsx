import React, { useRef, useState, useEffect, useId, useMemo } from 'react';

export const convexCircle = (x) => Math.sqrt(1 - (1 - x) ** 2);

// Cache for corner templates and full element displacement data URLs
const cornerCache = new Map();
const fullMapCache = new Map();

function computeSnellProfile(glassThickness = 65, bezelWidth = 16, heightFn = convexCircle, refractiveIndex = 1.46, samples = 128) {
  const eta = 1 / refractiveIndex;
  function refract(nx, ny) {
    const cosI = ny;
    const k = 1 - eta * eta * (1 - cosI * cosI);
    if (k < 0) return null;
    const sqrtK = Math.sqrt(k);
    return [-(eta * cosI + sqrtK) * nx, eta - (eta * cosI + sqrtK) * ny];
  }
  return Array.from({ length: samples }, (_, idx) => {
    const s = idx / samples;
    const h = heightFn(s);
    const delta = s < 1 ? 1e-4 : -1e-4;
    const slope = (heightFn(s + delta) - h) / delta;
    const len = Math.sqrt(slope * slope + 1);
    const normal = [-slope / len, -1 / len];
    const refracted = refract(normal[0], normal[1]);
    if (refracted) {
      const depth = h * bezelWidth + glassThickness;
      return refracted[0] * (depth / refracted[1]);
    }
    return 0;
  });
}

function projectRoundedCorner(r, s, dx, dy) {
  const a1 = Math.atan2(s - r, s);
  const a2 = Math.atan2(s, s - r);
  const span = a2 - a1;
  const angle = Math.atan2(Math.abs(dy), Math.abs(dx));
  if (angle <= a1 || angle >= a2) {
    return Math.abs(dy) > Math.abs(dx)
      ? [Math.abs(dx / dy) * s * Math.sign(dx), s * Math.sign(dy)]
      : [s * Math.sign(dx), Math.abs(dy / dx) * s * Math.sign(dy)];
  }
  const t = (angle - a1) / (span / (Math.PI / 2));
  return [
    (s - r + Math.cos(t) * r) * Math.sign(dx),
    (s - r + Math.sin(t) * r) * Math.sign(dy),
  ];
}

function getCornerTemplate(radius, bezelWidth, glassThickness, refractiveIndex) {
  const r = Math.max(2, Math.round(radius));
  const b = Math.max(2, Math.round(bezelWidth));
  const key = `${r}_${b}_${glassThickness}_${refractiveIndex}`;
  if (cornerCache.has(key)) {
    return cornerCache.get(key);
  }

  const pixelRatio = 2;
  const cornerWidth = Math.max(r, b);
  const templateLogicalSize = cornerWidth * 2 + 1;
  const size = templateLogicalSize * pixelRatio;
  const radPx = Math.min(r * pixelRatio, size / 2);
  const bezPx = Math.min(b * pixelRatio, size / 2);

  const profile = computeSnellProfile(glassThickness, b, convexCircle, refractiveIndex, 128);
  const maxDisplacement = Math.max(1e-4, ...profile.map(Math.abs));

  const imgData = new ImageData(size, size);
  // Neutral displacement: R=128, G=128, B=0, A=255 -> 0xFF008080 in little-endian
  new Uint32Array(imgData.data.buffer).fill(4278222976);

  const data = imgData.data;
  const s = Math.max(radPx, bezPx);
  const c = size - s * 2;
  const radSq = radPx * radPx;
  const radPlus1Sq = (radPx + 1) ** 2;
  const innerSq = bezPx <= radPx ? (radPx - bezPx) ** 2 : 0;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const dx = x < s ? x - s : x >= size - s ? x - s - c : 0;
      const dy = y < s ? y - s : y >= size - s ? y - s - c : 0;
      const distSq = dx * dx + dy * dy;

      if (bezPx <= radPx) {
        if (distSq <= radPlus1Sq && distSq >= innerSq) {
          const dist = Math.sqrt(distSq);
          const distFromEdge = radPx - dist;
          const angle = Math.atan2(dy, dx);
          const edgeAlpha = distSq > radSq ? 1 - distFromEdge : 1;
          const ratio = distFromEdge / radPx;
          const mappedRatio = bezPx > radPx ? ratio : distFromEdge / bezPx;
          const disp = profile[Math.round(mappedRatio * profile.length)] ?? 0;
          const vx = (-Math.cos(angle) * disp) / maxDisplacement;
          const vy = (-Math.sin(angle) * disp) / maxDisplacement;
          data[idx] = 128 + vx * 127 * edgeAlpha;
          data[idx + 1] = 128 + vy * 127 * edgeAlpha;
          data[idx + 2] = 0;
          data[idx + 3] = 255;
        }
      } else {
        const [bx, by] = projectRoundedCorner(radPx, s, dx, dy);
        const distFromBorder = Math.sqrt((bx - dx) ** 2 + (by - dy) ** 2);
        const inCorner = Math.abs(dx) > s - radPx && Math.abs(dy) > s - radPx;
        const outsideCorner =
          inCorner && (Math.abs(dx) - (s - radPx)) ** 2 + (Math.abs(dy) - (s - radPx)) ** 2 >= radPlus1Sq;
        if (!inCorner || !outsideCorner) {
          const dist = Math.sqrt(distSq);
          const ratio = distFromBorder / (dist + distFromBorder || 1);
          const angle = Math.atan2(dy, dx);
          const disp = profile[Math.round(ratio * profile.length)] ?? 0;
          const vx = (-Math.cos(angle) * disp) / maxDisplacement;
          const vy = (-Math.sin(angle) * disp) / maxDisplacement;
          data[idx] = 128 + vx * 127;
          data[idx + 1] = 128 + vy * 127;
          data[idx + 2] = 0;
          data[idx + 3] = 255;
        }
      }
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  canvas.getContext('2d').putImageData(imgData, 0, 0);

  const result = {
    canvas,
    cornerWidth,
    pixelRatio,
    maxDisplacement,
  };
  cornerCache.set(key, result);
  return result;
}

function getFullDisplacementDataUrl(width, height, radius, bezelWidth, glassThickness, refractiveIndex) {
  const w = Math.max(4, Math.round(width));
  const h = Math.max(4, Math.round(height));
  const r = Math.min(Math.round(radius), Math.floor(w / 2), Math.floor(h / 2));
  const b = Math.min(Math.round(bezelWidth), Math.floor(w / 2), Math.floor(h / 2));

  const fullKey = `${w}_${h}_${r}_${b}_${glassThickness}_${refractiveIndex}`;
  if (fullMapCache.has(fullKey)) {
    return fullMapCache.get(fullKey);
  }

  const tpl = getCornerTemplate(r, b, glassThickness, refractiveIndex);
  const cw = Math.min(tpl.cornerWidth, Math.floor(w / 2), Math.floor(h / 2));
  const pr = tpl.pixelRatio;
  const scw = tpl.cornerWidth * pr;
  const smid = 1 * pr;

  const outCanvas = document.createElement('canvas');
  outCanvas.width = w;
  outCanvas.height = h;
  const ctx = outCanvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const src = tpl.canvas;
  const midW = Math.max(0, w - cw * 2);
  const midH = Math.max(0, h - cw * 2);

  // Top-Left, Top, Top-Right
  ctx.drawImage(src, 0, 0, scw, scw, 0, 0, cw, cw);
  if (midW > 0) ctx.drawImage(src, scw, 0, smid, scw, cw, 0, midW, cw);
  ctx.drawImage(src, scw + smid, 0, scw, scw, w - cw, 0, cw, cw);

  // Middle-Left, Center, Middle-Right
  if (midH > 0) {
    ctx.drawImage(src, 0, scw, scw, smid, 0, cw, cw, midH);
    if (midW > 0) ctx.drawImage(src, scw, scw, smid, smid, cw, cw, midW, midH);
    ctx.drawImage(src, scw + smid, scw, scw, smid, w - cw, cw, cw, midH);
  }

  // Bottom-Left, Bottom, Bottom-Right
  ctx.drawImage(src, 0, scw + smid, scw, scw, 0, h - cw, cw, cw);
  if (midW > 0) ctx.drawImage(src, scw, scw + smid, smid, scw, cw, h - cw, midW, cw);
  ctx.drawImage(src, scw + smid, scw + smid, scw, scw, w - cw, h - cw, cw, cw);

  const entry = {
    dataUrl: outCanvas.toDataURL(),
    maxDisplacement: tpl.maxDisplacement,
    w,
    h,
    r,
  };

  if (fullMapCache.size > 150) {
    const oldestKey = fullMapCache.keys().next().value;
    fullMapCache.delete(oldestKey);
  }
  fullMapCache.set(fullKey, entry);
  return entry;
}

export const RefractiveGlass = ({
  pill = false,
  radius: propRadius = 24,
  bezelWidth: propBezelWidth,
  blur = 6,
  glassThickness = 60,
  refractiveIndex = 1.46,
  style = {},
  children,
  ...props
}) => {
  const rawId = useId();
  const filterId = useMemo(() => `rg_${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`, [rawId]);
  const elRef = useRef(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = elRef.current;
    if (!el) return;

    const updateFromElement = () => {
      const nw = Math.round(el.offsetWidth || el.getBoundingClientRect().width);
      const nh = Math.round(el.offsetHeight || el.getBoundingClientRect().height);
      if (nw > 0 && nh > 0) {
        setSize((prev) => (prev.width === nw && prev.height === nh ? prev : { width: nw, height: nh }));
      }
    };

    updateFromElement();
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const box = entry.borderBoxSize?.[0];
        const nw = Math.round(box ? box.inlineSize : entry.contentRect.width);
        const nh = Math.round(box ? box.blockSize : entry.contentRect.height);
        if (nw > 0 && nh > 0) {
          setSize((prev) => (prev.width === nw && prev.height === nh ? prev : { width: nw, height: nh }));
        }
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const effectiveRadius = pill
    ? size.height > 0
      ? Math.round(size.height / 2)
      : 9999
    : propRadius;

  const effectiveBezel =
    propBezelWidth !== undefined
      ? propBezelWidth
      : pill
      ? Math.max(4, Math.round((size.height || 48) / 3.4))
      : Math.min(18, Math.max(6, Math.round(propRadius * 0.65)));

  const mapData = useMemo(() => {
    if (size.width <= 0 || size.height <= 0) return null;
    return getFullDisplacementDataUrl(
      size.width,
      size.height,
      effectiveRadius,
      effectiveBezel,
      glassThickness,
      refractiveIndex
    );
  }, [size.width, size.height, effectiveRadius, effectiveBezel, glassThickness, refractiveIndex]);

  return (
    <>
      {mapData && (
        <svg
          colorInterpolationFilters="sRGB"
          style={{ display: 'none' }}
        >
          <defs>
            <filter id={filterId}>
              <feGaussianBlur in="SourceGraphic" stdDeviation={blur} result="blurred" />
              <feImage
                href={mapData.dataUrl}
                x={0}
                y={0}
                width={mapData.w}
                height={mapData.h}
                preserveAspectRatio="none"
                result="disp"
              />
              <feDisplacementMap
                in="blurred"
                in2="disp"
                scale={mapData.maxDisplacement}
                xChannelSelector="R"
                yChannelSelector="G"
              />
            </filter>
          </defs>
        </svg>
      )}
      <div
        ref={elRef}
        style={{
          ...style,
          borderRadius: `${effectiveRadius}px`,
          backdropFilter: `blur(${Math.max(24, blur * 3)}px)`,
          WebkitBackdropFilter: `blur(${Math.max(24, blur * 3)}px)`,
          transform: style.transform || 'translateZ(0)',
        }}
        {...props}
      >
        {children}
      </div>
    </>
  );
};

export default RefractiveGlass;
