// ============================================
// VARIABLES GLOBALES Y CONFIGURACIÓN
// ============================================

let AIRTABLE_TOKEN, BASE_ID, CLIENTES_TABLE_ID, VENTAS_TABLE_ID, ANFITRIONES_TABLE_ID, INVENTARIO_TABLE_ID;
let clienteSeleccionado = null;
let anfitrionSeleccionado = null;
let tipoTransaccionActual = 'venta';
let devolucionesAgregadas = [];
let productosInventario = [];

const INVENTARIO_PRINCIPAL_ID = "tblxyk6vtahtFlLVo";

// ============================================
// MAPEO DE PRODUCTOS A CAMPOS DE AIRTABLE
// ============================================
const MAPEO_PRODUCTOS = {
  "Parka": "Parka_Cantidad",
  "Chaqueta": "Chaqueta_Cantidad",
  "Camisa": "Camisa_Cantidad",
  "Polera": "Polera_Cantidad",
  "Pantalon": "Pantalon_Cantidad",
  "Vestido": "Vestido_Cantidad",
  "Falda": "Falda_Cantidad",
  "Short": "Short_Cantidad",
  "Sweater": "Sweater_Cantidad",
  "Abrigo": "Abrigo_Cantidad",
  "Poleron": "Poleron_Cantidad",
  "Calza": "Calza_Cantidad",
  "Jeans": "Jeans_Cantidad",
  "Blusa": "Blusa_Cantidad",
  "Camiseta": "Camiseta_Cantidad",
  "Chaleco": "Chaleco_Cantidad",
  "Enterito": "Enterito_Cantidad",
  "Jardinera": "Jardinera_Cantidad",
  "Buzo": "Buzo_Cantidad",
  "Traje": "Traje_Cantidad",
  "Blazer": "Blazer_Cantidad",
  "Body": "Body_Cantidad",
  "Sudadera": "Sudadera_Cantidad",
  "CortaViento": "CortaViento_Cantidad",
  "Cartera": "Cartera_Cantidad",
  "Pañuelo": "Pañuelo_Cantidad",
  "Medias": "Medias_Cantidad",
  "PoleraDeportiva": "PoleraDeportiva_Cantidad",
  "BuzoDeportivo": "BuzoDeportivo_Cantidad",
  "PantalonDeVestir": "PantalonDeVestir_Cantidad",
  "RopaDeNiño": "RopaDeNiño_Cantidad",
  "Polar": "Polar_Cantidad",
};

// ============================================
// INICIALIZACIÓN
// ============================================

