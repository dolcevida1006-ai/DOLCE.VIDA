// ========================================================
// dolce.vida - MOTOR CON DESCUENTO DE STOCK EN VIVO V4.0
// ========================================================

const EQUIVALENCIAS_MOTOR = {
    'g': 1, 'kg': 1000,
    'ml': 1, 'l': 1000,
    'unidades': 1
};

// Generador de colores fijos para cada pedido
function obtenerColorPedido(id) {
    const colores = ["#ff7675", "#fdcb6e", "#00b894", "#0984e3", "#6c5ce7", "#e84393", "#d63031", "#e17055"];
    return colores[id % colores.length];
}

document.addEventListener("DOMContentLoaded", () => {
    inicializarPantallaInicio();
});

function inicializarPantallaInicio() {
    const pedidos = API.obtener("pedidos_dolce_vida") || [];
    const inventario = API.obtener("inventario_dolce_vida") || [];
    const recetas = API.obtener("recetas_dolce_vida") || [];

    // Busca esta línea en tu js/main.js (dentro de inicializarPantallaInicio)
    const pendientes = pedidos.filter(p => p.estado !== "Entregado" && p.estado !== "Cotización");
    
    pendientes.sort((a, b) => new Date(`${a.fecha}T${a.hora}`) - new Date(`${b.fecha}T${b.hora}`));

    const hoy = new Date();
    const limiteVentana = new Date();
    limiteVentana.setDate(hoy.getDate() + 4);

    let stockSimulado = {};
    inventario.forEach(insumo => {
        const unidadBase = insumo.unidad.toLowerCase();
        const multiplicador = EQUIVALENCIAS_MOTOR[unidadBase] || 1;
        stockSimulado[insumo.nombre.toLowerCase()] = {
            totalMinimo: insumo.cantidad * multiplicador,
            disponibleMinimo: insumo.cantidad * multiplicador,
            unidadOriginal: insumo.unidad,
            desglosePedidos: []
        };
    });

    let analisisPedidos = [];
    
    pendientes.forEach(pedido => {
        // Aseguramos compatibilidad: si no hay array 'productos', usamos el objeto único
        const listaProductos = pedido.productos || [{ recetaId: pedido.recetaId, nombre: pedido.producto, cantidad: pedido.cantidad, precioFinal: 0 }];
        
        let costoProduccionTotal = 0;
        let totalIngredientesGlobal = 0;
        let porcentajeAcumuladoGlobal = 0;
        let listaFaltantesGlobal = [];

        listaProductos.forEach(item => {
            const receta = recetas.find(r => r.id === item.recetaId || r.nombre.toLowerCase() === (item.nombre || "").toLowerCase());
            if (!receta) return;

            const factorEscala = item.cantidad / (receta.porciones || 1);
            totalIngredientesGlobal += receta.ingredientes.length;

            // --- CÁLCULO DE COSTO ---
            // Usamos el costo guardado en el objeto producto si existe, si no, calculamos al vuelo para compatibilidad
            costoProduccionTotal += (item.costoProduccion || 0) * item.cantidad;

            receta.ingredientes.forEach(ing => {
                const nombreClave = ing.nombre.toLowerCase();
                const insumo = inventario.find(i => i.nombre.toLowerCase() === nombreClave);
                
                // --- LÓGICA DE STOCK (Mantenemos tu motor intacta) ---
                const necesidadReal = (ing.cantidad * factorEscala) * (EQUIVALENCIAS_MOTOR[ing.unidad.toLowerCase()] || 1);
                const insumoEnAlmacen = stockSimulado[nombreClave];

                if (insumoEnAlmacen) {
                    const cantidadAsignada = Math.min(insumoEnAlmacen.disponibleMinimo, necesidadReal);
                    if (cantidadAsignada > 0) {
                        insumoEnAlmacen.desglosePedidos.push({ idPedido: pedido.id, cantidad: cantidadAsignada, color: obtenerColorPedido(pedido.id) });
                    }
                    if (insumoEnAlmacen.disponibleMinimo >= necesidadReal) {
                        insumoEnAlmacen.disponibleMinimo -= necesidadReal;
                        porcentajeAcumuladoGlobal += 100;
                    } else {
                        porcentajeAcumuladoGlobal += (insumoEnAlmacen.disponibleMinimo / necesidadReal) * 100;
                        if (new Date(`${pedido.fecha}T${pedido.hora}`) <= limiteVentana) listaFaltantesGlobal.push(ing.nombre);
                        insumoEnAlmacen.disponibleMinimo = 0;
                    }
                }
            });
        });

        const porcentajeFinal = totalIngredientesGlobal > 0 ? (porcentajeAcumuladoGlobal / totalIngredientesGlobal) : 0;
        
        analisisPedidos.push({
            pedido: pedido,
            costoProduccion: costoProduccionTotal,
            porcentaje: Math.min(100, Math.max(0, porcentajeFinal)),
            faltantes: [...new Set(listaFaltantesGlobal)] // Quitamos duplicados
        });
    });

    renderizarPedidos(analisisPedidos);
    renderizarEstadoGlobalInsumos(stockSimulado);
}

