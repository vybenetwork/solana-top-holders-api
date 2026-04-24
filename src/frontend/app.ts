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
  balance?: number | string;
  valueUsd?: number;
  percentageOfSupplyHeld?: number;
}

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
const holdersLoading = document.getElementById('holdersLoading') as HTMLElement;
const holdersError = document.getElementById('holdersError') as HTMLElement;
const holdersTitle = document.getElementById('holdersTitle') as HTMLElement;
const holdersMeta = document.getElementById('holdersMeta') as HTMLElement;
const holdersBody = document.getElementById('holdersBody') as HTMLElement;
const MAX_FETCH_RETRIES = 5;
const FETCH_RETRY_DELAY_MS = 2000;

function truncateAddress(addr: string | undefined): string {
  if (!addr || addr.length <= 12) return addr ?? '';
  return `${addr.slice(0, 4)}....${addr.slice(-4)}`;
}

function formatNum(n: number | string | null | undefined): string {
  if (n == null) return '—';
  if (typeof n === 'number') {
    if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(2) + 'K';
    return n.toFixed(4);
  }
  return String(n);
}

function formatBalance(n: number | string | null | undefined, symbol: string): string {
  if (n == null || n === '') return '—';
  const num = Number(n);
  if (Number.isNaN(num)) return '—';
  const sym = symbol && String(symbol).trim() ? ` ${String(symbol).trim()}` : '';
  if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B${sym}`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M${sym}`;
  if (num >= 10) return `${Math.round(num).toLocaleString()}${sym}`;
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
  rows: [string, string | number | undefined][];
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

  const sectionHtml = (s: SectionSpec): string => `<section class="token-stats-group">
      <h3 class="token-stats-group-title">${s.icon}<span>${s.title}</span></h3>
      <dl class="token-stats">${s.rows.map(([label, value]) => `<dt>${label}</dt><dd>${value ?? '—'}</dd>`).join('')}</dl>
    </section>`;

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
    rows: [
      ['Mint', mintLink],
      ['Symbol', sym || '—'],
      ['Decimals', t.decimal ?? t.decimals],
      ['Category', t.category ?? '—'],
      ['Subcategory', t.subcategory ?? '—'],
      ['Verified', t.verified != null ? String(t.verified) : '—'],
    ],
  };
  const priceSection: SectionSpec = {
    icon: tokenSectionIcons.price,
    title: 'Price & market cap',
    rows: [
      ['Price (USD)', t.price != null ? `${formatPrice(t.price)} USD` : '—'],
      ['Market cap', t.marketCap != null ? `${formatNum(t.marketCap)} USD` : '—'],
      ['Price (1d ago)', t.price1d != null ? formatPrice(t.price1d) : '—'],
      ['Price (7d ago)', t.price7d != null ? formatPrice(t.price7d) : '—'],
    ],
  };
  const supplyVolumeSection: SectionSpec = {
    icon: tokenSectionIcons.supply,
    title: 'Supply & volume (24h)',
    rows: [
      ['Current supply', t.currentSupply != null ? `${formatNum(t.currentSupply)}${sym ? ` ${sym}` : ''}` : '—'],
      ['Token volume (24h)', t.tokenAmountVolume24h != null ? `${formatNum(t.tokenAmountVolume24h)}${sym ? ` ${sym}` : ''}` : '—'],
      ['USD volume (24h)', t.usdValueVolume24h != null ? `${formatNum(t.usdValueVolume24h)} USD` : '—'],
    ],
  };
  const metaSection: SectionSpec = {
    icon: tokenSectionIcons.meta,
    title: 'Last updated',
    rows: [['Update time', formatUpdateTime(t.updateTime)]],
  };

  tokenStats.innerHTML =
    sectionHtml(overview) +
    `<div class="token-stats-row"><div class="token-stats-col">${sectionHtml(priceSection)}</div><div class="token-stats-col">${sectionHtml(supplyVolumeSection)}</div></div>` +
    sectionHtml(metaSection);
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
    : '<tr><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td></tr>';
}

function syncHoldersCopyWithFilters(limit: number, page: number, sortByAsc: string, sortByDesc: string): void {
  const topN = (page + 1) * limit;
  const sort = getSortSummary(sortByAsc, sortByDesc);
  holdersTitle.textContent = `Top ${topN.toLocaleString()} holders (by ${sort.field} ${sort.direction})`;
  holdersMeta.textContent = `Top ${topN.toLocaleString()} holders sorted by ${sort.field} ${sort.direction} (updated every 3 hours).`;
}

function syncHoldersCopyFromInputs(): void {
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
  syncHoldersCopyWithFilters(limit, page, sortByAsc, sortByDesc);

  hideSectionError(tokenSectionError);
  hideSectionError(holdersError);
  fetchAllBtn.disabled = true;
  loadingIndicator.hidden = false;
  tokenSectionLoading.hidden = false;
  holdersLoading.hidden = false;

  try {
    const tokenRes = await fetchWithRetry(`/api/tokens/${encodeURIComponent(mint)}`);
    if (tokenRes.ok) renderToken(await tokenRes.json() as TokenData);
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
      renderHolders(
        await holdersRes.json() as { data?: HolderRow[] },
        limit,
        page,
        sortByAsc,
        sortByDesc
      );
    }
    else showSectionError(holdersError, `Failed (${holdersRes.status})`);
  } catch {
    showSectionError(holdersError, 'Failed');
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
});

applySortLockState();
syncHoldersCopyFromInputs();

pageInput.addEventListener('input', () => {
  syncHoldersCopyFromInputs();
});