async function fetchConfig() {
  try {
    const res = await fetch("https://registro-de-ventas-eight.vercel.app/api/proxy");
    const data = await res.json();

    AIRTABLE_TOKEN = data.airtableToken;
    BASE_ID = data.baseId_;
    CLIENTES_TABLE_ID = data.clientesTable_;
    VENTAS_TABLE_ID = data.ventasTable_;
    ANFITRIONES_TABLE_ID = data.anfitrionesTable_;
    INVENTARIO_TABLE_ID = data.inventarioTable_;

    console.log("✅ Configuración cargada correctamente");
    await cargarInventarioCompleto();
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
      productosInventario = data.records.map(record => {
        let codigo = record.fields["Código por categoría"] || 
                     record.fields["Codigo por categoria"] || 
                     record.fields["codigo por categoria"] || '';
        codigo = codigo.toString().replace(/\s+/g, '').trim();
        const categoria = record.fields["Categoría"] || record.fields.Categoria || 'Sin categoría';
        const inventario = record.fields["Inventario"] || 0;
        
        return {
          id: record.id,
          codigo: codigo,
          categoria: categoria,
          precio: 0,
          stock: inventario,
          recordCompleto: record
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
// UTILIDADES - VALIDACIÓN Y FORMATO DE RUT
// ============================================

function cleanRut(rut) {
  return rut.replace(/[^0-9kK]/g, '').toUpperCase();
}

function formatRut(value) {
  value = value.replace(/[^0-9kK]/g, '').toUpperCase();
  if (value.length > 9) value = value.substring(0, 9);
  if (value.length <= 1) return value;
  
  const dv = value.slice(-1);
  let rut = value.slice(0, -1);
  let formatted = '';
  let counter = 0;
  
  for (let i = rut.length - 1; i >= 0; i--) {
    formatted = rut[i] + formatted;
    counter++;
    if (counter === 3 && i !== 0) {
      formatted = '.' + formatted;
      counter = 0;
    }
  }
  return formatted + '-' + dv;
}

window.formatearRUT = function(input) {
  const cursorPosition = input.selectionStart;
  const oldValue = input.value;
  const oldLength = oldValue.length;
  input.value = formatRut(input.value);
  const newLength = input.value.length;
  const diff = newLength - oldLength;
  input.setSelectionRange(cursorPosition + diff, cursorPosition + diff);
}

window.validarRUT = function(rut) {
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
  
  if (dvEsperado === 11) dvCalculado = '0';
  else if (dvEsperado === 10) dvCalculado = 'K';
  else dvCalculado = dvEsperado.toString();
  
  return dv === dvCalculado;
}

// ============================================
// UTILIDADES - FORMATO DE PRECIOS
// ============================================

window.formatearPrecio = function(input) {
  let valor = input.value.replace(/\D/g, '');
  if (valor) {
    valor = parseInt(valor).toLocaleString('es-CL');
  }
  input.value = valor;
}

// ============================================
// UTILIDADES - ALERTAS Y LOADING
// ============================================

function mostrarAlerta(tipo, mensaje) {
  ocultarAlertas();
  const alertId = tipo === "success" ? "alertSuccess" : tipo === "error" ? "alertError" : "alertInfo";
  const alert = document.getElementById(alertId);
  if (alert) {
    alert.textContent = mensaje;
    alert.classList.add("show");
    setTimeout(() => alert.classList.remove("show"), 5000);
  }
}

function ocultarAlertas() {
  ["alertSuccess", "alertError", "alertInfo"].forEach(id => {
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

window.buscarClienteEnter = function(event) {
  if (event.key === "Enter") {
    event.preventDefault();
    buscarCliente();
  }
}

window.buscarCliente = async function() {
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
    mostrarAlerta("error", "❌ Error: Configuración no cargada. Recarga la página.");
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
      
      const anfitrionContainer = document.getElementById("anfitrionContainer");
      if (anfitrionContainer) anfitrionContainer.style.display = "block";
      
      cargarAnfitriones();
      
      setTimeout(() => {
        const codigoInput = document.getElementById("codigoProducto");
        if (codigoInput) codigoInput.focus();
        mostrarAlerta("info", "📱 Escanea el código de barras");
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
}

function mostrarInfoCliente(cliente) {
  const fields = cliente.fields;
  document.getElementById("clienteNombre").textContent = fields.Nombre || "N/A";
  document.getElementById("clienteTelefono").textContent = fields["Teléfono"] || "N/A";
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
    const select = document.getElementById("anfitrionSelect");

    if (!select) return;

    while (select.options.length > 1) {
      select.remove(1);
    }

    if (data.records) {
      data.records.forEach(record => {
        const option = document.createElement("option");
        option.value = record.id;
        option.textContent = record.fields.Nombre || record.fields.name || "Sin nombre";
        select.appendChild(option);
      });
    }
  } catch (error) {
    console.error("Error al cargar anfitriones:", error);
  }
}

// ============================================
// GESTIÓN DE TIPO DE TRANSACCIÓN
// ============================================

window.cambiarTipoTransaccion = function(tipo) {
  tipoTransaccionActual = tipo;
  const ventasSection = document.getElementById("ventasSection");
  const devolucionesSection = document.getElementById("devolucionesSection");
  const anfitrionContainer = document.getElementById("anfitrionContainer");

  if (tipo === 'venta') {
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
    
    const devList = document.getElementById("devolucionesList");
    if (devList) devList.innerHTML = "";
    devolucionesAgregadas = [];
    
    setTimeout(() => {
      const input = document.getElementById("codigoDevolucion");
      if (input) input.focus();
    }, 100);
  }
  calcularTotal();
}

// ============================================
// GESTIÓN DE PRODUCTOS - VENTAS
// ============================================

window.procesarCodigoProducto = function(event) {
  if (event.key === "Enter") {
    event.preventDefault();
    const codigo = document.getElementById("codigoProducto").value.trim();
    if (codigo) {
      buscarYAgregarProductoPorCodigo(codigo);
      document.getElementById("codigoProducto").value = "";
      document.getElementById("codigoProducto").focus();
    }
  }
}

async function buscarYAgregarProductoPorCodigo(codigoEscaneado) {
  const codigoLimpio = codigoEscaneado.replace(/\s+/g, '').trim();
  
  try {
    const formulaExacta = encodeURIComponent(`{Código por categoría}='${codigoLimpio}'`);
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
        categoria: record.fields["Categoría"] || record.fields.Categoria || 'Sin categoría',
        stock: record.fields["Inventario"] || 0,
        recordCompleto: record
      };
      agregarProductoDesdeInventario(producto);
      mostrarAlerta("success", `✅ ${producto.categoria} agregado - Stock: ${producto.stock}`);
    } else {
      const productoLocal = productosInventario.find(p => 
        p.codigo.replace(/\s+/g, '').toLowerCase() === codigoLimpio.toLowerCase()
      );
      
      if (productoLocal) {
        agregarProductoDesdeInventario(productoLocal);
        mostrarAlerta("success", `✅ ${productoLocal.categoria} agregado`);
      } else {
        mostrarAlerta("error", `❌ Código "${codigoLimpio}" no encontrado`);
        setTimeout(() => {
          const agregar = confirm(`Código "${codigoLimpio}" no encontrado.\n¿Deseas agregarlo manualmente?`);
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

  const filasVacias = tbody.querySelectorAll('tr');
  filasVacias.forEach(fila => {
    const nombre = fila.querySelector('.producto-nombre')?.value;
    const precio = fila.querySelector('.producto-precio')?.value;
    if (!nombre && !precio) fila.remove();
  });

  const codigoTexto = String(producto.codigo || 'N/A');
  const stockTexto = String(producto.stock || 0);

  const filaHTML = `
    <tr data-producto-id="${producto.id}" data-categoria="${producto.categoria}">
      <td>
        <input type="text" class="producto-nombre" value="${producto.categoria}" readonly 
               style="background-color: #e8f5e9; font-weight: 600; border: 2px solid #10b981; color: #065f46;">
        <div style="font-size: 0.85em; color: #6b7280; margin-top: 4px;">
          📦 Código: ${codigoTexto} | 📊 Stock: ${stockTexto}
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

  const ultimoPrecio = tbody.querySelector('tr:last-child .producto-precio');
  if (ultimoPrecio) {
    setTimeout(() => {
      ultimoPrecio.focus();
      ultimoPrecio.addEventListener('blur', () => {
        setTimeout(() => {
          const codigoInput = document.getElementById("codigoProducto");
          if (codigoInput) codigoInput.focus();
        }, 100);
      });
    }, 100);
  }
  calcularTotal();
}

window.agregarProductoConCodigo = function(codigo) {
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
}

window.agregarProducto = function() {
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
}

window.agregarProductoManual = function() {
  const select = document.getElementById("selectProductoManual");
  if (select && select.value) {
    agregarProductoConCodigo(select.value);
    select.value = "";
  }
}

window.eliminarProducto = function(btn) {
  const tbody = document.querySelector("#productosLista tbody");
  if (!tbody) return;
  
  const filas = tbody.querySelectorAll("tr");
  if (filas.length > 1) {
    btn.closest("tr").remove();
    calcularTotal();
  } else {
    mostrarAlerta("info", "⚠️ Debe haber al menos un producto");
  }
}

// ============================================
// GESTIÓN DE DEVOLUCIONES
// ============================================

window.procesarCodigoDevolucion = function(event) {
  if (event.key === "Enter") {
    event.preventDefault();
    const input = document.getElementById("codigoDevolucion");
    if (!input) return;
    
    const codigo = input.value.trim();
    if (codigo) {
      buscarYMostrarProductoDevolucion(codigo);
      input.value = "";
    }
  }
}

async function buscarYMostrarProductoDevolucion(codigoEscaneado) {
  const codigoLimpio = codigoEscaneado.replace(/\s+/g, '').trim();
  
  try {
    const formulaExacta = encodeURIComponent(`{Código por categoría}='${codigoLimpio}'`);
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
        categoria: record.fields["Categoría"] || record.fields.Categoria || 'Sin categoría',
        stock: record.fields["Inventario"] || 0,
      };
      agregarProductoDevolucion(producto);
    } else {
      const productoLocal = productosInventario.find(p => 
        p.codigo.replace(/\s+/g, '').toLowerCase() === codigoLimpio.toLowerCase()
      );
      if (productoLocal) agregarProductoDevolucion(productoLocal);
      else mostrarAlerta("error", `❌ Código "${codigoLimpio}" no encontrado`);
    }
  } catch (error) {
    console.error("❌ Error al buscar producto:", error);
    mostrarAlerta("error", "❌ Error al buscar producto: " + error.message);
  }
}

function agregarProductoDevolucion(producto) {
  const devolucion = {
    id: producto.id,
    nombre: producto.categoria,
    codigo: producto.codigo,
    stock: producto.stock || 0
  };

  devolucionesAgregadas.push(devolucion);
  console.log("✅ Producto agregado a lista:", devolucion);

  const container = document.getElementById("devolucionesList");
  if (!container) return;
  
  const timestamp = Date.now();
  const itemHTML = `
    <div class="devolucion-item" data-devolucion-timestamp="${timestamp}" 
         style="background: #e8f5e9; padding: 15px; margin: 10px 0; border-radius: 8px; 
                border-left: 4px solid #10b981; display: flex; justify-content: space-between; align-items: center;">
      <div>
        <strong style="font-size: 16px; color: #065f46;">📦 ${producto.categoria}</strong>
        <div style="color: #6b7280; margin-top: 4px; font-size: 14px;">Código: ${producto.codigo}</div>
      </div>
      <button class="btn btn-remove" onclick="eliminarDevolucion('${timestamp}')">🗑️</button>
    </div>
  `;
  container.insertAdjacentHTML("beforeend", itemHTML);
  
  const input = document.getElementById("codigoDevolucion");
  if (input) setTimeout(() => input.focus(), 100);
}

window.eliminarDevolucion = function(timestamp) {
  const items = document.querySelectorAll(".devolucion-item");
  let indexToRemove = -1;
  
  items.forEach((item, index) => {
    if (item.dataset.devolucionTimestamp === timestamp) {
      indexToRemove = index;
      item.remove();
    }
  });
  
  if (indexToRemove !== -1 && indexToRemove < devolucionesAgregadas.length) {
    devolucionesAgregadas.splice(indexToRemove, 1);
  }
}

// ============================================
// CÁLCULOS Y TOTALES
// ============================================

window.calcularTotal = function() {
  let subtotal = 0;
  const precios = document.querySelectorAll(".producto-precio");
  precios.forEach((input) => {
    const valorLimpio = input.value.replace(/\./g, '').replace(/\D/g, '');
    const precio = valorLimpio ? parseInt(valorLimpio) : 0;
    subtotal += precio;
  });

  const descuentoInput = document.getElementById("descuento");
  const descuentoPorcentaje = descuentoInput ? parseFloat(descuentoInput.value) || 0 : 0;
  const descuentoMonto = Math.round((subtotal * descuentoPorcentaje) / 100);
  const total = subtotal - descuentoMonto;

  const subtotalEl = document.getElementById("subtotal");
  const descuentoEl = document.getElementById("descuentoMonto");
  const totalEl = document.getElementById("total");

  if (subtotalEl) subtotalEl.textContent = "$" + subtotal.toLocaleString("es-CL");
  if (descuentoEl) descuentoEl.textContent = "-$" + descuentoMonto.toLocaleString("es-CL");
  if (totalEl) totalEl.textContent = "$" + total.toLocaleString("es-CL");
}

// ============================================
// REGISTRO DE VENTA
// ============================================

window.registrarVenta = async function() {
  if (!clienteSeleccionado) {
    mostrarAlerta("error", "❌ Debe buscar y seleccionar un cliente primero");
    return;
  }

  const anfitrionSelect = document.getElementById("anfitrionSelect");
  const anfitrionId = anfitrionSelect ? anfitrionSelect.value : null;
  
  if (!anfitrionId) {
    mostrarAlerta("error", "❌ Debe seleccionar un anfitrión");
    return;
  }

  mostrarLoading(true);

  try {
    const productos = [];
    const filas = document.querySelectorAll("#productosLista tbody tr");
    
    filas.forEach(fila => {
      const nombre = fila.querySelector(".producto-nombre")?.value.trim();
      const categoria = fila.dataset.categoria || nombre;
      const precioInput = fila.querySelector(".producto-precio");
      const precioTexto = precioInput?.value.replace(/\./g, '').replace(/\D/g, '') || "0";
      const precio = parseInt(precioTexto);
      
      if (nombre && precio > 0) {
        productos.push({ 
          nombre, 
          categoria: categoria,
          precio 
        });
      }
    });

    if (productos.length === 0) {
      mostrarAlerta("error", "❌ Debe agregar al menos un producto con precio");
      mostrarLoading(false);
      return;
    }

    const { resumen, camposIndividuales } = generarResumenYConteoIndividual(productos);
    
    const descuentoInput = document.getElementById("descuento");
    const descuentoPorcentaje = descuentoInput ? parseFloat(descuentoInput.value) || 0 : 0;
    
    const subtotal = productos.reduce((sum, p) => sum + p.precio, 0);
    const descuentoMonto = Math.round((subtotal * descuentoPorcentaje) / 100);
    const totalFinal = subtotal - descuentoMonto;

    const notasInput = document.getElementById("notas");
    const notas = notasInput ? notasInput.value.trim() : "";

    const ventaData = {
      fields: {
        "Cliente": [clienteSeleccionado.id],
        "Anfitrión": [anfitrionId],
        "Productos": resumen,
        "Total": totalFinal,
        "Descuento (%)": descuentoPorcentaje,
        "Fecha": new Date().toISOString().split('T')[0]
      }
    };

    // Solo agregar campos de cantidad si existen
    if (Object.keys(camposIndividuales).length > 0) {
      Object.assign(ventaData.fields, camposIndividuales);
    }

    if (notas) {
      ventaData.fields["Notas"] = notas;
    }

    if (tipoTransaccionActual === 'devolucion') {
      ventaData.fields["Tipo"] = "Devolución";
      if (devolucionesAgregadas.length > 0) {
        const productosDevueltos = devolucionesAgregadas.map(d => d.nombre).join(", ");
        ventaData.fields["Productos Devueltos"] = productosDevueltos;
      }
    }

    console.log("📤 Enviando venta:", ventaData);

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
      mostrarAlerta("success", "✅ ¡Transacción registrada exitosamente!");
      setTimeout(() => limpiarFormulario(), 2000);
    } else {
      console.error("❌ Error en respuesta:", result);
      console.error("❌ Detalles del error:", JSON.stringify(result, null, 2));
      
      let mensajeError = "Error al registrar la venta";
      if (result.error && result.error.message) {
        mensajeError = result.error.message;
      }
      
      mostrarAlerta("error", `❌ ${mensajeError}`);
    }
  } catch (error) {
    mostrarLoading(false);
    console.error("❌ Error al registrar venta:", error);
    mostrarAlerta("error", "❌ Error al registrar la venta: " + error.message);
  }
}

// ============================================
// LIMPIAR FORMULARIO
// ============================================

window.limpiarFormulario = function() {
  document.getElementById("rutCliente").value = "";
  document.getElementById("clienteInfo").classList.remove("show");
  document.getElementById("clienteNoEncontrado").classList.remove("show");
  clienteSeleccionado = null;

  const workArea = document.getElementById("workArea");
  if (workArea) workArea.classList.remove("show");

  const anfitrionSelect = document.getElementById("anfitrionSelect");
  if (anfitrionSelect) anfitrionSelect.value = "";

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

  devolucionesAgregadas = [];
  const devList = document.getElementById("devolucionesList");
  if (devList) devList.innerHTML = "";

  const descuentoInput = document.getElementById("descuento");
  if (descuentoInput) descuentoInput.value = "0";
  
  const notasInput = document.getElementById("notas");
  if (notasInput) notasInput.value = "";

  const radioVenta = document.querySelector('input[name="tipoTransaccion"][value="venta"]');
  if (radioVenta) radioVenta.checked = true;
  tipoTransaccionActual = 'venta';
  cambiarTipoTransaccion('venta');

  calcularTotal();
  ocultarAlertas();

  setTimeout(() => {
    const rutInput = document.getElementById("rutCliente");
    if (rutInput) rutInput.focus();
  }, 100);
}

// ============================================
// GENERACIÓN DE RESUMEN Y CONTEO
// ============================================

function generarResumenYConteoIndividual(productosItems) {
  const conteo = {};
  
  // Contar cuántos productos de cada categoría
  productosItems.forEach(item => {
    const categoria = item.categoria || item.nombre;
    if (categoria) {
      conteo[categoria] = (conteo[categoria] || 0) + 1;
    }
  });

  // Crear resumen detallado con precios
  const resumenItems = productosItems
    .map(item => {
      const nombre = item.nombre || "Sin nombre";
      const precio = item.precio || 0;
      const precioFormateado = precio.toLocaleString('es-CL');
      return `${nombre}(${precioFormateado})`;
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
      console.warn(`⚠️ "${categoria}" no tiene campo mapeado en MAPEO_PRODUCTOS.`);
    }
  });
  
  console.log("📊 Resumen Items:", resumenItems);
  console.log("🔢 Campos individuales:", camposIndividuales);

  return {
    resumen: resumenItems,
    camposIndividuales: camposIndividuales
  };
}

// ============================================
// INICIALIZAR AL CARGAR LA PÁGINA
// ============================================

document.addEventListener("DOMContentLoaded", async () => {
  console.log("🚀 Iniciando aplicación...");
  const configCargada = await fetchConfig();
  
  if (configCargada) {
    console.log("✅ Sistema listo");
    const rutInput = document.getElementById("rutCliente");
    if (rutInput) rutInput.focus();
  } else {
    mostrarAlerta("error", "❌ Error al cargar la configuración. Por favor, recarga la página.");
  }
});