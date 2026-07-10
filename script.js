const playerInput = document.getElementById("playerCount");
const playStyleSelect = document.getElementById("playStyle");
const playerFitSelect = document.getElementById("playerFit");
const titleSearchInput = document.getElementById("titleSearch");
const priceFilterSelect = document.getElementById("priceFilter");
const languageFilterSelect = document.getElementById("languageFilter");
const reviewFilterSelect = document.getElementById("reviewFilter");
const sortModeSelect = document.getElementById("sortMode");
const resultList = document.getElementById("resultList");
const resultTitle = document.getElementById("resultTitle");
const resultMeta = document.getElementById("resultMeta");
const dataStatus = document.getElementById("dataStatus");
const savedList = document.getElementById("savedList");
const shareBtn = document.getElementById("shareBtn");
const resetBtn = document.getElementById("resetBtn");
const clearSavedBtn = document.getElementById("clearSavedBtn");
const gameModal = document.getElementById("gameModal");
const modalTitle = document.getElementById("modalTitle");
const modalBody = document.getElementById("modalBody");
const modalCloseBtn = document.getElementById("modalCloseBtn");
const playerChips = [...document.querySelectorAll("[data-players]")];
const DATA_VERSION = "20260710-1955";
const SAVED_KEY = "steam-player-count-saved-games";

let games = [];
let analyzedGames = [];
let savedIds = new Set(loadSavedIds());

const fallbackGames = [
  {
    appId: 413150,
    title: "Stardew Valley",
    minPlayers: 1,
    maxPlayers: 4,
    styles: ["coop"],
    price: { finalFormatted: "価格取得前", discountPercent: 0 },
    language: { supportsJapanese: true },
    reviewSummary: { totalReviews: 0, scoreDescription: "レビュー取得前" },
    reviews: [
      "ソロでも楽しいけど友達と2人で農場を作るとかなり楽しい。",
      "4人で協力しながら遊ぶと作業分担ができて盛り上がる。"
    ],
    steamUrl: "https://store.steampowered.com/app/413150/Stardew_Valley/"
  }
];

initializeControlsFromUrl();

const dataRequest = fetch(`games.json?v=${DATA_VERSION}`, { cache: "no-store" })
  .then((response) => {
    if (!response.ok) throw new Error("games.json could not be loaded");
    return response.json();
  });

const timeout = new Promise((_, reject) => {
  window.setTimeout(() => reject(new Error("games.json loading timed out")), 3500);
});

Promise.race([dataRequest, timeout])
  .then((data) => {
    games = data;
    dataStatus.textContent = `${games.length}件のゲームデータを読み込みました。${getLatestUpdateLabel(games)}`;
    showResults();
    renderSavedGames();
  })
  .catch(() => {
    games = fallbackGames;
    dataStatus.textContent = "games.json を読めなかったため、内蔵サンプルデータで表示しています。";
    showResults();
    renderSavedGames();
  });

[playerInput, playStyleSelect, playerFitSelect, titleSearchInput, priceFilterSelect, languageFilterSelect, reviewFilterSelect, sortModeSelect].forEach((control) => {
  control.addEventListener("input", () => showResults({ updateUrl: true }));
  control.addEventListener("change", () => showResults({ updateUrl: true }));
});

playerChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    playerInput.value = chip.dataset.players;
    showResults({ updateUrl: true });
  });
});

resultList.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const game = findAnalyzedGame(button.dataset.appId);
  if (!game) return;

  if (button.dataset.action === "save") {
    toggleSavedGame(game);
    return;
  }

  if (button.dataset.action === "detail") {
    openGameModal(game);
  }
});

savedList.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-remove]");
  if (button) {
    savedIds.delete(button.dataset.remove);
    persistSavedIds();
    renderSavedGames();
    showResults();
    return;
  }

  const savedItem = event.target.closest("[data-jump-app-id]");
  if (!savedItem) return;
  jumpToSavedGame(savedItem.dataset.jumpAppId);
});

