// src/react-app/pages/ProductShopee.tsx
import React, { useMemo, useState, useEffect } from "react";
import { ChevronDown, Search, Filter, HelpCircle, Plus } from "lucide-react";
import DashboardLayout from "@/react-app/components/DashboardLayout";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/react-app/components/ui/dropdown-menu";

type TabKey =
  | "RASCUNHOS"
  | "PUBLICANDO"
  | "FALHOU"
  | "ATIVOS"
  | "ESGOTADOS"
  | "INATIVOS"
  | "REVISANDO"
  | "VIOLACAO"
  | "EXCLUIDOS";

type ShopeeIntegration = {
  id: string;
  store_name: string;
  shop_id: number;
};

type Variation = {
  id: string;
  name: string;
  sku?: string | null;
  priceText: string;
  promoText?: string | null;
  qty: number;
};

type ShopeeProduct = {
  id: string;
  title: string;
  shopLine: string;
  imageUrl?: string | null;

  skuMain: string;
  idLink: string;

  priceText: string;
  promoText?: string | null;
  qty: number;

  perfSales: number;
  perfLikes: number;
  perfVisits: number;

  updatedAt: string;
  publishedAt: string;

  status: string;
  variations?: Variation[] | null;
};

const PAGE_SIZES = [20, 50, 100, 300] as const;

const TABS: { key: TabKey; label: string; showHelp?: boolean }[] = [
  { key: "ATIVOS", label: "Ativos" },
  { key: "ESGOTADOS", label: "Esgotados" },
  { key: "INATIVOS", label: "Inativos" },
  { key: "REVISANDO", label: "Revisando" },
  { key: "VIOLACAO", label: "Violação" },
  { key: "EXCLUIDOS", label: "Excluídos pela Shopee", showHelp: true },
];

function formatInt(n: number) {
  return n.toLocaleString("pt-BR");
}

