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

window.onload = () => {
  const theme = localStorage.getItem("chopspot_theme");
  if (theme === "dark") document.body.classList.add("dark");

  const user = getUser();
  if (!user || user.role !== "admin") {
    window.location.href = "admin.html";
    return;
  }

  document.getElementById("adminEmail").textContent = user.email;
  loadAnalytics();
  loadOrders();
  initSocket();
};

function initSocket() {
  if (typeof io === "undefined") return;
  const socket = io(API);
  socket.on("newOrder", (order) => {
    showToast(`New order from ${order.customerName} 🍔`, "success");
    if (document.getElementById("tab-orders").classList.contains("active")) loadOrders();
    loadAnalytics();
  });
  socket.on("orderUpdated", () => {
    if (document.getElementById("tab-orders").classList.contains("active")) loadOrders();
  });
}

let revenueChart = null;
let statusChart  = null;

function showTab(tab) {
  document.querySelectorAll(".tab-content").forEach(t => t.classList.remove("active"));
  document.querySelectorAll(".sidebar-btn").forEach(b => b.classList.remove("active"));
  document.getElementById(`tab-${tab}`).classList.add("active");
  document.querySelector(`[data-tab="${tab}"]`).classList.add("active");
  const titles = { overview: "Overview", orders: "Orders", menu: "Menu", users: "Users" };
  document.getElementById("pageTitle").textContent = titles[tab];
  document.getElementById("sidebar").classList.remove("open");
  if (tab === "overview") loadAnalytics();
  if (tab === "orders")   loadOrders();
  if (tab === "menu")     loadMenu();
  if (tab === "users")    loadUsers();
}

async function loadAnalytics() {
  try {
    const res  = await fetch(`${API}/api/analytics`, { headers: authHeaders() });
    const data = await res.json();
    if (!res.ok) return;
    document.getElementById("statRevenue").textContent = `₵${data.totalRevenue.toFixed(2)}`;
    document.getElementById("statOrders").textContent  = data.totalOrders;
    document.getElementById("statUsers").textContent   = data.totalUsers;
    document.getElementById("statFoods").textContent   = data.totalFoods;
    drawRevenueChart(data.last7Days);
    drawStatusChart(data.statusBreakdown);
    renderTopItems(data.topItems);
  } catch (err) {
    console.log("Analytics error:", err);
  }
}

function drawRevenueChart(days) {
  const ctx = document.getElementById("revenueChart");
  if (!ctx) return;
  if (revenueChart) revenueChart.destroy();
  revenueChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: days.map(d => d._id),
      datasets: [
        { label: "Revenue (₵)", data: days.map(d => d.revenue), backgroundColor: "rgba(232,93,4,0.8)", borderRadius: 8 },
        { label: "Orders", data: days.map(d => d.orders), backgroundColor: "rgba(45,108,223,0.7)", borderRadius: 8 }
      ]
    },
    options: { responsive: true, plugins: { legend: { display: true } }, scales: { y: { beginAtZero: true } } }
  });
}

function drawStatusChart(breakdown) {
  const ctx = document.getElementById("statusChart");
  if (!ctx) return;
  if (statusChart) statusChart.destroy();
  const colorMap = { pending: "#f48c06", processing: "#2d6cdf", ready: "#6c2dc7", delivered: "#2dc653", cancelled: "#e63946" };
  statusChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: breakdown.map(s => s._id),
      datasets: [{ data: breakdown.map(s => s.count), backgroundColor: breakdown.map(s => colorMap[s._id] || "#aaa"), borderWidth: 0 }]
    },
    options: { responsive: true, plugins: { legend: { position: "bottom" } } }
  });
}

function renderTopItems(items) {
  const el = document.getElementById("topItems");
  if (!items?.length) { el.innerHTML = `<p class="loading-txt">No data yet</p>`; return; }
  el.innerHTML = items.map((item, i) => `
    <div class="top-item-row">
      <span class="top-rank">${i + 1}</span>
      <span class="top-name">${item._id}</span>
      <span class="top-count">${item.count} orders</span>
      <span class="top-rev">₵${item.revenue}</span>
    </div>
  `).join("");
}

