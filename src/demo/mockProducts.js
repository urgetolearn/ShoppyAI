// Extensions must match the actual files in src/demo/assets/
const mockProducts = [
  ['blue-oversized-shirt', 'Blue Oversized Shirt', 'shirts', 'blue', 1499, 'png'],
  ['white-linen-shirt', 'White Linen Shirt', 'shirts', 'white', 1799, 'png'],
  ['green-cotton-hoodie', 'Green Cotton Hoodie', 'hoodies', 'green', 1999, 'jpg'],
  ['navy-denim-jacket', 'Navy Denim Jacket', 'jackets', 'navy', 2999, 'png'],
  ['pink-crop-top', 'Pink Crop Top', 'tops', 'pink', 899, 'jpg'],
  ['yellow-graphic-tee', 'Yellow Graphic Tee', 't-shirts', 'yellow', 999, 'jpg'],
].map(([id, title, category, color, price, ext]) => ({
  id,
  title,
  price,
  currency: 'INR',
  url: `/store/product/${id}`,
  imageUrl: `/assets/${id}.${ext}`,
  metadata: {
    category,
    tags: [color, category],
    color,
    retailer: 'ShoppyAI Merchant Demo',
  },
}));

module.exports = { mockProducts };