async function apiGet<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} em ${url} :: ${txt}`);
  }
  return (await res.json()) as T;
}

const css = `/* (mesmo CSS do seu arquivo) */
.ups-shell{display:flex;gap:14px;padding:12px 14px;background:#f5f7fb;min-height:calc(100vh - 60px);}
.ups-side{width:220px;flex:0 0 220px;background:#fff;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;}
.ups-side-head{padding:12px 12px 10px;border-bottom:1px solid #eef2f7;}
.ups-side-title{font-size:14px;font-weight:700;color:#111827;line-height:1.2;}
.ups-side-nav{padding:8px;display:flex;flex-direction:column;gap:4px;}
.ups-side-item{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 10px;border-radius:6px;cursor:pointer;color:#374151;font-size:13px;}
.ups-side-item:hover{background:#f3f6ff;}
.ups-side-item.active{background:#eaf2ff;color:#1677ff;font-weight:600;}
.ups-side-count{font-size:12px;color:#9ca3af;}
.ups-side-item.active .ups-side-count{color:#1677ff;}
.ups-side-group-label{margin-top:10px;padding:10px 10px 6px;font-size:12px;color:#9ca3af;border-top:1px solid #eef2f7;}

.ups-main{flex:1;min-width:0;}
.ups-card{background:#fff;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;}
.ups-page{padding:12px 14px;}

.ups-filters{display:flex;gap:10px;align-items:center;margin-bottom:10px;flex-wrap:wrap;}
.fg{display:flex;align-items:center;border:1px solid #e5e7eb;border-radius:4px;overflow:hidden;height:32px;background:#fff;}
.fg .sel{display:flex;align-items:center;gap:6px;padding:0 10px;font-size:12px;color:#111827;border-right:1px solid #e5e7eb;cursor:pointer;min-width:160px;}
.fg .inp{display:flex;align-items:center;gap:8px;padding:0 10px;}
.fg .inp input{border:0;outline:0;font-size:12px;width:240px;}
.fg-shop .sel{min-width:130px;border-right:0;}
.icon-btn{width:32px;height:32px;border:1px solid #e5e7eb;background:#fff;border-radius:4px;display:flex;align-items:center;justify-content:center;cursor:pointer;}

.ups-tabs{display:flex;gap:18px;align-items:flex-end;border-bottom:1px solid #eef2f7;margin-bottom:8px;}
.tab{font-size:12px;color:#6b7280;padding:8px 0;cursor:pointer;position:relative;display:flex;gap:6px;align-items:center;}
.tab strong{font-weight:600;color:#374151;}
.tab.active strong{color:#1677ff;}
.tab.active:after{content:"";position:absolute;left:0;right:0;bottom:-1px;height:2px;background:#1677ff;}
.tab .n{font-size:12px;color:#9ca3af;}
.tab .help{display:inline-flex;width:14px;height:14px;align-items:center;justify-content:center;border:1px solid #e5e7eb;border-radius:999px;color:#9ca3af;}

.ups-bulkactions{display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid #eef2f7;margin-bottom:0;}
.bulk-left{display:flex;gap:18px;align-items:center;font-size:12px;color:#6b7280;flex-wrap:wrap;}
.bulk-link{cursor:pointer;color:#6b7280;}
.bulk-link:hover{color:#111827;}
.bulk-right{display:flex;gap:10px;align-items:center;font-size:12px;color:#6b7280;flex-wrap:wrap;}
.small-dd{display:flex;align-items:center;gap:6px;border:1px solid #e5e7eb;border-radius:4px;height:28px;padding:0 10px;background:#fff;color:#111827;cursor:pointer;}
.pag{display:flex;align-items:center;gap:8px;}
.pag-btn{cursor:pointer;color:#6b7280;padding:2px 6px;border-radius:4px;}
.pag-btn:hover{background:#f3f4f6;color:#111827;}

.ups-btn{height:32px;border:1px solid #e5e7eb;background:#fff;border-radius:4px;padding:0 10px;font-size:12px;color:#111827;display:inline-flex;align-items:center;gap:6px;}
.ups-btn-primary{height:32px;border-radius:4px;padding:0 12px;font-size:12px;background:#1677ff;color:#fff;border:1px solid #1677ff;display:inline-flex;align-items:center;gap:8px;}

.ups-table{border-top:0;overflow:auto;}
:root{ --ups-cols: 34px 430px 250px 140px 160px 120px 170px 170px 90px; }
.th{display:grid;grid-template-columns:var(--ups-cols);gap:10px;padding:10px 10px;font-size:12px;color:#6b7280;border-bottom:1px solid #eef2f7;background:#fafafa;min-width:1300px;}
.tr{display:grid;grid-template-columns:var(--ups-cols);gap:10px;padding:12px 10px;border-bottom:1px solid #eef2f7;background:#fff;min-width:1300px;}
.cell{font-size:12px;color:#111827;}
.namecell{display:flex;gap:10px;align-items:flex-start;}
.thumb{width:32px;height:32px;border-radius:4px;border:1px solid #eef2f7;overflow:hidden;background:#f3f4f6;flex:0 0 auto;}
.thumb img{width:100%;height:100%;object-fit:cover;}
.title{font-size:12px;color:#111827;font-weight:600;line-height:1.2;max-width:360px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.sub{font-size:11px;color:#9ca3af;margin-top:3px;}
.vars{font-size:11px;color:#1677ff;margin-top:6px;display:inline-flex;gap:6px;align-items:center;cursor:pointer;}
.link{color:#1677ff;cursor:pointer;}
.dim{color:#9ca3af;}
.stack{display:flex;flex-direction:column;gap:4px;}
.right{text-align:right;}
.perf div{font-size:11px;color:#6b7280;line-height:1.25;}
.perf b{color:#111827;font-weight:600;}
.act{display:flex;flex-direction:column;gap:6px;align-items:flex-end;}
.act .a{font-size:12px;color:#1677ff;cursor:pointer;}
.act .a:hover{text-decoration:underline;}
.vars-box{grid-column:1 / -1;background:#f9fafb;min-width:1300px;}
.vars-r{display:grid;grid-template-columns:var(--ups-cols);gap:10px;padding:12px 10px;border-bottom:1px solid #f3f4f6;font-size:12px;background:#f9fafb;}
.vars-r:last-child{border-bottom:0;}
.vars-thumb{width:32px;height:32px;border:1px solid #eef2f7;border-radius:4px;background:#f3f4f6;display:flex;align-items:center;justify-content:center;color:#d1d5db;flex-shrink:0;}
.vars-modelo{display:flex;align-items:center;gap:8px;}
.vars-modelo-label{font-size:12px;color:#9ca3af;}
.vars-modelo-value{font-size:12px;color:#374151;font-weight:400;}
.vars-sku-main{font-size:12px;color:#374151;}
.vars-sku-id{font-size:11px;color:#9ca3af;margin-top:2px;}
`;

export default function ProductShopee() {
  const [tab, setTab] = useState<TabKey>("ATIVOS");

  const [q, setQ] = useState("");
  const [dateFieldLabel, setDateFieldLabel] = useState("Atualiza...");
  const [dateRange, setDateRange] = useState("");
  const [shopLabel, setShopLabel] = useState("Todas Lojas");

  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZES)[number]>(50);
  const [page, setPage] = useState(1);

  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [integrations, setIntegrations] = useState<ShopeeIntegration[]>([]);
  const [selectedIntegrationId, setSelectedIntegrationId] = useState<string | null>(null);

  const [products, setProducts] = useState<ShopeeProduct[]>([]);
  const [total, setTotal] = useState(0);

  const [counts, setCounts] = useState<Record<TabKey, number>>({
    RASCUNHOS: 0,
    PUBLICANDO: 0,
    FALHOU: 0,
    ATIVOS: 0,
    ESGOTADOS: 0,
    INATIVOS: 0,
    REVISANDO: 0,
    VIOLACAO: 0,
    EXCLUIDOS: 0,
  });

  useEffect(() => {
    apiGet<{ integrations: ShopeeIntegration[] }>("/api/shopee-products/integrations")
      .then((data) => {
        const ints = data.integrations || [];
        setIntegrations(ints);
        // Não seleciona nenhuma loja por padrão - mostra todas
      })
      .catch((e) => console.error("[ProductShopee] integrations error:", e));
  }, []);

  function statusByTab(t: TabKey) {
    if (t === "ATIVOS") return "NORMAL";
    if (t === "ESGOTADOS") return "NORMAL"; // Esgotados também têm status NORMAL, filtramos por qty
    if (t === "INATIVOS") return "UNLIST";
    if (t === "VIOLACAO") return "BANNED";
    if (t === "EXCLUIDOS") return "DELETED";
    if (t === "REVISANDO") return "REVIEWING";
    return "NORMAL";
  }

  useEffect(() => {
    const url = selectedIntegrationId
      ? `/api/shopee-products/counts?integrationId=${encodeURIComponent(selectedIntegrationId)}`
      : `/api/shopee-products/counts`;

    apiGet<{ counts: any }>(url)
      .then((d) => {
        const apiCounts = d.counts || {};
        setCounts({
          RASCUNHOS: 0,
          PUBLICANDO: 0,
          FALHOU: 0,
          ATIVOS: apiCounts.NORMAL || 0, // Já vem calculado pelo backend
          ESGOTADOS: apiCounts.SOLDOUT || 0, // Já vem calculado pelo backend
          INATIVOS: apiCounts.UNLIST || 0,
          REVISANDO: apiCounts.REVIEWING || 0,
          VIOLACAO: apiCounts.BANNED || 0,
          EXCLUIDOS: apiCounts.DELETED || 0,
        });
      })
      .catch((e) => console.error("[ProductShopee] counts error:", e));
  }, [selectedIntegrationId]);

  // ✅ list com paginação real
  useEffect(() => {
    const status = statusByTab(tab);

    const url = selectedIntegrationId
      ? `/api/shopee-products/list?integrationId=${encodeURIComponent(
          selectedIntegrationId
        )}&status=${encodeURIComponent(status)}&page=${page}&per_page=${pageSize}`
      : `/api/shopee-products/list?status=${encodeURIComponent(status)}&page=${page}&per_page=${pageSize}`;

    apiGet<{
      products: ShopeeProduct[];
      pagination: { page: number; per_page: number; total: number };
    }>(url)
      .then((data) => {
        let list = data.products || [];
        
        // Filtra por estoque para ATIVOS e ESGOTADOS (ambos têm status NORMAL)
        if (tab === "ATIVOS") {
          list = list.filter((p) => Number(p.qty) > 0);
        } else if (tab === "ESGOTADOS") {
          list = list.filter((p) => Number(p.qty) === 0);
        }
        
        setProducts(list);
        // Nota: total não é ajustado porque vem da API, mas a lista exibida é filtrada
        setTotal(list.length);
      })
      .catch((e) => {
        console.error("[ProductShopee] list error:", e);
        setProducts([]);
        setTotal(0);
      });
  }, [selectedIntegrationId, tab, page, pageSize]);

  // busca local (somente na página atual)
  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return products;
    return products.filter((r) =>
      (r.title + " " + r.shopLine + " " + r.skuMain + " " + r.idLink)
        .toLowerCase()
        .includes(qq)
    );
  }, [products, q]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize]);
  const pageSafe = Math.max(1, Math.min(page, totalPages));

  useEffect(() => {
    setSelected({});
    setExpandedId(null);
  }, [tab, pageSize, selectedIntegrationId, page]);

  const selectedCount = useMemo(() => Object.values(selected).filter(Boolean).length, [selected]);
  const allOnPageSelected = useMemo(
    () => filtered.length > 0 && filtered.every((r) => !!selected[r.idLink]),
    [filtered, selected]
  );

  function toggleAllOnPage() {
    const next = { ...selected };
    const should = !allOnPageSelected;
    for (const r of filtered) next[r.idLink] = should;
    setSelected(next);
  }
  function toggleRow(idLink: string) {
    setSelected((p) => ({ ...p, [idLink]: !p[idLink] }));
  }
  function toggleVariants(row: ShopeeProduct) {
    if (!row.variations || row.variations.length === 0) return;
    setExpandedId((cur) => (cur === row.idLink ? null : row.idLink));
  }

  return (
    <DashboardLayout>
      <style>{css}</style>

      <div className="ups-shell">
        <aside className="ups-side">
          <div className="ups-side-head">
            <div className="ups-side-title">Shopee - Anúncios</div>
          </div>

          <div className="ups-side-nav">
            {[
              { key: "RASCUNHOS" as const, label: "Rascunhos" },
              { key: "PUBLICANDO" as const, label: "Publicando" },
              { key: "FALHOU" as const, label: "Falhou" },
              { key: "ATIVOS" as const, label: "Ativo" },
            ].map((it) => (
              <div
                key={it.key}
                className={`ups-side-item ${tab === it.key ? "active" : ""}`}
                onClick={() => {
                  setTab(it.key);
                  setPage(1);
                }}
              >
                <span>{it.label}</span>
                <span className="ups-side-count">{counts[it.key] ?? 0}</span>
              </div>
            ))}

            <div className="ups-side-group-label">Ações</div>

            <div className="ups-side-item" onClick={() => alert("Mock: Impulsionando Produto")}>
              <span>Impulsionando Produto</span>
              <span className="ups-side-count">↗</span>
            </div>

            <div className="ups-side-item" onClick={() => alert("Mock: Modelo de Autopeças")}>
              <span>Modelo de Autopeças</span>
              <span className="ups-side-count">↗</span>
            </div>
          </div>
        </aside>

        <main className="ups-main">
          <div className="ups-card">
            <div className="ups-page">
              <div className="ups-filters">
                <div className="fg fg-search">
                  <div className="sel" onClick={() => alert("trocar campo de busca")}>
                    Nome do Anúncio <ChevronDown size={14} />
                  </div>
                  <div className="inp">
                    <Search size={16} color="#9ca3af" />
                    <input value={q} onChange={(e) => setQ(e.target.value)} />
                  </div>
                </div>

                <div className="fg">
                  <div
                    className="sel"
                    onClick={() => setDateFieldLabel((p) => (p === "Atualiza..." ? "Publicado" : "Atualiza..."))}
                  >
                    {dateFieldLabel} <ChevronDown size={14} />
                  </div>
                </div>

                <div className="fg fg-date">
                  <div
                    className="inp"
                    onClick={() => setDateRange(prompt("range (ex: 01/02/2026 - 27/02/2026)", dateRange) ?? dateRange)}
                    style={{ cursor: "pointer" }}
                  >
                    <span style={{ color: dateRange ? "#374151" : "#9ca3af" }}>
                      {dateRange || "Filtrar por data"}
                    </span>
                  </div>
                </div>

                <div className="fg fg-shop">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <div className="sel" style={{ cursor: "pointer" }}>
                        {shopLabel} <ChevronDown size={14} />
                      </div>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="min-w-[200px]">
                      <DropdownMenuItem
                        onClick={() => {
                          setSelectedIntegrationId(null);
                          setShopLabel("Todas Lojas");
                          setPage(1);
                        }}
                        className="text-gray-900 dark:text-gray-100"
                      >
                        Todas Lojas
                      </DropdownMenuItem>
                      {integrations.map((it) => (
                        <DropdownMenuItem
                          key={it.id}
                          onClick={() => {
                            setSelectedIntegrationId(it.id);
                            setShopLabel(it.store_name);
                            setPage(1);
                          }}
                          className="text-gray-900 dark:text-gray-100"
                        >
                          {it.store_name}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="icon-btn" title="Filtro" onClick={() => alert("filtros")}>
                  <Filter size={16} />
                </div>

                <div style={{ marginLeft: "auto", display: "flex", gap: "8px" }}>
                  <button className="ups-btn" onClick={() => alert("Sincronizar")}>
                    Sincronizar <ChevronDown size={14} />
                  </button>
                  <button className="ups-btn" onClick={() => alert("Importar/Exportar")}>
                    Importar & Exportar <ChevronDown size={14} />
                  </button>
                  <button className="ups-btn-primary" onClick={() => alert("Criar anúncio")}>
                    <Plus size={16} /> Criar Anúncio
                  </button>
                </div>
              </div>

              <div className="ups-tabs">
                {TABS.map((t) => {
                  const active = t.key === tab;
                  return (
                    <div
                      key={t.key}
                      className={`tab ${active ? "active" : ""}`}
                      onClick={() => {
                        setTab(t.key);
                        setPage(1);
                      }}
                    >
                      <strong>{t.label}</strong>
                      {t.showHelp ? (
                        <span className="help" title="Ajuda" onClick={(e) => (e.stopPropagation(), alert("Excluídos pela Shopee..."))}>
                          <HelpCircle size={12} />
                        </span>
                      ) : null}
                      <span className="n">{counts[t.key] ?? 0}</span>
                    </div>
                  );
                })}
              </div>

              <div className="ups-bulkactions">
                <div className="bulk-left">
                  <span>Selecionado {selectedCount}</span>
                  <span className="bulk-link">Editar em Massa</span>
                  <span className="bulk-link">Ações em Massa <ChevronDown size={14} /></span>
                  <span className="bulk-link">Gerar Produtos do Armazém <ChevronDown size={14} /></span>
                </div>

                <div className="bulk-right">
                  <div className="small-dd">Ordem <ChevronDown size={14} /></div>
                  <div>Total {total}</div>

                  <div className="pag">
                    <span className="pag-btn" onClick={() => setPage((p) => Math.max(1, p - 1))}>{"<"}</span>
                    <span>{pageSafe}/{totalPages}</span>
                    <span className="pag-btn" onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>{">"}</span>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <div className="small-dd">{pageSize}/página <ChevronDown size={14} /></div>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {PAGE_SIZES.map((n) => (
                        <DropdownMenuItem
                          key={n}
                          onClick={() => {
                            setPageSize(n);
                            setPage(1);
                          }}
                        >
                          {n}/página
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              <div className="ups-table">
                <div className="th">
                  <div className="cell">
                    <input type="checkbox" checked={allOnPageSelected} onChange={toggleAllOnPage} />
                  </div>
                  <div className="cell">Nome do Anúncio</div>
                  <div className="cell">SKU Principal/ID do A...</div>
                  <div className="cell right">Preço</div>
                  <div className="cell right">Preço com Desconto</div>
                  <div className="cell right">Quantidade</div>
                  <div className="cell">Desempenho</div>
                  <div className="cell">Atualizado/Publicado</div>
                  <div className="cell right">Ações</div>
                </div>

                {filtered.map((r) => {
                  const hasVars = !!r.variations && r.variations.length > 0;
                  const expanded = expandedId === r.idLink;

                  return (
                    <React.Fragment key={r.idLink}>
                      <div className="tr">
                        <div className="cell">
                          <input type="checkbox" checked={!!selected[r.idLink]} onChange={() => toggleRow(r.idLink)} />
                        </div>

                        <div className="cell namecell">
                          <div className="thumb">{r.imageUrl ? <img src={r.imageUrl} alt={r.title} /> : null}</div>
                          <div>
                            <div className="title">{r.title}</div>
                            <div className="sub">{r.shopLine}</div>
                            {hasVars ? (
                              <div className="vars" onClick={() => toggleVariants(r)}>
                                Variantes ({r.variations!.length}) <ChevronDown size={12} />
                              </div>
                            ) : null}
                          </div>
                        </div>

                        <div className="cell stack">
                          <div>{r.skuMain}</div>
                          <div className="link">{r.idLink}</div>
                        </div>

                        <div className="cell right">{r.priceText || <span className="dim">—</span>}</div>

                        <div className="cell right">
                          {r.promoText ? <span className="link">{r.promoText}</span> : <span className="dim">—</span>}
                        </div>

                        <div className="cell right">{formatInt(Number(r.qty || 0))}</div>

                        <div className="cell perf">
                          <div>Vendas: <b>{formatInt(Number(r.perfSales || 0))}</b></div>
                          <div>Eu gosto: <b>{formatInt(Number(r.perfLikes || 0))}</b></div>
                          <div>Visitas: <b>{formatInt(Number(r.perfVisits || 0))}</b></div>
                        </div>

                        <div className="cell stack">
                          <div>{r.updatedAt}</div>
                          <div>{r.publishedAt}</div>
                        </div>

                        <div className="cell act">
                          <div className="a" onClick={() => alert(`Editar ${r.idLink}`)}>Editar</div>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <div className="a">Mais <ChevronDown size={14} /></div>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => alert(`Excluir ${r.idLink}`)}>Excluir</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => alert(`Inativar ${r.idLink}`)}>Inativar</DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => alert(`Sincronizar ${r.idLink}`)}>Sincronizar</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>

                      {expanded && hasVars ? (
                        <div className="vars-box">
                          {r.variations!.map((v) => (
                            <div key={v.id} className="vars-r">
                              <div className="cell"></div>

                              <div className="cell" style={{ display: "flex", gap: 10, alignItems: "center" }}>
                                <div className="vars-thumb">🖼️</div>
                                <div className="vars-modelo">
                                  <span className="vars-modelo-label">MODELO:</span>
                                  <span className="vars-modelo-value">{v.name}</span>
                                </div>
                              </div>

                              <div className="cell stack">
                                <div className="vars-sku-main">{v.sku ?? "—"}</div>
                                <div className="vars-sku-id">{v.id}</div>
                              </div>

                              <div className="cell right">{v.priceText}</div>
                              <div className="cell right">{v.promoText ? v.promoText : <span className="dim">—</span>}</div>
                              <div className="cell right">{formatInt(Number(v.qty || 0))}</div>

                              <div className="cell"></div>
                              <div className="cell"></div>
                              <div className="cell"></div>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          </div>
        </main>
      </div>
    </DashboardLayout>
  );
}