savedList.addEventListener("keydown", (event) => {
  if (!["Enter", " "].includes(event.key)) return;
  if (event.target.closest("button")) return;
  const savedItem = event.target.closest("[data-jump-app-id]");
  if (!savedItem) return;
  event.preventDefault();
  jumpToSavedGame(savedItem.dataset.jumpAppId);
});

shareBtn.addEventListener("click", async () => {
  updateUrlFromControls();
  const url = window.location.href;
  try {
    await navigator.clipboard.writeText(url);
    shareBtn.textContent = "コピーしました";
    window.setTimeout(() => {
      shareBtn.textContent = "条件リンクをコピー";
    }, 1400);
  } catch {
    window.prompt("このURLをコピーしてください", url);
  }
});

resetBtn.addEventListener("click", () => {
  playerInput.value = "2";
  playStyleSelect.value = "any";
  playerFitSelect.value = "range";
  titleSearchInput.value = "";
  priceFilterSelect.value = "any";
  languageFilterSelect.value = "any";
  reviewFilterSelect.value = "any";
  sortModeSelect.value = "score";
  showResults({ updateUrl: true });
});

clearSavedBtn.addEventListener("click", () => {
  savedIds = new Set();
  persistSavedIds();
  renderSavedGames();
  showResults();
});

modalCloseBtn.addEventListener("click", () => gameModal.close());
gameModal.addEventListener("click", (event) => {
  if (event.target === gameModal) gameModal.close();
});

function showResults(options = {}) {
  const playerCount = Number(playerInput.value);
  const playStyle = playStyleSelect.value;
  const playerFit = playerFitSelect.value;
  const titleQuery = titleSearchInput.value.trim().toLowerCase();
  const priceFilter = priceFilterSelect.value;
  const languageFilter = languageFilterSelect.value;
  const reviewFilter = reviewFilterSelect.value;
  const sortMode = sortModeSelect.value;

  syncActiveChip(playerCount);

  if (!Number.isFinite(playerCount) || playerCount < 1) {
    resultTitle.textContent = "人数を確認してください";
    resultMeta.textContent = "1人以上の数字を入力すると分析できます。";
    resultList.innerHTML = `<div class="empty">1以上の人数を入力してください。</div>`;
    return;
  }

  analyzedGames = games
    .filter((game) => game.title.toLowerCase().includes(titleQuery))
    .map((game) => analyzeGame(game, playerCount, playStyle))
    .filter((game) => matchesPlayerFit(game, playerCount, playerFit))
    .filter((game) => matchesPriceFilter(game, priceFilter))
    .filter((game) => matchesLanguageFilter(game, languageFilter))
    .filter((game) => matchesReviewFilter(game, reviewFilter))
    .filter((game) => game.score > 0)
    .sort((a, b) => sortGames(a, b, sortMode));

  resultTitle.textContent = `${analyzedGames.length}件の候補`;
  resultMeta.textContent = [
    `${playerCount}人`,
    getPlayerFitLabel(playerFit),
    getStyleLabel(playStyle),
    getPriceFilterLabel(priceFilter),
    getLanguageFilterLabel(languageFilter),
    getReviewFilterLabel(reviewFilter),
    getSortLabel(sortMode)
  ].join(" / ") + "で表示しています。";

  if (analyzedGames.length === 0) {
    resultList.innerHTML = `<div class="empty">条件に近いゲームが見つかりませんでした。人数や条件を少し広げてみてください。</div>`;
  } else {
    resultList.innerHTML = analyzedGames.map(createGameCard).join("");
  }

  if (options.updateUrl) updateUrlFromControls();
  renderSavedGames();
}

