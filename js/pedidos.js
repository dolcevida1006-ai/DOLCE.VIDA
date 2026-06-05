// ==========================================
// dolce.vida - MÓDULO DE PEDIDOS COMPLETO V2
// ==========================================

document.addEventListener("DOMContentLoaded", () => {
    cargarRecetasEnSelector();
    verificarModoEdicion();
    inicializarFormularioPedidos();
});

// Función de notificación elegante
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
        document.querySelector(".app-header p").innerText = "✏️ Editando Pedido Existente";
        document.getElementById("cliente").value = pedido.cliente;
        document.getElementById("producto").value = pedido.recetaId;
        document.getElementById("cantidad").value = pedido.cantidad;
        document.getElementById("fecha-entrega").value = pedido.fecha;
        document.getElementById("hora-entrega").value = pedido.hora;
        document.getElementById("notas").value = pedido.notas || "";
        document.getElementById("form-nuevo-pedido").setAttribute("data-edit-id", editId);
    }
}

function inicializarFormularioPedidos() {
    const formulario = document.getElementById("form-nuevo-pedido");
    if (formulario) {
        formulario.addEventListener("submit", (evento) => {
            evento.preventDefault(); 
            const cliente = document.getElementById("cliente").value.trim();
            const productoSelect = document.getElementById("producto");
            const recetaId = productoSelect.value;
            const productoTexto = productoSelect.options[productoSelect.selectedIndex].text;
            const cantidad = document.getElementById("cantidad").value;
            const fecha = document.getElementById("fecha-entrega").value;
            const hora = document.getElementById("hora-entrega").value;
            const notasInput = document.getElementById("notas").value.trim();

            let pedidosExistentes = API.obtener("pedidos_dolce_vida") || [];
            const editId = formulario.getAttribute("data-edit-id");

            if (editId) {
                pedidosExistentes = pedidosExistentes.map(p => p.id === parseInt(editId) ? {
                    ...p,
                    recetaId: parseInt(recetaId),
                    cliente: cliente,
                    producto: productoTexto.split(" (Rinde")[0],
                    cantidad: parseInt(cantidad),
                    fecha: fecha,
                    hora: hora,
                    notas: notasInput
                } : p);
                API.guardar("pedido_editar_id", "");
            } else {
                const nuevoPedido = {
                    id: Date.now(),
                    recetaId: parseInt(recetaId),
                    cliente: cliente,
                    producto: productoTexto.split(" (Rinde")[0],
                    cantidad: parseInt(cantidad),
                    fecha: fecha,
                    hora: hora,
                    notas: notasInput,
                    estado: "Pendiente" 
                };
                pedidosExistentes.push(nuevoPedido);
            }

            API.guardar("pedidos_dolce_vida", pedidosExistentes);
            
            mostrarGloboNotificacion("¡Cambios guardados con éxito!", "#00a86b");
            
            setTimeout(() => {
                formulario.reset();
                window.location.href = "index.html";
            }, 1500);
        });
    }
}