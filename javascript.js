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

// =====================
// Estado global
// =====================
let todosLinks = [];
let usuarioAtual = null;
let abaAtual = "links";
let ordenacaoAtual = "nome";
let pendingAction = null;

const SENHA_ADMIN = "linkey123";
let adminLogado = false;

// =====================
// Auth
// =====================
auth.onAuthStateChanged(async (user) => {
    if (user) {
        usuarioAtual = user;
        document.getElementById("userEmail").innerHTML =
            `${user.email} ${user.emailVerified ? '✓' : '✗ verificar email'}`;
        document.getElementById("loginBtn").style.display = "none";
        document.getElementById("logoutBtn").style.display = "inline-block";

        if (!user.emailVerified) {
            alert("verifique seu email! enviamos um link.");
            await user.sendEmailVerification();
        }

        const isAdmin = user.email === "admin@linkey.com" || localStorage.getItem("adminTemp") === "true";
        if (isAdmin) {
            adminLogado = true;
            document.getElementById("adminTabBtn").style.display = "inline-block";
        }
    } else {
        usuarioAtual = null;
        adminLogado = false;
        document.getElementById("userEmail").innerHTML = "desconectado";
        document.getElementById("loginBtn").style.display = "inline-block";
        document.getElementById("logoutBtn").style.display = "none";
        document.getElementById("adminTabBtn").style.display = "none";
        if (abaAtual === "admin") mudarAba("links");
    }
    await carregarLinks();
    await carregarPedidos();
});

// =====================
// Login / Logout
// =====================
function abrirLogin() {
    document.getElementById("loginModal").style.display = "flex";
}

function fecharModal(id) {
    document.getElementById(id).style.display = "none";
}

async function fazerLogin() {
    const email = document.getElementById("loginEmail").value;
    const senha = document.getElementById("loginSenha").value;
    try {
        await auth.signInWithEmailAndPassword(email, senha);
        fecharModal("loginModal");
    } catch (erro) {
        alert("erro: " + erro.message);
    }
}

async function criarConta() {
    const email = document.getElementById("loginEmail").value;
    const senha = document.getElementById("loginSenha").value;
    try {
        const userCred = await auth.createUserWithEmailAndPassword(email, senha);
        await userCred.user.sendEmailVerification();
        alert("conta criada! verifique seu email.");
    } catch (erro) {
        alert("erro: " + erro.message);
    }
}

async function fazerLogout() {
    await auth.signOut();
}

// =====================
// Links
// =====================
async function carregarLinks() {
    try {
        const snapshot = await db.collection("links").orderBy("nome").get();
        todosLinks = [];
        snapshot.forEach(doc => {
            todosLinks.push({
                id: doc.id,
                ...doc.data(),
                cliques: doc.data().cliques || 0,
                nota: doc.data().nota || "",
                dataCriacao: doc.data().dataCriacao || new Date().toISOString()
            });
        });
        if (todosLinks.length === 0) await criarLinksExemplo();
        aplicarOrdenacao();
    } catch (e) {
        const container = document.getElementById("galleryContainer");
        if (container) container.innerHTML = '<div class="no-results">erro ao carregar links.</div>';
    }
}

async function criarLinksExemplo() {
    const exemplos = [
        { nome: "GitHub", url: "https://github.com", imagem: "https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png", nota: "repositórios e código" },
        { nome: "Google", url: "https://google.com", imagem: "https://www.google.com/images/branding/googlelogo/2x/googlelogo_color_92x30dp.png", nota: "o melhor buscador" }
    ];
    for (let item of exemplos) {
        await db.collection("links").add({ ...item, cliques: 0, dataCriacao: new Date().toISOString() });
    }
}

