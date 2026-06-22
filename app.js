// --- CONFIGURACIÓN DE SEGURIDAD ---
const PIN_SEGURIDAD = "1726"; 

// --- MAESTRO DE CATÁLOGO DE CUENTAS CAFETERÍA ---
const CLASIFICACION_CUENTAS = {
    // 1. Activos
    "Caja / Caja Chica": "Activo",
    "Bancos": "Activo",
    "Inventario de Materia Prima": "Activo",
    "Inventario de Desechables y Empaques": "Activo",
    "Mobiliario y Equipo": "Activo",
    "Equipo de Operación (Maquinaria)": "Activo",
    
    // 2. Pasivos
    "Proveedores": "Pasivo",
    "Acreedores Diversos": "Pasivo",
    "Impuestos por Pagar": "Pasivo",
    "Préstamos Bancarios": "Pasivo",
    
    // 3. Capital
    "Capital Social": "Capital",
    "Utilidades Retenidas / Acumuladas": "Capital",
    
    // 4. Ingresos
    "Ventas de Alimentos y Bebidas": "Ingreso",
    "Ventas de Productos de Especialidad": "Ingreso",
    "Otros Ingresos": "Ingreso",
    
    // 5. Costos y Gastos
    "Costo de Materia Prima": "Gasto",
    "Gastos de Personal / Nómina": "Gasto",
    "Arrendamiento / Alquiler": "Gasto",
    "Servicios Públicos (Luz, Agua, Internet)": "Gasto",
    "Marketing y Publicidad": "Gasto",
    "Mantenimiento y Reparación": "Gasto",
    "Comisiones de Plataformas de Delivery": "Gasto"
};

// --- ESTADO INICIAL ---
let mesActual = {
    transacciones: JSON.parse(localStorage.getItem('transacciones')) || [],
    ventas: JSON.parse(localStorage.getItem('ventas')) || []
};

let historial = JSON.parse(localStorage.getItem('historial_completo')) || [];
let indiceMesSeleccionado = null; 

// --- VALIDADOR DE PIN ---
function verificarPin() {
    const inputPin = prompt(" Operación restringida. Ingrese el PIN de seguridad:");
    if (inputPin === PIN_SEGURIDAD) {
        return true;
    }
    if (inputPin !== null) {
        alert("PIN Incorrecto. Operación cancelada.");
    }
    return false;
}

// --- NAVEGACIÓN ---
function cambiarSeccion(idSeccion) {
    document.querySelectorAll('.modulo').forEach(sec => sec.classList.add('oculto'));
    document.getElementById(`seccion-${idSeccion}`).classList.remove('oculto');
}

// --- MANEJADOR: NUEVA VENTA RÁPIDA ---
document.getElementById('form-venta').addEventListener('submit', function(e) {
    e.preventDefault();
    if (indiceMesSeleccionado !== null) {
        return alert("Estás en modo consulta (Historial).");
    }

    const nuevaVenta = {
        id: Date.now(),
        fecha: document.getElementById('venta-fecha').value,
        producto: document.getElementById('venta-producto').value,
        destino: document.getElementById('venta-destino').value, 
        monto: parseFloat(document.getElementById('venta-monto').value) || 0
    };

    mesActual.ventas.push(nuevaVenta);
    guardarDatosLocalmente();
    calcularYRenderizar();
    this.reset();
});

// --- MANEJADOR: NUEVO ASIENTO MANUAL EN PARTIDA DOBLE SIMULTÁNEA ---
document.getElementById('form-asiento').addEventListener('submit', function(e) {
    e.preventDefault();
    if (indiceMesSeleccionado !== null) {
        return alert("Estás en modo consulta (Historial).");
    }

    const cDebe = document.getElementById('cuenta-debe').value;
    const cHaber = document.getElementById('cuenta-haber').value;

    if (cDebe === cHaber) {
        return alert(" Error contable: La cuenta deudora y la cuenta acreedora no pueden ser la misma.");
    }

    const nuevoAsientoPD = {
        id: Date.now(),
        fecha: document.getElementById('fecha').value,
        concepto: document.getElementById('concepto').value,
        cuentaDebe: cDebe,
        cuentaHaber: cHaber,
        monto: parseFloat(document.getElementById('monto').value) || 0
    };

    mesActual.transacciones.push(nuevoAsientoPD);
    guardarDatosLocalmente();
    calcularYRenderizar();
    this.reset();
});