function renderizarPedidos(analisisPedidos) {
    const listaContenedor = document.getElementById("lista-pedidos-pendientes");
    if (!listaContenedor) return;

    if (analisisPedidos.length === 0) {
        listaContenedor.innerHTML = `
            <div class="card" style="border-left-color: #55efc4; text-align: center; padding: 20px;">
                <h3>🎉 ¡Al día!</h3>
                <p>No tienes pedidos pendientes por entregar.</p>
            </div>
        `;
        return;
    }

    listaContenedor.innerHTML = "";

    analisisPedidos.forEach(item => {
        const pedido = item.pedido;
        const porcentaje = Math.round(item.porcentaje);
        const faltantes = item.faltantes;
        
        // Sumamos el costo guardado en cada producto del pedido
        const costoProduccion = item.costoProduccion || 0;
        const precioVenta = parseFloat(pedido.total || 0);
        const utilidad = precioVenta - costoProduccion;

        const swipeContainer = document.createElement("div");
        swipeContainer.className = "swipe-container";
        swipeContainer.id = `container-${pedido.id}`;

        const actionsRight = document.createElement("div");
        actionsRight.className = "swipe-actions";
        actionsRight.innerHTML = `
            <button class="btn-action btn-preparado" onclick="cambiarEstadoPedido(${pedido.id}, 'Preparado')">🧁<br>Listo</button>
            <button class="btn-action btn-entregado" onclick="cambiarEstadoPedido(${pedido.id}, 'Entregado')">✅<br>Entregar</button>
        `;

        const actionsLeft = document.createElement("div");
        actionsLeft.className = "swipe-actions-left";
        actionsLeft.innerHTML = `
            <button class="btn-action btn-editar" onclick="irAEditarPedido(${pedido.id})">✏️<br>Editar</button>
            <button class="btn-action btn-eliminar" onclick="eliminarPedido(${pedido.id})" style="background: #ff7675; color: white;">🗑️<br>Borrar</button>
        `;

        const card = document.createElement("div");
        card.className = "card";
        card.style.borderLeft = `5px solid ${obtenerColorPedido(pedido.id)}`;
        
        const fechaPedido = new Date(`${pedido.fecha}T${pedido.hora}`);
        const ahora = new Date();
        const diferenciaHoras = (fechaPedido - ahora) / (1000 * 60 * 60);

        let etiquetaUrgencia = `<span class="badge">${pedido.estado}</span>`;

        if (pedido.estado === "Preparado") {
            card.classList.add("card-preparado");
        } else {
            if (diferenciaHoras > 0 && diferenciaHoras <= 24) {
                card.classList.add("card-urgente");
                etiquetaUrgencia = `<span class="badge urgente" style="background-color: #ff7675; color: white;">⚠️ MUY URGENTE</span>`;
            } else if (diferenciaHoras <= 0) {
                card.classList.add("card-urgente");
                etiquetaUrgencia = `<span class="badge urgente" style="background-color: #d63031; color: white;">🚨 RETRASADO</span>`;
            }
        }

        let colorBarra = "#55efc4"; 
        if (porcentaje < 100 && porcentaje >= 60) colorBarra = "#fdcb6e"; 
        if (porcentaje < 60) colorBarra = "#ff7675"; 

        let textoAlertaFaltantes = "";
        if (porcentaje < 100 && faltantes.length > 0) {
            textoAlertaFaltantes = `<span style="color: #d63031; font-weight: bold; font-size: 0.78rem; float: right;">❌ Faltante: ${faltantes.join(', ')}</span>`;
        } else if (porcentaje === 100) {
            textoAlertaFaltantes = `<span style="color: #00b894; font-weight: bold; font-size: 0.78rem; float: right;">✅ Insumos Listos</span>`;
        }

        // Definimos el nombre del producto (soporta estructura simple o múltiple)
        const nombreDisplay = pedido.productos ? pedido.productos.map(p => `${p.cantidad} ${p.nombre}`).join(', ') : pedido.producto;
        
        card.innerHTML = `
            <h3>${nombreDisplay}</h3>
            <p><strong>Fecha:</strong> ${invertirFecha(pedido.fecha)} - ${pedido.hora}</p>
            <p><strong>Cliente:</strong> ${pedido.cliente}</p>
            <p style="font-size: 0.85rem; background: #f8f9fa; padding: 5px; border-radius: 4px;">
                <strong>Prod:</strong> $${costoProduccion.toFixed(2)} | 
                <strong>Venta:</strong> $${precioVenta.toFixed(2)} | 
                <strong>Utilidad:</strong> $${utilidad.toFixed(2)}
            </p>
            ${pedido.notas ? `<p><strong>Notas:</strong> <i>"${pedido.notas}"</i></p>` : ''}
            
            <div class="pedido-insumos-bar" style="margin: 12px 0 6px 0; overflow: hidden;">
                <span style="font-size: 0.8rem; color: #555;">Insumos asignados: <b>${porcentaje}%</b></span>
                ${textoAlertaFaltantes}
                <div style="background: #e9ecef; height: 10px; border-radius: 5px; overflow:hidden; margin-top:4px; clear: both;">
                    <div id="bar-pedido-${pedido.id}" style="background: ${colorBarra}; height: 100%; width: ${porcentaje}%; transition: width 0.4s ease;"></div> 
                </div>
            </div>

            <div style="margin-top: 5px;">
                ${pedido.estado === 'Preparado' ? `<span class="badge" style="background-color: #fdcb6e; color: #2d3436;">✨ Horneado / Por Entregar</span>` : etiquetaUrgencia}
            </div>
        `;

        let touchStartX = 0; let touchEndX = 0;
        card.addEventListener('touchstart', (e) => touchStartX = e.changedTouches[0].screenX, { passive: true });
        card.addEventListener('touchend', (e) => {
            touchEndX = e.changedTouches[0].screenX;
            const diff = touchStartX - touchEndX;
            const estaAbiertoIzquierda = swipeContainer.classList.contains('swiped');
            const estaAbiertoDerecha = swipeContainer.classList.contains('swiped-right');

            if (diff > 50) { 
                if (estaAbiertoDerecha) swipeContainer.classList.remove('swiped-right');
                else if (!estaAbiertoIzquierda) {
                    document.querySelectorAll('.swipe-container').forEach(c => { c.classList.remove('swiped'); c.classList.remove('swiped-right'); });
                    swipeContainer.classList.add('swiped');
                }
            } else if (diff < -50) { 
                if (estaAbiertoIzquierda) swipeContainer.classList.remove('swiped');
                else if (!estaAbiertoDerecha) {
                    document.querySelectorAll('.swipe-container').forEach(c => { c.classList.remove('swiped'); c.classList.remove('swiped-right'); });
                    swipeContainer.classList.add('swiped-right');
                }
            }
        }, { passive: true });

        swipeContainer.appendChild(actionsRight);
        swipeContainer.appendChild(actionsLeft);
        swipeContainer.appendChild(card);
        listaContenedor.appendChild(swipeContainer);
    });
}

