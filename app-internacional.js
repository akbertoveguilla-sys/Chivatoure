import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { doc, getDoc, onSnapshot, setDoc, deleteDoc, addDoc } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { auth, db, collection } from './firebase-config.js';

// --- PLANTILLA HTML PARA NUEVOS TOURS ---
const crearTemplateTourHTML = (id, data = {}) => {
    return `
    <div data-id="${id}" class="bg-gray-800 rounded-3xl p-8 border border-gray-700 shadow-xl relative">
        <h2 class="text-2xl font-black text-white"><span class="tour-titulo">${data.titulo || 'NUEVO TOUR INTERNACIONAL'}</span></h2>
        
        <div class="admin-controls ${esAdminActual ? '' : 'hidden'} mt-4 p-4 border border-red-500 rounded-lg space-y-2">
            <input type="text" class="inter-input-titulo w-full bg-gray-700 text-white p-2 rounded" placeholder="Título" value="${data.titulo || ''}">
            <input type="text" class="inter-input-subtitulo w-full bg-gray-700 text-white p-2 rounded" placeholder="Subtítulo" value="${data.subtitulo || ''}">
            <input type="text" class="inter-input-fecha-evento w-full bg-gray-700 text-white p-2 rounded" placeholder="Fecha Evento" value="${data.fecha_evento || ''}">
            <input type="text" class="inter-input-salida w-full bg-gray-700 text-white p-2 rounded" placeholder="Fecha Salida" value="${data.fecha_salida || ''}">
            <input type="text" class="inter-input-regreso w-full bg-gray-700 text-white p-2 rounded" placeholder="Fecha Regreso" value="${data.fecha_regreso || ''}">
            <input type="number" class="inter-input-precio w-full bg-gray-700 text-white p-2 rounded" placeholder="Precio" value="${data.precio || ''}">
            <div class="flex gap-2">
                <input type="number" class="inter-input-ocupados w-1/2 bg-gray-700 text-white p-2 rounded" placeholder="Ocupados" value="${data.cupos_ocupados || 0}">
                <input type="number" class="inter-input-totales w-1/2 bg-gray-700 text-white p-2 rounded" placeholder="Totales" value="${data.cupos_totales || 0}">
            </div>
            <textarea class="inter-input-itinerario w-full bg-gray-700 text-white p-2 rounded mt-2" placeholder="Itinerario detallado...">${data.itinerario || ''}</textarea>
            <textarea class="inter-input-terminos w-full bg-gray-700 text-white p-2 rounded mt-2" placeholder="Términos y condiciones...">${data.terminos || ''}</textarea>
            
            <div class="flex gap-2 mt-2">
                <button onclick="guardarCambiosInternacional(this)" class="w-full bg-green-600 text-white p-2 rounded font-bold hover:bg-green-700 transition">Guardar Cambios</button>
                <button onclick="eliminarTourPorBoton(this)" class="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded font-bold transition" title="Eliminar este tour">🗑️</button>
            </div>
        </div>

        <p class="font-bold text-red-400 text-xl mt-2"><span class="tour-subtitulo">${data.subtitulo || 'SUBTÍTULO'}</span></p>
        <ul class="mt-4 space-y-2 text-gray-300">
            <li>Fecha: <span class="tour-fecha-evento">${data.fecha_evento || '--'}</span></li>
            <li>Salida: <span class="tour-salida">${data.fecha_salida || '--'}</span></li>
            <li>Regreso: <span class="tour-regreso">${data.fecha_regreso || '--'}</span></li>
        </ul>

        <div class="mt-6 bg-gray-900 p-6 rounded-2xl border border-gray-700">
            <div class="flex items-center justify-between">
                <p class="text-2xl font-bold text-white">$<span class="tour-precio">${data.precio ? data.precio.toLocaleString() : '0'}</span> MXN</p>
                <button onclick="abrirModalInfo(this)" title="Ver desglose de patrocinios" class="admin-controls ${esAdminActual ? '' : 'hidden'} w-8 h-8 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center hover:bg-blue-700 transition shadow-md">i</button>
            </div>
            <div class="mt-2 text-sm text-yellow-500">
                Cupos: <span class="tour-cupos-ocupados">${data.cupos_ocupados || 0}</span> / <span class="tour-cupos-totales">${data.cupos_totales || 0}</span>
                <span class="porcentaje-cupo ml-2 font-bold">0%</span>
            </div>
            <div class="w-full bg-gray-700 rounded-full h-2 mt-2"><div class="barra-progreso bg-red-600 h-2 rounded-full" style="width: 0%"></div></div>
            <button onclick="abrirModalReserva(this)" data-titulo="${data.titulo || 'Título del Viaje'}" class="btn-reservar-internacional mt-4 w-full bg-red-600 py-3 rounded-xl font-bold hover:bg-red-700">Reservar Ahora</button>
        </div>
    </div>`;
};

