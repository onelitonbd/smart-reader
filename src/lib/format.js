export function formatBytes(bytes = 0) {
  if (!bytes) return '0 MB';
  const units = ['B', 'KB', 'MB', 'GB'];
  let index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  let value = bytes / (1024 ** index);
  if (value >= 1000 && index < units.length - 1) {
    index += 1;
    value /= 1024;
  }
  return `${value.toFixed(index > 1 && value < 10 ? 1 : 0)} ${units[index]}`;
}
