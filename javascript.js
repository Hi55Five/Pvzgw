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
            alert("verifique seu email! enviamos um link.");
            await user.sendEmailVerification();
        }
        const isAdmin = user.email === "admin@linkey.com" || localStorage.getItem("adminTemp") === "true";
        if (isAdmin) {
            adminLogado = true;
            const btn = document.getElementById("adminTabBtn");
            if (btn) btn.style.display = "inline-block";
        }
    } else {
        usuarioAtual = null;
        adminLogado = false;
        document.getElementById("userEmail").innerHTML = "desconectado";
        document.getElementById("loginBtn").style.display = "inline-block";
        document.getElementById("logoutBtn").style.display = "none";
        const btn = document.getElementById("adminTabBtn");
        if (btn) btn.style.display = "none";
        if (abaAtual === "admin") mudarAba("links");
    }
    await carregarLinks();
    await carregarFeed();
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
        if (c) c.innerHTML = '<div class="no-results">erro ao carregar links.</div>';
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
        html += `
            <div class="card" style="position:relative">
                ${ehHot ? '<div class="hot-badge">&#128293;</div>' : ''}
                <div class="card-img"><img src="${link.imagem}" onerror="this.onerror=null;this.style.display='none';this.parentNode.innerHTML+='<span class=fallback-icon>&#128279;</span>'"></div>
                <div class="card-content">
                    <div class="link-name">${escapeHtml(link.nome)}</div>
                    ${link.nota ? `<div class="link-note">${escapeHtml(link.nota)}</div>` : ''}
                    <div class="link-cliques">&#128065; ${link.cliques || 0}</div>
                    <div class="card-buttons">
                        <button class="download-btn" onclick="window.open('${link.url}', '_blank'); contarClique('${link.id}')">acessar</button>
                        <button class="share-btn" onclick="compartilharLink('${link.url}', '${link.nome}')">compartilhar</button>
                    </div>
                    <button class="notes-toggle-btn" onclick="toggleNotas('${link.id}')">&#128172; notas</button>
                    <div class="notas-section" id="notas-${link.id}" style="display:none">
                        <div class="notas-lista" id="lista-notas-${link.id}">carregando...</div>
                        <div class="nota-form">
                            <textarea id="input-nota-${link.id}" placeholder="escreva uma nota sobre esse link..." rows="2"></textarea>
                            <button class="nota-enviar-btn" onclick="enviarNota('${link.id}')">enviar</button>
                        </div>
                    </div>
                </div>
            </div>`;
    }
    container.innerHTML = html;
}

// =====================
// Notas
// =====================
async function toggleNotas(linkId) {
    const section = document.getElementById("notas-" + linkId);
    const btn = section.previousElementSibling;
    if (section.style.display === "none") {
        section.style.display = "block";
        btn.textContent = "fechar notas";
        await carregarNotas(linkId);
    } else {
        section.style.display = "none";
        btn.textContent = "&#128172; notas";
    }
}

async function carregarNotas(linkId) {
    const lista = document.getElementById("lista-notas-" + linkId);
    if (!lista) return;
    try {
        const snapshot = await db.collection("links").doc(linkId).collection("notas").orderBy("data", "desc").get();
        if (snapshot.empty) { lista.innerHTML = '<div class="nota-vazia">nenhuma nota ainda.</div>'; return; }
        let html = "";
        snapshot.forEach(doc => {
            const n = doc.data();
            const ehDono = usuarioAtual && usuarioAtual.email === n.email;
            html += `<div class="nota-item">
                <span class="nota-autor">${escapeHtml(n.email.split('@')[0])}</span>
                <span class="nota-data">${new Date(n.data).toLocaleDateString('pt-br')}</span>
                ${ehDono ? `<button class="nota-delete-btn" onclick="deletarNota('${linkId}','${doc.id}')">apagar</button>` : ''}
                <div class="nota-texto">${escapeHtml(n.texto)}</div>
            </div>`;
        });
        lista.innerHTML = html;
    } catch (e) { lista.innerHTML = '<div class="nota-vazia">erro ao carregar.</div>'; }
}

async function enviarNota(linkId) {
    if (!usuarioAtual) { alert("faca login para comentar!"); abrirLogin(); return; }
    const input = document.getElementById("input-nota-" + linkId);
    const texto = input.value.trim();
    if (!texto) return;
    await db.collection("links").doc(linkId).collection("notas").add({ texto, email: usuarioAtual.email, data: new Date().toISOString() });
    input.value = "";
    await carregarNotas(linkId);
}

async function deletarNota(linkId, notaId) {
    await db.collection("links").doc(linkId).collection("notas").doc(notaId).delete();
    await carregarNotas(linkId);
}

function compartilharLink(url, nome) {
    if (navigator.share) navigator.share({ title: nome, url });
    else { navigator.clipboard.writeText(url); alert('link copiado!'); }
}

// =====================
// Feed
// =====================
async function carregarFeed() {
    const container = document.getElementById("feedContainer");
    if (!container) return;
    try {
        const snapshot = await db.collection("posts").orderBy("data", "desc").get();
        if (snapshot.empty) { container.innerHTML = '<div class="no-results">nenhum post ainda. seja o primeiro!</div>'; return; }
        let html = "";
        snapshot.forEach(doc => { html += renderizarPost(doc.id, doc.data()); });
        container.innerHTML = html;
    } catch (e) { container.innerHTML = '<div class="no-results">erro ao carregar feed.</div>'; }
}

