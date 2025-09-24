// ---------------- FIREBASE CONFIG ----------------
const firebaseConfig = {
  apiKey: "AIzaSyAfRJGZDuKszTKJ2sh1RskjCWGY3_mDl5k",
  authDomain: "agret-2ff69.firebaseapp.com",
  databaseURL: "https://agret-2ff69-default-rtdb.firebaseio.com",
  projectId: "agret-2ff69",
  storageBucket: "agret-2ff69.firebasestorage.app",
  messagingSenderId: "617874512531",
  appId: "1:617874512531:web:804ab87d3bd98b69344b66",
  measurementId: "G-8EQGHQ4WLM"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// ---------------- GLOBALS ----------------
let selectedProduct = null;
let cart = [];
let selectedCartIndex = null;
let allProducts = []; // store all products for searching

// ---------------- AUTH ----------------
function login() {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  if (email && password) {
    sessionStorage.setItem("techEmail", email);
    window.location = "main.html";
  } else {
    alert("Please enter email and password");
  }
}

function register() {
  const name = document.getElementById("regName").value;
  const email = document.getElementById("regEmail").value;
  const password = document.getElementById("regPassword").value;
  const confirm = document.getElementById("regConfirm").value;

  if (!name || !email || !password) {
    alert("All fields required");
    return;
  }
  if (password !== confirm) {
    alert("Passwords do not match");
    return;
  }

  localStorage.setItem("user_" + email, JSON.stringify({ name, email, password }));

  alert("Registration successful. Please login.");
  showLogin();
}

function showRegister() {
  document.querySelector(".form").style.display = "none";
  document.getElementById("registerForm").style.display = "block";
}

function showLogin() {
  document.querySelector(".form").style.display = "block";
  document.getElementById("registerForm").style.display = "none";
}

// ---------------- LOAD PRODUCTS ----------------
function loadProducts() {
  const productsList = document.getElementById("productsList");
  if (!productsList) return; // guard for index.html

  productsList.innerHTML = "";

  db.ref("products").on("value", snapshot => {
    allProducts = [];
    snapshot.forEach(child => {
      allProducts.push(child.val());
    });
    renderProducts(allProducts);
  });
}

// ---------------- RENDER PRODUCTS ----------------
function renderProducts(products) {
  const productsList = document.getElementById("productsList");
  if (!productsList) return;

  productsList.innerHTML = "";

  products.forEach(product => {
    const div = document.createElement("div");
    div.className = "product-item";
    div.innerHTML = `
      <span>${product.id_code || "-"}</span>
      <span>${product.sku} - ${product.name}</span>
      <span>R${product.price}</span>
    `;
    div.onclick = () => selectProduct(product);
    productsList.appendChild(div);
  });
}

// ---------------- SEARCH FUNCTION ----------------
function searchProducts(query) {
  const filtered = allProducts.filter(p =>
    p.sku.toLowerCase().includes(query.toLowerCase()) ||
    p.name.toLowerCase().includes(query.toLowerCase())
  );
  renderProducts(filtered);
}

// ---------------- SELECT PRODUCT ----------------
function selectProduct(product) {
  selectedProduct = product;
  alert(`Selected: ${product.name}`);
}

// ---------------- ADD TO CART ----------------
function addToCart() {
  if (!selectedProduct) {
    alert("Please select a product first!");
    return;
  }

  const qty = parseInt(document.getElementById("qty").value) || 1;
  if (qty < 1) {
    alert("Quantity must be at least 1");
    return;
  }

  cart.push({ ...selectedProduct, qty });
  renderCart();
}

// ---------------- RENDER CART ----------------
function renderCart() {
  const cartList = document.getElementById("cartList");
  if (!cartList) return;

  cartList.innerHTML = "";

  cart.forEach((item, index) => {
    const div = document.createElement("div");
    div.className = "cart-item";
    div.innerText = `${item.sku} - ${item.name} (x${item.qty}) - R${item.price * item.qty}`;
    div.onclick = () => selectCartItem(index);
    if (index === selectedCartIndex) {
      div.classList.add("selected");
    }
    cartList.appendChild(div);
  });
}

// ---------------- SELECT CART ITEM ----------------
function selectCartItem(index) {
  selectedCartIndex = index;
  renderCart();
}

// ---------------- REMOVE FROM CART ----------------
function removeFromCart() {
  if (selectedCartIndex === null) {
    alert("Please select an item from the cart first!");
    return;
  }
  cart.splice(selectedCartIndex, 1);
  selectedCartIndex = null;
  renderCart();
}

// ---------------- CHECKOUT ----------------
function checkout() {
  if (cart.length === 0) {
    alert("Cart is empty!");
    return;
  }

  // Get technician details
  let techName = sessionStorage.getItem("techName");
  if (!techName) {
    techName = prompt("Enter your name (Technician):");
    sessionStorage.setItem("techName", techName);
  }

  let techContact = sessionStorage.getItem("techContact");
  if (!techContact) {
    techContact = prompt("Enter your contact number:");
    sessionStorage.setItem("techContact", techContact);
  }

  // Get buyer details
  const buyerName = prompt("Enter buyer's name:");
  const buyerContact = prompt("Enter buyer's contact:");

  // Ask discount per item
  cart = cart.map(item => {
    let discount = prompt(`Enter discount (%) for ${item.name} (leave blank for 0):`);
    discount = discount ? parseFloat(discount) : 0;
    return { ...item, discount };
  });

  // Calculate totals
  let totalAmount = cart.reduce((sum, item) => {
    return sum + (item.price * item.qty * (1 - (item.discount || 0) / 100));
  }, 0);

  const now = new Date();
  const dateStr = now.toLocaleDateString();
  const timeStr = now.toLocaleTimeString();

  if (!confirm("Do you want to confirm checkout and print receipt?")) {
    return;
  }

  // Prepare sale data (keys match receipt + desktop app)
  const saleData = {
    technician_name: techName,
    technician_contact: techContact,
    buyer_name: buyerName,
    buyer_contact: buyerContact,
    total_amount: totalAmount,
    date: now.toLocaleString(),
    items: cart.map(item => ({
      sku: item.sku,
      product_name: item.name,
      qty: item.qty,
      unit_price: item.price,
      discount: item.discount || 0,
      total_price: item.price * item.qty * (1 - (item.discount || 0) / 100)
    }))
  };

  // Save sale in Firebase
  db.ref("sales").push(saleData).then(() => {
    generateReceipt(saleData, dateStr, timeStr);
    cart = [];
    renderCart();
  }).catch(err => {
    console.error("Error saving sale:", err);
    alert("Could not save sale. Please try again.");
  });
}

// ---------------- GENERATE RECEIPT ----------------
function generateReceipt(sale, dateStr, timeStr) {
  let receiptWindow = window.open("", "Receipt");
  receiptWindow.document.write(`
    <html>
      <head>
        <title>Receipt</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          .header { display: flex; justify-content: space-between; align-items: center; }
          .company-info { text-align: left; }
          .logo { text-align: right; }
          h2 { margin: 0; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; }
          th, td { border: 1px solid #000; padding: 8px; text-align: left; }
          .footer { margin-top: 20px; text-align: center; font-size: 12px; }
          hr { border: 1px solid #000; margin: 10px 0; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="company-info">
            <h2>AGREETECH</h2>
            <p>Motto: "For All Your Fittings And Hydraulic Hoses"</p>
          </div>
          <div class="logo">
            <img src="IMG_7044.png" alt="Company Logo" height="60"><br>
            <p>7521 Kageng, Mosanthal, Rustenburg</p>
            <p>Tel: 076 066 7023/066 182 0582</p>
            <p>Email: agreetechhydraulic@gmail.com</p>
          </div>
        </div>
        <hr>
        <p><b>Date:</b> ${dateStr} <b>Time:</b> ${timeStr}</p>
        <p><b>Technician:</b> ${sale.technician_name} (${sale.technician_contact})</p>
        <p><b>Buyer:</b> ${sale.buyer_name} (${sale.buyer_contact})</p>
        <hr>
        <h3>Products Sold</h3>
        <table>
          <tr>
            <th>Item</th>
            <th>Qty</th>
            <th>Unit Price</th>
            <th>Discount %</th>
            <th>Total</th>
          </tr>
          ${sale.items.map(item => `
            <tr>
              <td>${item.product_name}</td>
              <td>${item.qty}</td>
              <td>R${item.unit_price}</td>
              <td>${item.discount || 0}%</td>
              <td>R${item.total_price.toFixed(2)}</td>
            </tr>
          `).join("")}
        </table>
        <h3>Banking Details</h3>
        <table>
          <tr><th>Bank</th><td>FNB</td></tr>
          <tr><th>Account Name</th><td>GOLD BUSINESS ACCOUNT</td></tr>
          <tr><th>Account Number</th><td>63080081391</td></tr>
          <tr><th>Branch Code</th><td>251006</td></tr>
        </table>
        <div class="footer">
          <p>Thank you for doing business with Agreetech!</p>
        </div>
      </body>
    </html>
  `);
  receiptWindow.document.close();
  receiptWindow.print();
}

// ---------------- LOGOUT ----------------
function logout() {
  sessionStorage.clear();
  window.location = "index.html";
}

// ---------------- INIT ----------------
window.onload = () => {
  if (document.getElementById("productsList")) {
    loadProducts();
    document.getElementById("search").addEventListener("input", e => {
      searchProducts(e.target.value);
    });
    document.getElementById("checkoutBtn").addEventListener("click", checkout);
    document.getElementById("removeBtn").addEventListener("click", removeFromCart);
    document.getElementById("addBtn").addEventListener("click", addToCart);
  }
};
