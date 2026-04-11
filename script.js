const API = "https://food-app-backend-mhfp.onrender.com";

function getToken() { return localStorage.getItem("chopspot_token"); }
function getUser()  { return JSON.parse(localStorage.getItem("chopspot_user") || "null"); }
function authHeaders() {
  return { "Content-Type": "application/json", "Authorization": `Bearer ${getToken()}` };
}

function showToast(msg, type = "success") {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.className = `toast ${type} show`;
  setTimeout(() => t.classList.remove("show"), 3500);
}

function switchTab(tab) {
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  document.querySelector(`[onclick="switchTab('${tab}')"]`).classList.add("active");
  document.getElementById("loginForm").style.display  = tab === "login"  ? "block" : "none";
  document.getElementById("signupForm").style.display = tab === "signup" ? "block" : "none";
  document.getElementById("forgotForm").style.display = "none";
  clearAuthMsg();
}

function showForgot() {
  document.getElementById("loginForm").style.display  = "none";
  document.getElementById("signupForm").style.display = "none";
  document.getElementById("forgotForm").style.display = "block";
}
function showLogin() { switchTab("login"); }

function showAuthMsg(msg, type = "error") {
  const el = document.getElementById("authMsg");
  el.textContent = msg;
  el.className = `auth-msg ${type}`;
  el.style.display = "block";
}
function clearAuthMsg() {
  const el = document.getElementById("authMsg");
  if (el) el.style.display = "none";
}

async function signup() {
  const email    = document.getElementById("signupEmail").value.trim();
  const password = document.getElementById("signupPassword").value;
  if (!email || !password) { showAuthMsg("Fill all fields"); return; }
  try {
    const res  = await fetch(`${API}/api/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) { showAuthMsg(data.message || "Signup failed"); return; }
    localStorage.setItem("chopspot_user",  JSON.stringify(data));
    localStorage.setItem("chopspot_token", data.token);
    showAuthMsg("Account created! Welcome 🎉", "success");
    setTimeout(enterApp, 800);
  } catch (err) {
    showAuthMsg("Connection error");
  }
}

async function login() {
  const email    = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;
  if (!email || !password) { showAuthMsg("Fill all fields"); return; }
  try {
    const res  = await fetch(`${API}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) { showAuthMsg(data.message || "Login failed"); return; }
    localStorage.setItem("chopspot_user",  JSON.stringify(data));
    localStorage.setItem("chopspot_token", data.token);
    enterApp();
  } catch (err) {
    showAuthMsg("Connection error");
  }
}

function logout() {
  localStorage.removeItem("chopspot_user");
  localStorage.removeItem("chopspot_token");
  location.reload();
}

function enterApp() {
  const user = getUser();
  if (!user) return;
  document.getElementById("authScreen").classList.remove("active");
  document.getElementById("authScreen").style.display = "none";
  document.getElementById("appScreen").classList.add("active");
  document.getElementById("appScreen").style.display = "block";
  document.getElementById("userGreeting").textContent = `Welcome back, ${user.email.split("@")[0]} 👋`;
  document.getElementById("settingsEmail").textContent = user.email;
  document.getElementById("settingsRole").textContent  = user.role.toUpperCase();
  if (user.role === "admin") {
    document.getElementById("adminNavBtn").style.display = "flex";
  }
  loadFoods();
  initSocket();
}

window.onload = () => {
  const theme = localStorage.getItem("chopspot_theme");
  if (theme === "dark") document.body.classList.add("dark");
  const user = getUser();
  if (user && getToken()) enterApp();
};

function initSocket() {
  if (typeof io === "undefined") return;
  const socket = io(API);
  socket.on("orderUpdated", (order) => {
    showToast(`Order status: ${order.status.toUpperCase()} 📦`);
  });
}

let allFoods = [];
let activeCategory = "All";

