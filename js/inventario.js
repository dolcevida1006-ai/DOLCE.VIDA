const EQUIVALENCIAS_SUPER = { 'g': 1, 'kg': 1000, 'ml': 1, 'l': 1000, 'unidades': 1, 'pzas': 1 };

document.addEventListener("DOMContentLoaded", () => {
    cargarInventario();

    // 🔍 Detección y limpieza inmediata de la bandera Poka-Yoke de inventario (Blindado)
    const insumoErrorCrudo = API.obtener("resaltar_insumo_error");
    if (insumoErrorCrudo) {
        API.eliminar("resaltar_insumo_error"); // Limpiamos bandera de inmediato

        const insumoErrorNombre = String(insumoErrorCrudo).toLowerCase();

        setTimeout(() => {
            const inventario = API.obtener("inventario_dolce_vida") || [];
            const contenedoresSwipe = document.querySelectorAll(".swipe-container");
            
            contenedoresSwipe.forEach((el, index) => {
                const insumo = inventario[index];
                if (insumo && insumo.nombre && insumo.nombre.toLowerCase() === insumoErrorNombre) {
                    const card = el.querySelector(".card");
                    if (card) {
                        card.style.border = "3px solid #d90429";
                        card.style.borderRadius = "10px";
                        card.style.background = "#fff0f3";
                        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }
            });
        }, 300);
    }

    const form = document.getElementById("form-nuevo-insumo");
    if (form) {
        form.addEventListener("submit", (e) => {
            e.preventDefault();
            const nombre = document.getElementById("insumo-nombre").value.trim();
            const cantidadIngresada = parseFloat(document.getElementById("insumo-cantidad").value);
            const unidadIngresada = document.getElementById("insumo-unidad").value.toLowerCase();
            const precioCompra = parseFloat(document.getElementById("insumo-precio").value) || 0;
            const cantidadBase = parseFloat(document.getElementById("insumo-cantidad-base").value) || 0;
            
            // Validación estricta para piezas
            if ((unidadIngresada === 'unidades' || unidadIngresada === 'pzas') && !Number.isInteger(cantidadIngresada)) {
                mostrarGloboNotificacion("Las piezas deben ser números enteros.", "#ff4d4d");
                return;
            }

            if (!nombre || isNaN(cantidadIngresada)) return;

            let inventario = API.obtener("inventario_dolce_vida");
            const editId = form.getAttribute("data-edit-id");

            if (editId) {
                // Modo Edición
                const index = parseInt(editId);
                inventario[index] = { nombre, cantidad: cantidadIngresada, unidad: unidadIngresada, precioCompra, cantidadBase };
                form.removeAttribute("data-edit-id");
            } else {
                // Modo Registro
                const index = inventario.findIndex(i => i.nombre.toLowerCase() === nombre.toLowerCase());
                if (index !== -1) {
                    const multIng = EQUIVALENCIAS_SUPER[unidadIngresada] || 1;
                    const multEx = EQUIVALENCIAS_SUPER[inventario[index].unidad.toLowerCase()] || 1;
                    inventario[index].cantidad += (cantidadIngresada * multIng) / multEx;
                    inventario[index].cantidad = parseFloat(inventario[index].cantidad.toFixed(2));
                    // Solo actualizamos precio si el usuario lo ingresó al agregar más stock
                    if (precioCompra > 0) {
                        inventario[index].precioCompra = precioCompra;
                        inventario[index].cantidadBase = cantidadBase;
                    }
                } else {
                    inventario.push({ nombre, cantidad: cantidadIngresada, unidad: unidadIngresada, precioCompra, cantidadBase });
                }
            }
            API.guardar("inventario_dolce_vida", inventario);
            form.reset();
            cargarInventario();
        });
    }
});

function cargarInventario() {
    const contenedor = document.getElementById("lista-inventario");
    if (!contenedor) return;
    const inventario = API.obtener("inventario_dolce_vida");
    contenedor.innerHTML = "";

    inventario.forEach((insumo, index) => {
        const swipeContainer = document.createElement("div");
        swipeContainer.className = "swipe-container";
        
        const mostrarCosto = (insumo.precioCompra > 0 && insumo.cantidadBase > 0) 
            ? `<p style="font-size: 0.8rem; color: #888; margin-top: 5px;">Costo: $${(insumo.precioCompra / insumo.cantidadBase * (['kg','l'].includes(insumo.unidad) ? 1 : (['unidades', 'pzas', 'pz'].includes(insumo.unidad) ? 1 : 1000))).toFixed(2)} / ${insumo.unidad === 'g' ? 'kg' : insumo.unidad === 'ml' ? 'L' : (['unidades', 'pzas', 'pz'].includes(insumo.unidad) ? 'unidad' : insumo.unidad)}`
            : "";
        
        swipeContainer.innerHTML = `
            <div class="swipe-actions">
                <button class="btn-action btn-editar" onclick="editarInsumo(${index})">✏️</button>
                <button class="btn-action btn-borrar-stock" onclick="eliminarInsumo(${index})">🗑️</button>
            </div>
            <div class="card" style="border-left: 5px solid #6c5ce7;">
                <h3>${insumo.nombre}</h3>
                <p style="font-size: 1.2rem; font-weight: bold; color: #6c5ce7;">${insumo.cantidad} <span style="font-size: 0.9rem; color: #666;">${insumo.unidad}</span></p>
                ${mostrarCosto}
            </div>
        `;
        
        let touchStartX = 0;
        swipeContainer.addEventListener('touchstart', e => touchStartX = e.touches[0].screenX);
        swipeContainer.addEventListener('touchend', e => {
            if (touchStartX - e.changedTouches[0].screenX > 50) swipeContainer.classList.add('swiped');
            else swipeContainer.classList.remove('swiped');
        });
        
        contenedor.appendChild(swipeContainer);
    });
}

window.editarInsumo = function(index) {
    const inventario = API.obtener("inventario_dolce_vida");
    const insumo = inventario[index];
    document.getElementById("insumo-nombre").value = insumo.nombre;
    document.getElementById("insumo-cantidad").value = insumo.cantidad;
    document.getElementById("insumo-unidad").value = insumo.unidad;
    document.getElementById("insumo-precio").value = insumo.precioCompra || "";
    document.getElementById("insumo-cantidad-base").value = insumo.cantidadBase || "";
    document.getElementById("form-nuevo-insumo").setAttribute("data-edit-id", index);
    window.scrollTo(0,0);
};

window.eliminarInsumo = function(index) {
    let inventario = API.obtener("inventario_dolce_vida");
    inventario.splice(index, 1);
    API.guardar("inventario_dolce_vida", inventario);
    cargarInventario();
};

window.abrirListaSuper = function() {
    const pedidos = API.obtener("pedidos_dolce_vida") || [];
    const recetas = API.obtener("recetas_dolce_vida") || [];
    const inventario = API.obtener("inventario_dolce_vida") || [];
    
    // 1. Tomamos los pendientes próximos a 4 días (Sin cambios en esta lógica)
    const hoy = new Date();
    const limite = new Date();
    limite.setDate(hoy.getDate() + 4);

    const pendientes = pedidos.filter(p => {
        // Asegurar que la fecha sea válida
        const fechaPedido = new Date(p.fecha);
        return p.estado !== "Entregado" && p.estado !== "Cotización" && fechaPedido <= limite;
    });

    if (pendientes.length === 0) {
        mostrarGloboNotificacion("No hay pedidos pendientes para los próximos 4 días.", "#f39c12");
        return;
    }

    // 2. Sumamos la DEMANDA BRUTA (Ajustado para manejar productos múltiples)
    let demandaBruta = {};
    pendientes.forEach(pedido => {
        // Soporte para estructura nueva (array productos) y antigua (objeto único)
        const listaProductos = pedido.productos || [{ recetaId: pedido.recetaId, nombre: pedido.producto, cantidad: pedido.cantidad }];
        
        listaProductos.forEach(item => {
            const receta = recetas.find(r => r.id === item.recetaId || r.nombre.toLowerCase() === (item.nombre || "").toLowerCase());
            if (!receta) return;

            const factor = item.cantidad / (receta.porciones || 1);
            receta.ingredientes.forEach(ing => {
                const nombre = ing.nombre.toLowerCase();
                const multIng = EQUIVALENCIAS_SUPER[ing.unidad.toLowerCase()] || 1;
                const consumo = ing.cantidad * factor * multIng;
                demandaBruta[nombre] = (demandaBruta[nombre] || 0) + consumo;
            });
        });
    });

    // 3. Comparamos contra el stock
    let listaCompras = {};
    Object.keys(demandaBruta).forEach(nombre => {
        const cantidadNecesaria = demandaBruta[nombre];
        const insumoStock = inventario.find(i => i.nombre.toLowerCase() === nombre);
        const stockActual = insumoStock ? (insumoStock.cantidad * (EQUIVALENCIAS_SUPER[insumoStock.unidad.toLowerCase()] || 1)) : 0;
        
        const falta = cantidadNecesaria - stockActual;
        if (falta > 0.1) { // Ajuste: solo si falta algo significativo
            listaCompras[nombre] = falta;
        }
    });

    if (Object.keys(listaCompras).length === 0) {
        mostrarGloboNotificacion("¡Stock suficiente para los próximos 4 días!", "#00a86b");
        return;
    }

    // 4. Formato de salida
    let textoLista = "📋 Lista de compras (Lo que te falta):\n\n";
    for (const [nombre, cantidadFaltante] of Object.entries(listaCompras)) {
        const insumoOriginal = inventario.find(i => i.nombre.toLowerCase() === nombre.toLowerCase()) || { unidad: 'g' };
        const unidadOriginal = insumoOriginal.unidad.toLowerCase();
        
        let textoLinea = "";
        
        if (['g', 'kg', 'ml', 'l'].includes(unidadOriginal)) {
            const esPeso = (unidadOriginal === 'g' || unidadOriginal === 'kg');
            const valorEnUnidadMayor = cantidadFaltante / 1000;
            const redondeado = Math.ceil(valorEnUnidadMayor * 2) / 2;
            const unidadVisual = esPeso ? "kg" : "L";
            textoLinea = `- ${nombre}: ${redondeado}${unidadVisual} (${cantidadFaltante.toFixed(0)}${esPeso ? 'g' : 'ml'})`;
        } else if (['unidades', 'pzas', 'pz'].includes(unidadOriginal)) {
            textoLinea = `- ${nombre}: ${Math.ceil(cantidadFaltante)}pz`;
        } else {
            textoLinea = `- ${nombre}: ${cantidadFaltante.toFixed(0)}${unidadOriginal}`;
        }
        textoLista += textoLinea + "\n";
    }
    
    // 5. Copiado seguro
    try {
        navigator.clipboard.writeText(textoLista).then(() => {
            mostrarGloboNotificacion("¡Lista de compras copiada!", "#00a86b");
        }).catch(err => {
            console.error("Error al copiar: ", err);
            alert("No se pudo copiar automáticamente. Aquí está tu lista:\n\n" + textoLista);
        });
    } catch (e) {
        alert(textoLista);
    }
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
