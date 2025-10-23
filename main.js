// Variables globales
let ventasData = [];
let clientesData = [];
let anfitrionesData = [];
let clientesMap = {};
let anfitrionesMap = {};
let todasLasTransacciones = [];
let filtroTransaccionActual = 'todas';

// Inicializar fechas (últimos 30 días por defecto)
function inicializarFechas() {
  const hoy = new Date();
  const hace30dias = new Date();
  hace30dias.setDate(hace30dias.getDate() - 30);
  
  document.getElementById('fechaHasta').valueAsDate = hoy;
  document.getElementById('fechaDesde').valueAsDate = hace30dias;
}

function cambiarPeriodoRapido() {
  const periodo = document.getElementById('filterPeriodo').value;
  if (!periodo) return;

  const hoy = new Date();
  const fechaHasta = document.getElementById('fechaHasta');
  const fechaDesde = document.getElementById('fechaDesde');
  
  fechaHasta.valueAsDate = hoy;

  switch(periodo) {
    case 'hoy':
      fechaDesde.valueAsDate = hoy;
      break;
    case '7dias':
      const hace7 = new Date();
      hace7.setDate(hace7.getDate() - 7);
      fechaDesde.valueAsDate = hace7;
      break;
    case '30dias':
      const hace30 = new Date();
      hace30.setDate(hace30.getDate() - 30);
      fechaDesde.valueAsDate = hace30;
      break;
    case 'mes':
      const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
      fechaDesde.valueAsDate = inicioMes;
      break;
    case 'year':
      const inicioAno = new Date(hoy.getFullYear(), 0, 1);
      fechaDesde.valueAsDate = inicioAno;
      break;
    case 'all':
      fechaDesde.value = '';
      fechaHasta.value = '';
      break;
  }
  
  aplicarFiltros();
}

async function cargarDatos() {
  try {
    document.getElementById('loading').style.display = 'block';
    document.getElementById('content').style.display = 'none';

    console.log('🔄 Cargando datos desde Airtable...');

    // Cargar todas las tablas en paralelo
    const [ventas, clientes, anfitriones] = await Promise.all([
      fetchFromProxy('tblC7aADITb6A6iYP'),  // VENTAS
      fetchFromProxy('tblfRI4vdXspaNNlD'),  // CLIENTES
      fetchFromProxy('tblrtLcB3dUASCfnL')   // ANFITRIONES
    ]);

    ventasData = ventas;
    clientesData = clientes;
    anfitrionesData = anfitriones;

    // Crear mapas para búsqueda rápida
    clientesMap = {};
    clientesData.forEach(c => {
      clientesMap[c.id] = c.fields;
    });

    anfitrionesMap = {};
    anfitrionesData.forEach(a => {
      anfitrionesMap[a.id] = a.fields;
    });

    console.log('✅ Ventas cargadas:', ventasData.length);
    console.log('✅ Clientes cargados:', clientesData.length);
    console.log('✅ Anfitriones cargados:', anfitrionesData.length);

    cargarAnfitrionesEnFiltro();
    aplicarFiltros();

    document.getElementById('loading').style.display = 'none';
    document.getElementById('content').style.display = 'block';

    const now = new Date();
    document.getElementById('lastUpdate').textContent = `Última actualización: ${now.toLocaleTimeString('es-CL')}`;
    document.getElementById('refreshTime').textContent = `Actualizado: ${now.toLocaleString('es-CL')}`;

  } catch (error) {
    console.error('❌ Error al cargar datos:', error);
    document.getElementById('loading').innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">❌</div>
        <p>Error al cargar datos: ${error.message}</p>
        <button onclick="cargarDatos()" style="margin-top: 20px; padding: 10px 20px; background: white; border: none; border-radius: 10px; cursor: pointer;">Reintentar</button>
      </div>
    `;
  }
}

async function fetchFromProxy(tableId) {
  try {
    // Las credenciales deben estar en variables de entorno del servidor
    const response = await fetch(`/api/airtable?action=getRecords&tableId=${tableId}`);
    
    if (!response.ok) {
      throw new Error(`Error ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.records || [];
  } catch (error) {
    console.error(`❌ Error fetching ${tableId}:`, error);
    throw error;
  }
}

function cargarAnfitrionesEnFiltro() {
  const select = document.getElementById('filterAnfitrion');
  select.innerHTML = '<option value="">Todos los anfitriones</option>';
  
  anfitrionesData.forEach(anfitrion => {
    const option = document.createElement('option');
    option.value = anfitrion.id;
    option.textContent = anfitrion.fields.Nombre || 'Sin nombre';
    select.appendChild(option);
  });
}

function aplicarFiltros() {
  const fechaDesde = document.getElementById('fechaDesde').value;
  const fechaHasta = document.getElementById('fechaHasta').value;
  const anfitrionId = document.getElementById('filterAnfitrion').value;

  let ventasFiltradas = [...ventasData];

  if (fechaDesde || fechaHasta) {
    ventasFiltradas = ventasFiltradas.filter(venta => {
      const fechaVenta = venta.fields['Fecha de compra'];
      if (!fechaVenta) return false;
      
      const fecha = new Date(fechaVenta);
      
      if (fechaDesde && fechaHasta) {
        return fecha >= new Date(fechaDesde) && fecha <= new Date(fechaHasta + 'T23:59:59');
      } else if (fechaDesde) {
        return fecha >= new Date(fechaDesde);
      } else if (fechaHasta) {
        return fecha <= new Date(fechaHasta + 'T23:59:59');
      }
      return true;
    });
  }

  if (anfitrionId) {
    ventasFiltradas = ventasFiltradas.filter(venta => {
      const anfitriones = venta.fields['Anfitrión'] || [];
      return anfitriones.includes(anfitrionId);
    });
  }

  console.log(`🔍 Ventas filtradas: ${ventasFiltradas.length} de ${ventasData.length}`);
  calcularEstadisticas(ventasFiltradas);
}

function calcularEstadisticas(ventas) {
  const ventasReales = ventas.filter(v => !v.fields['Devolución'] || v.fields['Devolución'].length === 0);
  const devoluciones = ventas.filter(v => v.fields['Devolución'] && v.fields['Devolución'].length > 0);

  const totalVentas = ventasReales.reduce((sum, v) => {
    const total = v.fields['Total Neto Numerico'] || v.fields['Total de venta'] || 0;
    return sum + total;
  }, 0);
  
  const numVentas = ventasReales.length;
  const promedioVenta = numVentas > 0 ? totalVentas / numVentas : 0;
  const tasaDevolucion = ventas.length > 0 ? (devoluciones.length / ventas.length * 100) : 0;

  document.getElementById('kpiTotalVentas').textContent = `${Math.round(totalVentas).toLocaleString('es-CL')}`;
  document.getElementById('kpiPromedioVenta').textContent = `${Math.round(promedioVenta).toLocaleString('es-CL')}`;
  document.getElementById('kpiNumVentas').textContent = ventas.length;
  document.getElementById('kpiTasaDevolucion').textContent = `${tasaDevolucion.toFixed(1)}%`;

  // NUEVO: Análisis de tendencias
  analizarTendencias(ventasReales);
  
  // NUEVO: Análisis predictivo
  analisisPredictivo(ventasReales);
  
  // NUEVO: Recomendaciones inteligentes
  recomendacionesInteligentes(ventasReales);
  
  // NUEVO: Análisis de horarios pico
  analisisHorariosPico(ventasReales);
  
  // NUEVO: Análisis de comportamiento de clientes
  analisisComportamientoClientes(ventasReales);
  
  // NUEVO: Inicializar asistente virtual
  inicializarAsistenteVirtual(ventasReales);

  mostrarTopAnfitriones(ventasReales);
  mostrarTopProductos(ventasReales);
  mostrarGraficoProductos(ventasReales);
  mostrarTopClientes(ventasReales);
  mostrarClasificacionClientes(ventasReales);
  
  todasLasTransacciones = ventas.slice(0, 50);
  filtrarTransacciones(filtroTransaccionActual);
}

