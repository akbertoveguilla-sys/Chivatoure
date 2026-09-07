import { auth, db } from './firebase-config.js';
import { 
    doc, 
    updateDoc, 
    setDoc,
    getDocs,
    getDoc,
    collection,
    onSnapshot,
    addDoc,
    increment 
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

// --- 1. Estado Global ---
let datosReservaPendiente = null;

// --- 2. Funciones de Interfaz (UI) ---

function actualizarTarjetaUI(card, data) {
    const mapeo = {
        '.tour-titulo': data.titulo,
        '.tour-fecha-partido': data.fecha_partido,
        '.tour-fecha-salida': data.fecha_salida,
        '.tour-puntos': data.puntos_salida,
        '.tour-precio': data.precio,
        '.tour-aparta': data.aparta,
        '.tour-cupos-ocupados': data.cupo_disponible,
        '.tour-cupos-totales': data.cupo_total
    };
    
    for (const selector in mapeo) {
        const elemento = card.querySelector(selector);
        if (elemento && mapeo[selector] !== undefined) {
            selector === '.tour-puntos' ? elemento.innerHTML = mapeo[selector] : elemento.innerText = mapeo[selector];
        }
    }
    
    // Convertimos a números de forma segura
    const ocupados = Number(data.cupo_disponible) || 0;
    const total = Number(data.cupo_total) || 0; 
    
    // --- 1. Actualización de Barra de Progreso ---
    const bar = card.querySelector('.tour-progress-bar');
    const txt = card.querySelector('.tour-porcentaje-texto');
    if (bar && txt) {
        const porcentaje = total > 0 ? Math.min(Math.round((ocupados / total) * 100), 100) : 0;
        bar.style.width = `${porcentaje}%`;
        txt.innerText = `${porcentaje}%`;
    }

    // --- 2. Lógica del Botón ---
    const btn = card.querySelector('.btn-reservar-tour');
    if (btn) {
        if (total === 0 || ocupados >= total) {
            btn.innerText = "AGOTADO";
            btn.classList.remove('bg-[#C4151C]'); 
            btn.classList.add('bg-gray-500');     
            btn.disabled = true;
        } else {
            btn.innerText = "Reservar";
            btn.classList.remove('bg-gray-500');  
            btn.classList.add('bg-[#C4151C]');    
            btn.disabled = false;
        }
    }
}

// --- 3. Funciones de Reserva y Administración ---

window.cerrarModal = () => {
    const modal = document.getElementById('modal-informacion');
    if (modal) modal.classList.add('hidden');
};

window.reservarTour = (id, nombre, fecha, precio, urlPago, aparta) => { 
    if (!auth || !auth.currentUser) {
        window.mostrarNotificacion("Por favor, inicia sesión para reservar.", true);
        return;
    }

    const checkbox = document.getElementById('check-terminos');
    const btn = document.getElementById('btn-confirmar');
    if (checkbox) checkbox.checked = false;
    if (btn) {
        btn.disabled = true;
        btn.classList.add("opacity-50");
        btn.innerText = "Confirmar y Pagar";
    }

    datosReservaPendiente = { id, nombre, fecha, precio, urlPago, aparta }; 

    const selectLugares = document.getElementById('select-lugares');
    const totalPagoTxt = document.getElementById('modal-total-pago');
    
    // --- LÓGICA DE DISPONIBILIDAD DINÁMICA ---
    const card = document.querySelector(`[data-id="${id}"]`);
    const ocupados = parseInt(card.querySelector('.tour-cupos-ocupados').innerText) || 0;
    const totales = parseInt(card.querySelector('.tour-cupos-totales').innerText) || 45;
    const disponibles = Math.max(0, totales - ocupados);

    if (selectLugares) {
        selectLugares.innerHTML = '';
        const limite = Math.min(15, disponibles);
        for (let i = 1; i <= limite; i++) {
            const opt = document.createElement('option');
            opt.value = i;
            opt.textContent = `${i} lugar${i > 1 ? 'es' : ''}`;
            selectLugares.appendChild(opt);
        }
    }
    // -----------------------------------------
    
    if (totalPagoTxt) totalPagoTxt.innerText = aparta; 

    const modal = document.getElementById('modal-informacion');
    if (modal) modal.classList.remove('hidden');
};


window.prepararReserva = (boton) => {
    if (!auth.currentUser) {
        window.mostrarNotificacion("Debes iniciar sesión para reservar", true);
        return;
    }

    const card = boton.closest('.card-hover');
    const ocupados = parseInt(card.querySelector('.tour-cupos-ocupados').innerText) || 0;
    const totales = parseInt(card.querySelector('.tour-cupos-totales').innerText) || 0;

    if (totales === 0 || ocupados >= totales) {
        window.mostrarNotificacion("¡Tour agotado o no disponible!", true);
        return;
    }

    const id = card.getAttribute('data-id'); 
    const nombre = card.querySelector('.tour-titulo').innerText;
    const fecha = card.querySelector('.tour-fecha-partido').innerText;
    const precio = card.querySelector('.tour-precio').innerText;
    const aparta = card.querySelector('.tour-aparta').innerText;
    const urlPago = boton.getAttribute('data-url'); 
    
    window.reservarTour(id, nombre, fecha, precio, urlPago, aparta); 
};

window.guardarCambiosTour = async function(btn) {
    const card = btn.closest('.card-hover');
    if (!card) return;
    const docId = card.getAttribute('data-id');
    let datosActualizar = {};
    
    const capturar = (selector, campoBD) => {
        const input = card.querySelector(selector);
        if (input && input.value.trim() !== "") {
            // Cambio de Guardar Datos: Forzar conversión numérica para Firestore
            if (campoBD === 'cupo_disponible' || campoBD === 'cupo_total') {
                datosActualizar[campoBD] = Number(input.value) || 0;
            } else {
                datosActualizar[campoBD] = input.value;
            }
            input.value = ""; 
        }
    };
    
    capturar('.input-titulo', 'titulo');
    capturar('.input-precio', 'precio');
    capturar('.input-aparta', 'aparta'); 
    capturar('.input-fecha-partido', 'fecha_partido');
    capturar('.input-fecha-salida', 'fecha_salida');
    capturar('.input-puntos', 'puntos_salida');
    capturar('.input-ocupados', 'cupo_disponible');
    capturar('.input-totales', 'cupo_total');

    if (Object.keys(datosActualizar).length === 0) {
        window.mostrarNotificacion("No hay datos nuevos para guardar.", true);
        return;
    }

    try {
        await setDoc(doc(db, "partidos", docId), datosActualizar, { merge: true });
        
        if (datosActualizar.aparta) card.querySelector('.tour-aparta').textContent = datosActualizar.aparta;
        if (datosActualizar.precio) card.querySelector('.tour-precio').textContent = datosActualizar.precio;
        if (datosActualizar.titulo) card.querySelector('.tour-titulo').textContent = datosActualizar.titulo;
        if (datosActualizar.fecha_partido) card.querySelector('.tour-fecha-partido').textContent = datosActualizar.fecha_partido;
        if (datosActualizar.fecha_salida) card.querySelector('.tour-fecha-salida').textContent = datosActualizar.fecha_salida;
        if (datosActualizar.cupo_disponible !== undefined) card.querySelector('.tour-cupos-ocupados').textContent = datosActualizar.cupo_disponible;
        if (datosActualizar.cupo_total !== undefined) card.querySelector('.tour-cupos-totales').textContent = datosActualizar.cupo_total;

        window.mostrarNotificacion("Cambios guardados correctamente.");
        btn.classList.add('bg-green-600');
    } catch (error) {
        window.mostrarNotificacion("Error: " + error.message, true);
    }
};


// Función para revelar los elementos protegidos si el usuario es administrador
window.verificarPermisosAdmin = function() {
    const valorLS = localStorage.getItem('es_admin');
    const esAdmin = valorLS === 'true'; // Compara estrictamente con el texto "true"
    const botones = document.querySelectorAll('.admin-only');



    botones.forEach(btn => {
        if (esAdmin) {
            btn.classList.remove('hidden');
            ;
        } else {
            btn.classList.add('hidden');
            ;
        }
    });
};



// --- 4. Firebase y Inicialización ---
const initPartidos = () => {
    onSnapshot(collection(db, "partidos"), (snapshot) => {
        snapshot.forEach((docSnap) => {
            const card = document.querySelector(`[data-id="${docSnap.id}"]`);
            if (card) {
                actualizarTarjetaUI(card, docSnap.data());
            }
        });

        // Llamamos a la verificación después de que todas las tarjetas se hayan actualizado.
        // Esto asegura que, si eres admin, los botones se muestren siempre.
        verificarPermisosAdmin(); 
    });
};


document.addEventListener("DOMContentLoaded", () => {
    // --- NUEVO: SEGURIDAD ANTI-FLASH ---
    // Ocultamos todos los elementos de admin inmediatamente para que no parpadeen
    document.querySelectorAll('.admin-only').forEach(el => el.classList.add('hidden'));

    // 1. Inicializar partidos
    initPartidos();

    // 2. Verificar permisos de admin inmediatamente después de cargar
    if (typeof window.verificarPermisosAdmin === 'function') {
        window.verificarPermisosAdmin();
    }
    
    const params = new URLSearchParams(window.location.search);
    if (params.get('pago') === 'exitoso') {
        const modalInst = document.getElementById('modal-instrucciones');
        if (modalInst) {
            modalInst.classList.remove('hidden');
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }
    
    const btnConfirmar = document.getElementById('btn-confirmar');
    const checkbox = document.getElementById('check-terminos');
    const selectLugares = document.getElementById('select-lugares'); 
    const totalPagoTxt = document.getElementById('modal-total-pago'); 

    if (selectLugares && totalPagoTxt) {
        selectLugares.addEventListener('change', () => {
            if (!datosReservaPendiente) return;
            const precioUnitario = parseFloat(String(datosReservaPendiente.aparta).replace(/[^0-9.]/g, '')) || 0;
            const cantidad = parseInt(selectLugares.value) || 1;
            const totalCalculado = precioUnitario * cantidad;
            totalPagoTxt.innerText = `$${totalCalculado.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        });
    }

    if (btnConfirmar && checkbox) {
        checkbox.addEventListener('change', (e) => {
            btnConfirmar.disabled = !e.target.checked;
            btnConfirmar.classList.toggle("opacity-50", !e.target.checked);
        });

        btnConfirmar.addEventListener('click', async () => {
            if (!datosReservaPendiente) return;

            try {
                btnConfirmar.disabled = true;
                btnConfirmar.innerText = "Procesando...";

                // 1. LEER ESTADO ACTUAL DE LA BASE DE DATOS
                const partidoRef = doc(db, "partidos", datosReservaPendiente.id);
                const docSnap = await getDoc(partidoRef);
                const data = docSnap.data();
                
                const cupoActual = Number(data.cupo_disponible) || 0;
                const cupoTotal = Number(data.cupo_total) || 45;
                const cantidadSolicitada = selectLugares ? parseInt(selectLugares.value) : 1;

                // 2. VALIDACIÓN DE SEGURIDAD (Si excede, bloqueamos)
                if ((cupoActual + cantidadSolicitada) > cupoTotal) {
                    window.mostrarNotificacion(`Error: Solo quedan ${cupoTotal - cupoActual} lugares disponibles.`, true);
                    btnConfirmar.disabled = false;
                    btnConfirmar.innerText = "Confirmar y Pagar";
                    return;
                }

                // 3. REGISTRAR PEDIDO
                const precioUnitario = parseFloat(String(datosReservaPendiente.aparta).replace(/[^0-9.]/g, '')) || 0;
                const totalFinal = precioUnitario * cantidadSolicitada;

                await addDoc(collection(db, "pedidos"), {
                    userId: auth.currentUser.uid,
                    userEmail: auth.currentUser.email,
                    partido: datosReservaPendiente.nombre,
                    fechapartido: datosReservaPendiente.fecha,
                    lugaresReservados: cantidadSolicitada, 
                    total: totalFinal,
                    fechaCompra: new Date().toISOString(),
                    estatus: "Pendiente Pago"
                });

                // 4. ACTUALIZAR CUPO (Sumando directamente al valor real)
                await updateDoc(partidoRef, { 
                    cupo_disponible: cupoActual + cantidadSolicitada 
                });

                // 5. REDIRECCIÓN
                if (datosReservaPendiente.urlPago && datosReservaPendiente.urlPago.trim() !== "") {
                    const urlBase = datosReservaPendiente.urlPago;
                    const separador = urlBase.includes('?') ? '&' : '?';
                    const urlConRetorno = `${urlBase}${separador}back_urls[success]=${window.location.origin}/?pago=exitoso`;
                    
                    window.open(urlConRetorno, '_self');
                    window.cerrarModal();
                } else {
                    window.mostrarNotificacion("Error: Este tour no tiene un enlace de pago configurado.", true);
                }

            } catch (error) {
                console.error("Error al procesar reserva:", error);
                window.mostrarNotificacion("Ocurrió un error al procesar tu reserva.", true);
            } finally {
                btnConfirmar.disabled = false;
                btnConfirmar.innerText = "Confirmar y Pagar";
            }
        });
    }
});


function actualizarOpcionesSelect(disponibles) {
    const select = document.getElementById('select-lugares');
    if (!select) return;
    
    // El límite es 11 o los disponibles, lo que sea menor
    const limite = Math.min(15, disponibles);
    
    select.innerHTML = ''; // Limpiar opciones actuales
    for (let i = 1; i <= limite; i++) {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = `${i} lugar${i > 1 ? 'es' : ''}`;
        select.appendChild(option);
    }
}


window.mostrarDesglose = function(btn) {
    const card = btn.closest('.card-hover');
    const modal = document.getElementById('modal-desglose');
    const container = document.getElementById('contenido-desglose');
    
    // Verificamos que el modal exista en el HTML antes de intentar abrirlo
    if (!modal || !container) {
        console.error("No se encontró el elemento 'modal-desglose' en tu HTML.");
        return;
    }

    const precioTexto = card.querySelector('.tour-precio').innerText.replace(/[^0-9.]/g, '');
    const ocupadosTexto = card.querySelector('.tour-cupos-ocupados').innerText.replace(/[^0-9]/g, '');
    
    const precioUnitario = parseFloat(precioTexto) || 0;
    const ocupados = parseInt(ocupadosTexto) || 0;

    // --- Lógica del Contenido ---
    if (precioUnitario === 0 || ocupados === 0) {
        container.innerHTML = `
            <div class="text-center py-6">
                <div class="text-4xl mb-4">⚠️</div>
                <h3 class="text-xl font-bold text-white mb-2">Sin datos registrados</h3>
                <p class="text-gray-400 text-sm">Aún no hay ventas o precios definidos para este tour.</p>
            </div>
        `;
    } else {
        const totalVentas = precioUnitario * ocupados;
        const comisionTotal = totalVentas * 0.10; 
        const comisionPorPatrocinador = comisionTotal / 5;

        const formato = (num) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(num);

        container.innerHTML = `
            <h3 class="text-lg font-black text-white mb-4 border-b border-gray-700 pb-2">📊 Desglose Financiero</h3>
            <div class="space-y-3 text-sm">
                <div class="flex justify-between">
                    <span class="text-gray-400">Ventas Totales:</span> 
                    <span class="font-bold text-white">${formato(totalVentas)}</span>
                </div>
                <div class="flex justify-between">
                    <span class="text-gray-400">Comisión (10%):</span> 
                    <span class="font-bold text-red-400">${formato(comisionTotal)}</span>
                </div>
                <div class="mt-4 pt-4 border-t border-gray-700">
                    <p class="text-gray-400 mb-1">Por patrocinador (5):</p>
                    <div class="text-2xl font-black text-green-400">${formato(comisionPorPatrocinador)}</div>
                </div>
            </div>
        `;
    }

    // Abrimos el modal
    modal.showModal();
};


