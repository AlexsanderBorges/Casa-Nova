import { initializeApp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";

import {
  getFirestore,
  collection,
  onSnapshot,
  doc,
  runTransaction,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";

import { firebaseConfig } from "./firebase-config.js";
import { seedGifts } from "./gifts.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const $ = (id) => document.getElementById(id);

let gifts = seedGifts.map(gift => ({ ...gift }));
let selectedGift = null;
let firestoreReady = false;

const esc = (value) =>
  String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));

function setConnection(message, ok = false) {
  const element = $("connection");

  if (!element) return;

  element.textContent = message;
  element.className = `connection ${ok ? "ok" : ""}`;
}

function populateCategories() {
  const select = $("category");

  if (!select) return;

  const categories = [
    ...new Set(
      gifts
        .map(gift => gift.category)
        .filter(Boolean)
    )
  ].sort((a, b) => a.localeCompare(b, "pt-BR"));

  select.innerHTML =
    `<option value="Todos">Todas as categorias</option>` +
    categories
      .map(category =>
        `<option value="${esc(category)}">${esc(category)}</option>`
      )
      .join("");
}

function getVisibleGifts() {
  return gifts.filter(gift => gift.visible !== false);
}

function render() {
  const searchInput = $("search");
  const categorySelect = $("category");
  const grid = $("giftGrid");

  if (!searchInput || !categorySelect || !grid) return;

  const query = searchInput.value.trim().toLowerCase();
  const category = categorySelect.value;

  const visibleGifts = getVisibleGifts();

  const filteredGifts = visibleGifts.filter(gift => {
    const matchesCategory =
      category === "Todos" ||
      gift.category === category;

    const searchableText = [
      gift.name,
      gift.description,
      gift.category
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return matchesCategory && searchableText.includes(query);
  });

  const available = visibleGifts.filter(
    gift => gift.reserved !== true
  ).length;

  $("availableCount").textContent = available;
  $("publishedCount").textContent = visibleGifts.length;

  $("resultInfo").textContent =
    `${filteredGifts.length} ${
      filteredGifts.length === 1
        ? "presente encontrado"
        : "presentes encontrados"
    }`;

  if (filteredGifts.length === 0) {
    grid.innerHTML = `
      <div class="empty">
        <div>🔎</div>
        <h3>Nenhum presente encontrado</h3>
        <p>Tente outra palavra ou categoria.</p>
      </div>
    `;

    return;
  }

  grid.innerHTML = filteredGifts
    .map(gift => {
      const reserved = gift.reserved === true;

      const canReserve =
        firestoreReady &&
        !reserved;

      return `
        <article class="gift-card">

          <div class="gift-art">
            ${esc(gift.emoji || "🎁")}
          </div>

          <div class="gift-body">

            <span class="tag">
              ${esc(gift.category || "Casa")}
            </span>

            <h3>
              ${esc(gift.name)}
            </h3>

            <p>
              ${esc(gift.description || "")}
            </p>

            <div class="gift-bottom">

              <span class="status ${
                reserved
                  ? "reserved"
                  : "available"
              }">
                ${
                  reserved
                    ? "🔴 Já reservado"
                    : "🟢 Disponível"
                }
              </span>

              <button
                class="btn ${
                  canReserve
                    ? "btn-primary"
                    : "btn-disabled"
                }"
                ${
                  canReserve
                    ? ""
                    : "disabled"
                }
                data-gift="${esc(gift.id)}"
              >
                ${
                  reserved
                    ? "Reservado"
                    : firestoreReady
                      ? "Quero dar este presente"
                      : "Lista ainda não publicada"
                }
              </button>

            </div>
          </div>
        </article>
      `;
    })
    .join("");

  document
    .querySelectorAll("[data-gift]")
    .forEach(button => {
      button.addEventListener("click", () => {
        openModal(button.dataset.gift);
      });
    });
}

function openModal(id) {
  const gift = gifts.find(item => item.id === id);

  if (!gift) return;

  if (!firestoreReady) {
    alert("A lista ainda está sincronizando. Aguarde alguns segundos.");
    return;
  }

  if (gift.reserved === true) {
    alert("Esse presente já foi reservado.");
    return;
  }

  if (gift.visible === false) {
    return;
  }

  selectedGift = gift;

  $("modalEmoji").textContent =
    gift.emoji || "🎁";

  $("modalTitle").textContent =
    gift.name;

  $("modalDescription").textContent =
    gift.description || "";

  $("guestName").value = "";

  $("modal").classList.remove("hidden");
  $("modal").setAttribute("aria-hidden", "false");

  setTimeout(() => {
    $("guestName").focus();
  }, 50);
}

function closeModal() {
  $("modal").classList.add("hidden");
  $("modal").setAttribute("aria-hidden", "true");

  selectedGift = null;
}

/* =========================================================
   AVISO PERSONALIZADO DE RESERVA
========================================================= */

function showSuccessModal(giftName) {

  let style = document.getElementById("success-modal-style");

  if (!style) {
    style = document.createElement("style");

    style.id = "success-modal-style";

    style.textContent = `
      .success-modal{
        position:fixed;
        inset:0;
        z-index:100;
        display:grid;
        place-items:center;
        padding:20px;
        opacity:0;
        pointer-events:none;
        transition:opacity .25s ease;
      }

      .success-modal.show{
        opacity:1;
        pointer-events:auto;
      }

      .success-modal-backdrop{
        position:absolute;
        inset:0;
        background:rgba(5,46,22,.76);
        backdrop-filter:blur(7px);
      }

      .success-modal-card{
        position:relative;
        width:min(470px,100%);
        background:#fff;
        border:1px solid var(--line);
        border-radius:28px;
        padding:34px 28px 28px;
        text-align:center;
        box-shadow:0 30px 90px rgba(0,0,0,.30);
        transform:translateY(18px) scale(.97);
        transition:transform .3s ease;
      }

      .success-modal.show .success-modal-card{
        transform:translateY(0) scale(1);
      }

      .success-modal-close{
        position:absolute;
        top:10px;
        right:14px;
        width:38px;
        height:38px;
        border:0;
        background:transparent;
        color:#718078;
        font-size:30px;
        line-height:1;
        cursor:pointer;
        border-radius:50%;
      }

      .success-modal-close:hover{
        background:var(--green-50);
        color:var(--green-800);
      }

      .success-heart{
        width:82px;
        height:82px;
        margin:0 auto 18px;
        display:grid;
        place-items:center;
        border-radius:50%;
        background:var(--green-50);
        border:1px solid var(--green-100);
        font-size:42px;
        animation:successHeart .55s ease;
      }

      .success-kicker{
        display:block;
        color:var(--green-700);
        font-size:11px;
        font-weight:800;
        letter-spacing:2px;
        margin-bottom:8px;
      }

      .success-modal-card h2{
        color:var(--ink);
        margin:0 0 12px;
        font:700 clamp(30px,6vw,40px)/1.1 "Playfair Display",Georgia,serif;
      }

      .success-modal-card p{
        color:var(--muted);
        line-height:1.7;
        margin:0 auto 20px;
        max-width:370px;
      }

      .success-gift-name{
        display:inline-block;
        margin:4px auto 22px;
        padding:10px 16px;
        border-radius:12px;
        background:var(--green-50);
        border:1px solid var(--green-100);
        color:var(--green-900);
        font-weight:800;
        font-size:14px;
      }

      .success-modal-button{
        width:100%;
        border:0;
        border-radius:13px;
        padding:14px 18px;
        background:var(--green-700);
        color:#fff;
        font-weight:800;
        font-size:15px;
        cursor:pointer;
        transition:.2s;
      }

      .success-modal-button:hover{
        background:var(--green-900);
        transform:translateY(-1px);
      }

      .success-note{
        display:block;
        margin-top:12px;
        color:#7b897f;
        font-size:11px;
      }

      @keyframes successHeart{
        0%{
          opacity:0;
          transform:scale(.6);
        }

        70%{
          transform:scale(1.08);
        }

        100%{
          opacity:1;
          transform:scale(1);
        }
      }

      @media(max-width:520px){
        .success-modal{
          padding:16px;
        }

        .success-modal-card{
          border-radius:24px;
          padding:30px 22px 24px;
        }

        .success-heart{
          width:72px;
          height:72px;
          font-size:37px;
        }
      }
    `;

    document.head.appendChild(style);
  }

  const existing =
    document.getElementById("successModal");

  if (existing) {
    existing.remove();
  }

  const modal =
    document.createElement("div");

  modal.id = "successModal";
  modal.className = "success-modal";

  modal.innerHTML = `
    <div
      class="success-modal-backdrop"
      data-success-close
    ></div>

    <section
      class="success-modal-card"
      role="dialog"
      aria-modal="true"
      aria-labelledby="successModalTitle"
    >

      <button
        class="success-modal-close"
        type="button"
        aria-label="Fechar"
        data-success-close
      >
        ×
      </button>

      <div class="success-heart">
        💗
      </div>

      <span class="success-kicker">
        RESERVA CONFIRMADA
      </span>

      <h2 id="successModalTitle">
        Presente reservado!
      </h2>

      <p>
        Muito obrigado pelo carinho! ❤️
        Este presente foi reservado com sucesso
        e agora faz parte da nossa nova casa.
      </p>

      <div class="success-gift-name">
        🎁 ${esc(giftName)}
      </div>

      <button
        type="button"
        class="success-modal-button"
        data-success-close
      >
        Continuar
      </button>

      <small class="success-note">
        Obrigado por fazer parte desse momento especial. 🏠💕
      </small>

    </section>
  `;

  document.body.appendChild(modal);

  const closeSuccessModal = () => {
    modal.classList.remove("show");

    setTimeout(() => {
      modal.remove();
    }, 250);
  };

  modal
    .querySelectorAll("[data-success-close]")
    .forEach(element => {
      element.addEventListener(
        "click",
        closeSuccessModal
      );
    });

  const handleEscape = event => {
    if (event.key === "Escape") {
      closeSuccessModal();
      document.removeEventListener(
        "keydown",
        handleEscape
      );
    }
  };

  document.addEventListener(
    "keydown",
    handleEscape
  );

  requestAnimationFrame(() => {
    modal.classList.add("show");
  });
}

/* =========================================================
   RESERVA DO PRESENTE
========================================================= */

async function reserveGift() {

  const name =
    $("guestName").value.trim();

  if (!selectedGift) {
    return;
  }

  if (name.length < 2) {

    $("guestName").focus();

    alert(
      "Digite seu nome para reservar o presente."
    );

    return;
  }

  const giftId =
    selectedGift.id;

  const giftName =
    selectedGift.name;

  const button =
    $("confirmBtn");

  button.disabled = true;

  button.textContent =
    "Reservando...";

  try {

    await runTransaction(
      db,
      async transaction => {

        const giftRef =
          doc(
            db,
            "gifts",
            giftId
          );

        const giftSnapshot =
          await transaction.get(
            giftRef
          );

        if (!giftSnapshot.exists()) {
          throw new Error(
            "not-found"
          );
        }

        const currentGift =
          giftSnapshot.data();

        if (
          currentGift.reserved === true
        ) {
          throw new Error(
            "already-reserved"
          );
        }

        transaction.update(
          giftRef,
          {
            reserved: true,
            reservedBy: name,
            reservedAt:
              serverTimestamp()
          }
        );
      }
    );

    closeModal();

    showSuccessModal(
      giftName
    );

  } catch (error) {

    console.error(
      "Erro ao reservar presente:",
      error
    );

    if (
      error.message ===
      "already-reserved"
    ) {

      alert(
        "Esse presente acabou de ser reservado por outra pessoa. Escolha outro item."
      );

    } else if (
      error.message ===
      "not-found"
    ) {

      alert(
        "Esse presente não está mais disponível."
      );

    } else {

      alert(
        "Não foi possível reservar agora. Verifique sua conexão e tente novamente."
      );
    }

  } finally {

    button.disabled = false;

    button.textContent =
      "Confirmar reserva ❤️";
  }
}

function startListeners() {

  const giftsCollection =
    collection(
      db,
      "gifts"
    );

  onSnapshot(

    giftsCollection,

    snapshot => {

      /*
       * O Firestore pode possuir documentos antigos.
       * O site NÃO vai mostrar todos eles.
       *
       * A lista oficial é definida exclusivamente
       * por gifts.js.
       */

      const firestoreGifts =
        new Map(
          snapshot.docs.map(
            document => [
              document.id,
              {
                id: document.id,
                ...document.data()
              }
            ]
          )
        );

      gifts =
        seedGifts.map(
          seedGift => {

            const savedGift =
              firestoreGifts.get(
                seedGift.id
              );

            if (!savedGift) {

              return {
                ...seedGift,
                reserved: false,
                reservedBy: "",
                reservedAt: null,
                visible: true
              };
            }

            return {
              ...seedGift,
              ...savedGift,

              /*
               * O ID oficial sempre vem
               * do gifts.js.
               */
              id: seedGift.id
            };
          }
        );

      firestoreReady = true;

      setConnection(
        "Lista sincronizada em tempo real.",
        true
      );

      populateCategories();

      render();
    },

    error => {

      console.error(
        "Erro ao conectar ao Firestore:",
        error
      );

      firestoreReady = false;

      setConnection(
        "Não foi possível acessar a lista. Tente novamente em alguns instantes.",
        false
      );

      /*
       * Mesmo sem Firestore, mostramos
       * os 100 presentes oficiais.
       */

      gifts =
        seedGifts.map(
          gift => ({
            ...gift
          })
        );

      populateCategories();

      render();
    }
  );
}

/* =========================================================
   EVENTOS DA PÁGINA
========================================================= */

$("search").addEventListener(
  "input",
  render
);

$("category").addEventListener(
  "change",
  render
);

$("closeModal").addEventListener(
  "click",
  closeModal
);

document
  .querySelectorAll("[data-close]")
  .forEach(element => {

    element.addEventListener(
      "click",
      closeModal
    );

  });

$("confirmBtn").addEventListener(
  "click",
  reserveGift
);

document.addEventListener(
  "keydown",
  event => {

    if (
      event.key === "Escape" &&
      !$("modal").classList.contains("hidden")
    ) {
      closeModal();
    }

  }
);

/* =========================================================
   INICIALIZAÇÃO
========================================================= */

populateCategories();

render();

startListeners();
