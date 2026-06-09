window.obtenerHTMLCotizacion = (pedido) => {
    return `
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Quicksand:wght@400;600&display=swap');
        
        /* Forzamos que todo el fondo sea rosa pastel */
        body { margin: 0; padding: 0; background-color: #fff0f3; }
        
        .hoja { 
            width: 210mm; 
            min-height: 297mm; /* Asegura que cubra el alto de la A4 */
            font-family: 'Quicksand', sans-serif; 
            background-color: #fff0f3; /* Rosa pastel */
            padding: 15mm; 
            display: block; 
            margin: 0;
        }
        
        .header-container {
            width: 100%;
            border: 2px solid #ffb0c2;
            display: flex;
            align-items: center;
            padding: 20px;
            gap: 20px;
            background: #ffffff; /* Mantenemos blanco el interior para legibilidad */
            margin-bottom: 20px;
            border-radius: 10px;
        }
        
        .logo-img { width: 100px; height: 100px; object-fit: contain; }
        .datos-header { flex-grow: 1; color: #d63384; font-weight: 600; line-height: 2.2; font-size: 14px; }
        .datos-header span { border-bottom: 1px solid #d63384; display: inline-block; width: 50%; }

        table { width: 100%; border-collapse: collapse; background: #ffffff; border-radius: 10px; overflow: hidden; margin-top: 10px; }
        th { background: #ffb0c2; color: white; padding: 12px; text-align: left; }
        td { padding: 12px; border-bottom: 1px solid #ffccd5; color: #666; }
        
        .total { font-size: 22px; font-weight: 700; text-align: right; margin-top: 20px; color: #d63384; }
    </style>

    <div class="hoja">
        <div class="header-container">
            <img src="${window.ASSETS.LOGO_BASE64}" class="logo-img">
            <div class="datos-header">
                <div>Nombre del Cliente: <span>${pedido.cliente}</span></div>
                <div>Fecha de Entrega: <span>${pedido.fecha}</span></div>
                <div>Hora de Entrega: <span>${pedido.hora}</span></div>
            </div>
        </div>

        <table>
            <thead><tr><th>Descripción</th><th>Cant.</th><th>Precio</th></tr></thead>
            <tbody>
                ${pedido.productos.map(p => `
                    <tr>
                        <td>${p.nombre}</td>
                        <td>${p.cantidad}</td>
                        <td>$${parseFloat(p.precioFinal).toFixed(2)}</td>
                    </tr>`).join('')}
            </tbody>
        </table>
        <div class="total">TOTAL: $${pedido.total}</div>
    </div>`;
};