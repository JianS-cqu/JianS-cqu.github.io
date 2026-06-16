(() => {
  const DATA = window.CRBM_DATA;

  if (!DATA) {
    document.body.innerHTML =
      '<main class="empty-state">数据文件未加载，请确认 assets/data.js 是否存在。</main>';
    return;
  }

  const palette = [
    "#31f2ae",
    "#2ed8d4",
    "#f6b756",
    "#8be28d",
    "#ff8b6a",
    "#a6e36a",
    "#58e1b6",
    "#ffd36f",
    "#72d5ff",
    "#ff7168",
  ];

  const productNames = Object.keys(DATA.products);
  const defaultCategory = DATA.categories.find((item) => item.name === "水泥") || DATA.categories[0];
  const defaultProduct = defaultCategory.products.includes("硫铝酸盐水泥")
    ? "硫铝酸盐水泥"
    : defaultCategory.products[0];

  const state = {
    category: defaultCategory.name,
    product: defaultProduct,
    values: new Map(),
    processOrder: [],
  };

  const els = {
    heroProductCount: document.querySelector("#heroProductCount"),
    heroLinkCount: document.querySelector("#heroLinkCount"),
    heroProvinceCount: document.querySelector("#heroProvinceCount"),
    categorySelect: document.querySelector("#categorySelect"),
    productSelect: document.querySelector("#productSelect"),
    productSearch: document.querySelector("#productSearch"),
    productList: document.querySelector("#productList"),
    selectedProductTitle: document.querySelector("#selectedProductTitle"),
    selectedProductDesc: document.querySelector("#selectedProductDesc"),
    processInputs: document.querySelector("#processInputs"),
    resetProcessButton: document.querySelector("#resetProcessButton"),
    metricRecycled: document.querySelector("#metricRecycled"),
    metricTraditional: document.querySelector("#metricTraditional"),
    metricReduction: document.querySelector("#metricReduction"),
    metricProcessTotal: document.querySelector("#metricProcessTotal"),
    sankeyMeta: document.querySelector("#sankeyMeta"),
    sankeyChart: document.querySelector("#sankeyChart"),
    processTotalBadge: document.querySelector("#processTotalBadge"),
    processChart: document.querySelector("#processChart"),
    reductionDonut: document.querySelector("#reductionDonut"),
    compareBars: document.querySelector("#compareBars"),
    anomalyBadge: document.querySelector("#anomalyBadge"),
    anomalyRadar: document.querySelector("#anomalyRadar"),
    anomalyList: document.querySelector("#anomalyList"),
    provinceBadge: document.querySelector("#provinceBadge"),
    provinceSummary: document.querySelector("#provinceSummary"),
    provinceTable: document.querySelector("#provinceTable"),
    categoryStats: document.querySelector("#categoryStats"),
    topReduction: document.querySelector("#topReduction"),
  };

  function init() {
    els.heroProductCount.textContent = DATA.meta.productCount;
    els.heroLinkCount.textContent = DATA.meta.linkCount;
    els.heroProvinceCount.textContent = DATA.meta.provinceProductCount;

    els.categorySelect.innerHTML = DATA.categories
      .map((item) => `<option value="${escapeHtml(item.name)}">${escapeHtml(item.name)}</option>`)
      .join("");

    els.productList.innerHTML = productNames
      .map((name) => `<option value="${escapeHtml(name)}"></option>`)
      .join("");

    bindEvents();
    resetProcessValues();
    syncControls();
    renderAll();
  }

  function bindEvents() {
    els.categorySelect.addEventListener("change", () => {
      const category = DATA.categories.find((item) => item.name === els.categorySelect.value);
      if (!category) return;
      state.category = category.name;
      state.product = category.products[0];
      els.productSearch.value = "";
      resetProcessValues();
      syncControls();
      renderAll();
    });

    els.productSelect.addEventListener("change", () => {
      setProduct(els.productSelect.value);
    });

    els.productSearch.addEventListener("change", () => {
      const name = els.productSearch.value.trim();
      if (DATA.products[name]) setProduct(name);
    });

    els.productSearch.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      const query = els.productSearch.value.trim();
      const exact = DATA.products[query] ? query : productNames.find((name) => name.includes(query));
      if (exact) setProduct(exact);
    });

    els.resetProcessButton.addEventListener("click", () => {
      resetProcessValues();
      renderProcessInputs();
      renderCurrentCalculations();
    });

    els.processInputs.addEventListener("input", (event) => {
      const input = event.target.closest("input[data-index]");
      if (!input) return;
      const target = state.processOrder[Number(input.dataset.index)];
      const value = Math.max(0, Number(input.value) || 0);
      state.values.set(target, value);
      renderCurrentCalculations();
    });
  }

  function setProduct(name) {
    const product = DATA.products[name];
    if (!product) return;
    state.category = product.type;
    state.product = name;
    resetProcessValues();
    syncControls();
    renderAll();
  }

  function syncControls() {
    els.categorySelect.value = state.category;
    const category = DATA.categories.find((item) => item.name === state.category);
    els.productSelect.innerHTML = (category?.products || [])
      .map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`)
      .join("");
    els.productSelect.value = state.product;
  }

  function getProduct() {
    return DATA.products[state.product];
  }

  function resetProcessValues() {
    const product = getProduct();
    state.values = new Map();
    state.processOrder = product.processes.map((item) => item.target);
    product.processes.forEach((item) => {
      state.values.set(item.target, item.value);
    });
  }

  function renderAll() {
    renderProductIntro();
    renderProcessInputs();
    renderSankey();
    renderCompare();
    renderProvince();
    renderPortfolio();
    renderCurrentCalculations();
  }

  function renderCurrentCalculations() {
    renderMetrics();
    renderProcessChart();
    renderAnomaly();
  }

  function renderProductIntro() {
    const product = getProduct();
    els.selectedProductTitle.textContent = product.name;
    els.selectedProductDesc.textContent = `${product.type} · ${product.processes.length} 个工艺过程 · ${product.links.length} 条物料/过程链路`;
  }

  function renderMetrics() {
    const product = getProduct();
    const compare = product.compare;
    const processTotal = getCurrentProcessRows().reduce((sum, item) => sum + item.value, 0);

    els.metricRecycled.textContent = formatNumber(compare.recycled);
    els.metricTraditional.textContent = formatNumber(compare.traditional);
    els.metricReduction.textContent = `${formatNumber(compare.reductionRate)}%`;
    els.metricProcessTotal.textContent = formatNumber(processTotal);
    els.processTotalBadge.textContent = `${formatNumber(processTotal)} kgCO2e/t`;
  }

  function renderProcessInputs() {
    const product = getProduct();
    if (!product.processes.length) {
      els.processInputs.innerHTML = '<div class="empty-state">该产品暂无过程参数。</div>';
      return;
    }

    els.processInputs.innerHTML = product.processes
      .map((item, index) => {
        const value = state.values.get(item.target) ?? item.value;
        return `
          <div class="process-row">
            <label for="process-${index}">${escapeHtml(item.target)}</label>
            <input id="process-${index}" data-index="${index}" type="number" min="0" step="0.01" value="${formatInput(value)}" aria-label="${escapeHtml(item.target)}" />
          </div>
        `;
      })
      .join("");
  }

  function renderSankey() {
    const product = getProduct();
    const links = aggregateSankeyLinks(product.links);

    if (!links.length) {
      els.sankeyMeta.textContent = "暂无链路";
      els.sankeyChart.innerHTML = '<div class="empty-state">该产品暂无追溯链路数据。</div>';
      return;
    }

    const sourceTotals = sumBy(links, "source");
    const targetTotals = sumBy(links, "target");
    const sources = [...sourceTotals.keys()].sort((a, b) => sourceTotals.get(b) - sourceTotals.get(a));
    const targets = [...targetTotals.keys()].sort((a, b) => targetTotals.get(b) - targetTotals.get(a));
    const maxRows = Math.max(sources.length, targets.length, 6);
    const height = Math.max(410, maxRows * 36 + 92);
    const width = 1080;
    const sourceNodes = layoutColumn(sources, sourceTotals, 120, height);
    const targetNodes = layoutColumn(targets, targetTotals, 575, height);
    const productNode = { x: 970, y: height / 2 };
    const targetIndex = new Map(targets.map((name, index) => [name, index]));
    const scaleWidth = (value) => Math.max(1.5, Math.min(18, Math.log1p(value) * 2.7));

    const sourcePaths = links
      .map((link) => {
        const source = sourceNodes.get(link.source);
        const target = targetNodes.get(link.target);
        const color = palette[targetIndex.get(link.target) % palette.length];
        return `<path d="${curve(source.x + 10, source.y, target.x - 10, target.y)}" stroke="${color}" stroke-opacity="0.24" stroke-width="${scaleWidth(link.value)}" fill="none" stroke-linecap="round" />`;
      })
      .join("");

    const targetPaths = targets
      .map((name) => {
        const source = targetNodes.get(name);
        const color = palette[targetIndex.get(name) % palette.length];
        return `<path d="${curve(source.x + 10, source.y, productNode.x - 18, productNode.y)}" stroke="${color}" stroke-opacity="0.42" stroke-width="${scaleWidth(targetTotals.get(name))}" fill="none" stroke-linecap="round" />`;
      })
      .join("");

    els.sankeyMeta.textContent = `${sources.length} 来源 · ${targets.length} 过程`;
    els.sankeyChart.innerHTML = `
      <svg viewBox="0 0 ${width} ${height}" role="presentation">
        <rect width="${width}" height="${height}" rx="18" fill="rgba(255,255,255,0.02)" />
        <text x="26" y="36" fill="#91a99b" font-size="13">工业固废 / 原料</text>
        <text x="520" y="36" fill="#91a99b" font-size="13">单元过程</text>
        <text x="928" y="36" fill="#91a99b" font-size="13">再生产品</text>
        ${sourcePaths}
        ${targetPaths}
        ${sources.map((name) => nodeMarkup(sourceNodes.get(name), name, sourceTotals.get(name), "source")).join("")}
        ${targets.map((name) => nodeMarkup(targetNodes.get(name), name, targetTotals.get(name), "target")).join("")}
        <g>
          <rect x="${productNode.x - 18}" y="${productNode.y - 62}" width="36" height="124" rx="10" fill="#31f2ae" opacity="0.94" />
          <text x="${productNode.x + 28}" y="${productNode.y - 6}" fill="#eef8f1" font-size="15" font-weight="800">${escapeSvg(product.name)}</text>
          <text x="${productNode.x + 28}" y="${productNode.y + 18}" fill="#91a99b" font-size="12">${formatNumber(product.compare.recycled)} kgCO2e/t</text>
        </g>
      </svg>
    `;
  }

  function renderProcessChart() {
    const rows = getCurrentProcessRows().sort((a, b) => b.value - a.value);
    if (!rows.length) {
      els.processChart.innerHTML = '<div class="empty-state">暂无过程数据。</div>';
      return;
    }

    const max = Math.max(...rows.map((item) => item.value), 1);
    const total = rows.reduce((sum, item) => sum + item.value, 0);
    els.processChart.innerHTML = rows
      .map((item, index) => {
        const width = (item.value / max) * 100;
        const share = total ? (item.value / total) * 100 : 0;
        const color = palette[index % palette.length];
        return `
          <div class="bar-row">
            <div class="bar-row__label" title="${escapeHtml(item.target)}">${escapeHtml(item.target)}</div>
            <div class="bar-row__track"><div class="bar-row__fill" style="width:${width}%; background:linear-gradient(90deg, ${color}, ${shade(color, 18)});"></div></div>
            <div class="bar-row__value">${formatNumber(item.value)} · ${formatNumber(share)}%</div>
          </div>
        `;
      })
      .join("");
  }

  function renderCompare() {
    const product = getProduct();
    const compare = product.compare;
    const reduction = clamp(compare.reductionRate, 0, 100);
    const radius = 58;
    const circumference = 2 * Math.PI * radius;
    const dash = (reduction / 100) * circumference;
    const max = Math.max(compare.traditional, compare.recycled, 1);

    els.reductionDonut.innerHTML = `
      <svg viewBox="0 0 160 160" role="presentation">
        <circle cx="80" cy="80" r="${radius}" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="15" />
        <circle cx="80" cy="80" r="${radius}" fill="none" stroke="#31f2ae" stroke-width="15" stroke-linecap="round" stroke-dasharray="${dash} ${circumference - dash}" transform="rotate(-90 80 80)" />
        <text class="donut-label" x="80" y="76">${formatNumber(reduction)}%</text>
        <text class="donut-sub" x="80" y="98">减碳比例</text>
      </svg>
    `;

    els.compareBars.innerHTML = [
      { label: "传统建材", value: compare.traditional, className: "traditional" },
      { label: "再生建材", value: compare.recycled, className: "recycled" },
    ]
      .map((item) => `
        <div class="compare-bar compare-bar--${item.className}">
          <div class="compare-bar__top"><span>${item.label}</span><strong>${formatNumber(item.value)} kgCO2e/t</strong></div>
          <div class="compare-bar__track"><div class="compare-bar__fill" style="width:${(item.value / max) * 100}%"></div></div>
        </div>
      `)
      .join("");
  }

  function renderAnomaly() {
    const result = computeAnomaly();
    const status = result.score >= 88 ? "稳定" : result.score >= 70 ? "需复核" : "异常";
    els.anomalyBadge.textContent = `${status} · ${Math.round(result.score)} 分`;
    renderRadar(result.topRows, result.score);
    renderAnomalyRanges(result.rows);
  }

  function renderRadar(rows, score) {
    if (!rows.length) {
      els.anomalyRadar.innerHTML = '<div class="empty-state">暂无可筛查过程。</div>';
      return;
    }
    const size = 240;
    const center = size / 2;
    const radius = 82;
    const maxRatio = Math.max(...rows.flatMap((item) => [item.baseRatio, item.currentRatio]), 0.01) * 1.18;
    const toPoint = (index, value) => {
      const angle = -Math.PI / 2 + (index / rows.length) * Math.PI * 2;
      const r = clamp(value / maxRatio, 0, 1) * radius;
      return { x: center + Math.cos(angle) * r, y: center + Math.sin(angle) * r };
    };
    const polygon = (key) =>
      rows.map((item, index) => {
        const point = toPoint(index, item[key]);
        return `${point.x},${point.y}`;
      }).join(" ");
    const spokes = rows.map((_, index) => {
      const end = toPoint(index, maxRatio);
      return `<line x1="${center}" y1="${center}" x2="${end.x}" y2="${end.y}" stroke="rgba(255,255,255,0.08)" />`;
    }).join("");
    els.anomalyRadar.innerHTML = `
      <svg viewBox="0 0 ${size} ${size}" role="presentation">
        <circle cx="${center}" cy="${center}" r="${radius}" fill="rgba(255,255,255,0.025)" stroke="rgba(255,255,255,0.08)" />
        <circle cx="${center}" cy="${center}" r="${radius * 0.66}" fill="none" stroke="rgba(255,255,255,0.08)" />
        <circle cx="${center}" cy="${center}" r="${radius * 0.33}" fill="none" stroke="rgba(255,255,255,0.08)" />
        ${spokes}
        <polygon points="${polygon("baseRatio")}" fill="rgba(49,242,174,0.13)" stroke="#31f2ae" stroke-width="2" />
        <polygon points="${polygon("currentRatio")}" fill="rgba(246,183,86,0.12)" stroke="#f6b756" stroke-width="2" />
        <circle cx="${center}" cy="${center}" r="34" fill="rgba(7,17,13,0.88)" stroke="rgba(49,242,174,0.32)" />
        <text x="${center}" y="${center - 2}" fill="#eef8f1" font-size="20" font-weight="850" text-anchor="middle">${Math.round(score)}</text>
        <text x="${center}" y="${center + 16}" fill="#91a99b" font-size="10" text-anchor="middle">score</text>
      </svg>
    `;
  }

  function renderAnomalyRanges(rows) {
    if (!rows.length) {
      els.anomalyList.innerHTML = "";
      return;
    }
    const topRows = rows.slice().sort((a, b) => b.baseRatio - a.baseRatio).slice(0, 8);
    const max = Math.max(...topRows.map((item) => Math.max(item.high, item.currentRatio)), 0.01) * 1.12;
    els.anomalyList.innerHTML = topRows.map((item) => `
      <div class="anomaly-row">
        <div class="anomaly-row__label" title="${escapeHtml(item.target)}">${escapeHtml(item.target)}</div>
        <div class="range-track" aria-label="${escapeHtml(item.target)} 当前占比">
          <span class="range-band" style="left:${(item.low / max) * 100}%; width:${((item.high - item.low) / max) * 100}%;"></span>
          <span class="range-dot ${item.alert ? "is-alert" : ""}" style="left:${(item.currentRatio / max) * 100}%;"></span>
        </div>
        <div class="anomaly-row__value">${formatNumber(item.currentRatio * 100)}%</div>
      </div>
    `).join("");
  }

  function renderProvince() {
    const product = getProduct();
    const rows = product.provinces || [];
    if (!rows.length) {
      els.provinceBadge.textContent = "暂无省份数据";
      els.provinceSummary.innerHTML = '<div class="empty-state">该产品目前没有省份差异表。已有省份数据集中覆盖熟料与水泥部分产品。</div>';
      els.provinceTable.innerHTML = '<tr><td colspan="4">暂无省份数据，可在 tableData1.csv 中补充后重新生成 data.js。</td></tr>';
      return;
    }
    const footprints = rows.map((item) => item.footprint);
    const reductions = rows.map((item) => item.reductionMt);
    const rates = rows.map((item) => item.solidWasteRate);
    const avgFootprint = average(footprints);
    const topFootprint = rows.reduce((best, item) => (item.footprint > best.footprint ? item : best), rows[0]);
    const topReduction = rows.reduce((best, item) => (item.reductionMt > best.reductionMt ? item : best), rows[0]);
    const maxFootprint = Math.max(...footprints, 1);
    const maxReduction = Math.max(...reductions, 1);
    const maxRate = Math.max(...rates, 1);
    els.provinceBadge.textContent = `${rows.length} 个省份`;
    els.provinceSummary.innerHTML = `
      <div class="province-summary__item"><span>平均碳足迹</span><strong>${formatNumber(avgFootprint)} kgCO2/t</strong></div>
      <div class="province-summary__item"><span>最高碳足迹</span><strong>${escapeHtml(topFootprint.province)} · ${formatNumber(topFootprint.footprint)}</strong></div>
      <div class="province-summary__item"><span>最大减排量</span><strong>${escapeHtml(topReduction.province)} · ${formatNumber(topReduction.reductionMt)}</strong></div>
    `;
    els.provinceTable.innerHTML = rows.map((item) => `
      <tr>
        <td>${escapeHtml(item.province)}</td>
        <td><div class="cell-bar" style="--w:${(item.footprint / maxFootprint) * 100}%"><span>${formatNumber(item.footprint)}</span></div></td>
        <td><div class="cell-bar" style="--w:${(item.solidWasteRate / maxRate) * 100}%"><span>${formatNumber(item.solidWasteRate)}%</span></div></td>
        <td><div class="cell-bar" style="--w:${(item.reductionMt / maxReduction) * 100}%"><span>${formatNumber(item.reductionMt)}</span></div></td>
      </tr>
    `).join("");
  }

  function renderPortfolio() {
    els.categoryStats.innerHTML = DATA.insights.categoryStats.map((item) => `
      <article class="category-card ${item.type === state.category ? "is-active" : ""}">
        <strong>${escapeHtml(item.type)}</strong>
        <span>${item.count}</span>
        <small>平均减碳 ${formatNumber(item.avgReductionRate)}%</small>
      </article>
    `).join("");
    els.topReduction.innerHTML = DATA.insights.topReduction.map((item) => `
      <article class="top-list__item">
        <div>
          <strong>${escapeHtml(item.name)}</strong>
          <span>${escapeHtml(item.type)} · 减碳 ${formatNumber(item.reduction)} kgCO2e/t</span>
        </div>
        <em>${formatNumber(item.reductionRate)}%</em>
      </article>
    `).join("");
  }

  function aggregateSankeyLinks(rawLinks) {
    if (!rawLinks.length) return [];
    const sourceTotals = sumBy(rawLinks, "source");
    const topSources = new Set([...sourceTotals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 18).map(([name]) => name));
    const map = new Map();
    rawLinks.forEach((link) => {
      const source = topSources.has(link.source) ? link.source : "其他来源";
      const key = `${source}|||${link.target}`;
      const current = map.get(key) || { source, target: link.target, value: 0 };
      current.value += Math.max(0, Number(link.value) || 0);
      map.set(key, current);
    });
    return [...map.values()].filter((item) => item.value > 0);
  }

  function layoutColumn(names, totals, x, height) {
    const map = new Map();
    const top = 70;
    const bottom = 48;
    const step = names.length > 1 ? (height - top - bottom) / (names.length - 1) : 0;
    names.forEach((name, index) => {
      map.set(name, { x, y: names.length > 1 ? top + step * index : height / 2, value: totals.get(name) });
    });
    return map;
  }

  function nodeMarkup(node, name, value, type) {
    const isSource = type === "source";
    const color = isSource ? "#2ed8d4" : "#31f2ae";
    const labelX = isSource ? node.x - 20 : node.x + 20;
    const anchor = isSource ? "end" : "start";
    return `
      <g>
        <rect x="${node.x - 7}" y="${node.y - 18}" width="14" height="36" rx="5" fill="${color}" opacity="0.86" />
        <text x="${labelX}" y="${node.y - 3}" fill="#eef8f1" font-size="12" text-anchor="${anchor}">${escapeSvg(trimLabel(name, 16))}</text>
        <text x="${labelX}" y="${node.y + 14}" fill="#91a99b" font-size="10" text-anchor="${anchor}">${formatNumber(value)}</text>
      </g>
    `;
  }

  function curve(x1, y1, x2, y2) {
    const mid = Math.max(90, (x2 - x1) * 0.5);
    return `M ${x1} ${y1} C ${x1 + mid} ${y1}, ${x2 - mid} ${y2}, ${x2} ${y2}`;
  }

  function getCurrentProcessRows() {
    return getProduct().processes.map((item) => ({
      target: item.target,
      base: item.value,
      value: state.values.get(item.target) ?? item.value,
    }));
  }

  function computeAnomaly() {
    const rows = getCurrentProcessRows();
    const baseTotal = rows.reduce((sum, item) => sum + item.base, 0);
    const currentTotal = rows.reduce((sum, item) => sum + item.value, 0);
    const checked = rows.map((item) => {
      const baseRatio = baseTotal ? item.base / baseTotal : 0;
      const currentRatio = currentTotal ? item.value / currentTotal : 0;
      const low = baseRatio * 0.8;
      const high = baseRatio * 1.2;
      const relativeDiff = baseRatio ? Math.abs(currentRatio / baseRatio - 1) : 0;
      const penalty = Math.max(0, relativeDiff - 0.2);
      return { ...item, baseRatio, currentRatio, low, high, relativeDiff, penalty, alert: currentRatio < low || currentRatio > high };
    });
    const penaltyAvg = checked.length ? checked.reduce((sum, item) => sum + item.penalty, 0) / checked.length : 0;
    const alertCount = checked.filter((item) => item.alert).length;
    const totalRelativeDiff = baseTotal ? Math.abs(currentTotal / baseTotal - 1) : 0;
    const totalPenalty = Math.max(0, totalRelativeDiff - 0.2);
    const score = clamp(100 - penaltyAvg * 185 - alertCount * 2.5 - totalPenalty * 120, 0, 100);
    const topRows = checked.slice().sort((a, b) => b.baseRatio - a.baseRatio).slice(0, Math.min(8, checked.length));
    return { score, rows: checked, topRows };
  }

  function sumBy(items, key) {
    const map = new Map();
    items.forEach((item) => {
      const name = item[key];
      const value = Math.max(0, Number(item.value) || 0);
      map.set(name, (map.get(name) || 0) + value);
    });
    return map;
  }

  function average(values) {
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  }

  function formatNumber(value) {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return "-";
    const number = Number(value);
    if (Math.abs(number) >= 100) return number.toLocaleString("zh-CN", { maximumFractionDigits: 1 });
    if (Math.abs(number) >= 10) return number.toLocaleString("zh-CN", { maximumFractionDigits: 2 });
    return number.toLocaleString("zh-CN", { maximumFractionDigits: 3 });
  }

  function formatInput(value) {
    return Number(value || 0).toFixed(2).replace(/\.?0+$/, "");
  }

  function trimLabel(value, maxLength) {
    const text = String(value);
    return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function escapeSvg(value) {
    return escapeHtml(value);
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function shade(hex, percent) {
    const number = Number.parseInt(hex.replace("#", ""), 16);
    const amount = Math.round(2.55 * percent);
    const red = clamp((number >> 16) + amount, 0, 255);
    const green = clamp(((number >> 8) & 0x00ff) + amount, 0, 255);
    const blue = clamp((number & 0x0000ff) + amount, 0, 255);
    return `#${(0x1000000 + red * 0x10000 + green * 0x100 + blue).toString(16).slice(1)}`;
  }

  init();
})();
