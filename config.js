/* Configuração do build. O scripts/build-web.mjs gera este arquivo para o APK (store "github" ou "play").
 * Na versão web (GitHub Pages) este arquivo é usado como está. */
window.__STORE = "github";
window.__CONFIG = {
  // link do Livepix do desenvolvedor (deixe vazio para esconder o apoio)
  livepix: "https://livepix.gg/duapps",
  // endereço público da versão web (usado nos links do QR do modo consulta). Fica num repositório
  // público separado (EmagreceDU-site), porque o repositório do código é privado.
  site: "https://du-medeiros.github.io/EmagreceDU-site/",
  // repositório público onde o CI publica o APK (aviso de nova versão do app do GitHub)
  repo: "du-medeiros/EmagreceDU-site",
  // OAuth Client ID (tipo "Web") do Google Cloud, para o backup no Google Drive (drive.js).
  // Vazio = seção do Drive desligada. No Android também é preciso um client "Android" com o SHA-1.
  googleClientId: "59036781845-ir09jbiamvihhfpctt83ia1hlact6k11.apps.googleusercontent.com",
};
