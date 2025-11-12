// ============================================
// CONFIGURACIÓN Y VARIABLES GLOBALES
// ============================================

// ============================================
// CONFIGURACIÓN Y VARIABLES GLOBALES
// ============================================

let AIRTABLE_TOKEN,
  BASE_ID,
  CLIENTES_TABLE_ID,
  VENTAS_TABLE_ID,
  ANFITRIONES_TABLE_ID,
  INVENTARIO_TABLE_ID,
  PROMOCIONES_TABLE_ID; // ← DEBE ESTAR AQUÍ

let clienteSeleccionado = null;
let anfitrionSeleccionado = null;
let anfitrionTurnoActual = null;
let tipoTransaccionActual = "venta";
let productosInventario = [];
let promocionesActivas = []; // ← NUEVA
let promocionAplicada = null; // ← NUEVA

const INVENTARIO_PRINCIPAL_ID = "tblxyk6vtahtFlLVo";

// ============================================
// MAPEO DE PRODUCTOS A CAMPOS DE AIRTABLE
// ============================================

const MAPEO_PRODUCTOS = {
  Accesorio: "Accesorio_Cantidad",
  Parka: "Parka_Cantidad",
  Chaqueta: "Chaqueta_Cantidad",
  Camisa: "Camisa_Cantidad",
  Polera: "Polera_Cantidad",
  Pantalon: "Pantalon_Cantidad",
  Vestido: "Vestido_Cantidad",
  Falda: "Falda_Cantidad",
  Short: "Short_Cantidad",
  Sweater: "Sweater_Cantidad",
  Abrigo: "Abrigo_Cantidad",
  Poleron: "Poleron_Cantidad",
  Calza: "Calza_Cantidad",
  Jeans: "Jeans_Cantidad",
  Blusa: "Blusa_Cantidad",
  Camiseta: "Camiseta_Cantidad",
  Chaleco: "Chaleco_Cantidad",
  Enterito: "Enterito_Cantidad",
  Jardinera: "Jardinera_Cantidad",
  Buzo: "Buzo_Cantidad",
  Traje: "Traje_Cantidad",
  Blazer: "Blazer_Cantidad",
  Body: "Body_Cantidad",
  Sudadera: "Sudadera_Cantidad",
  CortaViento: "CortaViento_Cantidad",
  Cartera: "Cartera_Cantidad",
  Pañuelo: "Pañuelo_Cantidad",
  Medias: "Medias_Cantidad",
  PoleraDeportiva: "PoleraDeportiva_Cantidad",
  BuzoDeportivo: "BuzoDeportivo_Cantidad",
  PantalonDeVestir: "PantalonDeVestir_Cantidad",
  RopaDeNiño: "RopaDeNiño_Cantidad",
  Polar: "Polar_Cantidad",
};

// ============================================
// INICIALIZACIÓN DEL SISTEMA
// ============================================

async function fetchConfig() {
  try {
    const res = await fetch(
      "https://registro-de-ventas-eight.vercel.app/api/proxy"
    );
    const data = await res.json();

    AIRTABLE_TOKEN = data.airtableToken;
    BASE_ID = data.baseId_;
    CLIENTES_TABLE_ID = data.clientesTable_;
    VENTAS_TABLE_ID = data.ventasTable_;
    ANFITRIONES_TABLE_ID = data.anfitrionesTable_;
    INVENTARIO_TABLE_ID = data.inventarioTable_;
    PROMOCIONES_TABLE_ID = data.promocionesTable_;

    console.log("✅ Configuración cargada correctamente");
    await cargarInventarioCompleto();
    await cargarPromocionesActivas();
    return true;
  } catch (error) {
    console.error("❌ Error al cargar configuración:", error);
    return false;
  }
}

async function cargarInventarioCompleto() {
  try {
    const url = `https://api.airtable.com/v0/${BASE_ID}/${INVENTARIO_PRINCIPAL_ID}`;
    console.log("🔍 Cargando inventario desde:", url);

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` },
    });

    const data = await response.json();

    if (data.records) {
      productosInventario = data.records.map((record) => {
        let codigo =
          record.fields["Código por categoría"] ||
          record.fields["Codigo por categoria"] ||
          record.fields["codigo por categoria"] ||
          "";
        codigo = codigo.toString().replace(/\s+/g, "").trim();
        const categoria =
          record.fields["Categoría"] ||
          record.fields.Categoria ||
          "Sin categoría";
        const inventario = record.fields["Inventario"] || 0;

        return {
          id: record.id,
          codigo: codigo,
          categoria: categoria,
          precio: 0,
          stock: inventario,
          recordCompleto: record,
        };
      });
      console.log(`✅ ${productosInventario.length} productos cargados`);
    }
  } catch (error) {
    console.error("❌ Error al cargar inventario:", error);
    mostrarAlerta("error", "⚠️ Error al cargar inventario.");
  }
}

// ============================================
// GESTIÓN DE PROMOCIONES
// ============================================

// ============================================
// GESTIÓN DE PROMOCIONES
// ============================================

// ============================================
// GESTIÓN DE PROMOCIONES
// ============================================

// ============================================
// GESTIÓN DE PROMOCIONES
// ============================================

async function cargarPromocionesActivas() {
  try {
    const url = `https://api.airtable.com/v0/${BASE_ID}/${PROMOCIONES_TABLE_ID}?sort[0][field]=Prioridad&sort[0][direction]=asc`;

    console.log("🔍 Cargando promociones desde Airtable...");

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Respuesta del servidor:", errorText);
      throw new Error(`Error ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    console.log("📦 Total de registros recibidos:", data.records?.length || 0);

    if (data.records) {
      // Obtener la fecha actual solo con día/mes/año (sin hora)
      const hoy = new Date();
      const hoySoloFecha = new Date(
        hoy.getFullYear(),
        hoy.getMonth(),
        hoy.getDate()
      );

      console.log("📅 Fecha actual:", hoySoloFecha.toLocaleDateString());

      // Filtrar promociones activas
      promocionesActivas = data.records
        .filter((record) => {
          const fields = record.fields;

          // Buscar el campo checkbox por diferentes nombres posibles
          const activa =
            fields["Promocion Activa"] ||
            fields["Promoción Activa"] ||
            fields["promocion activa"] ||
            fields["Activa"] ||
            fields["activa"];

          if (!activa) {
            console.log(
              `  ⏭️ Saltando "${fields.Name || fields.Nombre}" - no está activa`
            );
            return false;
          }

          // Obtener fechas de Airtable y convertir solo a fecha (sin hora)
          let fechaInicio = null;
          let fechaFin = null;

          if (fields["Fecha Inicio"]) {
            const tempInicio = new Date(fields["Fecha Inicio"]);
            fechaInicio = new Date(
              tempInicio.getFullYear(),
              tempInicio.getMonth(),
              tempInicio.getDate()
            );
          }

          if (fields["Fecha Fin"]) {
            const tempFin = new Date(fields["Fecha Fin"]);
            fechaFin = new Date(
              tempFin.getFullYear(),
              tempFin.getMonth(),
              tempFin.getDate()
            );
          }

          // Si no hay fechas, la promoción es válida
          if (!fechaInicio && !fechaFin) {
            console.log(
              `  ✅ "${
                fields.Name || fields.Nombre
              }" - sin restricción de fechas`
            );
            return true;
          }

          // Comparar usando getTime() para comparación numérica precisa
          const hoyTime = hoySoloFecha.getTime();
          const inicioTime = fechaInicio ? fechaInicio.getTime() : -Infinity;
          const finTime = fechaFin ? fechaFin.getTime() : Infinity;

          const dentroDelRango = hoyTime >= inicioTime && hoyTime <= finTime;

          console.log(
            `  ${dentroDelRango ? "✅" : "❌"} "${
              fields.Name || fields.Nombre
            }"`
          );
          if (fechaInicio)
            console.log(
              `     Fecha Inicio: ${fechaInicio.toLocaleDateString()}`
            );
          if (fechaFin)
            console.log(`     Fecha Fin: ${fechaFin.toLocaleDateString()}`);
          console.log(`     Hoy: ${hoySoloFecha.toLocaleDateString()}`);

          return dentroDelRango;
        })
        .map((record) => ({
          id: record.id,
          nombre: record.fields.Name || record.fields.Nombre || "Sin nombre",
          tipo:
            record.fields["Tipo de Promoción"] ||
            record.fields["Tipo de Promocion"] ||
            "",
          categorias:
            record.fields["Categorías Aplicables"] ||
            record.fields["Categorias Aplicables"] ||
            [],
          cantidadMinima:
            record.fields["Cantidad Mínima"] ||
            record.fields["Cantidad Minima"] ||
            2,
          valor: record.fields.Valor || 0,
          prioridad: record.fields.Prioridad || 999,
          descripcion:
            record.fields.Descripción || record.fields.Descripcion || "",
          recordCompleto: record,
        }));

      console.log(
        `✅ ${promocionesActivas.length} promociones activas disponibles`
      );

      mostrarPromocionesDisponibles();
    } else {
      console.log("⚠️ No se encontraron registros");
      promocionesActivas = [];
      mostrarPromocionesDisponibles();
    }
  } catch (error) {
    console.error("❌ Error al cargar promociones:", error);
    mostrarAlerta("error", "⚠️ Error al cargar promociones: " + error.message);
  }
}

