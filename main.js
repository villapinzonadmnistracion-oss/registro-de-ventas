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

// Función para buscar al presionar Enter
window.buscarClienteEnter = function(event) {
  if (event.key === "Enter") {
    event.preventDefault();
    buscarCliente();
  }
}

// Buscar cliente por RUT
window.buscarCliente = async function() {
  const rut = document.getElementById("rutCliente").value.trim();

  if (!rut) {
    mostrarAlerta("info", "⚠️ Por favor, ingresa un RUT");
    return;
  }

  if (!AIRTABLE_TOKEN || !BASE_ID) {
    mostrarAlerta("error", "❌ Error: Configuración no cargada. Recarga la página.");
    return;
  }

  mostrarLoading(true);
  ocultarAlertas();

  try {
    const rutEncoded = encodeURIComponent(rut);
    const url = `https://api.airtable.com/v0/${BASE_ID}/${CLIENTES_TABLE_ID}?filterByFormula={Rut.}='${rutEncoded}'`;

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