/* Native game data and random rounds. No progress is persisted. */
(function (root) {
  'use strict';
  const SORT_ITEMS = [
    { id: 'flower', label: 'Bunga canang', bin: 'organik', icon: 'flower', reason: 'Bunga canang yang sudah dipisahkan dari plastik termasuk organik.' },
    { id: 'janur', label: 'Janur terpilah', bin: 'organik', icon: 'leaf', reason: 'Janur berasal dari daun. Pisahkan staples dan plastik sebelum mengolahnya.' },
    { id: 'leaves', label: 'Daun kering', bin: 'organik', icon: 'leaf', reason: 'Daun kering termasuk organik dan dapat menjadi campuran kompos.' },
    { id: 'banana', label: 'Kulit pisang', bin: 'organik', icon: 'fruit', reason: 'Kulit pisang merupakan sisa buah yang termasuk organik.' },
    { id: 'orange', label: 'Kulit jeruk', bin: 'organik', icon: 'fruit', reason: 'Kulit jeruk berasal dari buah dan dipilah sebagai organik.' },
    { id: 'coffee', label: 'Ampas kopi', bin: 'organik', icon: 'mug', reason: 'Ampas kopi tanpa kemasan merupakan bahan organik.' },
    { id: 'tea', label: 'Daun teh seduh', bin: 'organik', icon: 'mug', reason: 'Daun teh seduh tanpa kantong, benang, dan staples masuk organik.' },
    { id: 'vegetable', label: 'Sisa sayuran', bin: 'organik', icon: 'leaf', reason: 'Potongan sayuran tanpa kemasan termasuk bahan organik.' },
    { id: 'grass', label: 'Potongan rumput', bin: 'organik', icon: 'sprout', reason: 'Rumput merupakan bahan tumbuhan yang termasuk organik.' },
    { id: 'twig', label: 'Ranting kecil', bin: 'organik', icon: 'sprout', reason: 'Ranting alami termasuk organik, meskipun lebih lambat terurai daripada daun.' },
    { id: 'coconut', label: 'Ampas kelapa', bin: 'organik', icon: 'fruit', reason: 'Ampas kelapa tanpa campuran kemasan termasuk organik.' },
    { id: 'eggshell', label: 'Cangkang telur', bin: 'organik', icon: 'egg', reason: 'Dalam pemilahan sampah rumah tangga, cangkang telur dipisahkan bersama sisa dapur organik.' },
    { id: 'plastic', label: 'Botol plastik', bin: 'anorganik', icon: 'bottle', reason: 'Botol plastik masuk anorganik. Pisahkan sesuai jenis yang diterima pengelola.' },
    { id: 'can', label: 'Kaleng minuman', bin: 'anorganik', icon: 'can', reason: 'Kaleng berbahan logam masuk anorganik.' },
    { id: 'glass', label: 'Botol kaca', bin: 'anorganik', icon: 'bottle', reason: 'Botol kaca dipilah sebagai anorganik dan ditangani dengan hati-hati.' },
    { id: 'bag', label: 'Kantong plastik', bin: 'anorganik', icon: 'bag', reason: 'Kantong plastik masuk anorganik; kurangi pemakaiannya dengan tas pakai ulang.' },
    { id: 'sachet', label: 'Saset kopi', bin: 'anorganik', icon: 'packet', reason: 'Kemasan saset termasuk anorganik meskipun isinya berasal dari tumbuhan.' },
    { id: 'straw', label: 'Sedotan plastik', bin: 'anorganik', icon: 'straw', reason: 'Sedotan plastik adalah anorganik, bukan bahan kompos.' },
    { id: 'cap', label: 'Tutup botol plastik', bin: 'anorganik', icon: 'coins', reason: 'Tutup botol plastik dipilah sebagai anorganik.' },
    { id: 'shampoo', label: 'Botol sampo kosong', bin: 'anorganik', icon: 'bottle', reason: 'Botol sampo plastik yang kosong termasuk anorganik.' },
    { id: 'detergent', label: 'Pouch detergen kosong', bin: 'anorganik', icon: 'packet', reason: 'Pouch detergen adalah kemasan anorganik. Ikuti arahan pengelola setempat.' },
    { id: 'foil', label: 'Aluminium foil', bin: 'anorganik', icon: 'packet', reason: 'Aluminium foil berbahan logam dan masuk anorganik.' },
    { id: 'wrapper', label: 'Bungkus makanan ringan', bin: 'anorganik', icon: 'packet', reason: 'Bungkus plastik atau kemasan berlapis termasuk anorganik.' },
    { id: 'cup', label: 'Gelas plastik', bin: 'anorganik', icon: 'mug', reason: 'Gelas plastik masuk anorganik. Penerimaan daur ulang mengikuti jenis bahannya.' }
  ];

  const QUIZ_QUESTIONS = [
    { id: 'canang', question: 'Apa yang harus dipisahkan dari sisa canang sebelum dikomposkan?', answers: ['Bunga dan janur', 'Plastik, uang, dan staples', 'Daun kering', 'Semua bahan harus dibakar'], correct: 1, explanation: 'Pisahkan plastik, uang sesari, serta staples. Bunga dan janur yang bersih dapat masuk bahan organik.' },
    { id: 'palemahan', question: 'Dalam Tri Hita Karana, harmoni dengan alam disebut…', answers: ['Pawongan', 'Parahyangan', 'Palemahan', 'Perarem'], correct: 2, explanation: 'Palemahan berkaitan dengan harmoni manusia dan alam.' },
    { id: 'bottle', question: 'Apa yang membantu mengurangi sampah saat gotong royong?', answers: ['Mencampur semua sampah', 'Membakar plastik', 'Membawa botol minum pakai ulang', 'Membuang sampah ke sungai'], correct: 2, explanation: 'Botol pakai ulang membantu mengurangi kebutuhan kemasan sekali pakai.' },
    { id: 'compost', question: 'Bahan mana yang dapat dipilah untuk kompos?', answers: ['Baterai', 'Botol kaca', 'Kaleng minuman', 'Daun kering dan kulit buah'], correct: 3, explanation: 'Daun kering dan kulit buah merupakan bahan organik. Baterai perlu penanganan tersendiri.' },
    { id: 'origin', question: 'Mengapa asal setoran perlu dicatat dengan jujur?', answers: ['Agar konteks kegiatan dan bonus sesuai', 'Supaya sampah terlihat lebih berat', 'Agar setoran yang sama dihitung ulang', 'Supaya tidak perlu memilah'], correct: 0, explanation: 'Asal setoran memberi konteks kegiatan yang tepat. Setoran fisik yang sama tidak boleh dihitung berulang.' },
    { id: 'pawongan', question: 'Gotong royong bersama warga mencerminkan nilai…', answers: ['Pawongan', 'Memboroskan bahan', 'Mengabaikan tetangga', 'Menumpuk sampah'], correct: 0, explanation: 'Pawongan adalah harmoni antarmanusia, antara lain melalui kerja sama dan kepedulian.' },
    { id: 'parahyangan', question: 'Harmoni manusia dengan Tuhan dalam Tri Hita Karana disebut…', answers: ['Palemahan', 'Pawongan', 'Parahyangan', 'Pemilahan'], correct: 2, explanation: 'Parahyangan berkaitan dengan hubungan manusia dan Tuhan.' },
    { id: 'source', question: 'Kapan sebaiknya sampah mulai dipilah?', answers: ['Saat sudah tercampur di sungai', 'Sejak dari rumah atau sumbernya', 'Setelah semua dibakar', 'Hanya saat ada lomba'], correct: 1, explanation: 'Memilah sejak sumber membantu menjaga bahan organik dan material lain tidak tercampur.' },
    { id: 'janur', question: 'Janur canang yang sudah bebas staples dan plastik masuk kelompok…', answers: ['Limbah elektronik', 'Kaca', 'Logam', 'Organik'], correct: 3, explanation: 'Janur berasal dari daun sehingga termasuk bahan organik setelah dipilah.' },
    { id: 'sachet', question: 'Ke mana kemasan saset kopi yang kosong dipilah?', answers: ['Ke kompos karena berisi kopi', 'Ke anorganik sesuai arahan pengelola', 'Ke sungai', 'Ke wadah daun kering'], correct: 1, explanation: 'Ampas kopi dan kemasannya berbeda. Saset adalah bahan anorganik dan tidak semuanya dapat didaur ulang.' },
    { id: 'shop', question: 'Kebiasaan belanja mana yang membantu mengurangi kemasan?', answers: ['Meminta banyak kantong baru', 'Membungkus setiap barang berulang', 'Membawa tas dan wadah pakai ulang', 'Membuang bungkus di jalan'], correct: 2, explanation: 'Tas dan wadah pakai ulang membantu mengurangi kemasan sekali pakai.' },
    { id: 'coffee', question: 'Ampas kopi tanpa kemasan termasuk…', answers: ['Organik', 'Kaca', 'Plastik', 'Logam'], correct: 0, explanation: 'Ampas kopi berasal dari bahan tumbuhan dan dapat dipilah sebagai organik.' },
    { id: 'labels', question: 'Apa yang perlu diperiksa sebelum memasukkan sampah ke wadah di tempat umum?', answers: ['Hanya warna wadah', 'Ukuran tutupnya saja', 'Wadah mana yang paling jauh', 'Label jenis sampah pada wadah'], correct: 3, explanation: 'Baca label. Warna dan jenis wadah dapat berbeda antarlokasi.' },
    { id: 'weight', question: 'Bagaimana menimbang setoran organik secara jujur?', answers: ['Tambahkan air agar berat', 'Campurkan batu', 'Timbang bahan terpilah tanpa tambahan pemberat', 'Masukkan semua kemasan'], correct: 2, explanation: 'Berat setoran harus mencerminkan bahan organik yang diterima, tanpa tambahan air, batu, atau material lain.' },
    { id: 'glass', question: 'Botol kaca yang utuh termasuk kelompok…', answers: ['Organik untuk kompos', 'Anorganik', 'Sisa tanaman', 'Daun kering'], correct: 1, explanation: 'Kaca dipilah sebagai anorganik. Tetap tangani dengan hati-hati dan ikuti petunjuk pengelola.' },
    { id: 'reuse', question: 'Wadah pakai ulang yang masih layak sebaiknya…', answers: ['Dibuang setelah sekali dipakai', 'Dibakar bersama plastik', 'Ditinggalkan di pantai', 'Dibersihkan dan digunakan kembali'], correct: 3, explanation: 'Menggunakan kembali barang yang layak membantu mengurangi kebutuhan barang sekali pakai.' },
    { id: 'plasticcompost', question: 'Mengapa plastik perlu dipisahkan dari bahan kompos?', answers: ['Plastik bukan bahan kompos', 'Plastik berubah menjadi daun', 'Plastik membuat semua bahan organik', 'Plastik harus ditambahkan sebanyak mungkin'], correct: 0, explanation: 'Plastik biasa bukan bahan kompos dan dapat mencemari hasil pengolahan organik.' },
    { id: 'community', question: 'Setelah gotong royong selesai, kebiasaan mana yang perlu dilanjutkan?', answers: ['Mencampur sampah lagi', 'Menunggu lomba berikutnya', 'Memilah setiap hari dan mengajak keluarga', 'Membuang sampah ke lahan kosong'], correct: 2, explanation: 'Kebiasaan sehari-hari membantu dampak kegiatan bersama terus berlanjut.' }
  ];

  function shuffle(values, rng = Math.random) {
    const result = [...values];
    for (let i = result.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  // Guarantee a changed selection on replay, even if random draws repeat.
  function freshSelection(pool, count, previousIds, rng) {
    const selected = shuffle(pool, rng).slice(0, count);
    const previous = new Set(previousIds);
    if (selected.every(item => previous.has(item.id))) {
      const alternative = shuffle(pool.filter(item => !previous.has(item.id)), rng)[0];
      if (alternative) selected[selected.length - 1] = alternative;
    }
    return selected;
  }

  function differentOpening(round, previousIds) {
    if (round.length > 1 && round[0].id === previousIds[0]) round.push(round.shift());
    return round;
  }

  function makeSortRound(previousIds = [], rng = Math.random) {
    const chosen = ['organik', 'anorganik'].flatMap(bin =>
      freshSelection(SORT_ITEMS.filter(item => item.bin === bin), 4, previousIds, rng));
    return differentOpening(shuffle(chosen, rng), previousIds);
  }

  function makeQuizRound(previousIds = [], rng = Math.random) {
    const chosen = differentOpening(freshSelection(QUIZ_QUESTIONS, 5, previousIds, rng), previousIds);
    return chosen.map(question => {
      const options = shuffle(question.answers.map((answer, index) => ({ answer, correct: index === question.correct })), rng);
      return { ...question, answers: options.map(option => option.answer), correct: options.findIndex(option => option.correct) };
    });
  }

  const api = { SORT_ITEMS, QUIZ_QUESTIONS, shuffle, makeSortRound, makeQuizRound };
  root.NadhiGames = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
