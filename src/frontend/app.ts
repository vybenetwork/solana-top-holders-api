interface TokenData {
  symbol?: string;
  name?: string;
  mintAddress?: string;
  logoUrl?: string;
  decimal?: number;
  decimals?: number;
  category?: string;
  subcategory?: string;
  verified?: boolean;
  price?: number;
  marketCap?: number;
  price1d?: number;
  price7d?: number;
  currentSupply?: number;
  tokenAmountVolume24h?: number;
  usdValueVolume24h?: number;
  updateTime?: number;
}

interface HolderRow {
  rank?: number;
  ownerAddress?: string;
  ownerName?: string;
  ownerLabels?: string[];
  accountLabels?: string[];
  balance?: number | string;
  valueUsd?: number;
  percentageOfSupplyHeld?: number;
}

/** Solid or `{ dark, light }` pair matching bar `linear-gradient(90deg, …)` endpoints. */
type PieSliceSpec = string | { dark: string; light: string };

const mintInput = document.getElementById('mint') as HTMLInputElement;
const pageInput = document.getElementById('page') as HTMLInputElement;
const limitSelect = document.getElementById('limit') as HTMLSelectElement;
const sortByAscSelect = document.getElementById('sortByAsc') as HTMLSelectElement;
const sortByDescSelect = document.getElementById('sortByDesc') as HTMLSelectElement;
const fetchAllBtn = document.getElementById('fetchAll') as HTMLButtonElement;
const loadingIndicator = document.getElementById('loadingIndicator') as HTMLElement;
const tokenSection = document.getElementById('tokenSection') as HTMLElement;
const tokenSectionLoading = document.getElementById('tokenSectionLoading') as HTMLElement;
const tokenSectionError = document.getElementById('tokenSectionError') as HTMLElement;
const tokenLogo = document.getElementById('tokenLogo') as HTMLImageElement;
const tokenSymbol = document.getElementById('tokenSymbol') as HTMLElement;
const tokenName = document.getElementById('tokenName') as HTMLElement;
const tokenStats = document.getElementById('tokenStats') as HTMLElement;
const tokenSupplyPanel = document.getElementById('tokenSupplyPanel') as HTMLElement;
const tokenSupplyPie = document.getElementById('tokenSupplyPie') as HTMLElement;
const tokenSupplyLegend = document.getElementById('tokenSupplyLegend') as HTMLElement;
const tokenLabelSupplyPie = document.getElementById('tokenLabelSupplyPie') as HTMLElement;
const tokenLabelSupplyLegend = document.getElementById('tokenLabelSupplyLegend') as HTMLElement;
const holdersPctSupplyBars = document.getElementById('holdersPctSupplyBars') as HTMLElement;
const holdersConcentrationInner = document.getElementById('holdersConcentrationInner') as HTMLElement;
const holdersUsdValueBars = document.getElementById('holdersUsdValueBars') as HTMLElement;
const holdersWhaleTierPie = document.getElementById('holdersWhaleTierPie') as HTMLElement;
const holdersWhaleTierLegend = document.getElementById('holdersWhaleTierLegend') as HTMLElement;
const holdersTopLabelsBars = document.getElementById('holdersTopLabelsBars') as HTMLElement;

const TIER_LEGEND_SVG_USER =
  '<svg class="token-tier-metric__svg" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>';

const TIER_LEGEND_SVG_VOLUME =
  '<svg class="token-tier-metric__svg" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M3 12h4v8H3v-8zm7-4h4v12h-4V8zm7 6h4v6h-4v-6z"/></svg>';
const holdersLoading = document.getElementById('holdersLoading') as HTMLElement;
const holdersError = document.getElementById('holdersError') as HTMLElement;
const holdersTitle = document.getElementById('holdersTitle') as HTMLElement;
const holdersMeta = document.getElementById('holdersMeta') as HTMLElement;
const holdersBody = document.getElementById('holdersBody') as HTMLElement;
const MAX_FETCH_RETRIES = 5;
const FETCH_RETRY_DELAY_MS = 2000;

const HOLDERS_PLACEHOLDER_ROW_COUNT = 12;

function buildHoldersPlaceholderRowsHtml(): string {
  const row =
    '<tr><td>—</td><td>—</td><td>—</td><td class="holders-value-usd">—</td><td style="text-align:right">—</td></tr>';
  return Array.from({ length: HOLDERS_PLACEHOLDER_ROW_COUNT }, () => row).join('');
}

function truncateAddress(addr: string | undefined): string {
  if (!addr || addr.length <= 12) return addr ?? '';
  return `${addr.slice(0, 4)}....${addr.slice(-4)}`;
}