function aplicarOrdenacao() {
    const sortEl = document.getElementById("sortSelect");
    if (sortEl) ordenacaoAtual = sortEl.value;
    let linksFiltrados = [...todosLinks];
    if (ordenacaoAtual === "nome") linksFiltrados.sort((a, b) => a.nome.localeCompare(b.nome));
    else if (ordenacaoAtual === "cliques") linksFiltrados.sort((a, b) => b.cliques - a.cliques);
    else if (ordenacaoAtual === "data") linksFiltrados.sort((a, b) => new Date(b.dataCriacao) - new Date(a.dataCriacao));
    const searchEl = document.getElementById("searchInput");
    renderizarGaleria(linksFiltrados, searchEl ? searchEl.value : "");
}

async function contarClique(id) {
    const link = todosLinks.find(l => l.id === id);
    if (link) {
        await db.collection("links").doc(id).update({ cliques: (link.cliques || 0) + 1 });
        link.cliques++;
        aplicarOrdenacao();
    }
}

function renderizarGaleria(links, busca) {
    const container = document.getElementById("galleryContainer");
    if (!container) return;
    const termo = busca.toLowerCase().trim();
    let filtrados = termo ? links.filter(l => l.nome.toLowerCase().includes(termo)) : links;
    const maxCliques = Math.max(...filtrados.map(l => l.cliques), 0);
    const statsEl = document.getElementById("resultStats");
    if (statsEl) statsEl.innerHTML = `${filtrados.length} link${filtrados.length !== 1 ? 's' : ''}`;
    if (filtrados.length === 0) {
        container.innerHTML = '<div class="no-results">nenhum link encontrado.</div>';
        return;
    }
    let html = "";
    for (let link of filtrados) {
        const ehHot = link.cliques === maxCliques && maxCliques > 0;
        html += `
            <div class="card" style="position:relative">
                ${ehHot ? '<div class="hot-badge">🔥</div>' : ''}
                <div class="card-img"><img src="${link.imagem}" onerror="this.onerror=null;this.style.display='none';this.parentNode.innerHTML+='<span class=fallback-icon>🔗</span>'"></div>
                <div class="card-content">
                    <div class="link-name">${escapeHtml(link.nome)}</div>
                    ${link.nota ? `<div class="link-note">${escapeHtml(link.nota)}</div>` : ''}
                    <div class="link-cliques">👁 ${link.cliques || 0}</div>
                    <div class="card-buttons">
                        <button class="download-btn" onclick="window.open('${link.url}', '_blank'); contarClique('${link.id}')">acessar</button>
                        <button class="share-btn" onclick="compartilharLink('${link.url}', '${link.nome}')">compartilhar</button>
                    </div>
                </div>
            </div>
        `;
    }
    container.innerHTML = html;
}

function compartilharLink(url, nome) {
    if (navigator.share) navigator.share({ title: nome, url });
    else { navigator.clipboard.writeText(url); alert(`link "${nome}" copiado!`); }
}

// =====================
// Pedidos
// =====================
async function carregarPedidos() {
    try {
        const snapshot = await db.collection("pedidos").orderBy("data", "desc").get();
        const container = document.getElementById("pedidosContainer");
        if (!container) return;
        if (snapshot.empty) {
            container.innerHTML = '<div class="no-results">nenhum pedido ainda.</div>';
            return;
        }
        let html = "";
        snapshot.forEach(doc => {
            const p = doc.data();
            const podeAprovar = adminLogado && p.status === "pendente";
            html += `
                <div class="pedido-card">
                    <strong>${escapeHtml(p.nome)}</strong><br>
                    <small>${escapeHtml(p.url)}</small>
                    <div style="font-size:11px; margin-top:6px; color:#8f98a3">${escapeHtml(p.motivo || "sem justificativa")}</div>
                    <div class="pedido-status status-${p.status}">${p.status === "pendente" ? "pendente" : p.status === "aprovado" ? "aprovado" : "recusado"}</div>
                    <small style="color:#4a4f5a">${escapeHtml(p.email)} | ${new Date(p.data).toLocaleDateString()}</small>
                    ${podeAprovar ? `
                        <div style="margin-top:10px; display:flex; gap:8px;">
                            <button onclick="aprovarPedido('${doc.id}', '${escapeHtml(p.nome)}', '${escapeHtml(p.url)}')" style="background:#4c9f4f;">aprovar</button>
                            <button onclick="recusarPedido('${doc.id}')" style="background:#a43a3a;">recusar</button>
                        </div>
                    ` : ''}
                </div>
            `;
        });
        container.innerHTML = html;
    } catch (e) {}
}

