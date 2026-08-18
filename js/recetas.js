// ==========================================
// dolce.vida - MÓDULO DE RECETAS V2.8
// ==========================================

document.addEventListener("DOMContentLoaded", () => {
    inicializarModal();
    inicializarEventos();
    mostrarRecetas();
});
const MARGEN_UTILIDAD = 0.70;

function inicializarModal() {
    const modal = document.getElementById("modal-receta");
    const btnAbrir = document.getElementById("btn-abrir-modal");
    const btnCerrar = document.getElementById("btn-cerrar-modal");

    if (btnAbrir) btnAbrir.addEventListener("click", () => {
        const form = document.getElementById("form-nueva-receta");
        if (form) {
            form.removeAttribute("data-edit-id");
            form.reset();
        }
        const porcionesInput = document.getElementById("receta-porciones");
        if (porcionesInput) porcionesInput.value = 1;
        
        const contenedorInsumos = document.getElementById("contenedor-insumos-dinamicos");
        if (contenedorInsumos) contenedorInsumos.innerHTML = "";
        
        agregarFilaIngrediente();
        if (modal) modal.classList.add("open");
    });
    if (btnCerrar && modal) btnCerrar.addEventListener("click", () => modal.classList.remove("open"));
}

function inicializarEventos() {
    const btnAgregar = document.getElementById("btn-agregar-ingrediente");
    if (btnAgregar) btnAgregar.addEventListener("click", () => agregarFilaIngrediente());
    
    const formReceta = document.getElementById("form-nueva-receta");
    if (formReceta) {
        formReceta.addEventListener("submit", (e) => {
            e.preventDefault();
            guardarReceta();
        });
    }
}

function agregarFilaIngrediente(datos = null) {
    const contenedor = document.getElementById("contenedor-insumos-dinamicos");
    if (!contenedor) return;
    
    const inventario = API.obtener("inventario_dolce_vida") || [];
    
    if (inventario.length === 0) {
        alert("⚠️ Registra insumos en Stock primero.");
        return;
    }

    const fila = document.createElement("div");
    fila.className = "fila-ingrediente";
    
    fila.innerHTML = `
        <select class="select-ingrediente" onchange="adaptarUnidadesReceta(this); calcularCostoReceta();" style="flex: 2;">
            ${inventario.map(ins => `<option value="${ins.nombre}" data-familia="${obtenerFamilia(ins.unidad)}">${ins.nombre}</option>`).join('')}
        </select>
        <input type="number" class="input-cantidad-ing" placeholder="Cant." step="any" required oninput="calcularCostoReceta()" style="flex: 1; width: 50px;">
        <select class="select-unidad-receta" onchange="calcularCostoReceta()" style="flex: 1;"></select>
        <button type="button" class="btn-eliminar-ing" onclick="this.parentElement.remove(); calcularCostoReceta();">✕</button>
    `;
    contenedor.appendChild(fila);

    if (datos) {
        fila.querySelector(".select-ingrediente").value = datos.nombre;
        adaptarUnidadesReceta(fila.querySelector(".select-ingrediente"));
        fila.querySelector(".select-unidad-receta").value = datos.unidad;
        fila.querySelector(".input-cantidad-ing").value = datos.cantidad;
    } else {
        adaptarUnidadesReceta(fila.querySelector(".select-ingrediente"));
    }
}

window.adaptarUnidadesReceta = (select) => {
    const fila = select.parentElement;
    const unidadSel = fila.querySelector(".select-unidad-receta");
    const familia = select.options[select.selectedIndex].getAttribute("data-familia");
    unidadSel.innerHTML = familia === "peso" ? '<option value="g">g</option><option value="kg">kg</option>' :
                          familia === "volumen" ? '<option value="ml">ml</option><option value="l">L</option>' :
                          '<option value="unidades">pzas</option>';
};

function obtenerFamilia(u) {
    return (u === "kg" || u === "g") ? "peso" : (u === "l" || u === "ml") ? "volumen" : "unidades";
}

