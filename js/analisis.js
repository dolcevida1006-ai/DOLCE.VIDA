// Variable global para controlar la instancia del gráfico y evitar duplicados
let miGrafico = null;
let graficoFinanzas = null;
let vistaActual = 'semanal'; 

const EQUIVALENCIAS_ANALISIS = {
    'g': 1, 'kg': 1000,
    'ml': 1, 'l': 1000,
    'unidades': 1, 'pzas': 1
};

// 1. INICIALIZACIÓN
document.addEventListener('DOMContentLoaded', () => {
    const hoy = new Date();
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    
    document.getElementById('filtro-fecha-inicio').value = inicioMes.toISOString().split('T')[0];
    document.getElementById('filtro-fecha-fin').value = hoy.toISOString().split('T')[0];

    // Llenado del selector de productos
    inicializarSelectorProductos();

    // Eventos para actualizar en tiempo real
    document.getElementById('filtro-fecha-inicio').addEventListener('change', () => { procesarAnalisisYGraficos(); cargarAlertasPreventivas(); });
    document.getElementById('filtro-fecha-fin').addEventListener('change', () => { procesarAnalisisYGraficos(); cargarAlertasPreventivas(); });
    document.getElementById('filtro-producto').addEventListener('change', () => { procesarAnalisisYGraficos(); cargarAlertasPreventivas(); });

    cargarAlertasPreventivas();
    procesarAnalisisYGraficos();
});

// Función para llenar el select de productos
function inicializarSelectorProductos() {
    const select = document.getElementById('filtro-producto');
    if (!select) return;
    
    const recetas = API.obtener("recetas_dolce_vida");
    select.innerHTML = '<option value="todos">✨ Todos los productos</option>';
    
    recetas.forEach(r => {
        const option = document.createElement('option');
        option.value = r.nombre;
        option.textContent = r.nombre;
        select.appendChild(option);
    });
}

// --- FUNCIÓN UNIFICADA ---
function procesarAnalisisYGraficos() {
    actualizarHistogramaPedidos();
    renderizarGraficoFinanciero();
}

function actualizarHistogramaPedidos() {
    const canvas = document.getElementById('graficoAnalisis');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    let pedidos = API.obtener("pedidos_dolce_vida").filter(p => p.estado === 'Entregado');
    const filtroProducto = document.getElementById('filtro-producto')?.value;
    
    // Filtro por producto adaptado a la nueva estructura
    if (filtroProducto && filtroProducto !== 'todos') {
        pedidos = pedidos.filter(p => {
            const lista = p.productos || [{ nombre: p.producto }];
            return lista.some(item => item.nombre === filtroProducto);
        });
    }

    let etiquetas, datosAgrupados = {};

    if (vistaActual === 'semanal') {
        etiquetas = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
        const hoy = new Date();
        let datosPorDia = {}; 

        pedidos.forEach(p => {
            const fechaP = new Date(p.fecha + 'T00:00:00');
            const diffSemanas = Math.floor((hoy - fechaP) / (7 * 24 * 60 * 60 * 1000));
            
            if (diffSemanas >= 0 && diffSemanas < 6) {
                let day = fechaP.getDay();
                const diaIndex = (day === 0) ? 6 : day - 1;
                
                const lista = p.productos || [{ nombre: p.producto, cantidad: p.cantidad }];
                lista.forEach(prodItem => {
                    if (!prodItem.nombre) return;
                    if (!datosPorDia[diaIndex]) datosPorDia[diaIndex] = {};
                    if (!datosPorDia[diaIndex][prodItem.nombre]) datosPorDia[diaIndex][prodItem.nombre] = [0, 0, 0, 0, 0, 0];
                    
                    datosPorDia[diaIndex][prodItem.nombre][diffSemanas] += prodItem.cantidad;
                });
            }
        });

        for (let d = 0; d < 7; d++) {
            if (!datosPorDia[d]) continue;
            Object.keys(datosPorDia[d]).forEach(prod => {
                if (!datosAgrupados[prod]) datosAgrupados[prod] = new Array(7).fill(0);
                let vals = datosPorDia[d][prod];
                let valoresReales = vals.filter(v => v > 0);
                if (valoresReales.length === 0) {
                    datosAgrupados[prod][d] = 0;
                } else if (valoresReales.length <= 2) {
                    datosAgrupados[prod][d] = valoresReales.reduce((a, b) => a + b, 0) / valoresReales.length;
                } else {
                    valoresReales.sort((a, b) => a - b);
                    valoresReales.shift();
                    valoresReales.pop();
                    datosAgrupados[prod][d] = valoresReales.reduce((a, b) => a + b, 0) / valoresReales.length;
                }
            });
        }
    } else {
        etiquetas = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        const fInicio = new Date(document.getElementById('filtro-fecha-inicio').value);
        const fFin = new Date(document.getElementById('filtro-fecha-fin').value);
        fFin.setHours(23, 59, 59);

        pedidos.filter(p => {
            const fechaP = new Date(p.fecha + 'T00:00:00');
            return fechaP >= fInicio && fechaP <= fFin;
        }).forEach(p => {
            const m = new Date(p.fecha + 'T00:00:00').getMonth();
            const lista = p.productos || [{ nombre: p.producto, cantidad: p.cantidad }];
            lista.forEach(prodItem => {
                if (!datosAgrupados[prodItem.nombre]) datosAgrupados[prodItem.nombre] = new Array(12).fill(0);
                datosAgrupados[prodItem.nombre][m] += prodItem.cantidad;
            });
        });
    }

    const datasets = Object.keys(datosAgrupados).map((prod, i) => ({
        label: prod,
        data: datosAgrupados[prod],
        backgroundColor: `hsl(${i * 45}, 70%, 60%)`,
        borderRadius: 4
    }));

    if (miGrafico) miGrafico.destroy();
    miGrafico = new Chart(ctx, {
        type: 'bar',
        data: { labels: etiquetas, datasets: datasets },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: true } },
            scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } }
        }
    });
}

