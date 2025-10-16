let AIRTABLE_TOKEN, BASE_ID, CLIENTES_TABLE_ID, VENTAS_TABLE_ID, ANFITRIONES_TABLE_ID, INVENTARIO_TABLE_ID;
let clienteSeleccionado = null;
let anfitrionSeleccionado = null;
let tipoTransaccionActual = 'venta';
let devolucionesAgregadas = [];
let productosInventario = [];

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
    const INVENTARIO_PRINCIPAL_ID = "tblxyk6vtahtFlLVo";
    const url = `https://api.airtable.com/v0/${BASE_ID}/${INVENTARIO_PRINCIPAL_ID}`;
    console.log("🔍 Cargando inventario desde:", url);
    
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${AIRTABLE_TOKEN}`,
      },
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

window.buscarClienteEnter = function(event) {
  if (event.key === "Enter") {
    event.preventDefault();
    buscarCliente();
  }
}

async function cargarAnfitriones() {
  try {
    const url = `https://api.airtable.com/v0/${BASE_ID}/${ANFITRIONES_TABLE_ID}`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` },
    });

    const data = await response.json();
    const select = document.getElementById("anfitrionSelect");
    
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
  const anfitrionContainer = document.getElementById("anfitrionContainer");

  if (tipo === 'venta') {
    ventasSection.style.display = "block";
    devolucionesSection.style.display = "none";
    anfitrionContainer.style.display = "block";
    setTimeout(() => document.getElementById("codigoProducto").focus(), 100);
  } else {
    ventasSection.style.display = "none";
    devolucionesSection.style.display = "block";
    anfitrionContainer.style.display = "block";
    document.getElementById("devolucionesList").innerHTML = "";
    devolucionesAgregadas = [];
    setTimeout(() => document.getElementById("codigoDevolucion").focus(), 100);
  }
  calcularTotal();
}

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

window.procesarCodigoDevolucion = function(event) {
  if (event.key === "Enter") {
    event.preventDefault();
    const codigo = document.getElementById("codigoDevolucion").value.trim();
    if (codigo) {
      buscarYMostrarProductoDevolucion(codigo);
      document.getElementById("codigoDevolucion").value = "";
    }
  }
}

