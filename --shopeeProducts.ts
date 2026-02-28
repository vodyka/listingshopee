
// SUBSTITUA O BLOCO DE MAPEAMENTO SHOPEE POR ESTE

const listing: any = {
  id: `shopee-${shopId}-${item.item_id}`,
  marketplace: "shopee",
  title: item.item_name,
  sku: item.item_sku || String(item.item_id),
  image_url: item.image?.image_url_list?.[0] || null,
  price: item.price_info?.[0]?.current_price || 0,
  promo_price: item.price_info?.[0]?.original_price || null,
  stock: item.stock_info_v2?.summary_info?.total_available_stock || 0,
  status,
  sold_count: item.sales || 0,
  liked_count: item.liked_count || item.likes || 0,
  view_count: item.view_count || 0,
  has_variations: item.has_model,
};

if (listing.has_variations) {
  listing.variations = modelData.response.model.map((m: any) => ({
    variation_id: String(m.model_id),
    variation_name: m.model_name || "Variação",
    sku: m.model_sku,
    price: m.price_info?.[0]?.current_price || 0,
    promo_price: m.price_info?.[0]?.original_price || null,
    stock: m.stock_info_v2?.summary_info?.total_available_stock || 0,
    image_url: m.image?.image_url || null,
  }));
}