function analizarTendencias(ventasActuales) {
  // Obtener período actual
  const fechaDesde = document.getElementById('fechaDesde').value;
  const fechaHasta = document.getElementById('fechaHasta').value;
  
  if (!fechaDesde || !fechaHasta) {
    document.getElementById('analisisTendencias').innerHTML = `
      <div class="tendencia-info">
        <div class="tendencia-icon">ℹ️</div>
        <div class="tendencia-text">
          Selecciona un rango de fechas para ver el análisis de tendencias
        </div>
      </div>
    `;
    return;
  }

  const inicioActual = new Date(fechaDesde);
  const finActual = new Date(fechaHasta);
  const diasPeriodoActual = Math.ceil((finActual - inicioActual) / (1000 * 60 * 60 * 24)) + 1;

  // Calcular período anterior (mismo número de días hacia atrás)
  const finAnterior = new Date(inicioActual);
  finAnterior.setDate(finAnterior.getDate() - 1);
  const inicioAnterior = new Date(finAnterior);
  inicioAnterior.setDate(inicioAnterior.getDate() - diasPeriodoActual + 1);

  // Filtrar ventas del período anterior
  const ventasAnteriores = ventasData.filter(venta => {
    if (venta.fields['Devolución'] && venta.fields['Devolución'].length > 0) return false;
    
    const fechaVenta = venta.fields['Fecha de compra'];
    if (!fechaVenta) return false;
    
    const fecha = new Date(fechaVenta);
    return fecha >= inicioAnterior && fecha <= finAnterior;
  });

  // Calcular métricas período actual
  const totalActual = ventasActuales.reduce((sum, v) => {
    return sum + (v.fields['Total Neto Numerico'] || v.fields['Total de venta'] || 0);
  }, 0);
  const numVentasActual = ventasActuales.length;
  const promedioActual = numVentasActual > 0 ? totalActual / numVentasActual : 0;

  // Calcular métricas período anterior
  const totalAnterior = ventasAnteriores.reduce((sum, v) => {
    return sum + (v.fields['Total Neto Numerico'] || v.fields['Total de venta'] || 0);
  }, 0);
  const numVentasAnterior = ventasAnteriores.length;
  const promedioAnterior = numVentasAnterior > 0 ? totalAnterior / numVentasAnterior : 0;

  // Calcular cambios porcentuales
  const cambioVentas = totalAnterior > 0 ? ((totalActual - totalAnterior) / totalAnterior * 100) : 0;
  const cambioNumero = numVentasAnterior > 0 ? ((numVentasActual - numVentasAnterior) / numVentasAnterior * 100) : 0;
  const cambioPromedio = promedioAnterior > 0 ? ((promedioActual - promedioAnterior) / promedioAnterior * 100) : 0;

  // Proyección simple (basada en tendencia actual)
  const ventasPorDia = totalActual / diasPeriodoActual;
  const proyeccion30dias = ventasPorDia * 30;

  // Generar análisis inteligente
  let analisisHTML = '<div class="tendencias-grid">';

  // Card 1: Comparación de ventas
  const iconoVentas = cambioVentas > 0 ? '📈' : cambioVentas < 0 ? '📉' : '➡️';
  const colorVentas = cambioVentas > 0 ? '#10b981' : cambioVentas < 0 ? '#ef4444' : '#6b7280';
  analisisHTML += `
    <div class="tendencia-card">
      <div class="tendencia-card-icon">${iconoVentas}</div>
      <div class="tendencia-card-valor" style="color: ${colorVentas}">
        ${cambioVentas > 0 ? '+' : ''}${cambioVentas.toFixed(1)}%
      </div>
      <div class="tendencia-card-label">vs período anterior</div>
      <div class="tendencia-card-detalle">
        ${Math.round(totalActual).toLocaleString('es-CL')} vs ${Math.round(totalAnterior).toLocaleString('es-CL')}
      </div>
    </div>
  `;

  // Card 2: Transacciones
  const iconoTransacciones = cambioNumero > 0 ? '🛍️' : cambioNumero < 0 ? '📦' : '🔄';
  const colorTransacciones = cambioNumero > 0 ? '#10b981' : cambioNumero < 0 ? '#ef4444' : '#6b7280';
  analisisHTML += `
    <div class="tendencia-card">
      <div class="tendencia-card-icon">${iconoTransacciones}</div>
      <div class="tendencia-card-valor" style="color: ${colorTransacciones}">
        ${cambioNumero > 0 ? '+' : ''}${cambioNumero.toFixed(1)}%
      </div>
      <div class="tendencia-card-label">Transacciones</div>
      <div class="tendencia-card-detalle">
        ${numVentasActual} vs ${numVentasAnterior} ventas
      </div>
    </div>
  `;

  // Card 3: Ticket promedio
  const iconoPromedio = cambioPromedio > 0 ? '💰' : cambioPromedio < 0 ? '💸' : '💵';
  const colorPromedio = cambioPromedio > 0 ? '#10b981' : cambioPromedio < 0 ? '#ef4444' : '#6b7280';
  analisisHTML += `
    <div class="tendencia-card">
      <div class="tendencia-card-icon">${iconoPromedio}</div>
      <div class="tendencia-card-valor" style="color: ${colorPromedio}">
        ${cambioPromedio > 0 ? '+' : ''}${cambioPromedio.toFixed(1)}%
      </div>
      <div class="tendencia-card-label">Ticket Promedio</div>
      <div class="tendencia-card-detalle">
        ${Math.round(promedioActual).toLocaleString('es-CL')} vs ${Math.round(promedioAnterior).toLocaleString('es-CL')}
      </div>
    </div>
  `;

  // Card 4: Proyección
  analisisHTML += `
    <div class="tendencia-card proyeccion">
      <div class="tendencia-card-icon">🔮</div>
      <div class="tendencia-card-valor" style="color: #8b5cf6">
        ${Math.round(proyeccion30dias).toLocaleString('es-CL')}
      </div>
      <div class="tendencia-card-label">Proyección 30 días</div>
      <div class="tendencia-card-detalle">
        Basado en ${Math.round(ventasPorDia).toLocaleString('es-CL')}/día
      </div>
    </div>
  `;

  analisisHTML += '</div>';

  // Insight textual inteligente
  let insightTexto = '';
  if (cambioVentas > 15) {
    insightTexto = `<strong style="color: #10b981;">¡Excelente rendimiento!</strong> Las ventas crecieron un ${cambioVentas.toFixed(1)}% respecto al período anterior. El negocio está en una tendencia muy positiva.`;
  } else if (cambioVentas > 5) {
    insightTexto = `<strong style="color: #10b981;">Crecimiento sólido.</strong> Las ventas aumentaron ${cambioVentas.toFixed(1)}%. Mantén el impulso con estrategias que han funcionado.`;
  } else if (cambioVentas > -5) {
    insightTexto = `<strong style="color: #6b7280;">Ventas estables.</strong> Los resultados son similares al período anterior. Considera nuevas estrategias para impulsar el crecimiento.`;
  } else if (cambioVentas > -15) {
    insightTexto = `<strong style="color: #f59e0b;">Atención necesaria.</strong> Las ventas bajaron ${Math.abs(cambioVentas).toFixed(1)}%. Revisa qué factores pueden estar afectando el rendimiento.`;
  } else {
    insightTexto = `<strong style="color: #ef4444;">Alerta importante.</strong> Las ventas cayeron ${Math.abs(cambioVentas).toFixed(1)}%. Es momento de analizar y ajustar la estrategia urgentemente.`;
  }

  analisisHTML += `
    <div class="tendencia-insight">
      <div class="tendencia-insight-icon">💡</div>
      <div class="tendencia-insight-text">${insightTexto}</div>
    </div>
  `;

  // Formatear fechas para mostrar
  const formatoFecha = { day: 'numeric', month: 'short' };
  const periodoActualTexto = `${inicioActual.toLocaleDateString('es-CL', formatoFecha)} - ${finActual.toLocaleDateString('es-CL', formatoFecha)}`;
  const periodoAnteriorTexto = `${inicioAnterior.toLocaleDateString('es-CL', formatoFecha)} - ${finAnterior.toLocaleDateString('es-CL', formatoFecha)}`;

  analisisHTML += `
    <div class="tendencia-periodos">
      <div class="periodo-info">
        <span class="periodo-label">Período actual:</span>
        <span class="periodo-valor">${periodoActualTexto} (${diasPeriodoActual} días)</span>
      </div>
      <div class="periodo-info">
        <span class="periodo-label">Período anterior:</span>
        <span class="periodo-valor">${periodoAnteriorTexto} (${diasPeriodoActual} días)</span>
      </div>
    </div>
  `;

  document.getElementById('analisisTendencias').innerHTML = analisisHTML;
}

function analisisPredictivo(ventasActuales) {
  const fechaDesde = document.getElementById('fechaDesde').value;
  const fechaHasta = document.getElementById('fechaHasta').value;
  
  if (!fechaDesde || !fechaHasta) {
    document.getElementById('analisisPredictivo').innerHTML = `
      <div class="tendencia-info">
        <div class="tendencia-icon">ℹ️</div>
        <div class="tendencia-text">
          Selecciona un rango de fechas para ver predicciones
        </div>
      </div>
    `;
    return;
  }

  const inicioActual = new Date(fechaDesde);
  const finActual = new Date(fechaHasta);
  const diasTranscurridos = Math.ceil((finActual - inicioActual) / (1000 * 60 * 60 * 24)) + 1;

  // Calcular totales actuales
  const totalVentas = ventasActuales.reduce((sum, v) => {
    return sum + (v.fields['Total Neto Numerico'] || v.fields['Total de venta'] || 0);
  }, 0);
  const numVentas = ventasActuales.length;
  const ventasPorDia = totalVentas / diasTranscurridos;
  const transaccionesPorDia = numVentas / diasTranscurridos;

  // Calcular últimos 7 días vs primeros 7 días (aceleración/desaceleración)
  const ventasPor7Dias = [];
  let currentDate = new Date(inicioActual);
  while (currentDate <= finActual) {
    const endWeek = new Date(currentDate);
    endWeek.setDate(endWeek.getDate() + 6);
    
    const ventasSemana = ventasActuales.filter(v => {
      const fecha = new Date(v.fields['Fecha de compra']);
      return fecha >= currentDate && fecha <= endWeek;
    });
    
    const totalSemana = ventasSemana.reduce((sum, v) => {
      return sum + (v.fields['Total Neto Numerico'] || v.fields['Total de venta'] || 0);
    }, 0);
    
    ventasPor7Dias.push(totalSemana);
    currentDate.setDate(currentDate.getDate() + 7);
  }

  // Calcular tendencia (regresión lineal simple)
  let tendencia = 0;
  if (ventasPor7Dias.length >= 2) {
    const primera = ventasPor7Dias[0];
    const ultima = ventasPor7Dias[ventasPor7Dias.length - 1];
    tendencia = ((ultima - primera) / primera) * 100;
  }

  // Proyecciones
  const hoy = new Date();
  const finMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
  const diasRestantesMes = Math.ceil((finMes - hoy) / (1000 * 60 * 60 * 24));
  
  // Ajustar proyección según tendencia
  const factorTendencia = 1 + (tendencia / 100);
  const ventasAjustadasPorDia = ventasPorDia * factorTendencia;
  
  const proyeccionFinMes = ventasAjustadasPorDia * diasRestantesMes;
  const proyeccionProximoMes = ventasAjustadasPorDia * 30;
  const proyeccionProximos3Meses = ventasAjustadasPorDia * 90;

  // Analizar productos para detectar stock bajo
  const productosCount = {};
  const productosPorSemana = {};
  
  ventasActuales.forEach(venta => {
    const semana = Math.floor((new Date(venta.fields['Fecha de compra']) - inicioActual) / (1000 * 60 * 60 * 24 * 7));
    
    Object.keys(venta.fields).forEach(campo => {
      if (campo.startsWith('Cantidad real de ventas')) {
        const cantidad = parseInt(venta.fields[campo]) || 0;
        if (cantidad > 0) {
          const producto = campo.replace('Cantidad real de ventas ', '').trim();
          productosCount[producto] = (productosCount[producto] || 0) + cantidad;
          
          if (!productosPorSemana[producto]) {
            productosPorSemana[producto] = [];
          }
          productosPorSemana[producto].push({ semana, cantidad });
        }
      }
    });
  });

  // Detectar productos con alta rotación (posible agotamiento)
  const productosAltoRiesgo = [];
  Object.entries(productosCount).forEach(([producto, total]) => {
    const ventasPorDia = total / diasTranscurridos;
    const diasParaAgotar = 30; // Asumimos stock de 30 días
    const stockEstimado = ventasPorDia * diasParaAgotar;
    
    if (ventasPorDia > 1) { // Más de 1 unidad por día
      const diasRestantes = Math.ceil(stockEstimado / ventasPorDia);
      productosAltoRiesgo.push({
        producto,
        ventasDiarias: ventasPorDia,
        diasRestantes
      });
    }
  });

  productosAltoRiesgo.sort((a, b) => a.diasRestantes - b.diasRestantes);

  // HTML del análisis predictivo
  let html = '<div class="prediccion-grid">';

  // Card: Proyección fin de mes
  const iconoMes = tendencia > 0 ? '📈' : tendencia < 0 ? '📉' : '➡️';
  html += `
    <div class="prediccion-card">
      <div class="prediccion-icon">${iconoMes}</div>
      <div class="prediccion-label">Fin de este mes</div>
      <div class="prediccion-valor">${Math.round(proyeccionFinMes).toLocaleString('es-CL')}</div>
      <div class="prediccion-detalle">En ${diasRestantesMes} días más</div>
    </div>
  `;

  // Card: Próximo mes completo
  html += `
    <div class="prediccion-card">
      <div class="prediccion-icon">📅</div>
      <div class="prediccion-label">Próximo mes</div>
      <div class="prediccion-valor">${Math.round(proyeccionProximoMes).toLocaleString('es-CL')}</div>
      <div class="prediccion-detalle">30 días siguientes</div>
    </div>
  `;

  // Card: Próximos 3 meses
  html += `
    <div class="prediccion-card trimestral">
      <div class="prediccion-icon">🎯</div>
      <div class="prediccion-label">Próximos 3 meses</div>
      <div class="prediccion-valor">${Math.round(proyeccionProximos3Meses).toLocaleString('es-CL')}</div>
      <div class="prediccion-detalle">Proyección trimestral</div>
    </div>
  `;

  // Card: Tendencia actual
  const colorTendencia = tendencia > 0 ? '#10b981' : tendencia < 0 ? '#ef4444' : '#6b7280';
  const textoTendencia = tendencia > 5 ? 'Acelerando' : tendencia < -5 ? 'Desacelerando' : 'Estable';
  html += `
    <div class="prediccion-card">
      <div class="prediccion-icon">📊</div>
      <div class="prediccion-label">Tendencia</div>
      <div class="prediccion-valor" style="color: ${colorTendencia}; font-size: 18px;">
        ${textoTendencia}
      </div>
      <div class="prediccion-detalle">${tendencia > 0 ? '+' : ''}${tendencia.toFixed(1)}% semanal</div>
    </div>
  `;

  html += '</div>';

  // Insight predictivo inteligente
  let insightTexto = '';
  if (tendencia > 10) {
    insightTexto = `🚀 <strong>Crecimiento acelerado.</strong> Las ventas están aumentando ${tendencia.toFixed(1)}% semana a semana. Si mantienes este ritmo, alcanzarás ${Math.round(proyeccionProximoMes).toLocaleString('es-CL')} el próximo mes. ¡Prepara más stock!`;
  } else if (tendencia > 0) {
    insightTexto = `📈 <strong>Crecimiento sostenido.</strong> Proyección de ${Math.round(proyeccionProximoMes).toLocaleString('es-CL')} para el próximo mes. Mantén la estrategia actual.`;
  } else if (tendencia > -10) {
    insightTexto = `⚠️ <strong>Ventas desacelerando.</strong> Se proyecta ${Math.round(proyeccionProximoMes).toLocaleString('es-CL')} para el próximo mes. Considera implementar promociones o estrategias de reactivación.`;
  } else {
    insightTexto = `🚨 <strong>Alerta de desaceleración.</strong> Las ventas están cayendo ${Math.abs(tendencia).toFixed(1)}% semanal. Es urgente revisar y ajustar la estrategia comercial.`;
  }

  html += `
    <div class="prediccion-insight">
      <div class="prediccion-insight-text">${insightTexto}</div>
    </div>
  `;

  // Alertas de stock (productos de alta rotación)
  if (productosAltoRiesgo.length > 0) {
    html += `<div class="stock-alertas">`;
    html += `<div class="stock-titulo">⚠️ Alertas de Stock (Alta Rotación)</div>`;
    
    productosAltoRiesgo.slice(0, 3).forEach(item => {
      const colorAlerta = item.diasRestantes < 10 ? '#ef4444' : item.diasRestantes < 20 ? '#f59e0b' : '#10b981';
      const nivelAlerta = item.diasRestantes < 10 ? 'Crítico' : item.diasRestantes < 20 ? 'Bajo' : 'Normal';
      
      html += `
        <div class="stock-item">
          <div class="stock-info">
            <div class="stock-nombre">${item.producto}</div>
            <div class="stock-detalle">${item.ventasDiarias.toFixed(1)} unidades/día</div>
          </div>
          <div class="stock-badge" style="background: ${colorAlerta}">
            ${nivelAlerta}
          </div>
        </div>
      `;
    });
    
    html += `</div>`;
  }

  // Nota metodológica
  html += `
    <div class="prediccion-nota">
      <strong>📋 Metodología:</strong> Proyecciones basadas en promedio de ventas diarias ajustado por tendencia semanal. 
      Precisión mayor con períodos más largos de datos históricos.
    </div>
  `;

  document.getElementById('analisisPredictivo').innerHTML = html;
}

