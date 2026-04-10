// =========================
// 🌍 LIVE BACKEND URL
// =========================
const API = "https://food-app-backend-mhfp.onrender.com";

// =========================
// 🍔 SOCKET CONNECTION
// =========================
let socket;

if (typeof io !== "undefined") {
  socket = io(API);

  socket.on("connect", () => {
    console.log("✅ Connected:", socket.id);
  });

  socket.on("newOrder", (order) => {
    console.log("🔥 New order received:", order);
    loadOrders(); // refresh admin orders
  });

  socket.on("disconnect", () => {
    console.log("❌ Disconnected");
  });
}

// =========================
// 🍔 LOAD FOODS
// =========================
async function loadFoods() {
  try {
    const res = await fetch(`${API}/api/foods`);
    const foods = await res.json();

    const box = document.getElementById("foodBox");
    box.innerHTML = "";

    foods.forEach((f) => {
      box.innerHTML += `
        <div class="food-card">
          <h3>${f.name}</h3>
          <p>₵${f.price}</p>
          <button onclick="addToCart('${f._id}', '${f.name}', ${f.price})">
            Add to Cart
          </button>
        </div>
      `;
    });
  } catch (err) {
    console.log("Error loading foods:", err);
  }
}

// =========================
// 🛒 CART SYSTEM
// =========================
let cart = [];

function addToCart(id, name, price) {
  cart.push({ id, name, price });
  updateCartUI();
}

function updateCartUI() {
  const cartBox = document.getElementById("cartBox");
  const totalBox = document.getElementById("totalBox");

  cartBox.innerHTML = "";

  let total = 0;

  cart.forEach((item) => {
    total += item.price;

    cartBox.innerHTML += `
      <div>
        ${item.name} - ₵${item.price}
      </div>
    `;
  });

  totalBox.innerText = `Total: ₵${total}`;
}

// =========================
// 🧾 CHECKOUT / ORDER
// =========================
async function checkout() {
  const name = prompt("Enter name:");
  if (!name || name.trim() === "") {
    alert("Name is required");
    return;
  }

  const location = prompt("Enter location:");
  if (!location || location.trim() === "") {
    alert("Location is required");
    return;
  }

  const paymentMethod = "Cash";

  const total = cart.reduce((sum, item) => sum + item.price, 0);

  const order = {
    customerName: name,
    location,
    paymentMethod,
    items: cart,
    total
  };

  try {
    const res = await fetch(`${API}/api/order`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(order)
    });

    const data = await res.json();

    alert("Order placed successfully!");

    cart = [];
    updateCartUI();
  } catch (err) {
    console.log("Checkout error:", err);
    alert("Order failed");
  }
}

// =========================
// 📦 ADMIN LOAD ORDERS
// =========================
async function loadOrders() {
  try {
    const res = await fetch(`${API}/api/orders`);
    const orders = await res.json();

    const adminBox = document.getElementById("adminBox");
    if (!adminBox) return;

    adminBox.innerHTML = "";

    orders.forEach((o) => {
      adminBox.innerHTML += `
        <div class="order-card">
          <h4>${o.customerName}</h4>
          <p>${o.location}</p>
          <p>Total: ₵${o.total}</p>
        </div>
      `;
    });
  } catch (err) {
    console.log("Admin load error:", err);
  }
}

// =========================
// 🚀 INIT APP
