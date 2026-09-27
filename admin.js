import { initializeApp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";
import { getFirestore, collection, onSnapshot, doc, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";
import { seedGifts } from "./gifts.js";

const app = initializeApp(firebaseConfig), auth = getAuth(app), db = getFirestore(app);
const $ = id => document.getElementById(id);
let gifts = [];

$("loginForm").addEventListener("submit", async e => {
  e.preventDefault();
  try {
    await signInWithEmailAndPassword(auth, $("email").value.trim(), $("password").value);
    $("loginMessage").classList.add("hidden");
  } catch (err) {
    console.error(err);
    $("loginMessage").textContent = "Não foi possível entrar. Confira o e-mail e a senha.";
    $("loginMessage").classList.remove("hidden");
  }
});

$("logout").addEventListener("click", () => signOut(auth));

onAuthStateChanged(auth, user => {
  $("loginCard").classList.toggle("hidden", !!user);
  $("adminPanel").classList.toggle("hidden", !user);
  if (user) startAdmin();
});

function startAdmin() {
  onSnapshot(collection(db, "gifts"), snap => {
    gifts = snap.empty ? seedGifts.map(g => ({...g})) : snap.docs.map(d => ({id:d.id,...d.data()}));
    render();
  });
}

function render() {
  $("totalStat").textContent = gifts.length;
  $("visibleStat").textContent = gifts.filter(g => g.visible !== false).length;
  $("reservedStat").textContent = gifts.filter(g => g.reserved === true).length;
  const cats = ["Todos", ...new Set(gifts.map(g => g.category))];
  const oldCat = $("adminCategory").value;
  $("adminCategory").innerHTML = cats.map(c => `<option value="${c}">${c}</option>`).join("");
  if (cats.includes(oldCat)) $("adminCategory").value = oldCat;

  const q = $("adminSearch").value.toLowerCase().trim();
  const cat = $("adminCategory").value;
  const list = gifts.filter(g => (cat === "Todos" || g.category === cat) && `${g.name} ${g.category}`.toLowerCase().includes(q));
  $("manageList").innerHTML = list.map(g => `
    <div class="manage-item">
      <span class="manage-emoji">${g.emoji || "🎁"}</span>
      <div class="manage-info"><b>${g.name}</b><small>${g.category}${g.reserved ? ` · 🔴 reservado por ${g.reservedBy || "convidado"}` : ""}</small></div>
      <label class="switch"><input type="checkbox" data-visible="${g.id}" ${g.visible !== false ? "checked" : ""}><span></span></label>
      ${g.reserved ? `<button class="mini-action" data-release="${g.id}">Liberar</button>` : ""}
    </div>`).join("");

  document.querySelectorAll("[data-visible]").forEach(input => input.addEventListener("change", async e => {
    e.target.disabled = true;
    await updateDoc(doc(db, "gifts", e.target.dataset.visible), {visible: e.target.checked});
  }));
  document.querySelectorAll("[data-release]").forEach(btn => btn.addEventListener("click", async () => {
    await updateDoc(doc(db, "gifts", btn.dataset.release), {reserved:false, reservedBy:"", reservedAt:null});
  }));
}

$("adminSearch").addEventListener("input", render);
$("adminCategory").addEventListener("change", render);

$("syncButton").addEventListener("click", async () => {
  if (!confirm("Sincronizar os 100 presentes? Reservas e visibilidade existentes serão preservadas.")) return;
  $("syncButton").disabled = true;
  try {
    for (const g of seedGifts) {
      await setDoc(doc(db, "gifts", g.id), {
        name:g.name, category:g.category, emoji:g.emoji, description:g.description
      }, {merge:true});
    }
    alert("Os 100 presentes foram sincronizados.");
  } catch (err) {
    console.error(err);
    alert("Falha ao publicar. Confira as regras do Firestore e sua autenticação.");
  } finally {
    $("syncButton").disabled = false;
  }
});