function recomendacionesInteligentes(ventasActuales) {
  if (ventasActuales.length === 0) {
    document.getElementById('recomendacionesInteligentes').innerHTML = `
      <div class="tendencia-info">
        <div class="tendencia-icon">ℹ️</div>
        <div class="tendencia-text">No hay suficientes datos para generar recomendaciones</div>
      </div>
    `;
    return;
  }

  const recomendaciones = [];

  // ANÁLISIS 1: Productos con baja rotación
  const productosCount = {};
  const productosIngresos = {};
  
  ventasActuales.forEach(venta => {
    Object.keys(venta.fields).forEach(campo => {
      if (campo.startsWith('Cantidad real de ventas')) {
        const cantidad = parseInt(venta.fields[campo]) || 0;
        if (cantidad > 0) {
          const producto = campo.replace('Cantidad real de ventas ', '').trim();
          productosCount[producto] = (productosCount[producto] || 0) + cantidad;
          
          // Estimar ingresos por producto (usamos promedio general)
          const total = venta.fields['Total Neto Numerico'] || venta.fields['Total de venta'] || 0;
          productosIngresos[producto] = (productosIngresos[producto] || 0) + total;
        }
      }
    });
  });

  const productosArray = Object.entries(productosCount).sort((a, b) => b[1] - a[1]);
  
  if (productosArray.length >= 2) {
    const totalUnidades = Object.values(productosCount).reduce((a, b) => a + b, 0);
    const productoMenosVendido = productosArray[productosArray.length - 1];
    const porcentajeParticipacion = (productoMenosVendido[1] / totalUnidades * 100).toFixed(1);
    
    if (porcentajeParticipacion < 10) {
      recomendaciones.push({
        tipo: 'warning',
        icono: '📦',
        titulo: 'Producto de Baja Rotación',
        mensaje: `<strong>${productoMenosVendido[0]}</strong> solo representa el ${porcentajeParticipacion}% de las ventas con ${productoMenosVendido[1]} unidades vendidas.`,
        accion: 'Considera: Promoción 2x1, descuento especial, o combo con productos populares.'
      });
    }
  }

  // ANÁLISIS 2: Mejores días de la semana
  const ventasPorDia = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  const transaccionesPorDia = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  
  ventasActuales.forEach(venta => {
    const fecha = new Date(venta.fields['Fecha de compra']);
    const dia = fecha.getDay();
    const total = venta.fields['Total Neto Numerico'] || venta.fields['Total de venta'] || 0;
    
    ventasPorDia[dia] += total;
    transaccionesPorDia[dia] += 1;
  });

  const mejorDia = Object.entries(ventasPorDia).sort((a, b) => b[1] - a[1])[0];
  const peorDia = Object.entries(ventasPorDia).sort((a, b) => a[1] - b[1])[0];
  
  if (mejorDia[1] > 0) {
    const nombreMejorDia = diasSemana[mejorDia[0]];
    const nombrePeorDia = diasSemana[peorDia[0]];
    const porcentajeMejor = (mejorDia[1] / Object.values(ventasPorDia).reduce((a,b) => a+b, 0) * 100).toFixed(1);
    
    recomendaciones.push({
      tipo: 'success',
      icono: '📅',
      titulo: 'Mejor Día para Vender',
      mensaje: `<strong>${nombreMejorDia}</strong> es tu día estrella con ${Math.round(mejorDia[1]).toLocaleString('es-CL')} (${porcentajeMejor}% del total).`,
      accion: `Programa más anfitriones los ${nombreMejorDia}s. Evita eventos importantes los ${nombrePeorDia}s.`
    });
  }

  // ANÁLISIS 3: Mejores horarios
  const ventasPorHora = {};
  
  ventasActuales.forEach(venta => {
    const fecha = new Date(venta.fields['Fecha de compra']);
    const hora = fecha.getHours();
    const total = venta.fields['Total Neto Numerico'] || venta.fields['Total de venta'] || 0;
    
    if (!ventasPorHora[hora]) {
      ventasPorHora[hora] = { total: 0, cantidad: 0 };
    }
    ventasPorHora[hora].total += total;
    ventasPorHora[hora].cantidad += 1;
  });

  if (Object.keys(ventasPorHora).length > 0) {
    const mejorHora = Object.entries(ventasPorHora).sort((a, b) => b[1].total - a[1].total)[0];
    const horaInicio = parseInt(mejorHora[0]);
    const horaFin = horaInicio + 1;
    
    recomendaciones.push({
      tipo: 'info',
      icono: '⏰',
      titulo: 'Horario Pico de Ventas',
      mensaje: `La franja de <strong>${horaInicio}:00 - ${horaFin}:00</strong> genera ${Math.round(mejorHora[1].total).toLocaleString('es-CL')} con ${mejorHora[1].cantidad} ventas.`,
      accion: 'Concentra tus esfuerzos comerciales en este horario. Agenda reuniones con anfitriones en estas horas.'
    });
  }

  // ANÁLISIS 4: Ticket promedio vs potencial
  const ticketPromedio = ventasActuales.reduce((sum, v) => {
    return sum + (v.fields['Total Neto Numerico'] || v.fields['Total de venta'] || 0);
  }, 0) / ventasActuales.length;

  const ventasOrdenadas = ventasActuales
    .map(v => v.fields['Total Neto Numerico'] || v.fields['Total de venta'] || 0)
    .sort((a, b) => b - a);
  
  const top20Pct = ventasOrdenadas.slice(0, Math.ceil(ventasOrdenadas.length * 0.2));
  const ticketTop20 = top20Pct.reduce((a, b) => a + b, 0) / top20Pct.length;
  
  const potencialCrecimiento = ((ticketTop20 - ticketPromedio) / ticketPromedio * 100).toFixed(1);
  
  if (potencialCrecimiento > 20) {
    recomendaciones.push({
      tipo: 'success',
      icono: '💰',
      titulo: 'Oportunidad de Crecimiento',
      mensaje: `Tu ticket promedio es ${Math.round(ticketPromedio).toLocaleString('es-CL')}, pero el top 20% alcanza ${Math.round(ticketTop20).toLocaleString('es-CL')}.`,
      accion: `Potencial de crecimiento del ${potencialCrecimiento}%. Implementa estrategias de up-selling y cross-selling.`
    });
  }

  // ANÁLISIS 5: Clientes inactivos (Gold/Premium sin compras recientes)
  const clientesEnVentas = new Set();
  ventasActuales.forEach(venta => {
    const clienteIds = venta.fields['Cliente'] || [];
    clienteIds.forEach(id => clientesEnVentas.add(id));
  });

  let clientesGoldPremium = 0;
  let clientesGoldPremiumActivos = 0;

  clientesData.forEach(cliente => {
    const cantidad = cliente.fields['Cantidad de unidades General x Cliente'] || 0;
    if (cantidad > 3) { // Gold o Premium
      clientesGoldPremium++;
      if (clientesEnVentas.has(cliente.id)) {
        clientesGoldPremiumActivos++;
      }
    }
  });

  const clientesInactivos = clientesGoldPremium - clientesGoldPremiumActivos;
  
  if (clientesInactivos > 0) {
    recomendaciones.push({
      tipo: 'warning',
      icono: '👑',
      titulo: 'Clientes Premium Inactivos',
      mensaje: `Tienes <strong>${clientesInactivos} clientes Gold/Premium</strong> sin compras en el período seleccionado.`,
      accion: 'Lanza una campaña de reactivación exclusiva: descuentos VIP, acceso anticipado a nuevos productos.'
    });
  }

  // ANÁLISIS 6: Anfitriones con bajo rendimiento
  const anfitrionesStats = {};
  
  ventasActuales.forEach(venta => {
    const anfitrionesIds = venta.fields['Anfitrión'] || [];
    const total = venta.fields['Total Neto Numerico'] || venta.fields['Total de venta'] || 0;
    
    anfitrionesIds.forEach(id => {
      if (!anfitrionesStats[id]) {
        anfitrionesStats[id] = { total: 0, cantidad: 0 };
      }
      anfitrionesStats[id].total += total;
      anfitrionesStats[id].cantidad += 1;
    });
  });

  if (Object.keys(anfitrionesStats).length >= 3) {
    const anfitrionesArray = Object.entries(anfitrionesStats).sort((a, b) => b[1].total - a[1].total);
    const promedioVentasAnfitrion = anfitrionesArray.reduce((sum, [_, stats]) => sum + stats.total, 0) / anfitrionesArray.length;
    
    const anfitrionesDebajo = anfitrionesArray.filter(([_, stats]) => stats.total < promedioVentasAnfitrion * 0.5);
    
    if (anfitrionesDebajo.length > 0) {
      recomendaciones.push({
        tipo: 'info',
        icono: '📊',
        titulo: 'Anfitriones por Debajo del Promedio',
        mensaje: `${anfitrionesDebajo.length} anfitrion${anfitrionesDebajo.length > 1 ? 'es están' : ' está'} generando menos del 50% del promedio.`,
        accion: 'Ofrece capacitación, tips de ventas, o incentivos para mejorar su rendimiento.'
      });
    }
  }

  // ANÁLISIS 7: Tasa de devolución alta
  const totalVentas = ventasData.filter(v => !v.fields['Devolución'] || v.fields['Devolución'].length === 0).length;
  const totalDevoluciones = ventasData.filter(v => v.fields['Devolución'] && v.fields['Devolución'].length > 0).length;
  const tasaDevolucion = totalVentas > 0 ? (totalDevoluciones / (totalVentas + totalDevoluciones) * 100) : 0;
  
  if (tasaDevolucion > 10) {
    recomendaciones.push({
      tipo: 'warning',
      icono: '↩️',
      titulo: 'Tasa de Devolución Elevada',
      mensaje: `La tasa de devolución es del <strong>${tasaDevolucion.toFixed(1)}%</strong>, superior al óptimo (5-8%).`,
      accion: 'Revisa calidad de productos, expectativas del cliente, y proceso de venta. Mejora descripciones y fotos.'
    });
  }

  // Renderizar recomendaciones
  if (recomendaciones.length === 0) {
    document.getElementById('recomendacionesInteligentes').innerHTML = `
      <div class="recomendacion-card excelente">
        <div class="recomendacion-icono">🎉</div>
        <div class="recomendacion-content">
          <div class="recomendacion-titulo">¡Todo va excelente!</div>
          <div class="recomendacion-mensaje">No hay recomendaciones urgentes. Tu operación está optimizada.</div>
        </div>
      </div>
    `;
    return;
  }

  const html = recomendaciones.map(rec => {
    const colorClase = rec.tipo === 'success' ? 'success' : rec.tipo === 'warning' ? 'warning' : 'info';
    return `
      <div class="recomendacion-card ${colorClase}">
        <div class="recomendacion-icono">${rec.icono}</div>
        <div class="recomendacion-content">
          <div class="recomendacion-titulo">${rec.titulo}</div>
          <div class="recomendacion-mensaje">${rec.mensaje}</div>
          <div class="recomendacion-accion">💡 <strong>Recomendación:</strong> ${rec.accion}</div>
        </div>
      </div>
    `;
  }).join('');

  document.getElementById('recomendacionesInteligentes').innerHTML = html;
}

