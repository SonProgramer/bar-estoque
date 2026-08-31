function loadReports() {
  const period = document.getElementById('rep-period').value;
  fetch(`/api/reports?period=${period}`)
    .then(res => res.json())
    .then(data => {
      renderReportList('rep-sales', data.topSales, 'unidades vendidas/saídas');
      renderReportList('rep-losses', data.topLosses, 'unidades perdidas');
      renderReportList('rep-diffs', data.topDiffs, 'divergências registradas');
    });
}

function renderReportList(elementId, items, label) {
  const container = document.getElementById(elementId);
  if (!items || items.length === 0) {
    container.innerHTML = '<p style="margin-top:10px; color:var(--secondary);">Nenhum dado no período.</p>';
    return;
  }

  let html = '<ul style="list-style:none; padding:0; margin-top:10px; text-align:left;">';
  items.forEach(item => {
    html += `<li style="padding: 8px 0; border-bottom: 1px solid var(--border-color);">
      <b>${item.name}</b>: ${item.total} ${label}
    </li>`;
  });
  html += '</ul>';
  container.innerHTML = html;
}