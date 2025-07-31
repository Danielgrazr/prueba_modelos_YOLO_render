document.addEventListener('DOMContentLoaded', () => {
    const video = document.getElementById('video');
    const canvas = document.getElementById('canvas');
    const status = document.getElementById('status');
    const ctx = canvas.getContext('2d');
    // --- ELEMENTOS AÑADIDOS PARA EL ENFOQUE ---
    const focusControl = document.getElementById('focus-control');
    const focusSlider = document.getElementById('focus-slider');
    
    const socket = io.connect(location.protocol + '//' + document.domain + ':' + location.port);

    let isWaitingForResponse = false;

    socket.on('connect', () => {
        status.textContent = 'Conectado. Iniciando cámara...';
        initCamera();
    });

    // --- FUNCIÓN MODIFICADA PARA AÑADIR LA LÓGICA DE ENFOQUE ---
    async function initCamera() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            video.srcObject = stream;

            // Lógica de control de enfoque
            const [track] = stream.getVideoTracks();
            const capabilities = track.getCapabilities();

            // Comprobar si el control de enfoque es soportado
            if (capabilities.focusDistance) {
                focusControl.style.display = 'block'; // Mostrar la barra

                // Configurar los valores min, max y step de la barra
                focusSlider.min = capabilities.focusDistance.min;
                focusSlider.max = capabilities.focusDistance.max;
                focusSlider.step = capabilities.focusDistance.step;
                
                // Evento para cambiar el enfoque cuando se mueve la barra
                focusSlider.addEventListener('input', (event) => {
                    track.applyConstraints({
                        advanced: [{
                            focusMode: 'manual',
                            focusDistance: event.target.value
                        }]
                    });
                });
            } else {
                console.log("El control manual de enfoque no es soportado por esta cámara/navegador.");
            }
            
            video.onloadedmetadata = () => {
                status.textContent = 'Cámara activa. Detectando en tiempo real...';
                requestAnimationFrame(detectionLoop);
            };

        } catch (e) {
            status.textContent = `Error al acceder a la cámara: ${e.message}`;
        }
    }

    function detectionLoop() {
        if (!isWaitingForResponse) {
            sendFrame();
        }
        requestAnimationFrame(detectionLoop);
    }

    function sendFrame() {
        if (video.readyState === video.HAVE_ENOUGH_DATA) {
            isWaitingForResponse = true;

            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = video.videoWidth;
            tempCanvas.height = video.videoHeight;
            const tempCtx = tempCanvas.getContext('2d');
            tempCtx.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height);
            const dataURL = tempCanvas.toDataURL('image/jpeg', 0.7);
            socket.emit('image', dataURL);
        }
    }

    socket.on('response', (detections) => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        detections.forEach(det => {
            const [x1, y1, x2, y2] = det.box;
            const label = det.class_name;
            const conf = det.confidence;
            
            const scaleX = canvas.width / video.videoWidth;
            const scaleY = canvas.height / video.videoHeight;

            ctx.strokeStyle = '#00FF00';
            ctx.lineWidth = 2;
            ctx.strokeRect(x1 * scaleX, y1 * scaleY, (x2 - x1) * scaleX, (y2 - y1) * scaleY);

            ctx.fillStyle = '#00FF00';
            ctx.font = '18px sans-serif';
            ctx.fillText(`${label} (${(conf * 100).toFixed(1)}%)`, x1 * scaleX, (y1 * scaleY) > 10 ? (y1 * scaleY) - 5 : 20);
        });

        isWaitingForResponse = false; 
    });
});