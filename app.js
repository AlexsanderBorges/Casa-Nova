import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";

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
// VARIÁVEIS
// =====================================================

let gifts = [];
let selectedGift = null;


// =====================================================
// FUNÇÃO AUXILIAR PARA PEGAR ELEMENTOS
// =====================================================

const $ = (id) => document.getElementById(id);


// =====================================================
// PRESENTES PADRÃO
// =====================================================

const localSeed = () => {
  return seedGifts.map(g => ({
    ...g
  }));
};


// =====================================================
// CARREGAR PRESENTES DO FIREBASE
// =====================================================

async function loadGifts() {

  const snap = await getDocs(
    collection(db, "gifts")
  );

  if (snap.empty) {

    gifts = localSeed();

  } else {

    gifts = snap.docs.map(d => ({
      id: d.id,
      ...d.data()
    }));

  }

  render();
}


// =====================================================
// RENDERIZAR LISTA
// =====================================================

function render() {

  const searchElement = $("search");
  const categoryElement = $("category");

  if (!searchElement || !categoryElement) {
    return;
  }

  const q = searchElement.value
    .toLowerCase()
    .trim();

  const cat = categoryElement.value;


  // Apenas presentes visíveis
  const visible = gifts.filter(
    g => g.visible !== false
  );


  // Filtrar presentes
  const filtered = visible.filter(g => {

    const categoryMatches =
      cat === "Todos" ||
      g.category === cat;

    const nameMatches =
      (g.name || "")
        .toLowerCase()
        .includes(q);

    const descriptionMatches =
      (g.description || "")
        .toLowerCase()
        .includes(q);

    return (
      categoryMatches &&
      (nameMatches || descriptionMatches)
    );

  });


  // Informação dos resultados
  if ($("resultInfo")) {

    $("resultInfo").textContent =
      `${filtered.length} ${
        filtered.length === 1
          ? "presente encontrado"
          : "presentes encontrados"
      }`;

  }


  // Montar os cards
  if ($("giftGrid")) {

    $("giftGrid").innerHTML =
      filtered.length

        ? filtered.map(g => `

          <article class="gift">

            <div class="gift-image">
              ${g.emoji || "🎁"}
            </div>

            <div class="gift-body">

              <span class="gift-category">
                ${g.category || ""}
              </span>

              <h3>
                ${g.name || "Presente"}
              </h3>

              <p>
                ${g.description || ""}
              </p>

              <div class="status ${
                g.reserved
                  ? "reserved"
                  : "available"
              }">

                ${
                  g.reserved
                    ? "🔴 Já reservado"
                    : "🟢 Disponível"
                }

              </div>

              <button
                ${g.reserved ? "disabled" : ""}
                data-id="${g.id}"
              >

                ${
                  g.reserved
                    ? "Presente reservado"
                    : "Quero dar este presente"
                }

              </button>

            </div>

          </article>

        `).join("")

        : `
          <div class="empty">

            🔎<br>

            <strong>
              Nenhum presente encontrado
            </strong>

            <br>

            Tente outro nome ou categoria.

          </div>
        `;

  }


  // Quantidade disponível
  if ($("availableCount")) {

    $("availableCount").textContent =
      visible.filter(
        g => !g.reserved
      ).length;

  }


  // Quantidade visível
  if ($("visibleCount")) {

    $("visibleCount").textContent =
      visible.length;

  }


  // Botões de reserva
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
// ABRIR MODAL DE RESERVA
// =====================================================

function openReservation(id) {

  selectedGift =
    gifts.find(
      g => g.id === id
    );


  // Segurança
  if (
    !selectedGift ||
    selectedGift.reserved ||
    selectedGift.visible === false
  ) {

    return;

  }


  if ($("modalEmoji")) {

    $("modalEmoji").textContent =
      selectedGift.emoji || "🎁";

  }


  if ($("modalTitle")) {

    $("modalTitle").textContent =
      selectedGift.name || "Presente";

  }


  if ($("modalDescription")) {

    $("modalDescription").textContent =
      selectedGift.description || "";

  }


  if ($("guestName")) {

    $("guestName").value = "";

  }


  if ($("modal")) {

    $("modal").classList.remove(
      "hidden"
    );

  }


  if ($("guestName")) {

    $("guestName").focus();

  }

}


// =====================================================
// FECHAR MODAL
// =====================================================

function closeModal() {

  if ($("modal")) {

    $("modal").classList.add(
      "hidden"
    );

  }

  selectedGift = null;

}


// =====================================================
// BOTÃO FECHAR MODAL
// =====================================================

if ($("closeModal")) {

  $("closeModal").onclick =
    closeModal;

}


// =====================================================
// CLICAR FORA DO MODAL
// =====================================================

if ($("modal")) {

  $("modal").addEventListener(
    "click",
    e => {

      if (
        e.target === $("modal")
      ) {

        closeModal();

      }

    }
  );

}


// =====================================================
// PESQUISA
// =====================================================

if ($("search")) {

  $("search").addEventListener(
    "input",
    render
  );

}


// =====================================================
// CATEGORIA
// =====================================================

if ($("category")) {

  $("category").addEventListener(
    "change",
    render
  );

}


// =====================================================
// CONFIRMAR RESERVA
// =====================================================

if ($("confirmBtn")) {

  $("confirmBtn").onclick =
    async () => {

      const name =
        $("guestName")
          ?.value
          ?.trim();


      // Verificar nome
      if (!name) {

        alert(
          "Digite seu nome para reservar o presente."
        );

        return;

      }


      // Verificar presente
      if (!selectedGift) {

        alert(
          "Nenhum presente foi selecionado."
        );

        return;

      }


      // Desativar botão
      $("confirmBtn").disabled = true;


      try {

        // Referência do presente
        const ref =
          doc(
            db,
            "gifts",
            selectedGift.id
          );


        // =================================================
        // TRANSAÇÃO
        // =================================================

        await runTransaction(
          db,
          async transaction => {

            const snap =
              await transaction.get(
                ref
              );


            // Documento não existe
            if (!snap.exists()) {

              throw new Error(
                "NOT_FOUND"
              );

            }


            const data =
              snap.data();


            // Já reservado
            if (
              data.reserved === true
            ) {

              throw new Error(
                "UNAVAILABLE"
              );

            }


            // Oculto
            if (
              data.visible === false
            ) {

              throw new Error(
                "UNAVAILABLE"
              );

            }


            // Atualizar reserva
            transaction.update(
              ref,
              {

                reserved: true,

                reservedBy: name,

                reservedAt:
                  new Date()
                   