async function loadOrders() {
  const container = document.getElementById("ordersContainer");
  const filter    = document.getElementById("orderStatusFilter")?.value || "";
  try {
    const res  = await fetch(`${API}/api/orders`, { headers: authHeaders() });
    let orders = await res.json();
    if (!res.ok) { container.innerHTML = `<p class="error-txt">Error loading orders</p>`; return; }
    if (filter) orders = orders.filter(o => o.status === filter);
    if (!orders.length) {
      container.innerHTML = `<div class="empty-state"><div class="empty-icon">📦</div><p>No orders found</p></div>`;
      return;
    }
    const statusColors = { pending: "orange", processing: "blue", ready: "purple", delivered: "green", cancelled: "red" };
    container.innerHTML = orders.map(o => `
      <div class="order-row">
        <div class="order-info" onclick="openOrderDetail('${o._id}')">
          <div class="order-meta">
            <span class="order-name">${o.customerName}</span>
            <span class="status-badge ${statusColors[o.status] || ""}">${o.status}</span>
          </div>
          <p class="order-loc">📍 ${o.location}</p>
          <p class="order-items-preview">🍔 ${o.items.slice(0,3).map(i => i.name).join(", ")}${o.items.length > 3 ? " ..." : ""}</p>
          <div class="order-footer-row">
            <span class="order-total">₵${o.total}</span>
            <span class="order-date">${new Date(o.createdAt).toLocaleDateString()}</span>
            <span class="pay-status ${o.paymentStatus === 'paid' ? 'paid' : ''}">${o.paymentStatus}</span>
          </div>
        </div>
        <div class="order-actions">
          <select class="field-sm status-select" onchange="updateOrderStatus('${o._id}', this.value)">
            <option value="pending"    ${o.status==="pending"    ? "selected":""}>Pending</option>
            <option value="processing" ${o.status==="processing" ? "selected":""}>Processing</option>
            <option value="ready"      ${o.status==="ready"      ? "selected":""}>Ready</option>
            <option value="delivered"  ${o.status==="delivered"  ? "selected":""}>Delivered</option>
            <option value="cancelled"  ${o.status==="cancelled"  ? "selected":""}>Cancelled</option>
          </select>
          <button class="icon-btn danger" onclick="deleteOrder('${o._id}')">🗑️</button>
        </div>
      </div>
    `).join("");
  } catch (err) {
    container.innerHTML = `<p class="error-txt">Connection error</p>`;
  }
}

async function updateOrderStatus(id, status) {
  try {
    const res = await fetch(`${API}/api/order/${id}`, {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify({ status })
    });
    if (!res.ok) { showToast("Update failed", "error"); return; }
    showToast(`Order marked as ${status} ✅`);
    loadOrders();
  } catch (err) {
    showToast("Error updating order", "error");
  }
}

async function deleteOrder(id) {
  if (!confirm("Delete this order?")) return;
  try {
    await fetch(`${API}/api/order/${id}`, { method: "DELETE", headers: authHeaders() });
    showToast("Order deleted");
    loadOrders();
  } catch (err) {
    showToast("Error deleting", "error");
  }
}

async function openOrderDetail(id) {
  try {
    const res    = await fetch(`${API}/api/orders`, { headers: authHeaders() });
    const orders = await res.json();
    const o      = orders.find(x => x._id === id);
    if (!o) return;
    document.getElementById("orderDetailBody").innerHTML = `
      <div class="detail-grid">
        <div><b>Customer</b><p>${o.customerName}</p></div>
        <div><b>Email</b><p>${o.customerEmail || "—"}</p></div>
        <div><b>Location</b><p>${o.location}</p></div>
        <div><b>Payment</b><p>${o.paymentMethod} — ${o.paymentStatus}</p></div>
        <div><b>Status</b><p>${o.status}</p></div>
        <div><b>Date</b><p>${new Date(o.createdAt).toLocaleString()}</p></div>
      </div>
      <h4 style="margin-top:16px;">Items</h4>
      <div class="detail-items">
        ${o.items.map(i => `<div class="detail-item-row"><span>${i.name}</span><span>₵${i.price}</span></div>`).join("")}
      </div>
      <div class="detail-total"><b>Total: ₵${o.total}</b></div>
    `;
    document.getElementById("orderDetailModal").classList.add("open");
    document.getElementById("orderDetailOverlay").classList.add("active");
  } catch (err) {}
}

function closeOrderDetail() {
  document.getElementById("orderDetailModal").classList.remove("open");
  document.getElementById("orderDetailOverlay").classList.remove("active");
}

async function loadMenu() {
  const container = document.getElementById("menuContainer");
  try {
    const res   = await fetch(`${API}/api/foods`);
    const foods = await res.json();
    container.innerHTML = foods.map(f => `
      <div class="menu-admin-card ${!f.inStock ? "oos" : ""}">
        <div class="mac-img">${f.image ? `<img src="${f.image}" alt="${f.name}"/>` : "🍽️"}</div>
        <div class="mac-info">
          <div class="mac-top">
            <span class="mac-name">${f.name}</span>
            <span class="mac-cat">${f.category}</span>
          </div>
          <p class="mac-desc">${f.description || ""}</p>
          <div class="mac-bottom">
            <span class="mac-price">₵${f.price}</span>
            <span class="mac-qty">Stock: ${f.quantity}</span>
            <span class="mac-stock ${f.inStock ? "in" : "out"}">${f.inStock ? "In Stock" : "Out of Stock"}</span>
          </div>
        </div>
        <div class="mac-actions">
          <button class="icon-btn" onclick="editFood(${JSON.stringify(f).replace(/"/g,"&quot;")})">✏️</button>
          <button class="icon-btn danger" onclick="deleteFood('${f._id}')">🗑️</button>
        </div>
      </div>
    `).join("");
  } catch (err) {
    container.innerHTML = `<p class="error-txt">Error loading menu</p>`;
  }
}