async function loadFoods() {
  try {
    const res = await fetch(`${API}/api/foods`);
    allFoods  = await res.json();
    const cats = ["All", ...new Set(allFoods.map(f => f.category).filter(Boolean))];
    const bar  = document.getElementById("categoryBar");
    bar.innerHTML = cats.map(c =>
      `<button class="cat-btn ${c === activeCategory ? "active" : ""}" onclick="filterCategory('${c}')">${c}</button>`
    ).join("");
    renderFoods(allFoods);
  } catch (err) {
    console.log("Foods error:", err);
  }
}

function filterCategory(cat) {
  activeCategory = cat;
  document.querySelectorAll(".cat-btn").forEach(b => {
    b.classList.toggle("active", b.textContent === cat);
  });
  const filtered = cat === "All" ? allFoods : allFoods.filter(f => f.category === cat);
  renderFoods(filtered);
}

function renderFoods(foods) {
  const grid = document.getElementById("foodGrid");
  if (!foods.length) { grid.innerHTML = `<p class="empty-txt">No items available</p>`; return; }
  grid.innerHTML = foods.map(f => `
    <div class="food-card ${!f.inStock ? "out-of-stock" : ""}">
      <div class="food-img">${f.image ? `<img src="${f.image}" alt="${f.name}"/>` : "🍽️"}</div>
      <div class="food-info">
        <div class="food-cat">${f.category || ""}</div>
        <h4 class="food-name">${f.name}</h4>
        <p class="food-desc">${f.description || ""}</p>
        <div class="food-bottom">
          <span class="food-price">₵${f.price}</span>
          ${f.inStock
            ? `<button class="add-btn" onclick="addToCart('${f._id}','${f.name}',${f.price})">+ Add</button>`
            : `<span class="out-label">Out of stock</span>`
          }
        </div>
      </div>
    </div>
  `).join("");
}

let cart = [];

function addToCart(id, name, price) {
  const existing = cart.find(i => i.id === id);
  if (existing) existing.qty++;
  else cart.push({ id, name, price, qty: 1 });
  updateCartBadge();
  showToast(`${name} added to cart 🛒`);
}

function updateCartBadge() {
  const badge = document.getElementById("cartBadge");
  const total = cart.reduce((s, i) => s + i.qty, 0);
  badge.textContent = total;
  badge.style.display = total > 0 ? "flex" : "none";
}

function removeFromCart(id) {
  cart = cart.filter(i => i.id !== id);
  updateCartBadge();
  renderCartDrawer();
}

function changeQty(id, delta) {
  const item = cart.find(i => i.id === id);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) removeFromCart(id);
  else { updateCartBadge(); renderCartDrawer(); }
}

function openCart() {
  renderCartDrawer();
  document.getElementById("cartDrawer").classList.add("open");
  document.getElementById("cartOverlay").classList.add("active");
}
function closeCart() {
  document.getElementById("cartDrawer").classList.remove("open");
  document.getElementById("cartOverlay").classList.remove("active");
}

function renderCartDrawer() {
  const itemsEl  = document.getElementById("cartItems");
  const footerEl = document.getElementById("cartFooter");
  const emptyEl  = document.getElementById("emptyCart");
  if (!cart.length) {
    itemsEl.innerHTML = "";
    footerEl.style.display = "none";
    emptyEl.style.display  = "flex";
    return;
  }
  emptyEl.style.display  = "none";
  footerEl.style.display = "block";
  let total = 0;
  itemsEl.innerHTML = cart.map(item => {
    const sub = item.price * item.qty;
    total += sub;
    return `
      <div class="cart-item">
        <div class="cart-item-info">
          <p class="cart-item-name">${item.name}</p>
          <p class="cart-item-price">₵${item.price} each</p>
        </div>
        <div class="cart-item-qty">
          <button onclick="changeQty('${item.id}',-1)">−</button>
          <span>${item.qty}</span>
          <button onclick="changeQty('${item.id}',1)">+</button>
        </div>
        <div class="cart-item-sub">₵${sub}</div>
        <button class="remove-btn" onclick="removeFromCart('${item.id}')">✕</button>
      </div>
    `;
  }).join("");
  document.getElementById("cartTotal").textContent = `₵${total}`;
}

let selectedPayment = "Cash";

function selectPayment(btn, method) {
  selectedPayment = method;
  document.querySelectorAll(".pay-btn").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
}