// --- OPERACIONES DE ELIMINACIÓN ---
function eliminarVenta(id) {
    if (verificarPin()) {
        mesActual.ventas = mesActual.ventas.filter(v => v.id !== id);
        guardarDatosLocalmente();
        calcularYRenderizar();
    }
}

// --- CORRECCIÓN EXTRA PARA PREVENIR ERRORES EN ELIMINACIONES PARCIALES ---
function eliminarAsiento(id) {
    if (verificarPin()) {
        mesActual.transacciones = mesActual.transacciones.filter(t => t.id !== id);
        guardarDatosLocalmente();
        calcularYRenderizar();
    }
}

function eliminarMesHistorial(index) {
    if (verificarPin()) {
        historial.splice(index, 1);
        localStorage.setItem('historial_completo', JSON.stringify(historial));
        renderizarListaHistorial();
        if (indiceMesSeleccionado === index) {
            volverAlMesActual();
        }
    }
}

function eliminarTodoElSistema() {
    if (confirm("⚠ ¿CONFIRMA LIMPIAR ABSOLUTAMENTE TODOS LOS REGISTROS HISTÓRICOS?")) {
        if (verificarPin()) {
            localStorage.clear();
            mesActual.transacciones = []; 
            mesActual.ventas = []; 
            historial = [];
            indiceMesSeleccionado = null;
            guardarDatosLocalmente(); 
            renderizarListaHistorial(); 
            volverAlMesActual();
            alert("Sistema reestablecido.");
        }
    }
}