function analisisHorariosPico(ventasActuales) {
  if (ventasActuales.length === 0) {
    document.getElementById('analisisHorarios').innerHTML = `
      <div class="tendencia-info">
        <div class="tendencia-icon">ℹ️</div>
        <div class="tendencia-text">No hay datos suficientes para analizar horarios</div>
      </div>
    `;
    return;
  }

  // Matriz de ventas por día y hora
  const ventasPorDiaHora = {};
  const diasSemana = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  
  // Inicializar matriz
  for (let dia = 0; dia < 7; dia++) {
    ventasPorDiaHora[dia] = {};
    for (let hora = 0; hora < 24; hora++) {
      ventasPorDiaHora[dia][hora] = { total: 0, cantidad: 0 };
    }
  }

  // Llenar matriz con datos reales
  ventasActuales.forEach(venta => {
    const fecha = new Date(venta.fields['Fecha de compra']);
    const dia = fecha.getDay();
    const hora = fecha.getHours();
    const total = venta.fields['Total Neto Numerico'] || venta.fields['Total de venta'] || 0;
    
    ventasPorDiaHora[dia][hora].total += total;
    ventasPorDiaHora[dia][hora].cantidad += 1;
  });

  // Encontrar máximo para escalar colores
  let maxVentas = 0;
  let maxTransacciones = 0;
  for (let dia = 0; dia < 7; dia++) {
    for (let hora = 0; hora < 24; hora++) {
      if (ventasPorDiaHora[dia][hora].total > maxVentas) {
        maxVentas = ventasPorDiaHora[dia][hora].total;
      }
      if (ventasPorDiaHora[dia][hora].cantidad > maxTransacciones) {
        maxTransacciones = ventasPorDiaHora[dia][hora].cantidad;
      }
    }
  }

  // Encontrar top 3 horarios
  const todosLosHorarios = [];
  for (let dia = 0; dia < 7; dia++) {
    for (let hora = 0; hora < 24; hora++) {
      if (ventasPorDiaHora[dia][hora].cantidad > 0) {
        todosLosHorarios.push({
          dia,
          hora,
          total: ventasPorDiaHora[dia][hora].total,
          cantidad: ventasPorDiaHora[dia][hora].cantidad
        });
      }
    }
  }
  todosLosHorarios.sort((a, b) => b.total - a.total);
  const top3Horarios = todosLosHorarios.slice(0, 3);

  // Análisis por día de la semana
  const ventasPorDia = {};
  for (let dia = 0; dia < 7; dia++) {
    ventasPorDia[dia] = { total: 0, cantidad: 0 };
    for (let hora = 0; hora < 24; hora++) {
      ventasPorDia[dia].total += ventasPorDiaHora[dia][hora].total;
      ventasPorDia[dia].cantidad += ventasPorDiaHora[dia][hora].cantidad;
    }
  }

  const diasOrdenados = Object.entries(ventasPorDia).sort((a, b) => b[1].total - a[1].total);
  const mejorDia = diasOrdenados[0];
  const peorDia = diasOrdenados[diasOrdenados.length - 1];

  // Análisis por franja horaria (mañana, tarde, noche)
  const franjas = {
    manana: { nombre: 'Mañana (6-12)', total: 0, cantidad: 0, horas: [6,7,8,9,10,11] },
    tarde: { nombre: 'Tarde (12-18)', total: 0, cantidad: 0, horas: [12,13,14,15,16,17] },
    noche: { nombre: 'Noche (18-24)', total: 0, cantidad: 0, horas: [18,19,20,21,22,23] },
    madrugada: { nombre: 'Madrugada (0-6)', total: 0, cantidad: 0, horas: [0,1,2,3,4,5] }
  };

  Object.entries(franjas).forEach(([key, franja]) => {
    for (let dia = 0; dia < 7; dia++) {
      franja.horas.forEach(hora => {
        franjas[key].total += ventasPorDiaHora[dia][hora].total;
        franjas[key].cantidad += ventasPorDiaHora[dia][hora].cantidad;
      });
    }
  });

  const franjasOrdenadas = Object.entries(franjas).sort((a, b) => b[1].total - a[1].total);
  const mejorFranja = franjasOrdenadas[0];

  // Generar HTML
  let html = '';

  // Cards de resumen
  html += '<div class="horarios-resumen">';
  
  html += `
    <div class="horario-card best">
      <div class="horario-card-icon">📅</div>
      <div class="horario-card-label">Mejor Día</div>
      <div class="horario-card-valor">${diasSemana[mejorDia[0]]}</div>
      <div class="horario-card-detalle">
        ${mejorDia[1].cantidad} ventas<br>
        ${Math.round(mejorDia[1].total).toLocaleString('es-CL')}
      </div>
    </div>
  `;

  html += `
    <div class="horario-card">
      <div class="horario-card-icon">⏰</div>
      <div class="horario-card-label">Mejor Franja</div>
      <div class="horario-card-valor">${mejorFranja[1].nombre.split(' ')[0]}</div>
      <div class="horario-card-detalle">
        ${mejorFranja[1].cantidad} ventas<br>
        ${Math.round(mejorFranja[1].total).toLocaleString('es-CL')}
      </div>
    </div>
  `;

  html += '</div>';

  // Top 3 horarios específicos
  if (top3Horarios.length > 0) {
    html += '<div class="top-horarios">';
    html += '<div class="top-horarios-titulo">🏆 Top 3 Horarios Más Productivos</div>';
    
    const medallas = ['🥇', '🥈', '🥉'];
    top3Horarios.forEach((horario, index) => {
      html += `
        <div class="top-horario-item">
          <span class="horario-medalla">${medallas[index]}</span>
          <div class="horario-info">
            <div class="horario-nombre">${diasSemana[horario.dia]} ${horario.hora}:00-${horario.hora + 1}:00</div>
            <div class="horario-stats">${horario.cantidad} ventas • ${Math.round(horario.total).toLocaleString('es-CL')}</div>
          </div>
        </div>
      `;
    });
    
    html += '</div>';
  }

  // Mapa de calor por día de la semana
  html += '<div class="heatmap-container">';
  html += '<div class="heatmap-titulo">📊 Mapa de Calor: Ventas por Día</div>';
  html += '<div class="heatmap-dias">';
  
  diasOrdenados.forEach(([dia, stats]) => {
    const porcentaje = maxVentas > 0 ? (stats.total / maxVentas * 100) : 0;
    const intensidad = Math.min(100, porcentaje);
    
    // Escala de verde: más oscuro = más ventas
    const verde = Math.round(185 - (intensidad * 0.75)); // De 185 a 45
    const color = `rgb(16, ${verde}, 129)`;
    
    html += `
      <div class="dia-bar">
        <div class="dia-label">${diasSemana[dia]}</div>
        <div class="dia-bar-container">
          <div class="dia-bar-fill" style="width: ${intensidad}%; background: ${color}">
            <span class="dia-bar-text">${stats.cantidad}</span>
          </div>
        </div>
        <div class="dia-monto">${Math.round(stats.total / 1000).toLocaleString('es-CL')}k</div>
      </div>
    `;
  });
  
  html += '</div>';
  html += '</div>';

  // Gráfico de franjas horarias
  html += '<div class="franjas-container">';
  html += '<div class="franjas-titulo">🕐 Distribución por Franja Horaria</div>';
  
  const totalFranjas = Object.values(franjas).reduce((sum, f) => sum + f.total, 0);
  
  html += '<div class="franjas-bars">';
  franjasOrdenadas.forEach(([key, franja]) => {
    const porcentaje = totalFranjas > 0 ? (franja.total / totalFranjas * 100) : 0;
    const iconos = {
      manana: '🌅',
      tarde: '☀️',
      noche: '🌙',
      madrugada: '🌃'
    };
    
    html += `
      <div class="franja-item">
        <div class="franja-label">
          <span>${iconos[key]}</span>
          <span>${franja.nombre}</span>
        </div>
        <div class="franja-bar-container">
          <div class="franja-bar-fill" style="width: ${porcentaje}%"></div>
        </div>
        <div class="franja-stats">
          <span>${franja.cantidad} ventas</span>
          <span class="franja-monto">${Math.round(franja.total).toLocaleString('es-CL')}</span>
        </div>
      </div>
    `;
  });
  html += '</div>';
  html += '</div>';

  // Insight inteligente
  const porcentajeMejorDia = (mejorDia[1].total / Object.values(ventasPorDia).reduce((sum, d) => sum + d.total, 0) * 100).toFixed(1);
  
  html += `
    <div class="horarios-insight">
      <div class="horarios-insight-icon">💡</div>
      <div class="horarios-insight-text">
        <strong>${diasSemana[mejorDia[0]]}</strong> en la franja de <strong>${mejorFranja[1].nombre}</strong> 
        es tu momento óptimo, generando el ${porcentajeMejorDia}% de las ventas semanales. 
        ${peorDia[1].cantidad === 0 ? `Los ${diasSemana[peorDia[0]]}s no registran ventas.` : `Evita programar eventos importantes los ${diasSemana[peorDia[0]]}s.`}
      </div>
    </div>
  `;

  document.getElementById('analisisHorarios').innerHTML = html;
}

