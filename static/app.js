/* ===== Configuración de Usuarios y Permisos ===== */

const USUARIOS = {
    "11111111": {
        pass: "contraseña",
        mensaje: "BIENVENIDO DIRECTOR",
        cursosPermitidos: null,
        tipo: "admin"
    },
    "22222222": {
        pass: "contraseña",
        mensaje: "BIENVENIDO PROFESOR/A",
        cursosPermitidos: ["6°2°A TT", "3°4°C TT"],
        tipo: "preceptor"
    },
    "33333333": {
        pass: "contraseña",
        mensaje: "BIENVENIDO PRECEPTOR/A",
        cursosPermitidos: ["5°1°A TM", "6°1°C TM"],
        tipo: "preceptor"
    },
    "44444444": {
        pass: "contraseña",
        mensaje: "BIENVENIDO PERALTA ALEJO",
        tipo: "alumno",
        curso: "2°3°",
        nombreAlumnoBusqueda: "Peralta"
    }
};

let usuarioActual = null;


/* ===== Lógica de Autenticación / Login ===== */

document.getElementById("login-form").addEventListener("submit", async e => {
    e.preventDefault();
    const dniInput = document.getElementById("login-dni").value.trim();
    const passInput = document.getElementById("login-password").value;
    const errorDiv = document.getElementById("login-error");

    if (USUARIOS[dniInput] && USUARIOS[dniInput].pass === passInput) {
        usuarioActual = USUARIOS[dniInput];
        errorDiv.style.display = "none";
        document.getElementById("login-overlay").style.display = "none";

        // Configurar mensaje de bienvenida
        const toast = document.getElementById("toast-bienvenida");
        document.getElementById("toast-texto").textContent = usuarioActual.mensaje;
        toast.style.display = "grid";

        toast.onclick = () => {
            toast.style.display = "none";
        };

        // Evaluar según tipo de usuario
        if (usuarioActual.tipo === "alumno") {
            // Ocultar paneles laterales y activar ancho completo en pantalla
            document.getElementById("cursos").style.display = "none";
            document.getElementById("alumnos").style.display = "none";
            document.querySelector(".container").classList.add("modo-alumno");
            
            await cargarFichaAlumnoDirecto(usuarioActual.curso, usuarioActual.nombreAlumnoBusqueda);
        } else {
            cargarCursos();
        }
    } else {
        errorDiv.style.display = "block";
    }
});


const cursosDiv = document.getElementById("cursos");
const alumnosDiv = document.getElementById("alumnos-contenido");
const detalleDiv = document.getElementById("detalle");
const buscador = document.getElementById("buscador");


let cursoActual = null;                    
let seleccion = { curso: null, id: null }; 
let temporizador = null;                   
let ultimaBusqueda = 0;                    
let tokenDetalle = 0;                      
let alumnosCurso = [];                     
let alumnosCursoNombre = null;
let soloPendientes = false;                

const TEXTO_INICIAL = "<h2>Seleccione un curso</h2>";

const CAMPOS_NOTAS = [
    "primer_bimestre",
    "segundo_bimestre",
    "nota_primer_cuatrimestre",
    "tercer_bimestre",
    "cuarto_bimestre",
    "nota_segundo_cuatrimestre",
    "primer_cierre",
    "segundo_cierre",
    "tercer_cierre"
];

const CAMPOS_CUATRIMESTRE = new Set([
    "nota_primer_cuatrimestre",
    "nota_segundo_cuatrimestre"
]);


/* ===== Tema claro / oscuro ===== */

const temaBtn = document.getElementById("tema-toggle");
const TEMA_KEY = "tema";
const prefiereOscuro = window.matchMedia("(prefers-color-scheme: dark)");

function temaGuardado() {
    try {
        return localStorage.getItem(TEMA_KEY);
    } catch (e) {
        return null;
    }
}

function aplicarTema(tema) {
    const raiz = document.documentElement;
    raiz.classList.add("sin-transiciones");
    raiz.setAttribute("data-theme", tema);
    requestAnimationFrame(() =>
        requestAnimationFrame(() => raiz.classList.remove("sin-transiciones"))
    );

    const oscuro = tema === "dark";
    temaBtn.textContent = oscuro ? "☀️" : "🌙";
    const etiqueta = oscuro ? "Cambiar a modo claro" : "Cambiar a modo oscuro";
    temaBtn.setAttribute("aria-label", etiqueta);
    temaBtn.title = etiqueta;
}