let esAdminActual = false;

// --- 1. Inicialización de Cupos y Sincronización Realtime ---
const initCupos = () => {
    const viajesRef = collection(db, "viajes");
    const contenedorPadre = document.getElementById("contenedor-tours-internacionales");

    onSnapshot(viajesRef, (snapshot) => {
        // IDs presentes en Firestore
        const idsFirestore = new Set();

        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const idDoc = docSnap.id;
            idsFirestore.add(idDoc);

            let contenedor = document.querySelector(`[data-id="${idDoc}"]`);

            // Si el tour no existe en el HTML, lo crea dinámicamente
            if (!contenedor && contenedorPadre) {
                contenedorPadre.insertAdjacentHTML('beforeend', crearTemplateTourHTML(idDoc, data));
                contenedor = document.querySelector(`[data-id="${idDoc}"]`);
            }

            if (!contenedor) return;

            const setText = (clase, valor) => {
                const el = contenedor.querySelector(clase);
                if (el) el.innerText = valor ?? "--"; 
            };

            // Actualizar interfaz
            setText('.tour-titulo', data.titulo);
            setText('.tour-subtitulo', data.subtitulo);
            setText('.tour-precio', data.precio?.toLocaleString());
            setText('.tour-fecha-evento', data.fecha_evento);
            setText('.tour-salida', data.fecha_salida);
            setText('.tour-regreso', data.fecha_regreso);
            
            const oc = Number(data.cupos_ocupados) || 0;
            const tot = Number(data.cupos_totales) || 0;
            
            setText('.tour-cupos-ocupados', oc);
            setText('.tour-cupos-totales', tot);

            // Barra de Progreso
            const elBarra = contenedor.querySelector('.barra-progreso');
            const elPct = contenedor.querySelector('.porcentaje-cupo');

            if (elBarra && elPct) {
                if (tot > 0) {
                    const porcentaje = Math.min((oc / tot) * 100, 100);
                    elBarra.style.width = porcentaje + "%";
                    elPct.innerText = Math.round(porcentaje) + "%";
                } else {
                    elBarra.style.width = "0%";
                    elPct.innerText = "0%";
                }
            }

            // Estado del Botón Reservar
            const btn = contenedor.querySelector('.btn-reservar-internacional');
            if (btn) {
                if (tot === 0 || oc >= tot) {
                    btn.innerText = "AGOTADO";
                    btn.disabled = true;
                    btn.style.backgroundColor = "#6b7280";
                    btn.style.cursor = "not-allowed";
                    btn.style.opacity = "0.6";
                } else {
                    btn.innerText = "Reservar Ahora";
                    btn.disabled = false;
                    btn.style.backgroundColor = "#C4151C";
                    btn.style.cursor = "pointer";
                    btn.style.opacity = "1";
                }
            }
        });

        // Eliminar tarjetas del DOM si fueron borradoras de Firestore
        document.querySelectorAll('#contenedor-tours-internacionales [data-id]').forEach(card => {
            const cardId = card.getAttribute('data-id');
            if (!idsFirestore.has(cardId) && cardId.startsWith('tour_')) {
                card.remove();
            }
        });
    });
};

// --- 2. LÓGICA PARA CREAR UN NUEVO TOUR ---
window.crearNuevoTourInternacional = async () => {
    try {
        const idNuevoTour = "tour_" + Date.now();
        const nuevoTourData = {
            titulo: "NUEVO TOUR INTERNACIONAL",
            subtitulo: "Destino Increíble",
            fecha_evento: "01 Ene 2027",
            fecha_salida: "31 Dic 2026",
            fecha_regreso: "02 Ene 2027",
            precio: 5000,
            cupos_ocupados: 0,
            cupos_totales: 40,
            itinerario: "Detalle del itinerario aquí...",
            terminos: "Términos y condiciones aquí..."
        };

        // Guardar en Firestore
        await setDoc(doc(db, "viajes", idNuevoTour), nuevoTourData);
        alert("¡Tour creado correctamente! Puedes editar sus datos en la tarjeta.");
    } catch (error) {
        console.error("Error al crear el tour:", error);
        alert("Ocurrió un error al crear el tour.");
    }
};