function abrirPedidoModal() {
    if (!usuarioAtual) { alert("faça login primeiro!"); abrirLogin(); return; }
    document.getElementById("pedidoModal").style.display = "flex";
}

async function enviarPedido() {
    const nome = document.getElementById("pedidoNome").value.trim();
    const url = document.getElementById("pedidoUrl").value.trim();
    const motivo = document.getElementById("pedidoMotivo").value.trim();
    if (!nome || !url) { alert("nome e url obrigatórios!"); return; }
    await db.collection("pedidos").add({
        nome, url, motivo,
        email: usuarioAtual.email,
        status: "pendente",
        data: new Date().toISOString()
    });
    alert("pedido enviado!");
    fecharModal("pedidoModal");
    document.getElementById("pedidoNome").value = "";
    document.getElementById("pedidoUrl").value = "";
    document.getElementById("pedidoMotivo").value = "";
    await carregarPedidos();
}

async function aprovarPedido(id, nome, url) {
    await db.collection("links").add({
        nome, url,
        imagem: "https://via.placeholder.com/200x150?text=link",
        cliques: 0,
        nota: "aprovado pela comunidade",
        dataCriacao: new Date().toISOString()
    });
    await db.collection("pedidos").doc(id).update({ status: "aprovado" });
    alert("pedido aprovado!");
    await carregarLinks();
    await carregarPedidos();
}

async function recusarPedido(id) {
    await db.collection("pedidos").doc(id).update({ status: "recusado" });
    alert("pedido recusado.");
    await carregarPedidos();
}

// =====================
// Admin
// =====================
async function mostrarAdminPanel() {
    const container = document.getElementById("adminPanel");
    if (!container) return;
    if (!adminLogado) {
        container.innerHTML = `
            <div style="text-align:center;padding:30px">
                <input type="password" id="adminSenha" placeholder="senha master" style="padding:8px">
                <button onclick="validarAdmin()" style="margin-left:8px">entrar</button>
            </div>`;
        return;
    }
    container.innerHTML = `
        <div class="form-group"><h3>adicionar link</h3>
        <label>nome</label><input type="text" id="novoNome">
        <label>url</label><input type="text" id="novaUrl">
        <label>imagem url</label><input type="text" id="novaImagem">
        <label>nota</label><textarea id="novaNota" rows="2"></textarea>
        <button onclick="adicionarLinkAdmin()">adicionar</button></div>
        <hr><h3>links (${todosLinks.length})</h3>
        <div id="listaLinksAdmin" class="link-list"></div>`;
    await listarLinksAdmin();
}

function validarAdmin() {
    if (document.getElementById("adminSenha").value === SENHA_ADMIN) {
        adminLogado = true;
        localStorage.setItem("adminTemp", "true");
        document.getElementById("adminTabBtn").style.display = "inline-block";
        mostrarAdminPanel();
    } else {
        alert("senha incorreta!");
    }
}

async function listarLinksAdmin() {
    const div = document.getElementById("listaLinksAdmin");
    if (!div) return;
    let html = "";
    for (let link of todosLinks) {
        html += `
            <div class="link-item">
                <div><strong>${escapeHtml(link.nome)}</strong><br><small>${link.cliques} cliques</small></div>
                <div>
                    <button onclick="editarLinkAdmin('${link.id}')">editar</button>
                    <button onclick="confirmarExclusao('${link.id}')" style="background:#a43a3a">excluir</button>
                </div>
            </div>`;
    }
    div.innerHTML = html;
}