function renderizarGraficoFinanciero() {
    const canvas = document.getElementById('graficoFinanciero');
    if (!canvas) return;
    
    const pedidos = API.obtener("pedidos_dolce_vida") || [];
    
    // Filtramos pedidos entregados
    const entregados = pedidos.filter(p => p.estado === 'Entregado');

    const balanceMensual = {};
    
    entregados.forEach(p => {
        const mes = p.fecha.substring(0, 7); // YYYY-MM
        if (!balanceMensual[mes]) balanceMensual[mes] = { ingresos: 0, gastos: 0 };
        
        // Sumar ingreso total del pedido
        balanceMensual[mes].ingresos += parseFloat(p.total || 0);
        
        // SUMAR GASTOS: Buscamos el costo en cada producto del pedido
        const listaProductos = p.productos || [];
        const costoTotalPedido = listaProductos.reduce((acc, prod) => {
            // Si el costo no existe, intentamos usar 0, pero aseguramos que lea el dato
            return acc + (parseFloat(prod.costoProduccion) || 0);
        }, 0);
        
        balanceMensual[mes].gastos += costoTotalPedido;
    });

    const labels = Object.keys(balanceMensual).sort();
    const dataIngresos = labels.map(m => balanceMensual[m].ingresos);
    const dataGastos = labels.map(m => balanceMensual[m].gastos);
    const dataUtilidad = labels.map(m => balanceMensual[m].ingresos - balanceMensual[m].gastos);

    if (window.graficoFinanzas) window.graficoFinanzas.destroy();

    const ctx = canvas.getContext('2d');
    window.graficoFinanzas = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                { label: 'Ingresos ($)', data: dataIngresos, backgroundColor: '#00b894' },
                { label: 'Gastos ($)', data: dataGastos, backgroundColor: '#ff7675' },
                { label: 'Utilidad Neta ($)', data: dataUtilidad, backgroundColor: '#0984e3' }
            ]
        },
        options: { 
            responsive: true, maintainAspectRatio: false,
            scales: { y: { beginAtZero: true } }
        }
    });
}

// 3. CONTROL DE VISTAS
function cambiarFiltroGrafico(tipo) {
    vistaActual = tipo;
    document.getElementById('btn-vista-semanal').classList.toggle('active', tipo === 'semanal');
    document.getElementById('btn-vista-mensual').classList.toggle('active', tipo === 'mensual');
    procesarAnalisisYGraficos();
}