// --- MOTOR FINANCIERO INTEGRADO CON FILAS DE PARTIDA DOBLE (BLINDADO) ---
function calcularYRenderizar() {
    const datosAProcesar = (indiceMesSeleccionado === null) ? mesActual : historial[indiceMesSeleccionado].datos;

    let ingresos = 0;
    let gastos = 0;
    
    let saldosCuentas = {};
    Object.keys(CLASIFICACION_CUENTAS).forEach(c => {
        saldosCuentas[c] = 0;
    });

    let datosMayor = {};
    Object.keys(CLASIFICACION_CUENTAS).forEach(cuenta => {
        datosMayor[cuenta] = { debe: [], haber: [], totalDebe: 0, totalHaber: 0 };
    });

    const tbodyDiario = document.querySelector('#tabla-diario tbody');
    const tbodyVentas = document.querySelector('#tabla-ventas-directas tbody');
    
    if (tbodyDiario) tbodyDiario.innerHTML = '';
    if (tbodyVentas) tbodyVentas.innerHTML = '';

    const btnEliminarHtml = (id, tipo) => (indiceMesSeleccionado === null)  
        ? `<button class="btn-eliminar" onclick="${tipo === 'venta' ? 'eliminarVenta' : 'eliminarAsiento'}(${id})">Eliminar</button>` 
        : `-`;

    // 1. PROCESAR VENTAS DIRECTAS (AUTOMÁTICAS DEUDOR/ACREEDOR)
    if (datosAProcesar.ventas) {
        datosAProcesar.ventas.forEach(v => {
            const montoValido = parseFloat(v.monto) || 0;
            const cuentaDestinoElegida = v.destino || "Caja / Caja Chica"; 

            // Control de seguridad por si la cuenta no está bien mapeada en catálogo viejo
            if (!datosMayor[cuentaDestinoElegida] || !datosMayor[v.producto]) {
                return; 
            }

            if (tbodyVentas) {
                const filaV = document.createElement('tr');
                filaV.innerHTML = `
                    <td>${v.fecha}</td>
                    <td>${v.producto}</td>
                    <td><strong style="color:#2980b9;">${cuentaDestinoElegida}</strong></td>
                    <td>$${montoValido.toFixed(2)}</td>
                    <td>${btnEliminarHtml(v.id, 'venta')}</td>
                `;
                tbodyVentas.appendChild(filaV);
            }

            ingresos += montoValido; 

            datosMayor[cuentaDestinoElegida].debe.push({ concepto: `Venta Directa`, monto: montoValido });
            datosMayor[cuentaDestinoElegida].totalDebe += montoValido;

            datosMayor[v.producto].haber.push({ concepto: `Venta Registrada`, monto: montoValido });
            datosMayor[v.producto].totalHaber += montoValido;

            if (tbodyDiario) {
                const filaBloqueVenta = document.createElement('tr');
                filaBloqueVenta.className = "bloque-asiento-diario";
                filaBloqueVenta.innerHTML = `
                    <td>${v.fecha}</td>
                    <td>
                        <div><strong>[Venta] Factura POS</strong></div>
                        <div style="font-size:11px; color:#7f8c8d; margin-top:4px;">Cierre rápido</div>
                    </td>
                    <td>
                        <div class="cuenta-deudora">${cuentaDestinoElegida}</div>
                        <div class="cuenta-acreedora">a ${v.producto}</div>
                    </td>
                    <td>
                        <div class="cuenta-deudora">$${montoValido.toFixed(2)}</div>
                        <div style="color:#ccc; font-size:11px;">-</div>
                    </td>
                    <td>
                        <div style="color:#ccc; font-size:11px;">-</div>
                        <div class="cuenta-acreedora">$${montoValido.toFixed(2)}</div>
                    </td>
                    <td>${btnEliminarHtml(v.id, 'venta')}</td>
                `;
                tbodyDiario.appendChild(filaBloqueVenta);
            }
        });
    }

    // 2. PROCESAR ASIENTOS MANUALES EXIGIENDO DEUDOR Y ACREEDOR EN PAREJA
    if (datosAProcesar.transacciones) {
        datosAProcesar.transacciones.forEach(t => {
            const montoValido = parseFloat(t.monto) || 0;
            
            // FILTRO DEFENSIVO: Si alguna de las cuentas del asiento no existe en el catálogo actual, saltarla
            if (!datosMayor[t.cuentaDebe] || !datosMayor[t.cuentaHaber]) {
                return; 
            }

            const grupoDebe = CLASIFICACION_CUENTAS[t.cuentaDebe];
            const grupoHaber = CLASIFICACION_CUENTAS[t.cuentaHaber];

            // Cargar en el Mayor de la cuenta deudora
            datosMayor[t.cuentaDebe].debe.push({ concepto: t.concepto, monto: montoValido });
            datosMayor[t.cuentaDebe].totalDebe += montoValido;

            // Abonar en el Mayor de la cuenta acreedora
            datosMayor[t.cuentaHaber].haber.push({ concepto: t.concepto, monto: montoValido });
            datosMayor[t.cuentaHaber].totalHaber += montoValido;

            if (tbodyDiario) {
                const filaD = document.createElement('tr');
                filaD.className = "bloque-asiento-diario";
                filaD.innerHTML = `
                    <td>${t.fecha}</td>
                    <td><strong>${t.concepto}</strong></td>
                    <td>
                        <div class="cuenta-deudora">${t.cuentaDebe}</div>
                        <div class="cuenta-acreedora">a ${t.cuentaHaber}</div>
                    </td>
                    <td>
                        <div class="cuenta-deudora">$${montoValido.toFixed(2)}</div>
                        <div style="color:#ccc; font-size:11px;">-</div>
                    </td>
                    <td>
                        <div style="color:#ccc; font-size:11px;">-</div>
                        <div class="cuenta-acreedora">$${montoValido.toFixed(2)}</div>
                    </td>
                    <td>${btnEliminarHtml(t.id, 'asiento')}</td>
                `;
                tbodyDiario.appendChild(filaD);
            }

            // Sumar flujos para el Estado de Resultados según los grupos impactados
            if (grupoDebe === "Ingreso") { ingresos += montoValido; }
            if (grupoDebe === "Gasto") { gastos += montoValido; }
            if (grupoHaber === "Ingreso") { ingresos += montoValido; }
            if (grupoHaber === "Gasto") { gastos += montoValido; }
        });
    }

    // --- CALCULAR SALDOS NETOS MATRICIALES ---
    Object.keys(datosMayor).forEach(nombreCuenta => {
        const cData = datosMayor[nombreCuenta];
        const grupo = CLASIFICACION_CUENTAS[nombreCuenta];
        
        if (grupo === "Activo" || grupo === "Gasto") {
            saldosCuentas[nombreCuenta] = cData.totalDebe - cData.totalHaber;
        } else {
            saldosCuentas[nombreCuenta] = cData.totalHaber - cData.totalDebe;
        }
    });

    // --- RENDERIZAR LIBRO MAYOR (CUENTAS T) ---
    const contenedorMayor = document.getElementById('contenedor-mayor');
    if (contenedorMayor) {
        contenedorMayor.innerHTML = '';

        Object.keys(datosMayor).forEach(nombreCuenta => {
            const cData = datosMayor[nombreCuenta];
            
            // VERIFICACIÓN DE CONTROL ABSOLUTO CONTRA PROPIEDADES INDEFINIDAS
            if (!cData || typeof cData.totalDebe === 'undefined') {
                return; 
            }

            if (cData.totalDebe > 0 || cData.totalHaber > 0) {
                const grupo = CLASIFICACION_CUENTAS[nombreCuenta];
                const esDeudor = (grupo === "Activo" || grupo === "Gasto");
                const saldoNeto = saldosCuentas[nombreCuenta];

                const divT = document.createElement('div');
                divT.className = 'cuenta-t';
                
                let filasT = '';
                const limite = Math.max(cData.debe.length, cData.haber.length);
                for (let i = 0; i < limite; i++) {
                    const dMonto = cData.debe[i] ? `$${cData.debe[i].monto.toFixed(2)}` : '';
                    const hMonto = cData.haber[i] ? `$${cData.haber[i].monto.toFixed(2)}` : '';
                    filasT += `<tr><td class="col-debe">${dMonto}</td><td class="col-haber">${hMonto}</td></tr>`;
                }

                divT.innerHTML = `
                    <h4>${nombreCuenta}</h4>
                    <table class="tabla-t">
                        <thead><tr><th style="border-right:1px solid #b6a396;">DEBE</th><th>HABER</th></tr></thead>
                        <tbody>
                            ${filasT}
                            <tr style="background:#f9f9f9; font-weight:bold;">
                                <td class="col-debe">$${cData.totalDebe.toFixed(2)}</td>
                                <td class="col-haber">$${cData.totalHaber.toFixed(2)}</td>
                            </tr>
                        </tbody>
                    </table>
                    <div class="saldo-final-t"><span>SALDO:</span><span style="color: ${saldoNeto >= 0 ? '#27ae60' : '#c0392b'}">$${Math.abs(saldoNeto).toFixed(2)} ${esDeudor ? '(Deudor)' : '(Acreedor)'}</span></div>
                `;
                contenedorMayor.appendChild(divT);
            }
        });
    }

    // --- ESTADO DE RESULTADOS ---
    const utilidadNeta = ingresos - gastos;
    const eIngresos = document.getElementById('res-ingresos');
    const eGastos = document.getElementById('res-gastos');
    const eUtilidad = document.getElementById('res-utilidad');
    
    if (eIngresos) eIngresos.innerText = `$${ingresos.toFixed(2)}`;
    if (eGastos) eGastos.innerText = `$${gastos.toFixed(2)}`;
    if (eUtilidad) eUtilidad.innerText = `$${utilidadNeta.toFixed(2)}`;

    // --- TICKET RESUMEN BALANCE GENERAL ---
    let totalActivos = 0; 
    let totalPasivos = 0; 
    let totalCapital = 0;
    
    Object.keys(CLASIFICACION_CUENTAS).forEach(cuenta => {
        if (CLASIFICACION_CUENTAS[cuenta] === "Activo") { totalActivos += saldosCuentas[cuenta]; }
        if (CLASIFICACION_CUENTAS[cuenta] === "Pasivo") { totalPasivos += saldosCuentas[cuenta]; }
        if (CLASIFICACION_CUENTAS[cuenta] === "Capital") { totalCapital += saldosCuentas[cuenta]; }
    });

    const capitalTotalFinDeMes = totalCapital + utilidadNeta;
    const totalPC = totalPasivos + capitalTotalFinDeMes;

    const bActivos = document.getElementById('bal-activos');
    const bPasivos = document.getElementById('bal-pasivos');
    const bCapInicial = document.getElementById('bal-capital-inicial');
    const bTotalPC = document.getElementById('bal-total-pc');

    if (bActivos) bActivos.innerText = `$${totalActivos.toFixed(2)}`;
    if (bPasivos) bPasivos.innerText = `$${totalPasivos.toFixed(2)}`;
    if (bCapInicial) bCapInicial.innerText = `$${totalCapital.toFixed(2)}`;
    if (bTotalPC) bTotalPC.innerText = `$${totalPC.toFixed(2)}`;
    
    const divRes = document.getElementById('bal-resultado-ejercicio');
    if (divRes) {
        if (utilidadNeta > 0) {
            divRes.innerText = `+$${utilidadNeta.toFixed(2)} (Ganancia)`; 
            divRes.style.backgroundColor = "#d4edda"; 
            divRes.style.color = "#155724";
        } else if (utilidadNeta < 0) {
            divRes.innerText = `-$${Math.abs(utilidadNeta).toFixed(2)} (Pérdida)`; 
            divRes.style.backgroundColor = "#f8d7da"; 
            divRes.style.color = "#721c24";
        } else {
            divRes.innerText = `$0.00 (Sin cambios)`; 
            divRes.style.backgroundColor = "#e2e3e5"; 
            divRes.style.color = "#383d41";
        }
    }

    // --- TABLA DE CUATRO COLUMNAS FORMAL ---
    const cuerpoBalance = document.getElementById('cuerpo-balance');
    if (cuerpoBalance) {
        cuerpoBalance.innerHTML = '';
        let sumatoriaActivos = 0; 
        let sumatoriaPasivos = 0; 
        let sumatoriaCapital = 0;

        // Activos
        cuerpoBalance.innerHTML += `<tr class="fila-categoria"><td>1. ACTIVO</td><td></td><td></td><td></td></tr>`;
        cuerpoBalance.innerHTML += `<tr class="fila-subcategoria"><td>Activos Circulantes y Fijos</td><td></td><td></td><td></td></tr>`;
        Object.keys(CLASIFICACION_CUENTAS).forEach(cuenta => {
            if (CLASIFICACION_CUENTAS[cuenta] === "Activo") {
                let saldo = saldosCuentas[cuenta]; 
                sumatoriaActivos += saldo;
                cuerpoBalance.innerHTML += `<tr class="fila-cuenta-detail"><td>${cuenta}</td><td class="text-derecha">$${saldo.toFixed(2)}</td><td></td><td></td></tr>`;
            }
        });
        cuerpoBalance.innerHTML += `<tr class="fila-total-seccion"><td>TOTAL ACTIVOS</td><td></td><td></td><td class="text-derecha">$${sumatoriaActivos.toFixed(2)}</td></tr>`;

        // Pasivos
        cuerpoBalance.innerHTML += `<tr class="fila-categoria"><td>2. PASIVO</td><td></td><td></td><td></td></tr>`;
        cuerpoBalance.innerHTML += `<tr class="fila-subcategoria"><td>Obligaciones Financieras</td><td></td><td></td><td></td></tr>`;
        Object.keys(CLASIFICACION_CUENTAS).forEach(cuenta => {
            if (CLASIFICACION_CUENTAS[cuenta] === "Pasivo") {
                let saldo = saldosCuentas[cuenta]; 
                sumatoriaPasivos += saldo;
                cuerpoBalance.innerHTML += `<tr class="fila-cuenta-detail"><td>${cuenta}</td><td class="text-derecha">$${saldo.toFixed(2)}</td><td></td><td></td></tr>`;
            }
        });
        cuerpoBalance.innerHTML += `<tr class="fila-total-seccion"><td>TOTAL PASIVOS</td><td></td><td class="text-derecha">$${sumatoriaPasivos.toFixed(2)}</td><td></td></tr>`;

        // Capital
        cuerpoBalance.innerHTML += `<tr class="fila-categoria"><td>3. CAPITAL / PATRIMONIO</td><td></td><td></td><td></td></tr>`;
        Object.keys(CLASIFICACION_CUENTAS).forEach(cuenta => {
            if (CLASIFICACION_CUENTAS[cuenta] === "Capital") {
                let saldo = saldosCuentas[cuenta]; 
                sumatoriaCapital += saldo;
                cuerpoBalance.innerHTML += `<tr class="fila-cuenta-detail"><td>${cuenta}</td><td class="text-derecha">$${saldo.toFixed(2)}</td><td></td><td></td></tr>`;
            }
        });
        sumatoriaCapital += utilidadNeta;
        cuerpoBalance.innerHTML += `<tr class="fila-cuenta-detail" style="font-style: italic;"><td style="color:#27ae60;">Utilidad Neta del Periodo</td><td class="text-derecha" style="color:#27ae60;">$${utilidadNeta.toFixed(2)}</td><td></td><td></td></tr>`;
        cuerpoBalance.innerHTML += `<tr class="fila-total-seccion"><td>TOTAL CAPITAL FIN DE PERIERE</td><td></td><td class="text-derecha">$${sumatoriaCapital.toFixed(2)}</td><td></td></tr>`;

        // Cierre Total Ecuación
        let sumaPasivoCapital = sumatoriaPasivos + sumatoriaCapital;
        cuerpoBalance.innerHTML += `<tr class="fila-categoria" style="background-color: #d1c7bd; font-size: 15px;"><td>TOTAL PASIVO + CAPITAL</td><td></td><td></td><td class="text-derecha" style="border-bottom: 4px double #4A3525;">$${sumaPasivoCapital.toFixed(2)}</td></tr>`;
    }
}

