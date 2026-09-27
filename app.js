import { initializeApp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";
import {
  getFirestore, collection, onSnapshot, doc, runTransaction, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";
import { seedGifts } from "./gifts.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const $ = (id) => document.getElementById(id);
let gifts = seedGifts.map(g => ({...g}));
let selectedGift = null;

const esc = (v) => String(v ?? "").replace(/[&<>"']/g, c => ({
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
}[c]));

function setConnection(text, ok=false) {
  const el = $("connection");
  el.textContent = text;
  el.className = `connection ${ok ? "ok" : ""}`;
}

function populateCategories() {
  const cats = [...new Set(gifts.map(g => g.category))];
  $("category").innerHTML = `<option value="Todos">Todas as categorias</option>` +
    cats.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join("");
}

function render() {
  const q = $("search").value.trim().toLowerCase();
  const cat = $("category").value;
  const visible = gifts.filter(g => g.visible !== false);
  const filtered = visible.filter(g => {
    const matchesCat = cat === "Todos" || g.category === cat;
    const hay = `${g.name} ${g.description} ${g.category}`.toLowerCase();
    return matchesCat && hay.includes(q);
  });

  $("availableCount").textContent = visible.filter(g => !g.reserved).length;
  $("publishedCount").textContent = visible.length;
  $("resultInfo").textContent = `${filtered.length} ${filtered.length === 1 ? "presente encontrado" : "presentes encontrados"}`;

  $("giftGrid").innerHTML = filtered.length ? filtered.map(g => {
    const reserved = g.reserved === true;
    return `<article class="gift-card">
      <div class="gift-art">${esc(g.emoji || "🎁")}</div>
      <div class="gift-body">
        <span class="tag">${esc(g.category)}</span>
        <h3>${esc(g.name)}</h3>
        <p>${esc(g.description)}</p>
        <div class="gift-bottom">
          <span class="status ${reserved ? "reserved" : "available"}">${reserved ? "🔴 Já reservado" : "🟢 Disponível"}</span>
          <button class="btn ${reserved ? "btn-disabled" : "btn-primary"}" ${reserved ? "disabled" : ""} data-gift="${esc(g.id)}">
            ${reserved ? "Reservado" : "Quero dar este presente"}
          </button>
        </div>
      </div>
    </article>`;
  }).join("") : `<div class="empty"><div>🔎</div><h3>Nenhum presente encontrado</h3><p>Tente outra palavra ou categoria.</p></div>`;

  document.querySelectorAll("[data-gift]").forEach(btn => {
    btn.addEventListener("click", () => openModal(btn.dataset.gift));
  });
}

function openModal(id) {
  selectedGift = gifts.find(g => g.id === id);
  if (!selectedGift || selectedGift.reserved || selectedGift.visible === false) return;
  $("modalEmoji").textContent = selectedGift.emoji || "🎁";
  $("modalTitle").textContent = selectedGift.name;
  $("modalDescription").textContent = selectedGift.description;
  $("guestName").value = "";
  $("modal").classList.remove("hidden");
  $("modal").setAttribute("aria-hidden", "false");
  setTimeout(() => $("guestName").focus(), 50);
}

function closeModal() {
  $("modal").classList.add("hidden");
  $("modal").setAttribute("aria-hidden", "true");
  selectedGift = null;
}

async function reserveGift() {
  const name = $("guestName").value.trim();
  if (!selectedGift || name.length < 2) {
    $("guestName").focus();
    return;
  }
  const id = selectedGift.id;
  const button = $("confirmBtn");
  button.disabled = true;
  button.textContent = "Reservando...";
  try {
    await runTransaction(db, async transaction => {
      const ref = doc(db, "gifts", id);
      const snap = await transaction.get(ref);
      if (!snap.exists()) throw new Error("not-found");
      const data = snap.data();
      if (data.reserved === true) throw new Error("already-reserved");
      transaction.update(ref, {
        reserved: true,
        reservedBy: name,
        reservedAt: serverTimestamp()
      });
    });
    closeModal();
    alert("Presente reservado com sucesso! ❤️");
  } catch (err) {
    console.error(err);
    if (err.message === "already-reserved") {
      alert("Esse presente acabou de ser reservado por outra pessoa. Escolha outro item.");
    } else {
      alert("Não foi possível reservar agora. Verifique sua conexão e tente novamente.");
    }
  } finally {
    button.disabled = false;
    button.textContent = "Confirmar reserva ❤️";
  }
}

$("search").addEventListener("input", render);
$("category").addEventListener("change", render);
$("closeModal").addEventListener("click", closeModal);
document.querySelectorAll("[data-close]").forEach(el => el.addEventListener("click", closeModal));
$("confirmBtn").addEventListener("click", reserveGift);
document.addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });

populateCategories();
render();

onSnapshot(collection(db, "gifts"), snapshot => {
  if (snapshot.empty) {
    gifts = seedGifts.map(g => ({...g}));
    setConnection("Lista online ainda não publicada no Firestore — mostrando as 200 opções locais.", false);
  } else {
    gifts = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    setConnection("Lista sincronizada em tempo real.", true);
    populateCategories();
  }
  render();
}, error => {
  console.error(error);
  setConnection("Modo local: o Firebase ainda precisa ser configurado/publicado.", false);
  gifts = seedGifts.map(g => ({...g}));
  render();
});
