// Shared Logic for SEP Dashboard

document.addEventListener("DOMContentLoaded", () => {
    console.log("SEP Dashboard Logic Initialized");
    
    // 1. Mobile Sidebar Logic
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const btn = document.getElementById('mobile-menu-btn');
    const closeBtn = document.getElementById('close-sidebar-btn');

    if(!sidebar) console.warn("Sidebar element not found");
    if(!btn) console.warn("Mobile menu button not found");

    function toggleSidebar() {
      console.log("Toggling sidebar");
      if(!sidebar) return;
      sidebar.classList.toggle('-translate-x-full');
      if(overlay) {
        if(overlay.classList.contains('hidden')) {
          overlay.classList.remove('hidden');
          setTimeout(() => overlay.classList.remove('opacity-0'), 10);
        } else {
          overlay.classList.add('opacity-0');
          setTimeout(() => overlay.classList.add('hidden'), 300);
        }
      }
    }

    if(btn) btn.addEventListener('click', toggleSidebar);
    if(closeBtn) closeBtn.addEventListener('click', toggleSidebar);
    if(overlay) overlay.addEventListener('click', toggleSidebar);

    window.addEventListener('resize', () => {
       if(sidebar && overlay) {
         if(window.innerWidth >= 768) {
           sidebar.classList.remove('-translate-x-full');
           overlay.classList.add('opacity-0');
           setTimeout(() => overlay.classList.add('hidden'), 300);
         } else {
           sidebar.classList.add('-translate-x-full');
         }
       }
    });

    // 2. Dynamic Premium Chart Rendering
    const canvas = document.getElementById('attendanceChart');
    if (canvas) {
      console.log("Attendance Chart Canvas detected, rendering...");
      const resizeCanvas = () => {
        const parent = canvas.parentElement;
        canvas.width = parent.offsetWidth - 32; 
        canvas.height = parent.offsetHeight - 32;
        renderChart();
      };

      const renderChart = () => {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        ctx.font = "bold 14px sans-serif";
        ctx.fillStyle = "#cbd5e1";
        ctx.textAlign = "center";
        ctx.fillText("Sin datos suficientes en DB para graficar tendencia", canvas.width/2, canvas.height/2);
      };

      window.addEventListener('resize', resizeCanvas);
      setTimeout(resizeCanvas, 100);
    }
    
    // 3. Login Forms Logic
    const formDirector = document.getElementById("form-director");
    if (formDirector) {
        formDirector.addEventListener("submit", (e) => {
            e.preventDefault();
            const password = document.getElementById("director-password").value;
            if (password === "admin123" || password.length > 0) { // Permitir acceder con cualquier password para propósito de demo o usar admin123
                window.location.href = "pages/directivos/dashboard.html";
            }
        });
    }

    const formAlumno = document.getElementById("form-alumno");
    if (formAlumno) {
        formAlumno.addEventListener("submit", (e) => {
            e.preventDefault();
            const usuario = document.getElementById("alumno-usuario").value;
            const curp = document.getElementById("alumno-curp").value;
            if (usuario.trim() && curp.trim()) {
                // Save user info for dashboard personalization
                localStorage.setItem("sep_student_name", usuario);
                window.location.href = "pages/alumnos/dashboard.html";
            }
        });
    }

    // Personalize Alumno Dashboard
    const studentNameEl = document.getElementById("student-welcome-name");
    const studentSidebarNameEl = document.getElementById("student-sidebar-name");
    const studentInitialsEl = document.getElementById("student-sidebar-initials");
    
    if (studentNameEl || studentSidebarNameEl) {
        const studentName = localStorage.getItem("sep_student_name") || "Juan Pablo García";
        
        if (studentNameEl) {
            studentNameEl.textContent = "¡Hola, " + studentName.split(' ')[0] + "!";
        }
        if (studentSidebarNameEl) {
            studentSidebarNameEl.textContent = studentName;
        }
        if (studentInitialsEl) {
            // Get initials from first two words
            const words = studentName.trim().split(' ');
            let initials = "AL";
            if (words.length >= 2) {
                initials = (words[0][0] + words[1][0]).toUpperCase();
            } else if (words.length === 1 && words[0].length > 0) {
                initials = words[0][0].toUpperCase() + (words[0][1] ? words[0][1].toUpperCase() : '');
            }
            studentInitialsEl.textContent = initials;
        }
    }

    // 4. Excel Upload Logic
    const excelInput = document.getElementById("excel-file-input");
    const uploadBtn = document.getElementById("upload-excel-btn");
    const uploadStatus = document.getElementById("upload-status-msg");

    if (excelInput && uploadBtn) {
        excelInput.addEventListener("change", () => {
            if (excelInput.files.length > 0) {
                uploadBtn.classList.remove("hidden");
                uploadBtn.textContent = "Subir " + excelInput.files[0].name;
            } else {
                uploadBtn.classList.add("hidden");
            }
        });

        uploadBtn.addEventListener("click", async () => {
            if (excelInput.files.length === 0) return;
            const file = excelInput.files[0];
            const formData = new FormData();
            formData.append("archivo", file);

            uploadBtn.textContent = "Cargando...";
            uploadBtn.disabled = true;
            uploadStatus.classList.remove("hidden", "text-green-600", "text-red-600");
            uploadStatus.textContent = "Procesando y mandando a la base de datos...";

            try {
                const { uploadAlumnosFromData } = await import('./api-client.js');
                
                // Parse excel data client-side using SheetJS
                // We need to load xlsx if it's not already in window
                if (!window.XLSX) {
                    await import('https://cdn.sheetjs.com/xlsx-0.20.0/package/xlsx.mjs')
                      .then(m => { window.XLSX = m; })
                      .catch(e => {
                          // fallback if esm fails
                          const script = document.createElement('script');
                          script.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
                          document.head.appendChild(script);
                          return new Promise(resolve => script.onload = resolve);
                      });
                }

                const reader = new FileReader();
                reader.onload = async (e) => {
                    try {
                        const data = new Uint8Array(e.target.result);
                        const workbook = XLSX.read(data, { type: 'array' });
                        const firstSheetName = workbook.SheetNames[0];
                        const worksheet = workbook.Sheets[firstSheetName];
                        const rows = XLSX.utils.sheet_to_json(worksheet);

                        if (rows.length === 0) throw new Error("El archivo está vacío");

                        const result = await uploadAlumnosFromData(rows);

                        if (result && result.success) {
                            uploadStatus.classList.add("text-green-600");
                            uploadStatus.textContent = "✅ " + (result.message || "Subido con éxito");
                            if (window.loadStudentsList) window.loadStudentsList();
                        } else {
                            uploadStatus.classList.add("text-red-600");
                            uploadStatus.textContent = "❌ Error: " + (result ? result.error : "Desconocido");
                        }
                    } catch (err) {
                        uploadStatus.classList.add("text-red-600");
                        uploadStatus.textContent = "❌ Error procesando Excel: " + err.message;
                    } finally {
                        uploadBtn.disabled = false;
                        excelInput.value = ""; // Reset
                        setTimeout(() => uploadBtn.classList.add("hidden"), 3000); // Hide button after a bit
                    }
                };
                reader.readAsArrayBuffer(file);
            } catch (error) {
                console.error(error);
                uploadStatus.classList.add("text-red-600");
                uploadStatus.textContent = "❌ Error de conexión con Supabase.";
                uploadBtn.disabled = false;
            }
        });
    }

    // 5. Fetch and Render Student List (Dashboard)
    const studentsTableBody = document.getElementById("students-table-body");
    
    window.loadStudentsList = async () => {
        if (!studentsTableBody) return;
        try {
            const { getAlumnos } = await import('./api-client.js');
            const students = await getAlumnos();
            
            if (students.length === 0) {
               studentsTableBody.innerHTML = `<tr><td colspan="4" class="text-center py-6 text-gray-500 font-bold">No hay alumnos registrados. ¡Sube un Excel!</td></tr>`;
               return;
            }
            
            studentsTableBody.innerHTML = students.map(s => `
                <tr class="hover:bg-emerald-50/50 transition-colors group">
                    <td class="px-6 py-4 font-bold text-gray-800">${s.nombre_completo}</td>
                    <td class="px-6 py-4 font-medium text-gray-500">${s.grado || '-'} ${s.grupo || '-'}</td>
                    <td class="px-6 py-4 text-gray-600 font-medium">${s.matricula || '---'}</td>
                    <td class="px-6 py-4 text-center">
                        <button onclick="deleteStudent(${s.id})" class="text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 p-1.5 rounded-lg transition-colors" title="Eliminar">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                        </button>
                    </td>
                </tr>
            `).join('');
        } catch (e) {
            console.error("Error loading students", e);
            studentsTableBody.innerHTML = `<tr><td colspan="4" class="text-center py-6 text-red-500 font-bold">Error cargando alumnos.</td></tr>`;
        }
    };

    window.deleteStudent = async (id) => {
        if (!confirm("¿Seguro que deseas eliminar a este alumno del sistema?")) return;
        try {
            const { deleteAlumno } = await import('./api-client.js');
            const success = await deleteAlumno(id);
            if (success) {
                window.loadStudentsList();
            } else {
                alert("Error eliminando alumno de la base.");
            }
        } catch(e) {
            console.error(e);
        }
    };

    if (studentsTableBody) {
        window.loadStudentsList();
    }
});
