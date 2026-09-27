# Chá de Casa Nova — Alex & Jessica

## Área exclusiva
`admin.html` agora tem login por Firebase Authentication e um painel para acompanhar as reservas.

### Publicar
1. Crie um projeto em https://console.firebase.google.com/
2. Adicione um Web App e copie a configuração para `firebase-config.js`.
3. Ative **Firestore Database**.
4. Ative **Authentication → Email/Password**.
5. Crie a conta de vocês em **Authentication → Users**.
6. Abra `admin.html`, faça login e clique em **Cadastrar os 50 presentes**.
7. Publique a pasta em https://vercel.com/ ou Firebase Hosting.

### Importante sobre segurança
Não coloque senha de administrador diretamente no JavaScript. O painel usa Firebase Authentication.

Antes de divulgar o site, configure as **Firestore Security Rules** para permitir leitura dos presentes e controlar alterações. A reserva do convidado usa uma transação do Firestore para impedir duas reservas simultâneas.

### Estrutura
- `index.html` — site dos convidados
- `style.css` — visual
- `app.js` — lista e reservas
- `admin.html` — área exclusiva
- `admin.js` — login e painel
- `firebase-config.js` — configuração do Firebase
