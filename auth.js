import { auth, db } from './firebase-config.js'; 

import { 
    signInWithEmailAndPassword, 
    onAuthStateChanged, 
    createUserWithEmailAndPassword, 
    signOut, 
    sendPasswordResetEmail ,
    updateProfile
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";

import { 
    doc, 
    getDoc, 
    setDoc, 
    updateDoc,
    collection,
    query,
    where,
    getDocs
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

// --- FUNCIÓN ÚNICA DE NOTIFICACIÓN ---
window.mostrarNotificacion = (mensaje, esError = false) => {
    const toast = document.createElement('div');
    toast.className = `fixed top-5 right-5 z-[999999] px-6 py-3 rounded-xl shadow-2xl text-white font-bold transition-all duration-300 transform scale-100 ${esError ? 'bg-red-600' : 'bg-[#C4151C]'}`;
    toast.style.fontFamily = 'sans-serif';
    toast.innerText = mensaje;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 1500);
};

// 1. INICIO DE SESIÓN
window.togglePassword = () => {
    const passInput = document.getElementById('login-pass');
    if (passInput) {
        passInput.type = passInput.type === 'password' ? 'text' : 'password';
    }
};

window.iniciarSesion = async () => {
    const email = document.getElementById('login-email').value.trim();
    const passInput = document.getElementById('login-pass');
    try {
        await signInWithEmailAndPassword(auth, email, passInput.value);
        passInput.value = '';
        window.showView('view-dashboard');
    } catch (error) {
        window.mostrarNotificacion("Correo o contraseña incorrectos.", true);
    }
};

// 2. CAMBIO DE VISTA INTERNA (DASHBOARD/LOGIN/REGISTRO)
window.showView = (viewId) => {
    
    const vistas = ['view-login', 'view-register', 'view-forgot', 'view-dashboard', 'view-perfil'];
    
    vistas.forEach(id => {
        const el = document.getElementById(id);
        if(el) { el.classList.add('hidden'); el.classList.remove('flex'); }
    });
    
    const target = document.getElementById(viewId);
    if(target) { target.classList.remove('hidden'); target.classList.add('flex'); }
    
    // El bloque 'if' que cargaba los pedidos ha sido eliminado por completo
};

// 3. TOGGLE MODAL DE LOGUEO
window.toggleLoginModal = () => {
    const modal = document.getElementById('login-modal');
    if (modal) { 
        modal.classList.toggle('hidden'); 
        modal.classList.toggle('flex'); 
    } else {
        console.error("Error: No se encontró ningún elemento con el ID 'login-modal' en el HTML.");
    }
};

// 4. REGISTRO
window.registrarse = async () => {
    const nombre = document.getElementById('reg-nombre').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const celular = document.getElementById('reg-celular').value.trim();
    const passInput = document.getElementById('reg-pass');
    const confirmPassInput = document.getElementById('reg-pass-confirm');

    if (nombre.length < 8) { mostrarNotificacion("⚠️ Nombre corto (min 8 car.)", true); return; }
    
    // CAMBIO: Validación estricta de 10 dígitos exactos
    if (celular.length !== 10) { mostrarNotificacion("⚠️ El celular debe tener 10 dígitos", true); return; }
    
    if (passInput.value !== confirmPassInput.value) {
        mostrarNotificacion("⚠️ Las contraseñas no coinciden", true);
        return;
    }

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, passInput.value);
        await updateProfile(userCredential.user, { displayName: nombre });

        await setDoc(doc(db, "users", userCredential.user.uid), {
            nombre, email, celular, role: "user", fechaRegistro: new Date()
        });
        await signOut(auth);
        mostrarNotificacion("✅ Cuenta creada. Inicia sesión.");
        window.showView('view-login');
        document.getElementById('reg-celular').value = '';
        document.getElementById('reg-nombre').value = '';
        document.getElementById('reg-email').value = '';
    } catch (error) { 
        if (error.code === 'auth/email-already-in-use') {
            mostrarNotificacion("⚠️ Este correo ya se encuentra registrado.", true);
        } else {
            mostrarNotificacion("❌ Error: " + error.message, true);
        }
    }
    finally { 
        passInput.value = ''; 
        confirmPassInput.value = ''; 
    }
};