window.calcularCostoReceta = () => {
    const inventario = API.obtener("inventario_dolce_vida") || [];
    const filas = document.querySelectorAll(".fila-ingrediente");
    let costoTotal = 0;

    filas.forEach(f => {
        const nombre = f.querySelector(".select-ingrediente").value;
        const cantidad = parseFloat(f.querySelector(".input-cantidad-ing").value) || 0;
        const unidadReceta = f.querySelector(".select-unidad-receta").value;
        
        const insumo = inventario.find(i => i.nombre === nombre);
        
        if (insumo && insumo.precioCompra > 0) {
            const precioUnitarioBase = insumo.precioCompra / insumo.cantidadBase;
            let cantidadEnBase = cantidad;
            
            if ((unidadReceta === 'g' && insumo.unidad === 'kg') || (unidadReceta === 'ml' && insumo.unidad === 'l')) {
                cantidadEnBase = cantidad / 1000;
            } else if ((unidadReceta === 'kg' && insumo.unidad === 'g') || (unidadReceta === 'l' && insumo.unidad === 'ml')) {
                cantidadEnBase = cantidad * 1000;
            }
            
            costoTotal += (cantidadEnBase * precioUnitarioBase);
        }
    });

    const sugerido = costoTotal * 1.70;
    const displayCosto = document.getElementById("display-costo-receta");
    const displaySugerido = document.getElementById("display-sugerido");
    
    if (displayCosto) displayCosto.innerText = `Costo producción: $${costoTotal.toFixed(2)}`;
    if (displaySugerido) displaySugerido.innerText = `Precio sugerido (+70%): $${sugerido.toFixed(2)}`;
};

window.guardarReceta = () => {
    const form = document.getElementById("form-nueva-receta");
    const nombre = document.getElementById("receta-nombre").value;
    const porciones = parseInt(document.getElementById("receta-porciones").value) || 1;
    const precioVenta = parseFloat(document.getElementById("receta-precio-venta").value) || 0;
    const filas = document.querySelectorAll(".fila-ingrediente");
    let ingredientes = [];
    
    // --- CALCULAMOS EL COSTO TOTAL REAL ANTES DE GUARDAR ---
    const inventario = API.obtener("inventario_dolce_vida") || [];
    let costoTotalCalculado = 0;

    filas.forEach(f => {
        const ingNombre = f.querySelector(".select-ingrediente").value;
        const cantidad = parseFloat(f.querySelector(".input-cantidad-ing").value) || 0;
        const unidadReceta = f.querySelector(".select-unidad-receta").value;
        
        ingredientes.push({
            nombre: ingNombre,
            cantidad: cantidad,
            unidad: unidadReceta
        });

        const insumo = inventario.find(i => i.nombre === ingNombre);
        if (insumo && insumo.precioCompra > 0) {
            const precioUnitarioBase = insumo.precioCompra / insumo.cantidadBase;
            let cantidadEnBase = cantidad;
            
            if ((unidadReceta === 'g' && insumo.unidad === 'kg') || (unidadReceta === 'ml' && insumo.unidad === 'l')) {
                cantidadEnBase = cantidad / 1000;
            } else if ((unidadReceta === 'kg' && insumo.unidad === 'g') || (unidadReceta === 'l' && insumo.unidad === 'ml')) {
                cantidadEnBase = cantidad * 1000;
            }
            costoTotalCalculado += (cantidadEnBase * precioUnitarioBase);
        }
    });

    let recetas = API.obtener("recetas_dolce_vida") || [];
    const editId = form.getAttribute("data-edit-id");

    if (editId) {
        recetas = recetas.map(r => r.id == editId ? { id: parseInt(editId), nombre, porciones, ingredientes, precioVenta, costoTotal: costoTotalCalculado } : r);
    } else {
        recetas.push({ id: Date.now(), nombre, porciones, ingredientes, precioVenta, costoTotal: costoTotalCalculado });
    }

    API.guardar("recetas_dolce_vida", recetas);
    form.reset();
    document.getElementById("modal-receta").classList.remove("open");
    mostrarRecetas();
};

