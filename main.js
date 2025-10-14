let AIRTABLE_TOKEN, BASE_ID, CLIENTES_TABLE_ID, VENTAS_TABLE_ID, ANFITRIONES_TABLE_ID, INVENTARIO_TABLE_ID;
let clienteSeleccionado = null;
let anfitrionSeleccionado = null;
let tipoTransaccionActual = 'venta';
let devolucionesAgregadas = [];

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
    return true;
  } catch (error) {
    console.error("❌ Error al cargar configuración:", error);
    return false;
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

// Cargar productos de inventario para devoluciones
async function cargarProductosInventario() {
  try {
    const url = `https://api.airtable.com/v0/${BASE_ID}/${INVENTARIO_TABLE_ID}`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${AIRTABLE_TOKEN}`,
      },
    });

    const data = await response.json();
    const select = document.getElementById("productoDevolucion");

    if (data.records) {
      data.records.forEach(record => {
        const option = document.createElement("option");
        option.value = record.id;
        const nombre = record.fields.Nombre || record.fields.Producto || "Sin nombre";
        const cantidad = record.fields.Cantidad || 0;
        option.textContent = `${nombre} (Stock: ${cantidad})`;
        option.dataset.record = JSON.stringify(record);
        select.appendChild(option);
      });
    }
  } catch (error) {
    console.error("Error al cargar inventario:", error);
  }
}

window.cambiarTipoTransaccion = function(tipo) {
  tipoTransaccionActual = tipo;
  const ventasSection = document.getElementById("ventasSection");
  const devolucionesSection = document.getElementById("devolucionesSection");

  if (tipo === 'venta') {
    ventasSection.style.display = "block";
    devolucionesSection.style.display = "none";
  } else {
    ventasSection.style.display = "none";
    devolucionesSection.style.display = "block";
    cargarProductosInventario();
  }
  calcularTotal();
}

window.procesarCodigoProducto = function(event) {
  if (event.key === "Enter") {
    event.preventDefault();
    const codigo = document.getElementById("codigoProducto").value.trim();
    
    if (codigo) {
      agregarProductoConCodigo(codigo);
      document.getElementById("codigoProducto").value = "";
      document.getElementById("codigoProducto").focus();
    }
  }
}

window.agregarProductoConCodigo = function(codigo) {
  const container = document.getElementById("productosLista");
  const productoHTML = `
    <div class="producto-item">
      <div class="form-group" style="margin: 0;">
        <label>Producto</label>
        <input type="text" class="producto-nombre" value="${codigo}" readonly>
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

window.cargarDetallesDevolucion = function() {
  const select = document.getElementById("productoDevolucion");
  const detalles = document.getElementById("detallesDevolucion");
  
  if (select.value) {
    detalles.style.display = "block";
  } else {
    detalles.style.display = "none";
  }
}

window.agregarDevolucion = function() {
  const select = document.getElementById("productoDevolucion");
  const cantidad = parseInt(document.getElementById("cantidadDevolucion").value) || 1;
  const motivo = document.getElementById("motivoDevolucion").value;

  if (!select.value || !motivo) {
    mostrarAlerta("error", "❌ Debes seleccionar producto y motivo");
    return;
  }

  const option = select.options[select.selectedIndex];
  const record = JSON.parse(option.dataset.record);
  const nombreProducto = record.fields.Nombre || record.fields.Producto || "Sin nombre";

  const devolucion = {
    id: record.id,
    nombre: nombreProducto,
    cantidad: cantidad,
    motivo: motivo
  };

  devolucionesAgregadas.push(devolucion);

  const container = document.getElementById("devolucionesList");
  const itemHTML = `
    <div class="devolucion-item" style="padding: 10px; border: 1px solid #ddd; border-radius: 4px; margin: 10px 0;">
      <strong>${nombreProducto}</strong> - Cantidad: ${cantidad} - Motivo: ${motivo}
      <button class="btn btn-danger" onclick="eliminarDevolucion('${record.id}')" style="margin-left: 10px; padding: 5px 10px;">🗑️</button>
    </div>
  `;
  container.insertAdjacentHTML("beforeend", itemHTML);

  select.value = "";
  document.getElementById("detallesDevolucion").style.display = "none";
  calcularTotal();
}

window.eliminarDevolucion = function(id) {
  devolucionesAgregadas = devolucionesAgregadas.filter(d => d.id !== id);
  document.querySelectorAll(".devolucion-item").forEach(item => {
    if (item.textContent.includes(devolucionesAgregadas.map(d => d.nombre).join(""))) return;
    item.remove();
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
  let productosArray = [];
  let itemsTexto = "";

  if (tipoTransaccionActual === 'venta') {
    const productosItems = document.querySelectorAll(".producto-item");

    for (let item of productosItems) {
      const nombre = item.querySelector(".producto-nombre").value || "Producto sin nombre";
      const precio = parseFloat(item.querySelector(".producto-precio").value) || 0;

      if (precio > 0) {
        productosArray.push(nombre);
        itemsTexto += `${nombre} ($${precio}), `;
        totalVenta += precio;
      }
    }

    if (productosArray.length === 0) {
      mostrarAlerta("error", "❌ Debes agregar al menos un producto con precio");
      return;
    }
  } else {
    // Devoluciones
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

      // Agrega notas solo si existen
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
      // Registrar devolución
      const devolucionData = {
        fields: {
          Cliente: [clienteSeleccionado.id],
          "Productos devueltos": itemsTexto,
          Tipo: "Devolución",
        },
      };

      // Agrega notas solo si existen
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

  document.getElementById("devolucionesList").innerHTML = "";
  devolucionesAgregadas = [];

  // Reiniciar a tipo venta
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
  } else {
    mostrarAlerta("error", "❌ Error al cargar la configuración. Por favor, recarga la página.");
  }
});