// 5. CERRAR SESIÓN
window.cerrarSesion = async () => {
    try {
        await signOut(auth);
        window.mostrarNotificacion("Sesión finalizada.");
        setTimeout(() => window.location.reload(), 900);
    } catch (error) { mostrarNotificacion("Error al cerrar sesión", true); }
};

// 6. CAMBIAR PASSWORD
window.cambiarPassword = async () => {
    if (auth.currentUser) {
        try {
            await sendPasswordResetEmail(auth, auth.currentUser.email);
            mostrarNotificacion("📧 Correo de recuperación enviado.");
        } catch (error) { mostrarNotificacion("❌ Error al enviar correo", true); }
    }
};

// 7. RECUPERAR PASS
window.recuperarPass = async (event) => {
    const emailInput = document.getElementById('forgot-email');
    const email = emailInput.value.trim().toLowerCase();
    try {
        await sendPasswordResetEmail(auth, email);
        mostrarNotificacion("✅ ¡Correo enviado!");
        window.showView('view-login');
        emailInput.value = '';
    } catch (error) { mostrarNotificacion("❌ Verifica el correo", true); }
};

// 8. CAMBIAR NOMBRE / CELULAR
window.cambiarNombre = async (event) => {
    const nuevoNombre = document.getElementById('input-nuevo-nombre').value.trim();
    if (nuevoNombre.length < 8) { mostrarNotificacion("⚠️ Mínimo 8 caracteres", true); return; }
    try {
        await updateDoc(doc(db, "users", auth.currentUser.uid), { nombre: nuevoNombre });
        mostrarNotificacion("✅ Nombre actualizado");
        document.querySelectorAll('.display-nombre').forEach(el => el.innerText = nuevoNombre);
        window.showView('view-dashboard');
    } catch (error) { mostrarNotificacion("❌ Error al actualizar", true); }
};

window.cambiarCelular = async (event) => {
    const nuevoCelular = document.getElementById('input-nuevo-celular').value.trim();
    
    // CAMBIO: Validación estricta de 10 dígitos exactos al editar
    if (nuevoCelular.length !== 10) { mostrarNotificacion("⚠️ El celular debe tener 10 dígitos", true); return; }
    
    try {
        await updateDoc(doc(db, "users", auth.currentUser.uid), { celular: nuevoCelular });
        mostrarNotificacion("✅ Número actualizado");
        document.querySelectorAll('.display-celular').forEach(el => el.innerText = nuevoCelular);
        window.showView('view-dashboard');
    } catch (error) { mostrarNotificacion("❌ Error al actualizar", true); }
};

// 9. ABRIR CORREO
window.abrirCorreo = () => {
    navigator.clipboard.writeText("linearojiblanca@gmail.com").then(() => {
        mostrarNotificacion("Correo copiado al portapapeles");
    });
};

// 10. NAVEGACIÓN PRINCIPAL DE PÁGINAS
window.switchPage = (pageId) => {
    document.querySelectorAll('.page-section').forEach(section => {
        section.classList.remove('active');
    });
    
    let target = document.getElementById('page-' + pageId);
    if (!target) {
        target = document.getElementById(pageId);
    }
    
    if (target) {
        target.classList.add('active');
        console.log("Sección activada con éxito.");
    } else {
        console.error("Error: No encuentro el elemento con ID: 'page-" + pageId + "' ni '" + pageId + "'");
    }
    
    const mobileMenu = document.getElementById('mobile-menu');
    if (mobileMenu) mobileMenu.classList.add('hidden');
};

