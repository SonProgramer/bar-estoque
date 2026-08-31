function renderProducts() {
  fetch('/api/products')
    .then(res => res.json())
    .then(products => {
      productsData = products;
      const search = document.getElementById('prod-search').value.toLowerCase();
      const catFilter = document.getElementById('prod-filter-cat').value;
      const tbody = document.getElementById('prod-list');
      tbody.innerHTML = '';

      products.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(search) || (p.barcode && p.barcode.includes(search));
        const matchesCat = catFilter === '' || p.category === catFilter;
        return matchesSearch && matchesCat;
      }).forEach(p => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><b>${p.name}</b><br><small>${p.brand || ''}</small></td>
          <td>${p.category}</td>
          <td>${p.quantity} ${p.unit}</td>
          <td>${p.min_stock}</td>
          <td>R$ ${p.sell_price.toFixed(2)}</td>
          <td>${getStatusBadge(p.quantity, p.min_stock)}</td>
          <td>
            ${currentUser.role === 'ADMINISTRADOR' ? `
              <button class="btn btn-warning" onclick="editProduct(${p.id})">✏️</button>
              <button class="btn btn-danger" onclick="deleteProduct(${p.id})">🗑️</button>
            ` : '-'}
          </td>
        `;
        tbody.appendChild(tr);
      });
    });
}

function openProductModal(product = null) {
  document.getElementById('prod-modal').style.display = 'flex';
  if (product) {
    document.getElementById('modal-title').innerText = 'Editar Produto';
    document.getElementById('p-id').value = product.id;
    document.getElementById('p-name').value = product.name;
    document.getElementById('p-category').value = product.category;
    document.getElementById('p-brand').value = product.brand || '';
    document.getElementById('p-barcode').value = product.barcode || '';
    document.getElementById('p-quantity').value = product.quantity;
    document.getElementById('p-quantity').disabled = true;
    document.getElementById('p-min').value = product.min_stock;
    document.getElementById('p-unit').value = product.unit;
    document.getElementById('p-cost').value = product.cost_price;
    document.getElementById('p-sell').value = product.sell_price;
    document.getElementById('p-location').value = product.location || '';
    document.getElementById('p-notes').value = product.notes || '';
  } else {
    document.getElementById('modal-title').innerText = 'Cadastrar Produto';
    document.getElementById('prod-form').reset();
    document.getElementById('p-id').value = '';
    document.getElementById('p-quantity').disabled = false;
  }
}

function closeProductModal() {
  document.getElementById('prod-modal').style.display = 'none';
}

document.getElementById('prod-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const id = document.getElementById('p-id').value;
  const payload = {
    name: document.getElementById('p-name').value,
    category: document.getElementById('p-category').value,
    brand: document.getElementById('p-brand').value,
    barcode: document.getElementById('p-barcode').value,
    quantity: parseInt(document.getElementById('p-quantity').value) || 0,
    min_stock: parseInt(document.getElementById('p-min').value) || 0,
    unit: document.getElementById('p-unit').value,
    cost_price: parseFloat(document.getElementById('p-cost').value) || 0,
    sell_price: parseFloat(document.getElementById('p-sell').value) || 0,
    location: document.getElementById('p-location').value,
    notes: document.getElementById('p-notes').value
  };

  const url = id ? `/api/products/${id}` : '/api/products';
  const method = id ? 'PUT' : 'POST';

  fetch(url, {
    method: method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).then(res => {
    if (!res.ok) throw new Error('Erro ao salvar produto');
    return res.json();
  }).then(() => {
    closeProductModal();
    renderProducts();
  }).catch(err => alert(err.message));
});

function editProduct(id) {
  const p = productsData.find(item => item.id === id);
  if (p) openProductModal(p);
}

function deleteProduct(id) {
  if (confirm('Deseja realmente excluir este produto?')) {
    fetch(`/api/products/${id}`, { method: 'DELETE' })
      .then(() => renderProducts());
  }
}

let html5QrcodeScanner = null;

function startBarcodeScanner() {
  const reader = document.getElementById('reader');
  reader.style.display = 'block';

  if (!html5QrcodeScanner) {
    html5QrcodeScanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: { width: 250, height: 150 } });
    html5QrcodeScanner.render((decodedText) => {
      html5QrcodeScanner.clear();
      reader.style.display = 'none';
      const prod = productsData.find(p => p.barcode === decodedText);
      if (prod) {
        alert(`Produto Encontrado: ${prod.name}`);
        if (currentUser.role === 'ADMINISTRADOR') editProduct(prod.id);
      } else {
        if (confirm(`Produto não encontrado para o código ${decodedText}. Deseja cadastrar?`)) {
          openProductModal();
          document.getElementById('p-barcode').value = decodedText;
        }
      }
    });
  }
}