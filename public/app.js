const pages = document.querySelectorAll('.page');
const searchInput = document.querySelector('#searchInput');
const categoryFilter = document.querySelector('#categoryFilter');
const categoryGrid = document.querySelector('#categoryGrid');
const featuredGrid = document.querySelector('#featuredGrid');
const productGrid = document.querySelector('#productGrid');
const productDetails = document.querySelector('#productDetails');
const cartItems = document.querySelector('#cartItems');
const wishlistItems = document.querySelector('#wishlistItems');
const checkoutItems = document.querySelector('#checkoutItems');
const checkoutTotal = document.querySelector('#checkoutTotal');
const profilePhotoForm = document.querySelector('#profilePhotoForm');
const profilePhotoPreview = document.querySelector('#profilePhotoPreview');
const profileStatus = document.querySelector('#profileStatus');
const cartCount = document.querySelector('#cartCount');
const wishlistCount = document.querySelector('#wishlistCount');
const backToProducts = document.querySelector('#backToProducts');

let products = [];
let activeProduct = null;
let activeProductOpenedAt = null;

backToProducts.addEventListener('click', () => {
  location.hash = '#/products';
});

searchInput.addEventListener('input', () => {
  if (currentRoute() !== '#/products') {
    location.hash = '#/products';
  }
  renderProductListing();
});

categoryFilter.addEventListener('change', renderProductListing);
profilePhotoForm.addEventListener('submit', uploadProfilePhoto);
window.addEventListener('hashchange', renderRoute);
window.addEventListener('beforeunload', () => {
  void trackTimeSpent();
});

async function boot() {
  products = await fetchJson('/api/products');
  renderCategories();
  renderCategoryFilter();
  renderProducts(featuredGrid, products.slice(0, 8));
  await renderRoute();
  await refreshCustomerState();
}

async function renderRoute() {
  await trackTimeSpent();

  const hash = currentRoute();

  if (hash.startsWith('#/product/')) {
    await showProductDetails(hash.split('/').at(-1));
    return;
  }

  if (hash === '#/products') {
    showPage('productsPage');
    renderProductListing();
    return;
  }

  if (hash === '#/cart') {
    showPage('cartPage');
    renderProducts(cartItems, await fetchJson('/api/cart'), 'Your cart is empty.', true, 'cart');
    await refreshCustomerState();
    return;
  }

  if (hash === '#/wishlist') {
    showPage('wishlistPage');
    renderProducts(
      wishlistItems,
      await fetchJson('/api/wishlist'),
      'Your wishlist is empty.',
      true,
      'wishlist',
    );
    await refreshCustomerState();
    return;
  }

  if (hash === '#/checkout') {
    showPage('checkoutPage');
    await renderCheckout();
    return;
  }

  if (hash === '#/profile') {
    showPage('profilePage');
    await renderProfile();
    return;
  }

  showPage('homePage');
  activeProduct = null;
  activeProductOpenedAt = null;
  await refreshCustomerState();
}

async function showProductDetails(productId) {
  const product = await fetchJson(`/api/products/${productId}`);
  activeProduct = product;
  activeProductOpenedAt = Date.now();
  showPage('detailsPage');
  await trackStoreEvent(product.id, 'product_view');

  const category = product.metadata?.category ?? 'product';
  const color = product.metadata?.color ?? product.metadata?.tags?.[0] ?? '';

  productDetails.innerHTML = `
    <div class="product-media">
      ${productImage(product, 'large')}
    </div>
    <div class="details-copy">
      <p class="breadcrumb">Home / ${escapeHtml(category)} / ${escapeHtml(product.title)}</p>
      <h1>${escapeHtml(product.title)}</h1>
      <div class="rating">★★★★☆ <span>4.2 · 1,284 ratings</span></div>
      <p class="price">₹${product.price}</p>
      <p class="tax">Inclusive of all taxes</p>
      <div class="offer-box">
        <strong>Available offers</strong>
        <span>Bank offer · Free delivery · 7-day replacement</span>
      </div>
      <dl class="specs">
        <div><dt>Category</dt><dd>${escapeHtml(category)}</dd></div>
        <div><dt>Color</dt><dd>${escapeHtml(color)}</dd></div>
        <div><dt>Seller</dt><dd>ShoppyMart Retail</dd></div>
      </dl>
      <div class="actions">
        <button data-event="add_to_cart" data-product="${product.id}">Add to Cart</button>
        <button class="secondary-button" data-event="add_to_wishlist" data-product="${product.id}">Add to Wishlist</button>
        <a class="buy-link" href="#/checkout">Buy Now</a>
      </div>
    </div>
  `;

  bindEventButtons(productDetails);
  await refreshCustomerState();
}