async function buscarYAgregarProductoPorCodigo(codigoEscaneado) {
  const codigoLimpio = codigoEscaneado.replace(/\s+/g, '').trim();
  
  try {
    const INVENTARIO_PRINCIPAL_ID = "tblxyk6vtahtFlLVo";
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
  const container = document.getElementById("productosLista");
  
  const productosVacios = container.querySelectorAll('.producto-item');
  productosVacios.forEach(item => {
    const nombre = item.querySelector('.producto-nombre').value;
    const precio = item.querySelector('.producto-precio').value;
    if (!nombre && !precio) item.remove();
  });
  
  const codigoTexto = String(producto.codigo || 'N/A');
  const stockTexto = String(producto.stock || 0);
  
  const productoHTML = `
    <div class="producto-item" data-producto-id="${producto.id}">
      <div class="form-group" style="margin: 0;">
        <label>Producto (vinculado)</label>
        <input type="text" class="producto-nombre" value="${producto.categoria}" readonly style="background-color: #e8f5e9; font-weight: 500; border: 2px solid #4caf50;">
      </div>
      <div class="form-group" style="margin: 0;">
        <label>📦 Código: ${codigoTexto} | 📊 Stock: ${stockTexto}</label>
        <input type="text" class="producto-precio" placeholder="Ingresa el precio" oninput="formatearPrecio(this); calcularTotal();" autofocus>
      </div>
      <div>
        <button class="btn btn-danger" onclick="eliminarProducto(this)" style="margin-top: 24px;">🗑️</button>
      </div>
    </div>
  `;
  
  container.insertAdjacentHTML("beforeend", productoHTML);
  
  const ultimoPrecio = container.querySelector('.producto-item:last-child .producto-precio');
  if (ultimoPrecio) {
    setTimeout(() => {
      ultimoPrecio.focus();
      ultimoPrecio.addEventListener('blur', () => {
        setTimeout(() => document.getElementById("codigoProducto").focus(), 100);
      });
    }, 100);
  }
  calcularTotal();
}

function mostrarAlerta(tipo, mensaje) {
  ocultarAlertas();
  const alertId = tipo === "success" ? "alertSuccess" : tipo === "error" ? "alertError" : "alertInfo";
  const alert = document.getElementById(alertId);
  alert.textContent = mensaje;
  alert.classList.add("show");

  if (tipo !== "info") {
    setTimeout(() => alert.classList.remove("show"), 5000);
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

async function buscarYMostrarProductoDevolucion(codigoEscaneado) {
  const codigoLimpio = codigoEscaneado.replace(/\s+/g, '').trim();
  
  try {
    const INVENTARIO_PRINCIPAL_ID = "tblxyk6vtahtFlLVo";
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
  const yaExiste = devolucionesAgregadas.find(d => d.id === producto.id);
  if (yaExiste) {
    setTimeout(() => document.getElementById("codigoDevolucion").focus(), 100);
    return;
  }

  const devolucion = {
    id: producto.id,
    nombre: producto.categoria,
    codigo: producto.codigo,
    stock: producto.stock || 0
  };

  devolucionesAgregadas.push(devolucion);
  console.log("✅ Producto agregado a lista:", devolucion);

  const container = document.getElementById("devolucionesList");
  const itemHTML = `
    <div class="devolucion-item" data-devolucion-id="${producto.id}" style="background: #e8f5e9; padding: 12px; margin: 8px 0; border-radius: 8px; border-left: 4px solid #4caf50; display: flex; justify-content: space-between; align-items: center;">
      <div>
        <strong style="font-size: 16px; color: #2e7d32;">📦 ${producto.categoria}</strong>
        <div style="color: #666; margin-top: 4px; font-size: 14px;">Código: ${producto.codigo}</div>
      </div>
      <button class="btn btn-danger" onclick="eliminarDevolucion('${producto.id}')" style="padding: 8px 12px; font-size: 14px;">🗑️</button>
    </div>
  `;
  container.insertAdjacentHTML("beforeend", itemHTML);
  setTimeout(() => document.getElementById("codigoDevolucion").focus(), 100);
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
        <input type="text" class="producto-precio" placeholder="0" oninput="formatearPrecio(this); calcularTotal();" autofocus>
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
    if (item.dataset.devolucionId === id) item.remove();
  });
}

// FUNCIÓN NUEVA: Verificar si es cumpleaños del cliente
function verificarCumpleanos(cliente) {
  try {
    const campoDescuento = cliente.fields["ito Cumple"] || 
                          cliente.fields["Descuento Cumple"] || 
                          cliente.fields["Descuento por Cumpleaños"] ||
                          cliente.fields["descuento cumpleaños"];
    
    console.log("🎂 Campo descuento encontrado:", campoDescuento);
    
    // Si el campo existe y tiene un valor (podría ser 10, "10%", etc)
    if (campoDescuento) {
      let descuentoValor = campoDescuento;
      
      // Si es string, extraer el número
      if (typeof descuentoValor === 'string') {
        descuentoValor = parseFloat(descuentoValor.replace(/[^0-9.]/g, ''));
      }
      
      // Si es un número válido mayor a 0
      if (!isNaN(descuentoValor) && descuentoValor > 0) {
        return descuentoValor;
      }
    }
    
    return 0;
  } catch (error) {
    console.error("Error al verificar cumpleaños:", error);
    return 0;
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
      
      // VERIFICAR CUMPLEAÑOS
      const descuentoCumple = verificarCumpleanos(clienteSeleccionado);
      
      if (descuentoCumple > 0) {
        // Aplicar descuento automáticamente
        const campoDescuento = document.getElementById("descuento");
        campoDescuento.value = descuentoCumple;
        
        // Mostrar mensaje de cumpleaños
        mostrarAlerta("success", `🎉 ¡FELIZ CUMPLEAÑOS! Se ha aplicado ${descuentoCumple}% de descuento automáticamente`);
        
        // Actualizar visual del campo de descuento
        campoDescuento.style.backgroundColor = "#fff3cd";
        campoDescuento.style.border = "2px solid #ffc107";
        campoDescuento.style.fontWeight = "bold";
      }
      
      mostrarInfoCliente(clienteSeleccionado);
      document.getElementById("productosContainer").style.display = "block";
      document.getElementById("anfitrionContainer").style.display = "block";
      cargarAnfitriones();
      
      setTimeout(() => {
        document.getElementById("codigoProducto").focus();
        if (descuentoCumple === 0) {
          mostrarAlerta("info", "📱 Escanea el código de barras");
        }
      }, descuentoCumple > 0 ? 3000 : 100);
      
      // Calcular el total con el descuento aplicado
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
        <input type="text" class="producto-precio" placeholder="0" oninput="formatearPrecio(this); calcularTotal();">
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
    const valorLimpio = input.value.replace(/\./g, '').replace(/\D/g, '');
    const precio = valorLimpio ? parseInt(valorLimpio) : 0;
    subtotal += precio;
  });

  const descuentoPorcentaje = parseFloat(document.getElementById("descuento").value) || 0;
  const descuentoMonto = Math.round((subtotal * descuentoPorcentaje) / 100);
  const total = subtotal - descuentoMonto;

  document.getElementById("subtotal").textContent = "$" + subtotal.toLocaleString("es-CL");
  document.getElementById("descuentoMonto").textContent = "-$" + descuentoMonto.toLocaleString("es-CL");
  document.getElementById("total").textContent = "$" + total.toLocaleString("es-CL");
}

window.registrarVenta = async function() {
  console.log("🔘 Registrar - Tipo:", tipoTransaccionActual);
  
  if (!clienteSeleccionado) {
    mostrarAlerta("error", "❌ Primero debes buscar y seleccionar un cliente");
    return;
  }

  const anfitrionSelect = document.getElementById("anfitrionSelect");
  if (!anfitrionSelect.value) {
    mostrarAlerta("error", "❌ Debes seleccionar un anfitrión");
    return;
  }
  anfitrionSeleccionado = anfitrionSelect.value;

  if (!AIRTABLE_TOKEN || !BASE_ID) {
    mostrarAlerta("error", "❌ Error: Configuración no cargada.");
    return;
  }

  let totalVenta = 0;
  let productosVinculados = [];
  let itemsTexto = "";

  if (tipoTransaccionActual === 'venta') {
    const productosItems = document.querySelectorAll(".producto-item");
    for (let item of productosItems) {
      const nombre = item.querySelector(".producto-nombre").value || "Producto sin nombre";
      const precioInput = item.querySelector(".producto-precio").value || "0";
      const valorLimpio = precioInput.replace(/\./g, '').replace(/\D/g, '');
      const precio = valorLimpio ? parseInt(valorLimpio) : 0;
      const productoId = item.dataset.productoId;

      if (precio > 0) {
        if (productoId) productosVinculados.push(productoId);
        itemsTexto += `${nombre} (${precio}), `;
        totalVenta += precio;
      }
    }

    if (productosVinculados.length === 0 && itemsTexto === "") {
      mostrarAlerta("error", "❌ Debes agregar al menos un producto con precio");
      return;
    }
  } else {
    console.log("📦 Devoluciones:", devolucionesAgregadas);
    if (devolucionesAgregadas.length === 0) {
      mostrarAlerta("error", "❌ Debes escanear al menos un producto para devolver");
      return;
    }
    
    for (let devolucion of devolucionesAgregadas) {
      if (devolucion.id) productosVinculados.push(devolucion.id);
      itemsTexto += `${devolucion.nombre}, `;
    }
    console.log("📦 IDs:", productosVinculados);
  }

  const descuentoPorcentaje = parseFloat(document.getElementById("descuento").value) || 0;
  const descuentoMonto = Math.round((totalVenta * descuentoPorcentaje) / 100);
  totalVenta = totalVenta - descuentoMonto;
  const notas = document.getElementById("notas").value || "";
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

      if (productosVinculados.length > 0) ventaData.fields["producto"] = productosVinculados;
      if (notas.trim()) ventaData.fields["Box Observaciones"] = notas;

      console.log("💰 Enviando VENTA:", ventaData);

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
        setTimeout(() => limpiarFormulario(), 2000);
      } else {
        console.error("❌ Error:", result);
        mostrarAlerta("error", "❌ Error: " + (result.error?.message || "Error desconocido"));
      }
    } else {
      const devolucionData = {
        fields: {
          Cliente: [clienteSeleccionado.id],
          Anfitrión: [anfitrionSeleccionado],
          Items: itemsTexto,
          "Total de venta": 0,
        },
      };

      if (productosVinculados.length > 0) {
        devolucionData.fields["Devolución"] = productosVinculados;
      }

      if (notas.trim()) {
        devolucionData.fields["Box Observaciones"] = notas;
      }

      console.log("🔄 Enviando DEVOLUCIÓN:", JSON.stringify(devolucionData, null, 2));

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
        console.log("✅ Devolución registrada:", result);
        mostrarAlerta("success", `✅ ¡Devolución registrada! ${devolucionesAgregadas.length} producto(s)`);
        setTimeout(() => limpiarFormulario(), 2000);
      } else {
        console.error("❌ Error:", result);
        mostrarAlerta("error", "❌ Error: " + (result.error?.message || "Error desconocido"));
      }
    }
  } catch (error) {
    mostrarLoading(false);
    mostrarAlerta("error", "❌ Error: " + error.message);
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

  // Resetear estilo del campo de descuento
  const campoDescuento = document.getElementById("descuento");
  campoDescuento.style.backgroundColor = "";
  campoDescuento.style.border = "";
  campoDescuento.style.fontWeight = "";

  const container = document.getElementById("productosLista");
  container.innerHTML = `
    <div class="producto-item">
      <div class="form-group" style="margin: 0;">
        <label>Producto</label>
        <input type="text" class="producto-nombre" placeholder="Escanea código o ingresa nombre">
      </div>
      <div class="form-group" style="margin: 0;">
        <label>Precio ($)</label>
        <input type="text" class="producto-precio" placeholder="0" oninput="formatearPrecio(this); calcularTotal();">
      </div>
      <div>
        <button class="btn btn-danger" onclick="eliminarProducto(this)" style="margin-top: 24px;">🗑️</button>
      </div>
    </div>
  `;

  document.getElementById("devolucionesList").innerHTML = "";
  devolucionesAgregadas = [];
  clienteSeleccionado = null;
  anfitrionSeleccionado = null;
  
  const anfitrionSelect = document.getElementById("anfitrionSelect");
  if (anfitrionSelect) {
    anfitrionSelect.value = "";
  }
  
  const ventaRadio = document.querySelector('input[name="tipoTransaccion"][value="venta"]');
  if (ventaRadio) {
    ventaRadio.checked = true;
  }

  calcularTotal();
  ocultarAlertas();
  document.getElementById("rutCliente").focus();
}

window.formatearPrecio = function(input) {
  let valor = input.value.replace(/\D/g, '');
  if (valor) {
    valor = parseInt(valor).toLocaleString('es-CL');
  }
  input.value = valor;
}

// Inicialización al cargar la página
fetchConfig().then((success) => {
  if (success) {
    calcularTotal();
    console.log("✅ Aplicación lista para usar");
  } else {
    mostrarAlerta("error", "❌ Error al cargar la configuración. Recarga la página.");
  }
});