document.addEventListener('DOMContentLoaded', () => {
    console.log("Paso 1: El DOM se ha cargado. Iniciando script.");

    const video = document.getElementById('video');
    const canvas = document.getElementById('canvas');
    const status = document.getElementById('status');
    const ctx = canvas.getContext('2d');
    const focusControl = document.getElementById('focus-control');
    const focusSlider = document.getElementById('focus-slider');
    
    console.log("Paso 2: Conectando al servidor en https://inspeccioniatapon6800.onrender.com");
    const socket = io.connect('https://inspeccioniatapon6800.onrender.com');

    let isWaitingForResponse = false;

    socket.on('connect', () => {
        console.log("Paso 3: ¡Conexión exitosa con el servidor!");
        status.textContent = 'Conectado. Iniciando cámara...';
        initCamera();
    });

    socket.on('connect_error', (err) => {
        console.error("Error de conexión con el servidor:", err);
        status.textContent = 'Error al conectar con el servidor.';
    });

    async function initCamera() {
        console.log("Paso 4: Iniciando la cámara...");
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            video.srcObject = stream;
            
            const [track] = stream.getVideoTracks();
            const capabilities = track.getCapabilities();

            if (capabilities.focusDistance) {
                console.log("Control de enfoque soportado.");
                focusControl.style.display = 'block'; 

                focusSlider.min = capabilities.focusDistance.min;
                focusSlider.max = capabilities.focusDistance.max;
                focusSlider.step = capabilities.focusDistance.step;
                
                focusSlider.addEventListener('input', (event) => {
                    track.applyConstraints({
                        advanced: [{
                            focusMode: 'manual',
                            focusDistance: event.target.value
                        }]
                    });
                });
            } else {
                console.log("El control manual de enfoque no es soportado.");
            }
            
            video.onloadedmetadata = () => {
                console.log("Paso 5: Cámara lista. Iniciando bucle de detección.");
                status.textContent = 'Cámara activa. Detectando en tiempo real...';
                requestAnimationFrame(detectionLoop);
            };

        } catch (e) {
            console.error("Error al acceder a la cámara:", e);
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
        console.log("Respuesta del servidor recibida:", detections);
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