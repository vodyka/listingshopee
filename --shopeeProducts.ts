// @ts-nocheck
import { Hono } from "hono";
import { authMiddleware } from "@getmocha/users-service/backend";
import type { Env } from "@/env";

const app = new Hono<{ Bindings: Env }>();

app.use("*", authMiddleware);

// Shopee API helper
function getShopeeApiUrl(env: Env): { url: string; environment: string } {
  const raw = (env.SHOPEE_ENVIRONMENT || "production").trim().toLowerCase();
  if (raw !== "production" && raw !== "test") {
    throw new Error(`Invalid SHOPEE_ENVIRONMENT: ${raw}`);
  }
  return {
    url: raw === "test" ? "https://partner.test-stable.shopeemobile.com" : "https://partner.shopeemobile.com",
    environment: raw,
  };
}

async function shopeeApiRequest(
  env: Env,
  integration: any,
  path: string,
  params: Record<string, string>,
  method: "GET" | "POST" = "GET"
): Promise<any> {
  const { url: baseUrl } = getShopeeApiUrl(env);
  const partnerId = String(env.SHOPEE_PARTNER_ID || "");
  const partnerKey = String(env.SHOPEE_PARTNER_KEY || "");
  const shopId = String(integration.shop_id || "");
  const accessToken = String(integration.access_token || "");
  const timestamp = Math.floor(Date.now() / 1000);

  const includeShopId = path !== "/api/v2/auth/token/get" && path !== "/api/v2/auth/access_token/get";

  const baseString = includeShopId
    ? `${partnerId}${path}${timestamp}${accessToken}${shopId}`
    : `${partnerId}${path}${timestamp}`;

  const encoder = new TextEncoder();
  const keyData = encoder.encode(partnerKey);
  const msgData = encoder.encode(baseString);
  const cryptoKey = await crypto.subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, msgData);
  const sign = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const commonParams: Record<string, string> = {
    partner_id: partnerId,
    timestamp: String(timestamp),
    sign,
  };

  if (accessToken) commonParams.access_token = accessToken;
  if (includeShopId && shopId) commonParams.shop_id = shopId;

  const allParams = { ...commonParams, ...params };

  const url = new URL(path, baseUrl);

  if (method === "GET") {
    for (const [k, v] of Object.entries(allParams)) {
      if (v !== undefined && v !== null && v !== "") {
        url.searchParams.set(k, String(v));
      }
    }
    const res = await fetch(url.toString(), { method: "GET" });
    return res.json();
  } else {
    for (const [k, v] of Object.entries(commonParams)) {
      if (v !== undefined && v !== null && v !== "") {
        url.searchParams.set(k, String(v));
      }
    }
    const res = await fetch(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    return res.json();
  }
}

function toInt(s: string | undefined, defaultValue: number, min: number, max: number): number {
  if (!s) return defaultValue;
  const val = parseInt(s, 10);
  if (isNaN(val)) return defaultValue;
  return Math.max(min, Math.min(max, val));
}

// Helper: pega URL de imagem do produto
function pickImageUrl(product: any): string {
  if (Array.isArray(product?.image?.image_url_list) && product.image.image_url_list.length > 0) {
    return product.image.image_url_list[0];
  }
  const imgId = product?.image?.image_id_list?.[0] || product?.image_id;
  if (imgId) {
    return `https://cf.shopee.com.br/file/${imgId}`;
  }
  return "";
}

// Helper: converte de centavos/micros para decimal BRL
function moneyFromShopee(value: any): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return num / 100000;
}

// Helper: formata decimal BRL
function fmtBRL(val: number): string {
  return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Helper: extrai par de preços de price_info
function getPricePairFromPriceInfo(priceInfo: any): { original: number; current: number } {
  let original = 0;
  let current = 0;

  if (priceInfo) {
    const orig = moneyFromShopee(priceInfo.original_price);
    const curr = moneyFromShopee(priceInfo.current_price);

    original = orig > 0 ? orig : curr;
    current = curr > 0 ? curr : orig;
  }

  return { original, current };
}

// Helper: calcula estoque do item ou model
function getItemStock(obj: any): number {
  const stock = obj?.stock_info_v2?.summary_info?.total_available_stock || obj?.stock_info?.stock || 0;
  return Number(stock);
}

// Helper: monta nome de variação a partir de tier
function modelNameFromTier(model: any, tier_variation: any[]): string {
  if (!Array.isArray(tier_variation) || tier_variation.length === 0) {
    return model?.model_name || "";
  }

  const indices = model?.tier_index || [];
  const parts = indices.map((idx: number, i: number) => {
    const tier = tier_variation[i];
    const opt = tier?.option_list?.[idx];
    return opt?.option || "";
  }).filter(Boolean);

  return parts.join(" / ");
}

/**
 * GET /api/shopee-products/integrations
 * Lista todas as integrações Shopee do usuário (para popular dropdown)
 */
app.get("/integrations", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const rows: any = await c.env.DB.prepare(
    `SELECT id, shop_id, COALESCE(user_nickname, store_name) as store_name
     FROM integrations_marketplace
     WHERE user_id = ? AND marketplace = 'shopee' AND status = 'active'
     ORDER BY created_at DESC`
  )
    .bind(user.id)
    .all();

  const integrations = (rows.results || []).map((r: any) => ({
    id: String(r.id),
    shopId: String(r.shop_id),
    storeName: r.store_name || `Loja ${r.shop_id}`,
  }));

  return c.json({ integrations });
});

