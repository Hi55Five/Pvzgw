// =====================
// Firebase Init
// =====================
const firebaseConfig = {
    apiKey: "AIzaSyBxnecJ2b1MQyDNA6JDqcardi0TfPGnZKY",
    authDomain: "linkey-f167c.firebaseapp.com",
    projectId: "linkey-f167c",
    storageBucket: "linkey-f167c.firebasestorage.app",
    messagingSenderId: "120200149024",
    appId: "1:120200149024:web:88cb5d5d0fb814df67a445",
    measurementId: "G-36TREE8R23"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

let todosLinks = [];
let usuarioAtual = null;
let abaAtual = "links";
let ordenacaoAtual = "nome";
let pendingAction = null;
const SENHA_ADMIN = "linkey123";
let adminLogado = false;

auth.onAuthStateChanged(async (user) => {
    if (user) {
        usuarioAtual = user;
        document.getElementById("userEmail").innerHTML = `${user.email} ${user.emailVerified ? '&#10003;' : '&#10007; verificar email'}`;
        document.getElementById("loginBtn").style.display = "none";
        document.getElementById("logoutBtn").style.display = "inline-block";
        if (!user.emailVerified) {
            await user.sendEmailVerification();
        }
        const isAdmin = user.email === "admin@linkey.com" || localStorage.getItem("adminTemp") === "true";
        if (isAdmin) {
            adminLogado = true;
        }
        const btn = document.getElementById("adminTabBtn");
        if (btn) {
            btn.classList.remove("hidden");
            btn.style.display = "inline-block";
        }
    } else {
        usuarioAtual = null;
        adminLogado = false;
        document.getElementById("userEmail").innerHTML = "desconectado";
        document.getElementById("loginBtn").style.display = "inline-block";
        document.getElementById("logoutBtn").style.display = "none";
        if (abaAtual === "admin") mudarAba("links");
    }
    await carregarLinks();
});

function abrirLogin() { document.getElementById("loginModal").style.display = "flex"; }
function fecharModal(id) { document.getElementById(id).style.display = "none"; }

async function fazerLogin() {
    const email = document.getElementById("loginEmail").value;
    const senha = document.getElementById("loginSenha").value;
    try { await auth.signInWithEmailAndPassword(email, senha); fecharModal("loginModal"); }
    catch (e) { alert("erro: " + e.message); }
}

async function criarConta() {
    const email = document.getElementById("loginEmail").value;
    const senha = document.getElementById("loginSenha").value;
    try {
        const uc = await auth.createUserWithEmailAndPassword(email, senha);
        await uc.user.sendEmailVerification();
        alert("conta criada! verifique seu email.");
    } catch (e) { alert("erro: " + e.message); }
}

async function fazerLogout() { await auth.signOut(); }

// =====================
// Links
// =====================
async function carregarLinks() {
    try {
        const snapshot = await db.collection("links").orderBy("nome").get();
        todosLinks = [];
        snapshot.forEach(doc => {
            todosLinks.push({ id: doc.id, ...doc.data(), cliques: doc.data().cliques || 0, nota: doc.data().nota || "", dataCriacao: doc.data().dataCriacao || new Date().toISOString() });
        });
        if (todosLinks.length === 0) await criarLinksExemplo();
        aplicarOrdenacao();
    } catch (e) {
        const c = document.getElementById("galleryContainer");
        if (c) c.innerHTML = '<div class="no-results">erro ao carregar links. <button onclick="carregarLinks()">tentar novamente</button></div>';
    }
}

async function criarLinksExemplo() {
    const exemplos = [
        { nome: "GitHub", url: "https://github.com", imagem: "https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png", nota: "repositorios e codigo" },
        { nome: "Google", url: "https://google.com", imagem: "https://www.google.com/images/branding/googlelogo/2x/googlelogo_color_92x30dp.png", nota: "o melhor buscador" }
    ];
    for (let item of exemplos) await db.collection("links").add({ ...item, cliques: 0, dataCriacao: new Date().toISOString() });
}

function aplicarOrdenacao() {
    const sortEl = document.getElementById("sortSelect");
    if (sortEl) ordenacaoAtual = sortEl.value;
    let lf = [...todosLinks];
    if (ordenacaoAtual === "nome") lf.sort((a, b) => a.nome.localeCompare(b.nome));
    else if (ordenacaoAtual === "cliques") lf.sort((a, b) => b.cliques - a.cliques);
    else if (ordenacaoAtual === "data") lf.sort((a, b) => new Date(b.dataCriacao) - new Date(a.dataCriacao));
    else if (ordenacaoAtual === "estrelas") lf.sort((a, b) => (b.mediaEstrelas || 0) - (a.mediaEstrelas || 0));
    const s = document.getElementById("searchInput");
    renderizarGaleria(lf, s ? s.value : "");
}

async function contarClique(id) {
    const link = todosLinks.find(l => l.id === id);
    if (link) { await db.collection("links").doc(id).update({ cliques: (link.cliques || 0) + 1 }); link.cliques++; aplicarOrdenacao(); }
}

function renderizarGaleria(links, busca) {
    const container = document.getElementById("galleryContainer");
    if (!container) return;
    const termo = busca.toLowerCase().trim();
    let filtrados = termo ? links.filter(l => l.nome.toLowerCase().includes(termo)) : links;
    const maxCliques = Math.max(...filtrados.map(l => l.cliques), 0);
    const statsEl = document.getElementById("resultStats");
    if (statsEl) statsEl.innerHTML = `${filtrados.length} link${filtrados.length !== 1 ? 's' : ''}`;
    if (filtrados.length === 0) { container.innerHTML = '<div class="no-results">nenhum link encontrado.</div>'; return; }
    let html = "";
    for (let link of filtrados) {
        const ehHot = link.cliques === maxCliques && maxCliques > 0;
        const mediaStr = link.mediaEstrelas ? `<span class="estrelas-media">${renderEstrelasSomente(link.mediaEstrelas)} <small>${link.mediaEstrelas.toFixed(1)} (${link.totalAvaliacoes || 0})</small></span>` : `<span class="estrelas-media sem-avaliacao">sem avaliações</span>`;
        html += `
            <div class="card" style="position:relative">
                ${ehHot ? '<div class="hot-badge">&#128293;</div>' : ''}
                <div class="card-img"><img src="${link.imagem}" onerror="this.onerror=null;this.style.display='none';this.parentNode.innerHTML+='<span class=fallback-icon>&#128279;</span>'"></div>
                <div class="card-content">
                    <div class="link-name">${escapeHtml(link.nome)}</div>
                    ${link.nota ? `<div class="link-note">${escapeHtml(link.nota)}</div>` : ''}
                    <div class="link-meta">
                        <span class="link-cliques">&#128065; ${link.cliques || 0}</span>
                        ${mediaStr}
                    </div>
                    <div class="card-buttons">
                        <button class="download-btn" onclick="window.open('${link.url}', '_blank'); contarClique('${link.id}')">acessar</button>
                        <button class="share-btn" onclick="compartilharLink('${link.url}', '${link.nome}')">compartilhar</button>
                    </div>
                    <button class="notes-toggle-btn" onclick="toggleAvaliacoes('${link.id}')">&#11088; avaliar</button>
                    <div class="notas-section" id="notas-${link.id}" style="display:none">
                        <div class="notas-lista" id="lista-notas-${link.id}">carregando...</div>
                        <div class="nota-form">
                            <div class="star-input" id="star-input-${link.id}">
                                ${[1,2,3,4,5].map(n => `<span class="star-btn" data-value="${n}" onclick="selecionarEstrela('${link.id}', ${n})">&#9733;</span>`).join('')}
                            </div>
                            <input type="hidden" id="star-value-${link.id}" value="0">
                            <button class="nota-enviar-btn" onclick="enviarAvaliacao('${link.id}')">enviar avaliação</button>
                        </div>
                    </div>
                </div>
            </div>`;
    }
    container.innerHTML = html;
}

// =====================
// Estrelas
// =====================
function renderEstrelasSomente(media) {
    let html = "";
    for (let i = 1; i <= 5; i++) {
        if (i <= Math.round(media)) html += `<span class="star filled">&#9733;</span>`;
        else html += `<span class="star empty">&#9733;</span>`;
    }
    return html;
}

function selecionarEstrela(linkId, valor) {
    document.getElementById("star-value-" + linkId).value = valor;
    const stars = document.querySelectorAll(`#star-input-${linkId} .star-btn`);
    stars.forEach(s => {
        s.classList.toggle("selecionada", parseInt(s.dataset.value) <= valor);
    });
}

async function toggleAvaliacoes(linkId) {
    const section = document.getElementById("notas-" + linkId);
    const btn = section.previousElementSibling;
    if (section.style.display === "none") {
        section.style.display = "block";
        btn.textContent = "fechar";
        await carregarAvaliacoes(linkId);
    } else {
        section.style.display = "none";
        btn.innerHTML = "&#11088; avaliar";
    }
}

async function carregarAvaliacoes(linkId) {
    const lista = document.getElementById("lista-notas-" + linkId);
    if (!lista) return;
    try {
        const snapshot = await db.collection("links").doc(linkId).collection("avaliacoes").orderBy("data", "desc").get();
        if (snapshot.empty) { lista.innerHTML = '<div class="nota-vazia">nenhuma avaliação ainda.</div>'; return; }
        let html = "";
        snapshot.forEach(doc => {
            const n = doc.data();
            const ehDono = usuarioAtual && usuarioAtual.uid === n.uid;
            html += `<div class="nota-item">
                <span class="nota-autor">${escapeHtml(n.email.split('@')[0])}</span>
                <span class="estrelas-display">${renderEstrelasSomente(n.estrelas)}</span>
                <span class="nota-data">${new Date(n.data).toLocaleDateString('pt-br')}</span>
                ${ehDono ? `<button class="nota-delete-btn" onclick="deletarAvaliacao('${linkId}','${doc.id}')">apagar</button>` : ''}
            </div>`;
        });
        lista.innerHTML = html;
    } catch (e) { lista.innerHTML = '<div class="nota-vazia">erro ao carregar.</div>'; }
}

async function enviarAvaliacao(linkId) {
    if (!usuarioAtual) { alert("faca login para avaliar!"); abrirLogin(); return; }
    const valor = parseInt(document.getElementById("star-value-" + linkId).value);
    if (!valor || valor < 1) { alert("selecione uma nota de 1 a 5 estrelas!"); return; }

    // Verifica se já avaliou
    const existing = await db.collection("links").doc(linkId).collection("avaliacoes")
        .where("uid", "==", usuarioAtual.uid).get();
    if (!existing.empty) {
        if (!confirm("você já avaliou esse link. deseja substituir sua avaliação?")) return;
        await existing.docs[0].ref.delete();
    }

    await db.collection("links").doc(linkId).collection("avaliacoes").add({
        estrelas: valor,
        email: usuarioAtual.email,
        uid: usuarioAtual.uid,
        data: new Date().toISOString()
    });

    // Recalcula média e salva no link
    const todasAvaliacoes = await db.collection("links").doc(linkId).collection("avaliacoes").get();
    let total = 0;
    todasAvaliacoes.forEach(d => { total += d.data().estrelas; });
    const media = total / todasAvaliacoes.size;
    await db.collection("links").doc(linkId).update({ mediaEstrelas: media, totalAvaliacoes: todasAvaliacoes.size });

    // Atualiza local
    const linkLocal = todosLinks.find(l => l.id === linkId);
    if (linkLocal) { linkLocal.mediaEstrelas = media; linkLocal.totalAvaliacoes = todasAvaliacoes.size; }

    await carregarAvaliacoes(linkId);
    aplicarOrdenacao();
}

async function deletarAvaliacao(linkId, avalId) {
    await db.collection("links").doc(linkId).collection("avaliacoes").doc(avalId).delete();

    const todasAvaliacoes = await db.collection("links").doc(linkId).collection("avaliacoes").get();
    let media = 0, count = todasAvaliacoes.size;
    todasAvaliacoes.forEach(d => { media += d.data().estrelas; });
    media = count > 0 ? media / count : 0;
    await db.collection("links").doc(linkId).update({ mediaEstrelas: count > 0 ? media : firebase.firestore.FieldValue.delete(), totalAvaliacoes: count });

    const linkLocal = todosLinks.find(l => l.id === linkId);
    if (linkLocal) { linkLocal.mediaEstrelas = media; linkLocal.totalAvaliacoes = count; }

    await carregarAvaliacoes(linkId);
    aplicarOrdenacao();
}

function compartilharLink(url, nome) {
    if (navigator.share) navigator.share({ title: nome, url });
    else { navigator.clipboard.writeText(url); alert('link copiado!'); }
}

// =====================
// Admin
// =====================
async function mostrarAdminPanel() {
    const container = document.getElementById("adminPanel");
    if (!container) return;
    if (!adminLogado) {
        container.innerHTML = `<div style="text-align:center;padding:30px"><input type="password" id="adminSenha" placeholder="senha master" style="padding:8px"><button onclick="validarAdmin()" style="margin-left:8px">entrar</button></div>`;
        return;
    }
    container.innerHTML = `
        <div class="form-group"><h3>adicionar link</h3>
        <label>nome</label><input type="text" id="novoNome">
        <label>url</label><input type="text" id="novaUrl">
        <label>imagem url</label><input type="text" id="novaImagem">
        <label>descrição</label><textarea id="novaNota" rows="2"></textarea>
        <button onclick="adicionarLinkAdmin()">adicionar</button></div>
        <hr><h3>links (${todosLinks.length})</h3><div id="listaLinksAdmin" class="link-list"></div>`;
    await listarLinksAdmin();
}

function validarAdmin() {
    if (document.getElementById("adminSenha").value === SENHA_ADMIN) {
        adminLogado = true; localStorage.setItem("adminTemp", "true");
        const btn = document.getElementById("adminTabBtn");
        if (btn) {
            btn.classList.remove("hidden");
            btn.style.display = "inline-block";
        }
        mostrarAdminPanel();
    } else { alert("senha incorreta!"); }
}

async function listarLinksAdmin() {
    const div = document.getElementById("listaLinksAdmin");
    if (!div) return;
    let html = "";
    for (let link of todosLinks) {
        const mediaStr = link.mediaEstrelas ? `${link.mediaEstrelas.toFixed(1)}★ (${link.totalAvaliacoes || 0})` : "sem avaliações";
        html += `<div class="link-item"><div><strong>${escapeHtml(link.nome)}</strong><br><small>${link.cliques} cliques · ${mediaStr}</small></div><div><button onclick="editarLinkAdmin('${link.id}')">editar</button><button onclick="confirmarExclusao('${link.id}')" style="background:#a43a3a">excluir</button></div></div>`;
    }
    div.innerHTML = html;
}

async function adicionarLinkAdmin() {
    const nome = document.getElementById("novoNome").value.trim();
    const url = document.getElementById("novaUrl").value.trim();
    if (!nome || !url) { alert("nome e url obrigatorios!"); return; }
    await db.collection("links").add({ nome, url, imagem: document.getElementById("novaImagem").value.trim() || "https://via.placeholder.com/200x150?text=link", nota: document.getElementById("novaNota").value.trim(), cliques: 0, dataCriacao: new Date().toISOString() });
    alert("link adicionado!");
    document.getElementById("novoNome").value = ""; document.getElementById("novaUrl").value = ""; document.getElementById("novaImagem").value = ""; document.getElementById("novaNota").value = "";
    await carregarLinks(); await listarLinksAdmin();
}

async function editarLinkAdmin(id) {
    const link = todosLinks.find(l => l.id === id);
    const novoNome = prompt("novo nome:", link.nome); if (!novoNome) return;
    const novaUrl = prompt("nova url:", link.url); if (!novaUrl) return;
    const novaNota = prompt("nova descrição:", link.nota || "");
    await db.collection("links").doc(id).update({ nome: novoNome, url: novaUrl, nota: novaNota || "" });
    alert("link atualizado!"); await carregarLinks(); await listarLinksAdmin();
}

function confirmarExclusao(id) {
    pendingAction = id;
    document.getElementById("confirmModal").style.display = "flex";
}

// =====================
// Abas
// =====================
function mudarAba(aba) {
    abaAtual = aba;
    document.querySelectorAll(".tab-content").forEach(t => t.style.display = "none");
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    if (aba === "links") { document.getElementById("tabLinks").style.display = "block"; document.querySelector(".tabs-nav button:first-child, .tabs button:first-child").classList.add("active"); aplicarOrdenacao(); }
    else if (aba === "admin") { document.getElementById("tabAdmin").style.display = "block"; document.querySelectorAll(".tabs-nav button, .tabs button")[1].classList.add("active"); mostrarAdminPanel(); }
}

function alternarTema() {
    const body = document.body;
    if (body.classList.contains('dark')) { body.classList.remove('dark'); body.classList.add('light'); localStorage.setItem('tema', 'light'); }
    else { body.classList.remove('light'); body.classList.add('dark'); localStorage.setItem('tema', 'dark'); }
}

function escapeHtml(str) {
    if (!str) return "";
    return str.replace(/[&<>"']/g, m => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));
}

document.addEventListener("DOMContentLoaded", function () {
    const confirmYes = document.getElementById("confirmYes");
    const confirmNo = document.getElementById("confirmNo");
    const searchInput = document.getElementById("searchInput");
    const clearSearchBtn = document.getElementById("clearSearchBtn");
    if (confirmYes) confirmYes.addEventListener("click", async function () {
        if (pendingAction) { await db.collection("links").doc(pendingAction).delete(); await carregarLinks(); if (adminLogado) await listarLinksAdmin(); pendingAction = null; }
        document.getElementById("confirmModal").style.display = "none";
    });
    if (confirmNo) confirmNo.addEventListener("click", function () { pendingAction = null; document.getElementById("confirmModal").style.display = "none"; });
    if (searchInput) searchInput.addEventListener("input", function (e) { aplicarOrdenacao(); if (clearSearchBtn) clearSearchBtn.style.display = e.target.value ? "inline-block" : "none"; });
    if (clearSearchBtn) clearSearchBtn.addEventListener("click", function () { if (searchInput) searchInput.value = ""; aplicarOrdenacao(); this.style.display = "none"; });
    if (localStorage.getItem('tema') === 'light') document.body.classList.add('light');
});
