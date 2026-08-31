let currentUser = null;
let productsData = [];
let categoriesList = ['caixa', 'salao', 'cozinha', 'bar', 'Outros'];

document.addEventListener('DOMContentLoaded', () => {
  checkSession();
  setupLoginForm();
  populateCategories();
  setupMovementForm();
  setupUserForm();
});

function checkSession() {
  fetch('/api/auth/me')
    .then(res => res.ok ? res.json() : null)
    .then(user => {
      if (user) {
        currentUser = user;
        initApp();
      } else {
        document.getElementById('login-screen').style.display = 'block';
        document.getElementById('app-screen').style.display = 'none';
      }
    });
}

function setupLoginForm() {
  document.getElementById('login-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const u = document.getElementById('login-username').value;
    const p = document.getElementById('login-password').value;

    fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: u, password: p })
    }).then(res => {
      if (res.ok) return res.json();
      throw new Error('Credenciais inválidas');
    }).then(data => {
      currentUser = data.user;
      initApp();
    }).catch(err => alert(err.message));
  });
}

function initApp() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app-screen').style.display = 'flex';
  document.getElementById('user-display').innerText = `Usuário: ${currentUser.name} (${currentUser.role})`;

  if (currentUser.role !== 'ADMINISTRADOR') {
    document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
  } else {
    document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'block');
  }

  loadProductsData();
  showSection('dashboard');
}

function logout() {
  fetch('/api/auth/logout', { method: 'POST' }).then(() => location.reload());
}

function showSection(sectionId) {
  document.querySelectorAll('.page-section').forEach(sec => sec.style.display = 'none');
  document.getElementById(`sec-${sectionId}`).style.display = 'block';
  
  if (sectionId === 'dashboard') updateDashboard();
  if (sectionId === 'produtos') renderProducts();
  if (sectionId === 'conferencia') initConference();
  if (sectionId === 'historico') renderHistory();
  if (sectionId === 'relatorios') loadReports();
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  document.documentElement.setAttribute('data-theme', currentTheme === 'dark' ? 'light' : 'dark');
}

function populateCategories() {
  const selects = [document.getElementById('p-category'), document.getElementById('prod-filter-cat'), document.getElementById('conf-filter-cat')];
  selects.forEach(select => {
    if (!select) return;
    categoriesList.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.innerText = cat;
      select.appendChild(opt);
    });
  });
}

function getStatusBadge(qty, min) {
  if (qty === 0) return '<span style="color:var(--danger); font-weight:bold;">🔴 EM FALTA</span>';
  if (qty <= min) return '<span style="color:var(--warning); font-weight:bold;">🟡 BAIXO</span>';
  return '<span style="color:var(--success); font-weight:bold;">🟢 NORMAL</span>';
}

function loadProductsData() {
  fetch('/api/products')
    .then(res => res.json())
    .then(data => {
      productsData = data;
      updateMovProductsSelect();
    });
}

function updateDashboard() {
  loadProductsData();
  let total = productsData.length;
  let normal = 0, baixo = 0, falta = 0;
  const attentionList = document.getElementById('dash-attention-list');
  attentionList.innerHTML = '';

  productsData.forEach(p => {
    if (p.quantity === 0) {
      falta++;
    } else if (p.quantity <= p.min_stock) {
      baixo++;
    } else {
      normal++;
    }

    if (p.quantity <= p.min_stock) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${p.name}</td>
        <td>${p.category}</td>
        <td>${p.quantity}</td>
        <td>${p.min_stock}</td>
        <td>${getStatusBadge(p.quantity, p.min_stock)}</td>
      `;
      attentionList.appendChild(tr);
    }
  });

  document.getElementById('dash-total').innerText = total;
  document.getElementById('dash-normal').innerText = normal;
  document.getElementById('dash-baixo').innerText = baixo;
  document.getElementById('dash-falta').innerText = falta;
}

function setupMovementForm() {
  document.getElementById('mov-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const data = {
      product_id: document.getElementById('mov-product').value,
      type: document.getElementById('mov-type').value,
      quantity: document.getElementById('mov-qty').value,
      notes: document.getElementById('mov-notes').value
    };

    fetch('/api/movements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(res => {
      if (!res.ok) throw new Error('Erro ao movimentar estoque');
      return res.json();
    }).then(() => {
      alert('Movimentação realizada com sucesso!');
      document.getElementById('mov-form').reset();
      loadProductsData();
    }).catch(err => alert(err.message));
  });
}

function updateMovProductsSelect() {
  const select = document.getElementById('mov-product');
  select.innerHTML = '';
  productsData.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.innerText = `${p.name} (Atual: ${p.quantity})`;
    select.appendChild(opt);
  });
}

function renderHistory() {
  fetch('/api/movements')
    .then(res => res.json())
    .then(data => {
      const search = document.getElementById('hist-search').value.toLowerCase();
      const filterType = document.getElementById('hist-filter-type').value;
      const tbody = document.getElementById('hist-list');
      tbody.innerHTML = '';

      data.filter(m => {
        const matchesName = m.product_name.toLowerCase().includes(search);
        const matchesType = filterType === '' || m.type === filterType;
        return matchesName && matchesType;
      }).forEach(m => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${new Date(m.timestamp).toLocaleString()}</td>
          <td>${m.product_name}</td>
          <td><b>${m.type}</b></td>
          <td>${m.quantity}</td>
          <td>${m.prev_stock}</td>
          <td>${m.new_stock}</td>
          <td>${m.user_name}</td>
          <td>${m.notes || '-'}</td>
        `;
        tbody.appendChild(tr);
      });
    });
}

function setupUserForm() {
  document.getElementById('user-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const data = {
      name: document.getElementById('usr-name').value,
      username: document.getElementById('usr-username').value,
      password: document.getElementById('usr-password').value,
      role: document.getElementById('usr-role').value
    };

    fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(res => {
      if (!res.ok) throw new Error('Erro ao criar usuário');
      return res.json();
    }).then(() => {
      alert('Usuário criado com sucesso!');
      document.getElementById('user-form').reset();
    }).catch(err => alert(err.message));
  });
}