function renderProductListing() {
  const query = searchInput.value.trim().toLowerCase();
  const category = categoryFilter.value;
  const filteredProducts = products.filter((product) => {
    const text = [
      product.title,
      product.metadata?.category,
      product.metadata?.color,
      ...(product.metadata?.tags ?? []),
    ]
      .join(' ')
      .toLowerCase();

    return (!query || text.includes(query)) &&
      (!category || product.metadata?.category === category);
  });

  renderProducts(productGrid, filteredProducts);
}

function renderProducts(container, items, emptyText = 'No products found.', showActions = true, page = 'products') {
  if (items.length === 0) {
    container.innerHTML = `<div class="empty">${emptyText}</div>`;
    return;
  }

  container.innerHTML = items
    .map(
      (product) => `
        <article class="product-card">
          <a href="#/product/${product.id}" class="product-link">
            ${productImage(product)}
            <div class="product-info">
              <p class="category">${escapeHtml(product.metadata?.category)}</p>
              <h3>${escapeHtml(product.title)}</h3>
              <div class="rating compact">★★★★☆ <span>(${randomReviewCount(product.id)})</span></div>
              <p class="price">₹${product.price}</p>
              <p class="delivery">Free delivery by tomorrow</p>
            </div>
          </a>
          ${showActions ? `
          <div class="quick-actions">
            ${page === 'cart' ? `<button data-event="remove_from_cart" data-product="${product.id}">Remove from Cart</button>` : ''}
            ${page === 'wishlist' ? `<button data-event="remove_from_wishlist" data-product="${product.id}">Remove from Wishlist</button>` : ''}
            ${page === 'products' ? `
              <button data-event="add_to_cart" data-product="${product.id}">Add to Cart</button>
              <button class="secondary-button" data-event="add_to_wishlist" data-product="${product.id}">Wishlist</button>
            ` : ''}
          </div>
          ` : ''}
        </article>
      `,
    )
    .join('');

  bindEventButtons(container);
}

function renderCategories() {
  const categories = uniqueCategories();
  categoryGrid.innerHTML = categories
    .slice(0, 8)
    .map(
      (category) => `
        <a class="category-card" href="#/products" data-category="${escapeHtml(category)}">
          <span>${escapeHtml(category)}</span>
          <small>${products.filter((product) => product.metadata?.category === category).length} items</small>
        </a>
      `,
    )
    .join('');

  categoryGrid.querySelectorAll('[data-category]').forEach((link) => {
    link.addEventListener('click', () => {
      categoryFilter.value = link.dataset.category;
    });
  });
}

