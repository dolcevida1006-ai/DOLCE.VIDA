// ==========================================
// dolce.vida - MÓDULO DE PEDIDOS COMPLETO V2
// ==========================================

document.addEventListener("DOMContentLoaded", () => {
    // 1. Cargas iniciales
    cargarRecetasEnSelector();
    inicializarFormularioPedidos();
    
    // 2. Verificamos si estamos en modo edición
    const editId = API.obtener("pedido_editar_id");
    
    if (editId) {
        // Si estamos editando, cargamos los datos del pedido
        verificarModoEdicion();
    } else {
        // Si es un pedido nuevo, agregamos la fila inicial vacía
        agregarFilaProducto();
    }
    
    // 3. Configuración del botón de agregar (siempre activo)
    const btnAgregar = document.getElementById("btn-agregar-producto");
    if (btnAgregar) {
        btnAgregar.addEventListener("click", () => agregarFilaProducto());
    }
});

function agregarFilaProducto(datos = null) {
    const contenedor = document.getElementById("contenedor-productos-pedido");
    const recetas = API.obtener("recetas_dolce_vida") || [];
    
    const fila = document.createElement("div");
    fila.className = "fila-producto-pedido";
    
    // Si estamos editando, usamos los datos recibidos, si no, valores vacíos
    const prodId = datos ? datos.recetaId : "";
    const cantidad = datos ? datos.cantidad : 1;
    const precio = datos ? datos.precioFinal : "";

    fila.innerHTML = `
        <select class="select-prod" onchange="calcularPrecios()" style="flex: 2;" required>
            <option value="">Producto...</option>
            ${recetas.map(r => `
                <option value="${r.id}" data-precio="${r.precioVenta || 0}" ${r.id == prodId ? 'selected' : ''}>
                    ${r.nombre}
                </option>
            `).join('')}
        </select>
        <input type="number" class="input-cant" placeholder="Cant." value="${cantidad}" oninput="calcularTotal()" style="flex: 0.5;">
        <div style="width: 100%;">
            <small style="color: #ff758f;">Sugerido: $<span class="txt-sugerido">0.00</span></small>
            <input type="number" class="input-precio" placeholder="Precio Final $" value="${precio}" oninput="calcularTotal()" style="width: 100%;">
        </div>
        <button type="button" class="btn-eliminar-prod" onclick="this.parentElement.remove(); calcularTotal()">✕</button>
    `;
    
    contenedor.appendChild(fila);
    
    // Si al crear la fila venía con datos (edición), forzamos el cálculo
    if (datos) {
        calcularPrecios(); 
        calcularTotal();   
    }
}

window.calcularPrecios = () => {
    document.querySelectorAll(".fila-producto-pedido").forEach(f => {
        const select = f.querySelector(".select-prod");
        const precioSugerido = select.options[select.selectedIndex].getAttribute("data-precio");
        
        f.querySelector(".txt-sugerido").innerText = parseFloat(precioSugerido).toFixed(2);
        
        if (!f.querySelector(".input-precio").value) {
            f.querySelector(".input-precio").value = precioSugerido;
        }
    });
    calcularTotal();
};

window.calcularTotal = () => {
    let total = 0;
    document.querySelectorAll(".fila-producto-pedido").forEach(f => {
        const cant = parseFloat(f.querySelector(".input-cant").value) || 0;
        const precio = parseFloat(f.querySelector(".input-precio").value) || 0;
        total += (cant * precio);
    });
    document.getElementById("total-pedido").innerText = total.toFixed(2);
};

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

function cargarRecetasEnSelector() {
    const selectProducto = document.getElementById("producto");
    if (!selectProducto) return;
    const recetas = API.obtener("recetas_dolce_vida") || [];
    if (recetas.length > 0) {
        selectProducto.innerHTML = `<option value="" disabled selected>Selecciona un producto...</option>`;
        recetas.forEach(receta => {
            selectProducto.innerHTML += `<option value="${receta.id}">${receta.nombre} (Rinde ${receta.porciones || 1} pzas)</option>`;
        });
    } else {
        selectProducto.innerHTML = `<option value="" disabled>⚠️ Crea una receta primero en el libro</option>`;
    }
}