// VINCULACIÓN DE BOTONES DE NAVEGACIÓN
const vincularBotones = () => {
    const navButtons = [
        { id: 'btn-viajes', page: 'viajes' },
        { id: 'btn-internacionales', page: 'internacionales' },
        { id: 'btn-shop', page: 'shop' },
        { id: 'btn-comunidad', page: 'comunidad' },
        { id: 'btn-notas', page: 'admin-notes-page' }
    ];

    navButtons.forEach(btnInfo => {
        const btn = document.getElementById(btnInfo.id);
        if (btn) {
            btn.addEventListener('click', () => window.switchPage(btnInfo.page));
        }
    });

    const btnReserva = document.getElementById('btn-reservar-tour');
    if (btnReserva) {
        btnReserva.addEventListener('click', () => {
             if (window.reservarTour) window.reservarTour(); 
        });
    }
};

// CARGAR HISTORIAL DE PEDIDOS
window.cargarPedidos = async () => {
    const contenedorPedidos = document.getElementById('contenedor-pedidos');
    if (!contenedorPedidos) return;

    if (!auth.currentUser) {
        contenedorPedidos.innerHTML = `
            <div class="text-center py-12">
                <p class="text-gray-400">Inicia sesión para ver tu historial de viajes y boletos.</p>
            </div>
        `;
        return;
    }

    contenedorPedidos.innerHTML = `
        <div class="text-white text-center py-8">
            <i class="fa-solid fa-spinner animate-spin text-xl mb-2 text-[#C4151C]"></i>
            <p class="text-xs">Cargando tus Chivatours...</p>
        </div>
    `;

    try {
        const q = query(collection(db, "pedidos"), where("userId", "==", auth.currentUser.uid));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            contenedorPedidos.innerHTML = `
                <div class="text-center py-12 border border-dashed border-gray-700 rounded-3xl bg-gray-800/20">
                    <p class="text-gray-400">Aún no tienes ningún viaje reservado. ¡Elige tu próximo partido!</p>
                </div>
            `;
            return;
        }

        const listaPedidos = [];
        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const estatusValidos = ["Pendiente Pago", "Pagado", "Confirmado"];
            if (data.userId === auth.currentUser.uid && estatusValidos.includes(data.estatus)) {
                listaPedidos.push({ id: docSnap.id, ...data });
            }
        });

        if (listaPedidos.length === 0) {
            contenedorPedidos.innerHTML = `
                <div class="text-center py-12 border border-dashed border-gray-700 rounded-3xl bg-gray-800/20">
                    <p class="text-gray-400">No tienes pedidos confirmados bajo esta cuenta. ¡Elige tu próximo partido!</p>
                </div>
            `;
            return;
        }

        listaPedidos.sort((a, b) => {
            const fechaA = a.fechaCompra || a.fechaCreacion || 0;
            const fechaB = b.fechaCompra || b.fechaCreacion || 0;
            const tiempoA = fechaA.seconds ? fechaA.seconds * 1000 : new Date(fechaA).getTime();
            const tiempoB = fechaB.seconds ? fechaB.seconds * 1000 : new Date(fechaB).getTime();
            return tiempoB - tiempoA;
        });

        let htmlContenido = "";
        listaPedidos.forEach((pedido) => {
            let colorEstatus = "bg-yellow-900/50 text-yellow-400 border-yellow-600";
            if (pedido.estatus === "Pagado" || pedido.estatus === "Confirmado") {
                colorEstatus = "bg-green-900/50 text-green-400 border-green-600";
            }

            const nombreTour = pedido.partido || pedido.nombreTour || 'Chivatour';
            const fechaTour = pedido.fechaPartido || pedido.fechaTour || 'No especificada';
            const precioTotal = pedido.total || pedido.precioTotal || 'N/A';
            const montoApartado = pedido.montoApartado || 'Pendiente';

            htmlContenido += `
                <div class="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition hover:border-red-600/50 w-full">
                    <div>
                        <div class="flex items-center gap-3">
                            <h4 class="text-xl font-black text-white">${nombreTour}</h4>
                            <span class="text-xs font-bold px-2.5 py-1 rounded-full border ${colorEstatus}">
                                ${pedido.estatus || 'Pendiente'}
                            </span>
                        </div>
                        <p class="text-gray-400 text-sm mt-1">🗓️ Fecha de viaje: <span class="text-gray-200 font-semibold">${fechaTour}</span></p>
                        <p class="text-gray-500 text-xs mt-1">ID Reserva: ${pedido.id}</p>
                    </div>
                    <div class="text-left md:text-right w-full md:w-auto border-t md:border-t-0 pt-4 md:pt-0 border-gray-700">
                        <p class="text-xs text-gray-400">Total: <span class="text-sm font-bold text-white">${precioTotal}</span></p>
                        <p class="text-sm text-red-400 font-bold mt-1">Apartado con: ${montoApartado}</p>
                    </div>
                </div>
            `;
        });
        contenedorPedidos.innerHTML = htmlContenido;
    } catch (error) {
        console.error("[Pedidos] Error:", error);
    }
};