function renderizarEstadoGlobalInsumos(stockSimulado) {
    const contenedorGrafica = document.getElementById("lista-inventario-progreso");
    if (!contenedorGrafica) return;

    const nombresInsumos = Object.keys(stockSimulado);
    if (nombresInsumos.length === 0) {
        contenedorGrafica.innerHTML = `<p style="text-align:center; color:#888; font-size:0.9rem; padding: 15px 0;">Registra insumos en Stock para ver el balance de tu almacén.</p>`;
        return;
    }

    contenedorGrafica.innerHTML = `<p style="font-size:0.82rem; color:#5c6b73; margin-bottom:15px; line-height: 1.4;">Desglose de ocupación por pedido:</p>`;

    nombresInsumos.forEach(nombre => {
        const datos = stockSimulado[nombre];
        const unidadOriginal = datos.unidadOriginal;
        
        let htmlSegmentos = "";
        let ocupadoSumado = 0;

        datos.desglosePedidos.forEach(p => {
            const pct = (p.cantidad / datos.totalMinimo) * 100;
            ocupadoSumado += p.cantidad;
            htmlSegmentos += `<div style="background: ${p.color}; width: ${pct}%; height: 100%; border-right: 1px solid rgba(255,255,255,0.3);" title="Pedido ${p.idPedido}"></div>`;
        });

        const pctLibre = Math.max(0, 100 - ((ocupadoSumado / datos.totalMinimo) * 100));
        const nombreFormateado = nombre.charAt(0).toUpperCase() + nombre.slice(1);

        const filaGrafica = document.createElement("div");
        filaGrafica.style.marginBottom = "16px";
        filaGrafica.innerHTML = `
            <div style="display:flex; justify-content:space-between; font-size:0.85rem; font-weight:bold; color:#2d3436; margin-bottom:4px;">
                <span>${nombreFormateado}</span>
                <span style="font-size:0.8rem; color:#666;">Disp: ${(datos.disponibleMinimo / (EQUIVALENCIAS_MOTOR[unidadOriginal.toLowerCase()] || 1)).toFixed(1)}</span>
            </div>
            <div style="background: #e2eafc; height: 16px; border-radius: 8px; overflow:hidden; display: flex; box-shadow: inset 0 1px 3px rgba(0,0,0,0.1);">
                ${htmlSegmentos}
                <div style="background: #00b894; width: ${pctLibre}%; height: 100%;"></div>
            </div>
        `;
        contenedorGrafica.appendChild(filaGrafica);
    });
}