function renderizarPost(id, p) {
    const jaCurtiu = usuarioAtual && (p.curtidas_uids || []).includes(usuarioAtual.uid);
    const ehDono = usuarioAtual && usuarioAtual.email === p.email;
    const data = new Date(p.data);
    const dataStr = data.toLocaleDateString('pt-br') + ' · ' + data.toLocaleTimeString('pt-br', { hour: '2-digit', minute: '2-digit' });
    return `<div class="post-card" id="post-${id}">
        <div class="post-avatar">${escapeHtml(p.email[0].toUpperCase())}</div>
        <div class="post-body">
            <div class="post-header">
                <span class="post-autor">${escapeHtml(p.email.split('@')[0])}</span>
                <span class="post-data">${dataStr}</span>
                ${ehDono ? `<button class="post-delete-btn" onclick="deletarPost('${id}')">&#128465;</button>` : ''}
            </div>
            <div class="post-texto">${escapeHtml(p.texto)}</div>
            ${p.url ? `<a class="post-link" href="${escapeHtml(p.url)}" target="_blank">${escapeHtml(p.url)}</a>` : ''}
            <div class="post-actions">
                <button class="curtir-btn ${jaCurtiu ? 'curtido' : ''}" onclick="curtirPost('${id}')">
                    ${jaCurtiu ? '&#10084;&#65039;' : '&#129293;'} <span>${p.curtidas || 0}</span>
                </button>
            </div>
        </div>
    </div>`;
}

async function publicarPost() {
    if (!usuarioAtual) { alert("faca login para postar!"); abrirLogin(); return; }
    const textoEl = document.getElementById("novoPostTexto");
    const urlEl = document.getElementById("novoPostUrl");
    const texto = textoEl ? textoEl.value.trim() : "";
    const url = urlEl ? urlEl.value.trim() : "";
    if (!texto) { alert("escreva algo antes de publicar!"); return; }
    const btn = document.querySelector(".publicar-btn");
    if (btn) { btn.disabled = true; btn.textContent = "publicando..."; }
    try {
        await db.collection("posts").add({ texto, url: url || "", email: usuarioAtual.email, uid: usuarioAtual.uid, curtidas: 0, curtidas_uids: [], data: new Date().toISOString() });
        if (textoEl) textoEl.value = "";
        if (urlEl) urlEl.value = "";
        await carregarFeed();
    } catch(e) { alert("erro ao publicar."); }
    if (btn) { btn.disabled = false; btn.textContent = "publicar"; }
}

async function curtirPost(id) {
    if (!usuarioAtual) { alert("faca login para curtir!"); abrirLogin(); return; }
    const ref = db.collection("posts").doc(id);
    const snap = await ref.get();
    const data = snap.data();
    const uids = data.curtidas_uids || [];
    const jaCurtiu = uids.includes(usuarioAtual.uid);
    if (jaCurtiu) {
        await ref.update({ curtidas: Math.max(0, (data.curtidas || 0) - 1), curtidas_uids: uids.filter(u => u !== usuarioAtual.uid) });
    } else {
        await ref.update({ curtidas: (data.curtidas || 0) + 1, curtidas_uids: [...uids, usuarioAtual.uid] });
    }
    await carregarFeed();
}

async function deletarPost(id) {
    if (!confirm("apagar este post?")) return;
    await db.collection("posts").doc(id).delete();
    await carregarFeed();
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
        <label>nota</label><textarea id="novaNota" rows="2"></textarea>
        <button onclick="adicionarLinkAdmin()">adicionar</button></div>
        <hr><h3>links (${todosLinks.length})</h3><div id="listaLinksAdmin" class="link-list"></div>`;
    await listarLinksAdmin();
}

function validarAdmin() {
    if (document.getElementById("adminSenha").value === SENHA_ADMIN) {
        adminLogado = true; localStorage.setItem("adminTemp", "true");
        const btn = document.getElementById("adminTabBtn");
        if (btn) btn.style.display = "inline-block";
        mostrarAdminPanel();
    } else { alert("senha incorreta!"); }
}

async function listarLinksAdmin() {
    const div = document.getElementById("listaLinksAdmin");
    if (!div) return;
    let html = "";
    for (let link of todosLinks) {
        html += `<div class="link-item"><div><strong>${escapeHtml(link.nome)}</strong><br><small>${link.cliques} cliques</small></div><div><button onclick="editarLinkAdmin('${link.id}')">editar</button><button onclick="confirmarExclusao('${link.id}')" style="background:#a43a3a">excluir</button></div></div>`;
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
    const novaNota = prompt("nova nota:", link.nota || "");
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
    if (aba === "links") { document.getElementById("tabLinks").style.display = "block"; document.querySelector(".tabs button:first-child").classList.add("active"); aplicarOrdenacao(); }
    else if (aba === "pedidos") { document.getElementById("tabPedidos").style.display = "block"; document.querySelectorAll(".tabs button")[1].classList.add("active"); carregarFeed(); }
    else if (aba === "admin") { document.getElementById("tabAdmin").style.display = "block"; document.querySelectorAll(".tabs button")[2].classList.add("active"); mostrarAdminPanel(); }
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