function openCheckout() {
  closeCart();
  renderCheckoutSummary();
  const user = getUser();
  if (user) document.getElementById("checkoutEmail").value = user.email;
  document.getElementById("checkoutModal").classList.add("open");
  document.getElementById("checkoutOverlay").classList.add("active");
}
function closeCheckout() {
  document.getElementById("checkoutModal").classList.remove("open");
  document.getElementById("checkoutOverlay").classList.remove("active");
}

function renderCheckoutSummary() {
  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
  document.getElementById("checkoutSummary").innerHTML = `
    <div class="summary-items">
      ${cart.map(i => `<div class="summary-row"><span>${i.name} × ${i.qty}</span><span>₵${i.price * i.qty}</span></div>`).join("")}
    </div>
    <div class="summary-total"><span>Total</span><span>₵${total}</span></div>
  `;
}

async function placeOrder() {
  const name     = document.getElementById("checkoutName").value.trim();
  const location = document.getElementById("checkoutLocation").value.trim();
  const email    = document.getElementById("checkoutEmail").value.trim();
  if (!name || !location) { showToast("Fill name and address", "error"); return; }
  if (!cart.length)       { showToast("Your cart is empty", "error"); return; }
  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
  try {
    const res = await fetch(`${API}/api/order`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        customerName: name,
        customerEmail: email,
        location,
        paymentMethod: selectedPayment,
        items: cart.flatMap(i => Array(i.qty).fill({ id: i.id, name: i.name, price: i.price })),
        total
      })
    });
    const order = await res.json();
    if (!res.ok) { showToast(order.message || "Order failed", "error"); return; }
    if (selectedPayment === "Paystack") {
      await initPaystack(email || getUser()?.email, total, order._id);
    } else {
      showToast("Order placed! Check your email 📧", "success");
      cart = [];
      updateCartBadge();
      closeCheckout();
    }
  } catch (err) {
    showToast("Error placing order", "error");
  }
}

async function initPaystack(email, total, orderId) {
  try {
    const res  = await fetch(`${API}/api/paystack/initialize`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ email, amount: total, orderId })
    });
    const data = await res.json();
    if (data.authorization_url) {
      cart = [];
      updateCartBadge();
      closeCheckout();
      window.location.href = data.authorization_url;
    } else {
      showToast("Payment initialization failed", "error");
    }
  } catch (err) {
    showToast("Payment error", "error");
  }
}

function openSettings() {
  document.getElementById("settingsDrawer").classList.add("open");
  document.getElementById("settingsOverlay").classList.add("active");
}
function closeSettings() {
  document.getElementById("settingsDrawer").classList.remove("open");
  document.getElementById("settingsOverlay").classList.remove("active");
}

function toggleTheme() {
  document.body.classList.toggle("dark");
  localStorage.setItem("chopspot_theme", document.body.classList.contains("dark") ? "dark" : "light");
}

async function changePassword() {
  const oldPass = document.getElementById("oldPass").value;
  const newPass = document.getElementById("newPass").value;
  if (!oldPass || !newPass) { showToast("Fill both fields", "error"); return; }
  try {
    const res  = await fetch(`${API}/api/change-password`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ oldPassword: oldPass, newPassword: newPass })
    });
    const data = await res.json();
    if (!res.ok) { showToast(data.message || "Failed", "error"); return; }
    showToast("Password updated ✅");
    document.getElementById("oldPass").value = "";
    document.getElementById("newPass").value = "";
  } catch (err) {
    showToast("Error updating password", "error");
  }
}

async function forgotPassword() {
  const email = document.getElementById("forgotEmail").value.trim();
  if (!email) { showAuthMsg("Enter your email"); return; }
  try {
    const res  = await fetch(`${API}/api/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });
    const data = await res.json();
    if (!res.ok) { showAuthMsg(data.message || "Failed"); return; }
    showAuthMsg("Temporary password sent to your email ✅", "success");
  } catch (err) {
    showAuthMsg("Error sending email");
  }
}

function goAdmin() {
  window.location.href = "admin-dashboard.html";
}
