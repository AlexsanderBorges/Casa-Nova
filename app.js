import { initializeApp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";

import {
  getFirestore,
  collection,
  getDocs,
  doc,
  runTransaction
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";

import {
  firebaseConfig,
  seedGifts
} from "./firebase-config.js";


// =====================================================
// FIREBASE
// =====================================================

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);


// =====================================================
// ESTADO DO SITE
// =====================================================

let gifts = [];
let selectedGift = null;


// =====================================================
// FUNÇÃO AUXILIAR
// =====================================================

function $(id) {
  return document.getElementById(id);
}


// =====================================================
// COPIA DOS PRESENTES PADRÃO
// =====================================================

function getSeedGifts() {
  return seedGifts.map(gift => ({
    ...gift
  }));
}


// =====================================================
// CARREGAR PRESENTES
// =====================================================

async function loadGifts() {

  try {

    const snapshot = await getDocs(
      collection(db, "gifts")
    );

    console.log(
      "Firebase: documentos encontrados:",
      snapshot.size
    );


    // -------------------------------------------------
    // FIRESTORE VAZIO
    // -------------------------------------------------

    if (snapshot.empty) {

      console.log(
        "Firestore vazio. Usando lista local."
      );

      gifts = getSeedGifts();

    } else {

      gifts = snapshot.docs.map(documento => {

        const data = documento.data();

        return {

          id: documento.id,

          name: data.name || "Presente",

          category: data.category || "Casa",

          emoji: data.emoji || "🎁",

          description:
            data.description ||
            "Presente para nossa nova casa.",

          reserved:
            data.reserved === true,

          reservedBy:
            data.reservedBy || "",

          reservedAt:
            data.reservedAt || "",

          visible:
            data.visible !== false

        };

      });

    }


    console.log(
      "Presentes carregados:",
      gifts.length
    );


    render();

  } catch (error) {

    console.error(
      "Erro ao carregar Firestore:",
      error
    );


    // Se o Firebase falhar,
    // ainda mostra os 100 presentes.

    gifts = getSeedGifts();

    render();


    showNotice(
      "Os presentes foram carregados, mas houve um problema de conexão com o Firebase.",
      true
    );
  }
}


// =====================================================
// RENDERIZAR PRESENTES
// =====================================================

function render() {

  const searchInput = $("search");
  const categorySelect = $("category");
  const grid = $("giftGrid");


  if (!searchInput || !categorySelect || !grid) {

    console.error(
      "Elementos da página não encontrados."
    );

    return;
  }


  const search =
    searchInput.value
      .toLowerCase()
      .trim();


  const category =
    categorySelect.value;


  // -------------------------------------------------
  // SOMENTE PRESENTES VISÍVEIS
  // -------------------------------------------------

  const visibleGifts =
    gifts.filter(gift =>
      gift.visible !== false
    );


  // -------------------------------------------------
  // FILTRO
  // -------------------------------------------------

  const filtered =
    visibleGifts.filter(gift => {

      const name =
        String(gift.name || "")
          .toLowerCase();

      const description =
        String(gift.description || "")
          .toLowerCase();

      const giftCategory =
        String(gift.category || "")
          .trim();


      const matchesCategory =
        category === "Todos" ||
        giftCategory === category;


      const matchesSearch =
        name.includes(search) ||
        description.includes(search);


      return (
        matchesCategory &&
        matchesSearch
      );

    });


  // -------------------------------------------------
  // CONTADORES
  // -------------------------------------------------

  const available =
    visibleGifts.filter(
      gift => gift.reserved !== true
    ).length;


  if ($("availableCount")) {

    $("availableCount").textContent =
      available;
  }


  if ($("visibleCount")) {

    $("visibleCount").textContent =
      visibleGifts.length;
  }


  if ($("resultInfo")) {

    $("resultInfo").textContent =
      `${filtered.length} ${
        filtered.length === 1
          ? "presente encontrado"
          : "presentes encontrados"
      }`;
  }


  // -------------------------------------------------
  // NENHUM RESULTADO
  // -------------------------------------------------

  if (filtered.length === 0) {

    grid.innerHTML = `
      <div class="empty">

        🔎

        <br><br>

        <strong>Nenhum presente encontrado</strong>

        <br>

        Não encontramos presentes nessa categoria.

        <br><br>

        <button
          id="clearFilters"
          class="primary"
          style="max-width:220px"
        >
          Mostrar todos
        </button>

      </div>
    `;


    const clear =
      $("clearFilters");


    if (clear) {

      clear.onclick = () => {

        $("search").value = "";

        $("category").value = "Todos";

        render();

      };

    }


    return;
  }


  // -------------------------------------------------
  // DESENHAR CARDS
  // -------------------------------------------------

  grid.innerHTML =
    filtered.map(gift => {

      const reserved =
        gift.reserved === true;


      return `

        <article class="gift">

          <div class="gift-image">
            ${escapeHtml(gift.emoji)}
          </div>

          <div class="gift-body">

            <span class="gift-category">
              ${escapeHtml(gift.category)}
            </span>

            <h3>
              ${escapeHtml(gift.name)}
            </h3>

            <p>
              ${escapeHtml(gift.description)}
            </p>


            <div
              class="status ${
                reserved
                  ? "reserved"
                  : "available"
              }"
            >

              ${
                reserved
                  ? "🔴 Já reservado"
                  : "🟢 Disponível"
              }

            </div>


            <button
              ${
                reserved
                  ? "disabled"
                  : ""
              }

              data-id="${escapeHtml(gift.id)}"
            >

              ${
                reserved
                  ? "Presente reservado"
                  : "Quero dar este presente"
              }

            </button>

          </div>

        </article>

      `;

    }).join("");


  // -------------------------------------------------
  // BOTÕES
  // -------------------------------------------------

  document
    .querySelectorAll(
      ".gift button:not([disabled])"
    )
    .forEach(button => {

      button.onclick = () => {

        openReservation(
          button.dataset.id
        );

      };

    });
}


// =====================================================
// ABRIR MODAL
// =====================================================

function openReservation(id) {

  const gift =
    gifts.find(
      item => item.id === id
    );


  if (!gift) {

    alert(
      "Presente não encontrado."
    );

    return;
  }


  if (gift.reserved) {

    alert(
      "Esse presente já foi reservado."
    );

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
    gift.description;


  $("guestName").value = "";


  $("modal").classList.remove(
    "hidden"
  );


  setTimeout(() => {

    $("guestName").focus();

  }, 100);
}


// =====================================================
// FECHAR MODAL
// =====================================================

function closeModal() {

  $("modal").classList.add(
    "hidden"
  );

  selectedGift = null;
}


// =====================================================
// AVISO
// =====================================================

function showNotice(message, error = false) {

  const notice =
    $("notice");


  if (!notice) return;


  notice.textContent =
    message;


  notice.style.display =
    "block";


  if (error) {

    notice.style.background =
      "#fff7ed";

    notice.style.borderColor =
      "#fed7aa";

    notice.style.color =
      "#9a3412";

  } else {

    notice.style.background =
      "";

    notice.style.borderColor =
      "";

    notice.style.color =
      "";

  }


  setTimeout(() => {

    notice.style.display =
      "none";

  }, 6000);
}


// =====================================================
// RESERVAR PRESENTE
// =====================================================

async function reserveGift() {

  const guestName =
    $("guestName")
      .value
      .trim();


  if (!selectedGift) {

    return;

  }


  if (!guestName) {

    alert(
      "Digite seu nome para continuar."
    );

    $("guestName").focus();

    return;

  }


  const button =
    $("confirmBtn");


  button.disabled = true;

  button.textContent =
    "Registrando reserva...";


  try {

    const giftRef =
      doc(
        db,
        "gifts",
        selectedGift.id
      );


    await runTransaction(
      db,
      async transaction => {

        const snapshot =
          await transaction.get(
            giftRef
          );


        if (!snapshot.exists()) {

          throw new Error(
            "NOT_FOUND"
          );

        }


        const data =
          snapshot.data();


        // ---------------------------------------------
        // VERIFICAR SE JÁ FOI RESERVADO
        // ---------------------------------------------

        if (
          data.reserved === true
        ) {

          throw new Error(
            "ALREADY_RESERVED"
          );

        }


        // ---------------------------------------------
        // VERIFICAR VISIBILIDADE
        // ---------------------------------------------

        if (
          data.visible === false
        ) {

          throw new Error(
            "HIDDEN"
          );

        }


        // ---------------------------------------------
        // FAZER RESERVA
        // ---------------------------------------------

        transaction.update(
          giftRef,
          {

            reserved: true,

            reservedBy:
              guestName,

            reservedAt:
              new Date().toISOString()

          }
        );

      }
    );


    // -------------------------------------------------
    // SUCESSO
    // -------------------------------------------------

    closeModal();


    showNotice(
      `❤️ Obrigado, ${guestName}! Sua reserva foi registrada.`
    );


    // Atualizar lista
    await loadGifts();


  } catch (error) {

    console.error(
      "Erro ao reservar:",
      error
    );


    if (
      error.message ===
      "ALREADY_RESERVED"
    ) {

      alert(
        "Esse presente acabou de ser reservado por outra pessoa. Escolha outro. ❤️"
      );

    } else if (
      error.message ===
      "HIDDEN"
    ) {

      alert(
        "Esse presente não está mais disponível."
      );

    } else if (
      error.message ===
      "NOT_FOUND"
    ) {

      alert(
        "Esse presente não existe mais."
      );

    } else {

      alert(
        "Não foi possível registrar a reserva.\n\n" +
        "Verifique sua conexão com a internet e tente novamente."
      );

    }


    // Atualizar estado
    await loadGifts();


  } finally {

    button.disabled = false;

    button.textContent =
      "Confirmar reserva ❤️";

  }
}


// =====================================================
// ESCAPAR HTML
// =====================================================

function escapeHtml(value) {

  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


// =====================================================
// EVENTOS
// =====================================================

document.addEventListener(
  "DOMContentLoaded",
  () => {

    // Fechar modal
    $("closeModal").onclick =
      closeModal;


    // Clique fora do modal
    $("modal").addEventListener(
      "click",
      event => {

        if (
          event.target ===
          $("modal")
        ) {

          closeModal();

        }

      }
    );


    // Pesquisa
    $("search").addEventListener(
      "input",
      render
    );


    // Categoria
    $("category").addEventListener(
      "change",
      render
    );


    // Confirmar reserva
    $("confirmBtn").onclick =
      reserveGift;


    // Carregar presentes
    loadGifts();

  }
);