function analyzeGame(game, playerCount, playStyle) {
  let score = 0;
  const reasons = [];
  const allReviews = game.reviews.join(" ");
  const playerDistance = getPlayerDistance(game, playerCount);
  const playerKeywords = getPlayerKeywords(playerCount);
  const matchedPlayerWords = playerKeywords.filter((word) => allReviews.includes(word));

  if (matchedPlayerWords.length > 0) {
    score += matchedPlayerWords.length * 3;
    reasons.push(`レビュー内に「${matchedPlayerWords.slice(0, 3).join("」「")}」など、人数に近い表現があります。`);
  }

  if (playerDistance === 0) {
    score += 6;
    reasons.push(`登録データ上、${game.minPlayers}〜${game.maxPlayers}人に対応しています。`);
  } else if (playerDistance <= 2) {
    score += 2;
    reasons.push("対応人数からは少し外れますが、近い人数帯のゲームです。");
  }

  if (playStyle !== "any") {
    if (game.styles.includes(playStyle)) {
      score += 5;
      reasons.push(playStyle === "coop" ? "協力プレイ向けです。" : "対戦プレイ向けです。");
    } else {
      score -= 4;
    }
  }

  const socialWords = ["友達", "フレンド", "みんな", "盛り上がる", "わいわい", "家族"];
  const socialMatches = socialWords.filter((word) => allReviews.includes(word));
  if (playerCount >= 2 && socialMatches.length > 0) {
    score += socialMatches.length;
    reasons.push("複数人で遊ぶ楽しさに触れたレビューがあります。");
  }

  return {
    ...game,
    score: Math.max(score, 0),
    playerDistance,
    playerMentions: matchedPlayerWords,
    evidenceReviews: getEvidenceReviews(game.reviews, [...matchedPlayerWords, ...socialMatches]),
    reasons
  };
}

function createGameCard(game) {
  const gameId = getGameId(game);
  const styleLabels = game.styles.map(getStyleLabel);
  const matchLabel = game.playerDistance === 0 ? "人数対応" : `人数差 ${game.playerDistance}`;
  const reasons = game.reasons.length > 0 ? game.reasons : ["条件に近い候補として表示しています。"];
  const headerImage = game.headerImage
    ? `<img class="game-image" src="${escapeHtml(game.headerImage)}" alt="" loading="lazy" onerror="this.remove()" />`
    : "";
  const price = game.price || {};
  const reviewSummary = game.reviewSummary || {};
  const discountPercent = getDiscountPercent(game);
  const priceLabel = price.finalFormatted || price.initialFormatted || "価格未取得";
  const originalPrice = discountPercent > 0 && price.initialFormatted ? `<span class="price-card__original">${escapeHtml(price.initialFormatted)}</span>` : "";
  const discountBadge = discountPercent > 0 ? `<span class="discount-badge">-${discountPercent}%</span>` : "";
  const reviewLabel = reviewSummary.scoreDescription || "レビュー未取得";
  const reviewCount = reviewSummary.totalReviews ? `${Number(reviewSummary.totalReviews).toLocaleString("ja-JP")}件` : "件数未取得";
  const languageBadge = game.language?.supportsJapanese ? `<span class="tag">日本語対応</span>` : "";
  const exactBadge = game.minPlayers === game.maxPlayers ? `<span class="tag tag--strong">${game.minPlayers}人専用</span>` : "";
  const mentionBadge = Array.isArray(game.playerMentions) && game.playerMentions.length > 0 ? `<span class="tag">レビュー言及あり</span>` : "";
  const saved = savedIds.has(gameId);

  return `
    <article class="game-card" id="game-${escapeHtml(gameId)}" data-card-app-id="${escapeHtml(gameId)}">
      <div class="game-visual">
        ${headerImage}
        <span>${escapeHtml(game.title)}</span>
      </div>
      <div class="game-card__top">
        <div>
          <h3 class="game-title">${escapeHtml(game.title)}</h3>
          <div class="tags">
            <span class="tag tag--match">${matchLabel}</span>
            <span class="tag">${game.minPlayers}〜${game.maxPlayers}人</span>
            ${exactBadge}
            ${mentionBadge}
            ${languageBadge}
            ${styleLabels.map((label) => `<span class="tag">${label}</span>`).join("")}
          </div>
        </div>
        <div class="score"><span>おすすめ度</span>${game.score}</div>
      </div>
      <div class="store-facts">
        <div class="price-card">
          <span class="price-card__label">現在価格</span>
          <strong>${escapeHtml(priceLabel)}</strong>
          ${originalPrice}
          ${discountBadge}
        </div>
        <div class="review-card">
          <span class="price-card__label">Steamレビュー</span>
          <strong>${escapeHtml(reviewLabel)}</strong>
          <span>${escapeHtml(reviewCount)}</span>
        </div>
      </div>
      <ul class="reason-list">
        ${reasons.slice(0, 3).map((reason) => `<li>${escapeHtml(reason)}</li>`).join("")}
      </ul>
      <div class="card-actions">
        <button class="steam-link action-button" type="button" data-action="save" data-app-id="${escapeHtml(gameId)}">${saved ? "候補から外す" : "候補に入れる"}</button>
        <button class="steam-link action-button action-button--secondary" type="button" data-action="detail" data-app-id="${escapeHtml(gameId)}">詳細</button>
        <a class="steam-link" href="${escapeHtml(game.steamUrl)}" target="_blank" rel="noopener noreferrer">Steam</a>
      </div>
    </article>
  `;
}

