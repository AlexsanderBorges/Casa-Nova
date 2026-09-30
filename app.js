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

async function reserveGift() {
  const name = $("guestName").value.trim();

  if (!selectedGift) {
    return;
  }

  if (name.length < 2) {
    $("guestName").focus();

    alert("Digite seu nome para reservar o presente.");

    return;
  }

  const giftId = selectedGift.id;
  const button = $("confirmBtn");

  button.disabled = true;
  button.textContent = "Reservando...";

  try {
    await runTransaction(db, async transaction => {
      const giftRef = doc(
        db,
        "gifts",
        giftId
      );

      const giftSnapshot =
        await transaction.get(giftRef);

      if (!giftSnapshot.exists()) {
        throw new Error("not-found");
      }

      const currentGift =
        giftSnapshot.data();

      if (currentGift.reserved === true) {
        throw new Error("already-reserved");
      }

      transaction.update(
        giftRef,
        {
          reserved: true,
          reservedBy: name,
          reservedAt: serverTimestamp()
        }
      );
    });

    closeModal();

    alert(
      "Presente reservado com sucesso! ❤️"
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
    collection(db, "gifts");

  onSnapshot(
    giftsCollection,

    snapshot => {

      /*
       * IMPORTANTE:
       *
       * O Firestore pode possuir documentos antigos.
       * O site NÃO vai mostrar todos eles.
       *
       * A lista oficial é definida exclusivamente
       * por gifts.js.
       */

      const firestoreGifts =
        new Map(
          snapshot.docs.map(document => [
            document.id,
            {
              id: document.id,
              ...document.data()
            }
          ])
        );

      gifts = seedGifts.map(seedGift => {

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
      });

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
      gifts = seedGifts.map(gift => ({
        ...gift
      }));

      populateCategories();
      render();
    }
  );
}

/* Eventos da página */

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
    if (event.key === "Escape") {
      closeModal();
    }
  }
);

/* Inicialização */

populateCategories();
render();
startListeners();