function verificarModoEdicion() {
    const editId = API.obtener("pedido_editar_id");
    if (!editId) return;

    const pedidos = API.obtener("pedidos_dolce_vida") || [];
    const pedido = pedidos.find(p => p.id === parseInt(editId));

    if (pedido) {
        const header = document.querySelector(".app-header p");
        if (header) header.innerText = "✏️ Editando Pedido Existente";
        
        document.getElementById("cliente").value = pedido.cliente || "";
        document.getElementById("fecha-entrega").value = pedido.fecha || "";
        document.getElementById("hora-entrega").value = pedido.hora || "";
        if (document.getElementById("notas")) document.getElementById("notas").value = pedido.notas || "";

        const contenedor = document.getElementById("contenedor-productos-pedido");
        const filas = contenedor.querySelectorAll(".fila-producto-pedido");
        filas.forEach(f => f.remove());

        if (pedido.productos && Array.isArray(pedido.productos)) {
            pedido.productos.forEach(prod => {
                agregarFilaProducto(prod);
            });
        }
        
        calcularTotal();
        const form = document.getElementById("form-nuevo-pedido");
        if (form) form.setAttribute("data-edit-id", editId);
    }
}

function construirObjetoPedido() {
    const productosList = [];
    // 1. Obtenemos las recetas para poder calcular el costo
    const recetas = API.obtener("recetas_dolce_vida") || []; 

    document.querySelectorAll(".fila-producto-pedido").forEach(f => {
        const select = f.querySelector(".select-prod");
        if (select.value) {
            // 2. Buscamos la receta seleccionada
            const receta = recetas.find(r => r.id == select.value);
            
            // 3. Calculamos el costo base de la receta (igual a como lo haces en recetas.js)
            // Si tu receta no tiene el costo guardado, lo calculamos al vuelo:
            let costoPorPorcion = 0;
            if (receta && receta.ingredientes) {
                const inventario = API.obtener("inventario_dolce_vida") || [];
                let costoTotalReceta = 0;
                receta.ingredientes.forEach(ing => {
                    const insumo = inventario.find(i => i.nombre === ing.nombre);
                    if (insumo) {
                        const precioUnitario = insumo.precioCompra / insumo.cantidadBase;
                        costoTotalReceta += (ing.cantidad * precioUnitario);
                    }
                });
                costoPorPorcion = costoTotalReceta / (receta.porciones || 1);
            }

            productosList.push({
                recetaId: parseInt(select.value),
                nombre: select.options[select.selectedIndex].text.trim(),
                cantidad: parseInt(f.querySelector(".input-cant").value) || 0,
                precioFinal: parseFloat(f.querySelector(".input-precio").value) || 0,
                costoProduccion: costoPorPorcion // <--- GUARDAMOS EL COSTO CALCULADO
            });
        }
    });

    return {
        id: Date.now(),
        cliente: document.getElementById("cliente").value.trim(),
        productos: productosList,
        total: document.getElementById("total-pedido").innerText,
        fecha: document.getElementById("fecha-entrega").value,
        hora: document.getElementById("hora-entrega").value,
        notas: document.getElementById("notas") ? document.getElementById("notas").value.trim() : ""
    };
}

function inicializarFormularioPedidos() {
    const formulario = document.getElementById("form-nuevo-pedido");
    if (!formulario) return;

    formulario.addEventListener("submit", (evento) => {
        evento.preventDefault();
        
        let pedidosExistentes = API.obtener("pedidos_dolce_vida") || [];
        const editId = formulario.getAttribute("data-edit-id");
        const nuevoPedido = construirObjetoPedido();

        if (editId) {
            pedidosExistentes = pedidosExistentes.map(p => p.id === parseInt(editId) ? { ...p, ...nuevoPedido } : p);
            API.guardar("pedido_editar_id", "");
        } else {
            nuevoPedido.estado = "Pendiente";
            pedidosExistentes.push(nuevoPedido);
        }

        API.guardar("pedidos_dolce_vida", pedidosExistentes);
        mostrarGloboNotificacion("¡Pedido guardado en Inicio!", "#00a86b");
        
        setTimeout(() => {
            formulario.reset();
            window.location.href = "index.html";
        }, 1500);
    });
}