function temaInicial() {
    const guardado = temaGuardado();
    if (guardado === "light" || guardado === "dark") {
        return guardado;
    }
    return prefiereOscuro.matches ? "dark" : "light";
}

temaBtn.addEventListener("click", () => {
    const actual = document.documentElement.getAttribute("data-theme");
    const nuevo = actual === "dark" ? "light" : "dark";
    aplicarTema(nuevo);
    try {
        localStorage.setItem(TEMA_KEY, nuevo);
    } catch (e) {}
});

prefiereOscuro.addEventListener("change", e => {
    if (!temaGuardado()) {
        aplicarTema(e.matches ? "dark" : "light");
    }
});

aplicarTema(temaInicial());


/* ===== Utilidades ===== */

function esc(texto) {
    return String(texto ?? "").replace(/[&<>"']/g, c => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    }[c]));
}

function aNota(valor) {
    if (valor === null || valor === undefined || valor === "") return null;
    const n = parseFloat(String(valor).replace(",", "."));
    return Number.isFinite(n) && n >= 1 && n <= 10 ? n : null;
}

function claseNota(valor, minima) {
    const n = aNota(valor);
    if (n === null) return "nota-vacia";
    return n >= minima ? "nota-ok" : "nota-bad";
}

function fmt(n) {
    if (n === null || n === undefined) return "–";
    return n.toLocaleString("es-AR", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1
    });
}

function celdaNota(valor, campo, minima, curso, idAlumno, materiaNombre) {
    const n = aNota(valor);
    const clases = [
        claseNota(valor, minima),
        CAMPOS_CUATRIMESTRE.has(campo) ? "col-cuat" : ""
    ].join(" ").trim();

    const esAlumno = usuarioActual && usuarioActual.tipo === "alumno";

    if (esAlumno) {
        return `<td class="${clases}">${n === null ? "–" : esc(valor)}</td>`;
    }

    return `<td class="${clases}" contenteditable="true"
                data-curso="${esc(curso)}"
                data-id="${esc(idAlumno)}"
                data-materia="${esc(materiaNombre)}"
                data-campo="${esc(campo)}"
                data-original="${esc(valor ?? '')}">${n === null ? "–" : esc(valor)}</td>`;
}

function mostrarInicio() {
    detalleDiv.innerHTML = `
        <div class="estado-vacio">
            <span class="estado-icono">🎓</span>
            <p>Elegí un curso para ver su resumen,<br>
               o buscá un alumno por nombre.</p>
        </div>
    `;
}


/* ===== Cursos con filtrado por permisos ===== */

async function cargarCursos() {
    const response = await fetch("/api/cursos");
    let cursos = await response.json();

    if (usuarioActual && usuarioActual.cursosPermitidos) {
        cursos = cursos.filter(c => usuarioActual.cursosPermitidos.includes(c));
    }

    cursosDiv.innerHTML = "<h2>Cursos</h2>";

    const grupos = {
        "📚 Ciclo Básico": [],
        "💻 Computación": [],
        "🔧 Automotor": [],
        "📁 Otros": []
    };

    cursos.forEach(curso => {
        const nombre = curso.toUpperCase();
        if (nombre.startsWith("1°") || nombre.startsWith("2°")) {
            grupos["📚 Ciclo Básico"].push(curso);
        } else if (nombre.includes("C")) {
            grupos["💻 Computación"].push(curso);
        } else if (nombre.includes("A")) {
            grupos["🔧 Automotor"].push(curso);
        } else {
            grupos["📁 Otros"].push(curso);
        }
    });

    for (const categoria in grupos) {
        if (grupos[categoria].length === 0) continue;

        const titulo = document.createElement("div");
        titulo.className = "categoria";
        titulo.textContent = categoria;
        cursosDiv.appendChild(titulo);

        grupos[categoria].forEach(curso => {
            const boton = document.createElement("button");
            boton.className = "curso-btn";
            boton.textContent = curso;
            boton.dataset.curso = curso;
            boton.onclick = () => {
                buscador.value = "";
                cargarAlumnos(curso);
            };
            cursosDiv.appendChild(boton);
        });
    }

    marcarActivo();
}


/* ===== Cargar Ficha Directa para Alumno ===== */

async function cargarFichaAlumnoDirecto(curso, nombreBusqueda) {
    try {
        const response = await fetch(`/api/curso/${encodeURIComponent(curso)}`);
        if (!response.ok) throw new Error("No se pudo obtener el curso");
        const alumnos = await response.json();

        const alumnoEncontrado = alumnos.find(a => a.nombre.toLowerCase().includes(nombreBusqueda.toLowerCase()));

        if (alumnoEncontrado) {
            await cargarAlumno(curso, alumnoEncontrado.id);
        } else {
            detalleDiv.innerHTML = '<p class="estado-vacio">No se encontró el registro del alumno.</p>';
        }
    } catch (err) {
        console.error(err);
        detalleDiv.innerHTML = '<p class="estado-vacio">Error al cargar la información del alumno.</p>';
    }
}


/* ===== Lista de alumnos de un curso ===== */

async function cargarAlumnos(curso, limpiarDetalle = true) {
    cursoActual = curso;

    if (limpiarDetalle) {
        seleccion = { curso: null, id: null };
        cargarResumenCurso(curso);
    }

    let alumnos;
    try {
        const response = await fetch(`/api/curso/${encodeURIComponent(curso)}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        alumnos = await response.json();
    } catch (error) {
        console.error("Error al cargar alumnos:", error);
        alumnosDiv.innerHTML = "<h2>Error</h2>";
        alumnosDiv.insertAdjacentHTML(
            "beforeend",
            '<p class="sin-resultados">No se pudo cargar la lista de alumnos.</p>'
        );
        return;
    }

    if (curso !== cursoActual) return;
    if (!limpiarDetalle && buscador.value.trim() !== "") return;

    alumnosCurso = alumnos;
    alumnosCursoNombre = curso;

    dibujarListaAlumnos();
}

function etiquetaAlumnos(n) {
    return `${n} ${n === 1 ? "alumno" : "alumnos"}`;
}

function dibujarListaAlumnos(enfocarFiltro = false) {
    const lista = soloPendientes
        ? alumnosCurso.filter(a => a.pendientes > 0)
        : alumnosCurso;

    alumnosDiv.innerHTML = "";

    const titulo = document.createElement("h2");
    titulo.textContent = alumnosCursoNombre;
    alumnosDiv.appendChild(titulo);

    const barra = document.createElement("div");
    barra.className = "lista-toolbar";

    const contador = document.createElement("span");
    contador.className = "contador";
    contador.textContent = soloPendientes
        ? `${lista.length} de ${etiquetaAlumnos(alumnosCurso.length)}`
        : etiquetaAlumnos(alumnosCurso.length);

    const etiqueta = document.createElement("label");
    etiqueta.className = "filtro-check";

    const check = document.createElement("input");
    check.type = "checkbox";
    check.checked = soloPendientes;

    check.addEventListener("change", () => {
        soloPendientes = check.checked;
        dibujarListaAlumnos(true);
    });

    etiqueta.append(check, " Solo con pendientes");
    barra.append(contador, etiqueta);
    alumnosDiv.appendChild(barra);

    if (lista.length === 0) {
        const p = document.createElement("p");
        p.className = "sin-resultados";
        p.textContent = "Ningún alumno con pendientes en este curso.";
        alumnosDiv.appendChild(p);
    } else {
        const grid = document.createElement("div");
        grid.className = "alumnos-grid";

        lista.forEach(alumno => {
            const item = document.createElement("div");
            item.className = "alumno-item";
            item.textContent = alumno.nombre;
            item.title = alumno.nombre;

            item.dataset.curso = alumnosCursoNombre;
            item.dataset.id = String(alumno.id);

            if (alumno.pendientes > 0) {
                item.classList.add("con-pendientes");
                item.title = `${alumno.nombre} — ${alumno.pendientes} ` +
                    (alumno.pendientes === 1 ? "materia pendiente" : "materias pendientes");
            }

            item.onclick = () => cargarAlumno(alumnosCursoNombre, alumno.id);
            grid.appendChild(item);
        });

        alumnosDiv.appendChild(grid);
    }

    marcarActivo();
    if (enfocarFiltro) check.focus();
}


/* ===== Resumen del curso ===== */

async function cargarResumenCurso(curso) {
    const token = ++tokenDetalle;
    detalleDiv.innerHTML = '<p class="estado-vacio">Cargando resumen...</p>';

    try {
        const response = await fetch(`/api/curso/${encodeURIComponent(curso)}/resumen`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const resumen = await response.json();

        if (token !== tokenDetalle) return;
        detalleDiv.innerHTML = htmlResumen(resumen);
    } catch (error) {
        if (token !== tokenDetalle) return;
        console.error("Error al cargar el resumen:", error);
        detalleDiv.innerHTML = '<p class="estado-vacio">No se pudo cargar el resumen del curso.</p>';
    }
}

function htmlResumen(r) {
    const min = r.nota_aprobacion;
    const porcentaje = r.cantidad_alumnos
        ? Math.round(r.con_pendientes * 100 / r.cantidad_alumnos)
        : 0;

    const barras = r.materias.map(m => `
        <div class="barra-fila">
            <span class="barra-nombre" title="${esc(m.nombre)}">${esc(m.nombre)}</span>
            <div class="barra-pista">
                <div class="barra-relleno ${claseNota(m.promedio, min)}"
                     style="width: ${(m.promedio ?? 0) * 10}%"></div>
            </div>
            <span class="barra-valor ${claseNota(m.promedio, min)}">${fmt(m.promedio)}</span>
        </div>
    `).join("");

    return `
        <div class="ficha-head">
            <div>
                <h2>${esc(r.curso)}</h2>
                <p class="ficha-sub">Resumen del curso</p>
            </div>
            <button type="button" class="btn-imprimir no-imprimir"
                    data-imprimir data-titulo="Resumen ${esc(r.curso)}">
                🖨 Imprimir / PDF
            </button>
        </div>

        <p class="solo-impresion">
            Sistema de Gestión de Calificaciones · Emitido el
            ${new Date().toLocaleDateString("es-AR")}
        </p>

        <div class="kpis">
            <div class="kpi">
                <span class="kpi-label">Alumnos</span>
                <span class="kpi-valor">${r.cantidad_alumnos}</span>
            </div>
            <div class="kpi">
                <span class="kpi-label">Con pendientes</span>
                <span class="kpi-valor ${r.con_pendientes ? "nota-bad" : "nota-ok"}">${r.con_pendientes}</span>
                <span class="kpi-nota">${porcentaje}% del curso</span>
            </div>
            <div class="kpi">
                <span class="kpi-label">Promedio del curso</span>
                <span class="kpi-valor ${claseNota(r.promedio_general, min)}">${fmt(r.promedio_general)}</span>
                <span class="kpi-nota">
                    1° cuat. ${fmt(r.promedio_primer_cuatrimestre)} ·
                    2° cuat. ${fmt(r.promedio_segundo_cuatrimestre)}
                </span>
            </div>
            <div class="kpi">
                <span class="kpi-label">Con materias desaprobadas</span>
                <span class="kpi-valor ${r.con_desaprobadas ? "nota-bad" : "nota-ok"}">${r.con_desaprobadas}</span>
                <span class="kpi-nota">en algún cuatrimestre</span>
            </div>
        </div>

        <h3 class="seccion-titulo">Promedio por materia (de menor a mayor)</h3>
        <div class="barras">${barras}</div>

        <p class="nota-pie">
            Promedios calculados con las notas de 1° y 2° cuatrimestre.
            Se considera aprobada una nota igual o mayor a ${min}.
        </p>
        <p class="estado-pista no-imprimir">
            Elegí un alumno de la lista para ver su ficha completa.
        </p>
    `;
}


/* ===== Ficha del alumno ===== */

function sparkline(materia, minima) {
    const etiquetas = ["1° Bim", "2° Bim", "3° Bim", "4° Bim"];
    const valores = [
        materia.primer_bimestre,
        materia.segundo_bimestre,
        materia.tercer_bimestre,
        materia.cuarto_bimestre
    ].map(aNota);

    if (valores.filter(v => v !== null).length < 2) return "";

    const W = 120, H = 40, PX = 8, PY = 6;
    const ESCALA_MIN = 3, ESCALA_MAX = 10;
    const x = i => PX + i * ((W - 2 * PX) / 3);
    const y = v => {
        const t = (ESCALA_MAX - Math.max(v, ESCALA_MIN)) / (ESCALA_MAX - ESCALA_MIN);
        return PY + t * (H - 2 * PY);
    };

    const linea = valores
        .map((v, i) => v === null ? null : `${x(i).toFixed(1)},${y(v).toFixed(1)}`)
        .filter(Boolean)
        .join(" ");

    const yMin = y(minima).toFixed(1);
    const puntos = valores.map((v, i) => v === null ? "" : `
        <circle cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="3"
                class="${v >= minima ? "punto-ok" : "punto-bad"}">
            <title>${etiquetas[i]}: ${v}</title>
        </circle>
    `).join("");

    return `
        <svg class="spark" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"
             role="img" aria-label="Evolución de las notas por bimestre">
            <line class="spark-min" x1="${PX}" x2="${W - PX}" y1="${yMin}" y2="${yMin}"/>
            <polyline class="spark-linea" points="${linea}"/>
            ${puntos}
        </svg>
    `;
}

function tarjetaMateria(nombre, materia, promedio, minima, curso, idAlumno) {
    const chip = promedio === null || promedio === undefined
        ? ""
        : `<span class="prom-chip ${claseNota(promedio, minima)}">Prom. ${fmt(promedio)}</span>`;

    const celdas = CAMPOS_NOTAS
        .map(campo => celdaNota(materia[campo], campo, minima, curso, idAlumno, nombre))
        .join("");

    return `
        <div class="materia-card">
            <div class="materia-head">
                <h3>${esc(nombre)}</h3>
                <div class="materia-meta">
                    ${chip}
                    ${sparkline(materia, minima)}
                </div>
            </div>
            <table class="tabla-notas">
                <thead>
                    <tr>
                        <th colspan="3" class="grupo-cuatrimestre">1° Cuatrimestre</th>
                        <th colspan="3" class="grupo-cuatrimestre">2° Cuatrimestre</th>
                        <th colspan="3" class="grupo-cierres">Cierres</th>
                    </tr>
                    <tr>
                        <th>1° Bim</th>
                        <th>2° Bim</th>
                        <th>Nota Cuat.</th>
                        <th>3° Bim</th>
                        <th>4° Bim</th>
                        <th>Nota Cuat.</th>
                        <th>1°</th>
                        <th>2°</th>
                        <th>3°</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>${celdas}</tr>
                </tbody>
            </table>
        </div>
    `;
}

function htmlFicha(alumno, curso) {
    const a = alumno.analisis;
    const min = a.nota_aprobacion;
    const pendientes = a.pendientes.length
        ? `
            <div class="pendientes-box">
                <span class="pendientes-titulo">⚠ Materias pendientes (${a.pendientes.length})</span>
                <div class="pendientes-lista">
                    ${a.pendientes.map(p => `<span class="pendiente-tag">${esc(p)}</span>`).join("")}
                </div>
            </div>
        `
        : `
            <div class="pendientes-box sin-pendientes">
                <span class="pendientes-titulo">✓ Sin materias pendientes</span>
            </div>
        `;

    const desaprobadas = a.materias_desaprobadas.length;
    const tarjetas = Object.keys(alumno.materias)
        .map(nombre => tarjetaMateria(
            nombre,
            alumno.materias[nombre],
            a.promedios_materias[nombre],
            min,
            curso,
            alumno.id
        ))
        .join("");

    const esAlumno = usuarioActual && usuarioActual.tipo === "alumno";
    const notaPieTexto = esAlumno 
        ? "Promedios calculados con las notas de 1° y 2° cuatrimestre."
        : "Promedios calculados con las notas de 1° y 2° cuatrimestre. Podes hacer clic en cualquier nota para editarla directamente.";

    return `
        <div class="ficha-head">
            <div>
                <h2>${esc(alumno.nombre)}</h2>
                <p class="ficha-sub">N° ${esc(alumno.id)} · Curso ${esc(curso)}</p>
            </div>
            <button type="button" class="btn-imprimir no-imprimir"
                    data-imprimir data-titulo="Calificaciones ${esc(alumno.nombre)}">
                🖨 Imprimir / PDF
            </button>
        </div>

        <p class="solo-impresion">
            Sistema de Gestión de Calificaciones · Emitido el
            ${new Date().toLocaleDateString("es-AR")}
        </p>

        ${pendientes}

        <div class="kpis">
            <div class="kpi">
                <span class="kpi-label">Promedio general</span>
                <span class="kpi-valor ${claseNota(a.promedio_general, min)}">${fmt(a.promedio_general)}</span>
            </div>
            <div class="kpi">
                <span class="kpi-label">1° Cuatrimestre</span>
                <span class="kpi-valor ${claseNota(a.promedio_primer_cuatrimestre, min)}">${fmt(a.promedio_primer_cuatrimestre)}</span>
            </div>
            <div class="kpi">
                <span class="kpi-label">2° Cuatrimestre</span>
                <span class="kpi-valor ${claseNota(a.promedio_segundo_cuatrimestre, min)}">${fmt(a.promedio_segundo_cuatrimestre)}</span>
            </div>
            <div class="kpi">
                <span class="kpi-label">Materias desaprobadas</span>
                <span class="kpi-valor ${desaprobadas ? "nota-bad" : "nota-ok"}">${desaprobadas}</span>
                <span class="kpi-nota">${desaprobadas
                    ? esc(a.materias_desaprobadas.join(", "))
                    : "Ninguna en los cuatrimestres"}</span>
            </div>
        </div>

        ${tarjetas}

        <p class="nota-pie">${notaPieTexto}</p>
    `;
}

async function cargarAlumno(curso, idAlumno) {
    seleccion = { curso: curso, id: String(idAlumno) };
    marcarActivo();
    const token = ++tokenDetalle;

    try {
        const response = await fetch(`/api/alumno/${encodeURIComponent(curso)}/${idAlumno}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const alumno = await response.json();

        if (token !== tokenDetalle) return;
        detalleDiv.innerHTML = htmlFicha(alumno, curso);
    } catch (error) {
        if (token !== tokenDetalle) return;
        console.error("Error al cargar el alumno:", error);
        detalleDiv.innerHTML = '<p class="estado-vacio">No se pudo cargar la ficha del alumno.</p>';
    }
}


/* ===== Evento para guardar edición en Excel y JSON ===== */

async function guardarCambioNota(celda) {
    const curso = celda.dataset.curso;
    const id_alumno = celda.dataset.id;
    const materia = celda.dataset.materia;
    const campo = celda.dataset.campo;
    const valorOriginal = celda.dataset.original;
    const nuevoValor = celda.innerText.trim();

    if (nuevoValor === valorOriginal) return;

    try {
        celda.style.opacity = "0.5";
        const response = await fetch("/api/actualizar", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                curso: curso,
                id_alumno: id_alumno,
                materia: materia,
                campo: campo,
                valor: nuevoValor === "–" ? "" : nuevoValor
            })
        });

        const res = await response.json();
        if (!response.ok) {
            throw new Error(res.error || "Error al actualizar");
        }

        cargarAlumno(curso, id_alumno);
    } catch (err) {
        console.error("Error al guardar cambio:", err);
        alert("No se pudo guardar la nota en el archivo Excel: " + err.message);
        celda.innerText = valorOriginal;
        celda.style.opacity = "1";
    }
}