function openGameModal(game) {
  const price = game.price || {};
  const reviewSummary = game.reviewSummary || {};
  const evidence = game.evidenceReviews.length > 0
    ? game.evidenceReviews.map((review) => `<blockquote>${escapeHtml(review)}</blockquote>`).join("")
    : `<p class="muted">この条件に直接近いレビュー抜粋は見つかりませんでした。</p>`;

  modalTitle.textContent = game.title;
  modalBody.innerHTML = `
    <div class="modal-grid">
      <div>
        <p class="modal-label">価格</p>
        <strong>${escapeHtml(price.finalFormatted || "価格未取得")}</strong>
      </div>
      <div>
        <p class="modal-label">対応人数</p>
        <strong>${game.minPlayers}〜${game.maxPlayers}人</strong>
      </div>
      <div>
        <p class="modal-label">レビュー</p>
        <strong>${escapeHtml(reviewSummary.scoreDescription || "レビュー未取得")}</strong>
      </div>
      <div>
        <p class="modal-label">日本語</p>
        <strong>${game.language?.supportsJapanese ? "対応" : "未確認"}</strong>
      </div>
    </div>
    <h3>おすすめ理由</h3>
    <ul>${game.reasons.map((reason) => `<li>${escapeHtml(reason)}</li>`).join("")}</ul>
    <h3>レビュー根拠</h3>
    ${evidence}
    <div class="modal-actions">
      <a class="steam-link" href="${escapeHtml(game.steamUrl)}" target="_blank" rel="noopener noreferrer">Steamストアで見る</a>
    </div>
  `;
  gameModal.showModal();
}

function renderSavedGames() {
  const savedGames = games.filter((game) => savedIds.has(getGameId(game)));

  if (savedGames.length === 0) {
    savedList.innerHTML = `<p class="saved-empty">気になるゲームを候補に入れるとここに残ります。</p>`;
    return;
  }

  savedList.innerHTML = savedGames.map((game) => `
    <div class="saved-item" role="button" tabindex="0" data-jump-app-id="${escapeHtml(getGameId(game))}" aria-label="${escapeHtml(game.title)} のカードへ移動">
      <div>
        <strong>${escapeHtml(game.title)}</strong>
        <span>${escapeHtml(game.price?.finalFormatted || "価格未取得")}</span>
      </div>
      <button type="button" data-remove="${escapeHtml(getGameId(game))}">×</button>
    </div>
  `).join("");
}

function jumpToSavedGame(appId) {
  let card = document.getElementById(`game-${appId}`);
  if (!card) {
    const game = findAnalyzedGame(appId);
    if (game) {
      makeSavedGameVisible(game);
      showResults({ updateUrl: true });
      card = document.getElementById(`game-${appId}`);
    }
  }

  if (!card) return;

  card.scrollIntoView({ behavior: "smooth", block: "center" });
  card.classList.remove("game-card--jumped");
  window.setTimeout(() => {
    card.classList.add("game-card--jumped");
  }, 80);
  window.setTimeout(() => {
    card.classList.remove("game-card--jumped");
  }, 1500);
}