function mostrarPromocionesDisponibles() {
  const container = document.getElementById("promocionesDisponibles");
  if (!container) return;

  if (promocionesActivas.length === 0) {
    container.innerHTML =
      '<p style="text-align: center; opacity: 0.7; font-size: 0.9em;">No hay promociones activas hoy</p>';
    return;
  }

  let html = '<div class="promociones-lista">';

  promocionesActivas.forEach((promo) => {
    const icono =
      promo.tipo === "Precio Fijo"
        ? "💰"
        : promo.tipo === "Descuento Porcentual"
        ? "🏷️"
        : promo.tipo === "N x M"
        ? "🎁"
        : "✨";

    html += `
      <div class="promo-card">
        <div class="promo-icon">${icono}</div>
        <div class="promo-info">
          <strong>${promo.nombre}</strong>
          <p>${promo.descripcion || "Promoción especial"}</p>
        </div>
      </div>
    `;
  });

  html += "</div>";
  container.innerHTML = html;
}

document.addEventListener("DOMContentLoaded", async () => {
  console.log("🚀 Iniciando aplicación...");
  const configCargada = await fetchConfig();
  if (configCargada) {
    console.log("✅ Sistema listo");

    // Cargar anfitriones primero
    await cargarAnfitriones();

    // Luego cargar anfitrión guardado del turno
    cargarAnfitrionGuardado();

    const rutInput = document.getElementById("rutCliente");
    if (rutInput) rutInput.focus();
  } else {
    mostrarAlerta(
      "error",
      "❌ Error al cargar la configuración. Por favor, recarga la página."
    );
  }
});

// ============================================
// UTILIDADES - VALIDACIÓN Y FORMATO DE RUT
// ============================================

function cleanRut(rut) {
  return rut.replace(/[^0-9kK]/g, "").toUpperCase();
}

function formatRut(value) {
  value = value.replace(/[^0-9kK]/g, "").toUpperCase();
  if (value.length > 9) value = value.substring(0, 9);
  if (value.length <= 1) return value;

  const dv = value.slice(-1);
  let rut = value.slice(0, -1);
  let formatted = "";
  let counter = 0;

  for (let i = rut.length - 1; i >= 0; i--) {
    formatted = rut[i] + formatted;
    counter++;
    if (counter === 3 && i !== 0) {
      formatted = "." + formatted;
      counter = 0;
    }
  }
  return formatted + "-" + dv;
}

window.formatearRUT = function (input) {
  const cursorPosition = input.selectionStart;
  const oldValue = input.value;
  const oldLength = oldValue.length;
  input.value = formatRut(input.value);
  const newLength = input.value.length;
  const diff = newLength - oldLength;
  input.setSelectionRange(cursorPosition + diff, cursorPosition + diff);
};

window.validarRUT = function (rut) {
  rut = cleanRut(rut);
  if (rut.length < 8 || rut.length > 9) return false;

  const cuerpo = rut.slice(0, -1);
  const dv = rut.slice(-1);
  let suma = 0;
  let multiplo = 2;

  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += parseInt(cuerpo[i]) * multiplo;
    multiplo = multiplo === 7 ? 2 : multiplo + 1;
  }

  const resto = suma % 11;
  const dvEsperado = 11 - resto;
  let dvCalculado;

  if (dvEsperado === 11) dvCalculado = "0";
  else if (dvEsperado === 10) dvCalculado = "K";
  else dvCalculado = dvEsperado.toString();

  return dv === dvCalculado;
};

// ============================================
// UTILIDADES - FORMATO DE PRECIOS
// ============================================

window.formatearPrecio = function (input) {
  let valor = input.value.replace(/\D/g, "");
  if (valor) {
    valor = parseInt(valor).toLocaleString("es-CL");
  }
  input.value = valor;
};

// ============================================
// UTILIDADES - ALERTAS Y LOADING
// ============================================

function mostrarAlerta(tipo, mensaje) {
  ocultarAlertas();
  const alertId =
    tipo === "success"
      ? "alertSuccess"
      : tipo === "error"
      ? "alertError"
      : "alertInfo";
  const alert = document.getElementById(alertId);
  if (alert) {
    alert.textContent = mensaje;
    alert.classList.add("show");
    setTimeout(() => alert.classList.remove("show"), 5000);
  }
}

function ocultarAlertas() {
  ["alertSuccess", "alertError", "alertInfo"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.classList.remove("show");
  });
}

function mostrarLoading(mostrar) {
  const loading = document.getElementById("loading");
  if (loading) {
    loading.classList.toggle("show", mostrar);
  }
}

// ============================================
// GESTIÓN DE CLIENTES
// ============================================

window.buscarClienteEnter = function (event) {
  if (event.key === "Enter") {
    event.preventDefault();
    buscarCliente();
  }
};

window.buscarCliente = async function () {
  const input = document.getElementById("rutCliente");
  const rut = input.value.trim();

  if (!rut) {
    mostrarAlerta("info", "⚠️ Por favor, ingresa un RUT");
    return;
  }

  const rutLimpio = cleanRut(rut);

  if (rutLimpio.length < 8) {
    mostrarAlerta("error", "❌ RUT incompleto. Debe tener al menos 8 dígitos.");
    input.focus();
    return;
  }

  if (!validarRUT(rut)) {
    mostrarAlerta("error", "❌ RUT inválido. Verifica el dígito verificador.");
    input.focus();
    input.select();
    return;
  }

  if (!AIRTABLE_TOKEN || !BASE_ID) {
    mostrarAlerta(
      "error",
      "❌ Error: Configuración no cargada. Recarga la página."
    );
    return;
  }

  mostrarLoading(true);
  ocultarAlertas();

  try {
    const rutLimpioEncoded = encodeURIComponent(rutLimpio);
    const rutFormatEncoded = encodeURIComponent(rut);
    const url = `https://api.airtable.com/v0/${BASE_ID}/${CLIENTES_TABLE_ID}?filterByFormula=OR({Rut.}='${rutLimpioEncoded}',{Rut.}='${rutFormatEncoded}')`;

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` },
    });

    const data = await response.json();
    mostrarLoading(false);

    if (data.records && data.records.length > 0) {
      clienteSeleccionado = data.records[0];
      mostrarInfoCliente(clienteSeleccionado);

      const workArea = document.getElementById("workArea");
      if (workArea) workArea.classList.add("show");

      const emptyState = document.getElementById("emptyState");
      if (emptyState) emptyState.style.display = "none";

      cargarAnfitriones();

      setTimeout(() => {
        const codigoInput = document.getElementById("codigoProducto");
        if (codigoInput) codigoInput.focus();
        mostrarAlerta("info", "Escanea el código de barras");
      }, 100);

      calcularTotal();
    } else {
      mostrarClienteNoEncontrado();
    }
  } catch (error) {
    mostrarLoading(false);
    mostrarAlerta("error", "❌ Error al buscar cliente: " + error.message);
    console.error("Error:", error);
  }
};

function mostrarInfoCliente(cliente) {
  const fields = cliente.fields;
  document.getElementById("clienteNombre").textContent = fields.Nombre || "N/A";
  document.getElementById("clienteTelefono").textContent =
    fields["Teléfono"] || "N/A";
  document.getElementById("clienteRUT").textContent = fields["Rut."] || "N/A";
  document.getElementById("clienteInfo").classList.add("show");
  document.getElementById("clienteNoEncontrado").classList.remove("show");
}

function mostrarClienteNoEncontrado() {
  clienteSeleccionado = null;
  document.getElementById("clienteInfo").classList.remove("show");
  document.getElementById("clienteNoEncontrado").classList.add("show");

  const workArea = document.getElementById("workArea");
  if (workArea) workArea.classList.remove("show");
}

// ============================================
// GESTIÓN DE ANFITRIONES
// ============================================

async function cargarAnfitriones() {
  try {
    const url = `https://api.airtable.com/v0/${BASE_ID}/${ANFITRIONES_TABLE_ID}`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` },
    });

    const data = await response.json();
    const selectTurno = document.getElementById("anfitrionTurnoSelect");

    if (!selectTurno) return;

    // Limpiar opciones excepto la primera
    while (selectTurno.options.length > 1) {
      selectTurno.remove(1);
    }

    if (data.records) {
      data.records.forEach((record) => {
        const option = document.createElement("option");
        option.value = record.id;
        option.textContent =
          record.fields.Nombre || record.fields.name || "Sin nombre";
        option.dataset.nombre = option.textContent;
        selectTurno.appendChild(option);
      });

      // Si hay anfitrión guardado, seleccionarlo
      if (anfitrionTurnoActual) {
        selectTurno.value = anfitrionTurnoActual.id;
        mostrarAnfitrionActual();
      }
    }
  } catch (error) {
    console.error("Error al cargar anfitriones:", error);
  }
}