detalleDiv.addEventListener("keydown", e => {
    if (e.target.matches('[contenteditable="true"]') && e.key === "Enter") {
        e.preventDefault();
        e.target.blur();
    }
});

detalleDiv.addEventListener("blur", e => {
    if (e.target.matches('[contenteditable="true"]')) {
        guardarCambioNota(e.target);
    }
}, true);


/* ===== Imprimir / guardar como PDF ===== */

function imprimir(titulo) {
    const tituloOriginal = document.title;
    if (titulo) document.title = titulo;
    window.addEventListener(
        "afterprint",
        () => { document.title = tituloOriginal; },
        { once: true }
    );
    window.print();
}

detalleDiv.addEventListener("click", e => {
    const boton = e.target.closest("[data-imprimir]");
    if (boton) imprimir(boton.dataset.titulo);
});


/* ===== Selección activa ===== */

function marcarActivo() {
    document.querySelectorAll(".alumno-item").forEach(el => {
        el.classList.toggle(
            "activo",
            el.dataset.curso === seleccion.curso &&
            el.dataset.id === seleccion.id
        );
    });

    document.querySelectorAll(".curso-btn").forEach(btn => {
        btn.classList.toggle("activo", btn.dataset.curso === cursoActual);
    });
}


/* ===== Buscador global con filtro de permisos ===== */

