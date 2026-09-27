import { initializeApp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";
import { getFirestore, collection, getDocs, doc, runTransaction } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";
import { firebaseConfig, seedGifts } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
let gifts = [], selectedGift = null;
const $ = id => document.getElementById(id);
const localSeed = () => seedGifts.map(g => ({...g}));

async function loadGifts() {
  const snap = await getDocs(collection(db, "gifts"));
  gifts = snap.empty ? localSeed() : snap.docs.map(d => ({id:d.id, ...d.data()}));
  render();
}

function render() {
  const q = $("search").value.toLowerCase().trim();
  const cat = $("category").value;
  const visible = gifts.filter(g => g.visible !== false);
  const filtered = visible.filter(g => (cat === "Todos" || g.category === cat) && (g.name.toLowerCase().includes(q) || g.description.toLowerCase().includes(q)));
  $("resultInfo").textContent = `${filtered.length} ${filtered.length === 1 ? "presente encontrado" : "presentes encontrados"}`;
  $("giftGrid").innerHTML = filtered.length ? filtered.map(g => `
    <article class="gift">
      <div class="gift-image">${g.emoji}</div><div class="gift-body">
      <span class="gift-category">${g.category}</span><h3>${g.name}</h3><p>${g.description}</p>
      <div class="status ${g.reserved ? "reserved" : "available"}">${g.reserved ? "🔴 Já reservado" : "🟢 Disponível"}</div>
      <button ${g.reserved ? "disabled" : ""} data-id="${g.id}">${g.reserved ? "Presente reservado" : "Quero dar este presente"}</button>
      </div></article>`).join("") : '<div class="empty">🔎<br><strong>Nenhum presente encontrado</strong><br>Tente outro nome ou categoria.</div>';
  $("availableCount").textContent = visible.filter(g => !g.reserved).length;
  $("visibleCount").textContent = visible.length;
  document.querySelectorAll(".gift button:not([disabled])").forEach(b => b.onclick = () => openReservation(b.dataset.id));
}
function openReservation(id) { selectedGift=gifts.find(g=>g.id===id); if(!selectedGift||selectedGift.reserved||selectedGift.visible===false)return; $("modalEmoji").textContent=selectedGift.emoji; $("modalTitle").textContent=selectedGift.name; $("modalDescription").textContent=selectedGift.description; $("guestName").value=""; $("modal").classList.remove("hidden"); $("guestName").focus(); }
function closeModal(){ $("modal").classList.add("hidden"); selectedGift=null; }
$("closeModal").onclick=closeModal;
$("modal").addEventListener("click",e=>{if(e.target===$("modal"))closeModal();});
$("search").addEventListener("input",render); $("category").addEventListener("change",render);
$("confirmBtn").onclick=async()=>{const name=$("guestName").value.trim();if(!name||!selectedGift)return;$("confirmBtn").disabled=true;try{const ref=doc(db,"gifts",selectedGift.id);await runTransaction(db,async tx=>{const snap=await tx.get(ref);if(!snap.exists())throw new Error("NOT_FOUND");const data=snap.data();if(data.reserved||data.visible===false)throw new Error("UNAVAILABLE");tx.update(ref,{reserved:true,reservedBy:name,reservedAt:new Date().toISOString()});});closeModal();$("notice").textContent=`❤️ Obrigado, ${name}! Sua reserva foi registrada.`;$("notice").style.display="block";await loadGifts();}catch(e){alert(e.message==="UNAVAILABLE"?"Esse presente não está mais disponível. Escolha outro. ❤️":"Não foi possível registrar a reserva. Tente novamente.");await loadGifts();}finally{$("confirmBtn").disabled=false;}};
loadGifts().catch(()=>{$("notice").textContent="Configure o Firebase para ativar as reservas online.";$("notice").style.display="block";gifts=localSeed();render();});
