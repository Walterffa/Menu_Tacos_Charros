// ==========================================
// CONFIGURACIÓN DE SUPABASE
// ==========================================

const SUPABASE_URL = "https://mzacrjcnvbchfdmhyuaw.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_qbhKxyPafUpxAoNMFZxCZw_vr1mprXU";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

const BUCKET_NAME = "imagenes-productos";

// ==========================================
// VARIABLES
// ==========================================

const $ = id => document.getElementById(id);

let categories = [];
let products = [];
let currentUser = null;
let isAdmin = false;
let selectedCategory = null;
let recommendationTimer = null;
let toastTimer = null;

// ==========================================
// ORDEN PERSONALIZADO DE CATEGORÍAS
// ==========================================

const categoryOrder = [
  "Entradas",
  "Burritos",
  "Carnes",
  "Especialidades",
  "Menú charro",
  "Taquería",
  "Tortas",
  "Nachos",
  "Para compartir",
  "Pal antojo",
  "Extras",
  "Postres",
  "Batidos",
  "Bebidas",
  "Cervezas nacionales",
  "Cervezas internacionales",
  "Cócteles",
  "Cubetazos",
  "Hard Seltzer",
  "Licores",
  "Micheladas",
  "RTD"
];

function normalizeCategoryName(value) {
  return String(value || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function sortCategories() {

  categories.sort((a, b) => {

    const aIndex = categoryOrder.findIndex(name =>
      normalizeCategoryName(name) ===
      normalizeCategoryName(a.nombre)
    );

    const bIndex = categoryOrder.findIndex(name =>
      normalizeCategoryName(name) ===
      normalizeCategoryName(b.nombre)
    );

    if (aIndex === -1 && bIndex === -1) {
      return String(a.nombre).localeCompare(String(b.nombre), "es");
    }

    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;

    return aIndex - bIndex;

  });

}

// ==========================================
// UTILIDADES
// ==========================================

function escapeHTML(value = "") {

  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[character]);

}

function money(value) {

  return "C$ " + Number(value || 0).toLocaleString("es-NI", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

}

function showToast(message) {

  const toast = $("toast");

  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 3000);

}

function setMessage(id, message, success = false) {

  const element = $(id);

  if (!element) return;

  element.textContent = message;

  element.style.color = success
    ? "#65c77d"
    : "#ff941f";

}

// ==========================================
// MODALES
// ==========================================

function openModal(id) {

  const modal = $(id);

  if (!modal) return;

  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");

  document.body.classList.add("modal-open");

}

function closeModal(id) {

  const modal = $(id);

  if (!modal) return;

  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");

  if (!document.querySelector(".modal.open")) {
    document.body.classList.remove("modal-open");
  }

}

// ==========================================
// CARGAR DATOS DE SUPABASE
// ==========================================

async function loadData() {

  $("menuList").innerHTML =
    `<p class="loading-text">Cargando menú...</p>`;

  const [categoryResult, productResult] = await Promise.all([

    supabaseClient
      .from("categorias")
      .select("*")
      .order("nombre"),

    supabaseClient
      .from("productos")
      .select("*")
      .order("nombre")

  ]);

  if (categoryResult.error) {

    console.error(categoryResult.error);

    $("menuList").innerHTML =
      `<p class="loading-text">Error al cargar las categorías.</p>`;

    return;

  }

  if (productResult.error) {

    console.error(productResult.error);

    $("menuList").innerHTML =
      `<p class="loading-text">Error al cargar los productos.</p>`;

    return;

  }

  categories = categoryResult.data || [];
  products = productResult.data || [];

  sortCategories();

  if (
    !categories.some(category =>
      String(category.id) === String(selectedCategory)
    )
  ) {

    selectedCategory = categories.length
      ? String(categories[0].id)
      : null;

  }

  renderCategories();
  renderMenu();
  renderRecommendations();
  renderCategorySelect();
  renderAdminProducts();

}

// ==========================================
// MOSTRAR CATEGORÍAS
// ==========================================

function renderCategories() {

  const container = $("categoryList");

  if (!categories.length) {

    container.innerHTML =
      `<p class="loading-text">No hay categorías registradas.</p>`;

    return;

  }

  container.innerHTML = categories.map(category => `

    <button
      class="category-chip ${
        String(selectedCategory) === String(category.id)
          ? "active"
          : ""
      }"
      data-category="${escapeHTML(category.id)}">

      ${escapeHTML(category.nombre)}

    </button>

  `).join("");

}

// ==========================================
// CATEGORÍAS DEL ADMINISTRADOR
// ==========================================

function renderCategorySelect() {

  $("productCategory").innerHTML = categories.map(category => `

    <option value="${escapeHTML(category.id)}">
      ${escapeHTML(category.nombre)}
    </option>

  `).join("");

}

// ==========================================
// MOSTRAR PRODUCTOS
// ==========================================

function renderMenu() {

  const container = $("menuList");

  const filtered = products.filter(product =>

    String(product.categoria_id) === String(selectedCategory)

  );

  if (!filtered.length) {

    container.innerHTML =
      `<p class="loading-text">No hay productos en esta categoría.</p>`;

    return;

  }

  container.innerHTML = filtered.map((product, index) => `

    <article
      class="product-card"
      data-product="${escapeHTML(product.id)}"
      style="animation-delay:${Math.min(index * 45, 350)}ms">

      <div class="product-info">

        <h3>${escapeHTML(product.nombre)}</h3>

        <span class="product-price">
          ${money(product.precio)}
        </span>

        ${product.disponible === false ? `
          <p class="product-status">
            No disponible actualmente
          </p>
        ` : ""}

        ${isAdmin ? `

          <div class="admin-item-actions product-admin-actions">

            <button
              type="button"
              data-edit="${escapeHTML(product.id)}">
              Editar
            </button>

            <button
              type="button"
              data-delete="${escapeHTML(product.id)}">
              Eliminar
            </button>

          </div>

        ` : ""}

      </div>

    </article>

  `).join("");

}

// ==========================================
// DETALLE DEL PRODUCTO
// ==========================================

function openProductDetail(id) {

  const product = products.find(item =>
    String(item.id) === String(id)
  );

  if (!product) return;

  $("detailName").textContent = product.nombre;

  $("detailDescription").textContent =
    product.descripcion ||
    "Un producto preparado para disfrutar.";

  $("detailPrice").textContent = money(product.precio);

  const image = $("detailImage");

  if (product.imagen_url) {

    image.src = product.imagen_url;
    image.alt = product.nombre;
    image.style.display = "block";

  } else {

    image.removeAttribute("src");
    image.style.display = "none";

  }

  openModal("detailModal");

}

// ==========================================
// RECOMENDACIONES
// ==========================================

function shuffle(array) {

  const result = [...array];

  for (let i = result.length - 1; i > 0; i--) {

    const j = Math.floor(Math.random() * (i + 1));

    [result[i], result[j]] = [result[j], result[i]];

  }

  return result;

}

function renderRecommendations() {

  const container = $("recommendationsList");

  const featured = shuffle(
    products.filter(product =>
      product.disponible !== false &&
      product.destacado === true &&
      product.imagen_url
    )
  ).slice(0, 8);

  if (!featured.length) {

    container.innerHTML =
      `<p class="loading-text">Pronto tendremos recomendaciones.</p>`;

    return;

  }

  container.innerHTML = featured.map(product => `

    <article
      class="recommendation-card"
      data-product="${escapeHTML(product.id)}">

      <img
        src="${escapeHTML(product.imagen_url)}"
        alt="${escapeHTML(product.nombre)}"
        loading="lazy">

      <h3>${escapeHTML(product.nombre)}</h3>

    </article>

  `).join("");

}

// ==========================================
// CARRUSEL AUTOMÁTICO
// ==========================================

function startRecommendationAutoplay() {

  clearInterval(recommendationTimer);

  const container = $("recommendationsList");

  if (!container) return;

  recommendationTimer = setInterval(() => {

    if (document.hidden) return;

    const maxScroll =
      container.scrollWidth - container.clientWidth;

    if (maxScroll <= 0) return;

    if (container.scrollLeft >= maxScroll - 10) {

      container.scrollTo({
        left: 0,
        behavior: "smooth"
      });

    } else {

      container.scrollBy({
        left: 270,
        behavior: "smooth"
      });

    }

  }, 4500);

}

function moveRecommendations(direction) {

  $("recommendationsList").scrollBy({
    left: direction * 270,
    behavior: "smooth"
  });

}

// ==========================================
// BIENVENIDA DE LA MASCOTA
// ==========================================

function closeWelcome() {

  const overlay = $("welcomeOverlay");

  if (!overlay || overlay.classList.contains("closing")) {
    return;
  }

  overlay.classList.add("closing");

  setTimeout(() => {

    overlay.style.display = "none";
    overlay.classList.remove("closing");

    startRecommendationAutoplay();

  }, 350);

  try {

    sessionStorage.setItem(
      "tacosCharrosWelcomeSeen",
      "true"
    );

  } catch (error) {

    console.warn(error);

  }

}

function startWelcome() {

  const overlay = $("welcomeOverlay");

  let alreadySeen = false;

  try {

    alreadySeen =
      sessionStorage.getItem("tacosCharrosWelcomeSeen") === "true";

  } catch (error) {

    console.warn(error);

  }

  if (alreadySeen) {

    overlay.style.display = "none";

    startRecommendationAutoplay();

    return;

  }

  overlay.style.display = "flex";

  clearInterval(recommendationTimer);

}

// ==========================================
// RESEÑAS
// ==========================================

async function submitReview(event) {

  event.preventDefault();

  const nombre = $("reviewName").value.trim();

  const calificacion = Number($("reviewRating").value);

  const comentario = $("reviewComment").value.trim();

  if (!nombre || !comentario) {

    setMessage("reviewMsg", "Completa todos los campos.");

    return;

  }

  setMessage("reviewMsg", "Enviando reseña...");

  const { error } = await supabaseClient
    .from("resenas")
    .insert([{
      nombre,
      calificacion,
      comentario
    }]);

  if (error) {

    console.error(error);

    setMessage(
      "reviewMsg",
      "No se pudo enviar la reseña."
    );

    return;

  }

  $("reviewForm").reset();

  setMessage(
    "reviewMsg",
    "¡Gracias por compartir tu opinión!",
    true
  );

  showToast("Reseña enviada correctamente.");

  setTimeout(() => {

    closeModal("reviewModal");

    setMessage("reviewMsg", "");

  }, 1400);

  if (isAdmin) {
    await loadReviews();
  }

}

// ==========================================
// CARGAR RESEÑAS ADMINISTRATIVAS
// ==========================================

async function loadReviews() {

  if (!isAdmin) return;

  const container = $("adminReviewList");

  container.innerHTML =
    `<p class="loading-text">Cargando reseñas...</p>`;

  const { data, error } = await supabaseClient
    .from("resenas")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {

    console.error(error);

    container.innerHTML =
      `<p class="loading-text">No se pudieron cargar las reseñas.</p>`;

    return;

  }

  if (!data || !data.length) {

    container.innerHTML =
      `<p class="loading-text">Todavía no hay reseñas.</p>`;

    return;

  }

  container.innerHTML = data.map(review => {

    const rating = Math.max(
      0,
      Math.min(5, Number(review.calificacion))
    );

    return `

      <article class="admin-item">

        <div class="admin-item-info">

          <strong>${escapeHTML(review.nombre)}</strong>

          <div class="review-stars">
            ${"★".repeat(rating)}${"☆".repeat(5 - rating)}
          </div>

          <p class="review-comment">
            ${escapeHTML(review.comentario)}
          </p>

          <span class="review-state">
            ${review.visible ? "Publicada" : "Oculta"}
          </span>

        </div>

        <div class="admin-item-actions">

          <button
            type="button"
            data-toggle-review="${escapeHTML(review.id)}"
            data-visible="${review.visible}">

            ${review.visible ? "Ocultar" : "Publicar"}

          </button>

        </div>

      </article>

    `;

  }).join("");

}

// ==========================================
// PUBLICAR / OCULTAR RESEÑAS
// ==========================================

async function toggleReview(id, currentVisibility) {

  const { error } = await supabaseClient
    .from("resenas")
    .update({
      visible: !currentVisibility
    })
    .eq("id", id);

  if (error) {

    console.error(error);

    showToast("No se pudo actualizar la reseña.");

    return;

  }

  showToast(
    currentVisibility
      ? "Reseña ocultada."
      : "Reseña publicada."
  );

  await loadReviews();

}

// ==========================================
// AUTENTICACIÓN
// ==========================================

async function checkAdmin(user) {

  if (!user) return false;

  const { data, error } = await supabaseClient
    .from("perfiles")
    .select("rol")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {

    console.error(error);

    return false;

  }

  return data?.rol === "administrador";

}

async function refreshAdmin(user) {

  currentUser = user || null;

  isAdmin = currentUser
    ? await checkAdmin(currentUser)
    : false;

  $("adminPanel").hidden = !isAdmin;

  renderMenu();
  renderAdminProducts();

  if (isAdmin) {

    await loadReviews();

  } else {

    $("adminReviewList").innerHTML = "";

  }

}

// ==========================================
// INICIAR SESIÓN
// ==========================================

async function loginAdmin(event) {

  event.preventDefault();

  const email = $("loginEmail").value.trim();

  const password = $("loginPassword").value;

  setMessage("loginMsg", "Verificando acceso...");

  const { data, error } = await supabaseClient.auth
    .signInWithPassword({
      email,
      password
    });

  if (error) {

    console.error(error);

    setMessage(
      "loginMsg",
      "Correo o contraseña incorrectos."
    );

    return;

  }

  const authorized = await checkAdmin(data.user);

  if (!authorized) {

    await supabaseClient.auth.signOut();

    setMessage(
      "loginMsg",
      "Esta cuenta no tiene permisos de administrador."
    );

    return;

  }

  await refreshAdmin(data.user);

  closeModal("loginModal");

  $("loginForm").reset();

  setMessage("loginMsg", "");

  showToast("Sesión administrativa iniciada.");

}

// ==========================================
// CERRAR SESIÓN
// ==========================================

async function logoutAdmin() {

  const { error } = await supabaseClient.auth.signOut();

  if (error) {

    console.error(error);

    showToast("No se pudo cerrar la sesión.");

    return;

  }

  await refreshAdmin(null);

  showToast("Sesión cerrada.");

}

// ==========================================
// RECUPERAR CONTRASEÑA
// ==========================================

async function recoverPassword() {

  const email = $("loginEmail").value.trim();

  if (!email) {

    setMessage(
      "loginMsg",
      "Escribe tu correo primero."
    );

    return;

  }

  const { error } = await supabaseClient.auth
    .resetPasswordForEmail(email, {
      redirectTo: window.location.origin
    });

  if (error) {

    console.error(error);

    setMessage(
      "loginMsg",
      "No se pudo enviar el correo de recuperación."
    );

    return;

  }

  setMessage(
    "loginMsg",
    "Revisa tu correo para recuperar tu contraseña.",
    true
  );

}

// ==========================================
// PRODUCTOS ADMINISTRATIVOS
// ==========================================

function renderAdminProducts() {

  const container = $("adminProductList");

  if (!isAdmin) {

    container.innerHTML = "";

    return;

  }

  if (!products.length) {

    container.innerHTML =
      `<p class="loading-text">No hay productos registrados.</p>`;

    return;

  }

  container.innerHTML = products.map(product => `

    <article class="admin-item">

      <div class="admin-item-info">

        <strong>${escapeHTML(product.nombre)}</strong>

        <small>${money(product.precio)}</small>

      </div>

      <div class="admin-item-actions">

        <button
          type="button"
          data-edit="${escapeHTML(product.id)}">
          Editar
        </button>

        <button
          type="button"
          data-delete="${escapeHTML(product.id)}">
          Eliminar
        </button>

      </div>

    </article>

  `).join("");

}

// ==========================================
// LIMPIAR FORMULARIO
// ==========================================

function resetProductForm() {

  $("productForm").reset();

  $("productId").value = "";

  $("productFormTitle").textContent = "Agregar producto";

  $("cancelProductEdit").hidden = true;

  $("productAvailable").checked = true;

  setMessage("productMsg", "");

}

// ==========================================
// EDITAR PRODUCTO
// ==========================================

function editProduct(id) {

  if (!isAdmin) return;

  const product = products.find(item =>
    String(item.id) === String(id)
  );

  if (!product) return;

  $("productId").value = product.id;

  $("productName").value = product.nombre;

  $("productPrice").value = product.precio;

  $("productCategory").value = product.categoria_id;

  $("productDescription").value =
    product.descripcion || "";

  $("productAvailable").checked =
    product.disponible !== false;

  $("productFeatured").checked =
    product.destacado === true;

  $("productFormTitle").textContent = "Editar producto";

  $("cancelProductEdit").hidden = false;

  $("productForm").scrollIntoView({
    behavior: "smooth",
    block: "center"
  });

}

// ==========================================
// SUBIR IMAGEN DE PRODUCTO
// ==========================================

async function uploadProductImage(file) {

  if (!file) return null;

  if (!file.type.startsWith("image/")) {

    throw new Error("Selecciona una imagen válida.");

  }

  const extension = file.name.split(".").pop().toLowerCase();

  const filename =
    `${crypto.randomUUID()}.${extension}`;

  const { error } = await supabaseClient.storage
    .from(BUCKET_NAME)
    .upload(filename, file, {
      cacheControl: "3600",
      upsert: false
    });

  if (error) throw error;

  const { data } = supabaseClient.storage
    .from(BUCKET_NAME)
    .getPublicUrl(filename);

  return data.publicUrl;

}

// ==========================================
// GUARDAR PRODUCTO
// ==========================================

async function saveProduct(event) {

  event.preventDefault();

  if (!isAdmin) {

    showToast("No tienes permisos de administrador.");

    return;

  }

  const id = $("productId").value;

  const payload = {

    nombre: $("productName").value.trim(),

    precio: Number($("productPrice").value),

    categoria_id: $("productCategory").value,

    descripcion: $("productDescription").value.trim(),

    disponible: $("productAvailable").checked,

    destacado: $("productFeatured").checked

  };

  if (
    !payload.nombre ||
    !Number.isFinite(payload.precio) ||
    payload.precio < 0 ||
    !payload.categoria_id
  ) {

    setMessage(
      "productMsg",
      "Revisa los datos del producto."
    );

    return;

  }

  try {

    setMessage("productMsg", "Guardando producto...");

    const file = $("productImage").files[0];

    if (file) {

      payload.imagen_url = await uploadProductImage(file);

    }

    let result;

    if (id) {

      result = await supabaseClient
        .from("productos")
        .update(payload)
        .eq("id", id);

    } else {

      result = await supabaseClient
        .from("productos")
        .insert([payload]);

    }

    if (result.error) throw result.error;

    showToast(
      id
        ? "Producto actualizado."
        : "Producto agregado."
    );

    resetProductForm();

    await loadData();

  } catch (error) {

    console.error(error);

    setMessage(
      "productMsg",
      error.message || "No se pudo guardar el producto."
    );

  }

}

// ==========================================
// ELIMINAR PRODUCTO
// ==========================================

async function deleteProduct(id) {

  if (!isAdmin) return;

  const product = products.find(item =>
    String(item.id) === String(id)
  );

  if (!product) return;

  const confirmed = confirm(
    `¿Eliminar el producto "${product.nombre}"?`
  );

  if (!confirmed) return;

  const { error } = await supabaseClient
    .from("productos")
    .delete()
    .eq("id", id);

  if (error) {

    console.error(error);

    showToast("No se pudo eliminar el producto.");

    return;

  }

  showToast("Producto eliminado.");

  await loadData();

}

// ==========================================
// EVENTOS: CATEGORÍAS
// ==========================================

$("categoryList").addEventListener("click", event => {

  const button = event.target.closest("[data-category]");

  if (!button) return;

  selectedCategory = button.dataset.category;

  renderCategories();

  renderMenu();

});

// ==========================================
// EVENTOS: MENÚ
// ==========================================

$("menuList").addEventListener("click", event => {

  const editButton = event.target.closest("[data-edit]");

  const deleteButton = event.target.closest("[data-delete]");

  if (editButton) {

    event.stopPropagation();

    editProduct(editButton.dataset.edit);

    return;

  }

  if (deleteButton) {

    event.stopPropagation();

    deleteProduct(deleteButton.dataset.delete);

    return;

  }

  const card = event.target.closest("[data-product]");

  if (card) {

    openProductDetail(card.dataset.product);

  }

});

// ==========================================
// EVENTOS: RECOMENDACIONES
// ==========================================

$("recommendationsList").addEventListener("click", event => {

  const card = event.target.closest("[data-product]");

  if (card) {

    openProductDetail(card.dataset.product);

  }

});

$("recommendPrev").addEventListener("click", () => {

  moveRecommendations(-1);

});

$("recommendNext").addEventListener("click", () => {

  moveRecommendations(1);

});

// ==========================================
// EVENTOS: MODALES
// ==========================================

document.querySelectorAll("[data-close]").forEach(button => {

  button.addEventListener("click", () => {

    const modalName = button.dataset.close;

    const modalIds = {
      detail: "detailModal",
      review: "reviewModal",
      login: "loginModal"
    };

    closeModal(modalIds[modalName]);

  });

});

// ==========================================
// EVENTOS: RESEÑAS
// ==========================================

$("openReview").addEventListener("click", () => {

  openModal("reviewModal");

});

$("reviewForm").addEventListener("submit", submitReview);

// ==========================================
// EVENTOS: ADMINISTRACIÓN
// ==========================================

$("adminLoginOpen").addEventListener("click", () => {

  openModal("loginModal");

});

$("loginForm").addEventListener("submit", loginAdmin);

$("forgotPassword").addEventListener("click", recoverPassword);

$("logoutAdmin").addEventListener("click", logoutAdmin);

$("productForm").addEventListener("submit", saveProduct);

$("cancelProductEdit").addEventListener("click", resetProductForm);

$("refreshReviews").addEventListener("click", loadReviews);

// ==========================================
// EVENTOS: LISTA ADMINISTRATIVA
// ==========================================

$("adminProductList").addEventListener("click", event => {

  const editButton = event.target.closest("[data-edit]");

  const deleteButton = event.target.closest("[data-delete]");

  if (editButton) {

    editProduct(editButton.dataset.edit);

  }

  if (deleteButton) {

    deleteProduct(deleteButton.dataset.delete);

  }

});

// ==========================================
// EVENTOS: RESEÑAS ADMINISTRATIVAS
// ==========================================

$("adminReviewList").addEventListener("click", event => {

  const button = event.target.closest("[data-toggle-review]");

  if (!button) return;

  const id = button.dataset.toggleReview;

  const visibility = button.dataset.visible === "true";

  toggleReview(id, visibility);

});

// ==========================================
// EVENTOS: BIENVENIDA
// ==========================================

$("guideNext").addEventListener("click", event => {

  event.stopPropagation();

  closeWelcome();

});

$("welcomeX").addEventListener("click", event => {

  event.stopPropagation();

  closeWelcome();

});

$("welcomeOverlay").addEventListener("click", event => {

  if (event.target.closest("button")) return;

  closeWelcome();

});

// ==========================================
// INICIALIZACIÓN
// ==========================================

async function init() {

  await loadData();

  const { data, error } = await supabaseClient.auth.getSession();

  if (error) {

    console.error(error);

  }

  if (data?.session?.user) {

    await refreshAdmin(data.session.user);

  }

  startWelcome();

}

// ==========================================
// CAMBIOS DE SESIÓN
// ==========================================

supabaseClient.auth.onAuthStateChange((event, session) => {

  if (event === "SIGNED_IN") {

    setTimeout(() => {
      refreshAdmin(session?.user);
    }, 0);

  }

  if (event === "SIGNED_OUT") {

    setTimeout(() => {
      refreshAdmin(null);
    }, 0);

  }

});

// ==========================================
// INICIAR APLICACIÓN
// ==========================================

init();