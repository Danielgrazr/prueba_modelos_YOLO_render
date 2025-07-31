import io
import base64
from flask import Flask, render_template
from flask_socketio import SocketIO
from PIL import Image
from ultralytics import YOLO
import eventlet
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# --- LÍNEA CORREGIDA ---
socketio = SocketIO(app, cors_allowed_origins="*", max_http_buffer_size=1e8, async_mode='eventlet')

# Carga tu modelo .pt una sola vez al iniciar
try:
    model = YOLO('Tapon_6800.pt')
    print("Modelo 'Tapon_6800.pt' cargado exitosamente.")
except Exception as e:
    print(f"Error al cargar el modelo: {e}")
    model = None

@app.route('/')
def index():
    """Sirve la página principal."""
    return render_template('index.html')

@socketio.on('image')
def handle_image(data_image):
    """Recibe un fotograma, lo procesa con YOLO y devuelve los resultados."""
    if not model:
        return

    # Decodificar la imagen de base64
    try:
        image_data = base64.b64decode(data_image.split(',')[1])
        image = Image.open(io.BytesIO(image_data))
    except Exception as e:
        return

    # Realizar la predicción
    results = model(image, verbose=False, conf=0.5)

    # Extraer los resultados
    detections = []
    for box in results[0].boxes:
        xyxy = box.xyxy[0].tolist()
        conf = float(box.conf[0])
        class_id = int(box.cls[0])
        class_name = model.names[class_id]
        
        detections.append({
            'box': xyxy,
            'confidence': conf,
            'class_name': class_name
        })
    
    # Enviar las detecciones de vuelta al navegador
    socketio.emit('response', detections)

if __name__ == '__main__':
    print("Iniciando servidor en http://127.0.0.1:5000")
    # Asegúrate de usar socketio.run, no app.run
    socketio.run(app, host='0.0.0.0', port=5000)