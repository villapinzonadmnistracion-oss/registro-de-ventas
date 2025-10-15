let AIRTABLE_TOKEN, BASE_ID, CLIENTES_TABLE_ID, VENTAS_TABLE_ID, ANFITRIONES_TABLE_ID, INVENTARIO_TABLE_ID;
let clienteSeleccionado = null;
let anfitrionSeleccionado = null;
let tipoTransaccionActual = 'venta';
let devolucionesAgregadas = [];
let productosInventario = []; // Cache de productos

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
    console.log("📦 BASE_ID:", BASE_ID);
    console.log("📦 INVENTARIO_TABLE_ID:", INVENTARIO_TABLE_ID);
    
    // Cargar inventario al inicio
    await cargarInventarioCompleto();
    
    return true;
  } catch (error) {
    console.error("❌ Error al cargar configuración:", error);
    return false;
  }
}

// Cargar todo el inventario al inicio
async function cargarInventarioCompleto() {
  try {
    // Basándome en tu imagen, el ID de la tabla es tblxyk6vtahtFlLVo
    const INVENTARIO_PRINCIPAL_ID = "tblxyk6vtahtFlLVo";
    
    const url = `https://api.airtable.com/v0/${BASE_ID}/${INVENTARIO_PRINCIPAL_ID}`;
    console.log("🔍 Cargando inventario desde:", url);
    
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${AIRTABLE_TOKEN}`,
      },
    });

    const data = await response.json();
    console.log("📦 Datos completos del inventario:", data);
    
    if (data.records) {
      productosInventario = data.records.map(record => {
        // Obtener el código y limpiarlo de espacios y caracteres especiales
        let codigo = record.fields["Código por categoría"] || 
                     record.fields["Codigo por categoria"] || 
                     record.fields["codigo por categoria"] || '';
        
        // Limpiar el código: quitar espacios, saltos de línea, etc.
        codigo = codigo.toString().replace(/\s+/g, '').trim();
        
        const categoria = record.fields["Categoría"] || record.fields.Categoria || 'Sin categoría';
        const inventario = record.fields["Inventario"] || 0;
        
        console.log(`📝 Cargado - Código: "${codigo}" | Categoría: ${categoria} | Stock: ${inventario}`);
        
        return {
          id: record.id,
          codigo: codigo,
          categoria: categoria,
          precio: 0,
          stock: inventario,
          recordCompleto: record
        };
      });
      
      console.log(`✅ ${productosInventario.length} productos cargados en memoria`);
      console.log("📋 Lista de códigos:", productosInventario.map(p => `"${p.codigo}"`).join(", "));
    }
  } catch (error) {
    console.error("❌ Error al cargar inventario:", error);
    mostrarAlerta("error", "⚠️ Error al cargar inventario. Verifica la configuración.");
  }
}

// Función para limpiar RUT (solo números y K)
function cleanRut(rut) {
  return rut.replace(/[^0-9kK]/g, '').toUpperCase();
}

// Función para formatear RUT chileno
function formatRut(value) {
  value = value.replace(/[^0-9kK]/g, '').toUpperCase();
  
  if (value.length > 9) {
    value = value.substring(0, 9);
  }
  
  if (value.length <= 1) {
    return value;
  }
  
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
  
  if (rut.length < 8 || rut.length > 9) {
    return false;
  }
  
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
  
  if (dvEsperado === 11) {
    dvCalculado = '0';
  } else if (dvEsperado === 10) {
    dvCalculado = 'K';
  } else {
    dvCalculado = dvEsperado.toString();
  }
  
  return dv === dvCalculado;
}

window.buscarClienteEnter = function(event) {
  if (event.key === "Enter") {
    event.preventDefault();
    buscarCliente();
  }
}

// Cargar anfitriones
async function cargarAnfitriones() {
  try {
    const url = `https://api.airtable.com/v0/${BASE_ID}/${ANFITRIONES_TABLE_ID}`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${AIRTABLE_TOKEN}`,
      },
    });

    const data = await response.json();
    const select = document.getElementById("anfitrionSelect");
    
    // Limpiar opciones existentes (excepto la primera que dice "Selecciona...")
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