// Nueva función: Establecer anfitrión del turno
window.establecerAnfitrionTurno = function () {
  const selectTurno = document.getElementById("anfitrionTurnoSelect");
  if (!selectTurno || !selectTurno.value) {
    anfitrionTurnoActual = null;
    ocultarAnfitrionActual();
    // Limpiar localStorage
    try {
      localStorage.removeItem("anfitrionTurno");
    } catch (e) {
      console.log("No se pudo limpiar localStorage");
    }
    return;
  }

  const selectedOption = selectTurno.options[selectTurno.selectedIndex];
  anfitrionTurnoActual = {
    id: selectTurno.value,
    nombre: selectedOption.dataset.nombre || selectedOption.textContent,
  };

  // Guardar en localStorage para persistencia
  try {
    localStorage.setItem(
      "anfitrionTurno",
      JSON.stringify(anfitrionTurnoActual)
    );
  } catch (e) {
    console.log("No se pudo guardar en localStorage");
  }

  mostrarAnfitrionActual();
  mostrarAlerta(
    "success",
    `✅ ${anfitrionTurnoActual.nombre} establecido como anfitrión del turno`
  );
};

// Nueva función: Mostrar anfitrión actual
function mostrarAnfitrionActual() {
  const container = document.getElementById("anfitrionActual");
  const nombreEl = document.getElementById("nombreAnfitrionActual");

  if (container && nombreEl && anfitrionTurnoActual) {
    nombreEl.textContent = anfitrionTurnoActual.nombre;
    container.style.display = "block";
  }
}

// Nueva función: Ocultar anfitrión actual
function ocultarAnfitrionActual() {
  const container = document.getElementById("anfitrionActual");
  if (container) {
    container.style.display = "none";
  }
}

// Nueva función: Cargar anfitrión guardado
function cargarAnfitrionGuardado() {
  try {
    const guardado = localStorage.getItem("anfitrionTurno");
    if (guardado) {
      anfitrionTurnoActual = JSON.parse(guardado);
      console.log(
        "✅ Anfitrión del turno cargado:",
        anfitrionTurnoActual.nombre
      );
    }
  } catch (e) {
    console.log("No se pudo cargar anfitrión guardado");
    anfitrionTurnoActual = null;
  }
}

// ============================================
// GESTIÓN DE TIPO DE TRANSACCIÓN
// ============================================

window.cambiarTipoTransaccion = function (tipo) {
  tipoTransaccionActual = tipo;
  const ventasSection = document.getElementById("ventasSection");
  const devolucionesSection = document.getElementById("devolucionesSection");
  const anfitrionContainer = document.getElementById("anfitrionContainer");

  if (tipo === "venta") {
    if (ventasSection) ventasSection.style.display = "block";
    if (devolucionesSection) devolucionesSection.style.display = "none";
    if (anfitrionContainer) anfitrionContainer.style.display = "block";
    setTimeout(() => {
      const input = document.getElementById("codigoProducto");
      if (input) input.focus();
    }, 100);
  } else {
    if (ventasSection) ventasSection.style.display = "none";
    if (devolucionesSection) devolucionesSection.style.display = "block";
    if (anfitrionContainer) anfitrionContainer.style.display = "block";

    // Limpiar tabla de devoluciones
    const tbodyDevolucion = document.querySelector("#devolucionesLista tbody");
    if (tbodyDevolucion) {
      tbodyDevolucion.innerHTML = `
        <tr>
          <td><input type="text" class="devolucion-nombre" placeholder="Nombre del producto"></td>
          <td><input type="text" class="devolucion-precio" placeholder="0" oninput="formatearPrecio(this); calcularTotal();"></td>
          <td><button class="btn btn-remove" onclick="eliminarProductoDevolucion(this)">🗑️</button></td>
        </tr>
      `;
    }

    setTimeout(() => {
      const input = document.getElementById("codigoDevolucion");
      if (input) input.focus();
    }, 100);
  }
  calcularTotal();
};

// ============================================
// GESTIÓN DE PRODUCTOS - VENTAS
// ============================================

window.procesarCodigoProducto = function (event) {
  if (event.key === "Enter") {
    event.preventDefault();
    const codigo = document.getElementById("codigoProducto").value.trim();
    if (codigo) {
      buscarYAgregarProductoPorCodigo(codigo);
      document.getElementById("codigoProducto").value = "";
      document.getElementById("codigoProducto").focus();
    }
  }
};

