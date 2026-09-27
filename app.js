onSnapshot(collection(db, "gifts"), snapshot => {
  // Cria um mapa com os presentes que já existem no Firestore
  const firestoreGifts = new Map(
    snapshot.docs.map(d => [
      d.id,
      {
        id: d.id,
        ...d.data()
      }
    ])
  );

  // O site trabalha SOMENTE com os 100 presentes oficiais.
  // Presentes antigos, como gift-101 até gift-200, serão ignorados.
  gifts = seedGifts.map(seed => {
    const saved = firestoreGifts.get(seed.id);

    if (saved) {
      return {
        ...seed,
        ...saved,
        id: seed.id
      };
    }

    return {
      ...seed
    };
  });

  // Verifica quais dos 100 presentes ainda não existem no Firestore
  const missing = seedGifts.filter(
    gift => !firestoreGifts.has(gift.id)
  );

  if (missing.length > 0) {
    firestoreReady = false;

    setConnection(
      `Preparando ${missing.length} presente(s) no Firestore...`,
      false
    );

    // Cria somente os presentes que estão faltando
    Promise.all(
      missing.map(gift =>
        setDoc(
          doc(db, "gifts", gift.id),
          {
            name: gift.name,
            category: gift.category,
            emoji: gift.emoji,
            description: gift.description,
            reserved: false,
            reservedBy: "",
            reservedAt: null,
            visible: true
          }
        )
      )
    )
      .then(() => {
        firestoreReady = true;

        setConnection(
          "Lista sincronizada em tempo real.",
          true
        );

        populateCategories();
        render();
      })
      .catch(error => {
        console.error(error);

        firestoreReady = false;

        setConnection(
          "O Firestore recusou a criação dos presentes. Publique as regras do arquivo firestore.rules.",
          false
        );

        render();
      });

  } else {
    firestoreReady = true;

    setConnection(
      "Lista sincronizada em tempo real.",
      true
    );

    populateCategories();
    render();
  }

}, error => {
  console.error(error);

  firestoreReady = false;

  setConnection(
    "Não foi possível acessar o Firestore. Confira as regras e a configuração do Firebase.",
    false
  );

  // Se o Firestore estiver indisponível,
  // mostra temporariamente os 100 presentes locais.
  gifts = seedGifts.map(gift => ({
    ...gift
  }));

  populateCategories();
  render();
});