window.cambiarTipoTransaccion = function(tipo) {
  tipoTransaccionActual = tipo;
  const ventasSection = document.getElementById("ventasSection");
  const devolucionesSection = document.getElementById("devolucionesSection");

  if (tipo === 'venta') {
    ventasSection.style.display = "block";
    devolucionesSection.style.display = "none";
    // Enfocar en el campo de código de productos
    setTimeout(() => {
      document.getElementById("codigoProducto").focus();
    }, 100);
  } else {
    ventasSection.style.display = "none";
    devolucionesSection.style.display = "block";
    // Limpiar la lista de devoluciones
    document.getElementById("devolucionesList").innerHTML = "";
    devolucionesAgregadas = [];
    // Enfocar en el campo de código de devolución
    setTimeout(() => {
      document.getElementById("codigoDevolucion").focus();
    }, 100);
  }
  calcularTotal();
}

// FUNCIÓN MEJORADA: Procesar código escaneado de la pistola
window.procesarCodigoProducto = function(event) {
  if (event.key === "Enter") {
    event.preventDefault();
    const codigo = document.getElementById("codigoProducto").value.trim();
    
    console.log("🔍 Buscando código:", codigo);
    console.log("📦 Productos en memoria:", productosInventario.length);
    
    if (codigo) {
      buscarYAgregarProductoPorCodigo(codigo);
      document.getElementById("codigoProducto").value = "";
      document.getElementById("codigoProducto").focus();
    }
  }
}

// NUEVA FUNCIÓN: Procesar código de devolución
window.procesarCodigoDevolucion = function(event) {
  if (event.key === "Enter") {
    event.preventDefault();
    const codigo = document.getElementById("codigoDevolucion").value.trim();
    
    console.log("🔍 Buscando código para devolución:", codigo);
    
    if (codigo) {
      buscarYMostrarProductoDevolucion(codigo);
      document.getElementById("codigoDevolucion").value = "";
    }
  }
}