window.mostrarRecetas = () => {
    const cont = document.getElementById("lista-recetas");
    if (!cont) return;
    
    let recetas = API.obtener("recetas_dolce_vida") || [];
    const inventario = API.obtener("inventario_dolce_vida") || [];
    const nombresInventario = inventario.map(i => i.nombre);

    recetas = recetas.map(r => ({
        ...r,
        ingredientes: r.ingredientes.filter(ing => nombresInventario.includes(ing.nombre))
    }));
    API.guardar("recetas_dolce_vida", recetas);

    cont.innerHTML = recetas.map(r => `
        <div class="swipe-container" id="receta-${r.id}" ontouchstart="handleTouchStart(event)" ontouchend="handleTouchEnd(event, ${r.id})">
            <div class="swipe-actions">
                <button class="btn-action btn-editar" onclick="abrirEditarReceta(${r.id})">✏️</button>
                <button class="btn-action btn-borrar-stock" onclick="eliminarReceta(${r.id})">🗑️</button>
            </div>
            <div class="card card-receta">
                <h3>${r.nombre}</h3>
                <p><small>Rinde: ${r.porciones || 1} pzas</small></p>
                <div id="ing-${r.id}" class="detalles-ingredientes">
                    <ul>${r.ingredientes.map(i => `<li>${i.nombre}: ${i.cantidad} ${i.unidad}</li>`).join('')}</ul>
                </div>
                <button class="btn-toggle-view" onclick="toggleIngredientes(${r.id})">👁️ Ver Ingredientes</button>
            </div>
        </div>
    `).join('');
};

let touchStartX = 0;
window.handleTouchStart = (e) => touchStartX = e.touches[0].screenX;
window.handleTouchEnd = (e, id) => {
    const delta = touchStartX - e.changedTouches[0].screenX;
    const container = document.getElementById(`receta-${id}`);
    if (container) {
        if (delta > 50) container.classList.add('swiped');
        else if (delta < -50) container.classList.remove('swiped');
    }
};

window.toggleIngredientes = (id) => {
    const el = document.getElementById(`ing-${id}`);
    if (el) el.classList.toggle("expandido");
};

window.abrirEditarReceta = (id) => {
    const r = API.obtener("recetas_dolce_vida").find(x => x.id === id);
    if (!r) return;
    
    const inputNombre = document.getElementById("receta-nombre");
    const inputPorciones = document.getElementById("receta-porciones");
    const inputPrecioVenta = document.getElementById("receta-precio-venta");
    const contenedorInsumos = document.getElementById("contenedor-insumos-dinamicos");
    
    if (inputNombre) inputNombre.value = r.nombre;
    if (inputPorciones) inputPorciones.value = r.porciones || 1;
    if (inputPrecioVenta) inputPrecioVenta.value = r.precioVenta || 0;
    
    if (contenedorInsumos) contenedorInsumos.innerHTML = "";
    
    // Cargar ingredientes
    r.ingredientes.forEach(i => agregarFilaIngrediente(i));
    
    calcularCostoReceta();
    
    const form = document.getElementById("form-nueva-receta");
    if (form) {
        form.setAttribute("data-edit-id", id);
    }
    
    const modal = document.getElementById("modal-receta");
    if (modal) {
        modal.classList.add("open");
    }
};

window.eliminarReceta = (id) => {
    confirmarAccion("¿Estás seguro de que quieres eliminar esta receta?", () => {
        const recetas = API.obtener("recetas_dolce_vida") || [];
        API.guardar("recetas_dolce_vida", recetas.filter(r => r.id !== id));
        mostrarRecetas();
    });
};

window.confirmarAccion = function(mensaje, onConfirm) {
    let overlay = document.getElementById('modal-confirmacion-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'modal-confirmacion-overlay';
        overlay.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); display:flex; align-items:center; justify-content:center; z-index:2000;";
        overlay.innerHTML = `
            <div style="background:white; padding:25px; border-radius:15px; width:85%; max-width:300px; text-align:center; box-shadow: 0 10px 25px rgba(0,0,0,0.3);">
                <h3 style="margin-top:0;">⚠️ Confirmar</h3>
                <p id="mensaje-confirm" style="color:#555;"></p>
                <div style="display:flex; justify-content:space-between; margin-top:20px;">
                    <button id="btn-no" style="padding:10px 20px; border:none; border-radius:8px; background:#eee; cursor:pointer;">No</button>
                    <button id="btn-si" style="padding:10px 20px; border:none; border-radius:8px; background:#ff4d4d; color:white; cursor:pointer;">Sí</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
    }
    document.getElementById('mensaje-confirm').innerText = mensaje;
    overlay.style.display = 'flex';
    document.getElementById('btn-si').onclick = () => { overlay.style.display = 'none'; onConfirm(); };
    document.getElementById('btn-no').onclick = () => { overlay.style.display = 'none'; };
};
