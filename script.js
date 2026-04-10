// =========================
// 🌍 LIVE BACKEND
// =========================
const API = "https://food-app-backend-mhfp.onrender.com";

// =========================
// 🔐 AUTH SYSTEM
// =========================
async function signup() {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  if (!email || !password) {
    alert("Fill all fields");
    return;
  }

  try {
    const res = await fetch(`${API}/api/signup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.message || "Signup failed");
      return;
    }

    alert("Signup successful! Now login.");
  } catch (err) {
    console.log(err);
    alert("Signup error");
  }
}

async function login() {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  if (!email || !password) {
    alert("Fill all fields");
    return;
  }

  try {
    const res = await fetch(`${API}/api/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.message || "Login failed");
      return;
    }

    localStorage.setItem("user", JSON.stringify(data));

    alert("Login successful!");

    document.getElementById("auth").style.display = "none";
    document.getElementById("app").style.display = "block";

    if (data.role === "admin") {
      document.getElementById("adminBtn").style.display = "block";
    }

    loadFoods();
    loadOrders();
    loadUsers();
  } catch (err) {
    console.log(err);
    alert("Login error");
  }
}

// =========================
// 🔓 LOGOUT
// =========================
function logout() {
  localStorage.removeItem("user");
  location.reload();
}

// =========================
// ⚙ SETTINGS
// =========================
function openSettings() {
  const s = document.getElementById("settings");
  s.style.display = s.style.display === "none" ? "block" : "none";
}

function toggleTheme() {
  document.body.classList.toggle("dark");
}

function changePassword() {
  alert("Feature coming soon");
}

function forgotPassword() {
  alert("Feature coming soon");
}

// =========================
// 🍔 SOCKET
// =========================
let socket;

if (typeof io !== "undefined") {
  socket = io(API);

  socket.on("newOrder", () => {
    loadOrders();
  });
}

// =========================
// 🍔 LOAD FOODS
// =========================
async function loadFoods() {
  const res = await fetch(`${API}/api/foods`);
  const foods = await res.json();

  const box = document.getElementById("food-container");
  box.innerHTML = "";

  foods.forEach(f => {
    box.innerHTML += `
      <div>
        <h3>${f.name}</h3>
        ₵${f.price}
        <button onclick="addToCart('${f._id}','${f.name}',${f.price})">
          Add
        </button>
      </div>
    `;
  });
}

// =========================
// 🛒 CART
// =========================
let cart = [];

function addToCart(id, name, price) {
  cart.push({ id, name, price });
  renderCart();
}

function renderCart() {
  const box = document.getElementById("cart");
  let total = 0;

  box.innerHTML = "";

  cart.forEach(item => {
    total += item.price;
    box.innerHTML += `<div>${item.name} ₵${item.price}</div>`;
  });

  box.innerHTML += `<h3>Total: ₵${total}</h3>`;
}

// =========================
// 🧾 CHECKOUT
// =========================
async function checkout() {
  const name = prompt("Enter name:");
  const location = prompt("Enter location:");

  const total = cart.reduce((a, b) => a + b.price, 0);

  await fetch(`${API}/api/order`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      customerName: name,
      location,
      paymentMethod: "Cash",
      items: cart,
      total
    })
  });

  alert("Order sent");
  cart = [];
  renderCart();
}

// =========================
// 📦 ADMIN
// =========================
function toggleAdmin() {
  const a = document.getElementById("admin");
  a.style.display = a.style.display === "none" ? "block" : "none";
}

async function loadOrders() {
  try {
    const res = await fetch(`${API}/api/orders`);
    const orders = await res.json();

    const box = document.getElementById("orders");
    if (!box) return;

    box.innerHTML = "";

    orders.forEach(o => {
      box.innerHTML += `
        <div class="order-card">
          <h4>${o.customerName}</h4>
          <p>${o.location}</p>
          <p>Total: ₵${o.total}</p>

          <select onchange="updateOrder('${o._id}', this.value)">
            <option value="pending">Pending</option>
            <option value="processing">Processing</option>
            <option value="delivered">Delivered</option>
          </select>
        </div>
      `;
    });

  } catch (err) {
    console.log("Orders load error:", err);
  }
}

async function updateOrder(id, status) {
  try {
    await fetch(`${API}/api/order/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ status })
    });

    loadOrders(); // refresh
  } catch (err) {
    console.log("Update order error:", err);
  }
}

// =========================
// 🚀 AUTO LOGIN
// =========================
window.onload = () => {
  const user = JSON.parse(localStorage.getItem("user"));

  if (user) {
    document.getElementById("auth").style.display = "none";
    document.getElementById("app").style.display = "block";

    if (user.role === "admin") {
      document.getElementById("adminBtn").style.display = "block";
    }

    loadFoods();
    loadOrders();
  }
};

// =========================
// ⚙️ SETTINGS SYSTEM
// =========================

// LOGOUT
function logout() {
  localStorage.removeItem("user");
  location.reload();
}

// THEME
function toggleTheme() {
  document.body.classList.toggle("dark");

  if (document.body.classList.contains("dark")) {
    localStorage.setItem("theme", "dark");
  } else {
    localStorage.setItem("theme", "light");
  }
}

// LOAD THEME ON START
window.addEventListener("load", () => {
  const theme = localStorage.getItem("theme");

  if (theme === "dark") {
    document.body.classList.add("dark");
  }
});

async function changePassword() {
  const user = JSON.parse(localStorage.getItem("user"));

  const oldPass = document.getElementById("oldPass").value;
  const newPass = document.getElementById("newPass").value;

  if (!oldPass || !newPass) {
    alert("Fill all fields");
    return;
  }

  const res = await fetch(`${API}/api/change-password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      email: user.email,
      oldPassword: oldPass,
      newPassword: newPass
    })
  });

  const data = await res.json();
  alert(data.message);
}	


// =========================
// 👤 LOAD USERS (ADMIN)
// =========================
async function loadUsers() {
  try {
    const res = await fetch(`${API}/api/users`);
    const users = await res.json();

    const box = document.getElementById("users");
    if (!box) return;

    box.innerHTML = "";

    users.forEach(u => {
      box.innerHTML += `
        <div class="user-card">
          <p><b>Email:</b> ${u.email}</p>
          <p><b>Role:</b> ${u.role}</p>
          <p><b>ID:</b> ${u._id}</p>
        </div>
      `;
    });

  } catch (err) {
    console.log("Users load error:", err);
  }
}