window.irAEditarPedido = function(id) {
    API.guardar("pedido_editar_id", id);
    window.location.href = "pedidos.html";
};

window.cambiarEstadoPedido = function(id, nuevoEstado) {
    let pedidos = API.obtener("pedidos_dolce_vida") || [];
    let inventario = API.obtener("inventario_dolce_vida") || [];
    const recetas = API.obtener("recetas_dolce_vida") || [];

    const pedidoEncontrado = pedidos.find(p => p.id === id);
    if (!pedidoEncontrado) return;

    if (nuevoEstado === "Entregado") {
        let costoTotalCalculado = 0; // <--- NUEVO
        const listaProductos = pedidoEncontrado.productos || [{
            recetaId: pedidoEncontrado.recetaId,
            nombre: pedidoEncontrado.producto,
            cantidad: pedidoEncontrado.cantidad
        }];

        listaProductos.forEach(item => {
            const receta = recetas.find(r => r.id === item.recetaId || r.nombre.toLowerCase() === (item.nombre || "").toLowerCase());

            if (receta) {
                const porcionesReceta = receta.porciones || 1;
                const factorEscala = item.cantidad / porcionesReceta;

                receta.ingredientes.forEach(ing => {
                    const nombreIng = ing.nombre.toLowerCase();
                    let cantidadNecesaria = ing.cantidad * factorEscala;
                    let insumoStock = inventario.find(i => i.nombre.toLowerCase() === nombreIng);

                    // --- CÁLCULO DE COSTO ---
                    if (insumoStock && insumoStock.precioUnitario) {
                        costoTotalCalculado += (ing.cantidad * factorEscala) * insumoStock.precioUnitario;
                    }

                    // --- LÓGICA DE STOCK ---
                    if (insumoStock) {
                        const esPieza = insumoStock.unidad.toLowerCase() === 'unidades' || insumoStock.unidad.toLowerCase() === 'pzas';
                        if (esPieza) {
                            cantidadNecesaria = Math.round(cantidadNecesaria);
                            insumoStock.cantidad = Math.max(0, Math.round(insumoStock.cantidad) - cantidadNecesaria);
                        } else {
                            insumoStock.cantidad = Math.max(0, insumoStock.cantidad - cantidadNecesaria);
                            insumoStock.cantidad = parseFloat(insumoStock.cantidad.toFixed(2));
                        }
                    }
                });
            }
        });
        
        // GUARDAMOS EL COSTO CONGELADO EN EL PEDIDO
        pedidoEncontrado.costoProduccion = costoTotalCalculado; // <--- GUARDADO
        API.guardar("inventario_dolce_vida", inventario);
    }

    pedidos = pedidos.map(pedido => {
        if (pedido.id === id) pedido.estado = nuevoEstado;
        return pedido;
    });

    API.guardar("pedidos_dolce_vida", pedidos);
    inicializarPantallaInicio();
};

