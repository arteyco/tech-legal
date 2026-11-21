let cart = [];

async function loadProducts() {
  const res = await fetch('/api/products');
  const products = await res.json();
  const grid = document.getElementById('storeGrid');
  grid.innerHTML = products.map(p => `
    <div class="product-card">
      <h3>${p.name}</h3>
      <p>${p.description}</p>
      <div class="price">$${p.price}</div>
      <button class="btn" onclick="addToCart('${p.name.replace(/'/g, "\\'")}', ${p.price})">Add to Cart</button>
    </div>
  `).join('');
}

function addToCart(name, price) {
  cart.push({ name, price });
  updateCart();
  alert(name + " added to cart");
}

function updateCart() {
  const itemsDiv = document.getElementById('cart-items');
  const count = document.getElementById('cart-count');
  const totalEl = document.getElementById('cart-total');
  itemsDiv.innerHTML = '';
  let total = 0;
  cart.forEach((item, i) => {
    itemsDiv.innerHTML += `<div class="cart-item">${item.name} <span>$${item.price} <button onclick="removeItem(${i})" style="border:none;background:none;color:red;cursor:pointer;">✕</button></span></div>`;
    total += item.price;
  });
  count.textContent = cart.length;
  totalEl.textContent = total;
  document.getElementById('pay-amount').textContent = total;
}

function removeItem(index) {
  cart.splice(index, 1);
  updateCart();
}

function toggleCart() {
  document.getElementById('cart').classList.toggle('show');
}

function showCheckout() {
  if (cart.length === 0) return alert("Your cart is empty");
  document.getElementById('checkoutModal').style.display = 'flex';
  document.getElementById('cart').classList.remove('show');
}

document.getElementById('paymentForm').addEventListener('submit', async function(e) {
  e.preventDefault();
  const total = cart.reduce((sum, i) => sum + i.price, 0);
  const payload = {
    items: cart,
    total,
    customer_name: document.getElementById('payName').value,
    customer_email: document.getElementById('payEmail').value
  };
  const res = await fetch('/api/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (data.success) {
    document.getElementById('payMsg').style.display = 'block';
    setTimeout(() => {
      document.getElementById('checkoutModal').style.display = 'none';
      cart = [];
      updateCart();
      document.getElementById('payMsg').style.display = 'none';
      this.reset();
    }, 1800);
  }
});

document.getElementById('consultForm').addEventListener('submit', async function(e) {
  e.preventDefault();
  const payload = {
    name: document.getElementById('cName').value,
    email: document.getElementById('cEmail').value,
    phone: document.getElementById('cPhone').value,
    area: document.getElementById('cArea').value,
    preferred_date: document.getElementById('cDate').value,
    message: document.getElementById('cMessage').value
  };
  const res = await fetch('/api/consult', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (data.success) {
    document.getElementById('consultMsg').style.display = 'block';
    this.reset();
  }
});

async function loadKB() {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'list' })
  });
  // Simple static display of common topics
  const topics = [
    { q: 'Consultation fees', a: 'Initial partner consultation is $350 (60 minutes + written summary).' },
    { q: 'Practice areas', a: 'Corporate, IP, Employment, Family/Estate, Litigation.' },
    { q: 'How to use the Store', a: 'Add services to cart, then proceed to the simulated payment form.' },
    { q: 'How to book a consult', a: 'Fill the form in the Consult section and submit.' }
  ];
  const list = document.getElementById('kbList');
  list.innerHTML = topics.map(t => `
    <div class="kb-item" onclick="this.classList.toggle('open')">
      <h4>${t.q}</h4>
      <p>${t.a}</p>
    </div>
  `).join('');
}

function toggleChat() {
  document.getElementById('chatWindow').classList.toggle('open');
}

async function sendMessage() {
  const input = document.getElementById('chatInput');
  const text = input.value.trim();
  if (!text) return;
  const messages = document.getElementById('chatMessages');
  messages.innerHTML += `<div class="message user">${text}</div>`;
  input.value = '';

  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: text })
  });
  const data = await res.json();

  setTimeout(() => {
    messages.innerHTML += `<div class="message bot">${data.reply}</div>`;
    messages.scrollTop = messages.scrollHeight;
  }, 400);
  messages.scrollTop = messages.scrollHeight;
}

// Init
loadProducts();
loadKB();