const EQUIVALENCIAS_SUPER = { 'g': 1, 'kg': 1000, 'ml': 1, 'l': 1000, 'unidades': 1, 'pzas': 1 };

document.addEventListener("DOMContentLoaded", () => {
    cargarInventario();
    const form = document.getElementById("form-nuevo-insumo");
    if (form) {
        form.addEventListener("submit", (e) => {
            e.preventDefault();
            const nombre = document.getElementById("insumo-nombre").value.trim();
            const cantidadIngresada = parseFloat(document.getElementById("insumo-cantidad").value);
            const unidadIngresada = document.getElementById("insumo-unidad").value.toLowerCase();
            
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
                inventario[index] = { nombre, cantidad: cantidadIngresada, unidad: unidadIngresada };
                form.removeAttribute("data-edit-id");
            } else {
                // Modo Registro
                const index = inventario.findIndex(i => i.nombre.toLowerCase() === nombre.toLowerCase());
                if (index !== -1) {
                    const multIng = EQUIVALENCIAS_SUPER[unidadIngresada] || 1;
                    const multEx = EQUIVALENCIAS_SUPER[inventario[index].unidad.toLowerCase()] || 1;
                    inventario[index].cantidad += (cantidadIngresada * multIng) / multEx;
                    inventario[index].cantidad = parseFloat(inventario[index].cantidad.toFixed(2));
                } else {
                    inventario.push({ nombre, cantidad: cantidadIngresada, unidad: unidadIngresada });
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
        
        swipeContainer.innerHTML = `
            <div class="swipe-actions">
                <button class="btn-action btn-editar" onclick="editarInsumo(${index})">✏️</button>
                <button class="btn-action btn-borrar-stock" onclick="eliminarInsumo(${index})">🗑️</button>
            </div>
            <div class="card" style="border-left: 5px solid #6c5ce7;">
                <h3>${insumo.nombre}</h3>
                <p style="font-size: 1.2rem; font-weight: bold; color: #6c5ce7;">${insumo.cantidad} <span style="font-size: 0.9rem; color: #666;">${insumo.unidad}</span></p>
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
    
    // 1. Tomamos TODOS los pendientes (independiente de si tienen stock o no)
    const pendientes = pedidos.filter(p => p.estado !== "Entregado");

    if (pendientes.length === 0) {
        mostrarGloboNotificacion("No hay pedidos pendientes.", "#f39c12");
        return;
    }

    // 2. Sumamos la DEMANDA BRUTA (Todo lo que se va a consumir)
    let demandaBruta = {};
    pendientes.forEach(pedido => {
        const receta = recetas.find(r => r.id === pedido.recetaId || r.nombre.toLowerCase() === pedido.producto.toLowerCase());
        if (!receta) return;

        const factor = pedido.cantidad / (receta.porciones || 1);
        receta.ingredientes.forEach(ing => {
            const nombre = ing.nombre.toLowerCase();
            const multIng = EQUIVALENCIAS_SUPER[ing.unidad.toLowerCase()] || 1;
            const consumo = ing.cantidad * factor * multIng;
            demandaBruta[nombre] = (demandaBruta[nombre] || 0) + consumo;
        });
    });

    // 3. Comparamos contra el stock. 
    // PARA QUE LA LISTA NO CAMBIE, usamos el stock que tenías ANTES de restar nada (si es posible) 
    // O mejor: calculamos el faltante basándonos en una suma fija.
    let listaCompras = {};
    Object.keys(demandaBruta).forEach(nombre => {
        // En lugar de restar el inventario actual, vamos a calcular cuánto falta 
        // respecto a lo que necesitas para cubrir TODO el volumen de pendientes.
        const cantidadNecesaria = demandaBruta[nombre];
        
        // Buscamos cuánto tienes disponible en almacén
        const insumoStock = inventario.find(i => i.nombre.toLowerCase() === nombre);
        const stockActual = insumoStock ? (insumoStock.cantidad * EQUIVALENCIAS_SUPER[insumoStock.unidad.toLowerCase()]) : 0;
        
        // NOTA: Para que sea estable, aquí podrías sumar lo que ya se entregó 
        // si quieres ver el faltante "real" de la semana. 
        // Pero para que NO CAMBIE, simplemente mostraremos la demanda bruta:
        listaCompras[nombre] = cantidadNecesaria;
    });

    // 4. Formato de salida
    let textoLista = "📋 Lista de compras (Previsión total):\n\n";
    for (const [nombre, cantidadBase] of Object.entries(listaCompras)) {
        const insumoOriginal = inventario.find(i => i.nombre.toLowerCase() === nombre.toLowerCase()) || { unidad: 'g' };
        const unidadOriginal = insumoOriginal.unidad.toLowerCase();
        
        let textoLinea = "";
        if (unidadOriginal === 'kg' || unidadOriginal === 'l') {
            const valorEnUnidad = cantidadBase / 1000;
            let redondeado = Math.ceil(valorEnUnidad * 2) / 2;
            if (redondeado === 0) redondeado = 0.5;
            textoLinea = `- ${nombre}: ${redondeado}${unidadOriginal}  (${cantidadBase.toFixed(0)}${unidadOriginal === 'kg' ? 'g' : 'ml'})`;
        } else if (unidadOriginal === 'unidades' || unidadOriginal === 'pzas') {
            textoLinea = `- ${nombre}: ${Math.ceil(cantidadBase)}pz`;
        } else {
            textoLinea = `- ${nombre}: ${cantidadBase.toFixed(0)}${unidadOriginal}`;
        }
        textoLista += textoLinea + "\n";
    }
    
    navigator.clipboard.writeText(textoLista).then(() => {
        mostrarGloboNotificacion("¡Lista de compras copiada!", "#00a86b");
    });
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