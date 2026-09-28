/* Nadhi Hijau — Vanilla JavaScript. No account, network data store, or framework.
 * All figures and reward rules are campaign simulations.
 * Only the current monthly leaderboard and the theme preference use localStorage.
 */
(function (root) {
  "use strict";

  const STORAGE_KEY = "nadhi.leaderboard.v1";
  const THEME_KEY = "nadhi.theme";
  const WITA_OFFSET = 8 * 60 * 60 * 1000;
  const BANJARS = [
    {
      id: "tegal",
      name: "Banjar Tegal Kawan",
      initials: "TK",
      grams: 2860000,
      points: 32480,
    },
    {
      id: "pande",
      name: "Banjar Pande",
      initials: "PA",
      grams: 2490000,
      points: 28850,
    },
    {
      id: "sari",
      name: "Banjar Sari",
      initials: "SA",
      grams: 2165000,
      points: 24620,
    },
    {
      id: "tengah",
      name: "Banjar Tengah",
      initials: "TE",
      grams: 1890000,
      points: 21540,
    },
    {
      id: "kaja",
      name: "Banjar Kaja",
      initials: "KA",
      grams: 1580000,
      points: 18360,
    },
  ];
  // Points per kg; bonuses are educational assumptions, not official standards.
  const WASTE = {
    sesari: { name: "Sisa Sesari", rate: 12 },
    canang: { name: "Canang", rate: 10 },
    daun: { name: "Dedaunan", rate: 8 },
  };
  const ORIGINS = {
    rutin: { name: "Rutin", bonus: 0 },
    gotong: { name: "Gotong Royong", bonus: 0.2 },
    acara: { name: "Acara", bonus: 0.1 },
  };

  /** Fixed UTC+8 calendar: independent of the visitor's device time zone. */
  function getPeriod(now = Date.now()) {
    const bali = new Date(now + WITA_OFFSET);
    const year = bali.getUTCFullYear();
    const month = bali.getUTCMonth();
    return {
      key: `${year}-${String(month + 1).padStart(2, "0")}`,
      start: Date.UTC(year, month, 1) - WITA_OFFSET,
      end: Date.UTC(year, month + 1, 1) - WITA_OFFSET,
    };
  }

  function createState(now = Date.now(), withDemo = false) {
    return {
      version: 1,
      period: getPeriod(now).key,
      rows: Object.fromEntries(
        BANJARS.map((banjar) => [
          banjar.id,
          {
            grams: withDemo ? banjar.grams : 0,
            points: withDemo ? banjar.points : 0,
            deposits: 0,
            origins: { rutin: 0, gotong: 0, acara: 0 },
            waste: { sesari: 0, canang: 0, daun: 0 },
          },
        ]),
      ),
    };
  }

  const safeNumber = (value) =>
    Number.isSafeInteger(value) && value >= 0 && value <= 1000000000000;

  /** Whitelist stored fields. A new month discards all prior aggregates. */
  function normalizeState(raw, now = Date.now()) {
    const state = createState(now);
    if (!raw || raw.version !== 1 || raw.period !== state.period || !raw.rows)
      return state;
    for (const { id } of BANJARS) {
      const row = raw.rows[id];
      if (!row || !safeNumber(row.grams) || !safeNumber(row.points)) continue;
      state.rows[id].grams = row.grams;
      state.rows[id].points = row.points;
      state.rows[id].deposits = safeNumber(row.deposits) ? row.deposits : 0;
      for (const key of Object.keys(ORIGINS)) {
        state.rows[id].origins[key] = safeNumber(row.origins?.[key])
          ? row.origins[key]
          : 0;
      }
      for (const key of Object.keys(WASTE)) {
        state.rows[id].waste[key] = safeNumber(row.waste?.[key])
          ? row.waste[key]
          : 0;
      }
    }
    return state;
  }

  function calculateDeposit(input) {
    const { origin } = input || {};
    if (!Object.hasOwn(ORIGINS, origin))
      throw new Error("Pilih asal setoran yang tersedia.");
    // The legacy single-type shape is still accepted by local integrations.
    const entries = Array.isArray(input.items)
      ? input.items
      : input.waste
        ? [{ waste: input.waste, weight: input.weight }]
        : [];
    if (entries.length < 1 || entries.length > 3)
      throw new Error("Pilih satu hingga tiga jenis sampah.");
    const seen = new Set();
    const items = entries.map((entry) => {
      if (
        !entry ||
        !Object.hasOwn(WASTE, entry.waste) ||
        seen.has(entry.waste)
      ) {
        throw new Error(
          "Jenis sampah harus tersedia dan tidak boleh dipilih berulang.",
        );
      }
      const waste = entry.waste;
      seen.add(waste);
      const kg =
        typeof entry.weight === "number"
          ? entry.weight
          : Number(String(entry.weight).trim().replace(",", "."));
      let message = "";
      if (!Number.isFinite(kg) || kg < 0.1 || kg > 1000)
        message = `Isi berat ${WASTE[waste].name} antara 0,1 dan 1.000 kg.`;
      else if (Math.abs(kg * 10 - Math.round(kg * 10)) > 0.000001)
        message = `Gunakan maksimal satu angka desimal untuk ${WASTE[waste].name}.`;
      if (message) {
        const error = new Error(message);
        error.field = `weight-${waste}`;
        throw error;
      }
      const grams = Math.round(kg * 1000);
      return {
        waste,
        kg,
        grams,
        base: Math.floor((grams * WASTE[waste].rate) / 1000),
      };
    });
    const grams = items.reduce((sum, item) => sum + item.grams, 0);
    if (grams > 1000000)
      throw new Error(
        "Total berat semua jenis tidak boleh melebihi 1.000 kg per setoran.",
      );
    const base = items.reduce((sum, item) => sum + item.base, 0);
    const bonus = Math.floor(base * ORIGINS[origin].bonus);
    const kg = grams / 1000;
    return {
      items,
      kg,
      grams,
      base,
      bonus,
      points: base + bonus,
      compost: kg * 0.4,
      origin,
    };
  }

  function addDeposit(state, input, now = Date.now()) {
    if (!BANJARS.some((banjar) => banjar.id === input.banjar))
      throw new Error("Pilih banjar yang tersedia.");
    const result = calculateDeposit(input);
    const next = normalizeState(state, now);
    const row = next.rows[input.banjar];
    if (
      !safeNumber(row.grams + result.grams) ||
      !safeNumber(row.points + result.points)
    ) {
      throw new Error("Batas total simulasi tercapai untuk periode ini.");
    }
    row.grams += result.grams;
    row.points += result.points;
    row.deposits += 1;
    row.origins[input.origin] += result.grams;
    result.items.forEach((item) => {
      row.waste[item.waste] += item.grams;
    });
    return { state: next, result };
  }

  // Native Node can verify calendar and calculation logic without build tools.
  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      getPeriod,
      createState,
      normalizeState,
      calculateDeposit,
      addDeposit,
      BANJARS,
      WASTE,
      ORIGINS,
    };
  }
  if (typeof document === "undefined") return;

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const format = (number) =>
    new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(number);
  const icon = (name, extra = "") =>
    `<svg class="icon ${extra}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const escape = (value) =>
    String(value).replace(
      /[&<>"']/g,
      (char) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[char],
    );
  const reduceMotion = () =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let storageAvailable = true;
  let memoryState;

  function readState() {
    const now = Date.now();
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === null)
        return memoryState
          ? normalizeState(memoryState, now)
          : createState(now, true);
      return normalizeState(JSON.parse(raw), now);
    } catch (_) {
      return memoryState ? normalizeState(memoryState, now) : createState(now);
    }
  }
  let state = readState();

  function saveState() {
    memoryState = state;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      storageAvailable = true;
    } catch (_) {
      storageAvailable = false;
    }
    if ($(".board-top small"))
      $(".board-top small").textContent = storageAvailable
        ? "Data simulasi · perangkat ini"
        : "Data simulasi · sesi ini saja";
  }

  function sortedRows() {
    return BANJARS.map((banjar) => ({
      ...banjar,
      ...state.rows[banjar.id],
    })).sort(
      (a, b) =>
        b.points - a.points ||
        b.grams - a.grams ||
        a.name.localeCompare(b.name, "id"),
    );
  }

  function renderLeaderboard(highlightId = "") {
    if (!$("#leaderboard-rows")) return;
    const period = getPeriod();
    $("#board-period").textContent = new Intl.DateTimeFormat("id-ID", {
      month: "long",
      year: "numeric",
      timeZone: "Asia/Makassar",
    }).format(new Date(period.start));
    $("#leaderboard-rows").innerHTML = sortedRows()
      .map((row, index) => {
        const active = row.points > 0 || row.grams > 0;
        return `<tr class="${active && index === 0 ? "top-rank" : ""} ${row.id === highlightId ? "just-updated" : ""}">
        <td><span class="rank ${active ? `rank-${index + 1}` : ""}">${active ? String(index + 1).padStart(2, "0") : "—"}</span></td>
        <th scope="row"><span class="banjar-cell"><span class="banjar-avatar" aria-hidden="true">${row.initials}</span>${row.name}</span></th>
        <td>${format(row.grams / 1000)} kg</td><td>${format(row.points)}</td></tr>`;
      })
      .join("");
  }

  function ensureCurrentPeriod() {
    if (state.period === getPeriod().key) return false;
    state = createState(); // No archive and no carry-over from the previous month.
    saveState();
    renderLeaderboard();
    const banner = $("#deposit-success");
    if (banner) {
      banner.hidden = false;
      banner.textContent =
        "Periode baru dimulai. Seluruh poin dan total setoran bulan sebelumnya telah direset.";
    }
    return true;
  }

  function updateCountdown() {
    ensureCurrentPeriod();
    if (!$("#countdown")) return;
    const period = getPeriod();
    const total = Math.max(0, Math.ceil((period.end - Date.now()) / 1000));
    const days = Math.floor(total / 86400);
    const hours = Math.floor((total % 86400) / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;
    for (const [id, value] of Object.entries({
      days,
      hours,
      minutes,
      seconds,
    })) {
      $(`#cd-${id}`).textContent = String(value).padStart(2, "0");
    }
    $("#countdown").setAttribute(
      "aria-label",
      `${days} hari, ${hours} jam, ${minutes} menit, ${seconds} detik menuju reset bulanan`,
    );
    $("#reset-date").textContent = `Reset ${new Intl.DateTimeFormat("id-ID", {
      day: "numeric",
      month: "short",
      timeZone: "Asia/Makassar",
    }).format(new Date(period.end))} · 00.00 WITA`;
  }

  function formInput() {
    const data = new FormData($("#deposit-form"));
    return {
      items: data
        .getAll("waste")
        .map((waste) => ({ waste, weight: data.get(`weight-${waste}`) })),
      origin: data.get("origin"),
      banjar: data.get("banjar"),
    };
  }

  function syncWasteFields() {
    if (!$("#deposit-form")) return;
    let selected = 0;
    $$('input[name="waste"]').forEach((checkbox) => {
      const row = $(`#row-${checkbox.value}`);
      row.hidden = !checkbox.checked;
      row.querySelectorAll("input, button").forEach((control) => {
        control.disabled = !checkbox.checked;
      });
      if (checkbox.checked) selected += 1;
    });
    $("#weight-empty").hidden = selected > 0;
  }

  function updateEstimate() {
    if (!$("#deposit-form")) return;
    let estimate;
    try {
      estimate = calculateDeposit(formInput());
    } catch (_) {
      estimate = null;
    }
    $("#point-estimate").textContent = estimate ? format(estimate.points) : "—";
    $("#base-points").textContent = estimate
      ? `${format(estimate.base)} poin`
      : "—";
    $("#bonus-points").textContent = estimate
      ? `+${format(estimate.bonus)} poin`
      : "—";
    $("#compost-estimate").textContent = estimate
      ? `${format(estimate.compost)} kg`
      : "—";
    $("#total-weight").textContent = estimate
      ? `${format(estimate.kg)} kg`
      : "—";
  }

  function submitDeposit(input) {
    // Re-read current aggregates to incorporate updates from another tab.
    state = readState();
    const outcome = addDeposit(state, input);
    state = outcome.state;
    saveState();
    renderLeaderboard(input.banjar);
    updateCountdown();
    const banjar = BANJARS.find((row) => row.id === input.banjar);
    const { result } = outcome;
    const detail = result.items
      .map((item) => `${WASTE[item.waste].name} ${format(item.kg)} kg`)
      .join(", ");
    const message = `${detail} · ${ORIGINS[input.origin].name} berhasil disimulasikan. Total ${format(result.kg)} kg, +${format(result.points)} poin untuk ${banjar.name}.`;
    // Transfer only the current simulation snapshot. The destination consumes it
    // once; refreshing the leaderboard must never add the same deposit again.
    const handoff = {
      state,
      message,
      highlight: input.banjar,
      period: state.period,
      createdAt: Date.now(),
    };
    let fragment = "";
    try {
      if (location.protocol === "file:")
        throw new Error("Use file-compatible handoff");
      sessionStorage.setItem("nadhi.deposit.handoff", JSON.stringify(handoff));
    } catch (_) {
      fragment = "#setoran=" + encodeURIComponent(JSON.stringify(handoff));
    }
    window.location.assign(
      "leaderboard.html?tema=" +
        document.documentElement.dataset.theme +
        fragment,
    );
    return {
      ...result,
      banjar: banjar.name,
      period: state.period,
      savedOnDevice: storageAvailable,
    };
  }

  $("#deposit-form")?.addEventListener("input", () => {
    $("#form-error").hidden = true;
    $$(".weight-input input").forEach((input) =>
      input.removeAttribute("aria-invalid"),
    );
    syncWasteFields();
    updateEstimate();
  });
  $("#deposit-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    try {
      submitDeposit(formInput());
      $("#form-error").hidden = true;
    } catch (error) {
      $("#form-error").textContent = error.message;
      $("#form-error").hidden = false;
      const field = error.field ? document.getElementById(error.field) : null;
      field?.setAttribute("aria-invalid", "true");
      (field || $("#form-error")).focus();
    }
  });
  $$("[data-weight-step]").forEach((button) => {
    button.addEventListener("click", () => {
      const input = $(`#weight-${button.dataset.weightTarget}`);
      const current = Number(input.value) || 0;
      input.value = Math.min(
        1000,
        Math.max(
          0.1,
          Math.round((current + Number(button.dataset.weightStep)) * 10) / 10,
        ),
      );
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
  });

  // Theme and responsive navigation.
  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    document.documentElement.classList.toggle("dark", theme === "dark");
    $('meta[name="theme-color"]').content =
      theme === "dark" ? "#071f19" : "#f6f8f2";
    $("#theme-toggle").setAttribute(
      "aria-label",
      `Aktifkan tema ${theme === "dark" ? "terang" : "gelap"}`,
    );
    $("#theme-toggle").title = theme === "dark" ? "Tema terang" : "Tema gelap";
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch (_) {
      /* Preference is optional. */
    }
    try {
      const url = new URL(location.href);
      if (url.searchParams.has("tema")) {
        url.searchParams.set("tema", theme);
        history.replaceState(null, "", url.href);
      }
    } catch (_) {
      /* file:// may restrict history updates. */
    }
  }
  const requestedTheme = new URLSearchParams(location.search).get("tema");
  applyTheme(
    ["light", "dark"].includes(requestedTheme)
      ? requestedTheme
      : document.documentElement.dataset.theme === "light"
        ? "light"
        : "dark",
  );
  $("#theme-toggle").addEventListener("click", () =>
    applyTheme(
      document.documentElement.dataset.theme === "dark" ? "light" : "dark",
    ),
  );
  // Keep the chosen theme when opening individual HTML files without a server.
  document.addEventListener("click", (event) => {
    const link = event.target.closest("a[href]");
    if (!link || !/^[a-z]+\.html(?:[?#]|$)/.test(link.getAttribute("href")))
      return;
    const target = new URL(link.href, location.href);
    target.searchParams.set("tema", document.documentElement.dataset.theme);
    link.href = target.href;
  });

  function closeMenu() {
    $("#mobile-nav").hidden = true;
    $("#menu-toggle").setAttribute("aria-expanded", "false");
    $("#menu-toggle").setAttribute("aria-label", "Buka menu");
  }
  $("#menu-toggle").addEventListener("click", () => {
    const open = $("#menu-toggle").getAttribute("aria-expanded") !== "true";
    $("#mobile-nav").hidden = !open;
    $("#menu-toggle").setAttribute("aria-expanded", String(open));
    $("#menu-toggle").setAttribute(
      "aria-label",
      open ? "Tutup menu" : "Buka menu",
    );
  });
  $$("#mobile-nav a").forEach((link) =>
    link.addEventListener("click", closeMenu),
  );
  document.addEventListener("click", (event) => {
    if (!$("#site-header").contains(event.target)) closeMenu();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !$("#mobile-nav").hidden) {
      closeMenu();
      $("#menu-toggle").focus();
    }
  });
  window.addEventListener("resize", () => {
    if (window.innerWidth > 1280) closeMenu();
  });
  const updateHeader = () =>
    $("#site-header").classList.toggle(
      "scrolled",
      document.body.classList.contains("inner-page") || window.scrollY > 70,
    );
  window.addEventListener("scroll", updateHeader, { passive: true });
  updateHeader();

  // Native dialog supplies focus containment and Escape behavior.
  const dialog = $("#info-dialog");
  let dialogOpener = null;
  let previousOverflow = "";
  function openDialog(eyebrow, title, body) {
    dialogOpener = document.activeElement;
    $("#dialog-content").innerHTML =
      `<div class="dialog-eyebrow">${escape(eyebrow)}</div><h2 class="dialog-title" id="dialog-title">${escape(title)}</h2><div class="dialog-body">${body}</div>`;
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.showModal();
    dialog.scrollTop = 0;
    $("#dialog-close").focus();
  }
  $("#dialog-close").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    const rect = dialog.getBoundingClientRect();
    if (
      event.target === dialog &&
      (event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom)
    )
      dialog.close();
  });
  dialog.addEventListener("close", () => {
    document.body.style.overflow = previousOverflow;
    if (dialogOpener?.isConnected) dialogOpener.focus({ preventScroll: true });
  });

  $("#reward-open")?.addEventListener("click", () =>
    openDialog(
      "KONSEP REWARD · SYARAT & KETENTUAN USULAN",
      "Apresiasi untuk banjar yang peduli.",
      `
    <div class="dialog-callout">Ini adalah konsep kampanye, bukan program bantuan pemerintah yang telah ditetapkan. Poin simulasi tidak dapat ditukar dengan uang dan tidak menjamin pendanaan.</div>
    <h3>1. Cara memperoleh peringkat</h3>
    <p>Pilah bagian organik, timbang secara wajar, pilih banjar serta asal setoran sesuai kegiatan. Dalam simulasi: Sisa Sesari 12 poin/kg, Canang 10 poin/kg, dan Dedaunan 8 poin/kg. Boleh memilih beberapa jenis sekaligus, dengan berat masing-masing. Poin dasar dibulatkan ke bawah per jenis lalu dijumlahkan. Bonus Gotong Royong 20% atau Acara 10% dihitung satu kali dari jumlah poin dasar dan dibulatkan ke bawah. Total berat maksimal 1.000 kg per setoran. Bonus tidak ditumpuk.</p>
    <p>Peringkat diurutkan menurut total poin, lalu berat terkumpul. Jika tetap sama, nama banjar diurutkan alfabetis. Semua total kembali nol setiap tanggal 1 pukul 00.00 WITA, tanpa menyimpan riwayat bulan sebelumnya.</p>
    <h3>2. Aksi yang memenuhi konsep penilaian</h3>
    <ul><li>Hanya sampah organik terpilah yang dihitung; uang sesari, plastik, staples, dan logam harus dipisahkan.</li><li>Dalam pelaksanaan nyata yang diusulkan, setiap setoran harus diperiksa dan ditimbang oleh petugas yang ditunjuk penyelenggara.</li><li>Bonus komunitas memerlukan bukti kegiatan gotong royong atau acara yang disetujui penyelenggara.</li></ul>
    <h3>3. Pelanggaran & penanganan yang diusulkan</h3>
    <ul><li>Dilarang mencatat setoran fisik yang sama lebih dari sekali, mengubah timbangan, atau memakai identitas banjar lain.</li><li>Dilarang menambah air, tanah, batu, atau sampah nonorganik demi meningkatkan berat.</li><li>Setoran tidak sah dapat dibatalkan; pelanggaran berulang dapat menggugurkan kelayakan reward setelah pemeriksaan dan kesempatan klarifikasi.</li></ul>
    <h3>4. Usulan prosedur dukungan pemerintah</h3>
    <ol><li>Jika program resmi dibuka, penyelenggara menerbitkan panduan, periode, kriteria, anggaran, dan kanal pengajuan resmi.</li><li>Banjar menyiapkan usulan kegiatan lingkungan dan bukti setoran terverifikasi melalui kanal tersebut.</li><li>Pihak berwenang memeriksa kelayakan serta menetapkan penerima. Peringkat adalah bahan pertimbangan, bukan persetujuan otomatis.</li><li>Penyaluran dan laporan penggunaan dana mengikuti ketentuan program resmi yang nantinya berlaku.</li></ol>
    <p>Website ini tidak menerima proposal, memvalidasi setoran fisik, atau menyalurkan dana. Besaran reward dan instansi penanggung jawab belum ditetapkan.</p>
  `,
    ),
  );

  $$("[data-award-open]").forEach((button) =>
    button.addEventListener("click", () => {
      openDialog(
        "FOTO ILUSTRASI · APRESIASI BANJAR",
        "Aksi baik, layak dirayakan.",
        `
      <img class="dialog-photo award-dialog-photo" src="assets/award-community.webp" alt="Ilustrasi AI warga Bali menerima piala kayu berbentuk daun">
      <p>Gambaran penyerahan penghargaan sebagai apresiasi atas pemilahan sampah dan gotong royong komunitas.</p>
      <div class="dialog-callout">Foto ini dibuat dengan AI. Orang dan acara bersifat ilustratif, bukan bukti penghargaan nyata atau dukungan pemerintah.</div>
      <p>Untuk pelaksanaan kampanye nyata, ruang ini dapat diisi dokumentasi penerima yang telah diverifikasi. Ketentuan dukungan yang diusulkan tersedia pada tombol Konsep Reward di halaman ini.</p>
    `,
      );
    }),
  );

  const announcements = [
    {
      category: "GOTONG ROYONG · RENCANA KEGIATAN",
      title: "Satu pagi untuk Bali yang lebih bersih.",
      body: `<p>Jadikan jalan sekitar dan area bersama banjar sebagai tempat memulai. Kegiatan dapat diusulkan oleh warga bersama pengurus banjar.</p><h3>Alur kegiatan</h3><ol><li>Sepakati titik kumpul, waktu, wilayah kerja, dan koordinator.</li><li>Siapkan sarung tangan, alat pengumpul, serta wadah terpisah untuk organik dan anorganik.</li><li>Pilah daun dan sisa alami yang bersih. Kumpulkan plastik, logam, dan kaca sesuai arahan pengelola setempat.</li><li>Timbang hasil yang telah terpilah dan koordinasikan penanganannya dengan pengelola sampah.</li></ol><div class="dialog-callout">Jadwal, lokasi, dan penyelenggara belum ditetapkan. Ini panduan untuk merencanakan kegiatan, bukan undangan acara terjadwal.</div><p>Benda tajam dan limbah berbahaya tidak digunakan dalam simulasi organik. Serahkan penanganannya kepada petugas yang sesuai.</p>`,
    },
    {
      category: "EDUKASI · PANDUAN PRAKTIK",
      title: "Dari sisa canang, tumbuh kehidupan.",
      body: `<p>Setelah persembahan selesai digunakan sesuai kebiasaan setempat, bunga dan janur yang bersih dapat dipisahkan sebagai bahan organik.</p><h3>Langkah awal mengompos</h3><ol><li>Pisahkan uang sesari, plastik, staples, dan bahan yang tidak dapat dikomposkan.</li><li>Potong bahan organik agar lebih kecil. Campurkan bahan lembap dengan daun kering secukupnya.</li><li>Gunakan wadah berventilasi dan jaga kelembapan seperti spons yang diperas.</li><li>Aduk berkala. Kompos matang umumnya berwarna gelap, berbau tanah, dan bahan asalnya sulit dikenali.</li></ol><div class="dialog-callout">Hasil dan waktu pengomposan dipengaruhi jenis bahan, kelembapan, dan perawatan. Angka 40% di kalkulator hanya asumsi untuk belajar.</div><p>Rencanakan praktik bersama pengelola kompos setempat. Tanggal dan tempat lokakarya belum ditetapkan.</p>`,
    },
    {
      category: "INFO BANJAR · SIKLUS BULANAN",
      title: "Bulan baru, semangat yang baru.",
      body: `<p>Leaderboard menggunakan bulan kalender waktu Bali (WITA/UTC+8), dari tanggal 1 pukul 00.00 sampai sebelum tanggal 1 bulan berikutnya.</p><h3>Apa yang terjadi saat reset?</h3><ul><li>Seluruh poin, berat sampah, jumlah setoran, dan rincian jenis serta asal setoran periode sebelumnya kembali nol.</li><li>Riwayat bulan lama tidak diarsipkan. Jika website sedang tertutup, reset diterapkan saat website dibuka kembali.</li><li>Nama banjar dan pilihan tema tetap tersedia.</li></ul><h3>Tentang angka pada klasemen</h3><p>Angka awal adalah data ilustrasi. Simulasi berikutnya hanya memperbarui data pada perangkat dan browser yang sama; angka bukan klasemen kolektif resmi.</p><div class="dialog-callout">Lihat countdown di atas tabel untuk sisa waktu. Periode mengikuti jam perangkat yang ditafsirkan dalam WITA.</div>`,
    },
  ];
  $$("[data-news]").forEach((button) =>
    button.addEventListener("click", () => {
      const article = announcements[Number(button.dataset.news)];
      openDialog(article.category, article.title, article.body);
    }),
  );

  // Nine slots: three initial ideas plus six additional gallery photographs.
  const gallery = [
    {
      file: "gallery-01-cleanup",
      tag: "GOTONG ROYONG",
      title: "Bersama menjaga pesisir",
      alt: "Relawan memasukkan sampah pantai ke dalam karung",
      credit: "OCG Saving The Ocean",
      source: "https://unsplash.com/photos/EPPS6W5LdXs",
      story:
        "Pemilahan di lokasi membantu bahan yang terkumpul diarahkan ke penanganan yang tepat.",
    },
    {
      file: "gallery-02-compost",
      tag: "KEMBALI KE TANAH",
      title: "Menghidupkan tanah kembali",
      alt: "Dua tangan menampung tanah gelap",
      credit: "Gabriel Jimenez",
      source: "https://unsplash.com/photos/jin4W1HqgL4",
      story:
        "Mengolah bahan organik menjadi kompos adalah salah satu cara mengembalikan bahan alami ke tanah.",
    },
    {
      file: "gallery-03-recycling",
      tag: "DAUR ULANG",
      title: "Nilai baru dari yang lama",
      alt: "Wadah plastik bekas dipadatkan menjadi bal daur ulang",
      credit: "Nareeta Martin",
      source: "https://unsplash.com/photos/UKs_rzIYE6M",
      story:
        "Bahan anorganik yang terpilah dapat disalurkan sesuai jenis yang diterima bank sampah atau pengelola daur ulang.",
    },
    {
      file: "gallery-04-leaves",
      tag: "SAMPAH ORGANIK",
      title: "Daun jatuh, manfaat tumbuh",
      alt: "Daun kering cokelat menutupi permukaan tanah",
      credit: "Đào Việt Hoàng",
      source: "https://unsplash.com/photos/rReyncqepys",
      story:
        "Daun kering dapat dimanfaatkan sebagai bahan campuran kompos atau mulsa sesuai kebutuhan kebun.",
    },
    {
      file: "gallery-05-gardening",
      tag: "KEBUN KOMUNITAS",
      title: "Merawat dari dekat",
      alt: "Tangan merawat tanah pada bedeng kebun",
      credit: "Sandie Clarke",
      source: "https://unsplash.com/photos/q13Zq1Jufks",
      story:
        "Kebun bersama memberi ruang bagi warga untuk saling belajar tentang tanah, tanaman, dan bahan organik.",
    },
    {
      file: "gallery-06-planting",
      tag: "TUMBUH BERSAMA",
      title: "Satu bibit, satu harapan",
      alt: "Tangan bersarung membawa bibit tanaman untuk ditanam",
      credit: "Jonathan Kemper",
      source: "https://unsplash.com/photos/CbZh3kaPxrE",
      story:
        "Menanam adalah awal. Merawat tanaman secara bergiliran membantu aksi komunitas terus berlanjut.",
    },
    {
      file: "gallery-07-cleanup",
      tag: "AKSI KOMUNITAS",
      title: "Langkah kecil yang menular",
      alt: "Kelompok relawan mengumpulkan sampah di pantai",
      credit: "Brian Yurasits",
      source: "https://unsplash.com/photos/PzQNdXw2a6g",
      story:
        "Gotong royong memberi kesempatan untuk menyepakati kebiasaan menjaga lingkungan setelah kegiatan selesai.",
    },
    {
      file: "gallery-08-sorting",
      tag: "PILAH DARI SUMBER",
      title: "Tempat yang tepat",
      alt: "Empat tempat sampah berwarna berjajar untuk pemilahan",
      credit: "Unsplash",
      source: "https://images.unsplash.com/photo-1532996122724-e3c354a0b15b",
      story:
        "Gunakan label jenis sampah yang jelas. Warna wadah dapat berbeda antarlokasi, jadi selalu baca petunjuknya.",
    },
    {
      file: "gallery-09-cleanup",
      tag: "UNTUK GENERASI BERIKUTNYA",
      title: "Pesisir yang kita jaga",
      alt: "Relawan bekerja sama membersihkan pantai",
      credit: "OCG Saving The Ocean",
      source: "https://unsplash.com/photos/SIg-qmg9NHw",
      story:
        "Lingkungan yang terawat lahir dari tindakan yang berulang, bersama orang-orang di sekitar kita.",
    },
  ];
  if ($("#gallery-grid"))
    $("#gallery-grid").innerHTML = gallery
      .map(
        (photo, index) =>
          `<button class="gallery-card" type="button" data-gallery="${index}" aria-label="Lihat foto: ${escape(photo.title)}"><img src="assets/${photo.file}.webp" alt="${escape(photo.alt)}" loading="lazy" width="900" height="740"><span class="gallery-caption"><span>${photo.tag}</span><strong>${photo.title}</strong>${icon("arrow")}</span></button>`,
      )
      .join("");
  $$("[data-gallery]").forEach((button) =>
    button.addEventListener("click", () => {
      const photo = gallery[Number(button.dataset.gallery)];
      openDialog(
        photo.tag,
        photo.title,
        `<img class="dialog-photo" src="assets/${photo.file}.webp" alt="${escape(photo.alt)}"><p>${photo.story}</p><p>Foto ilustrasi dari Unsplash; bukan dokumentasi banjar tertentu.</p><p><a class="dialog-source" href="${photo.source}" target="_blank" rel="noopener noreferrer">Foto: ${escape(photo.credit)}${photo.credit === "Unsplash" ? "" : " / Unsplash"}</a></p>`,
      );
    }),
  );

  // Game 1: drag-and-drop with an equivalent click/touch/keyboard flow.
  if ($("#game-sort")) {
    let items = root.NadhiGames.makeSortRound();
    let selectedItem = null;
    let sortedItems = new Set();
    let mistakes = 0;

    function renderSort() {
      $("#sort-items").innerHTML = items
        .map(
          (item) =>
            `<button class="sort-item" id="item-${item.id}" type="button" draggable="true" data-item="${item.id}" aria-pressed="false" aria-label="Pilih ${item.label}">${icon(item.icon)}<span>${item.label}</span></button>`,
        )
        .join("");
      $$("[data-item]").forEach((button) => {
        button.addEventListener("click", () => selectItem(button.dataset.item));
        button.addEventListener("dragstart", (event) => {
          selectItem(button.dataset.item);
          event.dataTransfer.setData("text/plain", button.dataset.item);
          event.dataTransfer.effectAllowed = "move";
        });
        button.addEventListener("dragend", () =>
          $$(".bin").forEach((bin) => bin.classList.remove("drag-over")),
        );
      });
    }
    function selectItem(id) {
      if (sortedItems.has(id) || !items.some((item) => item.id === id)) return;
      selectedItem = id;
      $$("[data-item]").forEach((button) =>
        button.setAttribute("aria-pressed", String(button.dataset.item === id)),
      );
      $("#sort-feedback").textContent =
        `${items.find((item) => item.id === id).label} dipilih. Pilih wadah organik atau anorganik.`;
    }
    function sortInto(bin, id = selectedItem) {
      const item = items.find((entry) => entry.id === id);
      if (!item || sortedItems.has(id)) {
        $("#sort-feedback").textContent =
          "Pilih salah satu kartu sampah terlebih dahulu.";
        return;
      }
      if (item.bin !== bin) {
        mistakes += 1;
        $("#sort-feedback").textContent =
          `Belum tepat. ${item.reason} Coba pilih wadah lainnya.`;
        return;
      }
      sortedItems.add(id);
      selectedItem = null;
      const button = $(`#item-${id}`);
      button.disabled = true;
      button.draggable = false;
      button.setAttribute("aria-pressed", "false");
      button.innerHTML = `${icon("check")}<span>${item.label}</span>`;
      $("#sort-score").textContent =
        `${sortedItems.size} / ${items.length} terpilah`;
      $("#sort-feedback").textContent =
        sortedItems.size === items.length
          ? `Semua terpilah! ${mistakes === 0 ? "Sempurna, tanpa salah pilih." : `Kamu belajar dari ${mistakes} percobaan yang belum tepat.`} Bawa kebiasaan baik ini ke rumah.`
          : `Tepat! ${item.reason}`;
      const next = $("#sort-items button:not(:disabled)") || $("#sort-restart");
      next.focus({ preventScroll: true });
    }
    $$(".bin").forEach((bin) => {
      bin.addEventListener("click", () => sortInto(bin.dataset.bin));
      bin.addEventListener("dragover", (event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        bin.classList.add("drag-over");
      });
      bin.addEventListener("dragleave", () =>
        bin.classList.remove("drag-over"),
      );
      bin.addEventListener("drop", (event) => {
        event.preventDefault();
        bin.classList.remove("drag-over");
        sortInto(bin.dataset.bin, event.dataTransfer.getData("text/plain"));
      });
    });
    $("#sort-restart").addEventListener("click", () => {
      items = root.NadhiGames.makeSortRound(items.map((item) => item.id));
      selectedItem = null;
      sortedItems = new Set();
      mistakes = 0;
      renderSort();
      $("#sort-score").textContent = `0 / ${items.length} terpilah`;
      $("#sort-feedback").textContent =
        "Kartu baru sudah diacak. Yuk, pilah delapan benda berikutnya!";
      $("#sort-items button").focus();
    });
    renderSort();

    // Game 2: five-question quiz. Progress stays in memory, never in storage.
    let questions = root.NadhiGames.makeQuizRound();
    let quizIndex = 0;
    let quizScore = 0;
    let quizAnswered = false;
    function renderQuiz() {
      quizAnswered = false;
      const question = questions[quizIndex];
      $("#quiz-progress").textContent =
        `${quizIndex + 1} / ${questions.length}`;
      $("#quiz-content").innerHTML =
        `<h4 class="quiz-question" tabindex="-1">${question.question}</h4><div class="quiz-options">${question.answers.map((answer, index) => `<button type="button" class="quiz-option" data-answer="${index}"><span>${String.fromCharCode(65 + index)}</span>${answer}</button>`).join("")}</div><div id="quiz-explanation" class="quiz-explanation" role="status" hidden></div><button type="button" class="button button-lime quiz-next" id="quiz-next" hidden>${quizIndex === questions.length - 1 ? "Lihat hasil" : "Pertanyaan berikutnya"} ${icon("arrow")}</button>`;
      $$("[data-answer]").forEach((button) =>
        button.addEventListener("click", () => {
          if (quizAnswered) return;
          quizAnswered = true;
          const chosen = Number(button.dataset.answer);
          const correct = chosen === question.correct;
          if (correct) quizScore += 1;
          $$("[data-answer]").forEach((option) => {
            option.disabled = true;
            if (Number(option.dataset.answer) === question.correct)
              option.classList.add("correct");
          });
          if (!correct) button.classList.add("incorrect");
          $("#quiz-explanation").hidden = false;
          $("#quiz-explanation").textContent =
            `${correct ? "Tepat!" : "Belum tepat."} ${question.explanation}`;
          $("#quiz-next").hidden = false;
          $("#quiz-next").focus({ preventScroll: true });
        }),
      );
      $("#quiz-next").addEventListener("click", () => {
        if (!quizAnswered) return;
        quizIndex += 1;
        if (quizIndex < questions.length) {
          renderQuiz();
          $(".quiz-question").focus({ preventScroll: true });
        } else {
          $("#quiz-progress").textContent = "Selesai";
          $("#quiz-content").innerHTML =
            `<div class="quiz-result" role="status">${icon("cup")}<h3>${quizScore} dari ${questions.length} jawaban tepat.</h3><p>${quizScore === questions.length ? "Pengetahuanmu siap menjadi aksi. Ajak satu orang lagi untuk mulai memilah!" : "Setiap pertanyaan adalah kesempatan belajar. Coba lagi dan bawa ilmunya ke rumah."}</p><button type="button" class="button button-lime" id="quiz-restart">Main lagi ${icon("cycle")}</button></div>`;
          $("#quiz-restart").addEventListener("click", restartQuiz);
          $("#quiz-restart").focus({ preventScroll: true });
        }
      });
    }
    function restartQuiz() {
      questions = root.NadhiGames.makeQuizRound(
        questions.map((question) => question.id),
      );
      quizIndex = 0;
      quizScore = 0;
      renderQuiz();
      $(".quiz-question").focus({ preventScroll: true });
    }
    $("#quiz-reset").addEventListener("click", restartQuiz);
    renderQuiz();
    function activateTab(tab) {
      $$('[role="tab"]').forEach((button) => {
        const active = button === tab;
        button.setAttribute("aria-selected", String(active));
        button.tabIndex = active ? 0 : -1;
        $(`#${button.getAttribute("aria-controls")}`).hidden = !active;
      });
    }
    $$('[role="tab"]').forEach((tab, index, tabs) => {
      tab.addEventListener("click", () => activateTab(tab));
      tab.addEventListener("keydown", (event) => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
          return;
        event.preventDefault();
        const next =
          event.key === "Home"
            ? tabs[0]
            : event.key === "End"
              ? tabs[tabs.length - 1]
              : tabs[
                  (index + (event.key === "ArrowRight" ? 1 : tabs.length - 1)) %
                    tabs.length
                ];
        activateTab(next);
        next.focus();
      });
    });
  } // Educational games initialize only on edukasi.html.

  // Progressive motion: content remains visible if observers are unsupported.
  if ("IntersectionObserver" in window) {
    if (!reduceMotion()) {
      const revealObserver = new IntersectionObserver(
        (entries) =>
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add("is-visible");
              revealObserver.unobserve(entry.target);
            }
          }),
        { threshold: 0.06 },
      );
      $$(".reveal").forEach((element) => {
        element.classList.add("is-ready");
        revealObserver.observe(element);
      });
    }
    // Navigation state is declared by each HTML page, not scroll position.
  }

  saveState();
  renderLeaderboard();
  if ($("#leaderboard")) {
    let handoff;
    try {
      if (location.hash.startsWith("#setoran=")) {
        handoff = JSON.parse(decodeURIComponent(location.hash.slice(9)));
        try {
          history.replaceState(null, "", location.href.split("#")[0]);
        } catch (_) {}
      } else {
        const stored = sessionStorage.getItem("nadhi.deposit.handoff");
        sessionStorage.removeItem("nadhi.deposit.handoff");
        if (stored) handoff = JSON.parse(stored);
      }
      if (
        handoff &&
        handoff.period === getPeriod().key &&
        Number.isFinite(handoff.createdAt) &&
        Date.now() - handoff.createdAt >= 0 &&
        Date.now() - handoff.createdAt < 300000 &&
        BANJARS.some((b) => b.id === handoff.highlight)
      ) {
        // Shared storage already contains the latest values. Use the snapshot
        // only when shared storage is unavailable or files have separate origins.
        if (location.protocol === "file:" || !storageAvailable) {
          state = normalizeState(handoff.state);
          saveState();
        }
        renderLeaderboard(handoff.highlight);
        const banner = $("#deposit-success");
        banner.hidden = false;
        banner.textContent =
          typeof handoff.message === "string"
            ? handoff.message.slice(0, 600)
            : "Setoran berhasil disimulasikan.";
        if (!storageAvailable)
          banner.textContent +=
            " Data hanya tersedia selama halaman ini terbuka.";
      }
    } catch (_) {
      /* Ignore missing, stale, or malformed navigation data. */
    }
  }
  updateCountdown();
  syncWasteFields();
  updateEstimate();
  const clockInterval = window.setInterval(updateCountdown, 1000);
  $("#copyright-year").textContent = new Date().getFullYear();
  window.addEventListener("storage", (event) => {
    if (event.key === STORAGE_KEY || event.key === null) {
      state = readState();
      renderLeaderboard();
      updateCountdown();
    }
    if (event.key === THEME_KEY && ["light", "dark"].includes(event.newValue))
      applyTheme(event.newValue);
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      state = readState();
      saveState();
      renderLeaderboard();
      updateCountdown();
    }
  });

  // Optional native agent interface; safely ignored in ordinary browsers.
  // Uses the exact same calculations and submission path as the visible UI.
  const context = document.modelContext;
  if (
    $("#deposit-form") &&
    context &&
    typeof context.registerTool === "function"
  ) {
    const lifecycle = new AbortController();
    const tool = {
      name: "simulate_organic_deposit",
      title: "Simulasikan setoran organik",
      description:
        "Add an educational organic-waste deposit to the current device-local monthly Banjar leaderboard and show the result. This does not submit a physical deposit or claim a reward.",
      inputSchema: {
        type: "object",
        properties: {
          items: {
            type: "array",
            minItems: 1,
            maxItems: 3,
            items: {
              type: "object",
              properties: {
                waste: { type: "string", enum: Object.keys(WASTE) },
                weight: {
                  type: "number",
                  minimum: 0.1,
                  maximum: 1000,
                  multipleOf: 0.1,
                },
              },
              required: ["waste", "weight"],
              additionalProperties: false,
            },
          },
          origin: { type: "string", enum: Object.keys(ORIGINS) },
          banjar: { type: "string", enum: BANJARS.map((banjar) => banjar.id) },
        },
        required: ["items", "origin", "banjar"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input) {
        if (
          !input ||
          typeof input !== "object" ||
          !Array.isArray(input.items) ||
          input.items.some(
            (item) =>
              !item ||
              typeof item.weight !== "number" ||
              Object.keys(item).some(
                (key) => !["weight", "waste"].includes(key),
              ),
          ) ||
          Object.keys(input).some(
            (key) => !["items", "origin", "banjar"].includes(key),
          )
        ) {
          throw new Error("Input simulasi tidak valid.");
        }
        calculateDeposit(input);
        if (!BANJARS.some((banjar) => banjar.id === input.banjar))
          throw new Error("Banjar tidak valid.");
        $$('input[name="waste"]').forEach((checkbox) => {
          const item = input.items.find(
            (entry) => entry.waste === checkbox.value,
          );
          checkbox.checked = Boolean(item);
          if (item) $(`#weight-${checkbox.value}`).value = item.weight;
        });
        $(`input[name="origin"][value="${input.origin}"]`).checked = true;
        $("#banjar").value = input.banjar;
        syncWasteFields();
        updateEstimate();
        return submitDeposit(input);
      },
    };
    try {
      Promise.resolve(
        context.registerTool(tool, { signal: lifecycle.signal }),
      ).catch(() => {});
    } catch (_) {
      /* Browser support is optional. */
    }
    window.addEventListener("pagehide", (event) => {
      if (!event.persisted) lifecycle.abort();
    });
  }
})(globalThis);
