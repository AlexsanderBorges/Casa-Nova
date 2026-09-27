import { initializeApp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";

import {
  getFirestore,
  collection,
  getDocs,
  doc,
  getDoc,
  setDoc
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
// VARIÁVEIS
// =====================================================

let gifts = [];
let selectedGift = null;


// =====================================================
// FUNÇÃO AUXILIAR PARA PEGAR ELEMENTOS
// =====================================================

const $ = (id) => document.getElementById(id);


// =====================================================
// COPIA DOS PRESENTES LOCAIS
// =====================================================

function localSeed() {
  return seedGifts.map((gift) => ({
    ...gift
  }));
}


// =====================================================
// CARREGAR PRESENTES DO FIRESTORE
// =====================================================

async function loadGifts() {

  try {

    const snapshot = await getDocs(
      collection(db, "gifts")
    );

    if (snapshot.empty) {

      console.log(
        "Firestore está vazio. Usando presentes locais."
      );

      gifts = localSeed();

    } else {

      gifts = snapshot.docs.map((document) => ({
        id: document.id,
        ...document.data()
      }));

    }

    render();

  } catch (error) {

    console.error(
      "Erro ao carregar presentes:",
      error
    );

    // Se não conseguir acessar o Firebase,
    // mostra os presentes locais.
    gifts = localSeed();

    render();

    const notice = $("notice");

    if (notice) {

      notice.textContent =
        "Não foi possível conectar ao Firebase. Os presentes estão sendo exibidos localmente.";

      notice.style.display = "block";
    }
  }
}


// =====================================================
// MOSTRAR AVISO
// =====================================================

function showNotice(message) {

  const notice = $("notice");

  if (!notice) {
    return;
  }

  notice.textContent = message;

  notice.style.display = "block";

  setTimeout(() => {

    notice.style.display = "none";

  }, 5000);
}


// =====================================================
// RENDERIZAR PRESENTES
// =====================================================

function render() {

  const search = $("search");
  const category = $("category");
  const grid = $("giftGrid");

  if (!search || !category || !grid) {

    console.error(
      "Elementos necessários do HTML não encontrados."
    );

    return;
  }


  const searchText =
    search.value
      .toLowerCase()
      .trim();

  const selectedCategory =
    category.value;


  // Somente presentes visíveis
  const visibleGifts =
    gifts.filter(
      (gift) =>
        gift.visible !== false
    );


  // Filtro
  const filteredGifts =
    visibleGifts.filter((gift) => {

      const categoryMatch =
        selectedCategory === "Todos" ||
        gift.category === selectedCategory;

      const name =
        String(gift.name || "")
          .toLowerCase();

      const description =
        String(gift.description || "")
          .toLowerCase();

      const searchMatch =
        name.includes(searchText) ||
        description.includes(searchText);

      return categoryMatch && searchMatch;

    });


  // Resultado da pesquisa
  const resultInfo =
    $("resultInfo");

  if (resultInfo) {

    resultInfo.textContent =
      `${filteredGifts.length} ${
        filteredGifts.length === 1
          ? "presente encontrado"
          : "presentes encontrados"
      }`;

  }


  // Quantidade disponível
  const availableCount =
    $("availableCount");

  if (availableCount) {

    availableCount.textContent =
      visibleGifts.filter(
        (gift) =>
          gift.reserved !== true
      ).length;

  }


  // Quantidade visível
  const visibleCount =
    $("visibleCount");

  if (visibleCount) {

    visibleCount.textContent =
      visibleGifts.length;

  }


  // Nenhum presente encontrado
  if (!filteredGifts.length) {

    grid.innerHTML = `
      <div class="empty">

        🔎

        <br>

        <strong>
          Nenhum presente encontrado
        </strong>

        <br>

        Tente outro nome ou categoria.

      </div>
    `;

    return;
  }


  // Criar cards
  grid.innerHTML =
    filteredGifts.map((gift) => {

      const reserved =
        gift.reserved === true;


      return `

        <article class="gift">

          <div class="gift-image">
            ${gift.emoji || "🎁"}
          </div>


          <div class="gift-body">

            <span class="gift-category">
              ${gift.category || "Presente"}
            </span>


            <h3>
              ${gift.name || "Presente"}
            </h3>


            <p>
              ${gift.description || ""}
            </p>


            <div class="status ${
              reserved
                ? "reserved"
                : "available"
            }">

              ${
                reserved
                  ? "🔴 Já reservado"
                  : "🟢 Disponível"
              }

            </div>


            <button
              ${reserved ? "disabled" : ""}
              data-id="${gift.id}"
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


  // Eventos dos botões
  document
    .querySelectorAll(
      ".gift button:not([disabled])"
    )
    .forEach((button) => {

      button.onclick = () => {

        openReservation(
          button.dataset.id
        );

      };

    });

}


// =====================================================
// ABRIR JANELA DE RESERVA
// =====================================================

function openReservation(id) {

  selectedGift =
    gifts.find(
      (gift) =>
        gift.id === id
    );


  // Segurança
  if (
    !selectedGift ||
    selectedGift.reserved === true ||
    selectedGift.visible === false
  ) {

    return;

  }


  const modal =
    $("modal");

  const modalEmoji =
    $("modalEmoji");

  const modalTitle =
    $("modalTitle");

  const modalDescription =
    $("modalDescription");

  const guestName =
    $("guestName");


  if (modalEmoji) {

    modalEmoji.textContent =
      selectedGift.emoji || "🎁";

  }


  if (modalTitle) {

    modalTitle.textContent =
      selectedGift.name || "Presente";

 