function analisisComportamientoClientes(ventasActuales) {
  if (ventasActuales.length === 0) {
    document.getElementById('comportamientoClientes').innerHTML = `
      <div class="tendencia-info">
        <div class="tendencia-icon">ℹ️</div>
        <div class="tendencia-text">No hay datos suficientes para analizar comportamiento</div>
      </div>
    `;
    return;
  }

  // Análisis por cliente
  const clientesData = {};
  
  ventasActuales.forEach(venta => {
    const clienteIds = venta.fields['Cliente'] || [];
    const nombreCliente = venta.fields['Nombre'] || 'Sin nombre';
    const total = venta.fields['Total Neto Numerico'] || venta.fields['Total de venta'] || 0;
    const fecha = new Date(venta.fields['Fecha de compra']);
    
    clienteIds.forEach(clienteId => {
      if (!clientesData[clienteId]) {
        clientesData[clienteId] = {
          nombre: nombreCliente,
          totalGastado: 0,
          compras: [],
          fechas: []
        };
      }
      
      clientesData[clienteId].totalGastado += total;
      clientesData[clienteId].compras.push(total);
      clientesData[clienteId].fechas.push(fecha);
    });
  });

  // Calcular métricas por cliente
  const clientesArray = Object.entries(clientesData).map(([id, data]) => {
    const compras = data.compras;
    const fechas = data.fechas.sort((a, b) => a - b);
    
    // Ticket promedio
    const ticketPromedio = data.totalGastado / compras.length;
    
    // Frecuencia (días entre compras)
    let frecuenciaPromedio = 0;
    if (fechas.length > 1) {
      let sumaIntervalos = 0;
      for (let i = 1; i < fechas.length; i++) {
        const dias = (fechas[i] - fechas[i-1]) / (1000 * 60 * 60 * 24);
        sumaIntervalos += dias;
      }
      frecuenciaPromedio = sumaIntervalos / (fechas.length - 1);
    }
    
    // Obtener clasificación
    const clienteInfo = clientesMap[id];
    const cantidadUnidades = clienteInfo?.['Cantidad de unidades General x Cliente'] || 0;
    let clasificacion = 'Normal';
    if (cantidadUnidades === 0) clasificacion = 'Normal';
    else if (cantidadUnidades <= 3) clasificacion = 'Frecuente';
    else if (cantidadUnidades <= 6) clasificacion = 'Gold';
    else clasificacion = 'Premium';
    
    return {
      id,
      nombre: data.nombre,
      totalGastado: data.totalGastado,
      numCompras: compras.length,
      ticketPromedio,
      frecuenciaPromedio,
      clasificacion,
      ultimaCompra: fechas[fechas.length - 1]
    };
  });

  // Estadísticas generales
  const totalClientes = clientesArray.length;
  const clientesRecurrentes = clientesArray.filter(c => c.numCompras > 1).length;
  const tasaRecurrencia = (clientesRecurrentes / totalClientes * 100).toFixed(1);
  
  const ticketPromedioGlobal = clientesArray.reduce((sum, c) => sum + c.ticketPromedio, 0) / totalClientes;
  
  // Clientes por clasificación
  const porClasificacion = {
    Premium: clientesArray.filter(c => c.clasificacion === 'Premium'),
    Gold: clientesArray.filter(c => c.clasificacion === 'Gold'),
    Frecuente: clientesArray.filter(c => c.clasificacion === 'Frecuente'),
    Normal: clientesArray.filter(c => c.clasificacion === 'Normal')
  };

  // Valor promedio por clasificación
  const valorPorClasificacion = {};
  Object.entries(porClasificacion).forEach(([tipo, clientes]) => {
    if (clientes.length > 0) {
      valorPorClasificacion[tipo] = clientes.reduce((sum, c) => sum + c.totalGastado, 0) / clientes.length;
    } else {
      valorPorClasificacion[tipo] = 0;
    }
  });

  // Top 5 clientes más valiosos
  const topClientes = clientesArray.sort((a, b) => b.totalGastado - a.totalGastado).slice(0, 5);

  // Análisis de frecuencia
  const clientesConFrecuencia = clientesArray.filter(c => c.frecuenciaPromedio > 0);
  const frecuenciaPromedio = clientesConFrecuencia.length > 0 
    ? clientesConFrecuencia.reduce((sum, c) => sum + c.frecuenciaPromedio, 0) / clientesConFrecuencia.length 
    : 0;

  // Generar HTML
  let html = '';

  // KPIs de clientes
  html += '<div class="clientes-kpis">';
  
  html += `
    <div class="cliente-kpi">
      <div class="cliente-kpi-icon">👥</div>
      <div class="cliente-kpi-valor">${totalClientes}</div>
      <div class="cliente-kpi-label">Clientes Activos</div>
    </div>
  `;

  html += `
    <div class="cliente-kpi success">
      <div class="cliente-kpi-icon">🔄</div>
      <div class="cliente-kpi-valor">${tasaRecurrencia}%</div>
      <div class="cliente-kpi-label">Tasa Recurrencia</div>
    </div>
  `;

  html += `
    <div class="cliente-kpi">
      <div class="cliente-kpi-icon">💰</div>
      <div class="cliente-kpi-valor">${Math.round(ticketPromedioGlobal).toLocaleString('es-CL')}</div>
      <div class="cliente-kpi-label">Ticket Promedio</div>
    </div>
  `;

  html += `
    <div class="cliente-kpi">
      <div class="cliente-kpi-icon">📅</div>
      <div class="cliente-kpi-valor">${Math.round(frecuenciaPromedio)}</div>
      <div class="cliente-kpi-label">Días entre compras</div>
    </div>
  `;

  html += '</div>';

  // Valor por clasificación
  html += '<div class="valor-clasificacion">';
  html += '<div class="valor-titulo">💎 Valor Promedio por Tipo de Cliente</div>';
  html += '<div class="valor-grid">';

  const clasificacionConfig = {
    Premium: { color: '#a855f7', icon: '💎' },
    Gold: { color: '#fbbf24', icon: '👑' },
    Frecuente: { color: '#10b981', icon: '⭐' },
    Normal: { color: '#6b7280', icon: '👤' }
  };

  Object.entries(valorPorClasificacion).forEach(([tipo, valor]) => {
    const config = clasificacionConfig[tipo];
    const cantidad = porClasificacion[tipo].length;
    
    html += `
      <div class="valor-card" style="border-color: ${config.color}">
        <div class="valor-card-icon">${config.icon}</div>
        <div class="valor-card-tipo" style="color: ${config.color}">${tipo}</div>
        <div class="valor-card-valor">${Math.round(valor).toLocaleString('es-CL')}</div>
        <div class="valor-card-cantidad">${cantidad} cliente${cantidad !== 1 ? 's' : ''}</div>
      </div>
    `;
  });

  html += '</div>';
  html += '</div>';

  // Top 5 clientes VIP
  html += '<div class="top-clientes-vip">';
  html += '<div class="vip-titulo">👑 Top 5 Clientes VIP</div>';

  topClientes.forEach((cliente, index) => {
    const iconosClasificacion = {
      Premium: '💎',
      Gold: '👑',
      Frecuente: '⭐',
      Normal: '👤'
    };
    
    const ultimaCompra = cliente.ultimaCompra.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });
    
    html += `
      <div class="vip-cliente">
        <div class="vip-ranking">#${index + 1}</div>
        <div class="vip-info">
          <div class="vip-nombre">
            ${iconosClasificacion[cliente.clasificacion]} ${cliente.nombre}
          </div>
          <div class="vip-stats">
            ${cliente.numCompras} compras • Última: ${ultimaCompra}
          </div>
        </div>
        <div class="vip-valor">
          <div class="vip-total">${Math.round(cliente.totalGastado).toLocaleString('es-CL')}</div>
          <div class="vip-promedio">${Math.round(cliente.ticketPromedio).toLocaleString('es-CL')}/compra</div>
        </div>
      </div>
    `;
  });

  html += '</div>';

  // Patrones de compra
  html += '<div class="patrones-compra">';
  html += '<div class="patrones-titulo">📊 Patrones de Compra</div>';

  // Análisis de compras múltiples vs únicas
  const comprasUnicas = clientesArray.filter(c => c.numCompras === 1).length;
  const comprasMultiples = clientesArray.filter(c => c.numCompras > 1).length;
  
  html += `
    <div class="patron-item">
      <div class="patron-label">
        <span class="patron-icon">🛍️</span>
        <span>Clientes de Compra Única</span>
      </div>
      <div class="patron-bar-container">
        <div class="patron-bar-fill unico" style="width: ${(comprasUnicas / totalClientes * 100)}%"></div>
      </div>
      <div class="patron-stats">
        <span>${comprasUnicas} clientes</span>
        <span class="patron-porcentaje">${(comprasUnicas / totalClientes * 100).toFixed(1)}%</span>
      </div>
    </div>
  `;

  html += `
    <div class="patron-item">
      <div class="patron-label">
        <span class="patron-icon">🔄</span>
        <span>Clientes Recurrentes</span>
      </div>
      <div class="patron-bar-container">
        <div class="patron-bar-fill recurrente" style="width: ${(comprasMultiples / totalClientes * 100)}%"></div>
      </div>
      <div class="patron-stats">
        <span>${comprasMultiples} clientes</span>
        <span class="patron-porcentaje">${(comprasMultiples / totalClientes * 100).toFixed(1)}%</span>
      </div>
    </div>
  `;

  // Distribución de ticket promedio
  const ticketBajo = clientesArray.filter(c => c.ticketPromedio < ticketPromedioGlobal * 0.7).length;
  const ticketMedio = clientesArray.filter(c => c.ticketPromedio >= ticketPromedioGlobal * 0.7 && c.ticketPromedio <= ticketPromedioGlobal * 1.3).length;
  const ticketAlto = clientesArray.filter(c => c.ticketPromedio > ticketPromedioGlobal * 1.3).length;

  html += `
    <div class="patron-item">
      <div class="patron-label">
        <span class="patron-icon">💸</span>
        <span>Ticket Bajo (< ${Math.round(ticketPromedioGlobal * 0.7).toLocaleString('es-CL')})</span>
      </div>
      <div class="patron-bar-container">
        <div class="patron-bar-fill bajo" style="width: ${(ticketBajo / totalClientes * 100)}%"></div>
      </div>
      <div class="patron-stats">
        <span>${ticketBajo} clientes</span>
        <span class="patron-porcentaje">${(ticketBajo / totalClientes * 100).toFixed(1)}%</span>
      </div>
    </div>
  `;

  html += `
    <div class="patron-item">
      <div class="patron-label">
        <span class="patron-icon">💰</span>
        <span>Ticket Alto (> ${Math.round(ticketPromedioGlobal * 1.3).toLocaleString('es-CL')})</span>
      </div>
      <div class="patron-bar-container">
        <div class="patron-bar-fill alto" style="width: ${(ticketAlto / totalClientes * 100)}%"></div>
      </div>
      <div class="patron-stats">
        <span>${ticketAlto} clientes</span>
        <span class="patron-porcentaje">${(ticketAlto / totalClientes * 100).toFixed(1)}%</span>
      </div>
    </div>
  `;

  html += '</div>';

  // Insight inteligente
  const clientePremiumMasValioso = porClasificacion.Premium.length > 0 
    ? Math.max(...porClasificacion.Premium.map(c => valorPorClasificacion.Premium))
    : 0;
  const clienteNormalMasValioso = porClasificacion.Normal.length > 0
    ? valorPorClasificacion.Normal
    : 0;
  
  const multiplicador = clienteNormalMasValioso > 0 
    ? (valorPorClasificacion.Premium / clienteNormalMasValioso).toFixed(1)
    : 0;

  let insightTexto = '';
  if (tasaRecurrencia > 40) {
    insightTexto = `🎉 <strong>Excelente fidelización.</strong> El ${tasaRecurrencia}% de tus clientes son recurrentes. `;
  } else if (tasaRecurrencia > 25) {
    insightTexto = `✅ <strong>Buena retención.</strong> El ${tasaRecurrencia}% de clientes repiten compras. `;
  } else {
    insightTexto = `⚠️ <strong>Oportunidad de mejora.</strong> Solo el ${tasaRecurrencia}% son recurrentes. `;
  }

  if (multiplicador > 1) {
    insightTexto += `Los clientes <strong>Premium generan ${multiplicador}x más valor</strong> que clientes normales. Enfoca esfuerzos en cultivar más clientes Premium.`;
  }

  html += `
    <div class="clientes-insight">
      <div class="clientes-insight-icon">💡</div>
      <div class="clientes-insight-text">${insightTexto}</div>
    </div>
  `;

  document.getElementById('comportamientoClientes').innerHTML = html;
}

