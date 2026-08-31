let confProducts = [];
let confCheckedCount = 0;

function initConference() {
  const cat = document.getElementById('conf-filter-cat').value;
  fetch('/api/products')
    .then(res => res.json())
    .then(products => {
      confProducts = products.filter(p => cat === 'Todos' || p.category === cat);
      confCheckedCount = 0;
      updateConfProgress();
      renderConfCards();
    });
}

function updateConfProgress() {
  document.getElementById('conf-progress').innerText = `Conferidos: ${confCheckedCount}/${confProducts.length}`;
}

function renderConfCards() {
  const container = document.getElementById('conf-cards-container');
  container.innerHTML = '';

  if (confProducts.length === 0) {
    container.innerHTML = '<p>Nenhum produto cadastrado nesta categoria.</p>';
    return;
  }

  confProducts.forEach(p => {
    const card = document.createElement('div');
    card.className = 'conf-card';
    card.id = `conf-card-${p.id}`;
    card.innerHTML = `
      <h3>${p.name}</h3>
      <p>Estoque registrado: <b>${p.quantity}</b></p>
      <div class="conf-controls">
        <button class="btn btn-secondary" onclick="adjustConfQty(${p.id}, -1)">-</button>
        <input type="number" id="conf-input-${p.id}" value="${p.quantity}">
        <button class="btn btn-secondary" onclick="adjustConfQty(${p.id}, 1)">+</button>
        <button class="btn btn-primary" onclick="confirmConference(${p.id})">CONFIRMAR</button>
      </div>
      <div id="conf-result-${p.id}" style="margin-top: 10px;"></div>
    `;
    container.appendChild(card);
  });
}

function adjustConfQty(id, delta) {
  const input = document.getElementById(`conf-input-${id}`);
  let val = parseInt(input.value) || 0;
  val = Math.max(0, val + delta);
  input.value = val;
}

function confirmConference(id) {
  const foundStock = parseInt(document.getElementById(`conf-input-${id}`).value);
  
  fetch('/api/conferences', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ product_id: id, found_stock: foundStock })
  })
  .then(res => res.json())
  .then(res => {
    const resultDiv = document.getElementById(`conf-result-${id}`);
    confCheckedCount++;
    updateConfProgress();

    if (res.difference === 0) {
      resultDiv.innerHTML = '<b style="color:var(--success);">🟢 CONFERÊNCIA CORRETA</b>';
    } else {
      resultDiv.innerHTML = `
        <b style="color:var(--danger);">🔴 DIVERGÊNCIA (${res.difference > 0 ? '+' : ''}${res.difference})</b><br>
        <p style="margin-top:5px;">Deseja ajustar o estoque para a quantidade encontrada?</p>
        <div style="display:flex; gap:10px; margin-top:5px;">
          <button class="btn btn-danger" onclick="this.parentElement.parentElement.innerHTML='Ajuste cancelado.'">CANCELAR</button>
          <button class="btn btn-warning" onclick="applyStockAdjustment(${id}, ${foundStock})">AJUSTAR ESTOQUE</button>
        </div>
      `;
    }
  });
}

function applyStockAdjustment(productId, newQty) {
  fetch('/api/movements', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      product_id: productId,
      type: 'AJUSTE',
      quantity: newQty,
      notes: 'Ajuste pós-conferência'
    })
  })
  .then(res => res.json())
  .then(() => {
    alert('Estoque ajustado com sucesso!');
    initConference();
  });
}