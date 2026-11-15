/**
 * Chart.js Analytics Renderer for Server Overview
 */

function renderActivityChart(canvasId, labels, messageData, xpData) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;

  const chartCtx = ctx.getContext('2d');

  // Gradient for Messages dataset
  const msgGradient = chartCtx.createLinearGradient(0, 0, 0, 300);
  msgGradient.addColorStop(0, 'rgba(88, 101, 242, 0.4)');
  msgGradient.addColorStop(1, 'rgba(88, 101, 242, 0.0)');

  // Gradient for XP dataset
  const xpGradient = chartCtx.createLinearGradient(0, 0, 0, 300);
  xpGradient.addColorStop(0, 'rgba(16, 185, 129, 0.3)');
  xpGradient.addColorStop(1, 'rgba(16, 185, 129, 0.0)');

  new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      datasets: [
        {
          label: 'Messages Sent',
          data: messageData || [65, 89, 120, 145, 190, 240, 210],
          borderColor: '#5865F2',
          backgroundColor: msgGradient,
          borderWidth: 2,
          fill: true,
          tension: 0.35,
          pointBackgroundColor: '#5865F2',
          pointRadius: 4
        },
        {
          label: 'XP Earned',
          data: xpData || [320, 480, 610, 850, 1100, 1420, 1310],
          borderColor: '#10B981',
          backgroundColor: xpGradient,
          borderWidth: 2,
          fill: true,
          tension: 0.35,
          pointBackgroundColor: '#10B981',
          pointRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: '#94A3B8',
            font: { family: 'inherit', size: 12 }
          }
        },
        tooltip: {
          backgroundColor: '#1E2538',
          titleColor: '#FFFFFF',
          bodyColor: '#CBD5E1',
          borderColor: '#334155',
          borderWidth: 1,
          padding: 12
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(30, 37, 56, 0.6)' },
          ticks: { color: '#64748B' }
        },
        y: {
          grid: { color: 'rgba(30, 37, 56, 0.6)' },
          ticks: { color: '#64748B' }
        }
      }
    }
  });
}