function escapeHtmlText(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatCategoryOverviewValueHtml(category: string | undefined, subcategory: string | undefined): string {
  const cat = (category ?? '').trim();
  const sub = (subcategory ?? '').trim();
  if (!cat && !sub) return escapeHtmlText('—');
  if (cat && sub) return escapeHtmlText(`${cat} (${sub})`);
  return escapeHtmlText(cat || sub);
}

/** % vs spot with spot as denominator: `(spot − historical) / spot × 100`. */
function formatHistoricalPricePctVsSpotHtml(spot: number | undefined, historical: number | undefined): string {
  if (
    spot == null ||
    historical == null ||
    !Number.isFinite(spot) ||
    !Number.isFinite(historical) ||
    spot === 0
  ) {
    return '';
  }
  const pct = ((spot - historical) / spot) * 100;
  const toneClass = pct >= 0 ? 'usd-tone usd-tone--positive' : 'usd-tone usd-tone--negative';
  const sign = pct >= 0 ? '+' : '';
  return ` <span class="token-stat-price-pct ${toneClass}">${sign}${formatPctSmart(pct)}</span>`;
}

/** Scaled suffix (B/M/K): no decimals and thousands separators when |coefficient| > 999. */
function formatCompactWithSuffix(value: number, divisor: number, suffix: string): string {
  const v = value / divisor;
  if (!Number.isFinite(v)) return `0${suffix}`;
  if (Math.abs(v) > 999) return `${Math.round(v).toLocaleString('en-US')}${suffix}`;
  return `${v.toFixed(2)}${suffix}`;
}

function formatNum(n: number | string | null | undefined): string {
  if (n == null) return '—';
  if (typeof n === 'number') {
    if (n >= 1e9) return formatCompactWithSuffix(n, 1e9, 'B');
    if (n >= 1e6) return formatCompactWithSuffix(n, 1e6, 'M');
    if (n >= 1e3) return formatCompactWithSuffix(n, 1e3, 'K');
    return n.toFixed(4);
  }
  return String(n);
}

function formatBalance(n: number | string | null | undefined, symbol: string): string {
  if (n == null || n === '') return '—';
  const num = Number(n);
  if (Number.isNaN(num)) return '—';
  const sym = symbol && String(symbol).trim() ? ` ${String(symbol).trim()}` : '';
  if (num >= 1e9) return `${formatCompactWithSuffix(num, 1e9, 'B')}${sym}`;
  if (num >= 1e6) return `${formatCompactWithSuffix(num, 1e6, 'M')}${sym}`;
  if (num >= 10) return `${Math.round(num).toLocaleString('en-US')}${sym}`;
  if (num >= 1) return `${num.toFixed(2).replace(/\.?0+$/, '')}${sym}`;
  if (num > 0) return `${num.toFixed(4).replace(/\.?0+$/, '')}${sym}`;
  return `0${sym}`;
}

function formatPrice(n: number | null | undefined): string {
  if (n == null) return '—';
  const num = Number(n);
  if (Number.isNaN(num)) return '—';
  const trim = (s: string) => s.replace(/\.?0+$/, '') || '0';
  if (num >= 1) {
    const s = num.toFixed(2);
    return s.endsWith('.00') ? s.replace(/\.00$/, '') : s;
  }
  if (num > 0.0099) return trim(num.toFixed(4));
  return trim(num.toFixed(12));
}

function formatUsdHolderValue(n: number | string | null | undefined): string {
  if (n == null || n === '') return '—';
  const num = Number(n);
  if (Number.isNaN(num)) return '—';
  if (Math.abs(num) < 1) {
    return `$${num.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
  return `$${Math.round(num).toLocaleString()}`;
}

function formatSupplyPercent(n: number | null | undefined): string {
  if (n == null) return '—';
  const num = Number(n);
  if (Number.isNaN(num)) return '—';
  if (num === 0) return '0%';
  const abs = Math.abs(num);
  if (abs >= 0.01) return `${num.toFixed(2)}%`;
  const decimalsToFirstNonZero = Math.ceil(-Math.log10(abs));
  return `${num.toFixed(decimalsToFirstNonZero)}%`;
}

function toFiniteNumber(n: number | string | null | undefined): number {
  if (n == null || n === '') return 0;
  const num = Number(n);
  return Number.isFinite(num) ? num : 0;
}

function isLabeledHolder(row: HolderRow): boolean {
  if ((row.ownerName ?? '').trim() !== '') return true;
  const labels = Array.isArray(row.ownerLabels) ? row.ownerLabels : Array.isArray(row.accountLabels) ? row.accountLabels : [];
  return labels.some((label) => String(label).trim() !== '');
}

function getTopFetchedCount(): number {
  const limitRaw = Number(limitSelect.value);
  const limit = Number.isFinite(limitRaw) && limitRaw >= 0 ? Math.floor(limitRaw) : 1000;
  const pageRaw = Number(pageInput.value);
  const page = Number.isFinite(pageRaw) && pageRaw >= 0 ? Math.floor(pageRaw) : 0;
  return (page + 1) * limit;
}

function pctSupplyBucketDefs(): { label: string; contains: (pct: number) => boolean }[] {
  return [
    { label: '<0.01%', contains: (pct) => pct >= 0 && pct < 0.01 },
    { label: '0.01–0.1%', contains: (pct) => pct >= 0.01 && pct < 0.1 },
    { label: '0.1–1%', contains: (pct) => pct >= 0.1 && pct < 1 },
    { label: '1–5%', contains: (pct) => pct >= 1 && pct < 5 },
    { label: '5–25%', contains: (pct) => pct >= 5 && pct < 25 },
    { label: '25%+', contains: (pct) => pct >= 25 },
  ];
}

function renderHoldersPctSupplyBars(rows: HolderRow[], topFetched: number): void {
  const defs = pctSupplyBucketDefs();
  const slice = rows.slice(0, Math.min(rows.length, topFetched));
  const counts = defs.map(() => 0);
  for (const row of slice) {
    const pct = toFiniteNumber(row.percentageOfSupplyHeld ?? null);
    const idx = defs.findIndex((d) => d.contains(pct));
    if (idx >= 0) counts[idx] += 1;
  }
  const maxC = Math.max(1, ...counts);
  holdersPctSupplyBars.innerHTML = defs
    .map((d, i) => {
      const c = counts[i];
      const hPct = maxC > 0 ? Math.max(2, (c / maxC) * 100) : 2;
      const t = defs.length > 1 ? i / (defs.length - 1) : 0;
      return `<div class="token-trades-vertical-bar-item">
        <div class="token-trades-vertical-track">
          <div class="token-trades-vertical-fill token-pnl-bar-fill--trade-scale" style="height:${hPct}%;--trade-grad-t:${t}"></div>
          <span class="token-trades-vertical-count">${c.toLocaleString()}</span>
        </div>
        <div class="token-trades-vertical-label">${d.label}</div>
      </div>`;
    })
    .join('');
}

function setChartsPlaceholder(): void {
  tokenSupplyPanel.hidden = false;
  const empty4 = buildPieGradientWithGaps([0, 0, 0, 0], ['#3b82f6', '#2563eb', '#1d4ed8', '#27272a']);
  const empty3 = buildPieGradientWithGaps([0, 0, 0], ['#3b82f6', '#1d4ed8', '#27272a']);
  const empty5 = buildPieGradientWithGaps([0, 0, 0, 0, 0], ['#22c55e', '#2563eb', '#a855f7', '#f97316', '#27272a']);
  tokenSupplyPie.style.background = empty4;
  tokenLabelSupplyPie.style.background = empty3;
  holdersWhaleTierPie.style.background = empty5;
  mountDonutPieOverlays(tokenSupplyPie, [0, 0, 0, 0], ['#3b82f6', '#2563eb', '#1d4ed8', '#27272a'], {
    mock: true,
    hubSubline: '—',
  });
  mountDonutPieOverlays(tokenLabelSupplyPie, [0, 0, 0], ['#3b82f6', '#1d4ed8', '#27272a'], {
    mock: true,
    hubSubline: '—',
  });
  mountDonutPieOverlays(holdersWhaleTierPie, [0, 0, 0, 0, 0], ['#22c55e', '#2563eb', '#a855f7', '#f97316', '#27272a'], {
    mock: true,
    hubSubline: '—',
  });
  const topFetched = getTopFetchedCount();
  const topFetchedLabel = topFetched.toLocaleString();
  const showTop101Bucket = topFetched >= 250;
  const sliceSupply = showTop101Bucket ? 4 : 3;
  setSupplyLegendGrid(tokenSupplyLegend, sliceSupply);
  tokenSupplyLegend.innerHTML = `
    ${renderHolderSupplyTierCardPlaceholder('Top 10 wallets', '#3b82f6', '#3b82f6')}
    ${renderHolderSupplyTierCardPlaceholder('Top 11–100 wallets', '#2563eb', '#2563eb')}
    ${showTop101Bucket ? renderHolderSupplyTierCardPlaceholder(`Top 101–${topFetchedLabel} wallets`, '#1d4ed8', '#1d4ed8') : ''}
    ${renderHolderSupplyTierCardPlaceholder('Remaining supply', '#52525b', '#27272a')}
  `;
  setSupplyLegendGrid(tokenLabelSupplyLegend, 3);
  tokenLabelSupplyLegend.innerHTML = `
    ${renderHolderSupplyTierCardPlaceholder(`Labeled top ${topFetchedLabel} supply`, '#3b82f6', '#3b82f6')}
    ${renderHolderSupplyTierCardPlaceholder(`Unlabeled top ${topFetchedLabel} supply`, '#1d4ed8', '#1d4ed8')}
    ${renderHolderSupplyTierCardPlaceholder(`Non-top ${topFetchedLabel} supply`, '#52525b', '#27272a')}
  `;
  setSupplyLegendGrid(holdersWhaleTierLegend, 3);
  const outsideTopPlaceholder = `Outside top ${topFetchedLabel}`;
  holdersWhaleTierLegend.innerHTML = [
    'Mega (≥1%)',
    'Whale (0.1–1%)',
    'Shark (0.01–0.1%)',
    'Fish (<0.01%)',
    outsideTopPlaceholder,
  ]
    .map((t, i) => renderHolderSupplyTierCardPlaceholder(t, ['#22c55e', '#2563eb', '#a855f7', '#f97316', '#52525b'][i]!, ['#22c55e', '#2563eb', '#a855f7', '#f97316', '#27272a'][i]!))
    .join('');
  renderHoldersPctSupplyBars([], topFetched);
  renderConcentrationAndGini([], topFetched);
  renderUsdValueBarsChart([], topFetched);
  holdersTopLabelsBars.innerHTML =
    '<div class="holders-hbar-row"><span class="holders-hbar-name holders-hbar-meta">—</span><div class="holders-hbar-track"><div class="holders-hbar-fill" style="width:0%"></div></div><span class="holders-hbar-meta">—</span></div>';
}

function formatPctSmart(value: number): string {
  const num = Number(value);
  if (!Number.isFinite(num) || num === 0) return '0%';
  const abs = Math.abs(num);
  if (abs >= 0.01) return `${num.toFixed(2)}%`;
  const decimalsToFirstNonZero = Math.ceil(-Math.log10(abs));
  const decimals = Math.max(3, Math.min(8, decimalsToFirstNonZero));
  return `${num.toFixed(decimals)}%`;
}

function setSupplyLegendGrid(el: HTMLElement, sliceCount: number): void {
  el.classList.remove('token-supply-legend--cols2', 'token-supply-legend--cols3', 'token-supply-legend--cols6');
  if (sliceCount <= 3) el.classList.add('token-supply-legend--cols3');
  else if (sliceCount === 4) el.classList.add('token-supply-legend--cols2');
  else el.classList.add('token-supply-legend--cols6');
}

function renderHolderSupplyTierCard(args: {
  title: string;
  accent: string;
  swatchColor: string;
  slicePct: number;
  balanceLine: string;
  usdLine: string;
  walletsLine: string;
  circNum: string;
  circDen: string;
}): string {
  const t = escapeHtmlText(args.title);
  return `<div class="token-supply-legend-item token-supply-legend-item--tier-dashboard">
    <article class="token-tier-card" style="--tier-accent:${args.accent}">
      <h4 class="token-tier-card__title">${t}</h4>
      <ul class="token-tier-card__metrics">
        <li class="token-tier-metric">
          <span class="token-tier-metric__ico token-tier-metric__ico--share-swatch" style="--tier-swatch:${args.swatchColor}" aria-hidden="true"></span>
          <div class="token-tier-metric__body">
            <span class="token-tier-metric__slice-pct">${formatPctSmart(args.slicePct)}</span><span class="token-tier-metric__muted"> of supply</span>
          </div>
        </li>
        <li class="token-tier-metric">
          <span class="token-tier-metric__ico token-tier-metric__ico--usd" aria-hidden="true">$</span>
          <div class="token-tier-metric__body">
            <span class="token-tier-metric__accent-usd">${args.usdLine}</span><span class="token-tier-metric__muted"> USD (est.)</span>
          </div>
        </li>
        <li class="token-tier-metric">
          <span class="token-tier-metric__ico token-tier-metric__ico--volume" aria-hidden="true">${TIER_LEGEND_SVG_VOLUME}</span>
          <div class="token-tier-metric__body">
            <span class="token-tier-metric__accent-volume">${args.balanceLine}</span><span class="token-tier-metric__muted"> tokens</span>
          </div>
        </li>
        <li class="token-tier-metric">
          <span class="token-tier-metric__ico token-tier-metric__ico--people" aria-hidden="true">${TIER_LEGEND_SVG_USER}</span>
          <div class="token-tier-metric__body">
            <span class="token-tier-metric__emph">${args.walletsLine}</span><span class="token-tier-metric__muted"> wallets</span>
          </div>
        </li>
        <li class="token-tier-metric token-tier-metric--total">
          <span class="token-tier-metric__ico token-tier-metric__ico--volume" aria-hidden="true">${TIER_LEGEND_SVG_VOLUME}</span>
          <div class="token-tier-metric__body token-tier-metric__body--stack">
            <span class="token-tier-metric__label">Balance / circulating</span>
            <span class="token-tier-metric__ratio token-tier-metric__ratio--vol-pnl-split">
              <span class="token-tier-metric__vol-pnl-slice-val">${args.circNum}</span><span class="token-tier-metric__vol-pnl-totalvol-suffix"> / ${args.circDen}</span>
            </span>
          </div>
        </li>
      </ul>
    </article>
  </div>`;
}

function renderHolderSupplyTierCardPlaceholder(title: string, accent: string, swatch: string): string {
  const dash = '—';
  const t = escapeHtmlText(title);
  return `<div class="token-supply-legend-item token-supply-legend-item--tier-dashboard">
    <article class="token-tier-card token-tier-card--placeholder" style="--tier-accent:${accent}">
      <h4 class="token-tier-card__title">${t}</h4>
      <ul class="token-tier-card__metrics">
        <li class="token-tier-metric"><span class="token-tier-metric__ico token-tier-metric__ico--share-swatch" style="--tier-swatch:${swatch}" aria-hidden="true"></span><div class="token-tier-metric__body"><span class="token-tier-metric__muted">${dash}</span></div></li>
        <li class="token-tier-metric"><span class="token-tier-metric__ico token-tier-metric__ico--usd" aria-hidden="true">$</span><div class="token-tier-metric__body"><span class="token-tier-metric__muted">${dash}</span></div></li>
        <li class="token-tier-metric"><span class="token-tier-metric__ico token-tier-metric__ico--volume" aria-hidden="true">${TIER_LEGEND_SVG_VOLUME}</span><div class="token-tier-metric__body"><span class="token-tier-metric__muted">${dash}</span></div></li>
        <li class="token-tier-metric"><span class="token-tier-metric__ico token-tier-metric__ico--people" aria-hidden="true">${TIER_LEGEND_SVG_USER}</span><div class="token-tier-metric__body"><span class="token-tier-metric__muted">${dash}</span></div></li>
        <li class="token-tier-metric token-tier-metric--total"><span class="token-tier-metric__ico token-tier-metric__ico--volume" aria-hidden="true">${TIER_LEGEND_SVG_VOLUME}</span><div class="token-tier-metric__body token-tier-metric__body--stack"><span class="token-tier-metric__label">Balance / circulating</span><span class="token-tier-metric__ratio token-tier-metric__ratio--vol-pnl-split"><span class="token-tier-metric__vol-pnl-slice-val">${dash}</span><span class="token-tier-metric__vol-pnl-totalvol-suffix"> / ${dash}</span></span></div></li>
      </ul>
    </article>
  </div>`;
}

function computeGiniFromShares(values: number[]): number | null {
  const vals = values.filter((v) => v > 0);
  if (vals.length < 2) return null;
  const sorted = [...vals].sort((a, b) => a - b);
  const n = sorted.length;
  const sum = sorted.reduce((a, b) => a + b, 0);
  if (sum <= 0) return null;
  let weighted = 0;
  for (let i = 0; i < n; i++) weighted += (i + 1) * sorted[i];
  const g = (2 * weighted) / (n * sum) - (n + 1) / n;
  return Math.max(0, Math.min(1, g));
}

function renderConcentrationAndGini(rows: HolderRow[], topFetched: number): void {
  const slice = rows.slice(0, Math.min(rows.length, topFetched));
  const thresholds = [10, 25, 100, 250, 1000];
  const metrics = thresholds.map((k) => {
    const n = Math.min(k, slice.length);
    const cum = slice.slice(0, n).reduce((s, r) => s + toFiniteNumber(r.percentageOfSupplyHeld), 0);
    return { k, cum: Math.min(100, cum) };
  });
  const sumPct = slice.reduce((s, r) => s + toFiniteNumber(r.percentageOfSupplyHeld), 0);
  const rem = Math.max(0, 100 - sumPct);
  const giniVals = [...slice.map((r) => toFiniteNumber(r.percentageOfSupplyHeld)), rem].filter((x) => x > 0);
  const g = computeGiniFromShares(giniVals);
  holdersConcentrationInner.innerHTML = `
    ${metrics
      .map(
        (m) => `<div class="holders-conc-metric">
      <p class="holders-conc-metric__label">Top ${m.k.toLocaleString()}</p>
      <p class="holders-conc-metric__value">${formatPctSmart(m.cum)}</p>
      <div class="holders-conc-bar-track"><div class="holders-conc-bar-fill" style="width:${Math.min(100, m.cum)}%"></div></div>
    </div>`
      )
      .join('')}
    <div class="holders-conc-gini">
      <strong>Gini coefficient</strong> (0 = equal, 1 = concentrated):
      <strong>${g != null ? g.toFixed(3) : '—'}</strong>
      — from each holder’s % of supply plus a remainder bucket to reach 100%.
    </div>
  `;
}

function usdBucketDefs(): { label: string; contains: (v: number) => boolean }[] {
  return [
    { label: '<$1k', contains: (v) => v >= 0 && v < 1000 },
    { label: '$1k–10k', contains: (v) => v >= 1000 && v < 10_000 },
    { label: '$10k–100k', contains: (v) => v >= 10_000 && v < 100_000 },
    { label: '$100k–1M', contains: (v) => v >= 100_000 && v < 1_000_000 },
    { label: '$1M–10M', contains: (v) => v >= 1_000_000 && v < 10_000_000 },
    { label: '$10M+', contains: (v) => v >= 10_000_000 },
  ];
}

function renderUsdValueBarsChart(rows: HolderRow[], topFetched: number): void {
  const defs = usdBucketDefs();
  const slice = rows.slice(0, Math.min(rows.length, topFetched));
  const counts = defs.map(() => 0);
  for (const row of slice) {
    const v = toFiniteNumber(row.valueUsd ?? null);
    const idx = defs.findIndex((d) => d.contains(v));
    if (idx >= 0) counts[idx] += 1;
  }
  const maxC = Math.max(1, ...counts);
  holdersUsdValueBars.innerHTML = defs
    .map((d, i) => {
      const c = counts[i];
      const hPct = maxC > 0 ? Math.max(2, (c / maxC) * 100) : 2;
      const t = defs.length > 1 ? i / (defs.length - 1) : 0;
      return `<div class="token-trades-vertical-bar-item">
        <div class="token-trades-vertical-track">
          <div class="token-trades-vertical-fill token-pnl-bar-fill--trade-scale" style="height:${hPct}%;--trade-grad-t:${t}"></div>
          <span class="token-trades-vertical-count">${c.toLocaleString()}</span>
        </div>
        <div class="token-trades-vertical-label">${d.label}</div>
      </div>`;
    })
    .join('');
}

function aggregateWhaleTiers(rows: HolderRow[], topFetched: number): { pct: number; wallets: number; balance: number; usd: number }[] {
  const slice = rows.slice(0, Math.min(rows.length, topFetched));
  const tiers = [
    { pct: 0, wallets: 0, balance: 0, usd: 0 },
    { pct: 0, wallets: 0, balance: 0, usd: 0 },
    { pct: 0, wallets: 0, balance: 0, usd: 0 },
    { pct: 0, wallets: 0, balance: 0, usd: 0 },
  ];
  for (const r of slice) {
    const p = toFiniteNumber(r.percentageOfSupplyHeld ?? null);
    let ti = 3;
    if (p >= 1) ti = 0;
    else if (p >= 0.1) ti = 1;
    else if (p >= 0.01) ti = 2;
    else if (p > 0) ti = 3;
    else continue;
    tiers[ti].pct += p;
    tiers[ti].wallets += 1;
    tiers[ti].balance += toFiniteNumber(r.balance ?? null);
    tiers[ti].usd += toFiniteNumber(r.valueUsd ?? null);
  }
  return tiers;
}

const LABELED_GROUP_TOP_N = 20;

function renderTopLabelsBarsChart(rows: HolderRow[], topFetched: number): void {
  const slice = rows.slice(0, Math.min(rows.length, topFetched));
  const map = new Map<string, { pct: number; usd: number }>();
  for (const r of slice) {
    const key = labeledWalletGroupKey(r);
    if (!key) continue;
    const cur = map.get(key) ?? { pct: 0, usd: 0 };
    cur.pct += toFiniteNumber(r.percentageOfSupplyHeld ?? null);
    cur.usd += toFiniteNumber(r.valueUsd ?? null);
    map.set(key, cur);
  }
  const sorted = [...map.entries()].sort((a, b) => b[1].pct - a[1].pct || a[0].localeCompare(b[0]));
  const top = sorted.slice(0, LABELED_GROUP_TOP_N);
  let otherPct = 0;
  let otherUsd = 0;
  for (let i = LABELED_GROUP_TOP_N; i < sorted.length; i++) {
    otherPct += sorted[i][1].pct;
    otherUsd += sorted[i][1].usd;
  }
  const rowsOut = top.map(([name, v]) => ({ name, ...v }));
  if (otherPct > 0 || otherUsd > 0) rowsOut.push({ name: 'Other labeled', pct: otherPct, usd: otherUsd });
  const maxP = Math.max(0.01, ...rowsOut.map((r) => r.pct));
  holdersTopLabelsBars.innerHTML =
    rowsOut.length === 0
      ? '<p class="meta wallet-pnl-pnl-trading-lede">No labeled wallets in this cohort.</p>'
      : rowsOut
          .map((r) => {
            const w = Math.min(100, (r.pct / maxP) * 100);
            const safe = escapeHtmlText(r.name);
            return `<div class="holders-hbar-row">
            <span class="holders-hbar-name" title="${safe}">${safe}</span>
            <div class="holders-hbar-track"><div class="holders-hbar-fill" style="width:${w}%"></div></div>
            <span class="holders-hbar-meta">${formatPctSmart(r.pct)} <span class="holders-value-usd">${formatUsdHolderValue(r.usd)}</span></span>
          </div>`;
          })
          .join('');
}

function entityGroupKey(row: HolderRow): string | null {
  const name = (row.ownerName ?? '').trim();
  if (name) return name;
  const ol = row.ownerLabels?.map((x) => String(x).trim()).find(Boolean);
  const al = row.accountLabels?.map((x) => String(x).trim()).find(Boolean);
  const s = ol || al;
  return s || null;
}

/** Strip trailing colons from label tokens (e.g. "Exchange:" → "Exchange"). */
function stripTrailingColonsFromToken(s: string): string {
  return s.replace(/:+$/u, '');
}

/** First whitespace-delimited token; used to roll up labeled wallets into coarse groups. */
function firstLabelSegment(full: string): string {
  const t = full.trim();
  if (!t) return '';
  const m = t.match(/\S+/u);
  const raw = m ? m[0]! : '';
  return stripTrailingColonsFromToken(raw);
}

function labeledWalletGroupKey(row: HolderRow): string | null {
  const full = entityGroupKey(row);
  if (!full) return null;
  const seg = firstLabelSegment(full);
  return seg || null;
}

function applyMinVisibleSlices(realSlices: number[], minVisiblePct = 1.5): number[] {
  const adjusted = realSlices.map((v) => Math.max(0, v));
  const tinyEntries = adjusted
    .map((v, i) => ({ v, i }))
    .filter(({ v }) => v > 0 && v < minVisiblePct);
  const tinyIdx = tinyEntries.map(({ i }) => i);
  if (tinyIdx.length === 0) return adjusted;

  const targetTotal = adjusted.reduce((sum, v) => sum + v, 0);
  const tinyValues = tinyEntries.map(({ v }) => v);
  const minTiny = Math.min(...tinyValues);
  const maxTiny = Math.max(...tinyValues);
  tinyEntries.forEach(({ v, i }) => {
    if (maxTiny === minTiny) {
      adjusted[i] = minVisiblePct;
      return;
    }
    const normalized = (v - minTiny) / (maxTiny - minTiny);
    adjusted[i] = minVisiblePct * (1 + normalized * 0.5);
  });
  let overflow = adjusted.reduce((sum, v) => sum + v, 0) - targetTotal;
  if (overflow <= 0) return adjusted;

  const donorIndices = adjusted
    .map((v, i) => ({ v, i }))
    .filter(({ i, v }) => !tinyIdx.includes(i) && v > 0)
    .sort((a, b) => b.v - a.v)
    .map(({ i }) => i);

  for (const i of donorIndices) {
    if (overflow <= 0) break;
    const reducible = Math.max(0, adjusted[i]);
    const cut = Math.min(reducible, overflow);
    adjusted[i] -= cut;
    overflow -= cut;
  }

  if (overflow > 0) {
    const total = adjusted.reduce((sum, v) => sum + v, 0);
    if (total > 0) {
      return adjusted.map((v) => (v / total) * targetTotal);
    }
  }

  return adjusted;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function lerpChannel(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

function lerpHex(from: string, to: string, t: number): string {
  const u = Math.max(0, Math.min(1, t));
  const A = hexToRgb(from);
  const B = hexToRgb(to);
  return `#${lerpChannel(A.r, B.r, u).toString(16).padStart(2, '0')}${lerpChannel(A.g, B.g, u)
    .toString(16)
    .padStart(2, '0')}${lerpChannel(A.b, B.b, u).toString(16).padStart(2, '0')}`;
}

/** `h`, `s`, `l` as in CSS: hue 0–360, saturation and lightness 0–100. */
function hslToHex(h: number, s: number, l: number): string {
  const H = ((h % 360) + 360) % 360;
  const S = Math.max(0, Math.min(100, s)) / 100;
  const L = Math.max(0, Math.min(100, l)) / 100;
  const c = (1 - Math.abs(2 * L - 1)) * S;
  const x = c * (1 - Math.abs(((H / 60) % 2) - 1));
  const m = L - c / 2;
  let rp = 0;
  let gp = 0;
  let bp = 0;
  if (H < 60) {
    rp = c;
    gp = x;
  } else if (H < 120) {
    rp = x;
    gp = c;
  } else if (H < 180) {
    gp = c;
    bp = x;
  } else if (H < 240) {
    gp = x;
    bp = c;
  } else if (H < 300) {
    rp = x;
    bp = c;
  } else {
    rp = c;
    bp = x;
  }
  const r = Math.round((rp + m) * 255);
  const g = Math.round((gp + m) * 255);
  const b = Math.round((bp + m) * 255);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

function parseHslCss(input: string): { h: number; s: number; l: number } | null {
  const m = input.match(/hsl\(\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%\s*\)/);
  if (!m) return null;
  return { h: Number(m[1]), s: Number(m[2]), l: Number(m[3]) };
}

/** Gap wedges between slices; must stay in sync with {@link tradeTierPieSliceMidAnglesDeg}. */
const PIE_CONIC_GAP_DEG = 1.2;

function pieSliceSpecToLabelHex(spec: PieSliceSpec): string {
  if (typeof spec === 'string') {
    return spec.startsWith('#') ? spec : hslToHex(0, 0, 55);
  }
  const a = parseHslCss(spec.dark);
  const b = parseHslCss(spec.light);
  if (a && b) {
    return hslToHex(a.h, (a.s + b.s) / 2, (a.l + b.l) / 2);
  }
  if (spec.dark.startsWith('#') && spec.light.startsWith('#')) {
    return lerpHex(spec.dark, spec.light, 0.5);
  }
  return '#64748b';
}

function buildPieGradientWithGaps(
  slices: number[],
  colors: PieSliceSpec[],
  gapColor = '#0a0a0d',
  gapDeg = PIE_CONIC_GAP_DEG
): string {
  const entries = slices
    .map((value, i) => ({ value: Math.max(0, value), fill: colors[i] ?? '#27272a' }))
    .filter((entry) => entry.value > 0);

  if (entries.length === 0) {
    return `conic-gradient(${gapColor} 0deg 360deg)`;
  }

  if (entries.length === 1) {
    const spec = entries[0].fill;
    if (typeof spec === 'string') {
      return `conic-gradient(${spec} 0deg 360deg)`;
    }
    return `conic-gradient(${spec.dark} 0deg, ${spec.light} 360deg)`;
  }

  const total = entries.reduce((sum, entry) => sum + entry.value, 0);
  const totalGap = Math.min(359, gapDeg * entries.length);
  const usableDeg = Math.max(1, 360 - totalGap);
  const stops: string[] = [];
  let cursor = 0;

  entries.forEach((entry) => {
    const gapStart = cursor;
    const gapEnd = gapStart + gapDeg;
    stops.push(`${gapColor} ${gapStart.toFixed(3)}deg ${gapEnd.toFixed(3)}deg`);
    cursor = gapEnd;

    const sliceDeg = usableDeg * (entry.value / total);
    const sliceStart = cursor;
    const sliceEnd = sliceStart + sliceDeg;
    const spec = entry.fill;
    if (typeof spec === 'string') {
      stops.push(`${spec} ${sliceStart.toFixed(3)}deg ${sliceEnd.toFixed(3)}deg`);
    } else {
      stops.push(`${spec.dark} ${sliceStart.toFixed(3)}deg, ${spec.light} ${sliceEnd.toFixed(3)}deg`);
    }
    cursor = sliceEnd;
  });

  if (cursor < 360) {
    stops.push(`${gapColor} ${cursor.toFixed(3)}deg 360deg`);
  }

  return `conic-gradient(${stops.join(', ')})`;
}

/** Mid-angle (degrees, CSS conic: 0° = top, clockwise) per slice index; null if slice weight is 0. */
function tradeTierPieSliceMidAnglesDeg(slices: number[], gapDeg: number): (number | null)[] {
  const out: (number | null)[] = slices.map(() => null);
  const entries = slices
    .map((value, i) => ({ value: Math.max(0, value), i }))
    .filter((e) => e.value > 0);
  if (entries.length === 0) return out;
  if (entries.length === 1) {
    out[entries[0].i] = 0;
    return out;
  }
  const total = entries.reduce((sum, e) => sum + e.value, 0);
  const totalGap = Math.min(359, gapDeg * entries.length);
  const usableDeg = Math.max(1, 360 - totalGap);
  let cursor = 0;
  for (const entry of entries) {
    cursor += gapDeg;
    const sliceDeg = usableDeg * (entry.value / total);
    out[entry.i] = cursor + sliceDeg / 2;
    cursor += sliceDeg;
  }
  return out;
}

/** Angular width (degrees) of each slice; null if weight is 0. Mirrors {@link buildPieGradientWithGaps}. */
function tradeTierPieSliceSpanDeg(slices: number[], gapDeg: number): (number | null)[] {
  const out: (number | null)[] = slices.map(() => null);
  const entries = slices
    .map((value, i) => ({ value: Math.max(0, value), i }))
    .filter((e) => e.value > 0);
  if (entries.length === 0) return out;
  if (entries.length === 1) {
    out[entries[0].i] = 360;
    return out;
  }
  const total = entries.reduce((sum, e) => sum + e.value, 0);
  const totalGap = Math.min(359, gapDeg * entries.length);
  const usableDeg = Math.max(1, 360 - totalGap);
  let cursor = 0;
  for (const entry of entries) {
    cursor += gapDeg;
    const sliceDeg = usableDeg * (entry.value / total);
    out[entry.i] = sliceDeg;
    cursor += sliceDeg;
  }
  return out;
}

function clearDonutPieOverlays(pieEl: HTMLElement): void {
  pieEl.querySelector('.token-supply-pie__label-svg')?.remove();
  pieEl.querySelector('.token-supply-pie__hub')?.remove();
}

function mountDonutPieCenterHub(pieEl: HTMLElement, options: { mock: boolean; hubSubline: string }): void {
  pieEl.querySelector('.token-supply-pie__hub')?.remove();
  const hub = document.createElement('div');
  hub.className = 'token-supply-pie__hub';
  hub.setAttribute('aria-hidden', 'true');
  const pctEl = document.createElement('div');
  pctEl.className = 'token-supply-pie__hub-pct';
  pctEl.textContent = options.mock ? '—' : '100%';
  const subEl = document.createElement('div');
  subEl.className = 'token-supply-pie__hub-sub';
  subEl.textContent = options.hubSubline;
  hub.appendChild(pctEl);
  hub.appendChild(subEl);
  pieEl.appendChild(hub);
}

const TIER_PIE_OUTSIDE_LABEL_MIN_ANGULAR_SEP_DEG = 28;

const TIER_PIE_LABEL_MIN_SEP_DEG = TIER_PIE_OUTSIDE_LABEL_MIN_ANGULAR_SEP_DEG;
const TIER_PIE_LABEL_TIGHT_PAIR_MIN_DEG = TIER_PIE_OUTSIDE_LABEL_MIN_ANGULAR_SEP_DEG;
const TIER_PIE_LABEL_MAX_ANGLE_OFF = 15;
const TIER_PIE_LABEL_MAX_TANGENT_DEG = 44;
const TIER_PIE_LABEL_R_STACK = 7.25;
const TIER_PIE_R_INNER = 23;
const TIER_PIE_R_OUTER = 49.25;
const TIER_PIE_R_LABEL_INSIDE = (TIER_PIE_R_INNER + TIER_PIE_R_OUTER) / 2;
const TIER_PIE_INSIDE_FONT_UNITS = 4.35;
const TIER_PIE_INSIDE_MIN_SLICE_DEG = 10;
const TIER_PIE_INSIDE_MIN_PCT = 5;
const TIER_PIE_INSIDE_ARC_PAD = 0.84;

type TierPieLabelCand = { mid: number; pct: number; i: number };

function tradeTierEstimatePctLabelWidth(pct: number, fontUnits: number): number {
  const len = `${pct.toFixed(2)}%`.length;
  return len * fontUnits * 0.52;
}

function tradeTierPieLabelFitsInside(spanDeg: number | null, pct: number): boolean {
  if (spanDeg == null || spanDeg < TIER_PIE_INSIDE_MIN_SLICE_DEG) return false;
  if (pct < TIER_PIE_INSIDE_MIN_PCT) return false;
  const arcLen = TIER_PIE_R_LABEL_INSIDE * ((spanDeg * Math.PI) / 180);
  const w = tradeTierEstimatePctLabelWidth(pct, TIER_PIE_INSIDE_FONT_UNITS);
  return arcLen >= w * TIER_PIE_INSIDE_ARC_PAD;
}

function tradeTierPieLabelFillForSlice(hex: string): { fill: string; onDarkSlice: boolean } {
  const { r, g, b } = hexToRgb(hex);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.52 ? { fill: '#0f172a', onDarkSlice: false } : { fill: '#f8fafc', onDarkSlice: true };
}

function clampNum(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function computeTradeTierPieLabelLayout(cands: TierPieLabelCand[]): {
  angleOff: Map<number, number>;
  tangentialDeg: Map<number, number>;
  radialBoost: Map<number, number>;
} {
  const angleOff = new Map<number, number>();
  const tangentialDeg = new Map<number, number>();
  for (const c of cands) {
    angleOff.set(c.i, 0);
    tangentialDeg.set(c.i, 0);
  }
  const eff = (c: TierPieLabelCand) => c.mid + (angleOff.get(c.i) ?? 0);
  const lab = (c: TierPieLabelCand) => c.mid + (angleOff.get(c.i) ?? 0) + (tangentialDeg.get(c.i) ?? 0);
  const n = cands.length;
  const radialBoost = new Map<number, number>();

  if (n <= 1) return { angleOff, tangentialDeg, radialBoost };

  for (let pass = 0; pass < 32; pass++) {
    const ord = [...cands].sort((a, b) => eff(a) - eff(b));
    let changed = false;
    for (let k = 0; k < n; k++) {
      const a = ord[k];
      const b = ord[(k + 1) % n];
      const ea = eff(a);
      const eb = eff(b) + (k === n - 1 ? 360 : 0);
      const gap = eb - ea;
      if (gap >= TIER_PIE_LABEL_MIN_SEP_DEG) continue;
      const deficit = TIER_PIE_LABEL_MIN_SEP_DEG - gap;
      const step = Math.min(deficit * 0.52, 5.5);
      angleOff.set(a.i, clampNum((angleOff.get(a.i) ?? 0) - step, -TIER_PIE_LABEL_MAX_ANGLE_OFF, TIER_PIE_LABEL_MAX_ANGLE_OFF));
      angleOff.set(b.i, clampNum((angleOff.get(b.i) ?? 0) + step, -TIER_PIE_LABEL_MAX_ANGLE_OFF, TIER_PIE_LABEL_MAX_ANGLE_OFF));
      changed = true;
    }
    if (!changed) break;
  }

  for (let pass = 0; pass < 36; pass++) {
    const ord = [...cands].sort((a, b) => lab(a) - lab(b));
    let changed = false;
    for (let k = 0; k < n; k++) {
      const a = ord[k];
      const b = ord[(k + 1) % n];
      const la = lab(a);
      const lb = lab(b) + (k === n - 1 ? 360 : 0);
      const gap = lb - la;
      if (gap >= TIER_PIE_LABEL_MIN_SEP_DEG) continue;
      const deficit = TIER_PIE_LABEL_MIN_SEP_DEG - gap;
      const half = Math.min(deficit * 0.55, 9);
      tangentialDeg.set(
        a.i,
        clampNum((tangentialDeg.get(a.i) ?? 0) - half, -TIER_PIE_LABEL_MAX_TANGENT_DEG, TIER_PIE_LABEL_MAX_TANGENT_DEG)
      );
      tangentialDeg.set(
        b.i,
        clampNum((tangentialDeg.get(b.i) ?? 0) + half, -TIER_PIE_LABEL_MAX_TANGENT_DEG, TIER_PIE_LABEL_MAX_TANGENT_DEG)
      );
      changed = true;
    }
    if (!changed) break;
  }

  {
    const ord = [...cands].sort((a, b) => lab(a) - lab(b));
    let tightK = 0;
    let tightGap = Infinity;
    for (let k = 0; k < n; k++) {
      const la = lab(ord[k]);
      const lb = lab(ord[(k + 1) % n]) + (k === n - 1 ? 360 : 0);
      const g = lb - la;
      if (g < tightGap) {
        tightGap = g;
        tightK = k;
      }
    }
    if (tightGap < TIER_PIE_LABEL_TIGHT_PAIR_MIN_DEG) {
      const a = ord[tightK];
      const b = ord[(tightK + 1) % n];
      const push = (TIER_PIE_LABEL_TIGHT_PAIR_MIN_DEG - tightGap) * 0.45 + 12;
      tangentialDeg.set(
        a.i,
        clampNum((tangentialDeg.get(a.i) ?? 0) - push, -TIER_PIE_LABEL_MAX_TANGENT_DEG, TIER_PIE_LABEL_MAX_TANGENT_DEG)
      );
      tangentialDeg.set(
        b.i,
        clampNum((tangentialDeg.get(b.i) ?? 0) + push, -TIER_PIE_LABEL_MAX_TANGENT_DEG, TIER_PIE_LABEL_MAX_TANGENT_DEG)
      );
    }
  }

  const ord = [...cands].sort((a, b) => lab(a) - lab(b));
  let prev = -Infinity;
  let stack = 0;
  for (const item of ord) {
    const e = lab(item);
    if (e - prev < TIER_PIE_LABEL_MIN_SEP_DEG * 0.55) stack += 1;
    else stack = 0;
    prev = e;
    let boost = stack * TIER_PIE_LABEL_R_STACK;
    if (item.pct < 8) boost += TIER_PIE_LABEL_R_STACK * 0.55;
    radialBoost.set(item.i, boost);
  }
  if (n >= 2) {
    const wrapGap = lab(ord[0]) + 360 - lab(ord[n - 1]);
    if (wrapGap < TIER_PIE_LABEL_MIN_SEP_DEG * 0.55) {
      const victim = ord[0].i;
      radialBoost.set(victim, (radialBoost.get(victim) ?? 0) + TIER_PIE_LABEL_R_STACK);
      const victim2 = ord[n - 1].i;
      radialBoost.set(victim2, (radialBoost.get(victim2) ?? 0) + TIER_PIE_LABEL_R_STACK * 0.85);
    }
  }

  return { angleOff, tangentialDeg, radialBoost };
}

function mountDonutPieSliceLabelOverlay(pieEl: HTMLElement, slicePcts: number[], sliceSpecs: PieSliceSpec[]): void {
  clearDonutPieOverlays(pieEl);
  const mids = tradeTierPieSliceMidAnglesDeg(slicePcts, PIE_CONIC_GAP_DEG);
  const spans = tradeTierPieSliceSpanDeg(slicePcts, PIE_CONIC_GAP_DEG);
  const cx = 50;
  const cy = 50;
  const rEdge = TIER_PIE_R_OUTER;
  const rTextBase = 61;
  const lineEndInset = 5.2;

  const candidates: TierPieLabelCand[] = [];
  for (let i = 0; i < slicePcts.length; i++) {
    const pct = slicePcts[i];
    const mid = mids[i];
    if (pct <= 0 || mid == null || !Number.isFinite(mid)) continue;
    candidates.push({ mid, pct, i });
  }

  const inside = new Set<number>();
  for (const c of candidates) {
    if (tradeTierPieLabelFitsInside(spans[c.i], c.pct)) inside.add(c.i);
  }

  const outsideCands = candidates.filter((c) => !inside.has(c.i));
  const { angleOff, tangentialDeg, radialBoost } = computeTradeTierPieLabelLayout(outsideCands);

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'token-supply-pie__label-svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('overflow', 'visible');
  svg.setAttribute('aria-hidden', 'true');

  for (const { mid, pct, i } of candidates) {
    const color = pieSliceSpecToLabelHex(sliceSpecs[i] ?? '#38bdf8');

    if (inside.has(i)) {
      const rad = (mid * Math.PI) / 180;
      const tx = cx + TIER_PIE_R_LABEL_INSIDE * Math.sin(rad);
      const ty = cy - TIER_PIE_R_LABEL_INSIDE * Math.cos(rad);
      const { fill, onDarkSlice } = tradeTierPieLabelFillForSlice(color);
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute(
        'class',
        `token-supply-pie__label-text token-supply-pie__label-text--inside${onDarkSlice ? ' token-supply-pie__label-text--inside-on-dark' : ' token-supply-pie__label-text--inside-on-light'}`
      );
      text.setAttribute('x', tx.toFixed(2));
      text.setAttribute('y', ty.toFixed(2));
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('dominant-baseline', 'middle');
      text.setAttribute('fill', fill);
      text.textContent = `${pct.toFixed(2)}%`;
      svg.appendChild(text);
      continue;
    }

    const showMid = mid + (angleOff.get(i) ?? 0) + (tangentialDeg.get(i) ?? 0);
    const rText = rTextBase + (radialBoost.get(i) ?? 0);
    const radRim = (mid * Math.PI) / 180;
    const radLbl = (showMid * Math.PI) / 180;
    const sx = cx + rEdge * Math.sin(radRim);
    const sy = cy - rEdge * Math.cos(radRim);
    const tx = cx + rText * Math.sin(radLbl);
    const ty = cy - rText * Math.cos(radLbl);
    const lx = cx + (rText - lineEndInset) * Math.sin(radLbl);
    const ly = cy - (rText - lineEndInset) * Math.cos(radLbl);

    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('class', 'token-supply-pie__label-line');
    line.setAttribute('x1', sx.toFixed(2));
    line.setAttribute('y1', sy.toFixed(2));
    line.setAttribute('x2', lx.toFixed(2));
    line.setAttribute('y2', ly.toFixed(2));
    svg.appendChild(line);

    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('class', 'token-supply-pie__label-text');
    text.setAttribute('x', tx.toFixed(2));
    text.setAttribute('y', ty.toFixed(2));
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dominant-baseline', 'middle');
    text.textContent = `${pct.toFixed(2)}%`;
    svg.appendChild(text);
  }

  if (svg.childNodes.length > 0) pieEl.appendChild(svg);
}

function mountDonutPieOverlays(
  pieEl: HTMLElement,
  slicePcts: number[],
  sliceSpecs: PieSliceSpec[],
  hub: { mock: boolean; hubSubline: string }
): void {
  mountDonutPieSliceLabelOverlay(pieEl, slicePcts, sliceSpecs);
  mountDonutPieCenterHub(pieEl, hub);
}

function renderCharts(token: TokenData | null, holdersData: { data?: HolderRow[] }, topFetched: number): void {
  const rows = holdersData.data ?? [];
  tokenSupplyPanel.hidden = false;
  const tokenSymbol = (token?.symbol ?? '').toUpperCase();
  const currentSupply = Math.max(toFiniteNumber(token?.currentSupply ?? null), 0);
  const marketCap = Math.max(toFiniteNumber(token?.marketCap ?? null), 0);

  const cohort = rows.slice(0, Math.min(rows.length, topFetched));
  const circDen = currentSupply > 0 ? formatNum(currentSupply) : '—';

  const topN = rows.slice(0, topFetched).reduce((acc, row) => acc + toFiniteNumber(row.percentageOfSupplyHeld ?? null), 0);
  const top100 = rows.slice(0, 100).reduce((acc, row) => acc + toFiniteNumber(row.percentageOfSupplyHeld ?? null), 0);
  const top10 = rows.slice(0, 10).reduce((acc, row) => acc + toFiniteNumber(row.percentageOfSupplyHeld ?? null), 0);
  const topNBalance = rows.slice(0, topFetched).reduce((acc, row) => acc + toFiniteNumber(row.balance ?? null), 0);
  const top100Balance = rows.slice(0, 100).reduce((acc, row) => acc + toFiniteNumber(row.balance ?? null), 0);
  const top10Balance = rows.slice(0, 10).reduce((acc, row) => acc + toFiniteNumber(row.balance ?? null), 0);
  const topNUsd = rows.slice(0, topFetched).reduce((acc, row) => acc + toFiniteNumber(row.valueUsd ?? null), 0);
  const top100Usd = rows.slice(0, 100).reduce((acc, row) => acc + toFiniteNumber(row.valueUsd ?? null), 0);
  const top10Usd = rows.slice(0, 10).reduce((acc, row) => acc + toFiniteNumber(row.valueUsd ?? null), 0);
  const top10Slice = Math.max(0, Math.min(100, top10));
  const top11to100Slice = Math.max(0, Math.min(100, Math.min(top100, topN) - top10Slice));
  const showTop101Bucket = topFetched >= 250;
  const top101toNSlice = showTop101Bucket
    ? Math.max(0, Math.min(100, topN - Math.min(top100, topN)))
    : 0;
  const top11to100Balance = Math.max(0, top100Balance - top10Balance);
  const top101toNBalance = Math.max(0, topNBalance - top100Balance);
  const remainingBalance = Math.max(currentSupply - topNBalance, 0);
  const top11to100Usd = Math.max(0, top100Usd - top10Usd);
  const top101toNUsd = Math.max(0, topNUsd - top100Usd);
  const remainingUsd = Math.max(marketCap - topNUsd, 0);
  const remainingSupplySlice = Math.max(0, 100 - (top10Slice + top11to100Slice + top101toNSlice));
  const [displayTop10, displayTop11to100, displayTop101toN, displayRemaining] = applyMinVisibleSlices(
    [top10Slice, top11to100Slice, top101toNSlice, remainingSupplySlice]
  );
  tokenSupplyPie.style.background = buildPieGradientWithGaps(
    [displayTop10, displayTop11to100, displayTop101toN, displayRemaining],
    ['#3b82f6', '#2563eb', '#1d4ed8', '#27272a']
  );
  mountDonutPieOverlays(
    tokenSupplyPie,
    [displayTop10, displayTop11to100, displayTop101toN, displayRemaining],
    ['#3b82f6', '#2563eb', '#1d4ed8', '#27272a'],
    {
      mock: false,
      hubSubline: `${formatPctSmart(topN)} supply · top ${topFetched.toLocaleString()} wallets`,
    }
  );

  const w10 = Math.min(10, cohort.length).toLocaleString();
  const w11_100 = cohort.length > 10 ? Math.min(90, cohort.length - 10).toLocaleString() : '0';
  const w101_n =
    showTop101Bucket && cohort.length > 100 ? (cohort.length - 100).toLocaleString() : showTop101Bucket ? '0' : '—';

  setSupplyLegendGrid(tokenSupplyLegend, showTop101Bucket ? 4 : 3);
  tokenSupplyLegend.innerHTML = `
    ${renderHolderSupplyTierCard({
      title: 'Top 10 wallets',
      accent: '#3b82f6',
      swatchColor: '#3b82f6',
      slicePct: top10Slice,
      balanceLine: formatBalance(top10Balance, tokenSymbol),
      usdLine: formatUsdHolderValue(top10Usd),
      walletsLine: w10,
      circNum: formatNum(top10Balance),
      circDen,
    })}
    ${renderHolderSupplyTierCard({
      title: 'Top 11–100 wallets',
      accent: '#2563eb',
      swatchColor: '#2563eb',
      slicePct: top11to100Slice,
      balanceLine: formatBalance(top11to100Balance, tokenSymbol),
      usdLine: formatUsdHolderValue(top11to100Usd),
      walletsLine: w11_100,
      circNum: formatNum(top11to100Balance),
      circDen,
    })}
    ${
      showTop101Bucket
        ? renderHolderSupplyTierCard({
            title: `Top 101–${topFetched.toLocaleString()} wallets`,
            accent: '#1d4ed8',
            swatchColor: '#1d4ed8',
            slicePct: top101toNSlice,
            balanceLine: formatBalance(top101toNBalance, tokenSymbol),
            usdLine: formatUsdHolderValue(top101toNUsd),
            walletsLine: w101_n,
            circNum: formatNum(top101toNBalance),
            circDen,
          })
        : ''
    }
    ${renderHolderSupplyTierCard({
      title: 'Remaining supply',
      accent: '#52525b',
      swatchColor: '#27272a',
      slicePct: remainingSupplySlice,
      balanceLine: formatBalance(remainingBalance, tokenSymbol),
      usdLine: formatUsdHolderValue(remainingUsd),
      walletsLine: '—',
      circNum: formatNum(remainingBalance),
      circDen,
    })}
  `;

  const labeledPct = rows
    .slice(0, topFetched)
    .reduce((acc, row) => acc + (isLabeledHolder(row) ? toFiniteNumber(row.percentageOfSupplyHeld ?? null) : 0), 0);
  const labeledBalance = rows
    .slice(0, topFetched)
    .reduce((acc, row) => acc + (isLabeledHolder(row) ? toFiniteNumber(row.balance ?? null) : 0), 0);
  const labeledUsd = rows
    .slice(0, topFetched)
    .reduce((acc, row) => acc + (isLabeledHolder(row) ? toFiniteNumber(row.valueUsd ?? null) : 0), 0);
  const unlabeledTopNBalance = Math.max(0, topNBalance - labeledBalance);
  const unlabeledTopNUsd = Math.max(0, topNUsd - labeledUsd);
  const nonTopBalance = Math.max(currentSupply - topNBalance, 0);
  const nonTopUsd = Math.max(marketCap - topNUsd, 0);
  const labeledSlice = Math.max(0, Math.min(100, labeledPct));
  const unlabeledTopNSlice = Math.max(0, Math.min(100, topN - labeledSlice));
  const nonTopNSlice = Math.max(0, 100 - (labeledSlice + unlabeledTopNSlice));
  const [displayLabeled, displayUnlabeledTopN, displayNonTop] = applyMinVisibleSlices(
    [labeledSlice, unlabeledTopNSlice, nonTopNSlice]
  );
  tokenLabelSupplyPie.style.background = buildPieGradientWithGaps(
    [displayLabeled, displayUnlabeledTopN, displayNonTop],
    ['#3b82f6', '#1d4ed8', '#27272a']
  );
  mountDonutPieOverlays(
    tokenLabelSupplyPie,
    [displayLabeled, displayUnlabeledTopN, displayNonTop],
    ['#3b82f6', '#1d4ed8', '#27272a'],
    {
      mock: false,
      hubSubline: `Labeled vs unlabeled · top ${topFetched.toLocaleString()} fetched`,
    }
  );

  const labeledInCohort = cohort.filter(isLabeledHolder).length;
  const nLab = labeledInCohort.toLocaleString();
  const nUnl = Math.max(0, cohort.length - labeledInCohort).toLocaleString();

  setSupplyLegendGrid(tokenLabelSupplyLegend, 3);
  tokenLabelSupplyLegend.innerHTML = `
    ${renderHolderSupplyTierCard({
      title: `Labeled top ${topFetched.toLocaleString()} supply`,
      accent: '#3b82f6',
      swatchColor: '#3b82f6',
      slicePct: labeledSlice,
      balanceLine: formatBalance(labeledBalance, tokenSymbol),
      usdLine: formatUsdHolderValue(labeledUsd),
      walletsLine: nLab,
      circNum: formatNum(labeledBalance),
      circDen,
    })}
    ${renderHolderSupplyTierCard({
      title: `Unlabeled top ${topFetched.toLocaleString()} supply`,
      accent: '#1d4ed8',
      swatchColor: '#1d4ed8',
      slicePct: unlabeledTopNSlice,
      balanceLine: formatBalance(unlabeledTopNBalance, tokenSymbol),
      usdLine: formatUsdHolderValue(unlabeledTopNUsd),
      walletsLine: nUnl,
      circNum: formatNum(unlabeledTopNBalance),
      circDen,
    })}
    ${renderHolderSupplyTierCard({
      title: `Non-top ${topFetched.toLocaleString()} supply`,
      accent: '#52525b',
      swatchColor: '#27272a',
      slicePct: nonTopNSlice,
      balanceLine: formatBalance(nonTopBalance, tokenSymbol),
      usdLine: formatUsdHolderValue(nonTopUsd),
      walletsLine: '—',
      circNum: formatNum(nonTopBalance),
      circDen,
    })}
  `;

  const wt = aggregateWhaleTiers(rows, topFetched);
  const outsidePct = Math.max(0, 100 - topN);
  const [dW0, dW1, dW2, dW3, dOut] = applyMinVisibleSlices([
    wt[0].pct,
    wt[1].pct,
    wt[2].pct,
    wt[3].pct,
    outsidePct,
  ]);
  holdersWhaleTierPie.style.background = buildPieGradientWithGaps(
    [dW0, dW1, dW2, dW3, dOut],
    ['#22c55e', '#2563eb', '#a855f7', '#f97316', '#27272a']
  );
  mountDonutPieOverlays(
    holdersWhaleTierPie,
    [dW0, dW1, dW2, dW3, dOut],
    ['#22c55e', '#2563eb', '#a855f7', '#f97316', '#27272a'],
    {
      mock: false,
      hubSubline: `Whale tiers · ${formatPctSmart(topN)} in top ${topFetched.toLocaleString()}`,
    }
  );
  const outsideTopTitle = `Outside top ${topFetched.toLocaleString()}`;
  const whaleTitles = ['Mega (≥1%)', 'Whale (0.1–1%)', 'Shark (0.01–0.1%)', 'Fish (<0.01%)', outsideTopTitle];
  const whaleAccents = ['#22c55e', '#2563eb', '#a855f7', '#f97316', '#52525b'];
  const whaleSwatches = ['#22c55e', '#2563eb', '#a855f7', '#f97316', '#27272a'];
  setSupplyLegendGrid(holdersWhaleTierLegend, 3);
  holdersWhaleTierLegend.innerHTML = [0, 1, 2, 3].map((i) =>
    renderHolderSupplyTierCard({
      title: whaleTitles[i]!,
      accent: whaleAccents[i]!,
      swatchColor: whaleSwatches[i]!,
      slicePct: wt[i].pct,
      balanceLine: formatBalance(wt[i].balance, tokenSymbol),
      usdLine: formatUsdHolderValue(wt[i].usd),
      walletsLine: wt[i].wallets.toLocaleString(),
      circNum: formatNum(wt[i].balance),
      circDen,
    })
  ).join('') + renderHolderSupplyTierCard({
    title: outsideTopTitle,
    accent: whaleAccents[4]!,
    swatchColor: whaleSwatches[4]!,
    slicePct: outsidePct,
    balanceLine: formatBalance(remainingBalance, tokenSymbol),
    usdLine: formatUsdHolderValue(remainingUsd),
    walletsLine: '—',
    circNum: formatNum(remainingBalance),
    circDen,
  });

  renderHoldersPctSupplyBars(rows, topFetched);
  renderConcentrationAndGini(rows, topFetched);
  renderUsdValueBarsChart(rows, topFetched);
  renderTopLabelsBarsChart(rows, topFetched);
}

const tokenSectionIcons: Record<string, string> = {
  overview:
    '<svg class="section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/></svg>',
  price:
    '<svg class="section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
  supply:
    '<svg class="section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>',
  meta:
    '<svg class="section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>',
};

interface SectionSpec {
  icon: string;
  title: string;
  theme: 'overview' | 'price' | 'supply' | 'meta';
  rows: [string, string | number | undefined][];
}

let holdersLoadedSuccessfully = false;

function tokenStatsSectionHtml(s: SectionSpec): string {
  return `<section class="token-stats-group token-stats-group--${s.theme}">
      <h3 class="token-stats-group-title">${s.icon}<span>${s.title}</span></h3>
      <dl class="token-stats">${s.rows.map(([label, value]) => `<dt>${label}</dt><dd>${value ?? '—'}</dd>`).join('')}</dl>
    </section>`;
}

function renderTokenPlaceholder(): void {
  tokenLogo.src = '';
  tokenLogo.alt = '';
  tokenLogo.style.display = 'none';
  tokenSymbol.textContent = '—';
  tokenName.textContent = '—';
  const d = '—';
  const overview: SectionSpec = {
    icon: tokenSectionIcons.overview,
    title: 'Overview',
    theme: 'overview',
    rows: [
      ['Mint', `<span class="mono">${d}</span>`],
      ['Decimals', d],
      ['Category', d],
      ['Verified', d],
    ],
  };
  const priceSection: SectionSpec = {
    icon: tokenSectionIcons.price,
    title: 'Price & market cap',
    theme: 'price',
    rows: [
      ['Price (USD)', d],
      ['Market cap', d],
      ['Price (1d ago)', d],
      ['Price (7d ago)', d],
    ],
  };
  const supplyVolumeSection: SectionSpec = {
    icon: tokenSectionIcons.supply,
    title: 'Supply & volume (24h)',
    theme: 'supply',
    rows: [
      ['Current supply', d],
      ['Token volume (24h)', d],
      ['USD volume (24h)', d],
    ],
  };
  const metaSection: SectionSpec = {
    icon: tokenSectionIcons.meta,
    title: 'Last updated',
    theme: 'meta',
    rows: [['Update time', d]],
  };
  tokenStats.innerHTML =
    tokenStatsSectionHtml(overview) +
    `<div class="token-stats-row"><div class="token-stats-col">${tokenStatsSectionHtml(priceSection)}</div><div class="token-stats-col">${tokenStatsSectionHtml(supplyVolumeSection)}</div></div>` +
    tokenStatsSectionHtml(metaSection);
}

function renderHoldersPlaceholder(): void {
  holdersTitle.textContent = '—';
  holdersMeta.textContent = '—';
  holdersBody.innerHTML = buildHoldersPlaceholderRowsHtml();
}

function showSectionError(el: HTMLElement, msg: string): void {
  el.textContent = msg;
  el.hidden = false;
  el.removeAttribute('aria-hidden');
}

function hideSectionError(el: HTMLElement): void {
  el.textContent = '';
  el.hidden = true;
  el.setAttribute('aria-hidden', 'true');
}

async function fetchWithRetry(url: string): Promise<Response> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= MAX_FETCH_RETRIES; attempt++) {
    try {
      const res = await fetch(url);
      if ([502, 503, 504].includes(res.status)) throw new Error(`HTTP ${res.status}`);
      return res;
    } catch (err) {
      lastErr = err;
      if (attempt < MAX_FETCH_RETRIES) await new Promise((r) => setTimeout(r, FETCH_RETRY_DELAY_MS));
    }
  }
  throw lastErr;
}

function renderToken(t: TokenData): void {
  tokenLogo.src = t.logoUrl || '';
  tokenLogo.alt = t.symbol || '';
  tokenLogo.style.display = t.logoUrl ? 'block' : 'none';
  tokenSymbol.textContent = t.symbol || '—';
  tokenName.textContent = t.name || t.mintAddress || '—';

  const sym = (t.symbol || '').toUpperCase();
  const formatUpdateTime = (ts: number | undefined): string => {
    if (ts == null) return '—';
    const d = new Date(ts * 1000);
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const mintLink = t.mintAddress
    ? `<a href="https://vybe.fyi/tokens/${encodeURIComponent(t.mintAddress)}" target="_blank" rel="noopener noreferrer" class="mono" title="${t.mintAddress}">${t.mintAddress}</a>`
    : '—';
  const overview: SectionSpec = {
    icon: tokenSectionIcons.overview,
    title: 'Overview',
    theme: 'overview',
    rows: [
      ['Mint', mintLink],
      ['Decimals', t.decimal ?? t.decimals],
      ['Category', formatCategoryOverviewValueHtml(t.category, t.subcategory)],
      ['Verified', t.verified != null ? String(t.verified) : '—'],
    ],
  };
  const priceSection: SectionSpec = {
    icon: tokenSectionIcons.price,
    title: 'Price & market cap',
    theme: 'price',
    rows: [
      ['Price (USD)', t.price != null ? `${formatPrice(t.price)} USD` : '—'],
      ['Market cap', t.marketCap != null ? `${formatNum(t.marketCap)} USD` : '—'],
      [
        'Price (1d ago)',
        t.price1d != null
          ? `${formatPrice(t.price1d)}${formatHistoricalPricePctVsSpotHtml(t.price, t.price1d)}`
          : '—',
      ],
      [
        'Price (7d ago)',
        t.price7d != null
          ? `${formatPrice(t.price7d)}${formatHistoricalPricePctVsSpotHtml(t.price, t.price7d)}`
          : '—',
      ],
    ],
  };
  const supplyVolumeSection: SectionSpec = {
    icon: tokenSectionIcons.supply,
    title: 'Supply & volume (24h)',
    theme: 'supply',
    rows: [
      ['Current supply', t.currentSupply != null ? `${formatNum(t.currentSupply)}${sym ? ` ${sym}` : ''}` : '—'],
      ['Token volume (24h)', t.tokenAmountVolume24h != null ? `${formatNum(t.tokenAmountVolume24h)}${sym ? ` ${sym}` : ''}` : '—'],
      ['USD volume (24h)', t.usdValueVolume24h != null ? `${formatNum(t.usdValueVolume24h)} USD` : '—'],
    ],
  };
  const metaSection: SectionSpec = {
    icon: tokenSectionIcons.meta,
    title: 'Last updated',
    theme: 'meta',
    rows: [['Update time', formatUpdateTime(t.updateTime)]],
  };

  tokenStats.innerHTML =
    tokenStatsSectionHtml(overview) +
    `<div class="token-stats-row"><div class="token-stats-col">${tokenStatsSectionHtml(priceSection)}</div><div class="token-stats-col">${tokenStatsSectionHtml(supplyVolumeSection)}</div></div>` +
    tokenStatsSectionHtml(metaSection);
}

function getSortSummary(sortByAsc: string, sortByDesc: string): { field: string; direction: 'asc' | 'desc' } {
  if (sortByAsc) return { field: sortByAsc, direction: 'asc' };
  if (sortByDesc) return { field: sortByDesc, direction: 'desc' };
  return { field: 'percentageOfSupplyHeld', direction: 'desc' };
}

function renderHolders(
  data: { data?: HolderRow[] },
  limit: number,
  page: number,
  sortByAsc: string,
  sortByDesc: string
): void {
  const list = data.data || [];
  const topN = (page + 1) * limit;
  const sort = getSortSummary(sortByAsc, sortByDesc);
  holdersTitle.textContent = `Top ${topN.toLocaleString()} holders (by ${sort.field} ${sort.direction})`;
  holdersMeta.textContent = list.length
    ? `Top ${topN.toLocaleString()} holders sorted by ${sort.field} ${sort.direction} (${list.length.toLocaleString()} shown; updated every 3 hours).`
    : '—';
  const rawSym = tokenSymbol?.textContent ? tokenSymbol.textContent.trim().toUpperCase() : '';
  holdersBody.innerHTML = list.length
    ? list.map((h) => {
          const ownerDisplay = h.ownerName || (h.ownerAddress ? truncateAddress(h.ownerAddress) : '—');
          const ownerLink = h.ownerAddress
        ? `<a href="https://vybe.fyi/wallets/${encodeURIComponent(h.ownerAddress)}" target="_blank" rel="noopener noreferrer" class="mono" title="${h.ownerAddress}">${ownerDisplay}</a>`
            : `<span class="mono">${ownerDisplay}</span>`;
          return `<tr>
        <td>${h.rank ?? '—'}</td>
        <td>${ownerLink}</td>
        <td>${formatBalance(h.balance ?? null, rawSym)}</td>
        <td class="holders-value-usd">${formatUsdHolderValue(h.valueUsd ?? null)}</td>
        <td style="text-align:right">${formatSupplyPercent(h.percentageOfSupplyHeld)}</td>
      </tr>`;
    }).join('')
    : buildHoldersPlaceholderRowsHtml();
}

function syncHoldersCopyWithFilters(limit: number, page: number, sortByAsc: string, sortByDesc: string): void {
  const topN = (page + 1) * limit;
  const sort = getSortSummary(sortByAsc, sortByDesc);
  holdersTitle.textContent = `Top ${topN.toLocaleString()} holders (by ${sort.field} ${sort.direction})`;
  holdersMeta.textContent = `Top ${topN.toLocaleString()} holders sorted by ${sort.field} ${sort.direction} (updated every 3 hours).`;
}

function syncHoldersCopyFromInputs(): void {
  if (!holdersLoadedSuccessfully) {
    holdersTitle.textContent = '—';
  holdersMeta.textContent = '—';
    return;
  }
  const limitRaw = Number(limitSelect.value);
  const limit = Number.isFinite(limitRaw) && limitRaw >= 0 ? Math.floor(limitRaw) : 1000;
  const pageRaw = Number(pageInput.value);
  const page = Number.isFinite(pageRaw) && pageRaw >= 0 ? Math.floor(pageRaw) : 0;
  const sortByAsc = sortByAscSelect.value.trim();
  const sortByDesc = sortByDescSelect.value.trim();
  syncHoldersCopyWithFilters(limit, page, sortByAsc, sortByDesc);
}

function applySortLockState(): void {
  const sortByAsc = sortByAscSelect.value.trim();
  const sortByDesc = sortByDescSelect.value.trim();
  if (sortByDesc) {
    sortByAscSelect.value = '';
    sortByAscSelect.disabled = true;
    sortByDescSelect.disabled = false;
    return;
  }
  if (sortByAsc) {
    sortByDescSelect.value = '';
    sortByDescSelect.disabled = true;
    sortByAscSelect.disabled = false;
    return;
  }
  sortByAscSelect.disabled = false;
  sortByDescSelect.disabled = false;
}

async function loadData(): Promise<void> {
  const mint = mintInput.value.trim();
  if (!mint) return;

  const pageRaw = Number(pageInput.value);
  const page = Number.isFinite(pageRaw) && pageRaw >= 0 ? Math.floor(pageRaw) : 0;
  const limitRaw = Number(limitSelect.value);
  const limit = Number.isFinite(limitRaw) && limitRaw >= 0 ? Math.floor(limitRaw) : 1000;
  const sortByAsc = sortByAscSelect.value.trim();
  const sortByDesc = sortByDescSelect.value.trim();

  holdersLoadedSuccessfully = false;
  renderTokenPlaceholder();
  renderHoldersPlaceholder();
  setChartsPlaceholder();

  hideSectionError(tokenSectionError);
  hideSectionError(holdersError);
  fetchAllBtn.disabled = true;
  loadingIndicator.hidden = false;
  tokenSectionLoading.hidden = false;
  holdersLoading.hidden = false;

  try {
    let tokenData: TokenData | null = null;
    const tokenRes = await fetchWithRetry(`/api/tokens/${encodeURIComponent(mint)}`);
    if (tokenRes.ok) {
      tokenData = await tokenRes.json() as TokenData;
      renderToken(tokenData);
    }
    else showSectionError(tokenSectionError, `Failed (${tokenRes.status})`);
    const holdersParams = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    });
    if (sortByAsc) {
      holdersParams.set('sortByAsc', sortByAsc);
    } else if (sortByDesc) {
      holdersParams.set('sortByDesc', sortByDesc);
    }

    const holdersRes = await fetchWithRetry(`/api/tokens/${encodeURIComponent(mint)}/top-holders?${holdersParams.toString()}`);
    if (holdersRes.ok) {
      const holdersData = await holdersRes.json() as { data?: HolderRow[] };
      renderHolders(
        holdersData,
        limit,
        page,
        sortByAsc,
        sortByDesc
      );
      holdersLoadedSuccessfully = true;
      renderCharts(tokenData, holdersData, (page + 1) * limit);
    }
    else showSectionError(holdersError, `Failed (${holdersRes.status})`);
  } catch {
    showSectionError(holdersError, 'Failed');
    holdersLoadedSuccessfully = false;
    renderTokenPlaceholder();
    renderHoldersPlaceholder();
    setChartsPlaceholder();
  } finally {
    fetchAllBtn.disabled = false;
    loadingIndicator.hidden = true;
    tokenSectionLoading.hidden = true;
    holdersLoading.hidden = true;
  }
}

fetchAllBtn.addEventListener('click', () => {
  void loadData();
});

sortByAscSelect.addEventListener('change', () => {
  if (sortByAscSelect.value.trim() !== '') sortByDescSelect.value = '';
  applySortLockState();
  syncHoldersCopyFromInputs();
});

sortByDescSelect.addEventListener('change', () => {
  if (sortByDescSelect.value.trim() !== '') sortByAscSelect.value = '';
  applySortLockState();
  syncHoldersCopyFromInputs();
});

limitSelect.addEventListener('change', () => {
  syncHoldersCopyFromInputs();
  if (!holdersLoadedSuccessfully) setChartsPlaceholder();
});

applySortLockState();
holdersLoadedSuccessfully = false;
renderTokenPlaceholder();
renderHoldersPlaceholder();
setChartsPlaceholder();
syncHoldersCopyFromInputs();

pageInput.addEventListener('input', () => {
  syncHoldersCopyFromInputs();
  if (!holdersLoadedSuccessfully) setChartsPlaceholder();
});