// FUNCIÓN MEJORADA: Buscar producto en el inventario por código
async function buscarYAgregarProductoPorCodigo(codigoEscaneado) {
  // Limpiar el código escaneado de espacios y caracteres especiales
  const codigoLimpio = codigoEscaneado.replace(/\s+/g, '').trim();
  
  console.log("🔎 Buscando producto con código:", codigoLimpio);
  
  try {
    const INVENTARIO_PRINCIPAL_ID = "tblxyk6vtahtFlLVo";
    
    // Buscar en Airtable directamente con el código escaneado
    const formulaExacta = encodeURIComponent(`{Código por categoría}='${codigoLimpio}'`);
    const url = `https://api.airtable.com/v0/${BASE_ID}/${INVENTARIO_PRINCIPAL_ID}?filterByFormula=${formulaExacta}`;
    
    console.log("🔗 URL de búsqueda:", url);
    
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${AIRTABLE_TOKEN}`,
      },
    });

    const data = await response.json();
    console.log("📦 Respuesta de Airtable:", data);

    if (data.records && data.records.length > 0) {
      // Producto encontrado
      const record = data.records[0];
      const producto = {
        id: record.id,
        codigo: record.fields["Código por categoría"] || codigoLimpio,
        categoria: record.fields["Categoría"] || record.fields.Categoria || 'Sin categoría',
        stock: record.fields["Inventario"] || 0,
        recordCompleto: record
      };
      
      console.log("✅ Producto encontrado:", producto);
      agregarProductoDesdeInventario(producto);
      mostrarAlerta("success", `✅ ${producto.categoria} agregado - Stock: ${producto.stock}`);
    } else {
      // No encontrado, intentar búsqueda sin formato
      console.log("❌ No encontrado, intentando sin filtro especial...");
      
      // Buscar en el cache local
      const productoLocal = productosInventario.find(p => 
        p.codigo.replace(/\s+/g, '').toLowerCase() === codigoLimpio.toLowerCase()
      );
      
      if (productoLocal) {
        console.log("✅ Encontrado en cache local:", productoLocal);
        agregarProductoDesdeInventario(productoLocal);
        mostrarAlerta("success", `✅ ${productoLocal.categoria} agregado - Stock: ${productoLocal.stock}`);
      } else {
        console.log("❌ Producto NO encontrado");
        console.log("📋 Códigos disponibles:", productosInventario.map(p => `"${p.codigo}"`));
        
        mostrarAlerta("error", `❌ Código "${codigoLimpio}" no encontrado en inventario`);
        
        // Preguntar si desea agregar manualmente
        setTimeout(() => {
          const agregar = confirm(`Código "${codigoLimpio}" no encontrado.\n¿Deseas agregarlo manualmente?`);
          if (agregar) {
            agregarProductoConCodigo(codigoLimpio);
          }
        }, 100);
      }
    }
  } catch (error) {
    console.error("❌ Error al buscar producto:", error);
    mostrarAlerta("error", "❌ Error al buscar producto: " + error.message);
  }
}

// NUEVA FUNCIÓN: Agregar producto desde el inventario (con vinculación a Airtable)
function agregarProductoDesdeInventario(producto) {
  const container = document.getElementById("productosLista");
  
  // Verificar si ya existe un producto inicial vacío y eliminarlo
  const productosVacios = container.querySelectorAll('.producto-item');
  productosVacios.forEach(item => {
    const nombre = item.querySelector('.producto-nombre').value;
    const precio = item.querySelector('.producto-precio').value;
    if (!nombre && !precio) {
      item.remove();
    }
  });
  
  // Agregar producto vinculado a la tabla de Inventario Principal
  const productoHTML = `
    <div class="producto-item" data-producto-id="${producto.id}" data-producto-record='${JSON.stringify(producto.recordCompleto)}'>
      <div class="form-group" style="margin: 0;">
        <label>Producto (vinculado)</label>
        <input type="text" class="producto-nombre" value="${producto.categoria}" readonly style="background-color: #e8f5e9; font-weight: 500; border: 2px solid #4caf50;">
      </div>
      <div class="form-group" style="margin: 0;">
        <label>📦 Código: ${producto.codigo} | 📊 Stock: ${producto.stock}</label>
        <input type="number" class="producto-precio" placeholder="Ingresa el precio" min="0" onchange="calcularTotal()" autofocus>
      </div>
      <div>
        <button class="btn btn-danger" onclick="eliminarProducto(this)" style="margin-top: 24px;">🗑️</button>
      </div>
    </div>
  `;
  container.insertAdjacentHTML("beforeend", productoHTML);
  
  // Enfocar el campo de precio del último producto agregado
  const ultimoPrecio = container.querySelector('.producto-item:last-child .producto-precio');
  if (ultimoPrecio) {
    setTimeout(() => {
      ultimoPrecio.focus();
      // Después de ingresar precio, volver al campo de código
      ultimoPrecio.addEventListener('blur', () => {
        setTimeout(() => {
          document.getElementById("codigoProducto").focus();
        }, 100);
      });
    }, 100);
  }
  
  calcularTotal();
}

// FUNCIÓN: Buscar y mostrar producto para devolución
async function buscarYMostrarProductoDevolucion(codigoEscaneado) {
  const codigoLimpio = codigoEscaneado.replace(/\s+/g, '').trim();
  
  console.log("🔎 Buscando producto para devolución:", codigoLimpio);
  
  try {
    const INVENTARIO_PRINCIPAL_ID = "tblxyk6vtahtFlLVo";
    const formulaExacta = encodeURIComponent(`{Código por categoría}='${codigoLimpio}'`);
    const url = `https://api.airtable.com/v0/${BASE_ID}/${INVENTARIO_PRINCIPAL_ID}?filterByFormula=${formulaExacta}`;
    
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${AIRTABLE_TOKEN}`,
      },
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
      
      console.log("✅ Producto encontrado para devolución:", producto);
      agregarProductoDevolucion(producto);
      mostrarAlerta("success", `✅ ${producto.categoria} agregado a devolución`);
    } else {
      const productoLocal = productosInventario.find(p => 
        p.codigo.replace(/\s+/g, '').toLowerCase() === codigoLimpio.toLowerCase()
      );
      
      if (productoLocal) {
        agregarProductoDevolucion(productoLocal);
        mostrarAlerta("success", `✅ ${productoLocal.categoria} agregado a devolución`);
      } else {
        mostrarAlerta("error", `❌ Código "${codigoLimpio}" no encontrado`);
      }
    }
  } catch (error) {
    console.error("❌ Error al buscar producto:", error);
    mostrarAlerta("error", "❌ Error al buscar producto: " + error.message);
  }
}

// FUNCIÓN: Agregar producto a la lista de devoluciones
function agregarProductoDevolucion(producto) {
  const devolucion = {
    id: producto.id,
    nombre: producto.categoria,
    cantidad: 1,
    codigo: producto.codigo,
    motivo: "Escaneado"
  };

  devolucionesAgregadas.push(devolucion);

  const container = document.getElementById("devolucionesList");
  const itemHTML = `
    <div class="devolucion-item" data-devolucion-id="${producto.id}">
      <strong>${producto.categoria}</strong> - Código: ${producto.codigo}
      <div style="margin-top: 5px;">
        <label style="font-size: 14px;">Motivo:</label>
        <input type="text" placeholder="Ingresa el motivo..." style="margin-left: 10px; padding: 5px; width: 200px;" onchange="actualizarMotivoDevolucion('${producto.id}', this.value)">
      </div>
      <button class="btn btn-danger" onclick="eliminarDevolucion('${producto.id}')" style="margin-top: 10px; padding: 5px 10px;">🗑️ Eliminar</button>
    </div>
  `;
  container.insertAdjacentHTML("beforeend", itemHTML);
  
  // Enfocar el campo de código para continuar escaneando
  setTimeout(() => {
    document.getElementById("codigoDevolucion").focus();
  }, 100);
}

// FUNCIÓN: Actualizar motivo de devolución
window.actualizarMotivoDevolucion = function(id, motivo) {
  const devolucion = devolucionesAgregadas.find(d => d.id === id);
  if (devolucion) {
    devolucion.motivo = motivo;
  }
}

window.agregarProductoConCodigo = function(codigo) {
  const container = document.getElementById("productosLista");
  const productoHTML = `
    <div class="producto-item">
      <div class="form-group" style="margin: 0;">
        <label>Producto (Manual)</label>
        <input type="text" class="producto-nombre" value="${codigo}">
      </div>
      <div class="form-group" style="margin: 0;">
        <label>Precio ($)</label>
        <input type="number" class="producto-precio" placeholder="0" min="0" onchange="calcularTotal()" autofocus>
      </div>
      <div>
        <button class="btn btn-danger" onclick="eliminarProducto(this)" style="margin-top: 24px;">🗑️</button>
      </div>
    </div>
  `;
  container.insertAdjacentHTML("beforeend", productoHTML);
}

window.agregarProductoManual = function() {
  const select = document.getElementById("selectProductoManual");
  if (select.value) {
    agregarProductoConCodigo(select.value);
    select.value = "";
  }
}

window.eliminarDevolucion = function(id) {
  devolucionesAgregadas = devolucionesAgregadas.filter(d => d.id !== id);
  const items = document.querySelectorAll(".devolucion-item");
  items.forEach(item => {
    if (item.dataset.devolucionId === id) {
      item.remove();
    }
  });
  calcularTotal();
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
      headers: {
        Authorization: `Bearer ${AIRTABLE_TOKEN}`,
      },
    });

    const data = await response.json();

    mostrarLoading(false);

    if (data.records && data.records.length > 0) {
      clienteSeleccionado = data.records[0];
      mostrarInfoCliente(clienteSeleccionado);
      document.getElementById("productosContainer").style.display = "block";
      document.getElementById("anfitrionContainer").style.display = "block";
      cargarAnfitriones();
      
      // Focus en el input de código para comenzar a escanear
      setTimeout(() => {
        document.getElementById("codigoProducto").focus();
        mostrarAlerta("info", "📱 Escanea el código de barras o ingresa manualmente");
      }, 100);
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
  document.getElementById("productosContainer").style.display = "none";
  document.getElementById("anfitrionContainer").style.display = "none";
}

window.agregarProducto = function() {
  const container = document.getElementById("productosLista");
  const productoHTML = `
    <div class="producto-item">
      <div class="form-group" style="margin: 0;">
        <label>Producto</label>
        <input type="text" class="producto-nombre" placeholder="Nombre del producto">
      </div>
      <div class="form-group" style="margin: 0;">
        <label>Precio ($)</label>
        <input type="number" class="producto-precio" placeholder="0" min="0" onchange="calcularTotal()">
      </div>
      <div>
        <button class="btn btn-danger" onclick="eliminarProducto(this)" style="margin-top: 24px;">🗑️</button>
      </div>
    </div>
  `;
  container.insertAdjacentHTML("beforeend", productoHTML);
}

window.eliminarProducto = function(btn) {
  const items = document.querySelectorAll(".producto-item");
  if (items.length > 1) {
    btn.closest(".producto-item").remove();
    calcularTotal();
  } else {
    mostrarAlerta("info", "⚠️ Debe haber al menos un producto");
  }
}

window.calcularTotal = function() {
  let subtotal = 0;
  const precios = document.querySelectorAll(".producto-precio");

  precios.forEach((input) => {
    const precio = parseFloat(input.value) || 0;
    subtotal += precio;
  });

  const descuentoPorcentaje = parseFloat(document.getElementById("descuento").value) || 0;
  const descuentoMonto = (subtotal * descuentoPorcentaje) / 100;
  const total = subtotal - descuentoMonto;

  document.getElementById("subtotal").textContent = "$" + subtotal.toLocaleString("es-CL");
  document.getElementById("descuentoMonto").textContent = "-$" + descuentoMonto.toLocaleString("es-CL");
  document.getElementById("total").textContent = "$" + total.toLocaleString("es-CL");
}

window.registrarVenta = async function() {
  if (!clienteSeleccionado) {
    mostrarAlerta("error", "❌ Primero debes buscar y seleccionar un cliente");
    return;
  }

  if (tipoTransaccionActual === 'venta') {
    const anfitrionSelect = document.getElementById("anfitrionSelect");
    if (!anfitrionSelect.value) {
      mostrarAlerta("error", "❌ Debes seleccionar un anfitrión");
      return;
    }
    anfitrionSeleccionado = anfitrionSelect.value;
  }

  if (!AIRTABLE_TOKEN || !BASE_ID) {
    mostrarAlerta("error", "❌ Error: Configuración no cargada. Recarga la página.");
    return;
  }

  let totalVenta = 0;
  let productosVinculados = []; // Array para guardar los IDs de productos vinculados
  let itemsTexto = "";

  if (tipoTransaccionActual === 'venta') {
    const productosItems = document.querySelectorAll(".producto-item");

    for (let item of productosItems) {
      const nombre = item.querySelector(".producto-nombre").value || "Producto sin nombre";
      const precio = parseFloat(item.querySelector(".producto-precio").value) || 0;
      const productoId = item.dataset.productoId; // ID del registro de Inventario

      if (precio > 0) {
        // Si el producto está vinculado a Inventario, guardar el ID
        if (productoId) {
          productosVinculados.push(productoId);
        }
        
        itemsTexto += `${nombre} (${precio}), `;
        totalVenta += precio;
      }
    }

    if (productosVinculados.length === 0 && itemsTexto === "") {
      mostrarAlerta("error", "❌ Debes agregar al menos un producto con precio");
      return;
    }
  } else {
    // Devoluciones
    if (devolucionesAgregadas.length === 0) {
      mostrarAlerta("error", "❌ Debes escanear al menos un producto para devolver");
      return;
    }
    itemsTexto = devolucionesAgregadas.map(d => `${d.nombre} (${d.cantidad} unidad/es) - ${d.motivo}`).join(", ");
  }

  const descuentoPorcentaje = parseFloat(document.getElementById("descuento").value) || 0;
  const descuentoMonto = (totalVenta * descuentoPorcentaje) / 100;
  totalVenta = totalVenta - descuentoMonto;

  const notas = document.getElementById("notas").value || "";

  // Limpiar coma final
  itemsTexto = itemsTexto.replace(/,\s*$/, "");

  mostrarLoading(true);
  ocultarAlertas();

  try {
    if (tipoTransaccionActual === 'venta') {
      const ventaData = {
        fields: {
          Cliente: [clienteSeleccionado.id],
          Anfitrión: [anfitrionSeleccionado],
          Items: itemsTexto,
          "Total de venta": Math.round(totalVenta),
          Descuento: descuentoPorcentaje,
        },
      };

      // Agregar vinculación de productos si existen
      if (productosVinculados.length > 0) {
        ventaData.fields["producto"] = productosVinculados; // Campo "producto" vinculado en tu tabla de Ventas
      }

      if (notas.trim()) {
        ventaData.fields["Notas"] = notas;
      }

      console.log("Enviando venta:", ventaData);

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
        mostrarAlerta("success", "✅ ¡Venta registrada exitosamente!");
        setTimeout(() => {
          limpiarFormulario();
        }, 2000);
      } else {
        console.error("Error de Airtable:", result);
        mostrarAlerta(
          "error",
          "❌ Error al registrar: " + (result.error?.message || "Error desconocido")
        );
      }
    } else {
      const devolucionData = {
        fields: {
          Cliente: [clienteSeleccionado.id],
          "Productos devueltos": itemsTexto,
          Tipo: "Devolución",
        },
      };

      if (notas.trim()) {
        devolucionData.fields["Notas"] = notas;
      }

      console.log("Enviando devolución:", devolucionData);

      const response = await fetch(
        `https://api.airtable.com/v0/${BASE_ID}/${VENTAS_TABLE_ID}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${AIRTABLE_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(devolucionData),
        }
      );

      const result = await response.json();
      mostrarLoading(false);

      if (response.ok) {
        mostrarAlerta("success", "✅ ¡Devolución registrada exitosamente!");
        setTimeout(() => {
          limpiarFormulario();
        }, 2000);
      } else {
        console.error("Error de Airtable:", result);
        mostrarAlerta(
          "error",
          "❌ Error al registrar: " + (result.error?.message || "Error desconocido")
        );
      }
    }
  } catch (error) {
    mostrarLoading(false);
    mostrarAlerta("error", "❌ Error al registrar: " + error.message);
    console.error("Error:", error);
  }
}