// 11. OBSERVADOR DE ESTADO DE SESIÓN (Y CONTROL DE NOTAS ADMIN)
onAuthStateChanged(auth, async (user) => {
    const btn = document.getElementById('auth-btn');
    const btnNotas = document.getElementById('btn-notas');

    if (user) {
        if (btn) {
            btn.innerHTML = '<i class="fa-solid fa-user"></i> <span class="hidden sm:inline display-nombre">Mi Cuenta</span>';
            btn.onclick = () => { 
                window.toggleLoginModal(); 
                window.showView('view-dashboard'); 
            };
        }
        try {
            const docSnap = await getDoc(doc(db, "users", user.uid));
            if (docSnap.exists()) {
                const data = docSnap.data();
                document.querySelectorAll('.display-nombre').forEach(el => el.innerText = data.nombre);
                document.querySelectorAll('.display-celular').forEach(el => el.innerText = data.celular || "No disponible");
                
                if (btnNotas) {
                    if (data.role === 'admin') {
                        btnNotas.classList.remove('hidden');
                        // --- NUEVO: Carga las notas de Firebase de inmediato si es Admin ---
                        if (typeof window.cargarNotasAdmin === 'function') window.cargarNotasAdmin();
                    } else {
                        btnNotas.classList.add('hidden');
                    }
                }
            }
        } catch (e) { console.error(e); }
        if (typeof window.cargarPedidos === 'function') window.cargarPedidos();
    } else {
        if (btnNotas) btnNotas.classList.add('hidden');
        if (btn) {
            btn.innerHTML = '<i class="fa-solid fa-user"></i> <span class="hidden sm:inline">Ingresar</span>';
            btn.onclick = () => { 
                window.toggleLoginModal(); 
                window.showView('view-login'); 
            };
        }
    }
});

// DISPARADORES INICIALES DE LA PÁGINA
document.addEventListener('DOMContentLoaded', () => {
    vincularBotones();

    // --- NUEVA SECCIÓN: RESTRICCIÓN EN TIEMPO REAL PARA CELULARES ---
    const configurarRestriccionCelular = (idInput) => {
        const input = document.getElementById(idInput);
        if (input) {
            input.setAttribute('maxLength', '10'); // Bloquea escribir más de 10 letras/números
            input.addEventListener('input', (e) => {
                // Borra automáticamente cualquier letra o símbolo que no sea número
                e.target.value = e.target.value.replace(/\D/g, '');
            });
        }
    };
    
    // Aplicamos el bloqueador al input de registro y al de edición
    configurarRestriccionCelular('reg-celular');
    configurarRestriccionCelular('input-nuevo-celular');
    // ---------------------------------------------------------------

    const seccionInicio = document.getElementById('page-inicio');
    if (seccionInicio) {
        seccionInicio.classList.add('active');
    }
});