/**
 * GET /api/shopee-products/counts?integrationId=...
 * Retorna contagens por status (NORMAL, UNLIST, BANNED, DELETED)
 */
app.get("/counts", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const integrationId = c.req.query("integrationId");

  // Busca integração(ões)
  const integrations: any[] = integrationId
    ? [
        await c.env.DB.prepare(
          `SELECT id, user_id, shop_id, access_token, store_name
           FROM integrations_marketplace
           WHERE id = ? AND user_id = ? AND marketplace = 'shopee' AND status = 'active'`
        )
          .bind(integrationId, user.id)
          .first(),
      ].filter(Boolean)
    : (
        await c.env.DB.prepare(
          `SELECT id, user_id, shop_id, access_token, store_name
           FROM integrations_marketplace
           WHERE user_id = ? AND marketplace = 'shopee' AND status = 'active'`
        )
          .bind(user.id)
          .all()
      ).results || [];

  if (!integrations.length) {
    return c.json({ counts: { NORMAL: 0, UNLIST: 0, BANNED: 0, DELETED: 0 } });
  }

  try {
    const statuses = ["NORMAL", "UNLIST", "BANNED", "DELETED", "REVIEWING", "SOLDOUT"];
    const counts: Record<string, number> = { 
      NORMAL: 0, 
      UNLIST: 0, 
      BANNED: 0, 
      DELETED: 0,
      REVIEWING: 0,
      SOLDOUT: 0
    };

    for (const integration of integrations) {
      for (const status of statuses) {
        const resp: any = await shopeeApiRequest(
          c.env,
          integration,
          "/api/v2/product/get_item_list",
          { item_status: status, page_size: "1", offset: "0" },
          "GET"
        );
        counts[status] += Number(resp?.response?.total_count || 0);
      }
    }

    return c.json({ counts });
  } catch (error: any) {
    console.error("[Shopee Counts Error]", error);
    return c.json({ error: "failed_to_fetch_counts", message: error?.message || String(error) }, 500);
  }
});

/**
 * GET /api/shopee-products/list?integrationId=...&status=NORMAL|UNLIST|BANNED|DELETED&page=1&per_page=50
 * Se integrationId não for fornecido, busca de todas as integrações ativas do usuário
 */