// --- ARCHIVADO HISTÓRICO ---
function cerrarMes() {
    if (mesActual.transacciones.length === 0 && mesActual.ventas.length === 0) {
        return alert("Periodo actual vacío. No hay datos para archivar.");
    }
    const nombreMes = prompt("Escriba el nombre para el histórico (ej: Julio 2026):");
    if (!nombreMes) {
        return;
    }

    historial.push({
        mes: nombreMes,
        datos: { transacciones: [...mesActual.transacciones], ventas: [...mesActual.ventas] }
    });

    mesActual.transacciones = []; 
    mesActual.ventas = [];
    localStorage.setItem('historial_completo', JSON.stringify(historial));
    guardarDatosLocalmente();
    renderizarListaHistorial();
    calcularYRenderizar();
    alert(`Periodo '${nombreMes}' archivado exitosamente.`);
}

function verMesPasado(indice) {
    indiceMesSeleccionado = indice;
    
    const iMes = document.getElementById('indicador-mes');
    if (iMes) iMes.innerText = `Viendo Historial: ${historial[indice].mes} (SOLO LECTURA)`;
    
    const mCont = document.querySelector('main');
    if (mCont) mCont.classList.add('modo-lectura-activo');
    
    const zForm = document.getElementById('zona-formulario-diario');
    const fVent = document.getElementById('form-venta');
    const zCier = document.getElementById('zona-cierre-mes');
    
    if (zForm) zForm.style.display = 'none';
    if (fVent) fVent.style.display = 'none';
    if (zCier) zCier.style.display = 'none';
    
    calcularYRenderizar();
    cambiarSeccion('ventas'); 
}

