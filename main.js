let AIRTABLE_TOKEN, BASE_ID, CLIENTES_TABLE_ID, VENTAS_TABLE_ID;
let clienteSeleccionado = null;

async function fetchConfig() {
  try {
    const res = await fetch("https://registro-de-ventas-eight.vercel.app/api/proxy");
    const data = await res.json();

    AIRTABLE_TOKEN = data.airtableToken;
    BASE_ID = data.baseId_;
    CLIENTES_TABLE_ID = data.clientesTable_;
    VENTAS_TABLE_ID = data.ventasTable_;

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
  // Remover todo excepto números y K
  value = value.replace(/[^0-9kK]/g, '').toUpperCase();
  
  // Limitar a 9 caracteres (8-9 dígitos + DV)
  if (value.length > 9) {
    value = value.substring(0, 9);
  }
  
  if (value.length <= 1) {
    return value;
  }
  
  // Separar dígito verificador
  const dv = value.slice(-1);
  let rut = value.slice(0, -1);
  
  // Formatear con puntos
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

// Formatear RUT chileno automáticamente
window.formatearRUT = function(input) {
  const cursorPosition = input.selectionStart;
  const oldValue = input.value;
  const oldLength = oldValue.length;
  
  // Formatear el valor
  input.value = formatRut(input.value);
  
  // Ajustar posición del cursor
  const newLength = input.value.length;
  const diff = newLength - oldLength;
  input.setSelectionRange(cursorPosition + diff, cursorPosition + diff);
}

// Función para validar formato de RUT chileno
window.validarRUT = function(rut) {
  // Limpiar RUT
  rut = cleanRut(rut);
  
  // Debe tener entre 8 y 9 caracteres
  if (rut.length < 8 || rut.length > 9) {
    return false;
  }
  
  // Separar cuerpo y dígito verificador
  const cuerpo = rut.slice(0, -1);
  const dv = rut.slice(-1);
  
  // Calcular dígito verificador
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

// Función para buscar al presionar Enter
window.buscarClienteEnter = function(event) {
  if (event.key === "Enter") {
    event.preventDefault();
    buscarCliente();
  }
}

// Buscar cliente por RUT
window.buscarCliente = async function() {
  const input = document.getElementById("rutCliente");
  const rut = input.value.trim();

  if (!rut) {
    mostrarAlerta("info", "⚠️ Por favor, ingresa un RUT");
    return;
  }

  // Limpiar y validar formato del RUT
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
    // Buscar con múltiples formatos posibles
    const rutLimpioEncoded = encodeURIComponent(rutLimpio);
    const rutFormatEncoded = encodeURIComponent(rut);
    
    // Buscar por RUT limpio (sin formato) O con formato
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
}

window.agregarProducto = function() {
  const container = document.getElementById("productosLista");
  const productoHTML = `
    <div class="producto-item">
      <div class="form-group" style="margin: 0;">
        <label>Producto</label>
        <select class="producto-select">
          <option value="">Seleccionar...</option>
          <option value="Polera">Polera</option>
          <option value="Polerón">Polerón</option>
          <option value="Parka">Parka</option>
          <option value="Falda">Falda</option>
          <option value="Bluza">Bluza</option>
          <option value="Pantalón">Pantalón</option>
          <option value="Jean">Jean</option>
          <option value="Buzo">Buzo</option>
          <option value="Abrigo">Abrigo</option>
          <option value="Polar">Polar</option>
          <option value="Suéter">Suéter</option>
          <option value="Chaleco">Chaleco</option>
          <option value="Vestido">Vestido</option>
          <option value="Short">Short</option>
          <option value="Ropa de cama">Ropa de cama</option>
          <option value="Otro">Otro</option>
        </select>
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

  if (!AIRTABLE_TOKEN || !BASE_ID) {
    mostrarAlerta("error", "❌ Error: Configuración no cargada. Recarga la página.");
    return;
  }

  const productosItems = document.querySelectorAll(".producto-item");
  const productos = [];
  let totalVenta = 0;

  for (let item of productosItems) {
    const select = item.querySelector(".producto-select");
    const precio = parseFloat(item.querySelector(".producto-precio").value) || 0;

    if (select.value && precio > 0) {
      productos.push(select.value);
      totalVenta += precio;
    }
  }

  if (productos.length === 0) {
    mostrarAlerta("error", "❌ Debes agregar al menos un producto con precio");
    return;
  }

  const descuentoPorcentaje = parseFloat(document.getElementById("descuento").value) || 0;
  const descuentoMonto = (totalVenta * descuentoPorcentaje) / 100;
  totalVenta = totalVenta - descuentoMonto;

  mostrarLoading(true);
  ocultarAlertas();

  try {
    const productosString = productos.join(", ");
    const ventaData = {
      fields: {
        Cliente: [clienteSeleccionado.id],
        Items: productosString,
        "Total de venta": Math.round(totalVenta),
      },
    };

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
  } catch (error) {
    mostrarLoading(false);
    mostrarAlerta("error", "❌ Error al registrar venta: " + error.message);
    console.error("Error:", error);
  }
}

window.limpiarFormulario = function() {
  document.getElementById("rutCliente").value = "";
  document.getElementById("descuento").value = "0";
  document.getElementById("clienteInfo").classList.remove("show");
  document.getElementById("clienteNoEncontrado").classList.remove("show");
  document.getElementById("productosContainer").style.display = "none";

  const container = document.getElementById("productosLista");
  container.innerHTML = `
    <div class="producto-item">
      <div class="form-group" style="margin: 0;">
        <label>Producto</label>
        <select class="producto-select">
          <option value="">Seleccionar...</option>
          <option value="Polera">Polera</option>
          <option value="Polerón">Polerón</option>
          <option value="Parka">Parka</option>
          <option value="Falda">Falda</option>
          <option value="Bluza">Bluza</option>
          <option value="Pantalón">Pantalón</option>
          <option value="Jean">Jean</option>
          <option value="Buzo">Buzo</option>
          <option value="Abrigo">Abrigo</option>
          <option value="Polar">Polar</option>
          <option value="Suéter">Suéter</option>
          <option value="Chaleco">Chaleco</option>
          <option value="Vestido">Vestido</option>
          <option value="Short">Short</option>
          <option value="Ropa de cama">Ropa de cama</option>
          <option value="Otro">Otro</option>
        </select>
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

  calcularTotal();
  clienteSeleccionado = null;
  ocultarAlertas();
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