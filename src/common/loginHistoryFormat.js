/**
 * @param {string | null | undefined} deviceName
 * @param {Date | string} connectedAt
 * @returns {string} e.g. "Samsung Note 5 - Lundi 10 décembre à 17:29"
 */
function formatLoginHistoryLabel(deviceName, connectedAt) {
  const label = deviceName && String(deviceName).trim() ? String(deviceName).trim() : 'Appareil inconnu';
  const d = connectedAt instanceof Date ? connectedAt : new Date(connectedAt);
  if (Number.isNaN(d.getTime())) {
    return `${label} — date inconnue`;
  }

  const weekday = new Intl.DateTimeFormat('fr-FR', { weekday: 'long' }).format(d);
  const day = d.getDate();
  const month = new Intl.DateTimeFormat('fr-FR', { month: 'long' }).format(d);
  const time = new Intl.DateTimeFormat('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);

  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  return `${label} - ${cap(weekday)} ${day} ${month} à ${time}`;
}

module.exports = {
  formatLoginHistoryLabel,
};