function makeSavedGameVisible(game) {
  const currentPlayers = Number(playerInput.value);
  if (!Number.isFinite(currentPlayers) || currentPlayers < game.minPlayers || currentPlayers > game.maxPlayers) {
    playerInput.value = String(game.minPlayers);
  }
  titleSearchInput.value = game.title;
  playStyleSelect.value = "any";
  playerFitSelect.value = "range";
  priceFilterSelect.value = "any";
  languageFilterSelect.value = "any";
  reviewFilterSelect.value = "any";
}

function toggleSavedGame(game) {
  const id = getGameId(game);
  if (savedIds.has(id)) {
    savedIds.delete(id);
  } else {
    savedIds.add(id);
  }
  persistSavedIds();
  renderSavedGames();
  showResults();
}

function updateUrlFromControls() {
  const params = new URLSearchParams();
  params.set("players", playerInput.value);
  params.set("style", playStyleSelect.value);
  params.set("fit", playerFitSelect.value);
  params.set("q", titleSearchInput.value.trim());
  params.set("price", priceFilterSelect.value);
  params.set("lang", languageFilterSelect.value);
  params.set("reviews", reviewFilterSelect.value);
  params.set("sort", sortModeSelect.value);

  for (const [key, value] of [...params.entries()]) {
    if (!value || ["any", "range", "score"].includes(value)) params.delete(key);
  }

  const query = params.toString();
  const nextUrl = `${window.location.pathname}${query ? `?${query}` : ""}`;
  window.history.replaceState(null, "", nextUrl);
}

function initializeControlsFromUrl() {
  const params = new URLSearchParams(window.location.search);
  setControlValue(playerInput, params.get("players"));
  setControlValue(playStyleSelect, params.get("style"));
  setControlValue(playerFitSelect, params.get("fit"));
  setControlValue(titleSearchInput, params.get("q"));
  setControlValue(priceFilterSelect, params.get("price"));
  setControlValue(languageFilterSelect, params.get("lang"));
  setControlValue(reviewFilterSelect, params.get("reviews"));
  setControlValue(sortModeSelect, params.get("sort"));
}

function setControlValue(control, value) {
  if (!value) return;
  const hasOption = !control.options || [...control.options].some((option) => option.value === value);
  if (hasOption) control.value = value;
}

function findAnalyzedGame(appId) {
  return analyzedGames.find((game) => getGameId(game) === appId) || games.find((game) => getGameId(game) === appId);
}

function matchesPlayerFit(game, playerCount, playerFit) {
  if (playerFit === "exact") return game.minPlayers === playerCount && game.maxPlayers === playerCount;
  if (playerFit === "reviewMention") return Array.isArray(game.playerMentions) && game.playerMentions.length > 0;
  if (playerFit === "near") return game.playerDistance <= 2;
  if (playerFit === "atLeast") return game.maxPlayers >= playerCount;
  return playerCount >= game.minPlayers && playerCount <= game.maxPlayers;
}

function matchesPriceFilter(game, priceFilter) {
  const price = game.price || {};
  const priceValue = getPriceValue(game);
  if (priceFilter === "free") return price.isFree || priceValue === 0;
  if (priceFilter === "sale") return getDiscountPercent(game) > 0;
  if (priceFilter === "under1000") return priceValue <= 100000;
  if (priceFilter === "under3000") return priceValue <= 300000;
  return true;
}

function matchesLanguageFilter(game, languageFilter) {
  if (languageFilter === "japanese") return Boolean(game.language?.supportsJapanese);
  return true;
}

function matchesReviewFilter(game, reviewFilter) {
  if (reviewFilter === "any") return true;
  return Number(game.reviewSummary?.totalReviews || 0) >= Number(reviewFilter);
}

function sortGames(a, b, sortMode) {
  if (sortMode === "players") return a.playerDistance - b.playerDistance || b.score - a.score;
  if (sortMode === "price") return getPriceValue(a) - getPriceValue(b) || b.score - a.score;
  if (sortMode === "discount") return getDiscountPercent(b) - getDiscountPercent(a) || b.score - a.score;
  if (sortMode === "title") return a.title.localeCompare(b.title, "ja");
  return b.score - a.score || a.playerDistance - b.playerDistance;
}