app.get("/list", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const status = c.req.query("status") || "NORMAL";
  const integrationId = c.req.query("integrationId");

  const page = toInt(c.req.query("page"), 1, 1, 999999);
  const per_page = toInt(c.req.query("per_page"), 50, 5, 300);

  // Busca integrações
  const integrations: any[] = integrationId
    ? [
        await c.env.DB.prepare(
          `SELECT id, user_id, shop_id, access_token, COALESCE(user_nickname, store_name) as store_name
           FROM integrations_marketplace
           WHERE id = ? AND user_id = ? AND marketplace = 'shopee' AND status = 'active'`
        )
          .bind(integrationId, user.id)
          .first(),
      ].filter(Boolean)
    : (
        await c.env.DB.prepare(
          `SELECT id, user_id, shop_id, access_token, COALESCE(user_nickname, store_name) as store_name
           FROM integrations_marketplace
           WHERE user_id = ? AND marketplace = 'shopee' AND status = 'active'
           ORDER BY created_at DESC`
        )
          .bind(user.id)
          .all()
      ).results || [];

  if (!integrations.length) {
    return c.json({
      products: [],
      pagination: { page, per_page, total: 0 },
    });
  }

  try {
    // Busca produtos de todas as integrações
    const allProductsData = await Promise.all(
      integrations.map(async (integration) => {
        try {
          // Busca todos os items da integração (em batches de 100)
          let allIntegrationItems: any[] = [];
          let offset = 0;
          let total = 0;
          const batchSize = 100;

          while (true) {
            const itemListResponse: any = await shopeeApiRequest(
              c.env,
              integration,
              "/api/v2/product/get_item_list",
              { item_status: status, page_size: String(batchSize), offset: String(offset) },
              "GET"
            );

            const items = itemListResponse?.response?.item || [];
            total = Number(itemListResponse?.response?.total_count || 0);
            
            if (Array.isArray(items) && items.length > 0) {
              allIntegrationItems = allIntegrationItems.concat(items);
              offset += items.length;
              
              // Se pegamos menos que o batch size, não há mais items
              if (items.length < batchSize) break;
              
              // Se já pegamos tudo, para
              if (offset >= total) break;
            } else {
              break;
            }
          }

          return {
            integration,
            items: allIntegrationItems,
            total,
          };
        } catch (e) {
          console.error(`[Shopee list] erro ao buscar de ${integration.store_name}:`, e);
          return { integration, items: [], total: 0 };
        }
      })
    );

    // Combina todos os items
    const allItems: Array<{ item: any; integration: any }> = [];
    let grandTotal = 0;

    for (const data of allProductsData) {
      grandTotal += data.total;
      for (const item of data.items) {
        allItems.push({ item, integration: data.integration });
      }
    }

    // Paginação simples na memória
    const offset = (page - 1) * per_page;
    const paginatedItems = allItems.slice(offset, offset + per_page);

    if (paginatedItems.length === 0) {
      return c.json({
        products: [],
        pagination: { page, per_page, total: grandTotal },
      });
    }

    // Agrupa por integração para fazer batch requests
    const itemsByIntegration = new Map<any, number[]>();
    for (const { item, integration } of paginatedItems) {
      if (!itemsByIntegration.has(integration)) {
        itemsByIntegration.set(integration, []);
      }
      itemsByIntegration.get(integration)!.push(Number(item.item_id));
    }

    // Busca base_info, extra_info, e models para cada integração
    const baseMap = new Map<string, any>(); // key: integrationId_itemId
    const extraMap = new Map<string, any>();
    const modelCache = new Map<string, { tier_variation: any[]; models: any[] }>();

    for (const [integration, itemIds] of itemsByIntegration.entries()) {
      // base info
      const baseInfoResponse: any = await shopeeApiRequest(
        c.env,
        integration,
        "/api/v2/product/get_item_base_info",
        { item_id_list: itemIds.join(",") },
        "GET"
      );

      const baseList: any[] = Array.isArray(baseInfoResponse?.response?.item_list)
        ? baseInfoResponse.response.item_list
        : [];

      for (const product of baseList) {
        const key = `${integration.id}_${product.item_id}`;
        baseMap.set(key, product);
        
        // Log para debug - ver quais campos realmente existem
        if (baseList.indexOf(product) === 0) {
          console.log('[Shopee Debug] Campos disponíveis no produto:', Object.keys(product));
          console.log('[Shopee Debug] Produto sample:', JSON.stringify(product, null, 2).substring(0, 500));
        }
      }

      // extra info
      try {
        const extraResp: any = await shopeeApiRequest(
          c.env,
          integration,
          "/api/v2/product/get_item_extra_info",
          { item_id_list: itemIds.join(",") },
          "GET"
        );

        const extraList: any[] = Array.isArray(extraResp?.response?.item_list)
          ? extraResp.response.item_list
          : [];

        for (const e of extraList) {
          const key = `${integration.id}_${e.item_id}`;
          extraMap.set(key, e);
          
          // Log para debug - ver quais campos existem em extra_info
          if (extraList.indexOf(e) === 0) {
            console.log('[Shopee Debug] Campos extra_info:', Object.keys(e));
            console.log('[Shopee Debug] Extra sample:', JSON.stringify(e, null, 2).substring(0, 500));
          }
        }
      } catch (e) {
        console.log("[Shopee extra info] não disponível para", integration.store_name);
      }

      // models (para itens com variação)
      async function fetchModels(itemId: number) {
        const resp: any = await shopeeApiRequest(
          c.env,
          integration,
          "/api/v2/product/get_model_list",
          { item_id: String(itemId) },
          "GET"
        );

        const tier_variation = resp?.response?.tier_variation || [];
        const models = resp?.response?.model || [];
        return { tier_variation, models };
      }

      const hasModelIds = baseList
        .filter((p) => p?.has_model)
        .map((p) => Number(p?.item_id))
        .filter((n) => Number.isFinite(n));

      for (let i = 0; i < hasModelIds.length; i += 10) {
        const batch = hasModelIds.slice(i, i + 10);
        const resBatch = await Promise.all(
          batch.map(async (id): Promise<[number, { tier_variation: any[]; models: any[] }]> => {
            try {
              const r = await fetchModels(id);
              return [id, r];
            } catch (e) {
              console.error("[Shopee get_model_list] falhou item:", id, e);
              return [id, { tier_variation: [], models: [] }];
            }
          })
        );
        for (const [id, r] of resBatch) {
          const key = `${integration.id}_${id}`;
          modelCache.set(key, r);
        }
      }
    }

    // Monta resposta final
    const formatted = paginatedItems.map(({ item, integration }) => {
      const itemIdNum = Number(item.item_id);
      const key = `${integration.id}_${itemIdNum}`;
      const product = baseMap.get(key) || item;
      const extra = extraMap.get(key) || {};

      const hasVariations = !!product?.has_model;

      let priceText = "";
      let promoText: string | null = null;
      let totalStock = 0;
      let variations: any[] | null = null;

      if (hasVariations) {
        const cached = modelCache.get(key);
        const models: any[] = Array.isArray(cached?.models) ? cached.models : [];
        const tier_variation: any[] = Array.isArray(cached?.tier_variation) ? cached.tier_variation : [];

        variations = models.map((m: any) => {
          const p0 = Array.isArray(m?.price_info) ? m.price_info[0] : (m?.price_info || null);
          const pair = getPricePairFromPriceInfo(p0);
          const stock = getItemStock(m);

          return {
            id: String(m?.model_id),
            name: modelNameFromTier(m, tier_variation),
            sku: m?.model_sku || null,
            priceText: fmtBRL(pair.original),
            promoText: pair.current < pair.original ? fmtBRL(pair.current) : null,
            qty: stock,
          };
        });

        // Calcula range de preços (original) das variações
        const originals2 = models.map((m: any) => {
          const p0 = Array.isArray(m?.price_info) ? m.price_info[0] : (m?.price_info || null);
          const pair = getPricePairFromPriceInfo(p0);
          return pair.original;
        }).filter(p => p > 0);

        if (originals2.length > 0) {
          const minP = Math.min(...originals2);
          const maxP = Math.max(...originals2);
          priceText = minP === maxP ? fmtBRL(minP) : `${fmtBRL(minP)} - ${fmtBRL(maxP)}`;
        } else {
          priceText = fmtBRL(0);
        }

        // Range promo (somente onde tem desconto)
        const promos = models
          .map((m: any) => {
            const p0 = Array.isArray(m?.price_info) ? m.price_info[0] : (m?.price_info || null);
            const pair = getPricePairFromPriceInfo(p0);
            return pair.current < pair.original ? pair.current : null;
          })
          .filter((x: any) => x != null && x > 0) as number[];

        if (promos.length > 0) {
          const minPromo = Math.min(...promos);
          const maxPromo = Math.max(...promos);
          promoText = minPromo === maxPromo ? fmtBRL(minPromo) : `${fmtBRL(minPromo)} - ${fmtBRL(maxPromo)}`;
        }

        totalStock = variations.reduce((s, v) => s + Number(v.qty || 0), 0);
      } else {
        // Produto simples (sem variações)
        const p0 = Array.isArray(product?.price_info) ? product.price_info[0] : (product?.price_info || null);
        const pair = getPricePairFromPriceInfo(p0);

        priceText = fmtBRL(pair.original);
        promoText = pair.current < pair.original ? fmtBRL(pair.current) : null;
        totalStock = getItemStock(product);
      }

      // vendas: pode vir em vários campos diferentes da API Shopee
      // Tenta múltiplos campos possíveis: sales, sold, historical_sold, sale_count
      const sales = Number(
        product?.sales || 
        product?.sold || 
        product?.historical_sold || 
        extra?.sale || 
        extra?.sold || 
        extra?.sale_count || 
        0
      );
      const likes = Number(extra?.liked_count || extra?.like_count || 0);
      const views = Number(extra?.view_count || extra?.views || 0);

      return {
        id: String(product?.item_id),
        title: product?.item_name || "Sem título",
        shopLine: integration.store_name || `Loja ${integration.shop_id}`,
        imageUrl: pickImageUrl(product),
        skuMain: product?.item_sku || String(product?.item_id),
        idLink: String(product?.item_id),

        priceText,
        promoText,

        qty: totalStock,

        perfSales: sales,
        perfLikes: likes,
        perfVisits: views,

        updatedAt: new Date((product?.update_time || 0) * 1000).toLocaleString("pt-BR"),
        publishedAt: new Date((product?.create_time || 0) * 1000).toLocaleString("pt-BR"),
        status: product?.item_status || status,
        variations,
      };
    });

    return c.json({
      products: formatted,
      pagination: { page, per_page, total: grandTotal },
    });
  } catch (error: any) {
    console.error("[Shopee Products Error]", error);
    return c.json(
      { error: "failed_to_fetch_products", message: error?.message || String(error) },
      500
    );
  }
});

export default app;
