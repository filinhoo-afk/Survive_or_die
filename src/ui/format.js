/** Секунды в «м:сс» — для таймера забега и итогов. */
export function formatTime(seconds) {
  const total = Math.floor(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/** Крупные числа с пробелами между разрядами: 12 345. */
export function formatNumber(value) {
  return Math.round(value).toLocaleString('ru-RU');
}