// 4. SISTEMA DE KPI (HISTÓRICO Y RANGO)
function abrirPopUp(tipo) {
    const overlay = document.getElementById('kpi-popup-overlay');
    const contenido = document.getElementById('popup-contenido');
    let todosLosPedidos = API.obtener("pedidos_dolce_vida").filter(p => p.estado === 'Entregado');
    
    const fechaInicio = new Date(document.getElementById('filtro-fecha-inicio').value);
    const fechaFin = new Date(document.getElementById('filtro-fecha-fin').value);
    fechaFin.setHours(23, 59, 59);

    let pedidosFiltrados = todosLosPedidos.filter(p => {
        const fechaPedido = new Date(p.fecha);
        return fechaPedido >= fechaInicio && fechaPedido <= fechaFin;
    });
    
    let htmlContent = '';
    
    const sumarCantidades = (lista) => lista.reduce((sum, p) => {
        const cant = (p.productos || []).reduce((s, item) => s + (item.cantidad || 0), p.cantidad || 0);
        return sum + cant;
    }, 0);

    if (tipo === 'pedidos') {
        const totalHistorico = sumarCantidades(todosLosPedidos);
        htmlContent = `<h3>📊 Resumen Histórico</h3>
        <p><strong>Total unidades vendidas (Histórico):</strong> ${totalHistorico}</p>`;
    } else if (tipo === 'producto') {
        const ventasHist = {};
        const ventasRango = {};
        
        todosLosPedidos.forEach(p => {
            const lista = p.productos || [{ nombre: p.producto, cantidad: p.cantidad }];
            lista.forEach(item => {
                if (item.nombre) ventasHist[item.nombre] = (ventasHist[item.nombre] || 0) + item.cantidad;
            });
        });
        pedidosFiltrados.forEach(p => {
            const lista = p.productos || [{ nombre: p.producto, cantidad: p.cantidad }];
            lista.forEach(item => {
                if (item.nombre) ventasRango[item.nombre] = (ventasRango[item.nombre] || 0) + item.cantidad;
            });
        });
        
        const topH = Object.keys(ventasHist).length > 0 ? Object.keys(ventasHist).reduce((a, b) => ventasHist[a] > ventasHist[b] ? a : b) : "N/A";
        const topR = Object.keys(ventasRango).length > 0 ? Object.keys(ventasRango).reduce((a, b) => ventasRango[a] > ventasRango[b] ? a : b) : "N/A";
        
        htmlContent = `<h3>👑 Top</h3>
                       <p><strong>Histórico:</strong> ${topH} (${ventasHist[topH] || 0} un.)</p>
                       <p><strong>En el periodo:</strong> ${topR} (${ventasRango[topR] || 0} un.)</p>`;
    } else if (tipo === 'mes') {
        const mesActualStr = new Date().toISOString().slice(0, 7);
        const totalMes = sumarCantidades(todosLosPedidos.filter(p => p.fecha.startsWith(mesActualStr)));
        htmlContent = `<h3>📅 Rendimiento</h3><p><strong>Total unidades mes actual:</strong> ${totalMes}</p>`;
    }
    
    contenido.innerHTML = htmlContent;
    overlay.classList.add('active'); 
}

function cerrarPopUp() {
    document.getElementById('kpi-popup-overlay').classList.remove('active');
}