window.limpiarFormulario = function() {
  document.getElementById("rutCliente").value = "";
  document.getElementById("descuento").value = "0";
  document.getElementById("notas").value = "";
  document.getElementById("clienteInfo").classList.remove("show");
  document.getElementById("clienteNoEncontrado").classList.remove("show");
  document.getElementById("productosContainer").style.display = "none";
  document.getElementById("anfitrionContainer").style.display = "none";

  const container = document.getElementById("productosLista");
  container.innerHTML = `
    <div class="producto-item">
      <div class="form-group" style="margin: 0;">
        <label>Producto</label>
        <input type="text" class="producto-nombre" placeholder="Escanea código o ingresa nombre">
      </div>
      <div class="form-group" style="margin: 0;">
        <label>Precio ($)</label>
        <input type="number" class="producto-precio" placeholder="0" min="0" onchange="calcularTotal()">
      </div>
      <div>
        <button class="btn btn-danger" onclick="eliminarProducto(this)" style="margin-top: 24px;">🗑️</button>
      </div>
    </div>
  `;

  document.getElementById("devolucionesList").innerHTML = "";
  devolucionesAgregadas = [];

  const ventaRadio = document.querySelector('input[name="tipoTransaccion"][value="venta"]');
  if (ventaRadio) {
    ventaRadio.checked = true;
    cambiarTipoTransaccion('venta');
  }

  calcularTotal();
  clienteSeleccionado = null;
  anfitrionSeleccionado = null;
  ocultarAlertas();
  document.getElementById("rutCliente").focus();
}

function mostrarAlerta(tipo, mensaje) {
  ocultarAlertas();
  const alertId =
    tipo === "success"
      ? "alertSuccess"
      : tipo === "error"
      ? "alertError"
      : "alertInfo";
  const alert = document.getElementById(alertId);
  alert.textContent = mensaje;
  alert.classList.add("show");

  if (tipo !== "info") {
    setTimeout(() => {
      alert.classList.remove("show");
    }, 5000);
  }
}

function ocultarAlertas() {
  document.getElementById("alertSuccess").classList.remove("show");
  document.getElementById("alertError").classList.remove("show");
  document.getElementById("alertInfo").classList.remove("show");
}

function mostrarLoading(show) {
  const loading = document.getElementById("loading");
  if (show) {
    loading.classList.add("show");
  } else {
    loading.classList.remove("show");
  }
}

// Inicializar la aplicación
fetchConfig().then((success) => {
  if (success) {
    calcularTotal();
    console.log("✅ Aplicación lista para usar");
    console.log("📦 Productos cargados:", productosInventario.length);
  } else {
    mostrarAlerta("error", "❌ Error al cargar la configuración. Por favor, recarga la página.");
  }
});