function getEvidenceReviews(reviews, keywords) {
  const uniqueKeywords = [...new Set(keywords.filter(Boolean))];
  if (uniqueKeywords.length === 0) return [];

  return reviews
    .filter((review) => uniqueKeywords.some((keyword) => review.includes(keyword)))
    .slice(0, 3)
    .map((review) => review.length > 180 ? `${review.slice(0, 180)}...` : review);
}

function getPlayerDistance(game, playerCount) {
  if (playerCount < game.minPlayers) return game.minPlayers - playerCount;
  if (playerCount > game.maxPlayers) return playerCount - game.maxPlayers;
  return 0;
}

function getPlayerKeywords(playerCount) {
  const common = ["友達", "フレンド"];
  if (playerCount === 1) return ["1人", "一人", "ソロ", "ひとり"];
  if (playerCount === 2) return ["2人", "二人", "ペア", "デュオ", ...common];
  if (playerCount === 3) return ["3人", "三人", "複数人", ...common];
  if (playerCount === 4) return ["4人", "四人", "パーティー", "複数人", ...common];
  return ["大人数", "みんな", "パーティー", "マルチ", "複数人", ...common];
}

function syncActiveChip(playerCount) {
  playerChips.forEach((chip) => {
    chip.classList.toggle("is-active", Number(chip.dataset.players) === playerCount);
  });
}

function loadSavedIds() {
  try {
    return JSON.parse(localStorage.getItem(SAVED_KEY) || "[]");
  } catch {
    return [];
  }
}

function persistSavedIds() {
  localStorage.setItem(SAVED_KEY, JSON.stringify([...savedIds]));
}

function getGameId(game) {
  return String(game.appId || game.title);
}

function getLatestUpdateLabel(items) {
  const latest = Math.max(...items.map((item) => Number(item.updatedAt || 0)));
  if (!Number.isFinite(latest) || latest <= 0) return "";
  return ` 最終更新: ${new Date(latest * 1000).toLocaleString("ja-JP")}`;
}

function getStyleLabel(style) {
  if (style === "coop") return "協力プレイ";
  if (style === "versus") return "対戦プレイ";
  return "どちらでもよい";
}

function getSortLabel(sortMode) {
  if (sortMode === "discount") return "割引率が高い順";
  if (sortMode === "price") return "安い順";
  if (sortMode === "players") return "人数が近い順";
  if (sortMode === "title") return "タイトル順";
  return "おすすめ度順";
}

function getPlayerFitLabel(playerFit) {
  if (playerFit === "exact") return "ちょうど人数";
  if (playerFit === "reviewMention") return "レビューで言及あり";
  if (playerFit === "atLeast") return "その人数以上で遊べる";
  if (playerFit === "near") return "近い人数も含める";
  return "対応人数に入る";
}

function getPriceFilterLabel(priceFilter) {
  if (priceFilter === "free") return "無料だけ";
  if (priceFilter === "sale") return "セール中だけ";
  if (priceFilter === "under1000") return "1,000円以下";
  if (priceFilter === "under3000") return "3,000円以下";
  return "価格指定なし";
}

function getLanguageFilterLabel(languageFilter) {
  if (languageFilter === "japanese") return "日本語対応";
  return "言語指定なし";
}

function getReviewFilterLabel(reviewFilter) {
  if (reviewFilter === "100") return "100件以上";
  if (reviewFilter === "1000") return "1,000件以上";
  if (reviewFilter === "10000") return "10,000件以上";
  return "レビュー件数指定なし";
}

function getPriceValue(game) {
  const price = game.price || {};
  if (price.isFree) return 0;
  if (Number.isFinite(price.final)) return price.final;
  return Number.MAX_SAFE_INTEGER;
}

function getDiscountPercent(game) {
  return Number(game.price?.discountPercent || 0);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