function openAddFood() {
  clearFoodForm();
  document.getElementById("foodFormTitle").textContent = "Add Menu Item";
  document.getElementById("editFoodId").value = "";
  document.getElementById("foodFormCard").style.display = "block";
}

function editFood(food) {
  document.getElementById("foodFormTitle").textContent    = "Edit Menu Item";
  document.getElementById("editFoodId").value             = food._id;
  document.getElementById("foodName").value               = food.name;
  document.getElementById("foodPrice").value              = food.price;
  document.getElementById("foodCategory").value           = food.category || "";
  document.getElementById("foodDescription").value        = food.description || "";
  document.getElementById("foodImage").value              = food.image || "";
  document.getElementById("foodQuantity").value           = food.quantity || 0;
  document.getElementById("foodInStock").checked          = food.inStock;
  document.getElementById("foodFormCard").style.display   = "block";
  document.getElementById("foodFormCard").scrollIntoView({ behavior: "smooth" });
}

function cancelFoodForm() {
  document.getElementById("foodFormCard").style.display = "none";
  clearFoodForm();
}

function clearFoodForm() {
  ["foodName","foodPrice","foodCategory","foodDescription","foodImage","foodQuantity"].forEach(id => {
    document.getElementById(id).value = "";
  });
  document.getElementById("foodInStock").checked = true;
  document.getElementById("editFoodId").value    = "";
}

async function saveFood() {
  const id   = document.getElementById("editFoodId").value;
  const body = {
    name:        document.getElementById("foodName").value.trim(),
    price:       parseFloat(document.getElementById("foodPrice").value),
    category:    document.getElementById("foodCategory").value.trim(),
    description: document.getElementById("foodDescription").value.trim(),
    image:       document.getElementById("foodImage").value.trim(),
    quantity:    parseInt(document.getElementById("foodQuantity").value) || 0,
    inStock:     document.getElementById("foodInStock").checked
  };
  if (!body.name || !body.price) { showToast("Name and price required", "error"); return; }
  try {
    const url    = id ? `${API}/api/foods/${id}` : `${API}/api/foods`;
    const method = id ? "PUT" : "POST";
    const res    = await fetch(url, { method, headers: authHeaders(), body: JSON.stringify(body) });
    if (!res.ok) { showToast("Save failed", "error"); return; }
    showToast(id ? "Item updated ✅" : "Item added ✅");
    cancelFoodForm();
    loadMenu();
  } catch (err) {
    showToast("Error saving", "error");
  }
}

async function deleteFood(id) {
  if (!confirm("Delete this item?")) return;
  try {
    await fetch(`${API}/api/foods/${id}`, { method: "DELETE", headers: authHeaders() });
    showToast("Item deleted");
    loadMenu();
  } catch (err) {
    showToast("Error deleting", "error");
  }
}

async function loadUsers() {
  const container = document.getElementById("usersContainer");
  try {
    const res   = await fetch(`${API}/api/users`, { headers: authHeaders() });
    const users = await res.json();
    if (!res.ok) { container.innerHTML = `<p class="error-txt">Error loading users</p>`; return; }
    container.innerHTML = `
      <table class="users-table">
        <thead>
          <tr>
            <th>Email</th>
            <th>Role</th>
            <th>Joined</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          ${users.map(u => `
            <tr>
              <td>${u.email}</td>
              <td><span class="role-pill ${u.role}">${u.role}</span></td>
              <td>${new Date(u.createdAt).toLocaleDateString()}</td>
              <td>${u.role !== "admin" ? `<button class="icon-btn danger" onclick="deleteUser('${u._id}')">🗑️</button>` : "—"}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;
  } catch (err) {
    container.innerHTML = `<p class="error-txt">Connection error</p>`;
  }
}

async function deleteUser(id) {
  if (!confirm("Delete this user?")) return;
  try {
    await fetch(`${API}/api/users/${id}`, { method: "DELETE", headers: authHeaders() });
    showToast("User deleted");
    loadUsers();
  } catch (err) {
    showToast("Error deleting", "error");
  }
}

function logout() {
  localStorage.removeItem("chopspot_user");
  localStorage.removeItem("chopspot_token");
  window.location.href = "admin.html";
}

function toggleSidebar() {
  document.getElementById("sidebar").classList.toggle("open");
}