// Variables globales para el asistente
let contextoDatos = null;

function inicializarAsistenteVirtual(ventasActuales) {
  // Preparar contexto con todos los datos procesados
  contextoDatos = prepararContextoDatos(ventasActuales);
  
  // Listener para input de chat
  const input = document.getElementById('chatInput');
  const sendBtn = document.getElementById('sendBtn');
  
  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      enviarMensajeAsistente();
    }
  });
  
  sendBtn.addEventListener('click', enviarMensajeAsistente);
  
  // Mensaje de bienvenida
  agregarMensajeAsistente(
    '👋 ¡Hola! Soy tu asistente inteligente de Punto Secreto. Puedo responder preguntas sobre ventas, clientes, productos y anfitriones. ¿En qué puedo ayudarte?',
    'asistente'
  );
}

function prepararContextoDatos(ventasActuales) {
  // Preparar resumen completo de datos
  const contexto = {
    ventas: ventasActuales,
    ventasData: ventasData,
    clientesMap: clientesMap,
    anfitrionesMap: anfitrionesMap
  };
  
  // Calcular estadísticas clave
  contexto.stats = {
    totalVentas: ventasActuales.reduce((sum, v) => sum + (v.fields['Total Neto Numerico'] || v.fields['Total de venta'] || 0), 0),
    numTransacciones: ventasActuales.length,
    ticketPromedio: 0,
    fechaDesde: document.getElementById('fechaDesde').value,
    fechaHasta: document.getElementById('fechaHasta').value
  };
  
  contexto.stats.ticketPromedio = contexto.stats.numTransacciones > 0 
    ? contexto.stats.totalVentas / contexto.stats.numTransacciones 
    : 0;
  
  // Productos
  contexto.productos = {};
  ventasActuales.forEach(venta => {
    Object.keys(venta.fields).forEach(campo => {
      if (campo.startsWith('Cantidad real de ventas')) {
        const cantidad = parseInt(venta.fields[campo]) || 0;
        if (cantidad > 0) {
          const producto = campo.replace('Cantidad real de ventas ', '').trim();
          contexto.productos[producto] = (contexto.productos[producto] || 0) + cantidad;
        }
      }
    });
  });
  
  // Anfitriones
  contexto.anfitriones = {};
  ventasActuales.forEach(venta => {
    const anfitrionesIds = venta.fields['Anfitrión'] || [];
    const total = venta.fields['Total Neto Numerico'] || venta.fields['Total de venta'] || 0;
    
    anfitrionesIds.forEach(id => {
      if (!contexto.anfitriones[id]) {
        const nombre = anfitrionesMap[id]?.Nombre || 'Desconocido';
        contexto.anfitriones[id] = { nombre, total: 0, ventas: 0 };
      }
      contexto.anfitriones[id].total += total;
      contexto.anfitriones[id].ventas += 1;
    });
  });
  
  // Clientes
  contexto.clientes = {};
  ventasActuales.forEach(venta => {
    const nombreCliente = venta.fields['Nombre'] || 'Sin nombre';
    const total = venta.fields['Total Neto Numerico'] || venta.fields['Total de venta'] || 0;
    
    if (!contexto.clientes[nombreCliente]) {
      contexto.clientes[nombreCliente] = { total: 0, compras: 0 };
    }
    contexto.clientes[nombreCliente].total += total;
    contexto.clientes[nombreCliente].compras += 1;
  });
  
  return contexto;
}

function enviarMensajeAsistente() {
  const input = document.getElementById('chatInput');
  const pregunta = input.value.trim();
  
  if (!pregunta) return;
  
  // Mostrar pregunta del usuario
  agregarMensajeAsistente(pregunta, 'usuario');
  input.value = '';
  
  // Procesar según modo
  if (modoActual === 'chatgpt') {
    // Mostrar indicador de escritura
    const typingId = agregarMensajeAsistente('✨ Pensando...', 'asistente');
    
    // Llamar a ChatGPT
    consultarChatGPT(pregunta, typingId);
  } else {
    // Modo local
    setTimeout(() => {
      const respuesta = procesarPregunta(pregunta);
      agregarMensajeAsistente(respuesta, 'asistente');
    }, 500);
  }
}