// --- 3. LÓGICA PARA ELIMINAR TOURS ---
window.abrirModalEliminarTour = () => {
    const select = document.getElementById('select-tour-eliminar');
    select.innerHTML = '';

    const tours = document.querySelectorAll('#contenedor-tours-internacionales [data-id]');
    if (tours.length === 0) {
        alert("No hay tours disponibles para eliminar.");
        return;
    }

    tours.forEach(tour => {
        const id = tour.getAttribute('data-id');
        const titulo = tour.querySelector('.tour-titulo')?.innerText || id;
        const option = document.createElement('option');
        option.value = id;
        option.textContent = `${titulo} (ID: ${id})`;
        select.appendChild(option);
    });

    document.getElementById('modal-eliminar-tour').classList.remove('hidden');
};

window.cerrarModalEliminarTour = () => {
    document.getElementById('modal-eliminar-tour').classList.add('hidden');
};

window.confirmarEliminarTourSeleccionado = async () => {
    const select = document.getElementById('select-tour-eliminar');
    const idTour = select.value;

    if (!idTour) return;

    if (confirm(`¿Estás seguro de que deseas eliminar permanentemente el tour seleccionado?`)) {
        await borrarTourFirestore(idTour);
        cerrarModalEliminarTour();
    }
};

window.eliminarTourPorBoton = async (btn) => {
    const contenedor = btn.closest('[data-id]');
    if (!contenedor) return;
    const idTour = contenedor.getAttribute('data-id');

    if (confirm(`¿Deseas eliminar este tour (${idTour})?`)) {
        await borrarTourFirestore(idTour);
    }
};

const borrarTourFirestore = async (idTour) => {
    try {
        await deleteDoc(doc(db, "viajes", idTour));
        const tarjetaDOM = document.querySelector(`[data-id="${idTour}"]`);
        if (tarjetaDOM) tarjetaDOM.remove();
        alert("Tour eliminado con éxito.");
    } catch (error) {
        console.error("Error al borrar el tour:", error);
        alert("No se pudo eliminar el tour.");
    }
};

// --- 4. Guardar Cambios en Tour ---
window.guardarCambiosInternacional = async (btn) => {
    const contenedor = btn.closest('[data-id]');
    if (!contenedor) return;

    const id = contenedor.getAttribute('data-id');
    const datosActualizados = {
        titulo: contenedor.querySelector('.inter-input-titulo').value,
        subtitulo: contenedor.querySelector('.inter-input-subtitulo').value,
        fecha_evento: contenedor.querySelector('.inter-input-fecha-evento').value,
        fecha_salida: contenedor.querySelector('.inter-input-salida').value,
        fecha_regreso: contenedor.querySelector('.inter-input-regreso').value,
        precio: Number(contenedor.querySelector('.inter-input-precio').value) || 0,
        cupos_ocupados: Number(contenedor.querySelector('.inter-input-ocupados').value) || 0,
        cupos_totales: Number(contenedor.querySelector('.inter-input-totales').value) || 0,
        itinerario: contenedor.querySelector('.inter-input-itinerario').value,
        terminos: contenedor.querySelector('.inter-input-terminos').value
    };

    try {
        await setDoc(doc(db, "viajes", id), datosActualizados, { merge: true });
        alert("Cambios guardados correctamente.");
    } catch (error) {
        console.error("Error al guardar cambios:", error);
        alert("No se pudieron guardar los cambios.");
    }
};

// --- 5. Verificación de Administrador ---
const verificarAdmin = async (user) => {
    const adminControls = document.querySelectorAll('.admin-controls');
    
    try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists() && userDoc.data().role === "admin") {
            esAdminActual = true;
            adminControls.forEach(el => el.classList.remove('hidden'));
        } else {
            esAdminActual = false;
            adminControls.forEach(el => el.classList.add('hidden'));
        }
    } catch (e) {
        console.error("Error verificando admin:", e);
        adminControls.forEach(el => el.classList.add('hidden'));
    }
};

// Escuchar Estado de Autenticación
onAuthStateChanged(auth, (user) => {
    if (user) {
        verificarAdmin(user);
    } else {
        esAdminActual = false;
        document.querySelectorAll('.admin-controls').forEach(el => el.classList.add('hidden'));
    }
});

// Iniciar escuchador en tiempo real
initCupos();