function restaurarVista() {
    if (!cursoActual) {
        alumnosDiv.innerHTML = TEXTO_INICIAL;
        return;
    }
    if (alumnosCursoNombre === cursoActual) {
        dibujarListaAlumnos();
    } else {
        cargarAlumnos(cursoActual, false);
    }
}

function mostrarMensajeBusqueda(mensaje) {
    alumnosDiv.innerHTML = "<h2>Resultados</h2>";
    const p = document.createElement("p");
    p.className = "sin-resultados";
    p.textContent = mensaje;
    alumnosDiv.appendChild(p);
}

async function buscarAlumnos(texto) {
    const idBusqueda = ++ultimaBusqueda;
    mostrarMensajeBusqueda("Buscando...");

    try {
        const response = await fetch(`/api/alumnos/buscar?q=${encodeURIComponent(texto)}`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        let resultados = await response.json();

        if (usuarioActual && usuarioActual.cursosPermitidos) {
            resultados = resultados.filter(a => usuarioActual.cursosPermitidos.includes(a.curso));
        }

        if (idBusqueda !== ultimaBusqueda) return;
        mostrarResultados(resultados);
    } catch (error) {
        if (idBusqueda !== ultimaBusqueda) return;
        console.error("Error en la búsqueda:", error);
        mostrarMensajeBusqueda(
            "No se pudo realizar la búsqueda. Revisá que el servidor esté activo."
        );
    }
}

function mostrarResultados(resultados) {
    alumnosDiv.innerHTML = `<h2>Resultados (${resultados.length})</h2>`;

    if (resultados.length === 0) {
        const p = document.createElement("p");
        p.className = "sin-resultados";
        p.textContent = "No se encontraron alumnos.";
        alumnosDiv.appendChild(p);
        return;
    }

    const grid = document.createElement("div");
    grid.className = "alumnos-grid resultados";

    resultados.forEach(a => {
        const item = document.createElement("div");
        item.className = "alumno-item resultado";
        item.dataset.curso = a.curso;
        item.dataset.id = String(a.id);
        item.title = `${a.nombre} - ${a.curso}`;

        if (a.pendientes > 0) item.classList.add("con-pendientes");

        const nombre = document.createElement("span");
        nombre.className = "alumno-nombre";
        nombre.textContent = a.nombre;

        const curso = document.createElement("span");
        curso.className = "alumno-curso";
        curso.textContent = a.curso;

        item.append(nombre, curso);
        item.onclick = () => {
            cursoActual = a.curso;
            cargarAlumno(a.curso, a.id);
        };

        grid.appendChild(item);
    });

    alumnosDiv.appendChild(grid);
    marcarActivo();
}

function procesarBusqueda() {
    clearTimeout(temporizador);
    ultimaBusqueda++;

    const texto = buscador.value.trim();
    if (texto === "") {
        restaurarVista();
        return;
    }
    if (texto.length < 2) {
        mostrarMensajeBusqueda("Escribí al menos 2 letras...");
        return;
    }

    temporizador = setTimeout(() => buscarAlumnos(texto), 250);
}

buscador.addEventListener("input", procesarBusqueda);
buscador.addEventListener("search", procesarBusqueda);


/* ===== Inicio ===== */

if (!usuarioActual || usuarioActual.tipo !== "alumno") {
    mostrarInicio();
}