function volverAlMesActual() {
    indiceMesSeleccionado = null;
    
    const iMes = document.getElementById('indicador-mes');
    if (iMes) iMes.innerText = "Viendo: Mes Actual (En Curso)";
    
    const mCont = document.querySelector('main');
    if (mCont) mCont.classList.remove('modo-lectura-activo');
    
    const zForm = document.getElementById('zona-formulario-diario');
    const fVent = document.getElementById('form-venta');
    const zCier = document.getElementById('zona-cierre-mes');
    
    if (zForm) zForm.style.display = 'block';
    if (fVent) fVent.style.display = 'grid';
    if (zCier) zCier.style.display = 'flex';
    
    calcularYRenderizar();
}

function renderizarListaHistorial() {
    const contenedor = document.getElementById('lista-historial');
    if (!contenedor) return;
    contenedor.innerHTML = '';
    
    historial.forEach((h, index) => {
        const item = document.createElement('div');
        item.className = 'historial-item';
        item.innerHTML = `
            <div>
                <strong>${h.mes}</strong> 
                <br><small>Asientos: ${h.datos.transacciones ? h.datos.transacciones.length : 0} | Ventas: ${h.datos.ventas ? h.datos.ventas.length : 0}</small>
            </div>
            <div style="display: flex; gap: 5px;">
                <button onclick="verMesPasado(${index})" style="background-color: #f39c12; color: white;">Ver Reportes</button>
                <button onclick="eliminarMesHistorial(${index})" style="background-color: #e74c3c; color: white;">Eliminar</button>
            </div>
        `;
        contenedor.appendChild(item);
    });
}

function guardarDatosLocalmente() {
    localStorage.setItem('transacciones', JSON.stringify(mesActual.transacciones));
    localStorage.setItem('ventas', JSON.stringify(mesActual.ventas));
}

window.onload = function() {
    calcularYRenderizar();
    renderizarListaHistorial();
};