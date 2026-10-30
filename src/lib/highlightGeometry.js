function normalizedRotation(rotation) {
  return ((rotation % 360) + 360) % 360;
}

function transformPoint(x, y, rotation, toDisplay) {
  const angle = normalizedRotation(rotation);
  if (toDisplay) {
    if (angle === 90) return { x: 1 - y, y: x };
    if (angle === 180) return { x: 1 - x, y: 1 - y };
    if (angle === 270) return { x: y, y: 1 - x };
    return { x, y };
  }
  if (angle === 90) return { x: y, y: 1 - x };
  if (angle === 180) return { x: 1 - x, y: 1 - y };
  if (angle === 270) return { x: 1 - y, y: x };
  return { x, y };
}

function transformRect(rect, rotation, toDisplay) {
  const points = [
    transformPoint(rect.x, rect.y, rotation, toDisplay),
    transformPoint(rect.x + rect.width, rect.y, rotation, toDisplay),
    transformPoint(rect.x, rect.y + rect.height, rotation, toDisplay),
    transformPoint(rect.x + rect.width, rect.y + rect.height, rotation, toDisplay),
  ];
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return {
    x,
    y,
    width: Math.max(...xs) - x,
    height: Math.max(...ys) - y,
  };
}

export function toCanonicalRect(rect, rotation) {
  return transformRect(rect, rotation, false);
}

export function toDisplayRect(rect, rotation) {
  return transformRect(rect, rotation, true);
}