function invertirFecha(fecha) {
    if (!fecha || typeof fecha !== 'string' || !fecha.includes("-")) {
        return "Fecha no válida";
    }
    const partes = fecha.split("-");
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
}
window.descargarDatos = function() {
    const llaves = ["pedidos_dolce_vida", "inventario_dolce_vida", "recetas_dolce_vida"];
    let backup = {};
    llaves.forEach(llave => { backup[llave] = localStorage.getItem(llave); });
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backup));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "backup_dolce_vida.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
};

window.subirDatos = function(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const contenido = JSON.parse(e.target.result);
            if (contenido.accion === "RESET") {
                const llavesApp = ["pedidos_dolce_vida", "inventario_dolce_vida", "recetas_dolce_vida"];
                llavesApp.forEach(llave => localStorage.removeItem(llave));
                location.reload();
            } else if (contenido.pedidos_dolce_vida || contenido.inventario_dolce_vida) {
                Object.keys(contenido).forEach(llave => {
                    if (contenido[llave]) localStorage.setItem(llave, contenido[llave]);
                });
                location.reload();
            }
        } catch (error) { alert("❌ Error en formato."); }
    };
    reader.readAsText(file);
};

window.eliminarPedido = function(id) {
    confirmarAccion("¿Estás seguro de que quieres eliminar este pedido? Esta acción no se puede deshacer.", () => {
        let pedidos = API.obtener("pedidos_dolce_vida") || [];
        pedidos = pedidos.filter(p => p.id !== id);
        
        API.guardar("pedidos_dolce_vida", pedidos);
        
        inicializarPantallaInicio();
        
        if (typeof mostrarGloboNotificacion === 'function') {
            mostrarGloboNotificacion("Pedido eliminado correctamente.", "#ff7675");
        }
    });
};

window.confirmarAccion = function(mensaje, onConfirm) {
    let overlay = document.getElementById('modal-confirmacion-overlay');
    
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'modal-confirmacion-overlay';
        overlay.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); display:flex; align-items:center; justify-content:center; z-index:2000; opacity:0; pointer-events:none; transition:opacity 0.2s;";
        overlay.innerHTML = `
            <div style="background:white; padding:25px; border-radius:15px; width:85%; max-width:300px; text-align:center; box-shadow: 0 10px 25px rgba(0,0,0,0.3);">
                <h3 style="margin-top:0;">⚠️ Confirmar</h3>
                <p id="mensaje-confirm" style="color:#555; margin: 15px 0;"></p>
                <div style="display:flex; justify-content:space-between; margin-top:20px; gap: 10px;">
                    <button id="btn-no" style="flex:1; padding:10px; border:none; border-radius:8px; background:#eee; cursor:pointer;">No</button>
                    <button id="btn-si" style="flex:1; padding:10px; border:none; border-radius:8px; background:#ff4d4d; color:white; cursor:pointer;">Sí</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
    }

    document.getElementById('mensaje-confirm').innerText = mensaje;

    overlay.style.opacity = '1';
    overlay.style.pointerEvents = 'auto';

    const btnSi = document.getElementById('btn-si');
    const btnNo = document.getElementById('btn-no');

    btnSi.onclick = () => {
        cerrarModal();
        if (onConfirm) onConfirm();
    };

    btnNo.onclick = () => {
        cerrarModal();
    };

    function cerrarModal() {
        overlay.style.opacity = '0';
        overlay.style.pointerEvents = 'none';
    }
};