async function adicionarLinkAdmin() {
    const nome = document.getElementById("novoNome").value.trim();
    const url = document.getElementById("novaUrl").value.trim();
    if (!nome || !url) { alert("nome e url obrigatórios!"); return; }
    await db.collection("links").add({
        nome, url,
        imagem: document.getElementById("novaImagem").value.trim() || "https://via.placeholder.com/200x150?text=link",
        nota: document.getElementById("novaNota").value.trim(),
        cliques: 0,
        dataCriacao: new Date().toISOString()
    });
    alert("link adicionado!");
    document.getElementById("novoNome").value = "";
    document.getElementById("novaUrl").value = "";
    document.getElementById("novaImagem").value = "";
    document.getElementById("novaNota").value = "";
    await carregarLinks();
    await listarLinksAdmin();
}

async function editarLinkAdmin(id) {
    const link = todosLinks.find(l => l.id === id);
    const novoNome = prompt("novo nome:", link.nome);
    if (!novoNome) return;
    const novaUrl = prompt("nova url:", link.url);
    if (!novaUrl) return;
    const novaNota = prompt("nova nota:", link.nota || "");
    await db.collection("links").doc(id).update({ nome: novoNome, url: novaUrl, nota: novaNota || "" });
    alert("link atualizado!");
    await carregarLinks();
    await listarLinksAdmin();
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
    if (aba === "links") {
        document.getElementById("tabLinks").style.display = "block";
        document.querySelector(".tabs button:first-child").classList.add("active");
        aplicarOrdenacao();
    } else if (aba === "pedidos") {
        document.getElementById("tabPedidos").style.display = "block";
        document.querySelectorAll(".tabs button")[1].classList.add("active");
        carregarPedidos();
    } else if (aba === "admin") {
        document.getElementById("tabAdmin").style.display = "block";
        document.querySelectorAll(".tabs button")[2].classList.add("active");
        mostrarAdminPanel();
    }
}

// =====================
// Tema
// =====================
function alternarTema() {
    const body = document.body;
    if (body.classList.contains('dark')) {
        body.classList.remove('dark');
        body.classList.add('light');
        localStorage.setItem('tema', 'light');
    } else {
        body.classList.remove('light');
        body.classList.add('dark');
        localStorage.setItem('tema', 'dark');
    }
}

// =====================
// Utils
// =====================
function escapeHtml(str) {
    if (!str) return "";
    return str.replace(/[&<>]/g, m => m === "&" ? "&amp;" : m === "<" ? "&lt;" : "&gt;");
}

// =====================
// Init (DOM pronto)
// =====================
document.addEventListener("DOMContentLoaded", function () {
    const confirmYes = document.getElementById("confirmYes");
    const confirmNo = document.getElementById("confirmNo");
    const searchInput = document.getElementById("searchInput");
    const clearSearchBtn = document.getElementById("clearSearchBtn");

    if (confirmYes) {
        confirmYes.addEventListener("click", async function () {
            if (pendingAction) {
                await db.collection("links").doc(pendingAction).delete();
                await carregarLinks();
                if (adminLogado) await listarLinksAdmin();
                pendingAction = null;
            }
            document.getElementById("confirmModal").style.display = "none";
        });
    }

    if (confirmNo) {
        confirmNo.addEventListener("click", function () {
            pendingAction = null;
            document.getElementById("confirmModal").style.display = "none";
        });
    }

    if (searchInput) {
        searchInput.addEventListener("input", function (e) {
            aplicarOrdenacao();
            if (clearSearchBtn) clearSearchBtn.style.display = e.target.value ? "inline-block" : "none";
        });
    }

    if (clearSearchBtn) {
        clearSearchBtn.addEventListener("click", function () {
            if (searchInput) searchInput.value = "";
            aplicarOrdenacao();
            this.style.display = "none";
        });
    }

    if (localStorage.getItem('tema') === 'light') document.body.classList.add('light');
});