async function buscarYAgregarProductoPorCodigo(codigoEscaneado) {
  const codigoLimpio = codigoEscaneado.replace(/\s+/g, "").trim();

  try {
    const formulaExacta = encodeURIComponent(
      `{Código por categoría}='${codigoLimpio}'`
    );
    const url = `https://api.airtable.com/v0/${BASE_ID}/${INVENTARIO_PRINCIPAL_ID}?filterByFormula=${formulaExacta}`;

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` },
    });

    const data = await response.json();

    if (data.records && data.records.length > 0) {
      const record = data.records[0];
      const producto = {
        id: record.id,
        codigo: record.fields["Código por categoría"] || codigoLimpio,
        categoria:
          record.fields["Categoría"] ||
          record.fields.Categoria ||
          "Sin categoría",
        stock: record.fields["Inventario"] || 0,
        recordCompleto: record,
      };
      agregarProductoDesdeInventario(producto);
      mostrarAlerta(
        "success",
        `✅ ${producto.categoria} agregado - Stock: ${producto.stock}`
      );
    } else {
      const productoLocal = productosInventario.find(
        (p) =>
          p.codigo.replace(/\s+/g, "").toLowerCase() ===
          codigoLimpio.toLowerCase()
      );

      if (productoLocal) {
        agregarProductoDesdeInventario(productoLocal);
        mostrarAlerta("success", `✅ ${productoLocal.categoria} agregado`);
      } else {
        mostrarAlerta("error", `❌ Código "${codigoLimpio}" no encontrado`);
        setTimeout(() => {
          const agregar = confirm(
            `Código "${codigoLimpio}" no encontrado.\n¿Deseas agregarlo manualmente?`
          );
          if (agregar) agregarProductoConCodigo(codigoLimpio);
        }, 100);
      }
    }
  } catch (error) {
    console.error("❌ Error al buscar producto:", error);
    mostrarAlerta("error", "❌ Error al buscar producto: " + error.message);
  }
}

function agregarProductoDesdeInventario(producto) {
  const tbody = document.querySelector("#productosLista tbody");
  if (!tbody) return;

  const filasVacias = tbody.querySelectorAll("tr");
  filasVacias.forEach((fila) => {
    const nombre = fila.querySelector(".producto-nombre")?.value;
    const precio = fila.querySelector(".producto-precio")?.value;
    if (!nombre && !precio) fila.remove();
  });

  const filaHTML = `
    <tr data-producto-id="${producto.id}" data-categoria="${producto.categoria}">
      <td>
        <input type="text" class="producto-nombre" value="${producto.categoria}" readonly 
               style="background-color: #e8f5e9; font-weight: 600; border: 2px solid #10b981; color: #065f46;">
        <div style="font-size: 0.85em; color: #6b7280; margin-top: 4px;">
        </div>
      </td>
      <td>
        <input type="text" class="producto-precio" placeholder="Ingresa precio" 
               oninput="formatearPrecio(this); calcularTotal();" autofocus>
      </td>
      <td>
        <button class="btn btn-remove" onclick="eliminarProducto(this)">🗑️</button>
      </td>
    </tr>
  `;

  tbody.insertAdjacentHTML("beforeend", filaHTML);

  const ultimoPrecio = tbody.querySelector("tr:last-child .producto-precio");
  if (ultimoPrecio) {
    setTimeout(() => {
      ultimoPrecio.focus();
      ultimoPrecio.addEventListener("blur", () => {
        setTimeout(() => {
          const codigoInput = document.getElementById("codigoProducto");
          if (codigoInput) codigoInput.focus();
        }, 100);
      });
    }, 100);
  }
  calcularTotal();
  detectarPromocionesAplicables();
}

function detectarPromocionesAplicables() {
  if (promocionesActivas.length === 0) {
    console.log("⚠️ No hay promociones activas");
    return;
  }

  // Contar productos por categoría en la tabla
  const productosEnTabla = {};
  const filas = document.querySelectorAll("#productosLista tbody tr");

  filas.forEach((fila) => {
    const categoria = fila.dataset.categoria;
    const precio = fila.querySelector(".producto-precio")?.value;

    if (categoria && precio) {
      productosEnTabla[categoria] = (productosEnTabla[categoria] || 0) + 1;
    }
  });

  console.log("🔍 Productos en tabla:", productosEnTabla);

  // Buscar promociones aplicables
  let promoSugerida = null;

  for (const promo of promocionesActivas) {
    console.log(`🔍 Evaluando promoción: ${promo.nombre}`);
    console.log(`   Categorías aplicables:`, promo.categorias);
    console.log(`   Cantidad mínima: ${promo.cantidadMinima}`);

    // ✅ CAMBIO CLAVE: Sumar todas las categorías aplicables
    let cantidadTotal = 0;
    const categoriasEncontradas = [];

    for (const categoria of promo.categorias) {
      const cantidad = productosEnTabla[categoria] || 0;
      console.log(`   ${categoria}: ${cantidad} productos`);

      if (cantidad > 0) {
        cantidadTotal += cantidad;
        categoriasEncontradas.push(categoria);
      }
    }

    console.log(`   📊 Total combinado: ${cantidadTotal} productos`);

    // Verificar si cumple la cantidad mínima
    if (cantidadTotal >= promo.cantidadMinima) {
      promoSugerida = {
        ...promo,
        categoria: categoriasEncontradas.join(" + "), // Mostrar todas las categorías
        cantidad: cantidadTotal,
        categoriasAplicadas: categoriasEncontradas, // Guardar array de categorías
      };
      console.log(`✅ Promoción aplicable encontrada: ${promo.nombre}`);
      break;
    }
  }

  // Mostrar sugerencia
  const sugerenciaContainer = document.getElementById("sugerenciaPromocion");
  if (!sugerenciaContainer) {
    console.warn("⚠️ No se encontró el contenedor 'sugerenciaPromocion'");
    return;
  }

  if (promoSugerida) {
    const yaAplicada =
      promocionAplicada && promocionAplicada.id === promoSugerida.id;

    sugerenciaContainer.innerHTML = `
      <div class="promo-sugerencia" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 12px; margin: 15px 0; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);">
        <div class="promo-badge" style="background: rgba(255,255,255,0.2); display: inline-block; padding: 8px 16px; border-radius: 20px; font-weight: bold; margin-bottom: 10px;">
          🎉 ¡PROMOCIÓN DISPONIBLE!
        </div>
        <p style="font-size: 1.2em; font-weight: bold; margin: 10px 0;">${
          promoSugerida.nombre
        }</p>
        <p style="font-size: 0.95em; margin: 8px 0; opacity: 0.95;">${
          promoSugerida.descripcion || "Promoción especial"
        }</p>
        <p style="font-size: 0.9em; margin: 8px 0; opacity: 0.9;">📦 Tienes ${
          promoSugerida.cantidad
        } ${promoSugerida.categoria}(s)</p>
        ${
          !yaAplicada
            ? `
          <button class="btn btn-aplicar-promo" onclick="aplicarPromocion('${promoSugerida.id}', '${promoSugerida.categoria}', ${promoSugerida.cantidad})" 
                  style="background: white; color: #667eea; padding: 12px 24px; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; margin-top: 10px; font-size: 1em;">
            ✅ Aplicar Promoción
          </button>
        `
            : `
          <div style="background: rgba(16, 185, 129, 0.3); padding: 12px; border-radius: 8px; margin-top: 10px;">
            ✅ Promoción aplicada
          </div>
          <button class="btn btn-cancelar-promo" onclick="cancelarPromocion()" 
                  style="background: rgba(239, 68, 68, 0.3); color: white; padding: 10px 20px; border: 2px solid white; border-radius: 8px; font-weight: bold; cursor: pointer; margin-top: 10px;">
            ❌ Cancelar Promoción
          </button>
        `
        }
      </div>
    `;
    sugerenciaContainer.style.display = "block";
  } else {
    console.log("ℹ️ No hay promociones aplicables con los productos actuales");
    sugerenciaContainer.style.display = "none";
  }
}

window.aplicarPromocion = function (promoId, categoriaDisplay, cantidad) {
  console.log("🎯 BOTÓN CLICKEADO - Aplicar Promoción");
  console.log("   promoId:", promoId);
  console.log("   categoriaDisplay:", categoriaDisplay);
  console.log("   cantidad:", cantidad);

  const promo = promocionesActivas.find((p) => p.id === promoId);
  if (!promo) {
    console.error("❌ Promoción no encontrada:", promoId);
    console.error("   Promociones disponibles:", promocionesActivas);
    mostrarAlerta("error", "❌ Error: Promoción no encontrada");
    return;
  }

  console.log("🎉 Aplicando promoción:", promo.nombre);
  console.log("   Tipo:", promo.tipo);
  console.log("   Valor:", promo.valor);

  // Guardar promoción aplicada con las categorías que aplican
  promocionAplicada = {
    ...promo,
    categoriaAplicada: promo.categorias, // Guardar TODAS las categorías aplicables
    cantidadAplicada: cantidad,
  };

  console.log("✅ Promoción aplicada guardada:", promocionAplicada);

  mostrarAlerta(
    "success",
    `✅ Promoción "${promo.nombre}" aplicada correctamente`
  );

  calcularTotal();
  detectarPromocionesAplicables();
};
window.cancelarPromocion = function () {
  console.log("🔄 Cancelando promoción");
  promocionAplicada = null;
  mostrarAlerta("info", "ℹ️ Promoción cancelada");
  calcularTotal();
  detectarPromocionesAplicables();
};

window.agregarProductoConCodigo = function (codigo) {
  const tbody = document.querySelector("#productosLista tbody");
  if (!tbody) return;

  const filaHTML = `
    <tr data-categoria="${codigo}">
      <td>
        <input type="text" class="producto-nombre" value="${codigo}">
        <div style="font-size: 0.85em; color: #6b7280; margin-top: 4px;">📝 Manual</div>
      </td>
      <td>
        <input type="text" class="producto-precio" placeholder="Ingresa precio" 
               oninput="formatearPrecio(this); calcularTotal();" autofocus>
      </td>
      <td>
        <button class="btn btn-remove" onclick="eliminarProducto(this)">🗑️</button>
      </td>
    </tr>
  `;
  tbody.insertAdjacentHTML("beforeend", filaHTML);
};

window.agregarProducto = function () {
  const tbody = document.querySelector("#productosLista tbody");
  if (!tbody) return;

  const filaHTML = `
    <tr>
      <td><input type="text" class="producto-nombre" placeholder="Nombre del producto"></td>
      <td><input type="text" class="producto-precio" placeholder="Ingresa precio" 
                 oninput="formatearPrecio(this); calcularTotal();"></td>
      <td><button class="btn btn-remove" onclick="eliminarProducto(this)">🗑️</button></td>
    </tr>
  `;
  tbody.insertAdjacentHTML("beforeend", filaHTML);
};

window.agregarProductoManual = function () {
  const select = document.getElementById("selectProductoManual");
  if (select && select.value) {
    agregarProductoConCodigo(select.value);
    select.value = "";
  }
};

window.eliminarProducto = function (btn) {
  const tbody = document.querySelector("#productosLista tbody");
  if (!tbody) return;

  const filas = tbody.querySelectorAll("tr");
  if (filas.length > 1) {
    btn.closest("tr").remove();
    calcularTotal();
  } else {
    mostrarAlerta("info", "⚠️ Debe haber al menos un producto");
  }
};

// ============================================
// GESTIÓN DE DEVOLUCIONES
// ============================================

window.procesarCodigoDevolucion = function (event) {
  if (event.key === "Enter") {
    event.preventDefault();
    const codigo = document.getElementById("codigoDevolucion").value.trim();
    if (codigo) {
      buscarYAgregarProductoDevolucion(codigo);
      document.getElementById("codigoDevolucion").value = "";
      document.getElementById("codigoDevolucion").focus();
    }
  }
};

async function buscarYAgregarProductoDevolucion(codigoEscaneado) {
  const codigoLimpio = codigoEscaneado.replace(/\s+/g, "").trim();

  try {
    const formulaExacta = encodeURIComponent(
      `{Código por categoría}='${codigoLimpio}'`
    );
    const url = `https://api.airtable.com/v0/${BASE_ID}/${INVENTARIO_PRINCIPAL_ID}?filterByFormula=${formulaExacta}`;

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` },
    });

    const data = await response.json();

    if (data.records && data.records.length > 0) {
      const record = data.records[0];
      const producto = {
        id: record.id,
        codigo: record.fields["Código por categoría"] || codigoLimpio,
        categoria:
          record.fields["Categoría"] ||
          record.fields.Categoria ||
          "Sin categoría",
        stock: record.fields["Inventario"] || 0,
        recordCompleto: record,
      };
      agregarProductoDevolucionATabla(producto);
      mostrarAlerta(
        "success",
        `✅ ${producto.categoria} agregado a devolución - Stock: ${producto.stock}`
      );
    } else {
      const productoLocal = productosInventario.find(
        (p) =>
          p.codigo.replace(/\s+/g, "").toLowerCase() ===
          codigoLimpio.toLowerCase()
      );

      if (productoLocal) {
        agregarProductoDevolucionATabla(productoLocal);
        mostrarAlerta(
          "success",
          `✅ ${productoLocal.categoria} agregado a devolución`
        );
      } else {
        mostrarAlerta("error", `❌ Código "${codigoLimpio}" no encontrado`);
        setTimeout(() => {
          const agregar = confirm(
            `Código "${codigoLimpio}" no encontrado.\n¿Deseas agregarlo manualmente?`
          );
          if (agregar) agregarProductoDevolucionConCodigo(codigoLimpio);
        }, 100);
      }
    }
  } catch (error) {
    console.error("❌ Error al buscar producto:", error);
    mostrarAlerta("error", "❌ Error al buscar producto: " + error.message);
  }
}

function agregarProductoDevolucionATabla(producto) {
  const tbody = document.querySelector("#devolucionesLista tbody");
  if (!tbody) return;

  const filasVacias = tbody.querySelectorAll("tr");
  filasVacias.forEach((fila) => {
    const nombre = fila.querySelector(".devolucion-nombre")?.value;
    const precio = fila.querySelector(".devolucion-precio")?.value;
    if (!nombre && !precio) fila.remove();
  });

  const filaHTML = `
    <tr data-producto-id="${producto.id}" data-categoria="${producto.categoria}">
      <td>
        <input type="text" class="devolucion-nombre" value="${producto.categoria}" readonly 
               style="background-color: #fee2e2; font-weight: 600; border: 2px solid #ef4444; color: #991b1b;">
        <div style="font-size: 0.85em; color: #6b7280; margin-top: 4px;">
          Código: ${producto.codigo}
        </div>
      </td>
      <td>
        <input type="text" class="devolucion-precio" placeholder="Ingresa precio" 
               oninput="formatearPrecio(this); calcularTotal();" autofocus>
      </td>
      <td>
        <button class="btn btn-remove" onclick="eliminarProductoDevolucion(this)
        ">🗑️</button>
      </td>
    </tr>
  `;

  tbody.insertAdjacentHTML("beforeend", filaHTML);

  const ultimoPrecio = tbody.querySelector("tr:last-child .devolucion-precio");
  if (ultimoPrecio) {
    setTimeout(() => {
      ultimoPrecio.focus();
      ultimoPrecio.addEventListener("blur", () => {
        setTimeout(() => {
          const codigoInput = document.getElementById("codigoDevolucion");
          if (codigoInput) codigoInput.focus();
        }, 100);
      });
    }, 100);
  }
  calcularTotal();
}

window.agregarProductoDevolucionConCodigo = function (codigo) {
  const tbody = document.querySelector("#devolucionesLista tbody");
  if (!tbody) return;

  const filaHTML = `
    <tr data-categoria="${codigo}">
      <td>
        <input type="text" class="devolucion-nombre" value="${codigo}">
        <div style="font-size: 0.85em; color: #6b7280; margin-top: 4px;">📝 Manual</div>
      </td>
      <td>
        <input type="text" class="devolucion-precio" placeholder="Ingresa precio" 
               oninput="formatearPrecio(this); calcularTotal();" autofocus>
      </td>
      <td>
        <button class="btn btn-remove" onclick="eliminarProductoDevolucion(this)">🗑️</button>
      </td>
    </tr>
  `;
  tbody.insertAdjacentHTML("beforeend", filaHTML);
};

window.agregarProductoDevolucion = function () {
  const tbody = document.querySelector("#devolucionesLista tbody");
  if (!tbody) return;

  const filaHTML = `
    <tr>
      <td><input type="text" class="devolucion-nombre" placeholder="Nombre del producto"></td>
      <td><input type="text" class="devolucion-precio" placeholder="Ingresa precio" 
                 oninput="formatearPrecio(this); calcularTotal();"></td>
      <td><button class="btn btn-remove" onclick="eliminarProductoDevolucion(this)">🗑️</button></td>
    </tr>
  `;
  tbody.insertAdjacentHTML("beforeend", filaHTML);
};

window.eliminarProductoDevolucion = function (btn) {
  const tbody = document.querySelector("#devolucionesLista tbody");
  if (!tbody) return;

  const filas = tbody.querySelectorAll("tr");
  if (filas.length > 1) {
    btn.closest("tr").remove();
    calcularTotal();
  } else {
    mostrarAlerta("info", "⚠️ Debe haber al menos un producto");
  }
};

// ============================================
// CÁLCULOS Y TOTALES
// ============================================

window.calcularTotal = function () {
  let subtotal = 0;

  // Calcular según el tipo de transacción
  if (tipoTransaccionActual === "venta") {
    const precios = document.querySelectorAll(".producto-precio");
    precios.forEach((input) => {
      const valorLimpio = input.value.replace(/\./g, "").replace(/\D/g, "");
      const precio = valorLimpio ? parseInt(valorLimpio) : 0;
      subtotal += precio;
    });
  } else if (tipoTransaccionActual === "devolucion") {
    const preciosDevolucion = document.querySelectorAll(".devolucion-precio");
    preciosDevolucion.forEach((input) => {
      const valorLimpio = input.value.replace(/\./g, "").replace(/\D/g, "");
      const precio = valorLimpio ? parseInt(valorLimpio) : 0;
      subtotal += precio;
    });
  }

  const descuentoInput = document.getElementById("descuento");
  const descuentoPorcentaje = descuentoInput
    ? parseFloat(descuentoInput.value) || 0
    : 0;
  const descuentoMonto = Math.round((subtotal * descuentoPorcentaje) / 100);

  // Obtener valor de Gift Card
  const giftCardInput = document.getElementById("giftCard");
  const giftCardTexto = giftCardInput
    ? giftCardInput.value.replace(/\./g, "").replace(/\D/g, "")
    : "0";
  const giftCardMonto = giftCardTexto ? parseInt(giftCardTexto) : 0;

  window.calcularTotal = function () {
    let subtotal = 0;

    // Calcular según el tipo de transacción
    if (tipoTransaccionActual === "venta") {
      const precios = document.querySelectorAll(".producto-precio");
      precios.forEach((input) => {
        const valorLimpio = input.value.replace(/\./g, "").replace(/\D/g, "");
        const precio = valorLimpio ? parseInt(valorLimpio) : 0;
        subtotal += precio;
      });
    } else if (tipoTransaccionActual === "devolucion") {
      const preciosDevolucion = document.querySelectorAll(".devolucion-precio");
      preciosDevolucion.forEach((input) => {
        const valorLimpio = input.value.replace(/\./g, "").replace(/\D/g, "");
        const precio = valorLimpio ? parseInt(valorLimpio) : 0;
        subtotal += precio;
      });
    }

    const descuentoInput = document.getElementById("descuento");
    const descuentoPorcentaje = descuentoInput
      ? parseFloat(descuentoInput.value) || 0
      : 0;
    let descuentoMonto = Math.round((subtotal * descuentoPorcentaje) / 100);

    // ========== CALCULAR DESCUENTO POR PROMOCIÓN ==========
    // ========== CALCULAR DESCUENTO POR PROMOCIÓN ==========
    let descuentoPromocion = 0;

    if (promocionAplicada && tipoTransaccionActual === "venta") {
      console.log(
        "💰 Calculando descuento de promoción:",
        promocionAplicada.nombre
      );

      const tipo = promocionAplicada.tipo;
      const valor = promocionAplicada.valor;
      const cantidadMinima = promocionAplicada.cantidadMinima || 2;

      // Obtener las categorías aplicables
      const categoriasPromo = Array.isArray(promocionAplicada.categoriaAplicada)
        ? promocionAplicada.categoriaAplicada
        : [promocionAplicada.categoriaAplicada];

      console.log("   Tipo:", tipo);
      console.log("   Valor:", valor);
      console.log("   Cantidad mínima:", cantidadMinima);
      console.log("   Categorías aplicables:", categoriasPromo);

      // ✅ RECOLECTAR TODOS LOS PRECIOS DE LAS CATEGORÍAS APLICABLES
      const preciosPromo = [];

      document.querySelectorAll("#productosLista tbody tr").forEach((fila) => {
        const categoria = fila.dataset.categoria;
        const precioInput = fila.querySelector(".producto-precio");
        const precioTexto =
          precioInput?.value.replace(/\./g, "").replace(/\D/g, "") || "0";
        const precio = parseInt(precioTexto);

        if (categoriasPromo.includes(categoria) && precio > 0) {
          preciosPromo.push({ categoria, precio });
        }
      });

      console.log(`   📦 ${preciosPromo.length} prendas elegibles encontradas`);

      if (preciosPromo.length >= cantidadMinima) {
        // Ordenar de menor a mayor precio
        preciosPromo.sort((a, b) => a.precio - b.precio);

        // ✅ CALCULAR CUÁNTAS VECES APLICA LA PROMOCIÓN
        const vecesAplica = Math.floor(preciosPromo.length / cantidadMinima);
        console.log(`   🔁 La promoción aplica ${vecesAplica} vez/veces`);

        if (tipo === "Precio Fijo") {
          // Ej: 2 prendas x $9.900 total
          // Si hay 4 prendas: 2 grupos × ($precio_grupo - $9.900)
          for (let i = 0; i < vecesAplica; i++) {
            const inicio = i * cantidadMinima;
            const fin = inicio + cantidadMinima;
            const grupoPrecios = preciosPromo.slice(inicio, fin);
            const subtotalGrupo = grupoPrecios.reduce(
              (sum, p) => sum + p.precio,
              0
            );
            const descuentoGrupo = subtotalGrupo - valor;
            descuentoPromocion += descuentoGrupo;
            console.log(
              `   📉 Grupo ${
                i + 1
              }: Subtotal ${subtotalGrupo} → ${valor} = Descuento ${descuentoGrupo}`
            );
          }

          // ========== CALCULAR DESCUENTO POR PROMOCIÓN ==========
          // ========== CALCULAR DESCUENTO POR PROMOCIÓN ==========
          let descuentoPromocion = 0;

          if (promocionAplicada && tipoTransaccionActual === "venta") {
            console.log(
              "💰 Calculando descuento de promoción:",
              promocionAplicada.nombre
            );

            const tipo = promocionAplicada.tipo;
            const valor = promocionAplicada.valor;
            const cantidadMinima =
              parseInt(promocionAplicada.cantidadMinima) || 2;

            // Obtener las categorías aplicables
            const categoriasPromo = Array.isArray(
              promocionAplicada.categoriaAplicada
            )
              ? promocionAplicada.categoriaAplicada
              : [promocionAplicada.categoriaAplicada];

            console.log("   Tipo:", tipo);
            console.log("   Valor:", valor);
            console.log("   Cantidad mínima:", cantidadMinima);
            console.log("   Categorías aplicables:", categoriasPromo);

            // ============================================
            // RECOLECTAR TODOS LOS PRECIOS ELEGIBLES
            // ============================================
            const preciosPromo = [];

            document
              .querySelectorAll("#productosLista tbody tr")
              .forEach((fila) => {
                const categoria = fila.dataset.categoria;
                const precioInput = fila.querySelector(".producto-precio");
                const precioTexto =
                  precioInput?.value.replace(/\./g, "").replace(/\D/g, "") ||
                  "0";
                const precio = parseInt(precioTexto);

                if (categoriasPromo.includes(categoria) && precio > 0) {
                  preciosPromo.push({ categoria, precio });
                }
              });

            console.log(
              `   📦 ${preciosPromo.length} prendas elegibles encontradas`
            );

            // ============================================
            // VALIDAR Y CALCULAR SEGÚN TIPO DE PROMOCIÓN
            // ============================================
            if (preciosPromo.length >= cantidadMinima) {
              // Ordenar de menor a mayor precio
              preciosPromo.sort((a, b) => a.precio - b.precio);

              // Calcular cuántas veces aplica la promoción
              const vecesAplica = Math.floor(
                preciosPromo.length / cantidadMinima
              );
              console.log(`   🔁 La promoción aplica ${vecesAplica} vez/veces`);

              // ============================================
              // TIPO 1: PRECIO FIJO
              // ============================================
              if (tipo === "Precio Fijo") {
                // Ej: 2 prendas x $9.900 total
                for (let i = 0; i < vecesAplica; i++) {
                  const inicio = i * cantidadMinima;
                  const fin = inicio + cantidadMinima;
                  const grupoPrecios = preciosPromo.slice(inicio, fin);
                  const subtotalGrupo = grupoPrecios.reduce(
                    (sum, p) => sum + p.precio,
                    0
                  );
                  const descuentoGrupo = Math.max(0, subtotalGrupo - valor);
                  descuentoPromocion += descuentoGrupo;
                  console.log(
                    `   📉 Grupo ${
                      i + 1
                    }: Subtotal $${subtotalGrupo} → Pagas $${valor} = Descuento $${descuentoGrupo}`
                  );
                }
              }

              // ============================================
              // TIPO 2: DESCUENTO PORCENTUAL
              // ============================================
              else if (tipo === "Descuento Porcentual") {
                // Ej: 50% en la segunda prenda (la más barata de cada grupo)
                for (let i = 0; i < vecesAplica; i++) {
                  const inicio = i * cantidadMinima;
                  const fin = inicio + cantidadMinima;
                  const grupoPrecios = preciosPromo.slice(inicio, fin);

                  // Aplicar descuento a la prenda más barata del grupo
                  const prendaMasBarata = grupoPrecios[0];
                  const descuentoGrupo = Math.round(
                    (prendaMasBarata.precio * valor) / 100
                  );
                  descuentoPromocion += descuentoGrupo;
                  console.log(
                    `   📉 Grupo ${i + 1}: ${valor}% de $${
                      prendaMasBarata.precio
                    } = Descuento $${descuentoGrupo}`
                  );
                }
              }

              // ============================================
              // TIPO 3: N x M (Ej: 2x1, 3x2)
              // ============================================
              else if (tipo === "N x M") {
                // Ej: Lleva 2, paga 1 (cantidadMinima=2, valor=1)
                const cantidadPagar = parseInt(valor);
                const cantidadGratis = cantidadMinima - cantidadPagar;

                console.log(
                  `   🎁 Promoción ${cantidadMinima} x ${cantidadPagar}: Regala ${cantidadGratis} prenda(s) por grupo`
                );

                for (let i = 0; i < vecesAplica; i++) {
                  const inicio = i * cantidadMinima;
                  const fin = inicio + cantidadMinima;
                  const grupoPrecios = preciosPromo.slice(inicio, fin);

                  // Regalar las N prendas más baratas del grupo
                  let descuentoGrupo = 0;
                  for (
                    let j = 0;
                    j < cantidadGratis && j < grupoPrecios.length;
                    j++
                  ) {
                    descuentoGrupo += grupoPrecios[j].precio;
                  }
                  descuentoPromocion += descuentoGrupo;
                  console.log(
                    `   📉 Grupo ${
                      i + 1
                    }: ${cantidadGratis} prenda(s) gratis = Descuento $${descuentoGrupo}`
                  );
                }
              }

              console.log(
                "✅ Descuento total de promoción: $" +
                  descuentoPromocion.toLocaleString("es-CL")
              );
            } else {
              console.log(
                `   ⚠️ No hay suficientes prendas elegibles (mínimo: ${cantidadMinima})`
              );
            }
          }
          // ========== FIN CALCULAR PROMOCIÓN ==========
        } else if (tipo === "N x M") {
          // Ej: Lleva 2, paga 1 (cantidadMinima=2, valor=1)
          const cantidadPagar = parseInt(valor);
          const cantidadGratis = cantidadMinima - cantidadPagar;

          console.log(
            `   🎁 Promoción ${cantidadMinima} x ${cantidadPagar}: Regala ${cantidadGratis} prenda(s) por grupo`
          );

          for (let i = 0; i < vecesAplica; i++) {
            const inicio = i * cantidadMinima;
            const fin = inicio + cantidadMinima;
            const grupoPrecios = preciosPromo.slice(inicio, fin);

            console.log(
              `   📦 Grupo ${i + 1}: ${grupoPrecios
                .map((p) => `${p.categoria} $${p.precio}`)
                .join(", ")}`
            );

            // Regalar las N prendas más baratas del grupo
            let descuentoGrupo = 0;
            for (
              let j = 0;
              j < cantidadGratis && j < grupoPrecios.length;
              j++
            ) {
              descuentoGrupo += grupoPrecios[j].precio;
              console.log(
                `   🎁 GRATIS: ${grupoPrecios[j].categoria} $${grupoPrecios[j].precio}`
              );
            }
            descuentoPromocion += descuentoGrupo;
            console.log(`   📉 Descuento del grupo: $${descuentoGrupo}`);
          }
        }

        console.log("✅ Descuento total de promoción:", descuentoPromocion);
      }
    }
    // ========== FIN CALCULAR PROMOCIÓN ==========
    // ========== FIN CALCULAR PROMOCIÓN ==========

    const giftCardInput = document.getElementById("giftCard");
    const giftCardTexto = giftCardInput
      ? giftCardInput.value.replace(/\./g, "").replace(/\D/g, "")
      : "0";
    const giftCardMonto = giftCardTexto ? parseInt(giftCardTexto) : 0;

    const total =
      subtotal - descuentoMonto - descuentoPromocion - giftCardMonto;

    const subtotalEl = document.getElementById("subtotal");
    const descuentoEl = document.getElementById("descuentoMonto");
    const promoEl = document.getElementById("promocionMonto");
    const giftCardEl = document.getElementById("giftCardMonto");
    const totalEl = document.getElementById("total");

    if (subtotalEl)
      subtotalEl.textContent = "$" + subtotal.toLocaleString("es-CL");
    if (descuentoEl)
      descuentoEl.textContent = "-$" + descuentoMonto.toLocaleString("es-CL");

    // ========== MOSTRAR DESCUENTO DE PROMOCIÓN ==========
    if (promoEl) {
      if (descuentoPromocion > 0 && promocionAplicada) {
        promoEl.parentElement.style.display = "flex";
        promoEl.textContent = "-$" + descuentoPromocion.toLocaleString("es-CL");
        console.log(
          "💚 Mostrando descuento promoción en UI:",
          descuentoPromocion
        );
      } else {
        promoEl.parentElement.style.display = "none";
      }
    }
    // ========== FIN MOSTRAR PROMOCIÓN ==========

    if (giftCardEl)
      giftCardEl.textContent = "-$" + giftCardMonto.toLocaleString("es-CL");
    if (totalEl) totalEl.textContent = "$" + total.toLocaleString("es-CL");

    console.log(
      "📊 Totales - Subtotal:",
      subtotal,
      "Descuento promo:",
      descuentoPromocion,
      "Total:",
      total
    );
  };

  // ============================================
  // REGISTRO DE VENTA
  // ============================================

  window.registrarVenta = async function () {
    if (!clienteSeleccionado) {
      mostrarAlerta("error", "❌ Debe buscar y seleccionar un cliente primero");
      return;
    }

    // Usar anfitrión del turno si está establecido
    let anfitrionId = null;
    if (anfitrionTurnoActual) {
      anfitrionId = anfitrionTurnoActual.id;
    }

    if (!anfitrionId) {
      mostrarAlerta("error", "❌ Debe seleccionar un anfitrión del turno");
      const selectTurno = document.getElementById("anfitrionTurnoSelect");
      if (selectTurno) selectTurno.focus();
      return;
    }

    // Validar autorización de devolución
    if (tipoTransaccionActual === "devolucion") {
      const autorizacionInput = document.getElementById(
        "autorizacionDevolucion"
      );
      const autorizacion = autorizacionInput
        ? autorizacionInput.value.trim()
        : "";

      if (!autorizacion) {
        mostrarAlerta("error", "❌ Debe indicar quién autorizó la devolución");
        if (autorizacionInput) autorizacionInput.focus();
        return;
      }

      // Validar que haya al menos un producto de devolución con precio
      const filasDevolucion = document.querySelectorAll(
        "#devolucionesLista tbody tr"
      );
      let tieneProductosValidos = false;

      filasDevolucion.forEach((fila) => {
        const nombre = fila.querySelector(".devolucion-nombre")?.value.trim();
        const precioInput = fila.querySelector(".devolucion-precio");
        const precioTexto =
          precioInput?.value.replace(/\./g, "").replace(/\D/g, "") || "0";
        const precio = parseInt(precioTexto);

        if (nombre && precio > 0) {
          tieneProductosValidos = true;
        }
      });

      if (!tieneProductosValidos) {
        mostrarAlerta(
          "error",
          "❌ Debe agregar al menos un producto con precio para la devolución"
        );
        mostrarLoading(false);
        return;
      }
    }

    mostrarLoading(true);

    try {
      const productos = [];
      const productosIds = [];
      const filas = document.querySelectorAll("#productosLista tbody tr");

      filas.forEach((fila) => {
        const nombre = fila.querySelector(".producto-nombre")?.value.trim();
        const categoria = fila.dataset.categoria || nombre;
        const productoId = fila.dataset.productoId;
        const precioInput = fila.querySelector(".producto-precio");
        const precioTexto =
          precioInput?.value.replace(/\./g, "").replace(/\D/g, "") || "0";
        const precio = parseInt(precioTexto);

        if (nombre && precio > 0) {
          productos.push({
            nombre,
            categoria: categoria,
            precio,
          });

          if (productoId) {
            productosIds.push(productoId);
          }
        }
      });

      const productosIdsUnicos = [...new Set(productosIds)];

      // ✅ Validar según tipo de transacción
      if (tipoTransaccionActual === "venta" && productos.length === 0) {
        mostrarAlerta(
          "error",
          "❌ Debe agregar al menos un producto con precio para una venta"
        );
        mostrarLoading(false);
        return;
      }

      if (tipoTransaccionActual === "devolucion") {
        // Para devoluciones, recolectar productos de la tabla de devoluciones
        productos.length = 0; // Limpiar array
        productosIds.length = 0;

        const filasDevolucion = document.querySelectorAll(
          "#devolucionesLista tbody tr"
        );

        filasDevolucion.forEach((fila) => {
          const nombre = fila.querySelector(".devolucion-nombre")?.value.trim();
          const categoria = fila.dataset.categoria || nombre;
          const productoId = fila.dataset.productoId;
          const precioInput = fila.querySelector(".devolucion-precio");
          const precioTexto =
            precioInput?.value.replace(/\./g, "").replace(/\D/g, "") || "0";
          const precio = parseInt(precioTexto);

          if (nombre && precio > 0) {
            productos.push({
              nombre,
              categoria: categoria,
              precio,
            });

            if (productoId) {
              productosIds.push(productoId);
            }
          }
        });

        if (productos.length === 0) {
          mostrarAlerta(
            "error",
            "❌ Debe agregar al menos un producto con precio para la devolución"
          );
          mostrarLoading(false);
          return;
        }
      }

      const { resumen, camposIndividuales } =
        generarResumenYConteoIndividual(productos);

      const descuentoInput = document.getElementById("descuento");
      const descuentoPorcentaje = descuentoInput
        ? parseFloat(descuentoInput.value) || 0
        : 0;

      // Obtener valor de Gift Card
      const giftCardInput = document.getElementById("giftCard");
      const giftCardTexto = giftCardInput
        ? giftCardInput.value.replace(/\./g, "").replace(/\D/g, "")
        : "0";
      const giftCardMonto = giftCardTexto ? parseInt(giftCardTexto) : 0;

      const subtotal = productos.reduce((sum, p) => sum + p.precio, 0);
      const descuentoMonto = Math.round((subtotal * descuentoPorcentaje) / 100);
      const totalFinal = subtotal - descuentoMonto - giftCardMonto;

      const notasInput = document.getElementById("notas");
      const notas = notasInput ? notasInput.value.trim() : "";

      // Construir objeto base con campos obligatorios
      const ventaData = {
        fields: {
          Cliente: [clienteSeleccionado.id],
          Anfitrión: [anfitrionId],
          "Total de venta": subtotal,
          Descuento: descuentoPorcentaje,
          "Descuento gift cards": giftCardMonto,
          ...(promocionAplicada
            ? { "Promoción Aplicada": [promocionAplicada.id] }
            : {}),
        },
      };

      // ✅ PARA VENTAS
      if (tipoTransaccionActual === "venta") {
        // Agregar Items y campos de cantidad
        ventaData.fields["Items"] = resumen;
        Object.assign(ventaData.fields, camposIndividuales);

        // Vincular productos si existen
        if (productosIdsUnicos.length > 0) {
          ventaData.fields["producto"] = productosIdsUnicos;
          console.log("✅ Vinculando productos de venta:", productosIdsUnicos);
        }

        // Agregar notas si existen
        if (notas) {
          ventaData.fields["Box Observaciones"] = notas;
        }
      }

      // ✅ PARA DEVOLUCIONES
      if (tipoTransaccionActual === "devolucion" && productos.length > 0) {
        const conteoDevolucion = {};
        const devolucionesIdsUnicos = [...new Set(productosIds)];

        // Contar productos devueltos
        productos.forEach((prod) => {
          const categoria = prod.categoria;
          conteoDevolucion[categoria] = (conteoDevolucion[categoria] || 0) + 1;
        });

        // Crear resumen de texto con precios
        const devolucionesResumen = productos
          .map((item) => {
            const nombre = item.nombre || "Sin nombre";
            const precio = item.precio || 0;
            const precioFormateado = precio.toLocaleString("es-CL");
            return `${nombre} (${precioFormateado})`;
          })
          .join(", ");

        ventaData.fields["Items"] = devolucionesResumen;

        // Agregar campos de cantidad para devolución
        const camposDevolucion = {};
        Object.entries(conteoDevolucion).forEach(([categoria, cantidad]) => {
          const nombreCampo = MAPEO_PRODUCTOS[categoria];
          if (nombreCampo) {
            camposDevolucion[nombreCampo] = cantidad;
          }
        });
        Object.assign(ventaData.fields, camposDevolucion);

        // ✅ Vincular productos en campo "Devolución"
        if (devolucionesIdsUnicos.length > 0) {
          ventaData.fields["Devolución"] = devolucionesIdsUnicos;
          console.log(
            "✅ Vinculando productos de devolución:",
            devolucionesIdsUnicos
          );
        }

        // ✅ Agregar Total Devolución (usa el totalFinal calculado)
        ventaData.fields["Total Devolución "] = totalFinal;
        console.log("✅ Total Devolución:", totalFinal);

        // Agregar autorización
        const autorizacionInput = document.getElementById(
          "autorizacionDevolucion"
        );
        const autorizacion = autorizacionInput
          ? autorizacionInput.value.trim()
          : "";
        if (autorizacion) {
          ventaData.fields[
            "Box Observaciones"
          ] = `Autorizado por: ${autorizacion}${notas ? "\n" + notas : ""}`;
        }
      }

      console.log("📤 Enviando venta:", JSON.stringify(ventaData, null, 2));

      const response = await fetch(
        `https://api.airtable.com/v0/${BASE_ID}/${VENTAS_TABLE_ID}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${AIRTABLE_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(ventaData),
        }
      );

      const result = await response.json();
      mostrarLoading(false);

      if (response.ok) {
        const tipoMensaje =
          tipoTransaccionActual === "venta" ? "Venta" : "Devolución";
        mostrarAlerta("success", `✅ ¡${tipoMensaje} registrada exitosamente!`);
        setTimeout(() => limpiarFormulario(), 2000);
      } else {
        console.error("❌ Error en respuesta:", result);
        console.error(
          "❌ Detalles del error:",
          JSON.stringify(result, null, 2)
        );

        let mensajeError = "Error al registrar la transacción";
        if (result.error && result.error.message) {
          mensajeError = result.error.message;
        }

        mostrarAlerta("error", `❌ ${mensajeError}`);
      }
    } catch (error) {
      mostrarLoading(false);
      console.error("❌ Error al registrar venta:", error);
      mostrarAlerta(
        "error",
        "❌ Error al registrar la venta: " + error.message
      );
    }
  };

  // ============================================
  // GENERACIÓN DE RESUMEN Y CONTEO
  // ============================================

  function generarResumenYConteoIndividual(productosItems) {
    const conteo = {};

    // Contar cuántos productos de cada categoría
    productosItems.forEach((item) => {
      const categoria = item.categoria || item.nombre;
      if (categoria) {
        conteo[categoria] = (conteo[categoria] || 0) + 1;
      }
    });

    // Crear resumen detallado con precios
    const resumenItems = productosItems
      .map((item) => {
        const nombre = item.nombre || "Sin nombre";
        const precio = item.precio || 0;
        const precioFormateado = precio.toLocaleString("es-CL");
        return `${nombre} (${precioFormateado})`;
      })
      .join(", ");

    // Crear objeto con campos individuales para Airtable
    const camposIndividuales = {};
    Object.entries(conteo).forEach(([categoria, cantidad]) => {
      const nombreCampo = MAPEO_PRODUCTOS[categoria];
      if (nombreCampo) {
        camposIndividuales[nombreCampo] = cantidad;
        console.log(`✅ ${categoria} → ${nombreCampo}: ${cantidad}`);
      } else {
        console.warn(
          `⚠️ "${categoria}" no tiene campo mapeado en MAPEO_PRODUCTOS.`
        );
      }
    });

    console.log("📊 Resumen Items:", resumenItems);
    console.log("🔢 Campos individuales:", camposIndividuales);

    return {
      resumen: resumenItems,
      camposIndividuales: camposIndividuales,
    };
  }

  // ============================================
  // LIMPIAR FORMULARIO
  // ============================================

  window.limpiarFormulario = function () {
    document.getElementById("rutCliente").value = "";
    document.getElementById("clienteInfo").classList.remove("show");
    document.getElementById("clienteNoEncontrado").classList.remove("show");
    clienteSeleccionado = null;

    const workArea = document.getElementById("workArea");
    if (workArea) workArea.classList.remove("show");

    const emptyState = document.getElementById("emptyState");
    if (emptyState) emptyState.style.display = "block";

    // NO limpiar el anfitrión del turno - se mantiene para la siguiente venta

    const tbody = document.querySelector("#productosLista tbody");
    if (tbody) {
      tbody.innerHTML = `
      <tr>
        <td><input type="text" class="producto-nombre" placeholder="Nombre del producto"></td>
        <td><input type="text" class="producto-precio" placeholder="0" oninput="formatearPrecio(this); calcularTotal();"></td>
        <td><button class="btn btn-remove" onclick="eliminarProducto(this)">🗑️</button></td>
      </tr>
    `;
    }

    // Limpiar tabla de devoluciones
    const tbodyDevolucion = document.querySelector("#devolucionesLista tbody");
    if (tbodyDevolucion) {
      tbodyDevolucion.innerHTML = `
      <tr>
        <td><input type="text" class="devolucion-nombre" placeholder="Nombre del producto"></td>
        <td><input type="text" class="devolucion-precio" placeholder="0" oninput="formatearPrecio(this); calcularTotal();"></td>
        <td><button class="btn btn-remove" onclick="eliminarProductoDevolucion(this)">🗑️</button></td>
      </tr>
    `;
    }

    const descuentoInput = document.getElementById("descuento");
    if (descuentoInput) descuentoInput.value = "0";
    const giftCardInput = document.getElementById("giftCard");
    if (giftCardInput) giftCardInput.value = "0";

    const notasInput = document.getElementById("notas");
    if (notasInput) notasInput.value = "";

    const autorizacionInput = document.getElementById("autorizacionDevolucion");
    if (autorizacionInput) autorizacionInput.value = "";

    const radioVenta = document.querySelector(
      'input[name="tipoTransaccion"][value="venta"]'
    );
    if (radioVenta) radioVenta.checked = true;

    tipoTransaccionActual = "venta";
    cambiarTipoTransaccion("venta");
    calcularTotal();
    ocultarAlertas();

    setTimeout(() => {
      const rutInput = document.getElementById("rutCliente");
      if (rutInput) rutInput.focus();
    }, 100);
  };
};