function renderCategoryFilter() {
  categoryFilter.innerHTML = '<option value="">All categories</option>' +
    uniqueCategories()
      .map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`)
      .join('');
}

async function renderCheckout() {
  const cart = await fetchJson('/api/cart');
  checkoutItems.innerHTML = cart.length
    ? cart
      .map(
        (product) => `
            <div class="summary-row">
              <span>${escapeHtml(product.title)}</span>
              <strong>₹${product.price}</strong>
            </div>
          `,
      )
      .join('')
    : '<div class="empty">Your cart is empty.</div>';
  checkoutTotal.textContent = `₹${cart.reduce((total, product) => total + product.price, 0)}`;
  await refreshCustomerState();
}

async function renderProfile() {
  const profile = await fetchJson('/api/profile');
  const photo = profile.profile?.photo;

  if (!photo?.url) {
    profilePhotoPreview.className = 'profile-preview empty';
    profilePhotoPreview.textContent = 'No photo uploaded yet.';
    return;
  }

  profilePhotoPreview.className = 'profile-preview';
  profilePhotoPreview.innerHTML = `
    <img src="${escapeHtml(photo.url)}" alt="Uploaded style profile" />
    <small>${escapeHtml(photo.fileName)}</small>
  `;
}

async function uploadProfilePhoto(event) {
  event.preventDefault();
  const fileInput = profilePhotoForm.querySelector('input[name="photo"]');

  if (!fileInput.files.length) {
    profileStatus.textContent = 'Please choose a full-body photo first.';
    return;
  }

  const formData = new FormData(profilePhotoForm);

  profileStatus.textContent = 'Uploading style profile photo...';

  const response = await fetch('/api/profile/photo', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    profileStatus.textContent = error.error ?? 'Upload failed.';
    return;
  }

  profileStatus.textContent = 'Style profile saved locally.';
  profilePhotoForm.reset();
  await renderProfile();
}

function bindEventButtons(container) {
  container.querySelectorAll('button[data-event]').forEach((button) => {
    button.addEventListener('click', async () => {
      await trackStoreEvent(button.dataset.product, button.dataset.event);
      await refreshCustomerState();

      if (currentRoute() === '#/cart') {
        renderProducts(cartItems, await fetchJson('/api/cart'), 'Your cart is empty.', true, 'cart');
      }

      if (currentRoute() === '#/wishlist') {
        renderProducts(
          wishlistItems,
          await fetchJson('/api/wishlist'),
          'Your wishlist is empty.',
          true,
          'wishlist',
        );
      }
    });
  });
}

async function trackTimeSpent() {
  if (!activeProduct || !activeProductOpenedAt) {
    return;
  }

  const timeSpentSeconds = Math.round((Date.now() - activeProductOpenedAt) / 1000);
  const productId = activeProduct.id;
  activeProduct = null;
  activeProductOpenedAt = null;

  if (timeSpentSeconds > 0) {
    await trackStoreEvent(productId, 'time_spent', { timeSpentSeconds });
  }
}

async function trackStoreEvent(productId, eventType, extra = {}) {
  await fetchJson('/api/store/events', {
    method: 'POST',
    body: JSON.stringify({ productId, eventType, ...extra }),
  });
}

async function refreshCustomerState() {
  const [cart, wishlist] = await Promise.all([
    fetchJson('/api/cart'),
    fetchJson('/api/wishlist'),
  ]);

  cartCount.textContent = cart.length;
  wishlistCount.textContent = wishlist.length;
}

function productImage(product, size = '') {
  return `
    <div class="product-image ${size}" style="${artStyle(product)}">
      <img src="/assets/${product.id}.jpg" alt="${escapeHtml(product.title)}" loading="lazy" onerror="this.hidden = true" />
      <div class="image-placeholder">
        <span>${escapeHtml(product.metadata?.color ?? '')}</span>
        <strong>${escapeHtml(product.metadata?.category ?? 'Product')}</strong>
      </div>
    </div>
  `;
}

function showPage(pageId) {
  pages.forEach((page) => {
    page.classList.toggle('active', page.id === pageId);
  });
}

function currentRoute() {
  return location.hash || '#/';
}

function uniqueCategories() {
  return [...new Set(products.map((product) => product.metadata?.category).filter(Boolean))];
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error ?? 'Request failed');
  }

  return response.json();
}

function artStyle(product) {
  const color = product.metadata?.color ?? product.metadata?.tags?.[0] ?? 'violet';
  return `--product-color: ${cssColor(color)};`;
}

function cssColor(color) {
  const colors = {
    beige: '#d6b98c',
    black: '#1f2937',
    blue: '#2563eb',
    brown: '#92400e',
    cream: '#f5e6c8',
    green: '#16a34a',
    grey: '#6b7280',
    navy: '#1e3a8a',
    olive: '#708238',
    orange: '#f97316',
    pink: '#ec4899',
    purple: '#7c3aed',
    red: '#dc2626',
    tan: '#c19a6b',
    white: '#f8fafc',
    yellow: '#eab308',
  };

  return colors[String(color).toLowerCase()] ?? '#7c3aed';
}

function randomReviewCount(seed) {
  return 300 + Array.from(seed).reduce((sum, char) => sum + char.charCodeAt(0), 0) % 1900;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

boot().catch((error) => {
  document.body.innerHTML = `<pre>${escapeHtml(error.message)}</pre>`;
});