window.abrirGestorPresupuestos = () => {
    const presupuestos = (API.obtener("pedidos_dolce_vida") || []).filter(p => p.estado === "Cotización");
    
    let modal = document.getElementById("modal-presupuestos");
    if (!modal) {
        modal = document.createElement("div");
        modal.id = "modal-presupuestos";
        modal.className = "bottom-modal";
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>✨ Presupuestos Pendientes</h3>
                    <button onclick="document.getElementById('modal-presupuestos').classList.remove('open')">✕</button>
                </div>
                <div id="lista-presupuestos-dinamica" style="overflow-y: auto; padding: 10px;"></div>
            </div>
        `;
        document.body.appendChild(modal);
    }
    
    const lista = modal.querySelector("#lista-presupuestos-dinamica");
    lista.innerHTML = presupuestos.length > 0 ? presupuestos.map(p => `
        <div class="card-presupuesto">
            <div class="info">
                <strong>${p.cliente}</strong><br>
                <span>Total: $${p.total}</span>
            </div>
            <div class="acciones">
                <button class="btn-check" onclick="cambiarEstado(${p.id}, 'Confirmado')">✅</button>
                <button class="btn-cross" onclick="cambiarEstado(${p.id}, 'Rechazado')">❌</button>
            </div>
        </div>
    `).join('') : "<p style='text-align:center;'>No hay pendientes ✨</p>";
    
    modal.classList.add("open");
};

window.cambiarEstado = (id, accion) => {
    let pedidos = API.obtener("pedidos_dolce_vida") || [];
    
    if (accion === 'Confirmado') {
        pedidos = pedidos.map(p => p.id === id ? {...p, estado: "Pendiente"} : p);
    } else {
        pedidos = pedidos.filter(p => p.id !== id);
    }
    
    API.guardar("pedidos_dolce_vida", pedidos);
    abrirGestorPresupuestos();
};


window.generarCotizacion = () => {
    const cliente = document.getElementById("cliente").value.trim();
    if (!cliente) return alert("Ingresa el nombre del cliente.");

    const nuevoPedido = construirObjetoPedido();
    
    const divTemporal = document.createElement('div');
    divTemporal.innerHTML = window.obtenerHTMLCotizacion(nuevoPedido);
    
    // Posicionamiento absoluto
    divTemporal.style.position = "absolute";
    divTemporal.style.top = "0";
    divTemporal.style.left = "0";
    divTemporal.style.width = "210mm"; 
    // FORZAMOS ALTURA MÁXIMA LIGERAMENTE MENOR A A4 PARA EVITAR SALTO DE PÁGINA
    divTemporal.style.maxHeight = "290mm"; 
    divTemporal.style.overflow = "hidden";
    
    document.body.appendChild(divTemporal);

    const opciones = {
        margin: 0,
        filename: `Cotizacion_${cliente.replace(/\s+/g, '_')}.pdf`,
        image: { type: 'jpeg', quality: 1 },
        html2canvas: { 
            scale: 2, 
            useCORS: false,
            backgroundColor: '#fff0f3',
            // Usamos el scrollHeight pero con un tope para evitar la segunda hoja
            height: Math.min(divTemporal.scrollHeight, 1120) 
        },
        jsPDF: { 
            unit: 'mm', 
            format: 'a4', 
            orientation: 'portrait' 
        }
    };

    html2pdf().set(opciones).from(divTemporal).save().then(() => {
        document.body.removeChild(divTemporal);
        location.reload();
    }).catch(err => {
        console.error("Error:", err);
        document.body.removeChild(divTemporal);
    });
};
