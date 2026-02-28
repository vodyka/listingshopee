
import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/react-app/components/DashboardLayout";
import { fetchListings } from "@/react-app/lib/listingsApi";

export default function ListingsPage() {
  const [listings, setListings] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [total, setTotal] = useState(0);

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(total / perPage));
  }, [total, perPage]);

  const load = async () => {
    const data = await fetchListings({
      tab: "active",
      page,
      per_page: perPage,
    });

    setListings(data.listings || []);
    setTotal(data.pagination?.total || 0);
  };

  useEffect(() => {
    load();
  }, [page, perPage]);

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(v || 0);

  const getPriceRange = (listing: any) => {
    if (!listing.has_variations || !listing.variations?.length) {
      return formatCurrency(listing.price);
    }

    const prices = listing.variations.map((v: any) => v.price || 0);
    const min = Math.min(...prices);
    const max = Math.max(...prices);

    return min === max
      ? formatCurrency(min)
      : `${formatCurrency(min)} - ${formatCurrency(max)}`;
  };

  const getPromoRange = (listing: any) => {
    if (!listing.has_variations || !listing.variations?.length) {
      return listing.promo_price
        ? formatCurrency(listing.promo_price)
        : "-";
    }

    const promoPrices = listing.variations
      .map((v: any) => v.promo_price)
      .filter(Boolean);

    if (!promoPrices.length) return "-";

    const min = Math.min(...promoPrices);
    const max = Math.max(...promoPrices);

    return min === max
      ? formatCurrency(min)
      : `${formatCurrency(min)} - ${formatCurrency(max)}`;
  };

  return (
    <DashboardLayout>
      <div style={{ padding: 20 }}>
        <h2>Anúncios</h2>

        <div style={{ marginBottom: 15 }}>
          Mostrar:
          {[20, 50, 100, 300].map((n) => (
            <button
              key={n}
              onClick={() => {
                setPerPage(n);
                setPage(1);
              }}
              style={{ marginLeft: 10 }}
            >
              {n}
            </button>
          ))}
        </div>

        {listings.map((l) => (
          <div key={l.id} style={{ borderBottom: "1px solid #ddd", padding: 12 }}>
            <h4>{l.title}</h4>

            <p><b>Preço:</b> {getPriceRange(l)}</p>
            <p><b>Preço com desconto:</b> {getPromoRange(l)}</p>
            <p><b>Estoque:</b> {l.stock}</p>
            <p><b>Vendas:</b> {l.sold_count || 0}</p>
            <p><b>Eu gosto:</b> {l.liked_count || 0}</p>
            <p><b>Visitas:</b> {l.view_count || 0}</p>

            {l.has_variations && l.variations?.length > 0 && (
              <div style={{ marginTop: 10, paddingLeft: 15 }}>
                <b>Variações:</b>
                {l.variations.map((v: any) => (
                  <div key={v.variation_id} style={{ marginTop: 5 }}>
                    {v.image_url && (
                      <img src={v.image_url} width="40" style={{ marginRight: 8 }} />
                    )}
                    {v.variation_name} - {formatCurrency(v.price)} - Estoque: {v.stock}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        <div style={{ marginTop: 20 }}>
          Página {page} de {totalPages}
          <button disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</button>
          <button disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Próxima</button>
        </div>
      </div>
    </DashboardLayout>
  );
}