async function consultarChatGPT(pregunta, typingId) {
  try {
    // Preparar contexto con datos actuales
    const contextoResumen = `
Eres un asistente de análisis de ventas para Punto Secreto. Responde de forma concisa y profesional en español.

DATOS ACTUALES:
- Período: ${contextoDatos.stats.fechaDesde || 'inicio'} al ${contextoDatos.stats.fechaHasta || 'hoy'}
- Total ventas: ${Math.round(contextoDatos.stats.totalVentas).toLocaleString('es-CL')}
- Transacciones: ${contextoDatos.stats.numTransacciones}
- Ticket promedio: ${Math.round(contextoDatos.stats.ticketPromedio).toLocaleString('es-CL')}

PRODUCTOS MÁS VENDIDOS:
${Object.entries(contextoDatos.productos).sort((a,b) => b[1] - a[1]).slice(0, 5).map(([p, c]) => `- ${p}: ${c} unidades`).join('\n')}

TOP ANFITRIONES:
${Object.values(contextoDatos.anfitriones).sort((a,b) => b.total - a.total).slice(0, 3).map((a, i) => `${i+1}. ${a.nombre}: ${Math.round(a.total).toLocaleString('es-CL')}`).join('\n')}

TOP CLIENTES:
${Object.entries(contextoDatos.clientes).sort((a,b) => b[1].total - a[1].total).slice(0, 3).map(([n, d], i) => `${i+1}. ${n}: ${Math.round(d.total).toLocaleString('es-CL')}`).join('\n')}

Pregunta del usuario: ${pregunta}

Responde de forma breve (máximo 150 palabras), usando formato markdown con **negritas** para destacar números importantes. Usa emojis relevantes.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'Eres un asistente experto en análisis de ventas. Respondes de forma concisa, profesional y útil en español de Chile.'
          },
          {
            role: 'user',
            content: contextoResumen
          }
        ],
        max_tokens: 300,
        temperature: 0.7
      })
    });

    const data = await response.json();
    
    // Eliminar mensaje de "pensando"
    document.getElementById(typingId).remove();
    
    if (data.error) {
      agregarMensajeAsistente(
        '❌ Error al conectar con ChatGPT. Intenta con el modo Local o verifica la conexión.',
        'asistente'
      );
      return;
    }
    
    const respuesta = data.choices[0].message.content;
    agregarMensajeAsistente(respuesta, 'asistente');
    
  } catch (error) {
    console.error('Error ChatGPT:', error);
    document.getElementById(typingId).remove();
    agregarMensajeAsistente(
      '❌ No se pudo conectar con ChatGPT. Por favor intenta con el modo Local.',
      'asistente'
    );
  }
}

function procesarPregunta(pregunta) {
  const preguntaLower = pregunta.toLowerCase();
  
  // VENTAS TOTALES
  if (preguntaLower.match(/cuanto|cuánto|total|ventas|vendido|vendimos/)) {
    if (preguntaLower.match(/hoy|día|dia/)) {
      return `Hoy no tengo datos en tiempo real, pero en el período seleccionado las ventas totales son de **${Math.round(contextoDatos.stats.totalVentas).toLocaleString('es-CL')}** con ${contextoDatos.stats.numTransacciones} transacciones.`;
    }
    return `En el período seleccionado (${formatearFecha(contextoDatos.stats.fechaDesde)} al ${formatearFecha(contextoDatos.stats.fechaHasta)}), las ventas totales son de **${Math.round(contextoDatos.stats.totalVentas).toLocaleString('es-CL')}** con ${contextoDatos.stats.numTransacciones} transacciones. El ticket promedio es de ${Math.round(contextoDatos.stats.ticketPromedio).toLocaleString('es-CL')}.`;
  }
  
  // PRODUCTOS
  if (preguntaLower.match(/producto|productos|qué se vende|que se vende|más vendido|mas vendido/)) {
    const productosOrdenados = Object.entries(contextoDatos.productos).sort((a, b) => b[1] - a[1]);
    
    if (productosOrdenados.length === 0) {
      return 'No hay datos de productos en el período seleccionado.';
    }
    
    const top3 = productosOrdenados.slice(0, 3);
    let respuesta = '📦 **Top 3 Productos Más Vendidos:**\n\n';
    top3.forEach(([producto, cantidad], index) => {
      const emoji = ['🥇', '🥈', '🥉'][index];
      respuesta += `${emoji} **${producto}**: ${cantidad} unidades\n`;
    });
    
    const menosVendido = productosOrdenados[productosOrdenados.length - 1];
    respuesta += `\n⚠️ El producto con menos ventas es **${menosVendido[0]}** con ${menosVendido[1]} unidades.`;
    
    return respuesta;
  }
  
  // ANFITRIONES
  if (preguntaLower.match(/anfitrión|anfitrion|anfitriones|vendedor|vendedora|mejor anfitrión|mejor anfitrion/)) {
    const anfitrionesOrdenados = Object.values(contextoDatos.anfitriones).sort((a, b) => b.total - a.total);
    
    if (anfitrionesOrdenados.length === 0) {
      return 'No hay datos de anfitriones en el período seleccionado.';
    }
    
    const top3 = anfitrionesOrdenados.slice(0, 3);
    let respuesta = '🏆 **Top 3 Anfitriones:**\n\n';
    top3.forEach((anfitrion, index) => {
      const emoji = ['🥇', '🥈', '🥉'][index];
      respuesta += `${emoji} **${anfitrion.nombre}**: ${Math.round(anfitrion.total).toLocaleString('es-CL')} (${anfitrion.ventas} ventas)\n`;
    });
    
    return respuesta;
  }
  
  // CLIENTES
  if (preguntaLower.match(/cliente|clientes|comprador|compradores|mejor cliente|top cliente/)) {
    const clientesOrdenados = Object.entries(contextoDatos.clientes).sort((a, b) => b[1].total - a[1].total);
    
    if (clientesOrdenados.length === 0) {
      return 'No hay datos de clientes en el período seleccionado.';
    }
    
    const top5 = clientesOrdenados.slice(0, 5);
    let respuesta = '👑 **Top 5 Mejores Clientes:**\n\n';
    top5.forEach(([nombre, data], index) => {
      respuesta += `${index + 1}. **${nombre}**: ${Math.round(data.total).toLocaleString('es-CL')} (${data.compras} compras)\n`;
    });
    
    const totalClientes = clientesOrdenados.length;
    const clientesRecurrentes = clientesOrdenados.filter(([_, data]) => data.compras > 1).length;
    const tasaRecurrencia = (clientesRecurrentes / totalClientes * 100).toFixed(1);
    
    respuesta += `\n📊 Total de clientes: ${totalClientes} | Tasa de recurrencia: ${tasaRecurrencia}%`;
    
    return respuesta;
  }
  
  // PROMEDIO
  if (preguntaLower.match(/promedio|ticket promedio|precio promedio|media/)) {
    return `El ticket promedio en el período seleccionado es de **${Math.round(contextoDatos.stats.ticketPromedio).toLocaleString('es-CL')}**. Esto se calcula dividiendo las ventas totales (${Math.round(contextoDatos.stats.totalVentas).toLocaleString('es-CL')}) entre el número de transacciones (${contextoDatos.stats.numTransacciones}).`;
  }
  
  // BÚSQUEDA ESPECÍFICA DE ANFITRIÓN
  const matchAnfitrion = preguntaLower.match(/(?:cuánto|cuanto|ventas de|vendió|vendio)\s+([a-záéíóúñ\s]+)/i);
  if (matchAnfitrion) {
    const nombreBuscado = matchAnfitrion[1].trim();
    const anfitrion = Object.values(contextoDatos.anfitriones).find(a => 
      a.nombre.toLowerCase().includes(nombreBuscado)
    );
    
    if (anfitrion) {
      return `**${anfitrion.nombre}** ha generado **${Math.round(anfitrion.total).toLocaleString('es-CL')}** en ventas con **${anfitrion.ventas} transacciones** en el período seleccionado. Su ticket promedio es de ${Math.round(anfitrion.total / anfitrion.ventas).toLocaleString('es-CL')}.`;
    } else {
      return `No encontré información sobre "${nombreBuscado}". Los anfitriones disponibles son: ${Object.values(contextoDatos.anfitriones).map(a => a.nombre).join(', ')}.`;
    }
  }
  
  // COMPARACIONES
  if (preguntaLower.match(/comparar|compara|vs|versus|diferencia/)) {
    return 'Para comparar anfitriones o productos, prueba preguntas como: "¿Cuánto vendió María?" o "¿Cuáles son los productos más vendidos?"';
  }
  
  // AYUDA
  if (preguntaLower.match(/ayuda|help|qué puedes|que puedes|comandos|opciones/)) {
    return `🤖 **Puedo ayudarte con:**

📊 **Ventas**: "¿Cuánto vendimos?" "¿Cuál es el total de ventas?"
📦 **Productos**: "¿Cuál es el producto más vendido?" "¿Qué productos se venden?"
👥 **Anfitriones**: "¿Quién es el mejor anfitrión?" "¿Cuánto vendió María?"
🛍️ **Clientes**: "¿Quiénes son los mejores clientes?" "¿Cuántos clientes tenemos?"
💰 **Promedios**: "¿Cuál es el ticket promedio?"

Hazme cualquier pregunta sobre tus datos de ventas! 😊`;
  }
  
  // RESPUESTA GENERAL
  return `No estoy seguro de cómo responder eso. Puedo ayudarte con información sobre ventas, productos, anfitriones y clientes. Escribe "ayuda" para ver ejemplos de preguntas que puedo responder. 🤔`;
}

function agregarMensajeAsistente(mensaje, tipo) {
  const chatMessages = document.getElementById('chatMessages');
  const messageDiv = document.createElement('div');
  messageDiv.className = `chat-message ${tipo}`;
  
  // ID único para mensajes del asistente (para poder eliminarlos)
  if (tipo === 'asistente') {
    const id = 'msg-' + Date.now();
    messageDiv.id = id;
  }
  
  const avatar = document.createElement('div');
  avatar.className = 'chat-avatar';
  avatar.textContent = tipo === 'usuario' ? '👤' : '🤖';
  
  const bubble = document.createElement('div');
  bubble.className = 'chat-bubble';
  
  // Procesar markdown simple
  let mensajeHTML = mensaje
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');
  
  bubble.innerHTML = mensajeHTML;
  
  messageDiv.appendChild(avatar);
  messageDiv.appendChild(bubble);
  chatMessages.appendChild(messageDiv);
  
  // Scroll al final
  chatMessages.scrollTop = chatMessages.scrollHeight;
  
  // Retornar ID si es del asistente
  if (tipo === 'asistente') {
    return messageDiv.id;
  }
}

function formatearFecha(fecha) {
  if (!fecha) return 'inicio';
  const date = new Date(fecha);
  return date.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });
}

function mostrarTopAnfitriones(ventas) {
  const anfitrionesStats = {};

  ventas.forEach(venta => {
    const anfitrionesIds = venta.fields['Anfitrión'] || [];
    const total = venta.fields['Total Neto Numerico'] || venta.fields['Total de venta'] || 0;

    anfitrionesIds.forEach(id => {
      if (!anfitrionesStats[id]) {
        anfitrionesStats[id] = { total: 0, cantidad: 0, id: id };
      }
      anfitrionesStats[id].total += total;
      anfitrionesStats[id].cantidad += 1;
    });
  });

  const ranking = Object.values(anfitrionesStats)
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  const container = document.getElementById('rankingAnfitriones');
  if (ranking.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📭</div><p>No hay datos</p></div>';
    return;
  }

  const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
  container.innerHTML = ranking.map((anf, index) => {
    const anfitrionData = anfitrionesMap[anf.id];
    const nombre = anfitrionData?.Nombre || 
                   anfitrionData?.Name || 
                   anfitrionData?.['Nombre completo'] ||
                   'Desconocido';
    
    return `
      <div class="ranking-item">
        <div class="ranking-name">
          <span class="ranking-medal">${medals[index]}</span>
          <span>${nombre}</span>
        </div>
        <div class="ranking-value">$${Math.round(anf.total).toLocaleString('es-CL')}</div>
      </div>
    `;
  }).join('');
}

function mostrarTopProductos(ventas) {
  const productosCount = {};

  ventas.forEach(venta => {
    Object.keys(venta.fields).forEach(campo => {
      if (campo.startsWith('Cantidad real de ventas')) {
        const cantidad = parseInt(venta.fields[campo]) || 0;
        
        if (cantidad > 0) {
          const nombreProducto = campo.replace('Cantidad real de ventas ', '').trim();
          productosCount[nombreProducto] = (productosCount[nombreProducto] || 0) + cantidad;
        }
      }
    });
  });

  const ranking = Object.entries(productosCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const container = document.getElementById('topProductos');
  if (ranking.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📭</div><p>No hay productos registrados</p></div>';
    return;
  }

  const maxCantidad = ranking[0][1];
  container.innerHTML = ranking.map(([producto, cantidad]) => {
    const porcentaje = (cantidad / maxCantidad) * 100;
    return `
      <div class="product-bar">
        <div class="product-name">
          <span>${producto}</span>
          <span style="color: #10b981;">${cantidad} unid.</span>
        </div>
        <div class="bar-container">
          <div class="bar-fill" style="width: ${porcentaje}%"></div>
        </div>
      </div>
    `;
  }).join('');
}

function mostrarGraficoProductos(ventas) {
  const productosCount = {};
  const productosPorFecha = {}; // Para calcular frecuencia

  ventas.forEach(venta => {
    const fechaVenta = venta.fields['Fecha de compra'];
    
    Object.keys(venta.fields).forEach(campo => {
      if (campo.startsWith('Cantidad real de ventas')) {
        const cantidad = parseInt(venta.fields[campo]) || 0;
        
        if (cantidad > 0) {
          const nombreProducto = campo.replace('Cantidad real de ventas ', '').trim();
          productosCount[nombreProducto] = (productosCount[nombreProducto] || 0) + cantidad;
          
          // Registrar venta por fecha para calcular frecuencia
          if (fechaVenta) {
            if (!productosPorFecha[nombreProducto]) {
              productosPorFecha[nombreProducto] = [];
            }
            productosPorFecha[nombreProducto].push(new Date(fechaVenta));
          }
        }
      }
    });
  });

  const productosArray = Object.entries(productosCount).sort((a, b) => b[1] - a[1]);

  if (productosArray.length === 0) {
    document.getElementById('graficoProductos').innerHTML = 
      '<div class="empty-state"><div class="empty-state-icon">📭</div><p>No hay datos</p></div>';
    document.getElementById('notaInteligente').innerHTML = '';
    return;
  }

  // Calcular análisis inteligente
  const productoMasVendido = productosArray[0];
  const productoMenosVendido = productosArray[productosArray.length - 1];
  
  // Calcular frecuencia (días entre ventas promedio)
  let frecuenciaTexto = '';
  if (productosPorFecha[productoMasVendido[0]] && productosPorFecha[productoMasVendido[0]].length > 1) {
    const fechas = productosPorFecha[productoMasVendido[0]].sort((a, b) => a - b);
    let sumaIntervalos = 0;
    for (let i = 1; i < fechas.length; i++) {
      const dias = (fechas[i] - fechas[i-1]) / (1000 * 60 * 60 * 24);
      sumaIntervalos += dias;
    }
    const promedioDias = Math.round(sumaIntervalos / (fechas.length - 1));
    
    if (promedioDias < 1) {
      frecuenciaTexto = 'varias veces al día';
    } else if (promedioDias === 1) {
      frecuenciaTexto = 'diariamente';
    } else if (promedioDias <= 3) {
      frecuenciaTexto = `cada ${promedioDias} días`;
    } else if (promedioDias <= 7) {
      frecuenciaTexto = 'semanalmente';
    } else if (promedioDias <= 14) {
      frecuenciaTexto = 'cada 2 semanas';
    } else {
      frecuenciaTexto = `cada ${Math.round(promedioDias / 7)} semanas`;
    }
  } else {
    frecuenciaTexto = 'ocasionalmente';
  }

  // Obtener rango de fechas actual
  const fechaDesde = document.getElementById('fechaDesde').value;
  const fechaHasta = document.getElementById('fechaHasta').value;
  let periodoTexto = '';
  
  if (fechaDesde && fechaHasta) {
    const desde = new Date(fechaDesde).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });
    const hasta = new Date(fechaHasta).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });
    periodoTexto = `del ${desde} al ${hasta}`;
  } else if (fechaDesde) {
    const desde = new Date(fechaDesde).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' });
    periodoTexto = `desde el ${desde}`;
  } else if (fechaHasta) {
    const hasta = new Date(fechaHasta).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' });
    periodoTexto = `hasta el ${hasta}`;
  } else {
    periodoTexto = 'en el período seleccionado';
  }

  // Generar nota inteligente
  const notaHTML = `
    <div class="nota-inteligente">
      <div class="nota-icon">💡</div>
      <div class="nota-content">
        <div class="nota-title">Análisis Inteligente</div>
        <div class="nota-text">
          <strong style="color: #10b981;">${productoMasVendido[0]}</strong> es el producto más vendido 
          con <strong>${productoMasVendido[1]} unidades</strong> ${periodoTexto}. 
          Se vende aproximadamente <strong>${frecuenciaTexto}</strong>. 
          ${productosArray.length > 1 ? `Por otro lado, <strong style="color: #ef4444;">${productoMenosVendido[0]}</strong> 
          tiene el menor volumen con ${productoMenosVendido[1]} unidad${productoMenosVendido[1] > 1 ? 'es' : ''}.` : ''}
        </div>
      </div>
    </div>
  `;
  
  document.getElementById('notaInteligente').innerHTML = notaHTML;

  // Generar gráfico circular (pie chart) con Canvas
  const canvas = document.getElementById('chartCanvas');
  const ctx = canvas.getContext('2d');
  
  // Ajustar para alta resolución
  const dpr = window.devicePixelRatio || 1;
  const size = 280;
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  canvas.style.width = size + 'px';
  canvas.style.height = size + 'px';
  ctx.scale(dpr, dpr);

  const centerX = size / 2;
  const centerY = size / 2;
  const radius = 90;

  // Paleta de colores vibrante y variada (30 colores)
  const colores = [
    '#10b981', '#06b6d4', '#8b5cf6', '#ec4899', '#f59e0b',
    '#059669', '#0891b2', '#7c3aed', '#db2777', '#d97706',
    '#34d399', '#22d3ee', '#a78bfa', '#f472b6', '#fbbf24',
    '#6ee7b7', '#67e8f9', '#c4b5fd', '#f9a8d4', '#fcd34d',
    '#14b8a6', '#0284c7', '#6366f1', '#e11d48', '#ea580c',
    '#2dd4bf', '#38bdf8', '#818cf8', '#fb7185', '#fb923c',
    '#5eead4', '#7dd3fc', '#a5b4fc', '#fda4af', '#fdba74',
    '#99f6e4', '#bae6fd', '#c7d2fe', '#fecdd3', '#fed7aa'
  ];

  const total = productosArray.reduce((sum, [_, count]) => sum + count, 0);
  let currentAngle = -Math.PI / 2;

  // Dibujar segmentos
  productosArray.forEach(([nombre, cantidad], index) => {
    const sliceAngle = (cantidad / total) * 2 * Math.PI;
    
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
    ctx.closePath();
    ctx.fillStyle = colores[index % colores.length];
    ctx.fill();
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    ctx.stroke();

    currentAngle += sliceAngle;
  });

  // Círculo blanco central
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius * 0.5, 0, 2 * Math.PI);
  ctx.fillStyle = 'white';
  ctx.fill();

  // Texto central
  ctx.fillStyle = '#10b981';
  ctx.font = 'bold 20px -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(total, centerX, centerY - 8);
  ctx.font = '12px -apple-system, sans-serif';
  ctx.fillStyle = '#6b7280';
  ctx.fillText('unidades', centerX, centerY + 10);

  // Leyenda
  const leyendaHTML = productosArray.slice(0, 8).map(([nombre, cantidad], index) => {
    const porcentaje = ((cantidad / total) * 100).toFixed(1);
    return `
      <div class="leyenda-item">
        <div class="leyenda-color" style="background: ${colores[index % colores.length]}"></div>
        <div class="leyenda-info">
          <div class="leyenda-nombre">${nombre}</div>
          <div class="leyenda-valor">${cantidad} unid. (${porcentaje}%)</div>
        </div>
      </div>
    `;
  }).join('');

  document.getElementById('leyendaProductos').innerHTML = leyendaHTML;
}

function mostrarTopClientes(ventas) {
  const clientesStats = {};

  ventas.forEach(venta => {
    const nombreCliente = venta.fields['Nombre'] || 'Cliente desconocido';
    const total = venta.fields['Total Neto Numerico'] || venta.fields['Total de venta'] || 0;

    if (!clientesStats[nombreCliente]) {
      clientesStats[nombreCliente] = { total: 0, cantidad: 0, nombre: nombreCliente };
    }
    clientesStats[nombreCliente].total += total;
    clientesStats[nombreCliente].cantidad += 1;
  });

  const ranking = Object.values(clientesStats)
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  const container = document.getElementById('topClientes');
  if (ranking.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📭</div><p>No hay datos</p></div>';
    return;
  }

  const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
  container.innerHTML = ranking.map((cli, index) => {
    return `
      <div class="ranking-item">
        <div class="ranking-name">
          <span class="ranking-medal">${medals[index]}</span>
          <span>${cli.nombre}</span>
        </div>
        <div class="ranking-value">$${Math.round(cli.total).toLocaleString('es-CL')}</div>
      </div>
    `;
  }).join('');
}

function mostrarClasificacionClientes(ventas) {
  // Obtener IDs únicos de clientes de las ventas
  const clientesEnVentas = new Set();
  ventas.forEach(venta => {
    const clienteIds = venta.fields['Cliente'] || [];
    clienteIds.forEach(id => clientesEnVentas.add(id));
  });

  // Clasificar clientes según la fórmula de Airtable
  const clasificaciones = {
    premium: [],
    gold: [],
    frecuente: [],
    normal: []
  };

  clientesEnVentas.forEach(clienteId => {
    const clienteData = clientesMap[clienteId];
    if (!clienteData) return;

    const nombre = clienteData.Nombre || clienteData.Name || 'Sin nombre';
    const cantidadUnidades = clienteData['Cantidad de unidades General x Cliente'] || 0;

    // Aplicar lógica de clasificación según Airtable:
    // 0 unidades = Cliente Normal
    // <= 3 unidades = Cliente Frecuente
    // <= 6 unidades = Cliente Gold
    // > 6 unidades = Cliente Premium
    
    if (cantidadUnidades === 0) {
      clasificaciones.normal.push(nombre);
    } else if (cantidadUnidades <= 3) {
      clasificaciones.frecuente.push(nombre);
    } else if (cantidadUnidades <= 6) {
      clasificaciones.gold.push(nombre);
    } else {
      clasificaciones.premium.push(nombre);
    }
  });

  const container = document.getElementById('clasificacionClientes');
  
  // Tarjetas de resumen
  const resumenHTML = `
    <div class="clasificacion-grid">
      <div class="clasificacion-card">
        <div class="clasificacion-icon">💎</div>
        <div class="clasificacion-count">${clasificaciones.premium.length}</div>
        <div class="clasificacion-label">Premium</div>
      </div>
      <div class="clasificacion-card">
        <div class="clasificacion-icon">👑</div>
        <div class="clasificacion-count">${clasificaciones.gold.length}</div>
        <div class="clasificacion-label">Gold</div>
      </div>
      <div class="clasificacion-card">
        <div class="clasificacion-icon">⭐</div>
        <div class="clasificacion-count">${clasificaciones.frecuente.length}</div>
        <div class="clasificacion-label">Frecuente</div>
      </div>
      <div class="clasificacion-card">
        <div class="clasificacion-icon">👤</div>
        <div class="clasificacion-count">${clasificaciones.normal.length}</div>
        <div class="clasificacion-label">Normal</div>
      </div>
    </div>
  `;

  // Lista detallada
  const todosClientes = [
    ...clasificaciones.premium.map(n => ({ nombre: n, tipo: 'premium', label: 'Premium', icon: '💎' })),
    ...clasificaciones.gold.map(n => ({ nombre: n, tipo: 'gold', label: 'Gold', icon: '👑' })),
    ...clasificaciones.frecuente.map(n => ({ nombre: n, tipo: 'frecuente', label: 'Frecuente', icon: '⭐' })),
    ...clasificaciones.normal.slice(0, 10).map(n => ({ nombre: n, tipo: 'normal', label: 'Normal', icon: '👤' }))
  ];

  const listaHTML = todosClientes.length > 0 ? `
    <div class="clasificacion-list">
      ${todosClientes.map(cliente => `
        <div class="clasificacion-item">
          <span class="clasificacion-nombre">
            <span style="margin-right: 8px;">${cliente.icon}</span>
            ${cliente.nombre}
          </span>
          <span class="clasificacion-badge badge-${cliente.tipo}">${cliente.label}</span>
        </div>
      `).join('')}
    </div>
  ` : '<div class="empty-state"><div class="empty-state-icon">📭</div><p>No hay clientes</p></div>';

  container.innerHTML = resumenHTML + listaHTML;
}

function mostrarUltimasTransacciones(ventas) {
  const container = document.getElementById('ultimasTransacciones');
  if (ventas.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📭</div><p>No hay transacciones</p></div>';
    return;
  }

  container.innerHTML = ventas.map(venta => {
    const nombreCliente = venta.fields['Nombre'] || 'Sin cliente';
    const total = venta.fields['Total Neto Numerico'] || venta.fields['Total de venta'] || 0;
    const items = venta.fields['Items'] || 'Sin items';
    
    let fechaHoraTexto = 'Sin fecha';
    if (venta.fields['Fecha de compra']) {
      const fechaCompleta = new Date(venta.fields['Fecha de compra']);
      const fecha = fechaCompleta.toLocaleDateString('es-CL', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
      const hora = fechaCompleta.toLocaleTimeString('es-CL', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
      fechaHoraTexto = `${fecha} - ${hora}`;
    }
    
    const esDevolucion = venta.fields['Devolución'] && venta.fields['Devolución'].length > 0;
    
    let autorizadoPor = '';
    if (esDevolucion && venta.fields['Box Observaciones']) {
      autorizadoPor = `<div style="margin-top: 8px; padding: 8px; background: #fff3cd; border-radius: 6px; font-size: 11px; color: #856404;">
        <strong>✓ Autorizado por:</strong> ${venta.fields['Box Observaciones']}
      </div>`;
    }

    return `
      <div class="transaction-item">
        <div class="transaction-header">
          <span>${nombreCliente}</span>
          <span class="badge ${esDevolucion ? 'badge-devolucion' : 'badge-venta'}">
            ${esDevolucion ? 'Devolución' : 'Venta'}
          </span>
        </div>
        <div class="transaction-details">
          <div style="margin-bottom: 3px;">📦 ${items}</div>
          <div style="display: flex; justify-content: space-between;">
            <span>📅 ${fechaHoraTexto}</span>
            <span style="font-weight: 600; color: #10b981;">$${Math.round(total).toLocaleString('es-CL')}</span>
          </div>
          ${autorizadoPor}
        </div>
      </div>
    `;
  }).join('');
}

function filtrarTransacciones(tipo) {
  filtroTransaccionActual = tipo;
  
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.remove('active');
    if (btn.dataset.filter === tipo) {
      btn.classList.add('active');
    }
  });

  let transaccionesFiltradas = [...todasLasTransacciones];

  if (tipo === 'ventas') {
    transaccionesFiltradas = todasLasTransacciones.filter(v => 
      !v.fields['Devolución'] || v.fields['Devolución'].length === 0
    );
  } else if (tipo === 'devoluciones') {
    transaccionesFiltradas = todasLasTransacciones.filter(v => 
      v.fields['Devolución'] && v.fields['Devolución'].length > 0
    );
  }

  mostrarUltimasTransacciones(transaccionesFiltradas.slice(0, 10));
}

// Inicializar
inicializarFechas();
cargarDatos();

// Auto-refresh cada 5 minutos
setInterval(cargarDatos, 300000);