// 5. PROYECCIÓN DE COMPRA
function cargarAlertasPreventivas() {
    const contenedor = document.getElementById('contenedor-alertas-predictivas');
    if (!contenedor) return;

    const pedidos = API.obtener("pedidos_dolce_vida").filter(p => p.estado === 'Entregado');
    const inventario = API.obtener("inventario_dolce_vida");
    const recetas = API.obtener("recetas_dolce_vida");
    const hoy = new Date();

    let consumoSemanas = [[], [], [], [], [], []]; 
    pedidos.forEach(p => {
        const fechaP = new Date(p.fecha);
        const diffSemanas = Math.floor((hoy - fechaP) / (7 * 24 * 60 * 60 * 1000));
        
        if (diffSemanas >= 0 && diffSemanas < 6) {
            const productosAProcesar = p.productos ? p.productos : [{ nombre: p.producto, cantidad: p.cantidad }];
            productosAProcesar.forEach(item => {
                if (!item.nombre) return;
                const receta = recetas.find(r => r.nombre.toLowerCase() === item.nombre.toLowerCase());
                if (!receta) return;
                const factor = item.cantidad / (receta.porciones || 1);
                receta.ingredientes.forEach(ing => {
                    const nom = ing.nombre.toLowerCase();
                    const cant = ing.cantidad * factor * (EQUIVALENCIAS_ANALISIS[ing.unidad.toLowerCase()] || 1);
                    consumoSemanas[5 - diffSemanas].push({ nombre: nom, cantidad: cant });
                });
            });
        }
    });

    let semanasData = [{}, {}, {}, {}, {}, {}];
    consumoSemanas.forEach((lista, idx) => {
        lista.forEach(item => semanasData[idx][item.nombre] = (semanasData[idx][item.nombre] || 0) + item.cantidad);
    });

    let alertasHTML = '';
    const todosLosInsumos = new Set();
    semanasData.forEach(sem => Object.keys(sem).forEach(k => todosLosInsumos.add(k)));

    todosLosInsumos.forEach(nombre => {
        let valores = semanasData.map(sem => sem[nombre] || 0);
        valores.sort((a, b) => a - b);
        const promedioRealista = (valores[2] + valores[3]) / 2;
        const meta = promedioRealista * 0.70;
        const insumoStock = inventario.find(i => i.nombre.toLowerCase() === nombre);
        const actual = insumoStock ? (insumoStock.cantidad * (EQUIVALENCIAS_ANALISIS[insumoStock.unidad.toLowerCase()] || 1)) : 0;

        if (meta > actual) {
            const falta = meta - actual;
            const unidad = insumoStock ? insumoStock.unidad : 'g';
            const factorUnidad = EQUIVALENCIAS_ANALISIS[unidad.toLowerCase()] || 1;
            const faltaEnUnidad = falta / factorUnidad;
            const redondeado = Math.ceil(faltaEnUnidad * 2) / 2;
            
            alertasHTML += `
                <div style="background:#fff; border-left:5px solid #ff4d4d; padding:12px; margin-bottom:10px; border-radius:8px; box-shadow:0 2px 5px rgba(0,0,0,0.05);">
                    <strong>⚠️ Compra sugerida: ${nombre.charAt(0).toUpperCase() + nombre.slice(1)}</strong><br>
                    <small>Meta (70% prom. 6 sem): ${redondeado} ${unidad} faltantes.</small>
                </div>`;
        }
    });
    contenedor.innerHTML = alertasHTML || `<div style="color:#00a86b; background:#e8f8f2; padding:12px; border-radius:8px; font-weight:bold;">✅ Stock ajustado correctamente.</div>`;
}

// 6. EXPORTACIÓN A EXCEL
window.exportarVentasExcel = function() {
    let pedidos = API.obtener("pedidos_dolce_vida");
    const fechaInicio = new Date(document.getElementById('filtro-fecha-inicio').value);
    const fechaFin = new Date(document.getElementById('filtro-fecha-fin').value);
    fechaFin.setHours(23, 59, 59);

    pedidos = pedidos.filter(p => {
        const fechaPedido = new Date(p.fecha);
        return fechaPedido >= fechaInicio && fechaPedido <= fechaFin;
    });

    if (pedidos.length === 0) {
        alert("No hay datos de ventas en este rango para exportar.");
        return;
    }

    let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
    csvContent += "Fecha,Producto,Cantidad,Cliente,Estado,Hora\n";

    pedidos.forEach(p => {
        const lista = p.productos || [{ nombre: p.producto, cantidad: p.cantidad }];
        lista.forEach(item => {
            const row = [p.fecha, item.nombre, item.cantidad, p.cliente, p.estado, p.hora].join(",");
            csvContent += row + "\n";
        });
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "Reporte_Ventas_DolceVida.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

// 7. NOTIFICACIONES
function mostrarGloboNotificacion(mensaje, color) {
    let overlay = document.getElementById('kpi-popup-overlay');
    let contenido = document.getElementById('popup-contenido');

    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'kpi-popup-overlay';
        overlay.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); display:flex; align-items:center; justify-content:center; z-index:1000; opacity:0; transition: opacity 0.3s ease; pointer-events: none;";
        contenido = document.createElement('div');
        contenido.id = 'popup-contenido';
        contenido.style.cssText = "background:white; padding:20px; border-radius:12px; max-width:80%; text-align:center; box-shadow: 0 4px 15px rgba(0,0,0,0.2);";
        overlay.appendChild(contenido);
        document.body.appendChild(overlay);
    }
    contenido.innerHTML = `<h3 style="color:${color}; margin-top:0;">✅ Éxito</h3><p style="margin-bottom:0;">${mensaje}</p>`;
    overlay.style.opacity = "1";
    overlay.style.pointerEvents = "auto";
    setTimeout(() => {
        overlay.style.opacity = "0";
        setTimeout(() => { overlay.style.pointerEvents = "none"; }, 300);
    }, 1500);
}
